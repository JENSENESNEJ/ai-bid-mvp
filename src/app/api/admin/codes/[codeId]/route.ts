import {NextRequest, NextResponse} from "next/server";
import {db} from "@/lib/db";
import {getAccess} from "@/lib/auth";
export const dynamic = "force-dynamic";

/** 停用/恢复/充值某个 CDK(仅 admin;不允许动 admin 码自己) */
export async function PATCH(req: NextRequest, {params}: {params: Promise<{codeId: string}>}) {
  const access = await getAccess(req);
  if (!access) return NextResponse.json({error: "未登录"}, {status: 401});
  if (!access.isAdmin) return NextResponse.json({error: "无权限"}, {status: 403});
  const {codeId} = await params;
  let body: {disabled?: unknown; addPoints?: unknown} = {};
  try { body = await req.json(); } catch {}
  if (typeof body.addPoints === "number" && Number.isFinite(body.addPoints) && body.addPoints > 0) {
    const result = await db.query(
      "UPDATE access_codes SET points_purchased=COALESCE(points_purchased,0)+$2 WHERE id=$1 AND is_admin=false RETURNING points_purchased::float8 AS points",
      [codeId, body.addPoints],
    );
    if (!result.rowCount) return NextResponse.json({error: "兑换码不存在或不可修改"}, {status: 404});
    return NextResponse.json({ok: true, pointsPurchased: result.rows[0].points});
  }
  if (typeof body.disabled !== "boolean") return NextResponse.json({error: "参数无效"}, {status: 400});
  const result = await db.query(
    "UPDATE access_codes SET disabled=$2 WHERE id=$1 AND is_admin=false RETURNING id,disabled",
    [codeId, body.disabled],
  );
  if (!result.rowCount) return NextResponse.json({error: "兑换码不存在或不可修改"}, {status: 404});
  return NextResponse.json({ok: true, disabled: result.rows[0].disabled});
}
