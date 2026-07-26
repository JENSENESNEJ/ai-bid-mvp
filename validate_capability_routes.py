import json
import os

import psycopg


def walk(nodes):
    for node in nodes or []:
        yield node
        yield from walk(node.get("children") or [])


with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
    rows = connection.execute(
        """
        SELECT p.id,p.name,o.content
        FROM projects p JOIN outlines o ON o.project_id=p.id
        ORDER BY p.created_at
        """
    ).fetchall()

results = []
for project_id, name, content in rows:
    tasks = content.get("scoringTasks") or []
    modules = content.get("capabilityPlan") or []
    invalid_narrative = [
        task["title"] for task in tasks
        if task.get("routeType") in {
            "pricing_policy", "evaluation_rule",
            "qualification_evidence", "commercial_response",
            "technical_parameter",
        } and task.get("generatesNarrative")
    ]
    technical_without_module = [
        task["title"] for task in tasks
        if task.get("routeType") == "technical_solution"
        and not task.get("capabilityModuleIds")
    ]
    leaked_to_briefs = []
    for node in walk(content.get("chapters") or []):
        obligations = (node.get("brief") or {}).get(
            "scoringObligations"
        ) or []
        for task in obligations:
            if task.get("generatesNarrative") is False:
                leaked_to_briefs.append({
                    "section": node.get("title"),
                    "task": task.get("title"),
                    "route": task.get("routeType"),
                })
    route_examples = {
        task["title"]: task.get("routeType") for task in tasks
    }
    results.append({
        "projectId": str(project_id),
        "name": name,
        "moduleCount": len(modules),
        "moduleIds": [module.get("id") for module in modules],
        "taskCount": len(tasks),
        "routeExamples": route_examples,
        "invalidNarrativeTasks": invalid_narrative,
        "technicalTasksWithoutCapability": technical_without_module,
        "nonNarrativeTasksLeakedToSectionBriefs": leaked_to_briefs,
        "passed": (
            len(modules) >= 8
            and not invalid_narrative
            and not technical_without_module
            and not leaked_to_briefs
        ),
    })

print(json.dumps(results, ensure_ascii=False, indent=2))
