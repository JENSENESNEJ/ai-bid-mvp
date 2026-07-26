import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "crypto";
import {db} from "@/lib/db";
import {getQueue} from "@/lib/queue";

type OutlineNode={title?:unknown;description?:unknown;requirementIds?:unknown;sourceBlockIds?:unknown;contentForm?:unknown;semanticRole?:unknown;projectSpecific?:unknown;children?:unknown;content?:unknown;contentStatus?:unknown;contentMode?:unknown};
function cleanNode(value:OutlineNode,depth=1):Record<string,unknown>|null{
  if(!value||typeof value!=="object"||depth>5)return null;
  const title=typeof value.title==="string"?value.title.trim().slice(0,200):"";
  if(!title)return null;
  const children=Array.isArray(value.children)?value.children.slice(0,30).map(item=>cleanNode(item as OutlineNode,depth+1)).filter(Boolean):[];
  const ids=Array.isArray(value.requirementIds)?value.requirementIds.filter(id=>typeof id==="string").slice(0,50):[];
  const sourceBlockIds=Array.isArray(value.sourceBlockIds)?value.sourceBlockIds.filter(id=>typeof id==="string").slice(0,30):[];
  return {
    title,
    description:typeof value.description==="string"?value.description.trim().slice(0,1000):"",
    requirementIds:ids,
    sourceBlockIds,
    contentForm:typeof value.contentForm==="string"?value.contentForm.trim().slice(0,80):"",
    semanticRole:typeof value.semanticRole==="string"?value.semanticRole.trim().slice(0,80):"",
    projectSpecific:Boolean(value.projectSpecific),
    children,
    content:typeof value.content==="string"?value.content.slice(0,50000):"",
    contentStatus:["idle","generating","ready","failed"].includes(String(value.contentStatus))?value.contentStatus:"idle",
    contentMode:typeof value.contentMode==="string"?value.contentMode.slice(0,30):undefined,
  };
}

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
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

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  let body:unknown;
  try{body=await req.json()}catch{return NextResponse.json({error:"请求格式错误"},{status:400})}
  const chapters=Array.isArray((body as {chapters?:unknown})?.chapters)?(body as {chapters:OutlineNode[]}).chapters:[];
  const cleaned=chapters.slice(0,30).map(item=>cleanNode(item)).filter(Boolean);
  if(!cleaned.length)return NextResponse.json({error:"大纲至少需要一个有效章节"},{status:400});
  const current=await db.query("SELECT content FROM outlines WHERE project_id=$1",[id]);
  if(!current.rowCount)return NextResponse.json({error:"请先生成项目大纲"},{status:404});
  const content={...(current.rows[0].content||{}),chapters:cleaned};
  const result=await db.query("UPDATE outlines SET content=$2::jsonb,version=version+1,updated_at=now() WHERE project_id=$1 RETURNING version,updated_at AS \"updatedAt\"",[id,JSON.stringify(content)]);
  return NextResponse.json({outline:result.rows[0]});
}
