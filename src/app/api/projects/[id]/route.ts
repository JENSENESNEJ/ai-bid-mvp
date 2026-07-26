import {NextRequest,NextResponse} from "next/server";
import {gzipSync} from "zlib";
import {db} from "@/lib/db";
export const dynamic="force-dynamic";

/** App Router 路由响应不走 Next 内置压缩,大 JSON 手动 gzip(中国-欧洲链路上体积就是延迟) */
function jsonResponse(req:NextRequest,payload:unknown,status=200){
  const body=JSON.stringify(payload);
  if(body.length>1024&&(req.headers.get("accept-encoding")||"").includes("gzip")){
    return new NextResponse(gzipSync(Buffer.from(body)),{status,headers:{"Content-Type":"application/json","Content-Encoding":"gzip","Vary":"Accept-Encoding"}});
  }
  return new NextResponse(body,{status,headers:{"Content-Type":"application/json"}});
}

type AnyNode=Record<string,unknown>;

// worker 内部数据/历史快照,前端不消费,summary 模式全部剥离
const NODE_STRIP_FIELDS=new Set([
  "content","previousGeneration","previousEditorial","compressedEditorial",
  "previousNaturalEditorial","compressedEditorialRollback","editorialTitleBackup",
  "editorialErrorDetails","generationFactAnchors",
]);

/**
 * summary 模式:递归剥离大纲节点中的重字段,注入 nodeKey。
 * - content → hasContent + contentChars(正文经 GET /outline/section 按需获取)
 * - 编辑器快照/事实锚点等 worker 内部数据删除
 * - brief 只留前端用到的 formFactor/pageBudget;qualityAudit 去掉 metrics
 * - comparisonVariants 保留状态与指标,剥离 content
 */
function summarizeNode(node:AnyNode,path:number[]):AnyNode{
  const content=node.content;
  const summarized:AnyNode={
    nodeKey:path.join("."),
    hasContent:typeof content==="string"&&content.length>0,
    contentChars:typeof content==="string"?content.length:0,
  };
  for(const [key,value] of Object.entries(node)){
    if(NODE_STRIP_FIELDS.has(key)||key==="children"||key==="comparisonVariants")continue;
    if(key==="brief"&&value&&typeof value==="object"){
      const brief=value as AnyNode;
      summarized.brief={formFactor:brief.formFactor,pageBudget:brief.pageBudget};
      continue;
    }
    if(key==="qualityAudit"&&value&&typeof value==="object"){
      const {metrics:_omit,...audit}=value as {metrics?:unknown}&AnyNode;
      summarized.qualityAudit=audit;
      continue;
    }
    summarized[key]=value;
  }
  const children=node.children;
  summarized.children=Array.isArray(children)?(children as AnyNode[]).map((child,index)=>summarizeNode(child,[...path,index])):[];
  const comparisonVariants=node.comparisonVariants;
  if(comparisonVariants&&typeof comparisonVariants==="object"){
    const slim:Record<string,AnyNode>={};
    for(const [key,variant] of Object.entries(comparisonVariants as Record<string,AnyNode>)){
      if(!variant||typeof variant!=="object")continue;
      const {content:variantContent,...variantRest}=variant as {content?:unknown}&AnyNode;
      slim[key]={
        ...variantRest,
        hasContent:typeof variantContent==="string"&&variantContent.length>0,
        contentChars:typeof variantContent==="string"?variantContent.length:0,
      };
    }
    summarized.comparisonVariants=slim;
  }
  return summarized;
}

function summarizeOutlineContent(content:AnyNode|null){
  if(!content||typeof content!=="object")return content;
  const chapters=Array.isArray(content.chapters)?(content.chapters as AnyNode[]).map((chapter,index)=>summarizeNode(chapter,[index])):[];
  // worker 断点/标准目录备份属于内部数据,前端不需要
  const {_outlinePlanningCheckpoint:_omitCheckpoint,standardChapters:_omitStandard,...rest}=content as {_outlinePlanningCheckpoint?:unknown;standardChapters?:unknown}&AnyNode;
  return {...rest,chapters};
}

export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const view=req.nextUrl.searchParams.get("view")||"summary";
 const project=await db.query(`SELECT id,name,file_name AS "fileName",file_size AS "fileSize",status,progress,findings_count AS findings,error_message AS "errorMessage",created_at AS "createdAt",updated_at AS "updatedAt" FROM projects WHERE id=$1`,[id]);
 if(!project.rowCount)return NextResponse.json({error:"项目不存在"},{status:404});
 // 其余查询相互独立,并行执行
 const [document,outline,requirements,totals,parameterSummary]=await Promise.all([
  db.query(`SELECT format,page_count AS "pageCount",character_count AS "characterCount",jsonb_array_length(blocks) AS "blockCount",coverage_audit AS "coverageAudit",parsed_at AS "parsedAt" FROM documents WHERE project_id=$1`,[id]),
  db.query(`SELECT content,status,version,model,error_message AS "errorMessage",generated_at AS "generatedAt",updated_at AS "updatedAt" FROM outlines WHERE project_id=$1`,[id]),
  db.query(`SELECT id,type,title,normalized_value AS "normalizedValue",mandatory,evidence,review_status AS "reviewStatus",ai_review_status AS "aiReviewStatus",ai_review_reason AS "aiReviewReason",ai_review_suggestion AS "aiReviewSuggestion",ai_review_confidence::float8 AS "aiReviewConfidence",ai_reviewed_at AS "aiReviewedAt",created_at AS "createdAt",updated_at AS "updatedAt" FROM requirements WHERE project_id=$1 ORDER BY mandatory DESC,created_at`,[id]),
  db.query(`SELECT COALESCE(sum(input_tokens),0)::int AS "inputTokens",COALESCE(sum(output_tokens),0)::int AS "outputTokens",COALESCE(sum(cost_usd),0)::float8 AS "costUsd",count(*)::int AS requests,count(*) FILTER(WHERE status='failed')::int AS "failedRequests" FROM ai_runs WHERE project_id=$1`,[id]),
  db.query(`SELECT count(*)::int AS total,count(DISTINCT product_no)::int AS products,count(*) FILTER(WHERE marker='▲')::int AS important,count(*) FILTER(WHERE marker='★')::int AS mandatory,count(*) FILTER(WHERE marker='')::int AS general,count(*) FILTER(WHERE deviation_status='pending')::int AS pending FROM technical_parameter_items WHERE project_id=$1`,[id]),
 ]);
 const outlineRow=outline.rows[0]||null;
 const outlinePayload=outlineRow?{...outlineRow,content:view==="full"?outlineRow.content:summarizeOutlineContent(outlineRow.content)}:null;
 return jsonResponse(req,{project:project.rows[0],document:document.rows[0]||null,outline:outlinePayload,requirements:requirements.rows,aiTotals:totals.rows[0],parameterSummary:parameterSummary.rows[0]});
}
