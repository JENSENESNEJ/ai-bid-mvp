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
  const result=await db.query(
    `SELECT id,kind,title,status,error_message AS "errorMessage",metadata,updated_at AS "updatedAt"
       FROM document_artifacts WHERE project_id=$1 ORDER BY created_at,kind`,
    [id],
  );
  return NextResponse.json({
    artifacts:result.rows.map(item=>({
      ...item,
      imageUrl:item.status==="ready"?`/api/projects/${id}/artifacts/${item.id}?v=${new Date(item.updatedAt).getTime()}`:null,
    })),
  });
}

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const access=await getAccess(req);
  if(!access)return NextResponse.json({error:"未登录"},{status:401});
  if(!(await canAccessProject(access,id)))return NextResponse.json({error:"项目不存在"},{status:404});
  let body:{visualMode?:unknown;confirmImageCost?:unknown;regenerateImages?:unknown}={};
  try{body=await req.json()}catch{}
  const visualMode=typeof body.visualMode==="string"?body.visualMode:"diagrams";
  if(!["diagrams","mixed","physical_priority"].includes(visualMode)){
    return NextResponse.json({error:"视觉模式无效"},{status:400});
  }
  if(visualMode!=="diagrams"&&body.confirmImageCost!==true){
    return NextResponse.json({error:"图文混合模式包含GPT写实示意图，请先确认图片费用"},{status:400});
  }
  const outline=await db.query(
    "SELECT 1 FROM outlines WHERE project_id=$1 AND status='ready'",
    [id],
  );
  if(!outline.rowCount)return NextResponse.json({error:"请先生成项目大纲"},{status:400});
  const running=await db.query(
    "SELECT 1 FROM jobs WHERE project_id=$1 AND type='artifact' AND status IN ('queued','running') LIMIT 1",
    [id],
  );
  if(running.rowCount)return NextResponse.json({error:"项目图示正在生成，请稍候"},{status:409});
  await db.query(
    `UPDATE outlines SET
       content=jsonb_set(
         content,
         '{generationSettings}',
         coalesce(content->'generationSettings','{}'::jsonb)
           || jsonb_build_object(
                'visualMode',$2::text,
                'visualImageCostConfirmed',($3::boolean)
              ),
         true
       ),
       updated_at=now()
     WHERE project_id=$1`,
    [id,visualMode,visualMode!=="diagrams"&&body.confirmImageCost===true],
  );
  const jobId=randomUUID();
  await db.query(
    "INSERT INTO jobs(id,project_id,type,status) VALUES($1,$2,'artifact','queued')",
    [jobId,id],
  );
  const queue=await getQueue();
  await queue.lPush("ai_bid:jobs",JSON.stringify({
    jobId,projectId:id,type:"artifact",
    regenerateImages:body.regenerateImages===true,
  }));
  return NextResponse.json({jobId},{status:202});
}
