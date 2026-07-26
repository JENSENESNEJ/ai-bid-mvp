"use client";
// 项目工作台首页 —— 卡片流布局(筛选页签 + 搜索 + 卡片网格)
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Project = { id: string; name: string; fileName: string; fileSize: number; status: string; createdAt: string; progress: number; findings: number };

const labels: Record<string, string> = { uploaded: "等待解析", parsing: "正在解析", extracting: "AI提取中", outlining: "生成大纲", reviewing: "待复核", confirmed: "已完成", failed: "处理失败" };
const WORKING_STATUS = ["uploaded", "parsing", "extracting", "outlining"];
const FILTERS = [["all", "全部"], ["working", "处理中"], ["reviewing", "待复核"], ["confirmed", "已完成"]] as const;
type FilterKey = (typeof FILTERS)[number][0];

export default function Home() {
  const router = useRouter();
  const [items, setItems] = useState<Project[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [me, setMe] = useState<{ note: string; isAdmin: boolean } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = () => fetch("/api/projects", { cache: "no-store" }).then(r => {
    if (r.status === 401) { try { sessionStorage.clear(); } catch {} router.replace("/login"); throw new Error("unauthenticated"); }
    return r.json();
  }).then(x => {
    setItems(x.projects || []);
    try { sessionStorage.setItem("bid:projects", JSON.stringify(x.projects || [])); } catch {}
  }).catch(reason => { if (reason?.message !== "unauthenticated") setError("项目读取失败"); });
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("bid:projects");
      if (cached) setItems(JSON.parse(cached));
    } catch {}
    load();
    fetch("/api/auth/me", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(x => { if (x?.authenticated) setMe({ note: x.note, isAdmin: x.isAdmin }); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    try { sessionStorage.clear(); } catch {}
    router.replace("/login");
  }
  // 有处理中的项目才 3 秒轮询,否则 30 秒慢刷
  useEffect(() => {
    const working = items.some(x => WORKING_STATUS.includes(x.status));
    const timer = setInterval(load, working ? 3000 : 30000);
    return () => clearInterval(timer);
  }, [items]);

  async function upload(e: FormEvent) {
    e.preventDefault();
    const file = input.current?.files?.[0];
    if (!file) return setError("请选择PDF或DOCX文件");
    setBusy(true);
    setError("");
    const data = new FormData();
    data.append("file", file);
    data.append("name", file.name.replace(/\.[^.]+$/, ""));
    const r = await fetch("/api/projects", { method: "POST", body: data });
    const x = await r.json();
    if (r.ok) { setItems(v => [x.project, ...v]); if (input.current) input.current.value = ""; }
    else setError(x.error || "上传失败");
    setBusy(false);
  }

  const visible = useMemo(() => items.filter(x => {
    if (filter === "working" && !WORKING_STATUS.includes(x.status)) return false;
    if (filter === "reviewing" && x.status !== "reviewing") return false;
    if (filter === "confirmed" && x.status !== "confirmed") return false;
    if (query && !x.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [items, filter, query]);

  const review = items.filter(x => x.status === "reviewing").length;
  const findings = items.reduce((n, x) => n + x.findings, 0);

  return <main className="shell">
    <aside>
      <div className="brand"><b>标</b>标智</div>
      <nav>
        <a className="active">▦ 项目工作台</a>
        <a>⇧ 文件解析</a>
        <a>✓ 条款复核</a>
        <a>▤ 标书编制</a>
        {me?.isAdmin && <Link href="/admin">◆ CDK 管理</Link>}
      </nav>
      <div className="online">● 系统正常<small>AI任务后台处理</small></div>
      <div className="user">
        <i>{(me?.note || "客").slice(0, 1)}</i>
        <span>{me?.note || (me?.isAdmin ? "管理员" : "客户工作区")}<small>{me?.isAdmin ? "管理员账户" : "数据独立隔离"}</small></span>
        <button type="button" className="logout" onClick={logout} title="退出登录">⎋</button>
      </div>
    </aside>
    <section className="workspace">
      <header>
        <div>
          <em>AI BID WORKSPACE</em>
          <h1>项目工作台</h1>
          <p>上传招标文件，自动梳理关键条款并进入人工复核。</p>
        </div>
        <button onClick={() => input.current?.click()}>＋ 新建项目</button>
      </header>
      <div className="stats">
        <article><i>▦</i><span>项目总数<strong>{items.length}</strong><small>当前工作区</small></span></article>
        <article><i>◷</i><span>待人工复核<strong>{review}</strong><small>关键条款需确认</small></span></article>
        <article><i>✓</i><span>已识别条款<strong>{findings}</strong><small>全部保留原文证据</small></span></article>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="board-controls">
        <div className="board-filters">
          {FILTERS.map(([key, label]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}</button>)}
        </div>
        <input className="board-search" placeholder="搜索项目名称" value={query} onChange={e => setQuery(e.target.value)} />
      </div>
      <div className="project-cards">
        <form className="upload-card" onSubmit={upload}>
          <label className="drop">
            <input ref={input} type="file" accept=".pdf,.doc,.docx" />
            <b>⇧</b>
            <strong>点击选择 PDF 或 DOCX</strong>
            <span>单个文件最大50MB</span>
          </label>
          <button disabled={busy}>{busy ? "正在上传…" : "上传并创建项目"}</button>
        </form>
        {visible.map(x => <Link className="project-card" key={x.id} href={`/projects/${x.id}`}>
          <span className={`card-status ${x.status}`}>{labels[x.status] || x.status}</span>
          <strong>{x.name}</strong>
          <small>{x.fileName} · {(x.fileSize / 1048576).toFixed(1)} MB</small>
          {x.progress < 100 && <b className="card-progress"><i style={{ width: `${x.progress}%` }} /></b>}
          <div className="card-meta"><span>{x.findings} 条要求</span><span>{new Date(x.createdAt).toLocaleDateString("zh-CN")}</span></div>
        </Link>)}
        {!visible.length && <div className="cards-empty">◇ 没有匹配的项目<span>调整筛选条件,或上传第一份招标文件。</span></div>}
      </div>
    </section>
  </main>;
}
