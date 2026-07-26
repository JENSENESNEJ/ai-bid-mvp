import json

import worker


node = {"title": "浴室地面高峰后清洁作业规范"}
content = """
我方作业标准为每日冲洗2次，分别于6:30和22:30组织作业。
高压冲洗压力控制在0.3—0.5MPa，拟配备1台吸水机辅助收水。
"""
claims = ("2次", "6:30", "22:30", "0.3—0.5MPa", "1台")
print(json.dumps({
    claim: worker.is_editor_controlled_commitment(node, content, claim)
    for claim in claims
}, ensure_ascii=False))
