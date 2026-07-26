"use client";
// 大纲标签页 —— 从原 projects/[id]/page.tsx 迁出
// 顶部工具条(原 381 行 outline 相关按钮) + outline-panel(原 382 行) + OutlineItem(原 156-186 行, summary 模式适配)

import { memo } from "react";
import { typeLabels } from "./types";
import type { OutlineContent, OutlineNode, Requirement } from "./types";
import { QualityAuditView } from "./utils";

type OutlineItemProps = {
  node: OutlineNode;
  path: number[];
  requirements: Map<string, Requirement>;
  editing: boolean;
  onUpdate: (path: number[], node: OutlineNode) => void;
  onDelete: (path: number[]) => void;
  onAdd: (path: number[]) => void;
  onGenerate: (path: number[]) => void;
  onCompare: (path: number[]) => void;
  onOpenChapter: (path: number[]) => void;
};

const OutlineItem = memo(OutlineItemBase);

function OutlineItemBase({ node, path, requirements, editing, onUpdate, onDelete, onAdd, onGenerate, onCompare, onOpenChapter }: OutlineItemProps) {
  const linked = (node.requirementIds || []).map(id => requirements.get(id)).filter(Boolean) as Requirement[];
  const risk = linked.filter(item => item.aiReviewStatus === "needs_review" || item.aiReviewStatus === "rejected").length;
  const deepseekVariant = node.comparisonVariants?.["deepseek-v4-pro"];
  const gptVariant = node.comparisonVariants?.["gpt-5.5"];
  const comparisonRunning = deepseekVariant?.status === "generating" || gptVariant?.status === "generating";
  return (
    <li className={`outline-node level-${path.length}`}>
      <div className="outline-line">
        <span className="outline-number">{path.map(x => x + 1).join(".")}</span>
        <div className="outline-copy">
          {editing ? (
            <>
              <input value={node.title} onChange={event => onUpdate(path, { ...node, title: event.target.value })} />
              <textarea value={node.description || ""} onChange={event => onUpdate(path, { ...node, description: event.target.value })} />
            </>
          ) : (
            <>
              <h3>{node.title}</h3>
              {node.description && <p>{node.description}</p>}
            </>
          )}
        </div>
        <small>
          {linked.length ? `响应 ${linked.length} 项要求` : "结构章节"}
          {risk ? ` · ${risk} 项提醒` : ""}
          {node.generationModel ? ` · ${node.generationModel.startsWith("gpt-") ? "GPT" : "DeepSeek"}` : ""}
        </small>
      </div>
      {linked.length > 0 && (
        <div className="linked-reqs">
          {linked.slice(0, 4).map(item => <span key={item.id}>{typeLabels[item.type] || item.type} · {item.title}</span>)}
          {linked.length > 4 && <span>另 {linked.length - 4} 项</span>}
        </div>
      )}
      <div className="node-actions">
        {editing && (
          <>
            <button onClick={() => onAdd(path)}>添加子章节</button>
            <button className="danger" onClick={() => onDelete(path)}>删除</button>
          </>
        )}
        <button
          className="generate-section"
          disabled={node.contentStatus === "generating" || node.contentStatus === "retrying"}
          onClick={() => onGenerate(path)}
        >
          {node.contentStatus === "generating"
            ? "正文生成中…"
            : node.contentStatus === "retrying"
              ? "等待自动重试…"
              : node.contentStatus === "failed"
                ? "重试 AI 深度生成"
                : node.hasContent
                  ? "重新生成正文"
                  : "生成本章正文"}
        </button>
        {node.hasContent && (
          <button className="compare-models" disabled={comparisonRunning} onClick={() => onCompare(path)}>
            {comparisonRunning
              ? "模型对比生成中…"
              : deepseekVariant?.status === "ready" && gptVariant?.status === "ready"
                ? "重新对比 DeepSeek / GPT"
                : "对比 DeepSeek / GPT"}
          </button>
        )}
      </div>
      {node.contentStatus === "generating" && <div className="section-loading">正在根据本章关联的招标要求生成初稿，页面会自动刷新。</div>}
      {node.contentStatus === "retrying" && <div className="section-loading">模型上游暂时不可用，系统已自动排队重试，无需重复点击。</div>}
      {node.contentStatus === "failed" && <div className="section-loading">模型通道暂时不可用，原有内容已保留，可稍后点击重试。</div>}
      {node.hasContent && (
        <>
          <div className="section-content-summary">
            已生成正文 {node.contentChars} 字<button onClick={() => onOpenChapter(path)}>在章节正文页查看</button>
          </div>
          <QualityAuditView audit={node.qualityAudit} compact />
        </>
      )}
      {(deepseekVariant || gptVariant) && (
        <div className="model-comparison">
          <h4>同一章节、同一项目资料的模型对比</h4>
          <div>
            {([["deepseek-v4-pro", "DeepSeek"], ["gpt-5.5", "GPT-5.5"]] as const).map(([key, label]) => {
              const item = node.comparisonVariants?.[key];
              return (
                <article key={key}>
                  <header>
                    <b>{label}</b>
                    {item?.status === "ready"
                      ? <span>${Number(item.costUsd || 0).toFixed(4)} · 输入 {item.inputTokens || 0} · 输出 {item.outputTokens || 0} · {Math.round((item.durationMs || 0) / 1000)}秒</span>
                      : <span>{item?.status === "failed" ? item.errorMessage || "生成失败" : "正在生成…"}</span>}
                  </header>
                </article>
              );
            })}
          </div>
          {(deepseekVariant?.status === "ready" || gptVariant?.status === "ready") && (
            <button onClick={() => onOpenChapter(path)}>在章节正文页对比查看</button>
          )}
        </div>
      )}
      {node.children?.length > 0 && (
        <ol>
          {node.children.map((child, index) => (
            <OutlineItem
              key={`${path.join("-")}-${index}`}
              node={child}
              path={[...path, index]}
              requirements={requirements}
              editing={editing}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAdd={onAdd}
              onGenerate={onGenerate}
              onCompare={onCompare}
              onOpenChapter={onOpenChapter}
            />
          ))}
        </ol>
      )}
    </li>
  );
}

export function OutlineTab({ outline, draft, editing, busy, generating, progress, reqMap, onUpdate, onDelete, onAddChild, onAddTop, onStartEdit, onSave, onGenerateSection, onCompareSection, onOpenChapter }: {
  outline?: { content: OutlineContent; status: string; version: number; updatedAt?: string };
  draft: OutlineNode[];
  editing: boolean;
  busy: boolean;
  generating: boolean;
  progress: number;
  reqMap: Map<string, Requirement>;
  onUpdate: (path: number[], node: OutlineNode) => void;
  onDelete: (path: number[]) => void;
  onAddChild: (path: number[]) => void;
  onAddTop: () => void;
  onStartEdit: () => void;
  onSave: () => void;
  onGenerateSection: (path: number[]) => void;
  onCompareSection: (path: number[]) => void;
  onOpenChapter: (path: number[]) => void;
}) {
  const specificityAudit = outline?.content?.outlineSpecificityAudit;
  return (
    <>
      {draft.length > 0 && (
        <div className="main-tabs">
          {editing ? (
            <button className="save-outline" disabled={busy} onClick={onSave}>{busy ? "保存中…" : "保存大纲"}</button>
          ) : (
            <button className="edit-outline" onClick={onStartEdit}>编辑大纲</button>
          )}
          <button className="add-top" onClick={onAddTop}>添加一级章节</button>
        </div>
      )}
      <section className="outline-panel">
        {generating ? (
          <div className="outline-loading">
            <b style={{ width: `${progress}%` }} />
            <h2>GPT正在分析项目对象并逐章深化目录</h2>
            <p>进度包含项目语义发现和各一级章节的独立扩展。</p>
          </div>
        ) : (
          <>
            <div className="outline-heading">
              <div>
                <em>DOCUMENT STRUCTURE</em>
                <h2>项目专属投标文件目录</h2>
              </div>
              <p>第 {outline?.version || 1} 版 · {specificityAudit ? `标题唯一率 ${specificityAudit.titleUniquenessRate || 0}% · 原文绑定 ${specificityAudit.sourceBindingRate || 0}% · 叶子章节 ${specificityAudit.leafCount || 0}` : editing ? "编辑完成后请保存" : "可按章节生成正文"}</p>
            </div>
            <ol className="outline-tree">
              {draft.map((chapter, index) => (
                <OutlineItem
                  key={index}
                  node={chapter}
                  path={[index]}
                  requirements={reqMap}
                  editing={editing}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onAdd={onAddChild}
                  onGenerate={onGenerateSection}
                  onCompare={onCompareSection}
                  onOpenChapter={onOpenChapter}
                />
              ))}
            </ol>
          </>
        )}
      </section>
    </>
  );
}
