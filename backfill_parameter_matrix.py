import json

import psycopg

from worker import DB, UP, extract_pdf_parameter_matrix, replace_parameter_matrix


with psycopg.connect(DB) as conn:
    projects = conn.execute(
        "SELECT id,name,stored_name FROM projects WHERE lower(stored_name) LIKE '%.pdf' ORDER BY created_at"
    ).fetchall()
    report = []
    for project_id, name, stored_name in projects:
        items = extract_pdf_parameter_matrix(UP / stored_name)
        replace_parameter_matrix(conn, project_id, items)
        report.append(
            {
                "projectId": str(project_id),
                "name": name,
                "products": len({item["productNo"] for item in items}),
                "items": len(items),
                "important": sum(item["marker"] == "▲" for item in items),
                "mandatory": sum(item["marker"] == "★" for item in items),
                "general": sum(not item["marker"] for item in items),
            }
        )
    conn.commit()

print(json.dumps(report, ensure_ascii=False, indent=2))
