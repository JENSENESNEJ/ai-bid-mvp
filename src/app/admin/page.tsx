"use client";
// CDK 管理页(仅管理员):批量生成 / 列表 / 停用恢复
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type CodeRow = {
  id: string; code: string; note: string; isAdmin: boolean; disabled: boolean;
  maxProjects: number | null; projectBudget: number | null; pointsPurchased: number | null;
  expiresAt: string | null; createdAt: string;
  lastUsedAt: string | null; projectCount: number; costUsd: number;
};

export default function AdminCodes() {
  const router = useRouter();
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [pointsPerUsd, setPointsPerUsd] = useState(100);
  const [count, setCount] = useState("1");
  const [note, setNote] = useState("");
  const [maxProjects, setMaxProjects] = useState("");
  const [projectBudget, setProjectBudget] = useState("");
  const [initialPoints, setInitialPoints] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [created, setCreated] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(() =>
    fetch("/api/admin/codes", { cache: "no-store" })
      .then(response => {
        if (response.status === 401) { router.replace("/login"); throw new Error("unauthenticated"); }
        if (response.status === 403) { router.replace("/"); throw new Error("forbidden"); }
        return response.json();
      })
      .then(body => { setCodes(body.codes || []); if (body.pointsPerUsd) setPointsPerUsd(body.pointsPerUsd); })
      .catch(() => {}), [router]);
  useEffect(() => { load(); }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const response = await fetch("/api/admin/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: Number(count) || 1,
          note,
          maxProjects: maxProjects === "" ? null : Number(maxProjects),
          projectBudget: projectBudget === "" ? null : Number(projectBudget),
          initialPoints: initialPoints === "" ? null : Number(initialPoints),
          expiresAt: expiresAt || null,
        }),
      });
      const body = await response.json();
      if (response.ok) { setCreated(body.codes.map((item: { code: string }) => item.code)); await load(); }
      else setError(body.error || "生成失败");
    } catch { setError("网络异常,请稍后重试"); }
    setBusy(false);
  }

  async function toggle(row: CodeRow) {
    await fetch(`/api/admin/codes/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled: !row.disabled }),
    }).catch(() => {});
    await load();
  }

  async function recharge(row: CodeRow) {
    const raw = window.prompt(`给「${row.note || row.code}」充值多少积分?(1 美元成本 = ${pointsPerUsd} 积分)`);
    if (!raw) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) { setError("充值积分必须是正数"); return; }
    const response = await fetch(`/api/admin/codes/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addPoints: amount }),
    }).catch(() => null);
    if (response && !response.ok) setError((await response.json()).error || "充值失败");
    else setError("");
    await load();
  }

  function copyAll() {
    navigator.clipboard?.writeText(created.join("\n")).then(() => setCopied(true)).catch(() => {});
  }

  const day = (value: string | null) => value ? new Date(value).toLocaleDateString("zh-CN") : "—";

  return (
    <main className="admin-shell">
      <div className="detail-top">
        <Link className="back-pill" href="/" title="返回工作台">←</Link>
        <div className="headline">
          <h1>CDK 兑换码管理</h1>
          <p>一码一客户 · 数据独立隔离 · 停用即时生效</p>
        </div>
      </div>

      <section className="admin-panel">
        <div className="panel-head">
          <div><em>GENERATE</em><h2>生成兑换码</h2></div>
        </div>
        <form className="admin-create" onSubmit={create}>
          <label>数量<input type="number" min={1} max={50} value={count} onChange={e => setCount(e.target.value)} /></label>
          <label>客户备注<input value={note} maxLength={120} placeholder="例如:XX物业公司" onChange={e => setNote(e.target.value)} /></label>
          <label>初始积分<input type="number" min={0} value={initialPoints} placeholder="留空=不用积分制" onChange={e => setInitialPoints(e.target.value)} /></label>
          <label>项目数上限<input type="number" min={1} value={maxProjects} placeholder="留空=不限" onChange={e => setMaxProjects(e.target.value)} /></label>
          <label>生成预算/项目($)<input type="number" min={0.5} step={0.5} value={projectBudget} placeholder="留空=不限" onChange={e => setProjectBudget(e.target.value)} /></label>
          <label>有效期至<input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} /></label>
          <button disabled={busy}>{busy ? "生成中…" : "生成"}</button>
        </form>
        {error && <p className="error">{error}</p>}
        {created.length > 0 && (
          <div className="created-codes">
            <div><b>本次生成 {created.length} 枚</b><button type="button" onClick={copyAll}>{copied ? "已复制" : "复制全部"}</button></div>
            <pre>{created.join("\n")}</pre>
          </div>
        )}
      </section>

      <section className="admin-panel">
        <div className="panel-head">
          <div><em>ALL CODES</em><h2>已发放兑换码</h2></div>
          <span className="panel-tag">{codes.length} 枚</span>
        </div>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr><th>兑换码</th><th>备注</th><th>项目</th><th>积分(剩余/已充)</th><th>实际消耗</th><th>最后使用</th><th>状态</th><th></th></tr>
            </thead>
            <tbody>
              {codes.map(row => (
                <tr key={row.id} className={row.disabled ? "disabled" : ""}>
                  <td className="mono">{row.code}{row.isAdmin ? <b className="admin-badge">管理</b> : null}</td>
                  <td>{row.note || "—"}</td>
                  <td className="mono">{row.projectCount}{row.maxProjects != null ? `/${row.maxProjects}` : ""}</td>
                  <td className="mono">{row.pointsPurchased != null ? `${Math.max(0, Math.floor(row.pointsPurchased - row.costUsd * pointsPerUsd))} / ${Math.floor(row.pointsPurchased)}` : "—"}</td>
                  <td className="mono">${Number(row.costUsd || 0).toFixed(2)}{row.projectBudget != null ? ` (预算$${row.projectBudget.toFixed(2)}×项目)` : ""}</td>
                  <td className="mono">{day(row.lastUsedAt)}</td>
                  <td>{row.disabled ? <span className="state off">已停用</span> : <span className="state on">生效中</span>}</td>
                  <td>{row.isAdmin ? null : <span className="row-actions"><button type="button" className="row-toggle" onClick={() => recharge(row)}>充值</button><button type="button" className="row-toggle" onClick={() => toggle(row)}>{row.disabled ? "恢复" : "停用"}</button></span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
