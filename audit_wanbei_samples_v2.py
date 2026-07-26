import json
import os
import re

import psycopg

import worker


PROJECT_ID = "9ec80fdb-da59-40e8-90f9-a7e4d149507e"
PATHS = ((0, 0, 0, 0), (0, 3, 3, 1), (0, 6, 0, 1))
JOB_IDS = (
    "0b88b39b-b944-4217-bfb7-953222f3b8f5",
    "7c640ff0-bff3-4b65-b0f1-ca5435f05cae",
    "042c20bb-b5ae-4191-9ad8-2b27665c9018",
    "2d73fd3f-6307-464e-ae3d-1eb14c25a176",
    "d9931dd3-f17d-4280-ab48-71a718d6f3ff",
    "cdb89883-7594-40c5-864d-a79310d07139",
    "c806490d-f30a-4a53-ad02-9931b53ed456",
    "4e8cdc59-6199-48a3-9eeb-18c0ca2fb6d6",
)


def node_at(content, path):
    nodes = content.get("chapters") or []
    node = {}
    for index in path:
        node = nodes[index]
        nodes = node.get("children") or []
    return node


with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
    row = connection.execute(
        "SELECT content FROM outlines WHERE project_id=%s", (PROJECT_ID,)
    ).fetchone()
    costs = connection.execute(
        """SELECT job_id,model,status,input_tokens,output_tokens,cost_usd
           FROM ai_runs WHERE job_id=ANY(%s)
           ORDER BY finished_at""",
        (list(JOB_IDS),),
    ).fetchall()

content = row[0] if isinstance(row[0], dict) else json.loads(row[0])
samples = []
for path in PATHS:
    node = node_at(content, path)
    text = str(node.get("content") or "")
    samples.append({
        "path": path,
        "title": node.get("title"),
        "status": node.get("editorialStatus"),
        "sectionForm": node.get("editorialSectionForm"),
        "characters": len(text),
        "headings": re.findall(r"^#{2,5}\s+(.+)$", text, re.MULTILINE),
        "metaIssues": worker.formal_bid_voice_issues(text),
        "metaMarkerHits": {
            marker: text.count(marker)
            for marker in worker.META_EXPLANATION_MARKERS if marker in text
        },
        "awkwardHits": {
            marker: text.count(marker)
            for marker in worker.AWKWARD_BID_TERMS if marker in text
        },
        "bidderActors": {
            marker: text.count(marker)
            for marker in worker.BIDDER_ACTOR_MARKERS if marker in text
        },
        "qualityAudit": node.get("qualityAudit"),
        "opening": " ".join(text[:260].split()),
    })

print(json.dumps({
    "samples": samples,
    "runs": [
        {
            "jobId": str(row[0]),
            "model": row[1],
            "status": row[2],
            "inputTokens": row[3],
            "outputTokens": row[4],
            "costUsd": float(row[5]),
        }
        for row in costs
    ],
    "costUsd": round(sum(float(row[5]) for row in costs), 6),
}, ensure_ascii=False))
