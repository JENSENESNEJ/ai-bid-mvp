// 共享类型与标签常量 —— 从原 projects/[id]/page.tsx 抽出
// 注意:summary 模式下大纲节点不携带正文,content 为可选,新增 nodeKey/hasContent/contentChars

export type Evidence = { blockId: string; quote: string; chunk: number };

export type Requirement = {
  id: string;
  type: string;
  title: string;
  normalizedValue: string;
  mandatory: boolean;
  evidence: Evidence[];
  reviewStatus: string;
  aiReviewStatus: "unreviewed" | "auto_pass" | "needs_review" | "rejected";
  aiReviewReason?: string;
  aiReviewSuggestion?: string;
};

export type PageBudget = {
  minPages?: number;
  targetPages?: number;
  maxPages?: number;
  targetCharacters?: number;
  priority?: string;
};

export type SectionBrief = {
  purpose?: string;
  formFactor?: string;
  mustCover?: string[];
  suggestedTables?: string[];
  requiredOutputs?: string[];
  pageBudget?: PageBudget;
};

export type QualityIssue = { code: string; label: string; detail: string };

export type QualityAudit = {
  score: number;
  grade: string;
  sectionType?: string;
  dimensions?: {
    projectGrounding?: number;
    actionability?: number;
    verifiability?: number;
    specificity?: number;
    discipline?: number;
  };
  issues?: QualityIssue[];
  metrics?: {
    characters?: number;
    actionCount?: number;
    verificationCount?: number;
    matchedAnchors?: string[];
    genericPhraseCount?: number;
    repeatedPairs?: number;
  };
};

export type ComparisonVariant = {
  status: string;
  model?: string;
  content?: string; // summary 模式下不返回,仅 GET section 携带
  contentMode?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  durationMs?: number;
  generatedAt?: string;
  errorMessage?: string;
  qualityAudit?: QualityAudit;
  hasContent?: boolean;
  contentChars?: number;
};

export type TextModelMode = "deepseek" | "gpt" | "mixed";
export type LengthMode = "standard" | "detailed" | "extended" | "xique";
export type VisualMode = "diagrams" | "mixed" | "physical_priority";
export type TabKey = "overview" | "outline" | "chapter" | "parameters" | "artifacts" | "risks";

export type OutlineNode = {
  title: string;
  description: string;
  requirementIds: string[];
  sourceBlockIds?: string[];
  contentForm?: string;
  semanticRole?: string;
  projectSpecific?: boolean;
  children: OutlineNode[];
  brief?: SectionBrief;
  /** summary 模式不返回;GET /outline/section 按需获取 */
  content?: string;
  /** summary 模式追加:服务端注入的节点路径键,PATCH 合并与按需取正文使用 */
  nodeKey?: string;
  hasContent?: boolean;
  contentChars?: number;
  contentStatus?: string;
  contentMode?: string;
  generationModel?: string;
  generationStrategy?: string;
  lengthMode?: LengthMode;
  generationPasses?: number;
  generationCheckpoint?: {
    componentCount?: number;
    components?: { index: number; title: string; status: string; characters?: number }[];
  };
  componentMergeAudit?: { componentCount?: number; removedNearDuplicateBlocks?: number };
  comparisonVariants?: Record<string, ComparisonVariant>;
  qualityAudit?: QualityAudit;
  editorStatus?: string;
  editorProgress?: number;
  editorError?: string;
  editorialModel?: string;
};

export type ProjectProfile = {
  projectType?: string;
  objectives?: string[];
  scope?: string[];
  deliverables?: string[];
  constraints?: string[];
  stakeholders?: string[];
};

export type BlueprintPhase = {
  name: string;
  objective?: string;
  tasks?: string[];
  outputs?: string[];
  qualityGate?: string;
  risks?: string[];
};

export type ProjectAnalysis = {
  deliveryArchetype?: string;
  deliveryArchetypeLabel?: string;
  archetypeComponents?: string[];
  procurementObjects?: string[];
  workstreams?: { name: string; objective?: string; outputs?: string[] }[];
  acceptanceObjects?: string[];
  keyConstraints?: string[];
  domainSignals?: string[];
  enterpriseInputsNeeded?: string[];
  knowledgeGaps?: string[];
};

export type ScoringTask = {
  requirementId: string;
  title: string;
  responseObjective?: string;
  mustCover?: string[];
  suggestedArtifacts?: string[];
  enterpriseInputsNeeded?: string[];
  riskIfMissing?: string;
  targetSections?: string[];
  routeType?: string;
  routeLabel?: string;
  responseMode?: string;
  generatesNarrative?: boolean;
  capabilityModuleIds?: string[];
};

export type CapabilityModule = {
  id: string;
  name: string;
  methodPattern?: string;
  suggestedArtifacts?: string[];
  reason?: string;
};

export type RequirementRouting = {
  totalRequirements?: number;
  primaryAssignments?: number;
  secondaryAssignments?: number;
  virtualAssignments?: number;
  narrativePlacements?: number;
  totalPlacements?: number;
  averagePlacements?: number;
  laneCounts?: Record<string, number>;
};

export type DocumentBudget = {
  sectionCount?: number;
  minPages?: number;
  targetPages?: number;
  maxPages?: number;
  targetCharacters?: number;
  highPrioritySections?: number;
};

export type CoverageCategory = {
  candidateItems: number;
  coveredItems: number;
  possibleMissing: number;
  coverageRate: number;
};

export type CoverageAudit = {
  parserVersion?: string;
  candidateItems: number;
  coveredItems: number;
  possibleMissing: number;
  coverageRate: number;
  categories?: Record<string, CoverageCategory>;
  missingSamples?: { category: string; page?: number; kind: string; possibleMissing: number; sample: string }[];
};

export type ParameterSummary = {
  total: number;
  products: number;
  important: number;
  mandatory: number;
  general: number;
  pending: number;
};

export type TechnicalParameter = {
  id: string;
  itemIndex: number;
  productNo: number;
  productName: string;
  parameterNo?: string;
  marker: string;
  requirement: string;
  sourcePage?: number;
  proofRequirement?: string;
  responseValue?: string;
  deviationStatus: string;
  evidenceReference?: string;
};

export type DocumentArtifact = {
  id: string;
  kind: string;
  title: string;
  status: string;
  imageUrl?: string;
  errorMessage?: string;
  metadata?: {
    source?: string;
    generator?: string;
    requestedModel?: string;
    returnedModel?: string;
    estimatedCostUsd?: number;
    actualCostUsd?: number;
    targetPath?: number[];
    targetTitle?: string;
    placementMode?: string;
  };
};

export type PlacementOption = {
  path: number[];
  label: string;
  title: string;
  context: string;
  node: OutlineNode;
};

export type OutlineContent = {
  chapters: OutlineNode[];
  projectProfile?: ProjectProfile;
  implementationBlueprint?: { templateName?: string; phases?: BlueprintPhase[] };
  projectAnalysis?: ProjectAnalysis;
  scoringTasks?: ScoringTask[];
  capabilityPlan?: CapabilityModule[];
  requirementRouting?: RequirementRouting;
  documentBudget?: DocumentBudget;
  outlineSpecificityAudit?: {
    titleCount?: number;
    uniqueTitleCount?: number;
    titleUniquenessRate?: number;
    leafCount?: number;
    sourceBoundLeaves?: number;
    sourceBindingRate?: number;
    genericTitleCount?: number;
    genericTitleRate?: number;
    depthCounts?: Record<string, number>;
  };
  generationSettings?: {
    textModelMode?: TextModelMode;
    lengthMode?: LengthMode;
    outlineMode?: "standard" | "xique" | "dynamic";
    visualMode?: VisualMode;
    visualImageCostConfirmed?: boolean;
  };
};

export type Detail = {
  project: { id: string; name: string; fileName: string; status: string; progress: number; errorMessage?: string };
  document?: { coverageAudit?: CoverageAudit };
  outline?: { content: OutlineContent; status: string; version: number; updatedAt?: string };
  requirements: Requirement[];
  aiTotals: { inputTokens: number; outputTokens: number; costUsd: number; requests: number; failedRequests: number };
  parameterSummary?: ParameterSummary;
};

export type ExportInfo = { status: string; fileName?: string; errorMessage?: string } | null;

/** GET /api/projects/[id]/outline/section?path=… 的响应 */
export type SectionDetail = {
  path: number[];
  outlineVersion: number;
  outlineUpdatedAt?: string;
  node: OutlineNode; // 含完整 content 与 comparisonVariants 正文
};

// ---------- 标签常量 ----------

export const typeLabels: Record<string, string> = {
  qualification: "资格", disqualification: "废标", scoring: "评分", deadline: "时间",
  deposit: "保证金", deliverable: "交付", technical: "技术", commercial: "商务", other: "其他",
};

export const routeLabels: Record<string, string> = {
  technical_solution: "技术方案正文", technical_parameter: "技术参数响应表", commercial_response: "商务响应",
  qualification_evidence: "资格与证明材料", pricing_policy: "价格政策与声明",
  compliance_response: "实质性响应", evaluation_rule: "评审规则提醒",
};

export const formFactorLabels: Record<string, string> = {
  qualification_evidence: "资格证明清单", commercial_response: "商务响应矩阵", compliance_matrix: "实质性核对表",
  technical_response_matrix: "技术参数矩阵", diagnostic_narrative: "重点难点分析", operational_plan: "作业实施方案",
  technical_process: "技术实施流程", schedule: "进度计划", organization: "组织与职责",
  quality_control: "质量控制", acceptance: "验收移交", training_plan: "培训计划",
  service_process: "服务流程", risk_control: "风险与应急", professional_narrative: "专业方案正文",
};

export const coverageLabels: Record<string, string> = {
  scoring: "评分项", technical: "技术参数", qualification: "资格材料",
  disqualification: "废标／实质性条款", commercial: "商务与合同",
};

export const modelModeLabels: Record<TextModelMode, string> = {
  deepseek: "DeepSeek 全文", gpt: "GPT 全文", mixed: "智能混合",
};

export const modelModeDescriptions: Record<TextModelMode, string> = {
  deepseek: "全部章节使用 DeepSeek，成本更低",
  gpt: "全部章节使用 GPT-5.5，便于完整质量测试",
  mixed: "方案型章节用 GPT，商务、参数和证明材料用 DeepSeek",
};

export const lengthModeLabels: Record<LengthMode, string> = {
  standard: "标准稿", detailed: "深度稿", extended: "超长稿", xique: "喜鹊长篇",
};

export const lengthModeDescriptions: Record<LengthMode, string> = {
  standard: "每章单轮生成，预计8–12万字",
  detailed: "方案章节三轮生成，预计15–22万字",
  extended: "方案章节五轮生成，预计25–35万字",
  xique: "五级目录逐节点生成，目标30–50万字",
};

export const lengthModeMultipliers: Record<LengthMode, number> = {
  standard: 1, detailed: 2.15, extended: 3.15, xique: 1,
};

export const archetypeComponentLabels: Record<string, string> = {
  goods: "货物采购", equipment_integration: "设备集成", software: "软件建设",
  professional_service: "专业服务", operation_service: "运营服务",
  construction: "工程施工", mixed: "混合项目",
};

export const emptyNode = (): OutlineNode => ({
  title: "新章节",
  description: "请填写本章写作目标",
  requirementIds: [],
  children: [],
  contentStatus: "idle",
});
