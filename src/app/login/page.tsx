"use client";
// CDK 兑换登录页
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function Login() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function redeem(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) { setError("请输入兑换码"); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await response.json();
      if (response.ok) { router.replace("/"); return; }
      setError(body.error || "兑换失败,请稍后重试");
    } catch {
      setError("网络异常,请稍后重试");
    }
    setBusy(false);
  }

  return (
    <main className="login-stage">
      <form className="login-card" onSubmit={redeem}>
        <div className="load-logo">标</div>
        <h1>标智 · AI 标书工作台</h1>
        <p>输入兑换码,进入您的专属工作区</p>
        <input
          value={code}
          onChange={event => setCode(event.target.value.toUpperCase())}
          placeholder="BID-XXXX-XXXX-XXXX"
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />
        {error && <span className="login-error">{error}</span>}
        <button disabled={busy}>{busy ? "验证中…" : "进入工作台"}</button>
        <small>兑换码由服务方提供 · 每个客户的数据独立隔离存储</small>
      </form>
    </main>
  );
}
