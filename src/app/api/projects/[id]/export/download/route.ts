import {NextRequest,NextResponse} from "next/server";
import {readFile} from "fs/promises";
import path from "path";
import {canAccessProject,getAccess} from "@/lib/auth";
import {db} from "@/lib/db";

export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const access=await getAccess(req);
  if(!access)return NextResponse.json({error:"未登录"},{status:401});
  if(!(await canAccessProject(access,id)))return NextResponse.json({error:"项目不存在"},{status:404});
  const result=await db.query("SELECT file_name,stored_path FROM document_exports WHERE project_id=$1 AND status='ready'",[id]);
  if(!result.rowCount)return NextResponse.json({error:"Word文件尚未生成"},{status:404});
  const dataRoot="/app/data";
  const target=path.resolve(dataRoot,result.rows[0].stored_path);
  if(!target.startsWith(dataRoot+path.sep))return NextResponse.json({error:"文件路径无效"},{status:400});
  const bytes=await readFile(target);
  const encoded=encodeURIComponent(result.rows[0].file_name);
  return new NextResponse(bytes,{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":`attachment; filename*=UTF-8''${encoded}`,"Cache-Control":"no-store"}});
}
