import {NextRequest,NextResponse} from "next/server";
import {db} from "@/lib/db";
import {canAccessProject,getAccess} from "@/lib/auth";

export const dynamic="force-dynamic";

export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const access=await getAccess(req);
  if(!access)return NextResponse.json({error:"未登录"},{status:401});
  if(!(await canAccessProject(access,id)))return NextResponse.json({error:"项目不存在"},{status:404});
  const marker=req.nextUrl.searchParams.get("marker");
  const values:unknown[]=[id];
  let markerClause="";
  if(marker!==null&&["","▲","★"].includes(marker)){
    values.push(marker);
    markerClause=` AND marker=$${values.length}`;
  }
  const rows=await db.query(
    `SELECT id,item_index AS "itemIndex",product_no AS "productNo",product_name AS "productName",
            parameter_no AS "parameterNo",marker,requirement_text AS requirement,source_page AS "sourcePage",
            proof_requirement AS "proofRequirement",response_value AS "responseValue",
            deviation_status AS "deviationStatus",evidence_reference AS "evidenceReference"
       FROM technical_parameter_items
      WHERE project_id=$1${markerClause}
      ORDER BY item_index`,
    values,
  );
  return NextResponse.json({items:rows.rows});
}

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const body=await req.json();
  const itemId=String(body.id||"");
  const status=String(body.deviationStatus||"pending");
  if(!itemId||!["pending","met","better","deviation"].includes(status)){
    return NextResponse.json({error:"参数响应数据不合法"},{status:400});
  }
  const access=await getAccess(req);
  if(!access)return NextResponse.json({error:"未登录"},{status:401});
  if(!(await canAccessProject(access,id)))return NextResponse.json({error:"项目不存在"},{status:404});
  const result=await db.query(
    `UPDATE technical_parameter_items
        SET response_value=$1,deviation_status=$2,evidence_reference=$3,updated_at=now()
      WHERE id=$4 AND project_id=$5 RETURNING id`,
    [String(body.responseValue||""),status,String(body.evidenceReference||""),itemId,id],
  );
  if(!result.rowCount)return NextResponse.json({error:"参数项不存在"},{status:404});
  return NextResponse.json({ok:true});
}
