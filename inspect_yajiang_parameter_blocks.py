import json
import sys
import unicodedata

import psycopg

from worker import DB


PROJECT_ID = "62aebdc6-1e6d-472b-becb-a552362c3824"
pages = {int(value) for value in sys.argv[1:]} or {16, 17}

with psycopg.connect(DB) as conn:
    blocks = conn.execute(
        "SELECT blocks FROM documents WHERE project_id=%s", (PROJECT_ID,)
    ).fetchone()[0]

for block in blocks:
    if block.get("page") not in pages or block.get("kind") != "paragraph":
        continue
    print(
        json.dumps(
            {
                "id": block.get("id"),
                "bbox": block.get("bbox"),
                "text": unicodedata.normalize("NFKC", str(block.get("text") or "")),
            },
            ensure_ascii=False,
        )
    )
