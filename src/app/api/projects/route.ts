import {randomUUID} from "node:crypto";
import {mkdir, unlink, writeFile} from "node:fs/promises";
import path from "node:path";
import {NextRequest, NextResponse} from "next/server";
import {db} from "@/lib/db";
import {getQueue} from "@/lib/queue";
import {getAccess} from "@/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const root = process.env.DATA_DIR || "/app/data", uploads = path.join(root, "uploads");
const selectColumns = `SELECT id,name,file_name AS "fileName",file_size AS "fileSize",status,created_at AS "createdAt",progress,findings_count AS findings FROM projects`;

/** 项目列表:admin 全量,客户仅看自己码下的 */
export async function GET(req: NextRequest) {
  try {
    const access = await getAccess(req);
    if (!access) return NextResponse.json({error: "未登录"}, {status: 401});
    const result = access.isAdmin
      ? await db.query(`${selectColumns} ORDER BY created_at DESC`)
      : await db.query(`${selectColumns} WHERE access_code_id=$1 ORDER BY created_at DESC`, [access.id]);
    return NextResponse.json({projects: result.rows});
  } catch (e) {
    console.error(e);
    return NextResponse.json({error: "项目读取失败"}, {status: 500});
  }
}

export async function POST(req: NextRequest) {
  let stored = "";
  try {
    const access = await getAccess(req);
    if (!access) return NextResponse.json({error: "未登录"}, {status: 401});
    // 客户码检查项目额度(NULL=不限)
    if (!access.isAdmin) {
      const quota = await db.query(
        `SELECT max_projects AS "maxProjects",(SELECT count(*)::int FROM projects WHERE access_code_id=$1) AS used FROM access_codes WHERE id=$1`,
        [access.id],
      );
      const {maxProjects, used} = quota.rows[0] || {maxProjects: null, used: 0};
      if (maxProjects != null && used >= maxProjects) {
        return NextResponse.json({error: `项目额度已用完(${used}/${maxProjects}),请联系服务方追加`}, {status: 403});
      }
    }
    const f = await req.formData(), file = f.get("file");
    if (!(file instanceof File)) return NextResponse.json({error: "请选择文件"}, {status: 400});
    const ext = path.extname(file.name).toLowerCase();
    if (![".pdf", ".docx"].includes(ext)) return NextResponse.json({error: "解析服务当前支持PDF和DOCX"}, {status: 400});
    if (file.size > 52428800) return NextResponse.json({error: "文件不能超过50MB"}, {status: 400});
    const id = randomUUID(), jobId = randomUUID();
    stored = id + ext;
    await mkdir(uploads, {recursive: true});
    await writeFile(path.join(uploads, stored), Buffer.from(await file.arrayBuffer()));
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO projects(id,name,file_name,stored_name,file_size,status,progress,access_code_id) VALUES($1,$2,$3,$4,$5,'uploaded',10,$6)`,
        [id, String(f.get("name") || file.name), file.name, stored, file.size, access.id],
      );
      await client.query(`INSERT INTO jobs(id,project_id,type,status) VALUES($1,$2,'parse','queued')`, [jobId, id]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    const q = await getQueue();
    await q.lPush("ai_bid:jobs", JSON.stringify({jobId, projectId: id, storedName: stored, fileName: file.name}));
    const project = (await db.query(`${selectColumns} WHERE id=$1`, [id])).rows[0];
    return NextResponse.json({project}, {status: 201});
  } catch (e) {
    console.error(e);
    if (stored) await unlink(path.join(uploads, stored)).catch(() => {});
    return NextResponse.json({error: "项目创建或排队失败"}, {status: 500});
  }
}
