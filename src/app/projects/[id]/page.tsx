"use client";
// 项目详情页 —— 多标签工作台重构版
// 职责收缩为:数据加载 + 条件轮询 + 顶部操作区 + 标签路由;各面板逻辑在 components/ 下
import "../../audit.css";
import "../../preview.css";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Detail, ExportInfo, LengthMode, OutlineNode, TabKey, TextModelMode } from "./components/types";
import { emptyNode, modelModeLabels } from "./components/types";
import { changeNode, placementOptions, removeNode } from "./components/utils";
import { OverviewTab } from "./components/OverviewTab";
import { OutlineTab } from "./components/OutlineTab";
import { ChapterTab } from "./components/ChapterTab";
import { ParametersTab } from "./components/ParametersTab";
import { ArtifactsTab } from "./components/ArtifactsTab";
import { RisksTab } from "./components/RisksTab";
import type { DocumentArtifact } from "./components/types";

const ACTIVE_PROJECT_STATUS = ["uploaded", "parsing", "extracting", "outlining"];

function anyNodeWorking(nodes: OutlineNode[]): boolean {
  return nodes.some(node =>
    node.contentStatus === "generating"
    || node.contentStatus === "retrying"
    || node.editorStatus === "queued"
    || node.editorStatus === "editing"
    || anyNodeWorking(node.children || []));
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabKey>("overview");
  const [chapterFocus, setChapterFocus] = useState<number[] | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState<OutlineNode[]>([]);
  const [exportInfo, setExportInfo] = useState<ExportInfo>(null);
  const [artifacts, setArtifacts] = useState<DocumentArtifact[]>([]);
  const [textModelMode, setTextModelMode] = useState<TextModelMode>("gpt");
  const [lengthMode, setLengthMode] = useState<LengthMode>("detailed");
  const [editorBusy, setEditorBusy] = useState(false);
  const stampRef = useRef("");

  // 秒开:先渲染本会话缓存的旧数据,网络返回后静默替换
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(`bid:detail:${id}`);
      if (cached) setData(JSON.parse(cached));
    } catch {}
  }, [id]);

  const load = useCallback((force = false) =>
    fetch(`/api/projects/${id}`, { cache: "no-store" })
      .then(response => {
        if (response.status === 401) { window.location.replace("/login"); throw new Error("unauthenticated"); }
        return response.json();
      })
      .then(value => {
        if (value.error) throw new Error(value.error);
        // 数据未变化时跳过 setData,避免整页无谓重渲染
        const stamp = `${value.project?.updatedAt}|${value.outline?.updatedAt}|${value.outline?.version}`;
        if (!force && stamp === stampRef.current) return;
        stampRef.current = stamp;
        setData(value);
        setError("");
        try { sessionStorage.setItem(`bid:detail:${id}`, JSON.stringify(value)); } catch {}
      })
      .catch(reason => setError(reason.message)), [id]);
  const loadExport = useCallback(() =>
    fetch(`/api/projects/${id}/export`, { cache: "no-store" })
      .then(response => response.json())
      .then(value => setExportInfo(value.export || null))
      .catch(() => {}), [id]);
  const loadArtifacts = useCallback(() =>
    fetch(`/api/projects/${id}/artifacts`, { cache: "no-store" })
      .then(response => response.json())
      .then(value => setArtifacts(value.artifacts || []))
      .catch(() => {}), [id]);
  const refresh = useCallback(async () => { await Promise.all([load(true), loadExport(), loadArtifacts()]); }, [load, loadExport, loadArtifacts]);

  // 是否有活跃任务:决定要不要轮询(空闲时不轮询,靠手动刷新)
  const active = useMemo(() => {
    if (!data) return true;
    if (ACTIVE_PROJECT_STATUS.includes(data.project.status)) return true;
    if (data.outline?.status === "generating") return true;
    if (anyNodeWorking(data.outline?.content?.chapters || [])) return true;
    if (exportInfo?.status === "queued" || exportInfo?.status === "running") return true;
    if (artifacts.some(item => item.status === "generating")) return true;
    return false;
  }, [data, exportInfo, artifacts]);

  useEffect(() => { load(); loadExport(); loadArtifacts(); }, [load, loadExport, loadArtifacts]);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => { load(); loadExport(); loadArtifacts(); }, 5000);
    return () => clearInterval(timer);
  }, [active, load, loadExport, loadArtifacts]);

  // 大纲草稿:未编辑时跟随服务端数据(summary 树不可变,直接引用)
  useEffect(() => {
    if (!dirty) setDraft(data?.outline?.content?.chapters || []);
  }, [data?.outline?.updatedAt, data?.outline?.status, data?.outline?.content?.chapters, dirty]);
  useEffect(() => {
    const saved = data?.outline?.content?.generationSettings?.textModelMode;
    if (saved) setTextModelMode(saved);
  }, [data?.outline?.content?.generationSettings?.textModelMode]);
  useEffect(() => {
    const saved = data?.outline?.content?.generationSettings?.lengthMode;
    if (saved) setLengthMode(saved);
  }, [data?.outline?.content?.generationSettings?.lengthMode]);

  const reqMap = useMemo(() => new Map((data?.requirements || []).map(item => [item.id, item])), [data]);
  const risks = useMemo(() => (data?.requirements || []).filter(item => item.aiReviewStatus === "needs_review" || item.aiReviewStatus === "rejected"), [data]);
  const options = useMemo(() => placementOptions(data?.outline?.content?.chapters || []), [data?.outline?.content?.chapters]);
  const totalChars = useMemo(() => options.reduce((sum, option) => sum + (option.node.contentChars || 0), 0), [options]);
  const generationProgress = useMemo(() => {
    const nodes = options.map(option => option.node);
    const completed = nodes.filter(node => node.contentStatus === "ready" && Boolean(node.generationModel)).length;
    const working = nodes.filter(node => node.contentStatus === "generating" || node.contentStatus === "retrying").length;
    const failed = nodes.filter(node => node.contentStatus === "failed").length;
    const componentTotal = nodes.reduce((sum, node) => sum + Number(node.generationCheckpoint?.componentCount || 0), 0);
    const componentCompleted = nodes.reduce((sum, node) => sum + (node.generationCheckpoint?.components || []).filter(item => item.status === "ready").length, 0);
    const total = nodes.length;
    return { total, completed, working, failed, componentTotal, componentCompleted, started: completed + working + failed > 0, percent: total ? Math.round(completed / total * 100) : 0 };
  }, [options]);

  async function generateOutline(outlineMode: "standard" | "xique" | "dynamic" = "dynamic") {
    setBusy(true);
    const response = await fetch(`/api/projects/${id}/outline`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outlineMode }) });
    const body = await response.json();
    if (!response.ok) setError(body.error || "启动大纲生成失败");
    else {
      setError("");
      if (outlineMode === "xique" || outlineMode === "dynamic") setLengthMode("xique");
      if (outlineMode === "dynamic") setTextModelMode("gpt");
    }
    await load(true);
    setBusy(false);
    setTab("outline");
  }

  async function saveOutline() {
    if (!draft.length) { setError("大纲至少保留一个章节"); return false; }
    setBusy(true);
    const response = await fetch(`/api/projects/${id}/outline`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chapters: draft, baseVersion: data?.outline?.version }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error || "保存失败"); setBusy(false); return false; }
    setDirty(false);
    setEditing(false);
    await load(true);
    setBusy(false);
    return true;
  }

  function update(path: number[], node: OutlineNode) { setDraft(value => changeNode(value, path, () => node)); setDirty(true); }
  function addChild(path: number[]) { setDraft(value => changeNode(value, path, node => ({ ...node, children: [...(node.children || []), emptyNode()] }))); setDirty(true); }
  function deleteAt(path: number[]) { setDraft(value => removeNode(value, path)); setDirty(true); }
  function addTop() { setDraft(value => [...value, emptyNode()]); setEditing(true); setDirty(true); }

  async function generateSection(path: number[]) {
    if (dirty && !(await saveOutline())) return;
    const response = await fetch(`/api/projects/${id}/outline/section`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, modelMode: textModelMode, lengthMode }) });
    const body = await response.json();
    if (!response.ok) setError(body.error || "启动正文生成失败");
    await load(true);
  }

  async function compareSection(path: number[]) {
    if (dirty && !(await saveOutline())) return;
    setBusy(true);
    for (const model of ["deepseek-v4-pro", "gpt-5.5"]) {
      const response = await fetch(`/api/projects/${id}/outline/section/compare`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, model }) });
      const body = await response.json();
      if (!response.ok) { setError(body.error || `启动 ${model} 对比失败`); break; }
    }
    await load(true);
    setBusy(false);
  }

  async function generateAll(mode: "quick" | "deep") {
    if (dirty && !(await saveOutline())) return;
    setBusy(true);
    const response = await fetch(`/api/projects/${id}/outline/sections`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, modelMode: textModelMode, lengthMode, regenerate: mode === "deep" }) });
    const body = await response.json();
    if (!response.ok) setError(body.error || "批量生成失败");
    else setError("");
    await load(true);
    setBusy(false);
    setTab("chapter");
  }

  async function generateChapter(chapterIndex: number) {
    if (dirty && !(await saveOutline())) return;
    setBusy(true);
    const response = await fetch(`/api/projects/${id}/outline/sections`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "deep", modelMode: textModelMode, lengthMode, regenerate: true, chapterIndex }) });
    const body = await response.json();
    if (!response.ok) setError(body.error || "启动当前章生成失败");
    else setError("");
    await load(true);
    setBusy(false);
  }

  async function editFirstChapter() {
    if (dirty && !(await saveOutline())) return;
    setEditorBusy(true);
    const response = await fetch(`/api/projects/${id}/outline/editor`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chapterIndex: 0 }) });
    const body = await response.json();
    if (!response.ok) setError(body.error || "启动章节总编失败");
    else setError("");
    await load(true);
    setEditorBusy(false);
  }

  async function exportWord() {
    setBusy(true);
    const response = await fetch(`/api/projects/${id}/export`, { method: "POST" });
    const body = await response.json();
    if (!response.ok) setError(body.error || "启动Word导出失败");
    await loadExport();
    setBusy(false);
  }

  function openChapter(path: number[]) {
    setChapterFocus(path);
    setTab("chapter");
  }

  if (error && !data) return <main className="detail-shell"><Link href="/">← 返回工作台</Link><p className="error">{error}</p></main>;
  if (!data) return (
    <main className="detail-shell">
      <div className="load-stage">
        <div className="load-card">
          <div className="load-logo">标</div>
          <div className="load-doc"><i /><i /><i /><i /><i /></div>
          <div className="load-bar"><i /></div>
          <p>卷宗调取中</p>
        </div>
      </div>
    </main>
  );

  const generating = data.project.status === "outlining" || data.outline?.status === "generating";
  const outlineReady = data.outline?.status === "ready";
  const dynamicGenerating = generating && data.outline?.content?.generationSettings?.outlineMode === "dynamic";
  const exportWorking = exportInfo?.status === "queued" || exportInfo?.status === "running";

  return (
    <main className="detail-shell">
      <div className="detail-top">
        <Link className="back-pill" href="/" title="返回项目工作台">←</Link>
        <div className="headline">
          <h1 title={data.project.name}>{data.project.name}</h1>
          <p>{data.project.fileName}{totalChars > 0 ? ` · 全卷约 ${(totalChars / 10000).toFixed(1)} 万字` : ""}</p>
        </div>
        <label className={`status-pill ${generating ? "auditing" : "confirmed"}`}>{generating ? `正在生成大纲 ${data.project.progress}%` : "大纲已就绪"}</label>
        <div className="detail-actions">
          <button disabled={busy || generating} onClick={() => generateOutline("dynamic")}>{dynamicGenerating ? "GPT正在发现项目结构…" : "生成GPT目录"}</button>
          <button className="secondary" disabled={busy || generating} onClick={() => generateOutline("standard")}>标准目录</button>
          {exportInfo?.status === "ready"
            ? <a href={`/api/projects/${id}/export/download`}>下载Word</a>
            : <button className="secondary" disabled={busy || exportWorking} onClick={exportWord}>{exportWorking ? "Word生成中…" : "导出Word"}</button>}
          <button className="ghost-refresh" onClick={refresh}>刷新</button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {exportInfo?.status === "failed" && <p className="error">{exportInfo.errorMessage}</p>}
      {generationProgress.started && (
        <div className={`document-generation-progress ${generationProgress.failed ? "has-failures" : ""}`}>
          <div>
            <span><b>{modelModeLabels[data.outline?.content?.generationSettings?.textModelMode || textModelMode]}</b>{generationProgress.working ? `正在逐章生成，剩余 ${generationProgress.total - generationProgress.completed - generationProgress.failed} 章` : "本轮正文生成完成"}</span>
            <strong>{generationProgress.completed}/{generationProgress.total} · {generationProgress.percent}%</strong>
          </div>
          <div className="generation-progress-track"><i style={{ width: `${generationProgress.percent}%` }} /></div>
          <small>已完成 {generationProgress.completed} 章{generationProgress.working ? ` · 生成或排队中 ${generationProgress.working} 章` : ""}{generationProgress.componentTotal ? ` · 当前章节组件 ${generationProgress.componentCompleted}/${generationProgress.componentTotal}` : ""}{generationProgress.failed ? ` · 失败 ${generationProgress.failed} 章` : ""}；已完成组件会自动保存，临时失败后只补未完成部分。</small>
        </div>
      )}
      <div className="detail-tabs">
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>总览</button>
        <button className={tab === "outline" ? "active" : ""} onClick={() => setTab("outline")}>大纲</button>
        <button className={tab === "chapter" ? "active" : ""} onClick={() => setTab("chapter")}>章节正文</button>
        <button className={tab === "parameters" ? "active" : ""} onClick={() => setTab("parameters")}>参数矩阵{data.parameterSummary?.total ? ` (${data.parameterSummary.total})` : ""}</button>
        <button className={tab === "artifacts" ? "active" : ""} onClick={() => setTab("artifacts")}>插图{artifacts.length ? ` (${artifacts.length})` : ""}</button>
        <button className={tab === "risks" ? "active risk" : ""} onClick={() => setTab("risks")}>风险提醒{risks.length ? ` (${risks.length})` : ""}</button>
      </div>
      {tab === "overview" && <OverviewTab data={data} risks={risks} options={options} lengthMode={lengthMode} />}
      {tab === "outline" && (draft.length || generating
        ? <OutlineTab
            outline={data.outline}
            draft={draft}
            editing={editing}
            busy={busy}
            generating={generating}
            progress={data.project.progress}
            reqMap={reqMap}
            onUpdate={update}
            onDelete={deleteAt}
            onAddChild={addChild}
            onAddTop={addTop}
            onStartEdit={() => setEditing(true)}
            onSave={saveOutline}
            onGenerateSection={generateSection}
            onCompareSection={compareSection}
            onOpenChapter={openChapter}
          />
        : <section className="outline-panel">
            <div className="outline-empty">
              <h2>招标文件解析完成</h2>
              <p>使用GPT先发现本项目对象、场景和工作流，再生成项目专属目录。</p>
              <button onClick={() => generateOutline("dynamic")}>生成GPT项目专属目录</button>
            </div>
          </section>)}
      {tab === "chapter" && (
        <ChapterTab
          projectId={id}
          data={data}
          artifacts={artifacts}
          options={options}
          textModelMode={textModelMode}
          lengthMode={lengthMode}
          onTextModelMode={setTextModelMode}
          onLengthMode={setLengthMode}
          busy={busy}
          editorBusy={editorBusy}
          onGenerateAll={generateAll}
          onGenerateChapter={generateChapter}
          onEditFirstChapter={editFirstChapter}
          onGenerateSection={generateSection}
          onCompareSection={compareSection}
          onError={setError}
          focusPath={chapterFocus}
        />
      )}
      {tab === "parameters" && <ParametersTab projectId={id} summary={data.parameterSummary} />}
      {tab === "artifacts" && (
        <ArtifactsTab
          projectId={id}
          artifacts={artifacts}
          options={options}
          visualSettings={data.outline?.content?.generationSettings}
          outlineReady={outlineReady}
          onReload={refresh}
          onError={setError}
        />
      )}
      {tab === "risks" && <RisksTab risks={risks} />}
    </main>
  );
}
