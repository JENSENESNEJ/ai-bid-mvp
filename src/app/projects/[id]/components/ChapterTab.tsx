"use client";
// 章节工作区标签页 —— 迁移自原 projects/[id]/page.tsx 的 preview-panel(原 383-399 行)
// 核心改造:大纲为 summary 模式(节点不含 content),正文通过 GET /outline/section 按需加载并缓存

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Detail,
  DocumentArtifact,
  LengthMode,
  OutlineNode,
  PlacementOption,
  SectionDetail,
  TextModelMode,
} from "./types";
import {
  formFactorLabels,
  lengthModeDescriptions,
  lengthModeLabels,
  modelModeDescriptions,
  modelModeLabels,
} from "./types";
import { PreviewContent, QualityAuditView, effectivePlacement, samePath } from "./utils";

export function ChapterTab({
  projectId,
  data,
  artifacts,
  options,
  textModelMode,
  lengthMode,
  onTextModelMode,
  onLengthMode,
  busy,
  editorBusy,
  onGenerateAll,
  onGenerateChapter,
  onEditFirstChapter,
  onError,
  focusPath,
}: {
  projectId: string;
  data: Detail;
  artifacts: DocumentArtifact[];
  options: PlacementOption[];
  textModelMode: TextModelMode;
  lengthMode: LengthMode;
  onTextModelMode: (m: TextModelMode) => void;
  onLengthMode: (m: LengthMode) => void;
  busy: boolean;
  editorBusy: boolean;
  onGenerateAll: (mode: "quick" | "deep") => void;
  onGenerateChapter: (chapterIndex: number) => void;
  onEditFirstChapter: () => void;
  onError: (msg: string) => void;
  /** 从其他标签页跳入时要定位的章节路径(如大纲页「在章节正文页查看」) */
  focusPath?: number[];
}) {
  const [selectedPath, setSelectedPath] = useState<number[]>(() => focusPath ?? options[0]?.path ?? []);
  const [cache, setCache] = useState<Record<string, { updatedAt?: string; node: OutlineNode }>>({});
  const requestedRef = useRef(new Set<string>());

  // 外部跳转定位
  useEffect(() => {
    if (focusPath?.length && options.some(option => samePath(option.path, focusPath))) {
      setSelectedPath(focusPath);
    }
  }, [focusPath, options]);

  const firstChapter = data.outline?.content?.chapters?.[0];
  const selectedPreviewIndex = Math.max(0, options.findIndex(option => samePath(option.path, selectedPath)));
  const selectedPreview: PlacementOption | undefined = options[selectedPreviewIndex];
  const key = selectedPreview ? selectedPreview.path.join(".") : "";

  const selectedPreviewArtifacts = useMemo(
    () => selectedPreview
      ? artifacts.filter(item => samePath(effectivePlacement(item, options)?.path, selectedPreview.path))
      : [],
    [artifacts, options, selectedPreview],
  );

  // 大纲结构变化后,若当前选中路径已不存在,回落到第一个末级章节
  useEffect(() => {
    if (options.length && !options.some(option => samePath(option.path, selectedPath))) {
      setSelectedPath(options[0].path);
    }
  }, [options, selectedPath]);

  // 按需加载完整章节正文:无缓存、或缓存对应的大纲版本已过期时重新拉取
  useEffect(() => {
    if (!key) return;
    const outlineUpdatedAt = data.outline?.updatedAt;
    const cached = cache[key];
    if (cached && cached.updatedAt === outlineUpdatedAt) return;
    const requestToken = `${key}@${outlineUpdatedAt ?? ""}`;
    if (requestedRef.current.has(requestToken)) return;
    requestedRef.current.add(requestToken);
    fetch(`/api/projects/${projectId}/outline/section?path=${key}`, { cache: "no-store" })
      .then(response => response.json())
      .then((body: SectionDetail & { error?: string }) => {
        if (body.error) throw new Error(body.error);
        setCache(previous => ({ ...previous, [key]: { updatedAt: body.outlineUpdatedAt, node: body.node } }));
      })
      .catch((reason: unknown) => {
        requestedRef.current.delete(requestToken);
        onError(reason instanceof Error ? reason.message : "读取本章节正文失败");
      });
  }, [key, projectId, data.outline?.updatedAt, cache, onError]);

  const fullNode = key ? cache[key]?.node : undefined;
  const showComparison = Boolean(
    fullNode?.comparisonVariants && Object.values(fullNode.comparisonVariants).some(item => item.content),
  );

  function choosePreviewChapter(path: number[]) {
    setSelectedPath(path);
    requestAnimationFrame(() => document.querySelector(".chapter-reader")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <section className="preview-panel">
      <div className="preview-toolbar">
        <div>
          <em>FULL DOCUMENT</em>
          <h2>投标文件章节工作区</h2>
          <p>从左侧选择章节，右侧查看正文、质量评分和最终插图；网页预览与Word导出使用同一套插图位置。</p>
        </div>
        <div className="generation-controls">
          <label className="model-mode-control">
            <span>正文生成模式</span>
            <select value={textModelMode} disabled={busy} onChange={event => onTextModelMode(event.target.value as TextModelMode)}>
              <option value="deepseek">DeepSeek 全文</option>
              <option value="gpt">GPT 全文</option>
              <option value="mixed">智能混合</option>
            </select>
            <small>{modelModeDescriptions[textModelMode]}</small>
          </label>
          <label className="model-mode-control">
            <span>正文篇幅档位</span>
            <select value={lengthMode} disabled={busy} onChange={event => onLengthMode(event.target.value as LengthMode)}>
              <option value="standard">标准稿</option>
              <option value="detailed">深度稿</option>
              <option value="extended">超长稿</option>
              <option value="xique">喜鹊长篇</option>
            </select>
            <small>{lengthModeDescriptions[lengthMode]}</small>
          </label>
          <button className="quick-generate" disabled={busy} onClick={() => onGenerateAll("quick")}>快速生成响应骨架</button>
          <button
            className="quick-generate"
            disabled={busy || !selectedPreview}
            onClick={() => {
              const chapterIndex = selectedPreview?.path?.[0];
              if (chapterIndex !== undefined) onGenerateChapter(chapterIndex);
            }}
          >
            {busy ? "正在加入生成队列…" : `只生成第 ${(selectedPreview?.path?.[0] ?? 0) + 1} 章`}
          </button>
          <button className="primary" disabled={busy} onClick={() => onGenerateAll("deep")}>
            {busy ? "正在加入生成队列…" : `用${modelModeLabels[textModelMode]}生成全文`}
          </button>
          <button
            className="quick-generate"
            disabled={busy || editorBusy || firstChapter?.editorStatus === "queued" || firstChapter?.editorStatus === "editing"}
            onClick={onEditFirstChapter}
          >
            {firstChapter?.editorStatus === "queued" || firstChapter?.editorStatus === "editing"
              ? `第一章总编中 ${firstChapter.editorProgress || 0}%`
              : "总编第一章样板"}
          </button>
        </div>
      </div>
      <div className="bid-workspace">
        <aside className="chapter-navigator">
          <div>
            <em>DOCUMENT OUTLINE</em>
            <h3>选择章节</h3>
            <span>{selectedPreviewIndex + 1}/{options.length}</span>
          </div>
          <nav>
            {(data.outline?.content?.chapters || []).map((chapter, chapterIndex) => {
              const chapterOptions = options.filter(option => option.path[0] === chapterIndex);
              return (
                <section key={chapterIndex}>
                  <h4>{chapterIndex + 1} {chapter.title}</h4>
                  {chapterOptions.map(option => (
                    <button
                      key={option.path.join(".")}
                      className={samePath(option.path, selectedPreview?.path) ? "active" : ""}
                      onClick={() => choosePreviewChapter(option.path)}
                    >
                      <i className={option.node.contentStatus === "ready" ? "ready" : option.node.contentStatus === "generating" || option.node.contentStatus === "retrying" ? "working" : ""} />
                      <span>{option.path.map(value => value + 1).join(".")} {option.title}</span>
                      {artifacts.some(item => samePath(effectivePlacement(item, options)?.path, option.path)) ? <b>有图</b> : null}
                    </button>
                  ))}
                </section>
              );
            })}
          </nav>
        </aside>
        <article className="chapter-reader">
          {selectedPreview ? (
            <>
              {selectedPreview.node.contentStatus === "generating" && <div className="section-loading">正在根据本章关联的招标要求生成初稿，页面会自动刷新。</div>}
              {selectedPreview.node.contentStatus === "retrying" && <div className="section-loading">模型上游暂时不可用，系统已自动排队重试，无需重复点击。</div>}
              {fullNode ? (
                <>
                  <header>
                    <div>
                      <em>CHAPTER {selectedPreview.path.map(value => value + 1).join(".")}</em>
                      <h1>{selectedPreview.title}</h1>
                      {fullNode.brief?.pageBudget && (
                        <small className="section-budget">
                          基础目标 {fullNode.brief.pageBudget.targetPages} 页 · 本次 {lengthModeLabels[fullNode.lengthMode || lengthMode]}
                          {fullNode.generationPasses ? ` ${fullNode.generationPasses}轮` : ""}
                          {fullNode.generationCheckpoint ? ` · 已保存组件 ${fullNode.generationCheckpoint.components?.length || 0}/${fullNode.generationCheckpoint.componentCount || 0}` : ""}
                          {" "}· 承载 {fullNode.requirementIds?.length || 0} 条要求 · {formFactorLabels[fullNode.brief.formFactor || ""] || "专业正文"}
                        </small>
                      )}
                    </div>
                    <QualityAuditView audit={fullNode.qualityAudit} compact />
                  </header>
                  <PreviewContent text={fullNode.content} title={selectedPreview.title} />
                  {selectedPreviewArtifacts.length ? (
                    <div className="inline-figures">
                      {selectedPreviewArtifacts.map((item, index) => (
                        <figure key={item.id}>
                          {item.imageUrl ? <img src={item.imageUrl} alt={item.title} /> : <div className="figure-waiting">图片正在生成</div>}
                          <figcaption>图 {index + 1}　{item.title}</figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : null}
                  {showComparison && (
                    <div className="model-comparison">
                      <h4>同一章节、同一项目资料的模型对比</h4>
                      <div>
                        {([["deepseek-v4-pro", "DeepSeek"], ["gpt-5.5", "GPT-5.5"]] as const).map(([variantKey, label]) => {
                          const item = fullNode.comparisonVariants?.[variantKey];
                          return (
                            <article key={variantKey}>
                              <header>
                                <b>{label}</b>
                                {item?.status === "ready"
                                  ? <span>${Number(item.costUsd || 0).toFixed(4)} · 输入 {item.inputTokens || 0} · 输出 {item.outputTokens || 0} · {Math.round((item.durationMs || 0) / 1000)}秒</span>
                                  : <span>{item?.status === "failed" ? item.errorMessage || "生成失败" : "正在生成…"}</span>}
                              </header>
                              {item?.content ? <><QualityAuditView audit={item.qualityAudit} compact /><pre>{item.content}</pre></> : null}
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <footer>
                    <button disabled={selectedPreviewIndex <= 0} onClick={() => choosePreviewChapter(options[selectedPreviewIndex - 1].path)}>← 上一章</button>
                    <span>{selectedPreview.label}</span>
                    <button disabled={selectedPreviewIndex >= options.length - 1} onClick={() => choosePreviewChapter(options[selectedPreviewIndex + 1].path)}>下一章 →</button>
                  </footer>
                </>
              ) : (
                <p className="preview-missing">正在读取本章节正文…</p>
              )}
            </>
          ) : (
            <p className="preview-missing">大纲中暂无可预览的末级章节。</p>
          )}
        </article>
      </div>
    </section>
  );
}
