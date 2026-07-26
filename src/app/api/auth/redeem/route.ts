import {NextRequest, NextResponse} from "next/server";
import {db} from "@/lib/db";
import {SESSION_COOKIE, sessionCookieOptions, signSession} from "@/lib/auth";
export const dynamic = "force-dynamic";

/** 兑换 CDK:校验后种会话 cookie */
export async function POST(req: NextRequest) {
  let code = "";
  try {
    const body = await req.json();
    code = String(body?.code || "").trim().toUpperCase();
  } catch {}
  if (!code) return NextResponse.json({error: "请输入兑换码"}, {status: 400});
  const result = await db.query(
    `SELECT id,is_admin AS "isAdmin",disabled,expires_at AS "expiresAt" FROM access_codes WHERE code=$1`,
    [code],
  );
  if (!result.rowCount) return NextResponse.json({error: "兑换码无效,请核对后重试"}, {status: 401});
  const row = result.rows[0];
  if (row.disabled) return NextResponse.json({error: "该兑换码已停用,请联系服务方"}, {status: 401});
  if (row.expiresAt && new Date(row.expiresAt) <= new Date()) return NextResponse.json({error: "该兑换码已过期,请联系服务方"}, {status: 401});
  await db.query("UPDATE access_codes SET last_used_at=now() WHERE id=$1", [row.id]);
  const response = NextResponse.json({ok: true, isAdmin: row.isAdmin});
  response.cookies.set(SESSION_COOKIE, signSession(row.id), sessionCookieOptions);
  return response;
}
