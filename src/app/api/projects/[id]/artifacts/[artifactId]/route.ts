import {NextRequest,NextResponse} from "next/server";
import {readFile} from "fs/promises";
import path from "path";
import {canAccessProject,getAccess} from "@/lib/auth";
import {db} from "@/lib/db";

type OutlineNode={title?:string;children?:OutlineNode[]};
function findNode(chapters:OutlineNode[],targetPath:number[]){
  let nodes=chapters;let node:OutlineNode|undefined;
  for(const index of targetPath){node=nodes[index];if(!node)return null;nodes=Array.isArray(node.children)?node.children:[]}
  return node||null;
}

export async function GET(req:NextRequest,{params}:{params:Promise<{id:string;artifactId:string}>}){
  const {id,artifactId}=await params;
  const access=await getAccess(req);
  if(!access)return NextResponse.json({error:"未登录"},{status:401});
  if(!(await canAccessProject(access,id)))return NextResponse.json({error:"项目不存在"},{status:404});
  const result=await db.query(
    "SELECT png_path FROM document_artifacts WHERE id=$1 AND project_id=$2 AND status='ready'",
    [artifactId,id],
  );
  if(!result.rowCount||!result.rows[0].png_path)return NextResponse.json({error:"图示不存在"},{status:404});
  const dataDir=path.resolve(process.env.DATA_DIR||"/app/data");
  const target=path.resolve(dataDir,result.rows[0].png_path);
  if(!target.startsWith(dataDir+path.sep))return NextResponse.json({error:"图示路径无效"},{status:400});
  try{
    const body=await readFile(target);
    return new NextResponse(body,{headers:{"Content-Type":"image/png","Cache-Control":"private, max-age=60"}});
  }catch{
    return NextResponse.json({error:"图示文件不可用"},{status:404});
  }
}

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string;artifactId:string}>}){
  const {id,artifactId}=await params;
  const access=await getAccess(req);
  if(!access)return NextResponse.json({error:"未登录"},{status:401});
  if(!(await canAccessProject(access,id)))return NextResponse.json({error:"项目不存在"},{status:404});
  let body:{targetPath?:unknown};
  try{body=await req.json()}catch{return NextResponse.json({error:"请求格式错误"},{status:400})}
  if(body.targetPath===null){
    const result=await db.query(
      `UPDATE document_artifacts
          SET metadata=(coalesce(metadata,'{}'::jsonb)-'targetPath'-'targetTitle'-'placementMode'),
              updated_at=now()
        WHERE id=$1 AND project_id=$2 RETURNING id`,
      [artifactId,id],
    );
    if(!result.rowCount)return NextResponse.json({error:"图示不存在"},{status:404});
    return NextResponse.json({ok:true,placementMode:"auto"});
  }
  const targetPath=body.targetPath;
  if(!Array.isArray(targetPath)||!targetPath.length||targetPath.length>4||targetPath.some(value=>!Number.isInteger(value)||Number(value)<0||Number(value)>29))return NextResponse.json({error:"章节路径无效"},{status:400});
  const outline=await db.query("SELECT content FROM outlines WHERE project_id=$1 AND status='ready'",[id]);
  if(!outline.rowCount)return NextResponse.json({error:"项目大纲尚未就绪"},{status:400});
  const node=findNode(outline.rows[0].content?.chapters||[],targetPath as number[]);
  if(!node)return NextResponse.json({error:"目标章节不存在"},{status:404});
  if(Array.isArray(node.children)&&node.children.length)return NextResponse.json({error:"请选择具体的末级章节"},{status:400});
  const result=await db.query(
    `UPDATE document_artifacts
        SET metadata=coalesce(metadata,'{}'::jsonb)||$3::jsonb,updated_at=now()
      WHERE id=$1 AND project_id=$2 RETURNING id`,
    [artifactId,id,JSON.stringify({targetPath,targetTitle:node.title||"",placementMode:"manual"})],
  );
  if(!result.rowCount)return NextResponse.json({error:"图示不存在"},{status:404});
  return NextResponse.json({ok:true,placementMode:"manual",targetPath,targetTitle:node.title||""});
}
