import json
import unicodedata

import fitz


path = "/app/data/uploads/62aebdc6-1e6d-472b-becb-a552362c3824.pdf"
doc = fitz.open(path)
for page_number in (31, 32, 46, 47, 48, 49, 50, 51):
    page = doc[page_number - 1]
    selected = []
    for block in page.get_text("blocks"):
        text = unicodedata.normalize("NFKC", " ".join(str(block[4]).split()))
        if block[0] < 281 or "▲" in text or "★" in text:
            selected.append(
                {
                    "bbox": [round(value, 2) for value in block[:4]],
                    "text": text,
                }
            )
    print(json.dumps({"page": page_number, "blocks": selected}, ensure_ascii=False))
