"use client";
// 智能插图标签页 —— 从原 projects/[id]/page.tsx 的 artifact-panel(340–361 行)迁出
// 动作逻辑自包含:生成插图 / 单张效果图 / 插图位置保存 / GPT 三图批量队列(基于 artifacts prop 变化驱动,替代原内嵌轮询)

import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentArtifact, PlacementOption, VisualMode } from "./types";
import { autoPlacement } from "./utils";

const GPT_DIAGRAM_TYPES = ["overall_architecture", "implementation_route", "quality_closed_loop"];
const GPT_DIAGRAM_PROMPT = "横向构图，正式投标文件信息图风格，中文必须准确。";

export function ArtifactsTab({ projectId, artifacts, options, visualSettings, outlineReady, onReload, onError }: {
  projectId: string;
  artifacts: DocumentArtifact[];
  options: PlacementOption[];
  visualSettings?: { visualMode?: VisualMode; visualImageCostConfirmed?: boolean };
  outlineReady: boolean;
  onReload: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [visualMode, setVisualMode] = useState<VisualMode>(visualSettings?.visualMode ?? "diagrams");
  const [visualCostConfirmed, setVisualCostConfirmed] = useState(visualSettings?.visualImageCostConfirmed === true);
  const [imageType, setImageType] = useState("culture_wall");
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageCostConfirmed, setImageCostConfirmed] = useState(false);
  const [artifactBusy, setArtifactBusy] = useState(false);
  const [placementBusy, setPlacementBusy] = useState("");
  const [gptBatchQueue, setGptBatchQueue] = useState<string[]>([]);
  // 队首图示是否已被观察到进入生成中状态;用于区分"本次任务完成"与"上一轮遗留的 ready/failed 结果"
  const headInFlightRef = useRef(false);

  const gptBatchBusy = gptBatchQueue.length > 0;

  // 父组件的持久化视觉设置变化时同步到本地
  useEffect(() => {
    if (visualSettings?.visualMode) {
      setVisualMode(visualSettings.visualMode);
      setVisualCostConfirmed(visualSettings.visualImageCostConfirmed === true);
    }
  }, [visualSettings?.visualMode, visualSettings?.visualImageCostConfirmed]);

  async function generateArtifacts() {
    setArtifactBusy(true);
    const response = await fetch(`/api/projects/${projectId}/artifacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visualMode,
        confirmImageCost: visualMode === "diagrams" || visualCostConfirmed,
        regenerateImages: true,
      }),
    });
    const body = await response.json();
    if (!response.ok) onError(body.error || "启动图示生成失败");
    await onReload();
    setArtifactBusy(false);
  }

  async function generateEffectImage() {
    setArtifactBusy(true);
    const response = await fetch(`/api/projects/${projectId}/artifacts/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageType, userPrompt: imagePrompt, confirmCost: imageCostConfirmed }),
    });
    const body = await response.json();
    if (!response.ok) onError(body.error || "启动效果图生成失败");
    else setImageCostConfirmed(false);
    await onReload();
    setArtifactBusy(false);
  }

  async function updateArtifactPlacement(artifactId: string, value: string) {
    setPlacementBusy(artifactId);
    const targetPath = value === "auto" ? null : value.split(".").map(Number);
    const response = await fetch(`/api/projects/${projectId}/artifacts/${artifactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPath }),
    });
    const body = await response.json();
    if (!response.ok) onError(body.error || "保存插图位置失败");
    await onReload();
    setPlacementBusy("");
  }

  const postGptDiagram = useCallback(async (type: string) => {
    const response = await fetch(`/api/projects/${projectId}/artifacts/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageType: type, userPrompt: GPT_DIAGRAM_PROMPT, confirmCost: true }),
    });
    const body = await response.json();
    if (!response.ok) {
      onError(body.error || "启动 GPT 图示生成失败");
      return false;
    }
    await onReload();
    return true;
  }, [projectId, onError, onReload]);

  async function generateAllGptDiagrams() {
    headInFlightRef.current = false;
    setGptBatchQueue([...GPT_DIAGRAM_TYPES]);
    const started = await postGptDiagram(GPT_DIAGRAM_TYPES[0]);
    if (!started) setGptBatchQueue([]);
  }

  // 队列驱动:父组件轮询更新 artifacts 后,队首图示 ready/failed 时出队并推进下一张
  useEffect(() => {
    if (!gptBatchQueue.length) return;
    const head = gptBatchQueue[0];
    const current = artifacts.find(item => item.kind === head);
    const inFlight = !current || (current.status !== "ready" && current.status !== "failed");
    if (inFlight) {
      headInFlightRef.current = true;
      return;
    }
    if (!headInFlightRef.current) return; // 仍是上一轮遗留结果,等待本次任务真正开始
    if (current.status === "failed") {
      onError(`${current.title}生成失败：${current.errorMessage || "未知错误"}`);
      headInFlightRef.current = false;
      setGptBatchQueue([]);
      setImageCostConfirmed(false);
      return;
    }
    if (current.status === "ready" && current.metadata?.generator === "gpt-image-v1") {
      headInFlightRef.current = false;
      const rest = gptBatchQueue.slice(1);
      setGptBatchQueue(rest);
      if (rest.length) void postGptDiagram(rest[0]);
      else setImageCostConfirmed(false);
    }
  }, [artifacts, gptBatchQueue, onError, postGptDiagram]);

  if (!outlineReady) return <div className="tab-empty">请先生成项目大纲</div>;

  return (
    <section className="artifact-panel">
      <div className="artifact-heading">
        <div>
          <em>VISUAL ARTIFACT ENGINE</em>
          <h2>智能插图计划</h2>
          <p>系统按章节自动组合方法图、现场图和设备物资图，并随Word一并导出。</p>
        </div>
        <button
          disabled={artifactBusy || artifacts.some(item => item.status === "generating") || (visualMode !== "diagrams" && !visualCostConfirmed)}
          onClick={generateArtifacts}
        >
          {artifactBusy || artifacts.some(item => item.status === "generating") ? "图片生成中…" : artifacts.length ? "按当前模式重新生成" : "生成智能插图"}
        </button>
      </div>
      <div className="visual-mode-control">
        <label>
          <span>视觉模式</span>
          <select value={visualMode} onChange={event => { setVisualMode(event.target.value as VisualMode); setVisualCostConfirmed(false); }}>
            <option value="diagrams">仅免费图示（5–12张）</option>
            <option value="mixed">图文混合（另加约2张写实示意图）</option>
            <option value="physical_priority">实物优先（另加约3张写实示意图）</option>
          </select>
        </label>
        <p>{visualMode === "diagrams" ? "自动生成架构、流程、组织和控制类图示，不产生图片模型费用。" : visualMode === "mixed" ? "方法图配合现场作业、设备物资等写实示意图，预计图片费用不超过 $0.402。" : "提高设备、场景和完成效果图片比例，预计图片费用不超过 $0.603。"}</p>
        {visualMode !== "diagrams" ? (
          <label className="cost-confirm">
            <input type="checkbox" checked={visualCostConfirmed} onChange={event => setVisualCostConfirmed(event.target.checked)} />
            <span>我确认按此模式调用GPT图片模型。AI图片将标注为“写实示意图”，不作为品牌、库存、业绩或实物证明。</span>
          </label>
        ) : null}
      </div>
      {artifacts.length ? (
        <div className="artifact-plan-summary">
          <span>计划图片 <b>{artifacts.length}</b></span>
          <span>免费图示 <b>{artifacts.filter(item => item.metadata?.generator !== "gpt-image-v1").length}</b></span>
          <span>AI效果图 <b>{artifacts.filter(item => item.metadata?.generator === "gpt-image-v1").length}</b></span>
          <span>已就绪 <b>{artifacts.filter(item => item.status === "ready").length}</b></span>
        </div>
      ) : null}
      {artifacts.length ? (
        <div className="artifact-grid">
          {artifacts.map(item => {
            const recommended = autoPlacement(item, options);
            const manual = item.metadata?.placementMode === "manual" && item.metadata.targetPath?.length;
            const selectValue = manual ? item.metadata!.targetPath!.join(".") : "auto";
            return (
              <article key={item.id}>
                <div>
                  <h3>{item.title}</h3>
                  <small>{item.status === "ready" ? `已生成，可随 Word 一并导出${item.metadata?.actualCostUsd != null ? ` · 实际费用 $${Number(item.metadata.actualCostUsd).toFixed(3)}` : ""} · ${item.metadata?.generator === "gpt-image-v1" ? "AI效果图" : "免费图示"}` : item.status === "failed" ? item.errorMessage || "生成失败" : "正在生成，通常需要约 1 分钟"}</small>
                </div>
                {item.imageUrl ? <img src={item.imageUrl} alt={item.title} /> : <div className="artifact-placeholder">{item.status === "failed" ? "本次未生成图片" : "正在编制图示…"}</div>}
                <label className="artifact-placement">
                  <span>Word插入位置 <b>{manual ? "人工指定" : "自动推荐"}</b></span>
                  <select value={selectValue} disabled={placementBusy === item.id} onChange={event => updateArtifactPlacement(item.id, event.target.value)}>
                    <option value="auto">自动：{recommended?.label || "其他项目图示"}</option>
                    {options.map(option => (
                      <option key={option.path.join(".")} value={option.path.join(".")}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="artifact-empty">将生成总体交付架构图、项目实施路线图和全过程质量控制闭环图。</p>
      )}
      <div className="effect-image-builder">
        <div>
          <em>GPT IMAGE · 单张可控生成</em>
          <h3>生成项目效果图</h3>
          <p>适用于文化墙、建成场景和方案概念图。系统自动加入项目背景，你只需选择类型；不会自动批量生成。</p>
        </div>
        <label>
          图片类型
          <select value={imageType} onChange={event => { setImageType(event.target.value); setImageCostConfirmed(false); }}>
            <option value="culture_wall">文化墙概念效果图</option>
            <option value="project_scene">项目建成场景概念图</option>
            <option value="solution_concept">项目方案概念视觉图</option>
            <option value="overall_architecture">GPT 项目总体交付架构图</option>
            <option value="implementation_route">GPT 项目实施路线图</option>
            <option value="quality_closed_loop">GPT 全过程质量控制闭环图</option>
            <option value="custom">自定义项目效果图</option>
          </select>
        </label>
        <label>
          补充画面要求（可不填）
          <textarea value={imagePrompt} maxLength={800} onChange={event => setImagePrompt(event.target.value)} placeholder="例如：横向构图，突出培训空间，墙面预留标题和成果展示区域。" />
        </label>
        <label className="cost-confirm">
          <input type="checkbox" checked={imageCostConfirmed} onChange={event => setImageCostConfirmed(event.target.checked)} />
          <span>我确认生成本张图片。根据最新实测，预计费用约 <b>$0.201／张</b>；OAuth 图片通道会忽略低质量和固定尺寸参数。</span>
        </label>
        <button
          className="generate-effect"
          disabled={artifactBusy || gptBatchBusy || !imageCostConfirmed || artifacts.some(item => item.status === "generating")}
          onClick={generateEffectImage}
        >
          {artifacts.some(item => item.status === "generating") ? "效果图生成中…" : "生成单张效果图"}
        </button>
        <button
          className="generate-effect"
          disabled={artifactBusy || gptBatchBusy || !imageCostConfirmed || artifacts.some(item => item.status === "generating")}
          onClick={generateAllGptDiagrams}
        >
          {gptBatchBusy ? "正在逐张生成 GPT 图示…" : "一键用 GPT 重绘三张流程图（预计 $0.603）"}
        </button>
      </div>
    </section>
  );
}
