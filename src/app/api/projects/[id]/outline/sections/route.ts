import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "crypto";
import {canAccessProject,checkGenerationBudget,getAccess} from "@/lib/auth";
import {db} from "@/lib/db";
import {getQueue} from "@/lib/queue";

type Node={
  title:string;
  description?:string;
  requirementIds?:string[];
  children?:Node[];
  content?:string;
  contentStatus?:string;
  contentMode?:string;
  generationModel?:string;
  generationStrategy?:string;
  lengthMode?:string;
  generationPasses?:number;
  qualityAudit?:unknown;
  previousGeneration?:unknown;
};

function collectIds(node:Node):string[]{
  return [...(node.requirementIds||[]),...(node.children||[]).flatMap(collectIds)];
}

function quickDraft(node:Node,requirements:Map<string,{title:string;value:string}>){
  const items=[...new Set(collectIds(node))].map(id=>requirements.get(id)).filter(Boolean) as {title:string;value:string}[];
  const lines=[`## ${node.title}`,"",node.description||"本节根据招标文件要求编制。",""];
  if(items.length){
    lines.push("### 招标要求响应","");
    items.forEach((item,index)=>{
      lines.push(`${index+1}. ${item.title}`);
      lines.push(`招标要求：${item.value}`);
      lines.push("响应初稿：我方将严格按照招标文件要求执行，具体证明材料、实施细节及投标方数据请在定稿前补充核实。","");
    });
  }else{
    lines.push("### 编写要点","","请结合投标方实际资料补充本章方案、证明材料和项目数据。");
  }
  lines.push("### 定稿提示","","涉及资质、人员、业绩、报价、品牌及具体参数的内容必须由投标人核实后定稿。");
  return lines.join("\n");
}

function leaves(nodes:Node[],prefix:number[]=[]):{node:Node;path:number[]}[]{
  const output:{node:Node;path:number[]}[]=[];
  nodes.forEach((node,index)=>{
    const path=[...prefix,index];
    if((node.children||[]).length)output.push(...leaves(node.children||[],path));
    else output.push({node,path});
  });
  return output;
}

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const access=await getAccess(req);
  if(!access)return NextResponse.json({error:"未登录"},{status:401});
  if(!(await canAccessProject(access,id)))return NextResponse.json({error:"项目不存在"},{status:404});
  const budgetCheck=await checkGenerationBudget(access,id);
  if(!budgetCheck.ok)return NextResponse.json({error:budgetCheck.message},{status:403});
  let mode:"quick"|"deep"="quick";
  let modelMode:"deepseek"|"gpt"|"mixed"="mixed";
  let lengthMode:"standard"|"detailed"|"extended"|"xique"="standard";
  let regenerate=false;
  let chapterIndex:number|null=null;
  try{
    const body=await req.json();
    if(body?.mode==="deep")mode="deep";
    if(body?.modelMode==="deepseek"||body?.modelMode==="gpt"||body?.modelMode==="mixed")modelMode=body.modelMode;
    if(body?.lengthMode==="standard"||body?.lengthMode==="detailed"||body?.lengthMode==="extended"||body?.lengthMode==="xique")lengthMode=body.lengthMode;
    regenerate=body?.regenerate===true;
    if(Number.isInteger(body?.chapterIndex)&&body.chapterIndex>=0)chapterIndex=body.chapterIndex;
  }catch{}

  const outline=await db.query("SELECT content FROM outlines WHERE project_id=$1 AND status='ready'",[id]);
  if(!outline.rowCount)return NextResponse.json({error:"项目大纲尚未就绪"},{status:400});
  const content=outline.rows[0].content||{};
  const allTargets=leaves(content.chapters||[]);
  const targets=chapterIndex===null?allTargets:allTargets.filter(({path})=>path[0]===chapterIndex);
  if(chapterIndex!==null&&!targets.length)return NextResponse.json({error:"所选一级章节不存在或没有可生成的末级章节"},{status:404});

  if(mode==="quick"){
    const rows=await db.query("SELECT id,title,normalized_value FROM requirements WHERE project_id=$1 AND review_status<>'rejected'",[id]);
    const requirements=new Map(rows.rows.map(row=>[String(row.id),{title:row.title,value:row.normalized_value}]));
    let completed=0;
    for(const {node} of targets){
      if(!node.content){
        node.content=quickDraft(node,requirements);
        node.contentStatus="ready";
        node.contentMode="safe_fallback";
        completed++;
      }
    }
    await db.query("UPDATE outlines SET content=$2::jsonb,version=version+1,updated_at=now() WHERE project_id=$1",[id,JSON.stringify(content)]);
    return NextResponse.json({status:"ready",mode,chapterIndex,completed,message:`已快速补齐 ${completed} 个章节响应骨架`});
  }

  const pending=targets.filter(({node})=>!["generating","retrying"].includes(node.contentStatus||"")&&(regenerate||!(node.contentMode==="ai_deep"&&node.contentStatus==="ready")));
  if(!pending.length)return NextResponse.json({status:"ready",mode,queued:0,message:"所有叶子章节均已完成 AI 深度生成"});
  const jobs=pending.map(({node,path})=>{
    const jobId=randomUUID();
    if(node.content){
      node.previousGeneration={
        content:node.content,
        contentMode:node.contentMode,
        generationModel:node.generationModel,
        generationStrategy:node.generationStrategy,
        lengthMode:node.lengthMode,
        generationPasses:node.generationPasses,
        qualityAudit:node.qualityAudit,
        savedAt:new Date().toISOString(),
      };
    }
    node.contentStatus="generating";
    return {jobId,projectId:id,type:"section",path,mode:"deep",modelMode,lengthMode};
  });
  content.generationSettings={...(content.generationSettings||{}),textModelMode:modelMode,lengthMode};
  const client=await db.connect();
  try{
    await client.query("BEGIN");
    await client.query("UPDATE outlines SET content=$2::jsonb,version=version+1,updated_at=now() WHERE project_id=$1",[id,JSON.stringify(content)]);
    for(const job of jobs)await client.query("INSERT INTO jobs(id,project_id,type,status) VALUES($1,$2,'section','queued')",[job.jobId,id]);
    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
  const queue=await getQueue();
  for(const job of jobs)await queue.lPush("ai_bid:jobs",JSON.stringify(job));
  const modeLabel={deepseek:"DeepSeek 全文",gpt:"GPT 全文",mixed:"智能混合"}[modelMode];
  return NextResponse.json({status:"queued",mode,modelMode,chapterIndex,queued:jobs.length,message:`已将 ${jobs.length} 个章节加入${modeLabel}生成队列`},{status:202});
}
