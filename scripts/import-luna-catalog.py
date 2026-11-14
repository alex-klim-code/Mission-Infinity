"""Reproducible, dependency-free import of the supplied XLSX component catalog."""
import json
import re
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

SOURCE = Path("attached_assets/Mission_Luna_Component_Catalog_(1)_1794668160749.xlsx")
TARGET = Path("artifacts/api-server/src/game/luna-catalog-data.json")
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

def slug(value):
    text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")

with zipfile.ZipFile(SOURCE) as archive:
    shared = []
    if "xl/sharedStrings.xml" in archive.namelist():
        shared = ["".join(n.itertext()) for n in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("m:si", NS)]
    rows = []
    for row in ET.fromstring(archive.read("xl/worksheets/sheet2.xml")).findall(".//m:sheetData/m:row", NS)[1:]:
        cells = {}
        for cell in row.findall("m:c", NS):
            column = re.sub(r"\d", "", cell.attrib["r"])
            value = cell.find("m:v", NS)
            kind = cell.attrib.get("t")
            cells[column] = shared[int(value.text)] if kind == "s" else "".join(cell.find("m:is", NS).itertext()) if kind == "inlineStr" else value.text if value is not None else ""
        rows.append(cells)
    assert len(rows) == 120
    components = []
    for row in rows:
        if row["A"] == "Rocket Body":
            continue  # User explicitly retained the previous three hulls and prices.
        components.append({
            "id": slug(row["A"] + " " + row["B"]), "categoryId": slug(row["A"]),
            "name": row["B"], "price": float(row["C"]), "massKg": float(row["D"]),
            "parameters": row["E"], "description": row["F"], "quality": float(row["G"]),
            "dataStatus": row["H"], "source": row["I"], "originalCategory": row.get("J", ""),
            "referenceUrl": row.get("K", ""), "qualityMethodology": row["L"],
            "originalValues": {k: row.get(k, "") for k in "MNOPQRST"},
        })
    assert len(components) == 116 and len({c["id"] for c in components}) == 116
    TARGET.write_text(json.dumps(components, ensure_ascii=False, indent=2) + "\n")
    print(f"Imported {len(components)} components; three legacy hulls are provided separately.")
