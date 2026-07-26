import json

import psycopg

from worker import DB, build_coverage_audit


with psycopg.connect(DB) as conn:
    projects = conn.execute(
        "SELECT p.id,p.name,d.blocks FROM projects p JOIN documents d ON d.project_id=p.id ORDER BY p.created_at"
    ).fetchall()
    report = []
    for project_id, name, blocks in projects:
        rows = conn.execute(
            "SELECT id,type,evidence FROM requirements WHERE project_id=%s AND review_status<>'rejected'",
            (project_id,),
        ).fetchall()
        audit = build_coverage_audit(
            blocks if isinstance(blocks, list) else json.loads(blocks),
            [
                {"id": str(row[0]), "type": row[1], "evidence": row[2]}
                for row in rows
            ],
        )
        conn.execute(
            "UPDATE documents SET coverage_audit=%s::jsonb WHERE project_id=%s",
            (json.dumps(audit, ensure_ascii=False), project_id),
        )
        report.append({"projectId": str(project_id), "name": name, "coverage": audit})
    conn.commit()

print(json.dumps(report, ensure_ascii=False, indent=2))
