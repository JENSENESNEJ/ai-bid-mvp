import json
import unicodedata

import psycopg

from worker import DB


PROJECT_ID = "62aebdc6-1e6d-472b-becb-a552362c3824"


def normalized(value):
    return unicodedata.normalize("NFKC", str(value or "")).strip()


with psycopg.connect(DB) as conn:
    blocks = conn.execute(
        "SELECT blocks FROM documents WHERE project_id=%s", (PROJECT_ID,)
    ).fetchone()[0]

tables = {}
for block in blocks:
    if block.get("kind") != "table-row" or not block.get("tableId"):
        continue
    group = tables.setdefault(
        block["tableId"],
        {"page": block.get("page"), "rows": []},
    )
    group["rows"].append(
        {
            "id": block.get("id"),
            "cells": [normalized(cell) for cell in block.get("cells") or []],
            "text": normalized(block.get("text")),
        }
    )

report = []
for table_id, table in tables.items():
    page = table["page"]
    if not page or page < 15 or page > 54:
        continue
    combined = "\n".join(row["text"] for row in table["rows"])
    if not any(
        token in combined
        for token in ("技术要求名称", "技术参数与性能指标", "符号标识", "标的名称")
    ):
        continue
    report.append(
        {
            "tableId": table_id,
            "page": page,
            "rowCount": len(table["rows"]),
            "starRows": sum("★" in row["text"] for row in table["rows"]),
            "triangleRows": sum("▲" in row["text"] for row in table["rows"]),
            "maxColumns": max(len(row["cells"]) for row in table["rows"]),
            "firstRows": table["rows"][:5],
            "lastRows": table["rows"][-2:],
        }
    )

print(
    json.dumps(
        {
            "tableCount": len(report),
            "rowCount": sum(item["rowCount"] for item in report),
            "starRows": sum(item["starRows"] for item in report),
            "triangleRows": sum(item["triangleRows"] for item in report),
            "tables": report,
        },
        ensure_ascii=False,
        indent=2,
    )
)
