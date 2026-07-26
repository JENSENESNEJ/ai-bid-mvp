import {createHmac, randomBytes, timingSafeEqual} from "node:crypto";
import type {NextRequest} from "next/server";
import {db} from "./db";

// CDK 会话:无会话表,cookie = codeId.HMAC(codeId, AUTH_SECRET)
const SECRET = process.env.AUTH_SECRET || "";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SESSION_COOKIE = "bid_session";

export type Access = {id: string; isAdmin: boolean};

export function signSession(codeId: string) {
  return `${codeId}.${createHmac("sha256", SECRET).update(codeId).digest("hex")}`;
}

export function verifySession(token: string | undefined): string | null {
  if (!token || !SECRET) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const codeId = token.slice(0, dot);
  if (!UUID_RE.test(codeId)) return null;
  let sig: Buffer;
  try { sig = Buffer.from(token.slice(dot + 1), "hex"); } catch { return null; }
  const expect = createHmac("sha256", SECRET).update(codeId).digest();
  if (sig.length !== expect.length || !timingSafeEqual(sig, expect)) return null;
  return codeId;
}

/** 从请求 cookie 解出有效访问身份(核对未停用/未过期),无效返回 null */
export async function getAccess(req: NextRequest): Promise<Access | null> {
  const codeId = verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!codeId) return null;
  const result = await db.query(
    `SELECT id,is_admin AS "isAdmin" FROM access_codes WHERE id=$1 AND disabled=false AND (expires_at IS NULL OR expires_at>now())`,
    [codeId],
  );
  return result.rowCount ? result.rows[0] : null;
}

/** 项目归属校验:admin 全通,客户仅限自己码下的项目 */
export async function canAccessProject(access: Access, projectId: string) {
  if (access.isAdmin) return true;
  if (!UUID_RE.test(projectId)) return false;
  const result = await db.query("SELECT 1 FROM projects WHERE id=$1 AND access_code_id=$2", [projectId, access.id]);
  return (result.rowCount || 0) > 0;
}

/** 生成 CDK:BID-XXXX-XXXX-XXXX,去掉易混字符 */
export function generateCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = (n: number) => Array.from(randomBytes(n)).map(b => alphabet[b % alphabet.length]).join("");
  return `BID-${pick(4)}-${pick(4)}-${pick(4)}`;
}

export const sessionCookieOptions = {
  httpOnly: true as const,
  secure: true as const,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
};

/** 生成消耗检查:积分制(充值-实际成本×折算率)优先,兼容旧的单项目美元预算 */
export const POINTS_PER_USD = Number(process.env.POINTS_PER_USD || 100);

export async function checkGenerationBudget(access: Access, projectId: string): Promise<{ok: true} | {ok: false; message: string}> {
  if (access.isAdmin) return {ok: true};
  const result = await db.query(
    `SELECT c.project_budget_usd::float8 AS budget,
            c.points_purchased::float8 AS points,
            COALESCE((SELECT sum(cost_usd) FROM ai_runs WHERE project_id=$2),0)::float8 AS "projectUsed",
            COALESCE((SELECT sum(r.cost_usd) FROM ai_runs r JOIN projects p ON p.id=r.project_id WHERE p.access_code_id=$1),0)::float8 AS "codeUsed"
       FROM access_codes c WHERE c.id=$1`,
    [access.id, projectId],
  );
  const row = result.rows[0];
  if (!row) return {ok: false, message: "账户状态异常,请重新登录"};
  if (row.points != null) {
    const remaining = row.points - row.codeUsed * POINTS_PER_USD;
    if (remaining <= 0) return {ok: false, message: `积分不足(剩余 ${Math.max(0, remaining).toFixed(0)} 分),请联系服务方充值`};
  }
  if (row.budget != null && row.projectUsed >= row.budget) {
    return {ok: false, message: `本项目生成额度已用完($${row.projectUsed.toFixed(2)}/$${row.budget.toFixed(2)}),请联系服务方追加`};
  }
  return {ok: true};
}

/** 某码的积分概况(未启用积分制返回 null) */
export async function pointsSummary(codeId: string): Promise<{purchased: number; consumed: number; remaining: number} | null> {
  const result = await db.query(
    `SELECT c.points_purchased::float8 AS points,
            COALESCE((SELECT sum(r.cost_usd) FROM ai_runs r JOIN projects p ON p.id=r.project_id WHERE p.access_code_id=$1),0)::float8 AS used
       FROM access_codes c WHERE c.id=$1`,
    [codeId],
  );
  const row = result.rows[0];
  if (!row || row.points == null) return null;
  const consumed = row.used * POINTS_PER_USD;
  return {purchased: row.points, consumed, remaining: Math.max(0, row.points - consumed)};
}
