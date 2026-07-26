import json
import sys
import uuid

import psycopg

from worker import DB, R


project_id = sys.argv[1]
job_id = str(uuid.uuid4())
with psycopg.connect(DB) as conn:
    row = conn.execute(
        "SELECT stored_name FROM projects WHERE id=%s", (project_id,)
    ).fetchone()
    if not row:
        raise SystemExit(f"project not found: {project_id}")
    conn.execute(
        "INSERT INTO jobs(id,project_id,type,status) VALUES(%s,%s,'parse','queued')",
        (job_id, project_id),
    )
    conn.commit()

R.lpush(
    "ai_bid:jobs",
    json.dumps(
        {
            "jobId": job_id,
            "projectId": project_id,
            "type": "parse",
            "storedName": row[0],
        }
    ),
)
print(json.dumps({"jobId": job_id, "projectId": project_id, "storedName": row[0]}))
