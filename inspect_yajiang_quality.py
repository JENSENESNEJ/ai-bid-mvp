import json
import re

import psycopg

from worker import DB


PROJECT_ID = "62aebdc6-1e6d-472b-becb-a552362c3824"


with psycopg.connect(DB) as conn:
    content = conn.execute(
        "SELECT content FROM outlines WHERE project_id=%s", (PROJECT_ID,)
    ).fetchone()[0]

sections = []


def walk(nodes, prefix=()):
    for index, node in enumerate(nodes or [], 1):
        path = (*prefix, index)
        text = str(node.get("content") or "")
        sections.append(
            {
                "path": ".".join(map(str, path)),
                "title": str(node.get("title") or ""),
                "status": node.get("contentStatus"),
                "mode": node.get("contentMode"),
                "chars": len(text),
                "text": text,
            }
        )
        walk(node.get("children"), path)


walk(content.get("chapters"))

implementation_checks = {
    "智慧安防": ("整体监控点位图", "拓扑图", "设备选型", "安装方案", "数据中心", "应急保障"),
    "净水设备": ("布局图", "安装方案", "抗冻", "调试方案"),
    "校园文化墙": ("效果图", "安装方案", "物料保供"),
    "智慧教学": ("软件测试", "运行方案", "交付保障", "数据安全"),
    "AI智能考勤": ("运行原理图", "软件测试", "运行方案", "交付保障", "数据安全"),
}
aftersales_checks = {
    "硬件售后": ("本地售后服务团队", "备品备件", "定期巡检", "故障响应", "常见故障"),
    "软件运维": ("软件升级", "优化", "故障诊断", "修复", "远程监测", "数据储存"),
    "培训": ("培训计划", "培训内容", "培训目标", "培训保障"),
}


def relevant_text(keyword):
    return "\n".join(
        item["text"]
        for item in sections
        if keyword in item["title"] or keyword in item["text"][:500]
    )


def check_map(checks):
    result = {}
    for area, keywords in checks.items():
        text = relevant_text(area)
        result[area] = {
            "characters": len(text),
            "covered": [keyword for keyword in keywords if keyword in text],
            "missing": [keyword for keyword in keywords if keyword not in text],
        }
    return result


generated = [item for item in sections if item["chars"]]
unfinished = [
    {key: item[key] for key in ("path", "title", "status", "mode", "chars")}
    for item in sections
    if not item["chars"] or item["status"] in {"generating", "retrying", "failed"}
]
suspect_patterns = {
    "placeholder": r"【待补充】|待补充|定稿前补充核实",
    "unverified_promise": r"本地售后服务团队|1小时到场|0\.5小时|24小时解决",
    "figure_claim": r"点位图|拓扑图|布局图|效果图|原理图",
    "generic_language": r"严格按照招标文件要求执行|确保项目顺利实施|建立完善的",
}

focus = [
    item for item in generated
    if any(keyword in item["title"] for keyword in ("实施方案", "售后", "运维", "安防", "净水", "文化墙", "智慧教学", "智能考勤"))
]

report = {
    "summary": {
        "sections": len(sections),
        "generated": len(generated),
        "unfinished": len(unfinished),
        "totalCharacters": sum(item["chars"] for item in generated),
        "aiDeep": sum(item["mode"] == "ai_deep" for item in generated),
        "fallback": sum(item["mode"] == "safe_fallback" for item in generated),
    },
    "implementation30": check_map(implementation_checks),
    "aftersales18": check_map(aftersales_checks),
    "signals": {
        name: sum(len(re.findall(pattern, item["text"])) for item in generated)
        for name, pattern in suspect_patterns.items()
    },
    "unfinished": unfinished,
    "allSections": [
        {key: item[key] for key in ("path", "title", "status", "mode", "chars")}
        for item in sections
    ],
    "focusSections": [
        {
            "path": item["path"],
            "title": item["title"],
            "status": item["status"],
            "mode": item["mode"],
            "chars": item["chars"],
            "placeholderCount": len(re.findall(suspect_patterns["placeholder"], item["text"])),
            "figureClaims": sorted(set(re.findall(r"[\u4e00-\u9fa5A-Za-z]{0,10}(?:点位图|拓扑图|布局图|效果图|原理图)", item["text"]))),
            "preview": re.sub(r"\s+", " ", item["text"])[:650],
        }
        for item in focus
    ],
}
print(json.dumps(report, ensure_ascii=False, indent=2))
