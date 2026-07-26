import json
import sys

import fitz


path = "/app/data/uploads/62aebdc6-1e6d-472b-becb-a552362c3824.pdf"
pages = [int(value) for value in sys.argv[1:]] or [22]
doc = fitz.open(path)
for page_number in pages:
    page = doc[page_number - 1]
    drawings = page.get_drawings()
    item_types = {}
    horizontal = []
    vertical = []
    rectangles = []
    for drawing in drawings:
        for item in drawing["items"]:
            item_types[item[0]] = item_types.get(item[0], 0) + 1
            if item[0] != "l":
                if item[0] == "re":
                    rect = item[1]
                    rectangles.append(
                        [round(rect.x0, 2), round(rect.y0, 2), round(rect.x1, 2), round(rect.y1, 2)]
                    )
                continue
            p1, p2 = item[1], item[2]
            if abs(p1.y - p2.y) < 0.5:
                horizontal.append([round(p1.x, 2), round(p1.y, 2), round(p2.x, 2)])
            if abs(p1.x - p2.x) < 0.5:
                vertical.append([round(p1.x, 2), round(p1.y, 2), round(p2.y, 2)])
    print(
        json.dumps(
            {
                "page": page_number,
                "drawings": len(drawings),
                "itemTypes": item_types,
                "horizontal": sorted(horizontal, key=lambda x: (x[1], x[0])),
                "vertical": sorted(vertical, key=lambda x: (x[0], x[1])),
                "rectangles": sorted(rectangles, key=lambda x: (x[1], x[0])),
            },
            ensure_ascii=False,
        )
    )
