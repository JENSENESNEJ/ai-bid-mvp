"use client";
// 产品技术参数响应矩阵标签页 —— 从原 projects/[id]/page.tsx 第 311-323 行迁出
// 改造点:自行拉取参数明细(原 215 行逻辑)、去掉 details 折叠、表格分页(初始 60 条,每次 +120)

import { useEffect, useMemo, useState } from "react";
import type { ParameterSummary, TechnicalParameter } from "./types";

type ParameterFilter = "all" | "important" | "mandatory" | "general";

const INITIAL_VISIBLE = 60;
const VISIBLE_STEP = 120;

export function ParametersTab({ projectId, summary }: { projectId: string; summary?: ParameterSummary }) {
  const [parameterItems, setParameterItems] = useState<TechnicalParameter[]>([]);
  const [parameterFilter, setParameterFilter] = useState<ParameterFilter>("all");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  useEffect(() => {
    if ((summary?.total || 0) > 0 && !parameterItems.length) {
      fetch(`/api/projects/${projectId}/technical-parameters`, { cache: "no-store" })
        .then(response => response.json())
        .then(value => setParameterItems(value.items || []))
        .catch(() => {});
    }
  }, [summary?.total, projectId, parameterItems.length]);

  const visibleParameters = useMemo(
    () => parameterItems.filter(item =>
      parameterFilter === "all"
      || (parameterFilter === "important" && item.marker === "▲")
      || (parameterFilter === "mandatory" && item.marker === "★")
      || (parameterFilter === "general" && !item.marker)),
    [parameterItems, parameterFilter],
  );

  const pagedParameters = visibleParameters.slice(0, visibleCount);
  const remaining = visibleParameters.length - pagedParameters.length;

  function changeFilter(next: ParameterFilter) {
    setParameterFilter(next);
    setVisibleCount(INITIAL_VISIBLE);
  }

  if ((summary?.total || 0) === 0) {
    return (
      <div className="parameter-matrix parameter-matrix-tab">
        <p className="parameter-empty">本项目未检测到技术参数表</p>
      </div>
    );
  }

  return (
    <div className="parameter-matrix parameter-matrix-tab">
      <div className="parameter-stats">
        <button className={parameterFilter === "all" ? "active" : ""} onClick={() => changeFilter("all")}>全部 {summary?.total}</button>
        <button className={parameterFilter === "important" ? "active important" : ""} onClick={() => changeFilter("important")}>▲重要参数 {summary?.important}</button>
        <button className={parameterFilter === "mandatory" ? "active mandatory" : ""} onClick={() => changeFilter("mandatory")}>★实质性参数 {summary?.mandatory}</button>
        <button className={parameterFilter === "general" ? "active" : ""} onClick={() => changeFilter("general")}>一般参数 {summary?.general}</button>
      </div>
      {(summary?.important !== 19 || summary?.general !== 520) && (
        <p className="parameter-warning">数量核对提醒：评分表声明“▲”19条、一般参数520条；系统逐行检测到“▲”{summary?.important}条、一般参数{summary?.general}条。招标文件注明数量不一致时以专家现场计算为准，请在定稿前复核差异。</p>
      )}
      <div className="parameter-table-wrap">
        <table>
          <thead>
            <tr><th>序号</th><th>产品／设备</th><th>标识</th><th>招标技术要求</th><th>投标响应</th><th>偏离</th><th>证明材料</th></tr>
          </thead>
          <tbody>
            {pagedParameters.map(item => (
              <tr key={item.id} className={item.marker === "▲" ? "important" : item.marker === "★" ? "mandatory" : ""}>
                <td>{item.itemIndex}</td>
                <td><b>{item.productNo} {item.productName}</b>{item.sourcePage ? <small>第{item.sourcePage}页</small> : null}</td>
                <td>{item.marker || "一般"}</td>
                <td>{item.requirement}</td>
                <td>{item.responseValue || "待填写拟投产品具体参数"}</td>
                <td>{item.deviationStatus === "pending" ? "待核对" : item.deviationStatus}</td>
                <td>{item.evidenceReference || item.proofRequirement || "待补证明材料"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {remaining > 0 && (
        <button className="parameter-show-more" onClick={() => setVisibleCount(count => count + VISIBLE_STEP)}>
          显示更多(剩余 {remaining} 条)
        </button>
      )}
    </div>
  );
}
