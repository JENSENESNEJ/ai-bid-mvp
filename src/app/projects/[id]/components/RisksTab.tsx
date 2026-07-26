"use client";
// 风险提醒标签页 —— 从原 projects/[id]/page.tsx 的 risk-panel(原第 400 行)整块迁移
// 纯展示组件,不发起请求、不持有状态

import { typeLabels, type Requirement } from "./types";

export function RisksTab({ risks }: { risks: Requirement[] }) {
  return (
    <section className="risk-panel">
      <div className="risk-intro">
        <h2>{risks.length ? `有 ${risks.length} 项建议稍后核对` : "未发现需要处理的疑点"}</h2>
        <p>这些提醒不会阻止大纲和正文生成。</p>
      </div>
      {risks.map(item => (
        <article className="simple-risk" key={item.id}>
          <span>{typeLabels[item.type] || item.type}</span>
          <h3>{item.title}</h3>
          <p><b>为什么提醒：</b>{item.aiReviewReason}</p>
          {item.aiReviewSuggestion && <p><b>建议：</b>{item.aiReviewSuggestion}</p>}
          <details>
            <summary>查看原文依据</summary>
            <p>{item.normalizedValue}</p>
            {item.evidence?.map((e, index) => (
              <blockquote key={index}>
                <code>{e.blockId}</code>
                {e.quote}
              </blockquote>
            ))}
          </details>
        </article>
      ))}
    </section>
  );
}
