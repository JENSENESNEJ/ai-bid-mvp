import {NextRequest,NextResponse} from "next/server";
import {db} from "@/lib/db";
export const dynamic="force-dynamic";
export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const project=await db.query(`SELECT id,name,file_name AS "fileName",file_size AS "fileSize",status,progress,findings_count AS findings,error_message AS "errorMessage",created_at AS "createdAt",updated_at AS "updatedAt" FROM projects WHERE id=$1`,[id]);
 if(!project.rowCount)return NextResponse.json({error:"项目不存在"},{status:404});
 const document=await db.query(`SELECT format,page_count AS "pageCount",character_count AS "characterCount",jsonb_array_length(blocks) AS "blockCount",coverage_audit AS "coverageAudit",parsed_at AS "parsedAt" FROM documents WHERE project_id=$1`,[id]);
 const outline=await db.query(`SELECT content,status,version,model,error_message AS "errorMessage",generated_at AS "generatedAt",updated_at AS "updatedAt" FROM outlines WHERE project_id=$1`,[id]);
 const requirements=await db.query(`SELECT id,type,title,normalized_value AS "normalizedValue",mandatory,evidence,review_status AS "reviewStatus",ai_review_status AS "aiReviewStatus",ai_review_reason AS "aiReviewReason",ai_review_suggestion AS "aiReviewSuggestion",ai_review_confidence::float8 AS "aiReviewConfidence",ai_reviewed_at AS "aiReviewedAt",created_at AS "createdAt",updated_at AS "updatedAt" FROM requirements WHERE project_id=$1 ORDER BY mandatory DESC,created_at`,[id]);
 const runs=await db.query(`SELECT id,chunk_number AS "chunkNumber",run_type AS "runType",model,status,input_tokens AS "inputTokens",output_tokens AS "outputTokens",cost_usd::float8 AS "costUsd",duration_ms AS "durationMs",retries,error_message AS "errorMessage",created_at AS "createdAt" FROM ai_runs WHERE project_id=$1 ORDER BY created_at`,[id]);
 const totals=await db.query(`SELECT COALESCE(sum(input_tokens),0)::int AS "inputTokens",COALESCE(sum(output_tokens),0)::int AS "outputTokens",COALESCE(sum(cost_usd),0)::float8 AS "costUsd",count(*)::int AS requests,count(*) FILTER(WHERE status='failed')::int AS "failedRequests" FROM ai_runs WHERE project_id=$1`,[id]);
 const parameterSummary=await db.query(`SELECT count(*)::int AS total,count(DISTINCT product_no)::int AS products,count(*) FILTER(WHERE marker='▲')::int AS important,count(*) FILTER(WHERE marker='★')::int AS mandatory,count(*) FILTER(WHERE marker='')::int AS general,count(*) FILTER(WHERE deviation_status='pending')::int AS pending FROM technical_parameter_items WHERE project_id=$1`,[id]);
 return NextResponse.json({project:project.rows[0],document:document.rows[0]||null,outline:outline.rows[0]||null,requirements:requirements.rows,aiRuns:runs.rows,aiTotals:totals.rows[0],parameterSummary:parameterSummary.rows[0]});
}
