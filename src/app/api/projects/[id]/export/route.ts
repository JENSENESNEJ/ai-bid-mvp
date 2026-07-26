import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "crypto";
import {canAccessProject,getAccess} from "@/lib/auth";
import {db} from "@/lib/db";
import {getQueue} from "@/lib/queue";

export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const access=await getAccess(req);
  if(!access)return NextResponse.json({error:"未登录"},{status:401});
  if(!(await canAccessProject(access,id)))return NextResponse.json({error:"项目不存在"},{status:404});
  const result=await db.query("SELECT status,file_name AS \"fileName\",error_message AS \"errorMessage\",updated_at AS \"updatedAt\" FROM document_exports WHERE project_id=$1",[id]);
  return NextResponse.json({export:result.rows[0]||null});
}

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const access=await getAccess(req);
  if(!access)return NextResponse.json({error:"未登录"},{status:401});
  if(!(await canAccessProject(access,id)))return NextResponse.json({error:"项目不存在"},{status:404});
  const project=await db.query("SELECT id FROM projects WHERE id=$1",[id]);
  if(!project.rowCount)return NextResponse.json({error:"项目不存在"},{status:404});
  const outline=await db.query("SELECT 1 FROM outlines WHERE project_id=$1 AND status='ready'",[id]);
  if(!outline.rowCount)return NextResponse.json({error:"请先生成项目大纲"},{status:400});
  const running=await db.query("SELECT 1 FROM jobs WHERE project_id=$1 AND type='export' AND status IN ('queued','running') LIMIT 1",[id]);
  if(running.rowCount)return NextResponse.json({error:"Word正在生成，请稍候"},{status:409});
  const jobId=randomUUID();const client=await db.connect();
  try{await client.query("BEGIN");await client.query("INSERT INTO jobs(id,project_id,type,status) VALUES($1,$2,'export','queued')",[jobId,id]);await client.query("INSERT INTO document_exports(project_id,status,error_message,updated_at) VALUES($1,'queued',NULL,now()) ON CONFLICT(project_id) DO UPDATE SET status='queued',error_message=NULL,updated_at=now()",[id]);await client.query("COMMIT")}catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
  const queue=await getQueue();await queue.lPush("ai_bid:jobs",JSON.stringify({jobId,projectId:id,type:"export"}));
  return NextResponse.json({jobId},{status:202});
}
