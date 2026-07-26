import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "crypto";
import {canAccessProject,getAccess} from "@/lib/auth";
import {db} from "@/lib/db";
import {getQueue} from "@/lib/queue";

type Node={title?:string;children?:Node[];comparisonVariants?:Record<string,{status?:string}>};
function findNode(chapters:Node[],path:number[]){
  let nodes=chapters;let node:Node|undefined;
  for(const index of path){node=nodes[index];if(!node)return null;nodes=Array.isArray(node.children)?node.children:[]}
  return node||null;
}

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  let body:{path?:unknown;model?:unknown};
  try{body=await req.json()}catch{return NextResponse.json({error:"请求格式错误"},{status:400})}
  const path=body.path;
  const model=body.model==="gpt-5.5"||body.model==="deepseek-v4-pro"?body.model:"";
  if(!model)return NextResponse.json({error:"对比模型无效"},{status:400});
  if(!Array.isArray(path)||!path.length||path.length>5||path.some(value=>!Number.isInteger(value)||Number(value)<0||Number(value)>29))return NextResponse.json({error:"章节路径无效"},{status:400});
  const access=await getAccess(req);
  if(!access)return NextResponse.json({error:"未登录"},{status:401});
  if(!(await canAccessProject(access,id)))return NextResponse.json({error:"项目不存在"},{status:404});
  const outline=await db.query("SELECT content FROM outlines WHERE project_id=$1 AND status='ready'",[id]);
  if(!outline.rowCount)return NextResponse.json({error:"项目大纲尚未就绪"},{status:400});
  const content=outline.rows[0].content||{};
  const node=findNode(content.chapters||[],path as number[]);
  if(!node)return NextResponse.json({error:"章节不存在"},{status:404});
  if(node.comparisonVariants?.[model]?.status==="generating")return NextResponse.json({error:"GPT 对比稿正在生成"},{status:409});
  node.comparisonVariants={...(node.comparisonVariants||{}),[model]:{status:"generating"}};
  const jobId=randomUUID();
  const client=await db.connect();
  try{
    await client.query("BEGIN");
    await client.query("UPDATE outlines SET content=$2::jsonb,updated_at=now() WHERE project_id=$1",[id,JSON.stringify(content)]);
    await client.query("INSERT INTO jobs(id,project_id,type,status) VALUES($1,$2,'section_compare','queued')",[jobId,id]);
    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
  const queue=await getQueue();
  await queue.lPush("ai_bid:jobs",JSON.stringify({jobId,projectId:id,type:"section_compare",path,model,mode:"deep"}));
  return NextResponse.json({jobId,title:node.title,model},{status:202});
}
