"use client";
// 共享工具函数与小组件 —— 从原 projects/[id]/page.tsx 抽出
// changeNode/removeNode 改为沿路径浅拷贝(结构共享),不再对整棵树做 JSON 深拷贝

import type { JSX } from "react";
import type { DocumentArtifact, OutlineNode, PlacementOption, QualityAudit } from "./types";

export function placementOptions(nodes: OutlineNode[], prefix: number[] = [], titles: string[] = []): PlacementOption[] {
  const result: PlacementOption[] = [];
  nodes.forEach((node, index) => {
    const path = [...prefix, index];
    const pathTitles = [...titles, node.title];
    if (node.children?.length) result.push(...placementOptions(node.children, path, pathTitles));
    else result.push({ path, label: `${path.map(value => value + 1).join(".")} ${node.title}`, title: node.title, context: pathTitles.join(" "), node });
  });
  return result;
}

export function samePath(left: number[] | undefined, right: number[] | undefined) {
  return Boolean(left && right && left.length === right.length && left.every((value, index) => value === right[index]));
}

export function autoPlacement(item: DocumentArtifact, options: PlacementOption[]) {
  if (item.metadata?.placementMode === "planned" && item.metadata.targetPath?.length) {
    const planned = options.find(option => samePath(option.path, item.metadata?.targetPath));
    if (planned) return planned;
  }
  const rules: Record<string, [string, number][]> = {
    overall_architecture: [["总体建设目标", 180], ["总体方案", 150], ["总体理解", 120], ["项目概述", 90]],
    implementation_route: [["整体实施进度计划", 200], ["实施进度", 170], ["进度计划", 150], ["组织与实施", 100]],
    quality_closed_loop: [["质量控制与风险管理", 200], ["质量控制", 170], ["质量管理", 150], ["验收保障", 120]],
    service_scope_map: [["服务范围与需求理解", 220], ["服务范围", 190], ["需求理解", 170]],
    service_operation_cycle: [["工作方法与协同机制", 220], ["实施路径与工作流程", 200], ["服务实施", 170]],
    organization_responsibility: [["项目组织架构", 240], ["岗位职责与人员安排", 190], ["组织架构", 180]],
    inspection_rectification: [["过程检查与成果审核", 240], ["质量控制", 180], ["整改", 140]],
    emergency_response: [["风险识别与应急预案", 250], ["应急预案", 210], ["风险识别", 180]],
    gpt_culture_wall: [["设计效果图", 180], ["文化墙", 140]],
    gpt_project_scene: [["总体建设目标", 180], ["建成效果", 160], ["项目概述", 100]],
    gpt_solution_concept: [["总体方案", 180], ["总体建设目标", 160], ["项目概述", 100]],
  };
  const keywords = ["文化墙", "效果图", "总体", "架构", "实施", "进度", "质量", "风险", "服务", "范围", "作业", "组织", "岗位", "巡检", "整改", "应急", "安防", "净水", "教学", "考勤", "测试室", "布局", "拓扑", "原理"];
  return options.map(option => {
    let score = 0;
    for (const [phrase, weight] of rules[item.kind] || []) score += option.title.includes(phrase) ? weight : option.context.includes(phrase) ? Math.floor(weight / 2) : 0;
    for (const keyword of keywords) if (item.title.includes(keyword) && option.context.includes(keyword)) score += 35;
    return { option, score };
  }).sort((left, right) => right.score - left.score)[0]?.option;
}

export function effectivePlacement(item: DocumentArtifact, options: PlacementOption[]) {
  if (item.metadata?.placementMode === "manual" && item.metadata.targetPath?.length) {
    const manual = options.find(option => samePath(option.path, item.metadata?.targetPath));
    if (manual) return manual;
  }
  return autoPlacement(item, options);
}

export function inlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : <span key={index}>{part}</span>);
}

export function markdownTableCells(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.trim());
}

/** Markdown 正文渲染(标题/列表/表格/段落) */
export function PreviewContent({ text, title }: { text?: string; title: string }) {
  if (!text) return <p className="preview-missing">【本章节正文待生成】</p>;
  const lines = text.split(/\r?\n/);
  const blocks: JSX.Element[] = [];
  let table: string[] = [];
  const flushTable = () => {
    if (!table.length) return;
    const rows = table.map(markdownTableCells);
    const hasHeader = rows.length > 1 && rows[1].every(cell => /^:?-{3,}:?$/.test(cell));
    const header = hasHeader ? rows[0] : null;
    const body = hasHeader ? rows.slice(2) : rows;
    blocks.push(<div className="preview-table-wrap" key={`table-${blocks.length}`}><table>
      {header ? <thead><tr>{header.map((cell, index) => <th key={index}>{inlineMarkdown(cell)}</th>)}</tr></thead> : null}
      <tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{inlineMarkdown(cell)}</td>)}</tr>)}</tbody>
    </table></div>);
    table = [];
  };
  lines.forEach(raw => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith("|")) { table.push(line); return; }
    flushTable();
    const heading = line.replace(/^#{1,4}\s+/, "").trim();
    if (line.startsWith("#") && heading.replace(/\s/g, "") === title.replace(/\s/g, "") && blocks.length === 0) return;
    if (line.startsWith("#### ")) blocks.push(<h4 key={blocks.length}>{inlineMarkdown(line.slice(5))}</h4>);
    else if (line.startsWith("### ")) blocks.push(<h3 key={blocks.length}>{inlineMarkdown(line.slice(4))}</h3>);
    else if (line.startsWith("## ") || line.startsWith("# ")) blocks.push(<h2 key={blocks.length}>{inlineMarkdown(line.replace(/^#{1,2}\s+/, ""))}</h2>);
    else if (/^[-*]\s+/.test(line)) blocks.push(<p className="preview-bullet" key={blocks.length}>{inlineMarkdown(line.replace(/^[-*]\s+/, ""))}</p>);
    else if (/^\d+\.\s+/.test(line)) blocks.push(<p className="preview-numbered" key={blocks.length}>{inlineMarkdown(line)}</p>);
    else blocks.push(<p key={blocks.length}>{inlineMarkdown(line)}</p>);
  });
  flushTable();
  return <div className="preview-rich-content">{blocks}</div>;
}

/** 章节质量评分卡 */
export function QualityAuditView({ audit, compact = false }: { audit?: QualityAudit; compact?: boolean }) {
  if (!audit) return null;
  const dimensions = [
    ["项目依据", audit.dimensions?.projectGrounding, 25],
    ["实施动作", audit.dimensions?.actionability, 25],
    ["验证闭环", audit.dimensions?.verifiability, 20],
    ["信息具体", audit.dimensions?.specificity, 15],
    ["表达克制", audit.dimensions?.discipline, 15],
  ] as const;
  return <div className={`quality-audit ${compact ? "compact" : ""}`}>
    <div className="quality-score"><strong>{audit.score}</strong><span>正文有效性<br />{audit.grade}{audit.sectionType ? ` · ${audit.sectionType}` : ""}</span></div>
    {!compact && <div className="quality-dimensions">{dimensions.map(([label, value, total]) => <span key={label}>{label}<b>{value ?? 0}/{total}</b></span>)}</div>}
    <div className="quality-issues">{audit.issues?.length ? audit.issues.slice(0, compact ? 2 : 4).map(item => <span key={item.code} title={item.detail}>{item.label}</span>) : <span className="quality-pass">未发现明显空洞或重复问题</span>}</div>
  </div>;
}

// ---------- 大纲树不可变更新(沿路径浅拷贝,其余子树结构共享) ----------

export function changeNode(nodes: OutlineNode[], path: number[], change: (node: OutlineNode) => OutlineNode): OutlineNode[] {
  if (!path.length) return nodes;
  const [head, ...rest] = path;
  return nodes.map((node, index) => {
    if (index !== head) return node;
    if (!rest.length) return change(node);
    return { ...node, children: changeNode(node.children || [], rest, change) };
  });
}

export function removeNode(nodes: OutlineNode[], path: number[]): OutlineNode[] {
  if (!path.length) return nodes;
  const [head, ...rest] = path;
  if (!rest.length) return nodes.filter((_, index) => index !== head);
  return nodes.map((node, index) => {
    if (index !== head) return node;
    return { ...node, children: removeNode(node.children || [], rest) };
  });
}
