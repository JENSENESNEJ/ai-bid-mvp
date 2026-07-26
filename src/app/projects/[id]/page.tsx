"use client";
import "../../audit.css";
import "../../preview.css";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useCallback,useEffect,useMemo,useState,type JSX} from "react";

type Evidence={blockId:string;quote:string;chunk:number};
type Requirement={id:string;type:string;title:string;normalizedValue:string;mandatory:boolean;evidence:Evidence[];reviewStatus:string;aiReviewStatus:"unreviewed"|"auto_pass"|"needs_review"|"rejected";aiReviewReason?:string;aiReviewSuggestion?:string};
type PageBudget={minPages?:number;targetPages?:number;maxPages?:number;targetCharacters?:number;priority?:string};
type SectionBrief={purpose?:string;formFactor?:string;mustCover?:string[];suggestedTables?:string[];requiredOutputs?:string[];pageBudget?:PageBudget};
type QualityIssue={code:string;label:string;detail:string};
type QualityAudit={score:number;grade:string;sectionType?:string;dimensions?:{projectGrounding?:number;actionability?:number;verifiability?:number;specificity?:number;discipline?:number};issues?:QualityIssue[];metrics?:{characters?:number;actionCount?:number;verificationCount?:number;matchedAnchors?:string[];genericPhraseCount?:number;repeatedPairs?:number}};
type ComparisonVariant={status:string;model?:string;content?:string;contentMode?:string;inputTokens?:number;outputTokens?:number;costUsd?:number;durationMs?:number;generatedAt?:string;errorMessage?:string;qualityAudit?:QualityAudit};
type OutlineNode={title:string;description:string;requirementIds:string[];sourceBlockIds?:string[];contentForm?:string;semanticRole?:string;projectSpecific?:boolean;children:OutlineNode[];brief?:SectionBrief;content?:string;contentStatus?:string;contentMode?:string;generationModel?:string;generationStrategy?:string;lengthMode?:LengthMode;generationPasses?:number;generationCheckpoint?:{componentCount?:number;components?:{index:number;title:string;status:string;characters?:number}[]};componentMergeAudit?:{componentCount?:number;removedNearDuplicateBlocks?:number};previousGeneration?:unknown;comparisonVariants?:Record<string,ComparisonVariant>;qualityAudit?:QualityAudit;editorStatus?:string;editorProgress?:number;editorError?:string;editorialModel?:string};
type ProjectProfile={projectType?:string;objectives?:string[];scope?:string[];deliverables?:string[];constraints?:string[];stakeholders?:string[]};
type BlueprintPhase={name:string;objective?:string;tasks?:string[];outputs?:string[];qualityGate?:string;risks?:string[]};
type ProjectAnalysis={deliveryArchetype?:string;deliveryArchetypeLabel?:string;archetypeComponents?:string[];procurementObjects?:string[];workstreams?:{name:string;objective?:string;outputs?:string[]}[];acceptanceObjects?:string[];keyConstraints?:string[];domainSignals?:string[];enterpriseInputsNeeded?:string[];knowledgeGaps?:string[]};
type ScoringTask={requirementId:string;title:string;responseObjective?:string;mustCover?:string[];suggestedArtifacts?:string[];enterpriseInputsNeeded?:string[];riskIfMissing?:string;targetSections?:string[];routeType?:string;routeLabel?:string;responseMode?:string;generatesNarrative?:boolean;capabilityModuleIds?:string[]};
type CapabilityModule={id:string;name:string;methodPattern?:string;suggestedArtifacts?:string[];reason?:string};
type RequirementRouting={totalRequirements?:number;primaryAssignments?:number;secondaryAssignments?:number;virtualAssignments?:number;narrativePlacements?:number;totalPlacements?:number;averagePlacements?:number;laneCounts?:Record<string,number>};
type DocumentBudget={sectionCount?:number;minPages?:number;targetPages?:number;maxPages?:number;targetCharacters?:number;highPrioritySections?:number};
type CoverageCategory={candidateItems:number;coveredItems:number;possibleMissing:number;coverageRate:number};
type CoverageAudit={parserVersion?:string;candidateItems:number;coveredItems:number;possibleMissing:number;coverageRate:number;categories?:Record<string,CoverageCategory>;missingSamples?:{category:string;page?:number;kind:string;possibleMissing:number;sample:string}[]};
type ParameterSummary={total:number;products:number;important:number;mandatory:number;general:number;pending:number};
type TechnicalParameter={id:string;itemIndex:number;productNo:number;productName:string;parameterNo?:string;marker:string;requirement:string;sourcePage?:number;proofRequirement?:string;responseValue?:string;deviationStatus:string;evidenceReference?:string};
type DocumentArtifact={id:string;kind:string;title:string;status:string;imageUrl?:string;errorMessage?:string;metadata?:{source?:string;generator?:string;requestedModel?:string;returnedModel?:string;estimatedCostUsd?:number;actualCostUsd?:number;targetPath?:number[];targetTitle?:string;placementMode?:string}};
type PlacementOption={path:number[];label:string;title:string;context:string;node:OutlineNode};
type OutlineContent={chapters:OutlineNode[];projectProfile?:ProjectProfile;implementationBlueprint?:{templateName?:string;phases?:BlueprintPhase[]};projectAnalysis?:ProjectAnalysis;scoringTasks?:ScoringTask[];capabilityPlan?:CapabilityModule[];requirementRouting?:RequirementRouting;documentBudget?:DocumentBudget;outlineSpecificityAudit?:{titleCount?:number;uniqueTitleCount?:number;titleUniquenessRate?:number;leafCount?:number;sourceBoundLeaves?:number;sourceBindingRate?:number;genericTitleCount?:number;genericTitleRate?:number;depthCounts?:Record<string,number>};generationSettings?:{textModelMode?:TextModelMode;lengthMode?:LengthMode;outlineMode?:"standard"|"xique"|"dynamic";visualMode?:VisualMode;visualImageCostConfirmed?:boolean}};
type Detail={project:{id:string;name:string;fileName:string;status:string;progress:number;errorMessage?:string};document?:{coverageAudit?:CoverageAudit};outline?:{content:OutlineContent;status:string;version:number;updatedAt?:string};requirements:Requirement[];aiTotals:{inputTokens:number;outputTokens:number;costUsd:number;requests:number;failedRequests:number};parameterSummary?:ParameterSummary};
type ExportInfo={status:string;fileName?:string;errorMessage?:string}|null;
type TextModelMode="deepseek"|"gpt"|"mixed";
type LengthMode="standard"|"detailed"|"extended"|"xique";
type VisualMode="diagrams"|"mixed"|"physical_priority";
const typeLabels:Record<string,string>={qualification:"资格",disqualification:"废标",scoring:"评分",deadline:"时间",deposit:"保证金",deliverable:"交付",technical:"技术",commercial:"商务",other:"其他"};
const routeLabels:Record<string,string>={technical_solution:"技术方案正文",technical_parameter:"技术参数响应表",commercial_response:"商务响应",qualification_evidence:"资格与证明材料",pricing_policy:"价格政策与声明",compliance_response:"实质性响应",evaluation_rule:"评审规则提醒"};
const formFactorLabels:Record<string,string>={qualification_evidence:"资格证明清单",commercial_response:"商务响应矩阵",compliance_matrix:"实质性核对表",technical_response_matrix:"技术参数矩阵",diagnostic_narrative:"重点难点分析",operational_plan:"作业实施方案",technical_process:"技术实施流程",schedule:"进度计划",organization:"组织与职责",quality_control:"质量控制",acceptance:"验收移交",training_plan:"培训计划",service_process:"服务流程",risk_control:"风险与应急",professional_narrative:"专业方案正文"};
const coverageLabels:Record<string,string>={scoring:"评分项",technical:"技术参数",qualification:"资格材料",disqualification:"废标／实质性条款",commercial:"商务与合同"};
const modelModeLabels:Record<TextModelMode,string>={deepseek:"DeepSeek 全文",gpt:"GPT 全文",mixed:"智能混合"};
const modelModeDescriptions:Record<TextModelMode,string>={deepseek:"全部章节使用 DeepSeek，成本更低",gpt:"全部章节使用 GPT-5.5，便于完整质量测试",mixed:"方案型章节用 GPT，商务、参数和证明材料用 DeepSeek"};
const lengthModeLabels:Record<LengthMode,string>={standard:"标准稿",detailed:"深度稿",extended:"超长稿",xique:"喜鹊长篇"};
const lengthModeDescriptions:Record<LengthMode,string>={standard:"每章单轮生成，预计8–12万字",detailed:"方案章节三轮生成，预计15–22万字",extended:"方案章节五轮生成，预计25–35万字",xique:"五级目录逐节点生成，目标30–50万字"};
const lengthModeMultipliers:Record<LengthMode,number>={standard:1,detailed:2.15,extended:3.15,xique:1};
const emptyNode=():OutlineNode=>({title:"新章节",description:"请填写本章写作目标",requirementIds:[],children:[],contentStatus:"idle"});
const clone=(value:OutlineNode[])=>JSON.parse(JSON.stringify(value)) as OutlineNode[];

function placementOptions(nodes:OutlineNode[],prefix:number[]=[],titles:string[]=[]):PlacementOption[]{
  const result:PlacementOption[]=[];
  nodes.forEach((node,index)=>{
    const path=[...prefix,index];const pathTitles=[...titles,node.title];
    if(node.children?.length)result.push(...placementOptions(node.children,path,pathTitles));
    else result.push({path,label:`${path.map(value=>value+1).join(".")} ${node.title}`,title:node.title,context:pathTitles.join(" "),node});
  });
  return result;
}

function autoPlacement(item:DocumentArtifact,options:PlacementOption[]){
  if(item.metadata?.placementMode==="planned"&&item.metadata.targetPath?.length){
    const planned=options.find(option=>samePath(option.path,item.metadata?.targetPath));
    if(planned)return planned;
  }
  const rules:Record<string,[string,number][]>={
    overall_architecture:[["总体建设目标",180],["总体方案",150],["总体理解",120],["项目概述",90]],
    implementation_route:[["整体实施进度计划",200],["实施进度",170],["进度计划",150],["组织与实施",100]],
    quality_closed_loop:[["质量控制与风险管理",200],["质量控制",170],["质量管理",150],["验收保障",120]],
    service_scope_map:[["服务范围与需求理解",220],["服务范围",190],["需求理解",170]],
    service_operation_cycle:[["工作方法与协同机制",220],["实施路径与工作流程",200],["服务实施",170]],
    organization_responsibility:[["项目组织架构",240],["岗位职责与人员安排",190],["组织架构",180]],
    inspection_rectification:[["过程检查与成果审核",240],["质量控制",180],["整改",140]],
    emergency_response:[["风险识别与应急预案",250],["应急预案",210],["风险识别",180]],
    gpt_culture_wall:[["设计效果图",180],["文化墙",140]],
    gpt_project_scene:[["总体建设目标",180],["建设效果",160],["项目概述",100]],
    gpt_solution_concept:[["总体方案",180],["总体建设目标",160],["项目概述",100]],
  };
  const keywords=["文化墙","效果图","总体","架构","实施","进度","质量","风险","服务","范围","作业","组织","岗位","巡检","整改","应急","安防","净水","教学","考勤","测试室","布局","拓扑","原理"];
  return options.map(option=>{
    let score=0;
    for(const [phrase,weight] of rules[item.kind]||[])score+=option.title.includes(phrase)?weight:option.context.includes(phrase)?Math.floor(weight/2):0;
    for(const keyword of keywords)if(item.title.includes(keyword)&&option.context.includes(keyword))score+=35;
    return {option,score};
  }).sort((left,right)=>right.score-left.score)[0]?.option;
}

function samePath(left:number[]|undefined,right:number[]|undefined){
  return Boolean(left&&right&&left.length===right.length&&left.every((value,index)=>value===right[index]));
}

function effectivePlacement(item:DocumentArtifact,options:PlacementOption[]){
  if(item.metadata?.placementMode==="manual"&&item.metadata.targetPath?.length){
    const manual=options.find(option=>samePath(option.path,item.metadata?.targetPath));
    if(manual)return manual;
  }
  return autoPlacement(item,options);
}

function inlineMarkdown(text:string){
  return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((part,index)=>part.startsWith("**")&&part.endsWith("**")?<strong key={index}>{part.slice(2,-2)}</strong>:<span key={index}>{part}</span>);
}

function markdownTableCells(line:string){
  return line.trim().replace(/^\|/,"").replace(/\|$/,"").split("|").map(cell=>cell.trim());
}

function PreviewContent({text,title}:{text?:string;title:string}){
  if(!text)return <p className="preview-missing">【本章节正文待生成】</p>;
  const lines=text.split(/\r?\n/);const blocks:JSX.Element[]=[];let table:string[]=[];
  const flushTable=()=>{
    if(!table.length)return;
    const rows=table.map(markdownTableCells);
    const hasHeader=rows.length>1&&rows[1].every(cell=>/^:?-{3,}:?$/.test(cell));
    const header=hasHeader?rows[0]:null;
    const body=hasHeader?rows.slice(2):rows;
    blocks.push(<div className="preview-table-wrap" key={`table-${blocks.length}`}><table>
      {header?<thead><tr>{header.map((cell,index)=><th key={index}>{inlineMarkdown(cell)}</th>)}</tr></thead>:null}
      <tbody>{body.map((row,rowIndex)=><tr key={rowIndex}>{row.map((cell,cellIndex)=><td key={cellIndex}>{inlineMarkdown(cell)}</td>)}</tr>)}</tbody>
    </table></div>);
    table=[];
  };
  lines.forEach(raw=>{const line=raw.trim();if(!line)return;if(line.startsWith("|")){table.push(line);return}flushTable();const heading=line.replace(/^#{1,4}\s+/,"").trim();if(line.startsWith("#")&&heading.replace(/\s/g,"")===title.replace(/\s/g,"")&&blocks.length===0)return;
    if(line.startsWith("#### "))blocks.push(<h4 key={blocks.length}>{inlineMarkdown(line.slice(5))}</h4>);
    else if(line.startsWith("### "))blocks.push(<h3 key={blocks.length}>{inlineMarkdown(line.slice(4))}</h3>);
    else if(line.startsWith("## ")||line.startsWith("# "))blocks.push(<h2 key={blocks.length}>{inlineMarkdown(line.replace(/^#{1,2}\s+/,""))}</h2>);
    else if(/^[-*]\s+/.test(line))blocks.push(<p className="preview-bullet" key={blocks.length}>{inlineMarkdown(line.replace(/^[-*]\s+/,""))}</p>);
    else if(/^\d+\.\s+/.test(line))blocks.push(<p className="preview-numbered" key={blocks.length}>{inlineMarkdown(line)}</p>);
    else blocks.push(<p key={blocks.length}>{inlineMarkdown(line)}</p>);
  });flushTable();return <div className="preview-rich-content">{blocks}</div>;
}

function changeNode(nodes:OutlineNode[],path:number[],change:(node:OutlineNode)=>OutlineNode){
  const copy=clone(nodes);let current=copy;
  for(let depth=0;depth<path.length-1;depth++)current=current[path[depth]].children;
  current[path[path.length-1]]=change(current[path[path.length-1]]);return copy;
}
function removeNode(nodes:OutlineNode[],path:number[]){
  const copy=clone(nodes);let current=copy;
  for(let depth=0;depth<path.length-1;depth++)current=current[path[depth]].children;
  current.splice(path[path.length-1],1);return copy;
}

function QualityAuditView({audit,compact=false}:{audit?:QualityAudit;compact?:boolean}){
  if(!audit)return null;
  const dimensions=[
    ["项目依据",audit.dimensions?.projectGrounding,25],
    ["实施动作",audit.dimensions?.actionability,25],
    ["验证闭环",audit.dimensions?.verifiability,20],
    ["信息具体",audit.dimensions?.specificity,15],
    ["表达克制",audit.dimensions?.discipline,15],
  ] as const;
  return <div className={`quality-audit ${compact?"compact":""}`}>
    <div className="quality-score"><strong>{audit.score}</strong><span>正文有效性<br/>{audit.grade}{audit.sectionType?` · ${audit.sectionType}`:""}</span></div>
    {!compact&&<div className="quality-dimensions">{dimensions.map(([label,value,total])=><span key={label}>{label}<b>{value??0}/{total}</b></span>)}</div>}
    <div className="quality-issues">{audit.issues?.length?audit.issues.slice(0,compact?2:4).map(item=><span key={item.code} title={item.detail}>{item.label}</span>):<span className="quality-pass">未发现明显空洞或重复问题</span>}</div>
  </div>;
}

function OutlineItem({node,path,requirements,editing,onUpdate,onDelete,onAdd,onGenerate,onCompare}:{node:OutlineNode;path:number[];requirements:Map<string,Requirement>;editing:boolean;onUpdate:(path:number[],node:OutlineNode)=>void;onDelete:(path:number[])=>void;onAdd:(path:number[])=>void;onGenerate:(path:number[])=>void;onCompare:(path:number[])=>void}){
  const linked=(node.requirementIds||[]).map(id=>requirements.get(id)).filter(Boolean) as Requirement[];
  const risk=linked.filter(item=>item.aiReviewStatus==="needs_review"||item.aiReviewStatus==="rejected").length;
  const deepseekVariant=node.comparisonVariants?.["deepseek-v4-pro"];
  const gptVariant=node.comparisonVariants?.["gpt-5.5"];
  const comparisonRunning=deepseekVariant?.status==="generating"||gptVariant?.status==="generating";
  return <li className={`outline-node level-${path.length}`}>
    <div className="outline-line">
      <span className="outline-number">{path.map(x=>x+1).join(".")}</span>
      <div className="outline-copy">
        {editing?<><input value={node.title} onChange={event=>onUpdate(path,{...node,title:event.target.value})}/><textarea value={node.description||""} onChange={event=>onUpdate(path,{...node,description:event.target.value})}/></>:<><h3>{node.title}</h3>{node.description&&<p>{node.description}</p>}</>}
      </div>
      <small>{linked.length?`响应 ${linked.length} 项要求`:"结构章节"}{risk?` · ${risk} 项提醒`:""}{node.generationModel?` · ${node.generationModel.startsWith("gpt-")?"GPT":"DeepSeek"}`:""}</small>
    </div>
    {linked.length>0&&<div className="linked-reqs">{linked.slice(0,4).map(item=><span key={item.id}>{typeLabels[item.type]||item.type} · {item.title}</span>)}{linked.length>4&&<span>另 {linked.length-4} 项</span>}</div>}
    <div className="node-actions">
      {editing&&<><button onClick={()=>onAdd(path)}>添加子章节</button><button className="danger" onClick={()=>onDelete(path)}>删除</button></>}
      <button className="generate-section" disabled={node.contentStatus==="generating"||node.contentStatus==="retrying"} onClick={()=>onGenerate(path)}>{node.contentStatus==="generating"?"正文生成中…":node.contentStatus==="retrying"?"等待自动重试…":node.contentStatus==="failed"?"重试 AI 深度生成":node.content?"重新生成正文":"生成本章正文"}</button>
      {node.content&&<button className="compare-models" disabled={comparisonRunning} onClick={()=>onCompare(path)}>{comparisonRunning?"模型对比生成中…":deepseekVariant?.status==="ready"&&gptVariant?.status==="ready"?"重新对比 DeepSeek / GPT":"对比 DeepSeek / GPT"}</button>}
    </div>
    {node.contentStatus==="generating"&&<div className="section-loading">正在根据本章关联的招标要求生成初稿，页面会自动刷新。</div>}
    {node.contentStatus==="retrying"&&<div className="section-loading">模型上游暂时不可用，系统已自动排队重试，无需重复点击。</div>}
    {node.contentStatus==="failed"&&<div className="section-loading">模型通道暂时不可用，原有内容已保留，可稍后点击重试。</div>}
    {node.content&&<details className="section-content" open><summary>章节正文初稿 {node.contentMode==="safe_fallback"?"· 响应骨架":node.contentMode==="ai_deep"?"· AI 深度稿":""}</summary><QualityAuditView audit={node.qualityAudit}/><pre>{node.content}</pre></details>}
    {(deepseekVariant||gptVariant)&&<div className="model-comparison">
      <h4>同一章节、同一项目资料的模型对比</h4>
      <div>{[["deepseek-v4-pro","DeepSeek"],["gpt-5.5","GPT-5.5"]].map(([key,label])=>{const item=node.comparisonVariants?.[key];return <article key={key}><header><b>{label}</b>{item?.status==="ready"?<span>${Number(item.costUsd||0).toFixed(4)} · 输入 {item.inputTokens||0} · 输出 {item.outputTokens||0} · {Math.round((item.durationMs||0)/1000)}秒</span>:<span>{item?.status==="failed"?item.errorMessage||"生成失败":"正在生成…"}</span>}</header>{item?.content?<><QualityAuditView audit={item.qualityAudit} compact/><pre>{item.content}</pre></>:null}</article>})}</div>
    </div>}
    {node.children?.length>0&&<ol>{node.children.map((child,index)=><OutlineItem key={`${path.join("-")}-${index}`} node={child} path={[...path,index]} requirements={requirements} editing={editing} onUpdate={onUpdate} onDelete={onDelete} onAdd={onAdd} onGenerate={onGenerate} onCompare={onCompare}/>)}</ol>}
  </li>;
}

function PreviewItem({node,path}:{node:OutlineNode;path:number[]}){
  const level=Math.min(path.length,3);
  const Heading=(`h${level+1}`) as keyof JSX.IntrinsicElements;
  return <section className="preview-section"><Heading>{path.map(x=>x+1).join(".")} {node.title}</Heading>{node.description&&<p className="preview-goal">{node.description}</p>}{node.content&&!node.children?.length?<pre>{node.content}</pre>:!node.children?.length&&<p className="preview-missing">【本章节正文待生成】</p>}{node.children?.map((child,index)=><PreviewItem key={index} node={child} path={[...path,index]}/>)}</section>;
}

export default function ProjectDetail(){
  const {id}=useParams<{id:string}>();const [data,setData]=useState<Detail|null>(null);const [error,setError]=useState("");const [busy,setBusy]=useState(false);const [view,setView]=useState<"outline"|"preview"|"risks">("outline");const [editing,setEditing]=useState(false);const [dirty,setDirty]=useState(false);const [draft,setDraft]=useState<OutlineNode[]>([]);const [exportInfo,setExportInfo]=useState<ExportInfo>(null);
  const [parameterItems,setParameterItems]=useState<TechnicalParameter[]>([]);
  const [parameterFilter,setParameterFilter]=useState<"all"|"important"|"mandatory"|"general">("all");
  const [artifacts,setArtifacts]=useState<DocumentArtifact[]>([]);
  const [artifactBusy,setArtifactBusy]=useState(false);
  const [gptBatchBusy,setGptBatchBusy]=useState(false);
  const [placementBusy,setPlacementBusy]=useState("");
  const [previewPath,setPreviewPath]=useState<number[]>([]);
  const [imageType,setImageType]=useState("culture_wall");
  const [imagePrompt,setImagePrompt]=useState("");
  const [imageCostConfirmed,setImageCostConfirmed]=useState(false);
  const [visualMode,setVisualMode]=useState<VisualMode>("diagrams");
  const [visualCostConfirmed,setVisualCostConfirmed]=useState(false);
  const [textModelMode,setTextModelMode]=useState<TextModelMode>("gpt");
  const [lengthMode,setLengthMode]=useState<LengthMode>("detailed");
  const [editorBusy,setEditorBusy]=useState(false);
  const load=useCallback(()=>fetch(`/api/projects/${id}`,{cache:"no-store"}).then(response=>response.json()).then(value=>{if(value.error)throw new Error(value.error);setData(value);setError("")}).catch(reason=>setError(reason.message)),[id]);
  const loadExport=useCallback(()=>fetch(`/api/projects/${id}/export`,{cache:"no-store"}).then(response=>response.json()).then(value=>setExportInfo(value.export||null)).catch(()=>{}),[id]);
  const loadArtifacts=useCallback(()=>fetch(`/api/projects/${id}/artifacts`,{cache:"no-store"}).then(response=>response.json()).then(value=>setArtifacts(value.artifacts||[])).catch(()=>{}),[id]);
  useEffect(()=>{load();loadExport();loadArtifacts();const timer=setInterval(()=>{load();loadExport();loadArtifacts()},5000);return()=>clearInterval(timer)},[load,loadExport,loadArtifacts]);
  useEffect(()=>{if((data?.parameterSummary?.total||0)>0&&!parameterItems.length)fetch(`/api/projects/${id}/technical-parameters`,{cache:"no-store"}).then(response=>response.json()).then(value=>setParameterItems(value.items||[])).catch(()=>{})},[data?.parameterSummary?.total,id,parameterItems.length]);
  useEffect(()=>{if(!dirty)setDraft(clone(data?.outline?.content?.chapters||[]))},[data?.outline?.updatedAt,data?.outline?.status,dirty]);
  useEffect(()=>{const saved=data?.outline?.content?.generationSettings?.textModelMode;if(saved)setTextModelMode(saved)},[data?.outline?.content?.generationSettings?.textModelMode]);
  useEffect(()=>{const saved=data?.outline?.content?.generationSettings?.lengthMode;if(saved)setLengthMode(saved)},[data?.outline?.content?.generationSettings?.lengthMode]);
  useEffect(()=>{const settings=data?.outline?.content?.generationSettings;if(settings?.visualMode){setVisualMode(settings.visualMode);setVisualCostConfirmed(settings.visualImageCostConfirmed===true)}},[data?.outline?.content?.generationSettings?.visualMode,data?.outline?.content?.generationSettings?.visualImageCostConfirmed]);
  const reqMap=useMemo(()=>new Map((data?.requirements||[]).map(item=>[item.id,item])),[data]);
  const risks=useMemo(()=>(data?.requirements||[]).filter(item=>item.aiReviewStatus==="needs_review"||item.aiReviewStatus==="rejected"),[data]);
  const profile=data?.outline?.content?.projectProfile;
  const blueprint=data?.outline?.content?.implementationBlueprint;
  const analysis=data?.outline?.content?.projectAnalysis;
  const scoringTasks=data?.outline?.content?.scoringTasks||[];
  const capabilityPlan=data?.outline?.content?.capabilityPlan||[];
  const requirementRouting=data?.outline?.content?.requirementRouting;
  const documentBudget=data?.outline?.content?.documentBudget;
  const firstChapter=data?.outline?.content?.chapters?.[0];
  const coverage=data?.document?.coverageAudit;
  const figurePlacementOptions=useMemo(()=>placementOptions(data?.outline?.content?.chapters||[]),[data?.outline?.content?.chapters]);
  const selectedPreviewIndex=Math.max(0,figurePlacementOptions.findIndex(option=>samePath(option.path,previewPath)));
  const selectedPreview=figurePlacementOptions[selectedPreviewIndex];
  const selectedPreviewArtifacts=selectedPreview?artifacts.filter(item=>samePath(effectivePlacement(item,figurePlacementOptions)?.path,selectedPreview.path)):[];
  const selectedTargetPages=useMemo(()=>Math.round(figurePlacementOptions.reduce((total,option)=>{const brief=option.node.brief;const matrix=["qualification_evidence","commercial_response","compliance_matrix","technical_response_matrix"].includes(brief?.formFactor||"");return total+Number(brief?.pageBudget?.targetPages||0)*(matrix?1:lengthModeMultipliers[lengthMode])},0)),[figurePlacementOptions,lengthMode]);
  useEffect(()=>{if(figurePlacementOptions.length&&!figurePlacementOptions.some(option=>samePath(option.path,previewPath)))setPreviewPath(figurePlacementOptions[0].path)},[figurePlacementOptions,previewPath]);
  const visibleParameters=useMemo(()=>parameterItems.filter(item=>parameterFilter==="all"||(parameterFilter==="important"&&item.marker==="▲")||(parameterFilter==="mandatory"&&item.marker==="★")||(parameterFilter==="general"&&!item.marker)),[parameterItems,parameterFilter]);
  const routeCounts=useMemo(()=>scoringTasks.reduce<Record<string,number>>((result,task)=>{const route=task.routeType||"unrouted";result[route]=(result[route]||0)+1;return result},{}),[scoringTasks]);
  const generationProgress=useMemo(()=>{
    const nodes=figurePlacementOptions.map(option=>option.node);
    const completed=nodes.filter(node=>node.contentStatus==="ready"&&Boolean(node.generationModel)).length;
    const working=nodes.filter(node=>node.contentStatus==="generating"||node.contentStatus==="retrying").length;
    const failed=nodes.filter(node=>node.contentStatus==="failed").length;
    const componentTotal=nodes.reduce((sum,node)=>sum+Number(node.generationCheckpoint?.componentCount||0),0);
    const componentCompleted=nodes.reduce((sum,node)=>sum+(node.generationCheckpoint?.components||[]).filter(item=>item.status==="ready").length,0);
    const total=nodes.length;
    return {total,completed,working,failed,componentTotal,componentCompleted,started:completed+working+failed>0,percent:total?Math.round(completed/total*100):0};
  },[figurePlacementOptions]);
  async function generateOutline(outlineMode:"standard"|"xique"|"dynamic"="dynamic"){setBusy(true);const response=await fetch(`/api/projects/${id}/outline`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({outlineMode})});const body=await response.json();if(!response.ok)setError(body.error||"启动大纲生成失败");else{setError("");if(outlineMode==="xique"||outlineMode==="dynamic")setLengthMode("xique");if(outlineMode==="dynamic")setTextModelMode("gpt")}await load();setBusy(false);setView("outline")}
  async function saveOutline(){if(!draft.length){setError("大纲至少保留一个章节");return false}setBusy(true);const response=await fetch(`/api/projects/${id}/outline`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({chapters:draft})});const body=await response.json();if(!response.ok){setError(body.error||"保存失败");setBusy(false);return false}setDirty(false);setEditing(false);await load();setBusy(false);return true}
  function update(path:number[],node:OutlineNode){setDraft(value=>changeNode(value,path,()=>node));setDirty(true)}
  function addChild(path:number[]){setDraft(value=>changeNode(value,path,node=>({...node,children:[...(node.children||[]),emptyNode()]})));setDirty(true)}
  function deleteAt(path:number[]){setDraft(value=>removeNode(value,path));setDirty(true)}
  async function generateSection(path:number[]){if(dirty&&!(await saveOutline()))return;const response=await fetch(`/api/projects/${id}/outline/section`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path,modelMode:textModelMode,lengthMode})});const body=await response.json();if(!response.ok)setError(body.error||"启动正文生成失败");await load()}
  async function compareSection(path:number[]){if(dirty&&!(await saveOutline()))return;setBusy(true);for(const model of ["deepseek-v4-pro","gpt-5.5"]){const response=await fetch(`/api/projects/${id}/outline/section/compare`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path,model})});const body=await response.json();if(!response.ok){setError(body.error||`启动 ${model} 对比失败`);break}}await load();setBusy(false)}
  async function generateAll(mode:"quick"|"deep"){if(dirty&&!(await saveOutline()))return;setBusy(true);const response=await fetch(`/api/projects/${id}/outline/sections`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode,modelMode:textModelMode,lengthMode,regenerate:mode==="deep"})});const body=await response.json();if(!response.ok)setError(body.error||"批量生成失败");else setError("");await load();setBusy(false);setView("preview")}
  async function generateCurrentChapter(){if(dirty&&!(await saveOutline()))return;const chapterIndex=selectedPreview?.path?.[0];if(chapterIndex===undefined)return;setBusy(true);const response=await fetch(`/api/projects/${id}/outline/sections`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"deep",modelMode:textModelMode,lengthMode,regenerate:true,chapterIndex})});const body=await response.json();if(!response.ok)setError(body.error||"启动当前章生成失败");else setError("");await load();setBusy(false);setView("preview")}
  async function editFirstChapter(){if(dirty&&!(await saveOutline()))return;setEditorBusy(true);const response=await fetch(`/api/projects/${id}/outline/editor`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chapterIndex:0})});const body=await response.json();if(!response.ok)setError(body.error||"启动章节总编失败");else setError("");await load();setEditorBusy(false);setView("preview")}
  async function generateArtifacts(){setArtifactBusy(true);const response=await fetch(`/api/projects/${id}/artifacts`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({visualMode,confirmImageCost:visualMode==="diagrams"||visualCostConfirmed,regenerateImages:true})});const body=await response.json();if(!response.ok)setError(body.error||"启动图示生成失败");else setError("");await Promise.all([load(),loadArtifacts()]);setArtifactBusy(false)}
  async function generateEffectImage(){setArtifactBusy(true);const response=await fetch(`/api/projects/${id}/artifacts/image`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({imageType,userPrompt:imagePrompt,confirmCost:imageCostConfirmed})});const body=await response.json();if(!response.ok)setError(body.error||"启动效果图生成失败");else{setError("");setImageCostConfirmed(false)}await loadArtifacts();setArtifactBusy(false)}
  async function generateAllGptDiagrams(){
    const diagramTypes=["overall_architecture","implementation_route","quality_closed_loop"];
    setGptBatchBusy(true);setError("");
    for(const type of diagramTypes){
      const response=await fetch(`/api/projects/${id}/artifacts/image`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({imageType:type,userPrompt:"横向构图，正式投标文件信息图风格，中文必须准确。",confirmCost:true})});
      const body=await response.json();
      if(!response.ok){setError(body.error||"启动 GPT 图示生成失败");break}
      let finished=false;
      for(let attempt=0;attempt<72;attempt++){
        await new Promise(resolve=>setTimeout(resolve,5000));
        const artifactResponse=await fetch(`/api/projects/${id}/artifacts`,{cache:"no-store"});
        const artifactBody=await artifactResponse.json();
        const items:DocumentArtifact[]=artifactBody.artifacts||[];
        setArtifacts(items);
        const current=items.find(item=>item.kind===type);
        if(current?.status==="failed"){setError(`${current.title}生成失败：${current.errorMessage||"未知错误"}`);finished=true;break}
        if(current?.status==="ready"&&current.metadata?.generator==="gpt-image-v1"){finished=true;break}
      }
      if(!finished){setError("GPT 图示生成等待超时，请稍后查看任务状态");break}
    }
    setImageCostConfirmed(false);setGptBatchBusy(false);await loadArtifacts();
  }
  async function updateArtifactPlacement(artifactId:string,value:string){setPlacementBusy(artifactId);const targetPath=value==="auto"?null:value.split(".").map(Number);const response=await fetch(`/api/projects/${id}/artifacts/${artifactId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({targetPath})});const body=await response.json();if(!response.ok)setError(body.error||"保存插图位置失败");else setError("");await loadArtifacts();setPlacementBusy("")}
  function choosePreviewChapter(path:number[]){setPreviewPath(path);requestAnimationFrame(()=>document.querySelector(".chapter-reader")?.scrollIntoView({behavior:"smooth",block:"start"}))}
  async function exportWord(){setBusy(true);const response=await fetch(`/api/projects/${id}/export`,{method:"POST"});const body=await response.json();if(!response.ok)setError(body.error||"启动Word导出失败");await loadExport();setBusy(false)}
  if(error&&!data)return <main className="detail-shell"><Link href="/">← 返回工作台</Link><p className="error">{error}</p></main>;
  if(!data)return <main className="detail-shell">正在读取项目…</main>;
  const generating=data.project.status==="outlining"||data.outline?.status==="generating";
  return <main className="detail-shell">
    <div className="detail-top"><div><Link href="/">← 返回项目工作台</Link><em>AI BID OUTLINE</em><h1>{data.project.name}</h1><p>{data.project.fileName}</p></div><label className={`status-pill ${generating?"auditing":"confirmed"}`}>{generating?`正在生成大纲 ${data.project.progress}%`:"大纲已就绪"}</label></div>
    {error&&<p className="error">{error}</p>}
    <section className="detail-stats"><article><small>已识别招标要求</small><strong>{data.requirements.length}</strong><span>自动关联到大纲章节</span></article><article><small>风险提醒</small><strong>{risks.length}</strong><span>不阻止继续编写</span></article><article><small>累计模型成本</small><strong>${Number(data.aiTotals.costUsd||0).toFixed(4)}</strong><span>解析、复核、大纲和正文</span></article></section>
    {requirementRouting&&documentBudget&&<section className="routing-budget-panel">
      <div><em>WRITING PLAN</em><h2>编制预算与需求路由</h2><p>每条招标要求只设一个主承载位置；参数、资格、商务和实质性条款不会混入普通方案章节。</p></div>
      <div className="routing-budget-grid">
        <article><small>唯一主路由</small><strong>{requirementRouting.primaryAssignments||0}/{requirementRouting.totalRequirements||0}</strong><span>平均重复 {Number(requirementRouting.averagePlacements||0).toFixed(2)} 次</span></article>
        <article><small>正文／独立矩阵</small><strong>{requirementRouting.narrativePlacements||0} / {requirementRouting.virtualAssignments||0}</strong><span>技术参数等由专用矩阵承载</span></article>
        <article><small>{lengthModeLabels[lengthMode]}预计篇幅</small><strong>{selectedTargetPages||documentBudget.targetPages||0} 页</strong><span>基础预算 {documentBudget.targetPages||0} 页 · 当前倍率 {lengthModeMultipliers[lengthMode]}×</span></article>
        <article><small>重点章节</small><strong>{documentBudget.highPrioritySections||0}</strong><span>共 {documentBudget.sectionCount||0} 个末级章节</span></article>
      </div>
    </section>}
    {coverage&&coverage.candidateItems>0&&<section className="coverage-panel">
      <div className="coverage-heading"><div><em>REQUIREMENT COVERAGE</em><h2>招标要求覆盖率审计</h2></div><strong>{coverage.coverageRate}%</strong></div>
      <p>候选要求 {coverage.candidateItems} 项 · 已建立响应 {coverage.coveredItems} 项 · 疑似遗漏 {coverage.possibleMissing} 项</p>
      <div className="coverage-grid">{Object.entries(coverage.categories||{}).map(([category,item])=><article key={category}>
        <span>{coverageLabels[category]||category}</span><b>{item.coverageRate}%</b>
        <small>已覆盖 {item.coveredItems}/{item.candidateItems}{item.possibleMissing?` · 待核查 ${item.possibleMissing}`:""}</small>
      </article>)}</div>
      {coverage.missingSamples?.length?<details className="coverage-missing"><summary>查看疑似遗漏位置</summary><ul>{coverage.missingSamples.slice(0,12).map((item,index)=><li key={`${item.category}-${item.page}-${index}`}><b>{coverageLabels[item.category]||item.category}</b>{item.page?` · 第 ${item.page} 页`:""} · 可能遗漏 {item.possibleMissing} 项<span>{item.sample}</span></li>)}</ul></details>:null}
    </section>}
    {(data.parameterSummary?.total||0)>0&&<details className="parameter-matrix" open>
      <summary><span><em>TECHNICAL RESPONSE MATRIX</em><b>产品技术参数响应矩阵</b></span><strong>{data.parameterSummary?.total} 项</strong></summary>
      <div className="parameter-stats">
        <button className={parameterFilter==="all"?"active":""} onClick={()=>setParameterFilter("all")}>全部 {data.parameterSummary?.total}</button>
        <button className={parameterFilter==="important"?"active important":""} onClick={()=>setParameterFilter("important")}>▲重要参数 {data.parameterSummary?.important}</button>
        <button className={parameterFilter==="mandatory"?"active mandatory":""} onClick={()=>setParameterFilter("mandatory")}>★实质性参数 {data.parameterSummary?.mandatory}</button>
        <button className={parameterFilter==="general"?"active":""} onClick={()=>setParameterFilter("general")}>一般参数 {data.parameterSummary?.general}</button>
      </div>
      {(data.parameterSummary?.important!==19||data.parameterSummary?.general!==520)&&<p className="parameter-warning">数量核对提醒：评分表声明“▲”19条、一般参数520条；系统逐行检测到“▲”{data.parameterSummary?.important}条、一般参数{data.parameterSummary?.general}条。招标文件注明数量不一致时以专家现场计算为准，请在定稿前复核差异。</p>}
      <div className="parameter-table-wrap"><table><thead><tr><th>序号</th><th>产品／设备</th><th>标识</th><th>招标技术要求</th><th>投标响应</th><th>偏离</th><th>证明材料</th></tr></thead><tbody>{visibleParameters.map(item=><tr key={item.id} className={item.marker==="▲"?"important":item.marker==="★"?"mandatory":""}>
        <td>{item.itemIndex}</td><td><b>{item.productNo} {item.productName}</b>{item.sourcePage?<small>第{item.sourcePage}页</small>:null}</td><td>{item.marker||"一般"}</td><td>{item.requirement}</td><td>{item.responseValue||"待填写拟投产品具体参数"}</td><td>{item.deviationStatus==="pending"?"待核对":item.deviationStatus}</td><td>{item.evidenceReference||item.proofRequirement||"待补证明材料"}</td>
      </tr>)}</tbody></table></div>
    </details>}
    {analysis&&<section className="analysis-panel">
      <div className="blueprint-heading"><div><em>PROJECT BATTLE MAP</em><h2>项目作战图</h2></div><span>{analysis.deliveryArchetypeLabel||profile?.projectType||"待识别"}</span></div>
      {analysis.archetypeComponents?.length&&analysis.deliveryArchetype==="mixed"?<div className="archetype-components">组成：{analysis.archetypeComponents.map(item=>({"goods":"货物采购","equipment_integration":"设备集成","software":"软件建设","professional_service":"专业服务","operation_service":"运营服务","construction":"工程施工","mixed":"混合项目"}[item]||item)).join(" + ")}</div>:null}
      <div className="analysis-grid">
        <article><h3>采购／服务对象</h3><ul>{(analysis.procurementObjects||[]).slice(0,6).map((item,index)=><li key={index}>{item}</li>)}</ul></article>
        <article><h3>验收／评价对象</h3><ul>{(analysis.acceptanceObjects||[]).slice(0,6).map((item,index)=><li key={index}>{item}</li>)}</ul></article>
        <article><h3>专业领域信号</h3><div className="analysis-tags">{(analysis.domainSignals||[]).slice(0,10).map((item,index)=><span key={index}>{item}</span>)}</div></article>
        <article><h3>需要企业补充</h3><ul>{(analysis.enterpriseInputsNeeded||[]).slice(0,6).map((item,index)=><li key={index}>{item}</li>)}</ul></article>
      </div>
      {analysis.knowledgeGaps?.length?<p className="knowledge-gap"><b>当前知识缺口：</b>{analysis.knowledgeGaps.slice(0,5).join("；")}</p>:null}
    </section>}
    {profile&&blueprint&&<section className="blueprint-panel">
      <div className="blueprint-heading"><div><em>PROJECT BLUEPRINT</em><h2>项目实施蓝图</h2></div><span>{profile.projectType||blueprint.templateName||"综合项目实施"}</span></div>
      <p>系统先规划完整实施流程，再为每个章节生成写作任务卡，正文将沿用同一套阶段、角色、交付物和质量关卡。</p>
      <div className="blueprint-phases">{(blueprint.phases||[]).map((phase,index)=><article key={`${phase.name}-${index}`}><b>{index+1}</b><div><h3>{phase.name}</h3>{phase.objective&&<p>{phase.objective}</p>}{phase.outputs?.length?<small>输出：{phase.outputs.slice(0,2).join("、")}</small>:null}</div></article>)}</div>
    </section>}
    {data.outline?.status==="ready"&&<section className="artifact-panel">
      <div className="artifact-heading"><div><em>VISUAL ARTIFACT ENGINE</em><h2>智能插图计划</h2><p>系统按章节自动组合方法图、现场图和设备物资图，并随Word一并导出。</p></div><button disabled={artifactBusy||artifacts.some(item=>item.status==="generating")||(visualMode!=="diagrams"&&!visualCostConfirmed)} onClick={generateArtifacts}>{artifactBusy||artifacts.some(item=>item.status==="generating")?"图片生成中…":artifacts.length?"按当前模式重新生成":"生成智能插图"}</button></div>
      <div className="visual-mode-control">
        <label><span>视觉模式</span><select value={visualMode} onChange={event=>{setVisualMode(event.target.value as VisualMode);setVisualCostConfirmed(false)}}><option value="diagrams">仅免费图示（5–12张）</option><option value="mixed">图文混合（另加约2张写实示意图）</option><option value="physical_priority">实物优先（另加约3张写实示意图）</option></select></label>
        <p>{visualMode==="diagrams"?"自动生成架构、流程、组织和控制类图示，不产生图片模型费用。":visualMode==="mixed"?"方法图配合现场作业、设备物资等写实示意图，预计图片费用不超过 $0.402。":"提高设备、场景和完成效果图片比例，预计图片费用不超过 $0.603。"}</p>
        {visualMode!=="diagrams"?<label className="cost-confirm"><input type="checkbox" checked={visualCostConfirmed} onChange={event=>setVisualCostConfirmed(event.target.checked)}/><span>我确认按此模式调用GPT图片模型。AI图片将标注为“写实示意图”，不作为品牌、库存、业绩或实物证明。</span></label>:null}
      </div>
      {artifacts.length?<div className="artifact-plan-summary"><span>计划图片 <b>{artifacts.length}</b></span><span>免费图示 <b>{artifacts.filter(item=>item.metadata?.generator!=="gpt-image-v1").length}</b></span><span>AI效果图 <b>{artifacts.filter(item=>item.metadata?.generator==="gpt-image-v1").length}</b></span><span>已就绪 <b>{artifacts.filter(item=>item.status==="ready").length}</b></span></div>:null}
      {artifacts.length?<div className="artifact-grid">{artifacts.map(item=>{const recommended=autoPlacement(item,figurePlacementOptions);const manual=item.metadata?.placementMode==="manual"&&item.metadata.targetPath?.length;const selectValue=manual?item.metadata!.targetPath!.join("."):"auto";return <article key={item.id}>
        <div><h3>{item.title}</h3><small>{item.status==="ready"?`已生成，可随 Word 一并导出${item.metadata?.actualCostUsd!=null?` · 实际费用 $${Number(item.metadata.actualCostUsd).toFixed(3)}`:""} · ${item.metadata?.generator==="gpt-image-v1"?"AI效果图":"免费图示"}`:item.status==="failed"?item.errorMessage||"生成失败":"正在生成，通常需要约 1 分钟"}</small></div>
        {item.imageUrl?<img src={item.imageUrl} alt={item.title}/>:<div className="artifact-placeholder">{item.status==="failed"?"本次未生成图片":"正在编制图示…"}</div>}
        <label className="artifact-placement"><span>Word插入位置 <b>{manual?"人工指定":"自动推荐"}</b></span><select value={selectValue} disabled={placementBusy===item.id} onChange={event=>updateArtifactPlacement(item.id,event.target.value)}><option value="auto">自动：{recommended?.label||"其他项目图示"}</option>{figurePlacementOptions.map(option=><option key={option.path.join(".")} value={option.path.join(".")}>{option.label}</option>)}</select></label>
      </article>})}</div>:<p className="artifact-empty">将生成总体交付架构图、项目实施路线图和全过程质量控制闭环图。</p>}
      <div className="effect-image-builder">
        <div><em>GPT IMAGE · 单张可控生成</em><h3>生成项目效果图</h3><p>适用于文化墙、建成场景和方案概念图。系统自动加入项目背景，你只需选择类型；不会自动批量生成。</p></div>
        <label>图片类型<select value={imageType} onChange={event=>{setImageType(event.target.value);setImageCostConfirmed(false)}}><option value="culture_wall">文化墙概念效果图</option><option value="project_scene">项目建成场景概念图</option><option value="solution_concept">项目方案概念视觉图</option><option value="overall_architecture">GPT 项目总体交付架构图</option><option value="implementation_route">GPT 项目实施路线图</option><option value="quality_closed_loop">GPT 全过程质量控制闭环图</option><option value="custom">自定义项目效果图</option></select></label>
        <label>补充画面要求（可不填）<textarea value={imagePrompt} maxLength={800} onChange={event=>setImagePrompt(event.target.value)} placeholder="例如：横向构图，突出培训空间，墙面预留标题和成果展示区域。"/></label>
        <label className="cost-confirm"><input type="checkbox" checked={imageCostConfirmed} onChange={event=>setImageCostConfirmed(event.target.checked)}/><span>我确认生成本张图片。根据最新实测，预计费用约 <b>$0.201／张</b>；OAuth 图片通道会忽略低质量和固定尺寸参数。</span></label>
        <button className="generate-effect" disabled={artifactBusy||gptBatchBusy||!imageCostConfirmed||artifacts.some(item=>item.status==="generating")} onClick={generateEffectImage}>{artifacts.some(item=>item.status==="generating")?"效果图生成中…":"生成单张效果图"}</button>
        <button className="generate-effect" disabled={artifactBusy||gptBatchBusy||!imageCostConfirmed||artifacts.some(item=>item.status==="generating")} onClick={generateAllGptDiagrams}>{gptBatchBusy?"正在逐张生成 GPT 图示…":"一键用 GPT 重绘三张流程图（预计 $0.603）"}</button>
      </div>
    </section>}
    {capabilityPlan.length>0&&<section className="capability-panel">
      <div className="outline-heading"><div><em>CAPABILITY REGISTRY</em><h2>本项目启用的通用能力模块</h2></div><p>{capabilityPlan.length} 个模块 · 按项目作战图动态组合</p></div>
      <div className="capability-grid">{capabilityPlan.map(module=><article key={module.id}>
        <h3>{module.name}</h3>
        {module.methodPattern&&<p>{module.methodPattern}</p>}
        {module.suggestedArtifacts?.length?<small>建议成果：{module.suggestedArtifacts.join("、")}</small>:null}
      </article>)}</div>
    </section>}
    {scoringTasks.length>0&&<details className="scoring-compiler" open>
      <summary>评分任务编译结果 · {scoringTasks.length} 项</summary>
      <div className="route-summary">{Object.entries(routeCounts).map(([route,count])=><span className={`route-${route}`} key={route}>{routeLabels[route]||route} {count}</span>)}</div>
      <div className="scoring-task-grid">{scoringTasks.slice(0,12).map(task=><article key={task.requirementId}>
        <div className="task-title"><h3>{task.title}</h3><span className={`route-${task.routeType||"unrouted"}`}>{task.routeLabel||routeLabels[task.routeType||""]||"待路由"}</span></div>
        {task.responseObjective&&<p>{task.responseObjective}</p>}
        {task.mustCover?.length?<small><b>必须覆盖：</b>{task.mustCover.slice(0,3).join("；")}</small>:null}
        {task.suggestedArtifacts?.length?<small><b>建议成果：</b>{task.suggestedArtifacts.join("、")}</small>:null}
        {task.enterpriseInputsNeeded?.length?<small className="needs-input"><b>待补企业资料：</b>{task.enterpriseInputsNeeded.join("、")}</small>:null}
      </article>)}</div>
    </details>}
    <div className="main-tabs"><button className={view==="outline"?"active":""} onClick={()=>setView("outline")}>投标文件大纲</button><button className={view==="preview"?"active":""} onClick={()=>setView("preview")}>整稿预览</button><button className={view==="risks"?"active risk":""} onClick={()=>setView("risks")}>风险提醒 {risks.length?`(${risks.length})`:""}</button>{view==="outline"&&draft.length>0&&<>{editing?<button className="save-outline" disabled={busy} onClick={saveOutline}>{busy?"保存中…":"保存大纲"}</button>:<button className="edit-outline" onClick={()=>setEditing(true)}>编辑大纲</button>}<button className="add-top" onClick={()=>{setDraft(value=>[...value,emptyNode()]);setEditing(true);setDirty(true)}}>添加一级章节</button></>}<button className="quick-generate" disabled={busy||generating} onClick={()=>generateOutline("dynamic")}>{generating&&data.outline?.content?.generationSettings?.outlineMode==="dynamic"?"GPT正在发现项目结构…":"生成GPT项目专属目录"}</button><button className="regenerate" disabled={busy||generating} onClick={()=>generateOutline("standard")}>标准目录（备用）</button></div>
    {view==="outline"&&<section className="outline-panel">{generating?<div className="outline-loading"><b style={{width:`${data.project.progress}%`}}/><h2>GPT正在分析项目对象并逐章深化目录</h2><p>进度包含项目语义发现和各一级章节的独立扩展。</p></div>:draft.length?<><div className="outline-heading"><div><em>DOCUMENT STRUCTURE</em><h2>项目专属投标文件目录</h2></div><p>第 {data.outline?.version||1} 版 · {data.outline?.content?.outlineSpecificityAudit?`标题唯一率 ${data.outline.content.outlineSpecificityAudit.titleUniquenessRate||0}% · 原文绑定 ${data.outline.content.outlineSpecificityAudit.sourceBindingRate||0}% · 叶子章节 ${data.outline.content.outlineSpecificityAudit.leafCount||0}`:editing?"编辑完成后请保存":"可按章节生成正文"}</p></div><ol className="outline-tree">{draft.map((chapter,index)=><OutlineItem key={index} node={chapter} path={[index]} requirements={reqMap} editing={editing} onUpdate={update} onDelete={deleteAt} onAdd={addChild} onGenerate={generateSection} onCompare={compareSection}/>)}</ol></>:<div className="outline-empty"><h2>招标文件解析完成</h2><p>使用GPT先发现本项目对象、场景和工作流，再生成项目专属目录。</p><button onClick={()=>generateOutline("dynamic")}>生成GPT项目专属目录</button></div>}</section>}
    {view==="preview"&&<section className="preview-panel">
      <div className="preview-toolbar"><div><em>FULL DOCUMENT</em><h2>投标文件章节工作区</h2><p>从左侧选择章节，右侧查看正文、质量评分和最终插图；网页预览与Word导出使用同一套插图位置。</p></div><div className="generation-controls"><label className="model-mode-control"><span>正文生成模式</span><select value={textModelMode} disabled={busy} onChange={event=>setTextModelMode(event.target.value as TextModelMode)}><option value="deepseek">DeepSeek 全文</option><option value="gpt">GPT 全文</option><option value="mixed">智能混合</option></select><small>{modelModeDescriptions[textModelMode]}</small></label><label className="model-mode-control"><span>正文篇幅档位</span><select value={lengthMode} disabled={busy} onChange={event=>setLengthMode(event.target.value as LengthMode)}><option value="standard">标准稿</option><option value="detailed">深度稿</option><option value="extended">超长稿</option><option value="xique">喜鹊长篇</option></select><small>{lengthModeDescriptions[lengthMode]}</small></label><button className="quick-generate" disabled={busy} onClick={()=>generateAll("quick")}>快速生成响应骨架</button><button className="quick-generate" disabled={busy||!selectedPreview} onClick={generateCurrentChapter}>{busy?"正在加入生成队列…":`只生成第 ${(selectedPreview?.path?.[0]??0)+1} 章`}</button><button className="primary" disabled={busy} onClick={()=>generateAll("deep")}>{busy?"正在加入生成队列…":`用${modelModeLabels[textModelMode]}生成全文`}</button><button className="quick-generate" disabled={busy||editorBusy||firstChapter?.editorStatus==="queued"||firstChapter?.editorStatus==="editing"} onClick={editFirstChapter}>{firstChapter?.editorStatus==="queued"||firstChapter?.editorStatus==="editing"?`第一章总编中 ${firstChapter.editorProgress||0}%`:"总编第一章样板"}</button>{exportInfo?.status==="ready"?<a href={`/api/projects/${id}/export/download`}>下载Word</a>:<button disabled={busy||exportInfo?.status==="queued"||exportInfo?.status==="running"} onClick={exportWord}>{exportInfo?.status==="queued"||exportInfo?.status==="running"?"Word生成中…":"导出Word"}</button>}</div></div>
      {generationProgress.started&&<div className={`document-generation-progress ${generationProgress.failed?"has-failures":""}`}><div><span><b>{modelModeLabels[data.outline?.content?.generationSettings?.textModelMode||textModelMode]}</b>{generationProgress.working?`正在逐章生成，剩余 ${generationProgress.total-generationProgress.completed-generationProgress.failed} 章`:"本轮正文生成完成"}</span><strong>{generationProgress.completed}/{generationProgress.total} · {generationProgress.percent}%</strong></div><div className="generation-progress-track"><i style={{width:`${generationProgress.percent}%`}}/></div><small>已完成 {generationProgress.completed} 章{generationProgress.working?` · 生成或排队中 ${generationProgress.working} 章`:""}{generationProgress.componentTotal?` · 当前章节组件 ${generationProgress.componentCompleted}/${generationProgress.componentTotal}`:""}{generationProgress.failed?` · 失败 ${generationProgress.failed} 章`:""}；已完成组件会自动保存，临时失败后只补未完成部分。</small></div>}
      {exportInfo?.status==="failed"&&<p className="error">{exportInfo.errorMessage}</p>}
      <div className="bid-workspace">
        <aside className="chapter-navigator">
          <div><em>DOCUMENT OUTLINE</em><h3>选择章节</h3><span>{selectedPreviewIndex+1}/{figurePlacementOptions.length}</span></div>
          <nav>{(data.outline?.content?.chapters||[]).map((chapter,chapterIndex)=>{const options=figurePlacementOptions.filter(option=>option.path[0]===chapterIndex);return <section key={chapterIndex}><h4>{chapterIndex+1} {chapter.title}</h4>{options.map(option=><button key={option.path.join(".")} className={samePath(option.path,selectedPreview?.path)?"active":""} onClick={()=>choosePreviewChapter(option.path)}><i className={option.node.contentStatus==="ready"?"ready":option.node.contentStatus==="generating"||option.node.contentStatus==="retrying"?"working":""}/><span>{option.path.map(value=>value+1).join(".")} {option.title}</span>{artifacts.some(item=>samePath(effectivePlacement(item,figurePlacementOptions)?.path,option.path))?<b>有图</b>:null}</button>)}</section>})}</nav>
        </aside>
        <article className="chapter-reader">
          {selectedPreview?<><header><div><em>CHAPTER {selectedPreview.path.map(value=>value+1).join(".")}</em><h1>{selectedPreview.title}</h1>{selectedPreview.node.brief?.pageBudget&&<small className="section-budget">基础目标 {selectedPreview.node.brief.pageBudget.targetPages} 页 · 本次 {lengthModeLabels[selectedPreview.node.lengthMode||lengthMode]}{selectedPreview.node.generationPasses?` ${selectedPreview.node.generationPasses}轮`:""}{selectedPreview.node.generationCheckpoint?` · 已保存组件 ${selectedPreview.node.generationCheckpoint.components?.length||0}/${selectedPreview.node.generationCheckpoint.componentCount||0}`:""} · 承载 {selectedPreview.node.requirementIds?.length||0} 条要求 · {formFactorLabels[selectedPreview.node.brief.formFactor||""]||"专业正文"}</small>}</div><QualityAuditView audit={selectedPreview.node.qualityAudit} compact/></header>
          <PreviewContent text={selectedPreview.node.content} title={selectedPreview.title}/>
          {selectedPreviewArtifacts.length?<div className="inline-figures">{selectedPreviewArtifacts.map((item,index)=><figure key={item.id}>{item.imageUrl?<img src={item.imageUrl} alt={item.title}/>:<div className="figure-waiting">图片正在生成</div>}<figcaption>图 {index+1}　{item.title}</figcaption></figure>)}</div>:null}
          <footer><button disabled={selectedPreviewIndex<=0} onClick={()=>choosePreviewChapter(figurePlacementOptions[selectedPreviewIndex-1].path)}>← 上一章</button><span>{selectedPreview.label}</span><button disabled={selectedPreviewIndex>=figurePlacementOptions.length-1} onClick={()=>choosePreviewChapter(figurePlacementOptions[selectedPreviewIndex+1].path)}>下一章 →</button></footer></>:<p className="preview-missing">大纲中暂无可预览的末级章节。</p>}
        </article>
      </div>
    </section>}
    {view==="risks"&&<section className="risk-panel"><div className="risk-intro"><h2>{risks.length?`有 ${risks.length} 项建议稍后核对`:"未发现需要处理的疑点"}</h2><p>这些提醒不会阻止大纲和正文生成。</p></div>{risks.map(item=><article className="simple-risk" key={item.id}><span>{typeLabels[item.type]||item.type}</span><h3>{item.title}</h3><p><b>为什么提醒：</b>{item.aiReviewReason}</p>{item.aiReviewSuggestion&&<p><b>建议：</b>{item.aiReviewSuggestion}</p>}<details><summary>查看原文依据</summary><p>{item.normalizedValue}</p>{item.evidence?.map((e,index)=><blockquote key={index}><code>{e.blockId}</code>{e.quote}</blockquote>)}</details></article>)}</section>}
  </main>;
}
