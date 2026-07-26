import {NextRequest, NextResponse} from "next/server";

// 页面级会话门:无有效签名 cookie 时在服务端直接跳登录页,
// 避免客户端先渲染完整工作台再被 API 401 弹走的"闪现"。
// 只验 HMAC 签名(Edge 运行时,无法查库);停用/过期的深校验仍由各 API 承担。

export const config = {matcher: ["/", "/projects/:path*", "/admin", "/login"]};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function verifySignature(token: string | undefined, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const codeId = token.slice(0, dot);
  if (!UUID_RE.test(codeId)) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), {name: "HMAC", hash: "SHA-256"}, false, ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(codeId));
  const hex = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
  return hex === token.slice(dot + 1);
}

export async function middleware(req: NextRequest) {
  const authenticated = await verifySignature(
    req.cookies.get("bid_session")?.value,
    process.env.AUTH_SECRET || "",
  );
  const atLogin = req.nextUrl.pathname === "/login";
  if (!authenticated && !atLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (authenticated && atLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
