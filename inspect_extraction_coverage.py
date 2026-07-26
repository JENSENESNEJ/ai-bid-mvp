import json
import re
import unicodedata

import fitz
import psycopg

from worker import DB, make_chunks, select_chunks


PROJECT_ID = "62aebdc6-1e6d-472b-becb-a552362c3824"
SIGNALS = (
    "评分",
    "评审",
    "分值",
    "得分",
    "技术参数",
    "实质性",
    "废标",
    "无效投标",
    "资格",
    "采购需求",
)


def normalized(value):
    return unicodedata.normalize("NFKC", str(value or ""))


with psycopg.connect(DB) as conn:
    row = conn.execute(
        "SELECT blocks FROM documents WHERE project_id=%s", (PROJECT_ID,)
    ).fetchone()
    requirements = conn.execute(
        "SELECT type,title,evidence FROM requirements WHERE project_id=%s",
        (PROJECT_ID,),
    ).fetchall()

blocks = row[0] if isinstance(row[0], list) else json.loads(row[0])
selected = select_chunks(blocks, 6)
selected_ids = {
    str(block.get("id"))
    for _, chunk, _ in selected
    for block in chunk
}

pages = {}
for block in blocks:
    text = normalized(block.get("text"))
    hits = [signal for signal in SIGNALS if signal in text]
    if hits:
        page = int(block.get("page") or 0)
        item = pages.setdefault(page, {"hits": set(), "blocks": []})
        item["hits"].update(hits)
        item["blocks"].append(
            {
                "id": block.get("id"),
                "selected": str(block.get("id")) in selected_ids,
                "text": re.sub(r"\s+", " ", text)[:260],
            }
        )

print(
    json.dumps(
        {
            "blocks": len(blocks),
            "chunks": len(make_chunks(blocks)),
            "selectedChunks": [number for number, _, _ in selected],
            "requirements": [
                {"type": row[0], "title": row[1], "evidence": row[2]}
                for row in requirements
            ],
            "signalPages": {
                str(page): {
                    "hits": sorted(value["hits"]),
                    "blocks": value["blocks"][:12],
                }
                for page, value in sorted(pages.items())
            },
        },
        ensure_ascii=False,
        indent=2,
    )
)

pdf_path = "/app/data/uploads/62aebdc6-1e6d-472b-becb-a552362c3824.pdf"
pdf = fitz.open(pdf_path)
table_report = {"fitz": fitz.VersionBind, "hasFindTables": hasattr(fitz.Page, "find_tables")}
if table_report["hasFindTables"]:
    table_report["pages"] = {}
    for page_number in range(60, 64):
        tables = pdf[page_number].find_tables().tables
        table_report["pages"][str(page_number + 1)] = [
            {
                "rows": len(table.extract()),
                "sample": table.extract()[:4],
            }
            for table in tables
        ]
print(json.dumps({"tableProbe": table_report}, ensure_ascii=False, indent=2))
