import {randomUUID} from "node:crypto";
import {NextRequest, NextResponse} from "next/server";
import {db} from "@/lib/db";
import {generateCode, getAccess} from "@/lib/auth";
export const dynamic = "force-dynamic";

/** CDK 列表(仅 admin):含每码已用项目数 */
export async function GET(req: NextRequest) {
  const access = await getAccess(req);
  if (!access) return NextResponse.json({error: "未登录"}, {status: 401});
  if (!access.isAdmin) return NextResponse.json({error: "无权限"}, {status: 403});
  const result = await db.query(
    `SELECT c.id,c.code,c.note,c.is_admin AS "isAdmin",c.disabled,c.max_projects AS "maxProjects",
            c.expires_at AS "expiresAt",c.created_at AS "createdAt",c.last_used_at AS "lastUsedAt",
            count(p.id)::int AS "projectCount"
       FROM access_codes c LEFT JOIN projects p ON p.access_code_id=c.id
      GROUP BY c.id ORDER BY c.created_at DESC`,
  );
  return NextResponse.json({codes: result.rows});
}

/** 批量生成 CDK(仅 admin) */
export async function POST(req: NextRequest) {
  const access = await getAccess(req);
  if (!access) return NextResponse.json({error: "未登录"}, {status: 401});
  if (!access.isAdmin) return NextResponse.json({error: "无权限"}, {status: 403});
  let body: {count?: unknown; note?: unknown; maxProjects?: unknown; expiresAt?: unknown} = {};
  try { body = await req.json(); } catch {}
  const count = Math.min(50, Math.max(1, Number(body.count) || 1));
  const note = String(body.note || "").slice(0, 120);
  const maxProjects = body.maxProjects == null || body.maxProjects === "" ? null : Math.max(1, Math.floor(Number(body.maxProjects)));
  if (maxProjects !== null && !Number.isFinite(maxProjects)) return NextResponse.json({error: "项目上限无效"}, {status: 400});
  let expiresAt: string | null = null;
  if (body.expiresAt) {
    const when = new Date(String(body.expiresAt));
    if (Number.isNaN(when.getTime())) return NextResponse.json({error: "有效期格式无效"}, {status: 400});
    expiresAt = when.toISOString();
  }
  const created: {id: string; code: string}[] = [];
  for (let index = 0; index < count; index++) {
    // 撞码概率极低,冲突时重试一次
    for (let attempt = 0; attempt < 2; attempt++) {
      const id = randomUUID();
      const code = generateCode();
      try {
        await db.query(
          "INSERT INTO access_codes(id,code,note,max_projects,expires_at) VALUES($1,$2,$3,$4,$5)",
          [id, code, note, maxProjects, expiresAt],
        );
        created.push({id, code});
        break;
      } catch (error) {
        if (attempt === 1) throw error;
      }
    }
  }
  return NextResponse.json({codes: created, note, maxProjects, expiresAt}, {status: 201});
}
