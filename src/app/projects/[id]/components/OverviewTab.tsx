"use client";
// 项目总览 —— 一条指标带 + 覆盖率进度列表 + 作战图 + 实施步骤条 + 评分任务列表 + 能力标签
// 设计原则:去掉"卡套卡",数字集中在指标带,面板内用分隔线与对齐组织信息

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
      {/* 指标带:所有关键数字一条线看完 */}
      <section className="metric-strip">
        <div className="metric"><small>已识别要求</small><strong>{data.requirements.length}</strong></div>
        <div className="metric"><small>风险提醒</small><strong className={risks.length ? "warn" : "ok"}>{risks.length}</strong></div>
        <div className="metric"><small>模型成本</small><strong>${Number(data.aiTotals.costUsd || 0).toFixed(2)}</strong></div>
        {requirementRouting && documentBudget && (
          <>
            <div className="metric"><small>唯一主路由</small><strong>{requirementRouting.primaryAssignments || 0}<i>/{requirementRouting.totalRequirements || 0}</i></strong></div>
            <div className="metric"><small>正文 / 独立矩阵</small><strong>{requirementRouting.narrativePlacements || 0}<i> / {requirementRouting.virtualAssignments || 0}</i></strong></div>
            <div className="metric"><small>{lengthModeLabels[lengthMode]}预计</small><strong>{selectedTargetPages || documentBudget.targetPages || 0}<i> 页</i></strong></div>
            <div className="metric"><small>重点章节</small><strong>{documentBudget.highPrioritySections || 0}<i>/{documentBudget.sectionCount || 0}</i></strong></div>
          </>
        )}
      </section>

      {coverage && coverage.candidateItems > 0 && (
        <section className="coverage-panel">
          <div className="panel-head">
            <div>
              <em>REQUIREMENT COVERAGE</em>
              <h2>招标要求覆盖率审计</h2>
            </div>
            <strong className="coverage-total">{coverage.coverageRate}%</strong>
          </div>
          <p className="panel-sub">候选要求 {coverage.candidateItems} 项 · 已建立响应 {coverage.coveredItems} 项 · 疑似遗漏 {coverage.possibleMissing} 项</p>
          <div className="coverage-rows">
            {Object.entries(coverage.categories || {}).map(([category, item]) => (
              <div className="coverage-row" key={category}>
                <span>{coverageLabels[category] || category}</span>
                <div className="coverage-bar"><i style={{ width: `${Math.min(100, item.coverageRate)}%` }} /></div>
                <b>{item.coverageRate}%</b>
                <small>{item.coveredItems}/{item.candidateItems}{item.possibleMissing ? ` · 待核查 ${item.possibleMissing}` : ""}</small>
              </div>
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
          <div className="panel-head">
            <div>
              <em>PROJECT BATTLE MAP</em>
              <h2>项目作战图</h2>
            </div>
            <span className="panel-tag">{analysis.deliveryArchetypeLabel || profile?.projectType || "待识别"}</span>
          </div>
          {analysis.archetypeComponents?.length && analysis.deliveryArchetype === "mixed" ? (
            <p className="panel-sub">组成:{analysis.archetypeComponents.map(item => archetypeComponentLabels[item] || item).join(" + ")}</p>
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
            <p className="knowledge-gap"><b>当前知识缺口:</b>{analysis.knowledgeGaps.slice(0, 5).join(";")}</p>
          ) : null}
        </section>
      )}

      {profile && blueprint && (
        <section className="blueprint-panel">
          <div className="panel-head">
            <div>
              <em>PROJECT BLUEPRINT</em>
              <h2>项目实施蓝图</h2>
            </div>
            <span className="panel-tag">{profile.projectType || blueprint.templateName || "综合项目实施"}</span>
          </div>
          <div className="blueprint-steps">
            {(blueprint.phases || []).map((phase, index) => (
              <article key={`${phase.name}-${index}`}>
                <b>{index + 1}</b>
                <h3>{phase.name}</h3>
                {phase.objective && <p>{phase.objective}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      {(capabilityPlan.length > 0 || scoringTasks.length > 0) && (
        <section className="scoring-panel">
          <div className="panel-head">
            <div>
              <em>SCORING & CAPABILITY</em>
              <h2>评分任务与能力模块</h2>
            </div>
            <span className="panel-tag">{scoringTasks.length} 项任务 · {capabilityPlan.length} 个模块</span>
          </div>
          {capabilityPlan.length > 0 && (
            <div className="capability-chips">
              {capabilityPlan.map(module => <span key={module.id} title={module.methodPattern || ""}>{module.name}</span>)}
            </div>
          )}
          {scoringTasks.length > 0 && (
            <>
              <div className="route-summary">
                {Object.entries(routeCounts).map(([route, count]) => (
                  <span className={`route-${route}`} key={route}>{routeLabels[route] || route} {count}</span>
                ))}
              </div>
              <div className="scoring-list">
                {scoringTasks.slice(0, 12).map(task => (
                  <div className="scoring-row" key={task.requirementId}>
                    <div>
                      <h3>{task.title}</h3>
                      {task.responseObjective && <p>{task.responseObjective}</p>}
                      {task.enterpriseInputsNeeded?.length ? <small className="needs-input">待补企业资料:{task.enterpriseInputsNeeded.join("、")}</small> : null}
                    </div>
                    <span className={`route-${task.routeType || "unrouted"}`}>{task.routeLabel || routeLabels[task.routeType || ""] || "待路由"}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
