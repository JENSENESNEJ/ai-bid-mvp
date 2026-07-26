import json
import os
import time
import uuid

import psycopg

import worker as w


PROJECT_ID = "9ec80fdb-da59-40e8-90f9-a7e4d149507e"
SAMPLES = (
    (
        (0, 0, 0, 0),
        "仅说明公共区域保洁对象如何按道路及附属区域、建筑外围、绿化景观区域、运动场地和公共设施划分，以及与楼宇保洁、宿舍保洁的交接关系。不要展开大型活动保障、垃圾清运频次、月度报告或完整质量闭环。",
    ),
    (
        (0, 3, 3, 1),
        "聚焦新建4栋宿舍楼连廊集体浴室在集中使用后的清洁衔接，写清进入条件、排水和防滑处理、地面与隔板清洁、异常转办和复查。不要泛写其他楼宇或校园道路保洁。",
    ),
    (
        (0, 6, 0, 1),
        "聚焦总务处及学校其他卫生督查部门提出问题后的分级响应、责任接收、整改、复核、销项与升级机制。内部时限必须明确标识为我方内部控制标准，不得混入一般保洁作业说明。",
    ),
)
sample_index = os.environ.get("SAMPLE_INDEX")
SELECTED_SAMPLES = (
    (SAMPLES[int(sample_index)],)
    if sample_index is not None else SAMPLES
)


def node_at(content, path):
    nodes = content.get("chapters") or []
    node = {}
    for index in path:
        node = nodes[index]
        nodes = node.get("children") or []
    return node


job_id = os.environ.get("SAMPLE_JOB_ID") or str(uuid.uuid4())
with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
    connection.execute(
        "INSERT INTO jobs(id,project_id,type,status,attempts,started_at) VALUES(%s,%s,'chapter_editor_sample','running',1,now())",
        (job_id, PROJECT_ID),
    )
    outline_row = connection.execute(
        "SELECT content FROM outlines WHERE project_id=%s",
        (PROJECT_ID,),
    ).fetchone()
    project_row = connection.execute(
        "SELECT name FROM projects WHERE id=%s",
        (PROJECT_ID,),
    ).fetchone()
    requirement_rows = connection.execute(
        """SELECT id,type,title,normalized_value,mandatory
           FROM requirements WHERE project_id=%s""",
        (PROJECT_ID,),
    ).fetchall()
    document_row = connection.execute(
        "SELECT blocks FROM documents WHERE project_id=%s",
        (PROJECT_ID,),
    ).fetchone()
    connection.commit()

content = outline_row[0] if outline_row and isinstance(outline_row[0], dict) else {}
requirements_by_id = {
    str(row[0]): {
        "id": str(row[0]),
        "type": row[1],
        "title": row[2],
        "requirement": row[3],
        "mandatory": bool(row[4]),
    }
    for row in requirement_rows
}
blocks = document_row[0] if document_row and isinstance(document_row[0], list) else []
blueprint = {
    "projectProfile": content.get("projectProfile") or {},
    "implementationBlueprint": content.get("implementationBlueprint") or {},
    "projectAnalysis": content.get("projectAnalysis") or {},
    "scoringTasks": content.get("scoringTasks") or [],
    "capabilityPlan": content.get("capabilityPlan") or [],
}

w.MODEL = w.GPT_TEXT_MODEL
w.AI_URL = w.IMAGE_BASE_URL.rstrip("/") + "/v1/chat/completions"
w.AI_KEY = w.IMAGE_KEY
w.AI_THINKING = "disabled"

results = []
errors = []
for path, role in SELECTED_SAMPLES:
    node = node_at(content, path)
    original_title = str(node.get("title") or "")
    node["title"] = w.formalize_editor_title(original_title)
    current = str(node.get("content") or "").strip()
    requirements, rejected_links = w.editor_relevant_requirements(
        node, requirements_by_id
    )
    node["requirementLinkAudit"] = {
        "version": "semantic-zero-reject-v1",
        "acceptedIds": [item["id"] for item in requirements],
        "rejected": rejected_links,
    }
    source_context = w.section_source_context(node, blocks, blueprint)
    chapter = (content.get("chapters") or [{}])[path[0]]
    context = {
        "chapterTitle": chapter.get("title"),
        "sectionIndex": path[-1] + 1,
        "sectionCount": len(SELECTED_SAMPLES),
        "sectionRole": role,
        "previousSectionTitle": None,
        "nextSectionTitle": None,
    }
    try:
        edited = w.call_editor_model(
            node,
            current,
            requirements,
            project_row[0] if project_row else "",
            source_context,
            context,
            PROJECT_ID,
            job_id,
        )
        node["previousNaturalEditorial"] = {
            "content": current,
            "title": original_title,
            "qualityAudit": node.get("qualityAudit"),
            "savedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        node["content"] = edited
        node["editorialStatus"] = "natural_sample_v2"
        node["editorialModel"] = w.GPT_TEXT_MODEL
        node["editorialSectionForm"] = w.editor_section_form(node, context)
        node["qualityAudit"] = w.evaluate_section_quality(
            edited, node, source_context, requirements
        )
        w.persist_outline_node(PROJECT_ID, list(path), node)
        results.append({
            "path": list(path),
            "title": node.get("title"),
            "beforeCharacters": len(current),
            "afterCharacters": len(edited),
            "sectionForm": node.get("editorialSectionForm"),
            "score": (node.get("qualityAudit") or {}).get("score"),
            "qualityIssues": (node.get("qualityAudit") or {}).get("issues"),
            "opening": " ".join(edited[:420].split()),
        })
    except Exception as exc:
        errors.append({
            "path": list(path),
            "title": node.get("title"),
            "error": str(exc)[:240],
        })

with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
    connection.execute(
        "UPDATE jobs SET status=%s,error_message=%s,finished_at=now() WHERE id=%s",
        (
            "succeeded" if results else "failed",
            json.dumps(errors, ensure_ascii=False)[:500] if errors else None,
            job_id,
        ),
    )
    connection.commit()

print(json.dumps({
    "jobId": job_id,
    "results": results,
    "errors": errors,
}, ensure_ascii=False))
