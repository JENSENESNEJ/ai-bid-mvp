import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "crypto";
import {canAccessProject,checkGenerationBudget,getAccess} from "@/lib/auth";
import {db} from "@/lib/db";
import {getQueue} from "@/lib/queue";

const diagramTypes=new Set(["overall_architecture","implementation_route","quality_closed_loop"]);
const allowedTypes=new Set([
  "culture_wall","project_scene","solution_concept","operation_scene",
  "equipment_scene","installation_scene","software_scene","site_scene",
  "completed_scene","custom",...diagramTypes,
]);
const titles:Record<string,string>={
  culture_wall:"文化墙概念效果图",
  project_scene:"项目建成场景概念图",
  solution_concept:"项目方案概念视觉图",
  operation_scene:"项目现场作业写实示意图",
  equipment_scene:"项目设备物资写实示意图",
  installation_scene:"设备安装实施写实示意图",
  software_scene:"软件系统应用写实示意图",
  site_scene:"工程现场实施写实示意图",
  completed_scene:"项目完成效果写实示意图",
  custom:"自定义项目效果图",
  overall_architecture:"项目总体交付架构图",
  implementation_route:"项目实施路线图",
  quality_closed_loop:"全过程质量控制闭环图",
};

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const access=await getAccess(req);
  if(!access)return NextResponse.json({error:"未登录"},{status:401});
  if(!(await canAccessProject(access,id)))return NextResponse.json({error:"项目不存在"},{status:404});
  const budgetCheck=await checkGenerationBudget(access,id);
  if(!budgetCheck.ok)return NextResponse.json({error:`本项目生成额度已用完($${budgetCheck.used.toFixed(2)}/$${budgetCheck.budget.toFixed(2)}),请联系服务方追加`},{status:403});
  let body:{imageType?:unknown;userPrompt?:unknown;confirmCost?:unknown};
  try{body=await req.json()}catch{return NextResponse.json({error:"请求格式错误"},{status:400})}
  const imageType=typeof body.imageType==="string"?body.imageType:"";
  const userPrompt=typeof body.userPrompt==="string"?body.userPrompt.trim():"";
  if(!allowedTypes.has(imageType))return NextResponse.json({error:"图片类型无效"},{status:400});
  if(userPrompt.length>800)return NextResponse.json({error:"补充要求不能超过800字"},{status:400});
  if(body.confirmCost!==true)return NextResponse.json({error:"请先确认本次图片生成费用"},{status:400});
  const outline=await db.query(
    "SELECT 1 FROM outlines WHERE project_id=$1 AND status='ready'",
    [id],
  );
  if(!outline.rowCount)return NextResponse.json({error:"请先生成项目大纲"},{status:400});
  const running=await db.query(
    "SELECT 1 FROM jobs WHERE project_id=$1 AND type='image_artifact' AND status IN ('queued','running') LIMIT 1",
    [id],
  );
  if(running.rowCount)return NextResponse.json({error:"已有一张效果图正在生成，请稍候"},{status:409});

  const artifactId=randomUUID();
  const jobId=randomUUID();
  const kind=diagramTypes.has(imageType)?imageType:`gpt_${imageType}`;
  const client=await db.connect();
  let storedArtifactId=artifactId;
  try{
    await client.query("BEGIN");
    const artifact=await client.query(
      `INSERT INTO document_artifacts(id,project_id,kind,title,status,metadata,error_message)
       VALUES($1,$2,$3,$4,'generating',$5::jsonb,NULL)
       ON CONFLICT(project_id,kind) DO UPDATE SET
         title=excluded.title,status='generating',
         metadata=coalesce(document_artifacts.metadata,'{}'::jsonb)||excluded.metadata,
         error_message=NULL,updated_at=now()
       RETURNING id`,
      [artifactId,id,kind,titles[imageType],JSON.stringify({
        source:"sub2api",
        generator:"gpt-image-v1",
        requestedModel:"gpt-image-2",
        estimatedCostUsd:0.201,
      })],
    );
    storedArtifactId=artifact.rows[0].id;
    await client.query(
      "INSERT INTO jobs(id,project_id,type,status) VALUES($1,$2,'image_artifact','queued')",
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
  await queue.lPush("ai_bid:jobs",JSON.stringify({
    jobId,projectId:id,type:"image_artifact",artifactId:storedArtifactId,
    imageType,userPrompt,
  }));
  return NextResponse.json({jobId,artifactId:storedArtifactId,estimatedCostUsd:0.201},{status:202});
}
