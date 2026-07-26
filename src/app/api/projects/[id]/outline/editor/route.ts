import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "crypto";
import {canAccessProject,checkGenerationBudget,getAccess} from "@/lib/auth";
import {db} from "@/lib/db";
import {getQueue} from "@/lib/queue";

type OutlineNode={
  title?:string;
  children?:OutlineNode[];
  editorStatus?:string;
  editorProgress?:number;
  editorError?:string;
};

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const access=await getAccess(req);
  if(!access)return NextResponse.json({error:"未登录"},{status:401});
  if(!(await canAccessProject(access,id)))return NextResponse.json({error:"项目不存在"},{status:404});
  const budgetCheck=await checkGenerationBudget(access,id);
  if(!budgetCheck.ok)return NextResponse.json({error:`本项目生成额度已用完($${budgetCheck.used.toFixed(2)}/$${budgetCheck.budget.toFixed(2)}),请联系服务方追加`},{status:403});
  let chapterIndex=0;
  try{
    const body=await req.json();
    if(Number.isInteger(body?.chapterIndex))chapterIndex=body.chapterIndex;
  }catch{}
  if(chapterIndex<0||chapterIndex>19){
    return NextResponse.json({error:"章节序号无效"},{status:400});
  }

  const outlineResult=await db.query(
    "SELECT content FROM outlines WHERE project_id=$1 AND status='ready'",
    [id],
  );
  if(!outlineResult.rowCount){
    return NextResponse.json({error:"项目大纲尚未就绪"},{status:400});
  }
  const content=outlineResult.rows[0].content||{};
  const chapters=(content.chapters||[]) as OutlineNode[];
  const chapter=chapters[chapterIndex];
  if(!chapter){
    return NextResponse.json({error:"目标章节不存在"},{status:404});
  }

  const running=await db.query(
    "SELECT id FROM jobs WHERE project_id=$1 AND type='chapter_editor' AND status IN ('queued','running') LIMIT 1",
    [id],
  );
  if(running.rowCount){
    return NextResponse.json({error:"已有章节正在总编处理中"},{status:409});
  }

  chapter.editorStatus="queued";
  chapter.editorProgress=0;
  delete chapter.editorError;
  const jobId=randomUUID();
  const client=await db.connect();
  try{
    await client.query("BEGIN");
    await client.query(
      "UPDATE outlines SET content=$2::jsonb,version=version+1,updated_at=now() WHERE project_id=$1",
      [id,JSON.stringify(content)],
    );
    await client.query(
      "INSERT INTO jobs(id,project_id,type,status) VALUES($1,$2,'chapter_editor','queued')",
      [jobId,id],
    );
    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }

  const queue=await getQueue();
  await queue.lPush(
    "ai_bid:jobs",
    JSON.stringify({jobId,projectId:id,type:"chapter_editor",chapterIndex}),
  );
  return NextResponse.json(
    {jobId,chapterIndex,title:chapter.title,status:"queued"},
    {status:202},
  );
}
