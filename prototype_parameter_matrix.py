import json
import re
import unicodedata

import fitz


PDF_PATH = "/app/data/uploads/62aebdc6-1e6d-472b-becb-a552362c3824.pdf"


def clean(value):
    value = unicodedata.normalize("NFKC", str(value or ""))
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\s*\n\s*", "\n", value)
    return value.strip()


def row_intervals(page):
    values = []
    for drawing in page.get_drawings():
        for item in drawing["items"]:
            if item[0] != "re":
                continue
            rect = item[1]
            if (
                rect.width <= 1.2
                and rect.height >= 6
                and abs(rect.x0 - 276.97) <= 2
            ):
                top = max(0.0, float(rect.y0))
                bottom = min(float(page.rect.height), float(rect.y1))
                if bottom - top >= 6:
                    values.append((top, bottom, float(rect.y0), float(rect.y1)))
    grouped = []
    for value in sorted(values):
        if not grouped or abs(value[0] - grouped[-1][0]) > 1.2 or abs(value[1] - grouped[-1][1]) > 1.2:
            grouped.append(value)
    return grouped


def split_clauses(text):
    note_match = re.search(r"[\(（]\s*以上带[“\"]?[★▲]", text)
    note = clean(text[note_match.start():]) if note_match else ""
    body = text[:note_match.start()] if note_match else text
    body = re.sub(
        r"([;；。])\s*([★▲]?\s*\d+\s*[、.．])",
        r"\1\n\2",
        body,
    )
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    clauses = []
    current = []
    marker = ""
    number = ""
    start_pattern = re.compile(r"^\s*([★▲]?)\s*(\d+)\s*[、.．]\s*(.*)$")
    for line in lines:
        match = start_pattern.match(line)
        if match:
            if current:
                clauses.append(
                    {"marker": marker, "number": number, "text": clean(" ".join(current))}
                )
            marker, number = match.group(1), match.group(2)
            current = [match.group(3)]
        elif current:
            current.append(line)
        else:
            current = [line]
    if current:
        clauses.append({"marker": marker, "number": number, "text": clean(" ".join(current))})
    return [item for item in clauses if item["text"]], note


doc = fitz.open(PDF_PATH)
start = end = None
for index, page in enumerate(doc):
    text = clean(page.get_text())
    if start is None and "序号 标的名称 技术参数" in text.replace("\n", " "):
        start = index
    if start is not None and (
        re.search(r"3\.3\.\s*商务要求", text)
        or ("商务要求名称" in text and "商务要求内容" in text)
    ):
        end = index
        break
if start is None:
    raise SystemExit("parameter table start not found")
end = end or len(doc)

products = []
current_product = None
pending_fragments = []
for page_index in range(start + 1, end):
    page = doc[page_index]
    intervals = row_intervals(page)
    if not intervals:
        continue
    x0, x1, x2, x3 = 197.0, 227.5, 277.3, 538.0
    for top, bottom, raw_top, raw_bottom in intervals:
        sequence = clean(page.get_textbox(fitz.Rect(x0, top, x1, bottom))).replace("\n", "")
        name = clean(page.get_textbox(fitz.Rect(x1, top, x2, bottom))).replace("\n", "")
        parameters = clean(page.get_textbox(fitz.Rect(x2, top, x3, bottom)))
        match = re.search(r"\d+", sequence)
        if match and name:
            product = {
                "page": page_index + 1,
                "productNo": int(match.group()),
                "productName": name,
                "fragments": [*pending_fragments, parameters],
            }
            pending_fragments = []
            products.append(product)
            current_product = product
            continue
        if len(parameters) < 4:
            continue
        if raw_top < 0 and current_product is not None and not pending_fragments:
            current_product["fragments"].append(parameters)
        elif raw_top > 0:
            pending_fragments = [parameters]
        elif pending_fragments:
            pending_fragments.append(parameters)

for product in products:
    product["parameterText"] = clean("\n".join(product.pop("fragments")))
    product["clauses"], product["proofNote"] = split_clauses(product["parameterText"])

items = []
for product in products:
    for clause in product["clauses"]:
        items.append(
            {
                "productNo": product["productNo"],
                "productName": product["productName"],
                "parameterNo": clause["number"],
                "marker": clause["marker"],
                "requirement": clause["text"],
                "page": product["page"],
                "proofNote": product["proofNote"] if clause["marker"] else "",
            }
        )

duplicate_keys = []
seen_keys = set()
for item in items:
    key = (item["productNo"], item["parameterNo"], item["marker"])
    if item["parameterNo"] and key in seen_keys:
        duplicate_keys.append(item)
    seen_keys.add(key)

print(
    json.dumps(
        {
            "startPage": start + 1,
            "endPage": end + 1,
            "products": len(products),
            "productNumbers": [item["productNo"] for item in products],
            "items": len(items),
            "star": sum(item["marker"] == "★" for item in items),
            "triangle": sum(item["marker"] == "▲" for item in items),
            "rawTriangle": sum(item["parameterText"].count("▲") for item in products),
            "triangleContexts": [
                {
                    "productNo": product["productNo"],
                    "productName": product["productName"],
                    "page": product["page"],
                    "contexts": [
                        product["parameterText"][max(0, match.start() - 20):match.start() + 80]
                        for match in re.finditer("▲", product["parameterText"])
                    ],
                }
                for product in products if "▲" in product["parameterText"]
            ],
            "unmarked": sum(not item["marker"] for item in items),
            "unnumbered": sum(not item["parameterNo"] for item in items),
            "unnumberedSamples": [item for item in items if not item["parameterNo"]],
            "duplicateNumberSamples": duplicate_keys,
            "samples": items[:12],
            "triangleSamples": [item for item in items if item["marker"] == "▲"][:25],
            "lastSamples": items[-5:],
        },
        ensure_ascii=False,
        indent=2,
    )
)
