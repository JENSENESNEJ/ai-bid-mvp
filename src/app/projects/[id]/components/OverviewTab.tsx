"use client";
// 项目总览标签页 —— 从原 projects/[id]/page.tsx 迁移的只读展示面板
// detail-stats / routing-budget-panel / coverage-panel / analysis-panel / blueprint-panel / capability-panel / scoring-compiler

import { useMemo } from "react";
import {
  archetypeComponentLabels,
  coverageLabels,
  lengthModeLabels,
  lengthModeMultipliers,
  routeLabels,
  type Detail,
  type LengthMode,
  type PlacementOption,
  type Requirement,
} from "./types";

export function OverviewTab({ data, risks, options, lengthMode }: {
  data: Detail;
  risks: Requirement[];
  options: PlacementOption[];
  lengthMode: LengthMode;
}) {
  const content = data.outline?.content;
  const profile = content?.projectProfile;
  const blueprint = content?.implementationBlueprint;
  const analysis = content?.projectAnalysis;
  const scoringTasks = content?.scoringTasks || [];
  const capabilityPlan = content?.capabilityPlan || [];
  const requirementRouting = content?.requirementRouting;
  const documentBudget = content?.documentBudget;
  const coverage = data.document?.coverageAudit;

  // 当前篇幅档位下的预计总页数:矩阵类章节不乘倍率,其余按档位倍率放大
  const selectedTargetPages = useMemo(
    () => Math.round(options.reduce((total, option) => {
      const brief = option.node.brief;
      const matrix = ["qualification_evidence", "commercial_response", "compliance_matrix", "technical_response_matrix"].includes(brief?.formFactor || "");
      return total + Number(brief?.pageBudget?.targetPages || 0) * (matrix ? 1 : lengthModeMultipliers[lengthMode]);
    }, 0)),
    [options, lengthMode],
  );

  // 评分任务按路由类型计数
  const routeCounts = useMemo(
    () => scoringTasks.reduce<Record<string, number>>((result, task) => {
      const route = task.routeType || "unrouted";
      result[route] = (result[route] || 0) + 1;
      return result;
    }, {}),
    [scoringTasks],
  );

  return (
    <div className="overview-tab">
      <section className="detail-stats">
        <article>
          <small>已识别招标要求</small>
          <strong>{data.requirements.length}</strong>
          <span>自动关联到大纲章节</span>
        </article>
        <article>
          <small>风险提醒</small>
          <strong>{risks.length}</strong>
          <span>不阻止继续编写</span>
        </article>
        <article>
          <small>累计模型成本</small>
          <strong>${Number(data.aiTotals.costUsd || 0).toFixed(4)}</strong>
          <span>解析、复核、大纲和正文</span>
        </article>
      </section>
      {requirementRouting && documentBudget && (
        <section className="routing-budget-panel">
          <div>
            <em>WRITING PLAN</em>
            <h2>编制预算与需求路由</h2>
            <p>每条招标要求只设一个主承载位置；参数、资格、商务和实质性条款不会混入普通方案章节。</p>
          </div>
          <div className="routing-budget-grid">
            <article>
              <small>唯一主路由</small>
              <strong>{requirementRouting.primaryAssignments || 0}/{requirementRouting.totalRequirements || 0}</strong>
              <span>平均重复 {Number(requirementRouting.averagePlacements || 0).toFixed(2)} 次</span>
            </article>
            <article>
              <small>正文／独立矩阵</small>
              <strong>{requirementRouting.narrativePlacements || 0} / {requirementRouting.virtualAssignments || 0}</strong>
              <span>技术参数等由专用矩阵承载</span>
            </article>
            <article>
              <small>{lengthModeLabels[lengthMode]}预计篇幅</small>
              <strong>{selectedTargetPages || documentBudget.targetPages || 0} 页</strong>
              <span>基础预算 {documentBudget.targetPages || 0} 页 · 当前倍率 {lengthModeMultipliers[lengthMode]}×</span>
            </article>
            <article>
              <small>重点章节</small>
              <strong>{documentBudget.highPrioritySections || 0}</strong>
              <span>共 {documentBudget.sectionCount || 0} 个末级章节</span>
            </article>
          </div>
        </section>
      )}
      {coverage && coverage.candidateItems > 0 && (
        <section className="coverage-panel">
          <div className="coverage-heading">
            <div>
              <em>REQUIREMENT COVERAGE</em>
              <h2>招标要求覆盖率审计</h2>
            </div>
            <strong>{coverage.coverageRate}%</strong>
          </div>
          <p>候选要求 {coverage.candidateItems} 项 · 已建立响应 {coverage.coveredItems} 项 · 疑似遗漏 {coverage.possibleMissing} 项</p>
          <div className="coverage-grid">
            {Object.entries(coverage.categories || {}).map(([category, item]) => (
              <article key={category}>
                <span>{coverageLabels[category] || category}</span>
                <b>{item.coverageRate}%</b>
                <small>已覆盖 {item.coveredItems}/{item.candidateItems}{item.possibleMissing ? ` · 待核查 ${item.possibleMissing}` : ""}</small>
              </article>
            ))}
          </div>
          {coverage.missingSamples?.length ? (
            <details className="coverage-missing">
              <summary>查看疑似遗漏位置</summary>
              <ul>
                {coverage.missingSamples.slice(0, 12).map((item, index) => (
                  <li key={`${item.category}-${item.page}-${index}`}>
                    <b>{coverageLabels[item.category] || item.category}</b>
                    {item.page ? ` · 第 ${item.page} 页` : ""} · 可能遗漏 {item.possibleMissing} 项
                    <span>{item.sample}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      )}
      {analysis && (
        <section className="analysis-panel">
          <div className="blueprint-heading">
            <div>
              <em>PROJECT BATTLE MAP</em>
              <h2>项目作战图</h2>
            </div>
            <span>{analysis.deliveryArchetypeLabel || profile?.projectType || "待识别"}</span>
          </div>
          {analysis.archetypeComponents?.length && analysis.deliveryArchetype === "mixed" ? (
            <div className="archetype-components">组成：{analysis.archetypeComponents.map(item => archetypeComponentLabels[item] || item).join(" + ")}</div>
          ) : null}
          <div className="analysis-grid">
            <article>
              <h3>采购／服务对象</h3>
              <ul>{(analysis.procurementObjects || []).slice(0, 6).map((item, index) => <li key={index}>{item}</li>)}</ul>
            </article>
            <article>
              <h3>验收／评价对象</h3>
              <ul>{(analysis.acceptanceObjects || []).slice(0, 6).map((item, index) => <li key={index}>{item}</li>)}</ul>
            </article>
            <article>
              <h3>专业领域信号</h3>
              <div className="analysis-tags">{(analysis.domainSignals || []).slice(0, 10).map((item, index) => <span key={index}>{item}</span>)}</div>
            </article>
            <article>
              <h3>需要企业补充</h3>
              <ul>{(analysis.enterpriseInputsNeeded || []).slice(0, 6).map((item, index) => <li key={index}>{item}</li>)}</ul>
            </article>
          </div>
          {analysis.knowledgeGaps?.length ? (
            <p className="knowledge-gap"><b>当前知识缺口：</b>{analysis.knowledgeGaps.slice(0, 5).join("；")}</p>
          ) : null}
        </section>
      )}
      {profile && blueprint && (
        <section className="blueprint-panel">
          <div className="blueprint-heading">
            <div>
              <em>PROJECT BLUEPRINT</em>
              <h2>项目实施蓝图</h2>
            </div>
            <span>{profile.projectType || blueprint.templateName || "综合项目实施"}</span>
          </div>
          <p>系统先规划完整实施流程，再为每个章节生成写作任务卡，正文将沿用同一套阶段、角色、交付物和质量关卡。</p>
          <div className="blueprint-phases">
            {(blueprint.phases || []).map((phase, index) => (
              <article key={`${phase.name}-${index}`}>
                <b>{index + 1}</b>
                <div>
                  <h3>{phase.name}</h3>
                  {phase.objective && <p>{phase.objective}</p>}
                  {phase.outputs?.length ? <small>输出：{phase.outputs.slice(0, 2).join("、")}</small> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {capabilityPlan.length > 0 && (
        <section className="capability-panel">
          <div className="outline-heading">
            <div>
              <em>CAPABILITY REGISTRY</em>
              <h2>本项目启用的通用能力模块</h2>
            </div>
            <p>{capabilityPlan.length} 个模块 · 按项目作战图动态组合</p>
          </div>
          <div className="capability-grid">
            {capabilityPlan.map(module => (
              <article key={module.id}>
                <h3>{module.name}</h3>
                {module.methodPattern && <p>{module.methodPattern}</p>}
                {module.suggestedArtifacts?.length ? <small>建议成果：{module.suggestedArtifacts.join("、")}</small> : null}
              </article>
            ))}
          </div>
        </section>
      )}
      {scoringTasks.length > 0 && (
        <details className="scoring-compiler" open>
          <summary>评分任务编译结果 · {scoringTasks.length} 项</summary>
          <div className="route-summary">
            {Object.entries(routeCounts).map(([route, count]) => (
              <span className={`route-${route}`} key={route}>{routeLabels[route] || route} {count}</span>
            ))}
          </div>
          <div className="scoring-task-grid">
            {scoringTasks.slice(0, 12).map(task => (
              <article key={task.requirementId}>
                <div className="task-title">
                  <h3>{task.title}</h3>
                  <span className={`route-${task.routeType || "unrouted"}`}>{task.routeLabel || routeLabels[task.routeType || ""] || "待路由"}</span>
                </div>
                {task.responseObjective && <p>{task.responseObjective}</p>}
                {task.mustCover?.length ? <small><b>必须覆盖：</b>{task.mustCover.slice(0, 3).join("；")}</small> : null}
                {task.suggestedArtifacts?.length ? <small><b>建议成果：</b>{task.suggestedArtifacts.join("、")}</small> : null}
                {task.enterpriseInputsNeeded?.length ? <small className="needs-input"><b>待补企业资料：</b>{task.enterpriseInputsNeeded.join("、")}</small> : null}
              </article>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
