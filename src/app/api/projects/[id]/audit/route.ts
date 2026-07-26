import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "crypto";
import {db} from "@/lib/db";
import {canAccessProject,getAccess} from "@/lib/auth";
import {getQueue} from "@/lib/queue";

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const access=await getAccess(req);
  if(!access)return NextResponse.json({error:"未登录"},{status:401});
  if(!(await canAccessProject(access,id)))return NextResponse.json({error:"项目不存在"},{status:404});
  const project=await db.query("SELECT id,status FROM projects WHERE id=$1",[id]);
  if(!project.rowCount)return NextResponse.json({error:"项目不存在"},{status:404});
  if(project.rows[0].status==="auditing")return NextResponse.json({error:"该项目正在进行AI复核"},{status:409});
  const count=await db.query("SELECT count(*)::int AS count FROM requirements WHERE project_id=$1 AND review_status<>'rejected'",[id]);
  if(!count.rows[0].count)return NextResponse.json({error:"没有可复核的条款"},{status:400});

  const jobId=randomUUID();
  const client=await db.connect();
  try{
    await client.query("BEGIN");
    await client.query("INSERT INTO jobs(id,project_id,type,status) VALUES($1,$2,'audit','queued')",[jobId,id]);
    await client.query("UPDATE requirements SET ai_review_status='unreviewed',ai_review_reason=NULL,ai_review_suggestion=NULL,ai_review_confidence=NULL,ai_reviewed_at=NULL WHERE project_id=$1 AND review_status<>'rejected'",[id]);
    await client.query("UPDATE projects SET status='auditing',progress=0,error_message=NULL,updated_at=now() WHERE id=$1",[id]);
    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
  const queue=await getQueue();
  await queue.lPush("ai_bid:jobs",JSON.stringify({jobId,projectId:id,type:"audit"}));
  return NextResponse.json({jobId,count:count.rows[0].count},{status:202});
}
