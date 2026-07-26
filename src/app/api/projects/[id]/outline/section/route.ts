import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "crypto";
import {db} from "@/lib/db";
import {getQueue} from "@/lib/queue";

type Node={title?:string;children?:Node[];content?:string;contentStatus?:string;contentMode?:string;generationModel?:string;generationStrategy?:string;lengthMode?:string;generationPasses?:number;qualityAudit?:unknown;previousGeneration?:unknown};
function findNode(chapters:Node[],path:number[]){
  let nodes=chapters;let node:Node|undefined;
  for(const index of path){node=nodes[index];if(!node)return null;nodes=Array.isArray(node.children)?node.children:[]}
  return node||null;
}

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  let body:unknown;
  try{body=await req.json()}catch{return NextResponse.json({error:"请求格式错误"},{status:400})}
  const requestBody=body as {path?:unknown;modelMode?:unknown;lengthMode?:unknown};
  const path=requestBody.path;
  const modelMode=requestBody.modelMode==="deepseek"||requestBody.modelMode==="gpt"||requestBody.modelMode==="mixed"?requestBody.modelMode:"mixed";
  const lengthMode=requestBody.lengthMode==="standard"||requestBody.lengthMode==="detailed"||requestBody.lengthMode==="extended"||requestBody.lengthMode==="xique"?requestBody.lengthMode:"standard";
  if(!Array.isArray(path)||!path.length||path.length>5||path.some(value=>!Number.isInteger(value)||value<0||value>29))return NextResponse.json({error:"章节路径无效"},{status:400});
  const outline=await db.query("SELECT content FROM outlines WHERE project_id=$1 AND status='ready'",[id]);
  if(!outline.rowCount)return NextResponse.json({error:"项目大纲尚未就绪"},{status:400});
  const content=outline.rows[0].content||{};
  const node=findNode(content.chapters||[],path as number[]);
  if(!node)return NextResponse.json({error:"章节不存在"},{status:404});
  if(node.contentStatus==="generating"||node.contentStatus==="retrying")return NextResponse.json({error:"本章节正在生成或等待自动重试"},{status:409});
  if(node.content){
    node.previousGeneration={content:node.content,contentMode:node.contentMode,generationModel:node.generationModel,generationStrategy:node.generationStrategy,lengthMode:node.lengthMode,generationPasses:node.generationPasses,qualityAudit:node.qualityAudit,savedAt:new Date().toISOString()};
  }
  node.contentStatus="generating";
  content.generationSettings={...(content.generationSettings||{}),textModelMode:modelMode,lengthMode};
  const jobId=randomUUID();
  const client=await db.connect();
  try{
    await client.query("BEGIN");
    await client.query("UPDATE outlines SET content=$2::jsonb,updated_at=now() WHERE project_id=$1",[id,JSON.stringify(content)]);
    await client.query("INSERT INTO jobs(id,project_id,type,status) VALUES($1,$2,'section','queued')",[jobId,id]);
    await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
  const queue=await getQueue();
  await queue.lPush("ai_bid:jobs",JSON.stringify({jobId,projectId:id,type:"section",path,mode:"deep",modelMode,lengthMode}));
  return NextResponse.json({jobId,title:node.title,modelMode,lengthMode},{status:202});
}
