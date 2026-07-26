import {NextRequest, NextResponse} from "next/server";
import {db} from "@/lib/db";
import {getAccess, pointsSummary} from "@/lib/auth";
export const dynamic = "force-dynamic";

/** 当前会话身份:前端用来决定跳转与管理入口显隐 */
export async function GET(req: NextRequest) {
  const access = await getAccess(req);
  if (!access) return NextResponse.json({authenticated: false}, {status: 401});
  const [info, points] = await Promise.all([
    db.query(
      `SELECT note,max_projects AS "maxProjects",(SELECT count(*)::int FROM projects WHERE access_code_id=$1) AS "projectCount" FROM access_codes WHERE id=$1`,
      [access.id],
    ),
    pointsSummary(access.id),
  ]);
  return NextResponse.json({
    authenticated: true,
    isAdmin: access.isAdmin,
    note: info.rows[0]?.note || "",
    maxProjects: info.rows[0]?.maxProjects ?? null,
    projectCount: info.rows[0]?.projectCount ?? 0,
    points,
  });
}
