import {NextRequest,NextResponse} from "next/server";
import {db} from "@/lib/db";
const allowed=new Set(["pending","accepted","rejected"]);
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;let body:unknown;
 try{body=await req.json()}catch{return NextResponse.json({error:"请求格式错误"},{status:400})}
 const value=body as {reviewStatus?:string;title?:string;normalizedValue?:string;mandatory?:boolean};
 if(value.reviewStatus&&!allowed.has(value.reviewStatus))return NextResponse.json({error:"复核状态无效"},{status:400});
 const result=await db.query(`UPDATE requirements SET review_status=COALESCE($2,review_status),title=COALESCE($3,title),normalized_value=COALESCE($4,normalized_value),mandatory=COALESCE($5,mandatory),updated_at=now() WHERE id=$1 RETURNING id,type,title,normalized_value AS "normalizedValue",mandatory,evidence,review_status AS "reviewStatus",updated_at AS "updatedAt"`,[id,value.reviewStatus??null,value.title?.trim()||null,value.normalizedValue?.trim()||null,typeof value.mandatory==="boolean"?value.mandatory:null]);
 if(!result.rowCount)return NextResponse.json({error:"条款不存在"},{status:404});
 await db.query(`UPDATE projects p SET status=CASE WHEN EXISTS(SELECT 1 FROM requirements r WHERE r.project_id=p.id AND r.review_status='pending') THEN 'reviewing' ELSE 'confirmed' END,updated_at=now() WHERE p.id=(SELECT project_id FROM requirements WHERE id=$1)`,[id]);
 return NextResponse.json({requirement:result.rows[0]});
}