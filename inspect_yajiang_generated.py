import json
import re

import psycopg

from worker import DB


PROJECT_ID = "62aebdc6-1e6d-472b-becb-a552362c3824"


with psycopg.connect(DB) as conn:
    row = conn.execute(
        "SELECT content FROM outlines WHERE project_id=%s", (PROJECT_ID,)
    ).fetchone()
    requirements = {
        str(item[0]): {
            "type": item[1],
            "title": item[2],
            "value": item[3],
        }
        for item in conn.execute(
            "SELECT id,type,title,normalized_value FROM requirements WHERE project_id=%s",
            (PROJECT_ID,),
        ).fetchall()
    }

content = row[0]
sections = []


def walk(nodes, prefix=()):
    for index, node in enumerate(nodes or [], 1):
        path = (*prefix, index)
        text = str(node.get("content") or "")
        linked = [
            requirements[item]
            for item in node.get("requirementIds") or []
            if item in requirements
        ]
        sections.append(
            {
                "path": ".".join(map(str, path)),
                "title": node.get("title"),
                "description": node.get("description"),
                "status": node.get("contentStatus"),
                "mode": node.get("contentMode"),
                "characters": len(text),
                "headings": len(re.findall(r"^#{1,6}\s+", text, re.M)),
                "tables": len(re.findall(r"^\s*\|.+\|\s*$", text, re.M)),
                "numericFacts": len(re.findall(r"\d+(?:\.\d+)?(?:%|分|天|小时|分钟|项|人|套|元)", text)),
                "projectMentions": text.count("雅江") + text.count("党校"),
                "linkedRequirements": linked,
                "preview": re.sub(r"\s+", " ", text)[:900],
            }
        )
        walk(node.get("children"), path)


walk(content.get("chapters"))
generated = [item for item in sections if item["characters"]]
report = {
    "chapterCount": len(sections),
    "generatedCount": len(generated),
    "totalCharacters": sum(item["characters"] for item in generated),
    "generated": generated,
    "scoringTasks": content.get("scoringTasks") or [],
}
print(json.dumps(report, ensure_ascii=False, indent=2))
