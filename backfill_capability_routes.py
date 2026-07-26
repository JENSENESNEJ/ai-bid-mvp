import collections
import json
import os
import sys

import psycopg

sys.path.insert(0, "/app")
from worker import (  # noqa: E402
    attach_section_briefs,
    build_capability_plan,
    sanitize_scoring_tasks,
)


report = []
with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
    projects = connection.execute(
        """
        SELECT p.id,p.name,o.content
        FROM projects p JOIN outlines o ON o.project_id=p.id
        ORDER BY p.created_at
        """
    ).fetchall()
    for project_id, project_name, content in projects:
        rows = connection.execute(
            """
            SELECT id,type,title,normalized_value,mandatory,ai_review_status
            FROM requirements
            WHERE project_id=%s AND review_status<>'rejected'
            ORDER BY mandatory DESC,created_at
            """,
            (project_id,),
        ).fetchall()
        requirements = [
            {
                "id": str(row[0]),
                "type": row[1],
                "title": row[2],
                "requirement": row[3],
                "mandatory": bool(row[4]),
                "riskStatus": row[5],
            }
            for row in rows
        ]
        requirement_map = {item["id"]: item for item in requirements}
        tasks = sanitize_scoring_tasks(
            content.get("scoringTasks"), requirements
        )
        analysis = content.get("projectAnalysis") or {}
        plan = build_capability_plan(
            analysis, content.get("chapters") or []
        )
        planning_context = {
            "projectProfile": content.get("projectProfile") or {},
            "implementationBlueprint": (
                content.get("implementationBlueprint") or {}
            ),
            "projectAnalysis": analysis,
            "scoringTasks": tasks,
            "capabilityPlan": plan,
        }
        attach_section_briefs(
            content.get("chapters") or [],
            requirement_map,
            planning_context,
        )
        content["scoringTasks"] = tasks
        content["capabilityPlan"] = plan
        connection.execute(
            """
            UPDATE outlines SET content=%s::jsonb,updated_at=now()
            WHERE project_id=%s
            """,
            (json.dumps(content, ensure_ascii=False), project_id),
        )
        report.append({
            "projectId": str(project_id),
            "name": project_name,
            "capabilityModules": [module["id"] for module in plan],
            "routes": dict(collections.Counter(
                task["routeType"] for task in tasks
            )),
        })
    connection.commit()

print(json.dumps(report, ensure_ascii=False, indent=2))
