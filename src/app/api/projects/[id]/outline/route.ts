import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "crypto";
import {canAccessProject,checkGenerationBudget,getAccess} from "@/lib/auth";
import {db} from "@/lib/db";
import {getQueue} from "@/lib/queue";

type OutlineNode={title?:unknown;description?:unknown;requirementIds?:unknown;nodeKey?:unknown;children?:unknown};
type StoredNode=Record<string,unknown>&{children?:StoredNode[]};

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const access=await getAccess(req);
  if(!access)return NextResponse.json({error:"未登录"},{status:401});
  if(!(await canAccessProject(access,id)))return NextResponse.json({error:"项目不存在"},{status:404});
  const budgetCheck=await checkGenerationBudget(access,id);
  if(!budgetCheck.ok)return NextResponse.json({error:budgetCheck.message},{status:403});
  let outlineMode:"standard"|"xique"|"dynamic"="dynamic";
  try{
    const body=await req.json();
    if(body?.outlineMode==="xique")outlineMode="xique";
    else if(body?.outlineMode==="standard")outlineMode="standard";
    else if(body?.outlineMode==="dynamic")outlineMode="dynamic";
  }catch{}
  const project=await db.query("SELECT id FROM projects WHERE id=$1",[id]);
  if(!project.rowCount)return NextResponse.json({error:"项目不存在"},{status:404});
  const running=await db.query("SELECT 1 FROM jobs WHERE project_id=$1 AND type='outline' AND status IN ('queued','running') LIMIT 1",[id]);
  if(running.rowCount)return NextResponse.json({error:"大纲正在生成，请稍候"},{status:409});
  const count=await db.query("SELECT count(*)::int AS count FROM requirements WHERE project_id=$1 AND review_status<>'rejected'",[id]);
  if(!count.rows[0].count)return NextResponse.json({error:"项目还没有可用于生成大纲的要求"},{status:400});
  const jobId=randomUUID();
  const client=await db.connect();
  try{
    await client.query("BEGIN");
    await client.query("INSERT INTO jobs(id,project_id,type,status) VALUES($1,$2,'outline','queued')",[jobId,id]);
    await client.query("INSERT INTO outlines(project_id,status,model) VALUES($1,'generating',$2) ON CONFLICT(project_id) DO UPDATE SET status='generating',model=excluded.model,error_message=NULL,updated_at=now()",[id,outlineMode==="dynamic"?"gpt-5.5":"deepseek-v4-pro"]);
    await client.query("UPDATE projects SET status='outlining',progress=0,error_message=NULL,updated_at=now() WHERE id=$1",[id]);
    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");throw error;
  }finally{client.release()}
  const queue=await getQueue();
  await queue.lPush("ai_bid:jobs",JSON.stringify({jobId,projectId:id,type:"outline",outlineMode}));
  return NextResponse.json({jobId,count:count.rows[0].count,outlineMode},{status:202});
}

/**
 * 结构合并式保存:客户端只提交结构与可编辑字段(title/description + nodeKey),
 * 服务端按 nodeKey 找回原节点,继承其全部生成数据(content/brief/qualityAudit/
 * comparisonVariants/editor 状态等),仅覆盖可编辑字段。
 * 修复旧版按白名单重建整棵树导致任务卡/审计/对比稿被静默抹掉、正文被截断的问题。
 */
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const access=await getAccess(req);
  if(!access)return NextResponse.json({error:"未登录"},{status:401});
  if(!(await canAccessProject(access,id)))return NextResponse.json({error:"项目不存在"},{status:404});
  let body:unknown;
  try{body=await req.json()}catch{return NextResponse.json({error:"请求格式错误"},{status:400})}
  const {chapters,baseVersion}=body as {chapters?:unknown;baseVersion?:unknown};
  if(!Array.isArray(chapters)||!chapters.length)return NextResponse.json({error:"大纲至少需要一个有效章节"},{status:400});
  const current=await db.query("SELECT content,version FROM outlines WHERE project_id=$1",[id]);
  if(!current.rowCount)return NextResponse.json({error:"请先生成项目大纲"},{status:404});
  if(Number.isInteger(baseVersion)&&baseVersion!==current.rows[0].version){
    return NextResponse.json({error:"大纲已被其他任务更新，请刷新页面后重新编辑"},{status:409});
  }
  const storedContent=(current.rows[0].content||{}) as Record<string,unknown>;

  // 按服务时注入的 nodeKey(路径串)建立原节点索引
  const storedByKey=new Map<string,StoredNode>();
  const index=(nodes:StoredNode[],path:number[])=>{
    nodes.forEach((node,position)=>{
      const key=[...path,position];
      storedByKey.set(key.join("."),node);
      if(Array.isArray(node.children))index(node.children,key);
    });
  };
  index(Array.isArray(storedContent.chapters)?storedContent.chapters as StoredNode[]:[],[]);

  const mergeNode=(value:OutlineNode,depth:number):StoredNode|null=>{
    if(!value||typeof value!=="object"||depth>6)return null;
    const title=typeof value.title==="string"?value.title.trim().slice(0,200):"";
    if(!title)return null;
    const description=typeof value.description==="string"?value.description.trim().slice(0,1000):"";
    const children=Array.isArray(value.children)
      ?value.children.slice(0,50).map(child=>mergeNode(child as OutlineNode,depth+1)).filter(Boolean) as StoredNode[]
      :[];
    const key=typeof value.nodeKey==="string"?value.nodeKey:"";
    const base=key?storedByKey.get(key):undefined;
    if(base){
      // 原节点:继承全部服务端字段(requirementIds/brief/content/审计等 UI 不可编辑,以库中为准)
      return {...base,title,description,children};
    }
    // 新增节点:仅初始化可编辑字段
    const requirementIds=Array.isArray(value.requirementIds)?value.requirementIds.filter(item=>typeof item==="string").slice(0,50):[];
    return {title,description,requirementIds,children,contentStatus:"idle"};
  };

  const merged=chapters.slice(0,30).map(item=>mergeNode(item as OutlineNode,1)).filter(Boolean);
  if(!merged.length)return NextResponse.json({error:"大纲至少需要一个有效章节"},{status:400});
  const content={...storedContent,chapters:merged};
  const result=await db.query("UPDATE outlines SET content=$2::jsonb,version=version+1,updated_at=now() WHERE project_id=$1 RETURNING version,updated_at AS \"updatedAt\"",[id,JSON.stringify(content)]);
  return NextResponse.json({outline:result.rows[0]});
}
