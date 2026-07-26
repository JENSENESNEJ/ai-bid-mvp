import json
import os

import psycopg

import worker


PROJECT_ID = "9ec80fdb-da59-40e8-90f9-a7e4d149507e"
PATH = tuple(
    int(value)
    for value in os.environ.get("TEST_PATH", "0,0,0,0").split(",")
)


def node_at(content, path):
    nodes = content.get("chapters") or []
    node = {}
    for index in path:
        node = nodes[index]
        nodes = node.get("children") or []
    return node


with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
    outline = connection.execute(
        "SELECT content FROM outlines WHERE project_id=%s", (PROJECT_ID,)
    ).fetchone()[0]
    blocks = connection.execute(
        "SELECT blocks FROM documents WHERE project_id=%s", (PROJECT_ID,)
    ).fetchone()[0]
    rows = connection.execute(
        """SELECT id,type,title,normalized_value,mandatory
           FROM requirements WHERE project_id=%s""",
        (PROJECT_ID,),
    ).fetchall()

content = outline if isinstance(outline, dict) else json.loads(outline)
node = node_at(content, PATH)
requirements_by_id = {
    str(row[0]): {
        "id": str(row[0]),
        "type": row[1],
        "title": row[2],
        "requirement": row[3],
        "mandatory": bool(row[4]),
    }
    for row in rows
}
requirements = [
    requirements_by_id[value]
    for value in worker.collect_node_requirement_ids(node)
    if value in requirements_by_id
]
accepted_requirements, rejected_requirements = (
    worker.editor_relevant_requirements(node, requirements_by_id)
)
entry = {"path": PATH, "node": node}
ranked_requirements = sorted(
    (
        worker.route_match_score(item, entry),
        item["id"],
        item["type"],
        item["title"],
        item["requirement"],
    )
    for item in requirements_by_id.values()
)
blueprint = {
    "projectProfile": content.get("projectProfile") or {},
    "implementationBlueprint": content.get("implementationBlueprint") or {},
    "projectAnalysis": content.get("projectAnalysis") or {},
    "scoringTasks": content.get("scoringTasks") or [],
    "capabilityPlan": content.get("capabilityPlan") or [],
}
source_context = worker.section_source_context(node, blocks, blueprint)
print(json.dumps({
    "title": node.get("title"),
    "description": node.get("description"),
    "requirementIds": worker.collect_node_requirement_ids(node),
    "requirements": requirements,
    "editorRequirementFilter": {
        "accepted": accepted_requirements,
        "rejected": rejected_requirements,
    },
    "rankedRequirements": [
        {
            "score": score,
            "id": requirement_id,
            "type": requirement_type,
            "title": title,
            "requirement": requirement,
        }
        for score, requirement_id, requirement_type, title, requirement
        in reversed(ranked_requirements[-20:])
    ],
    "sourceContext": source_context,
    "content": node.get("content"),
}, ensure_ascii=False))
