"""Analyse `RedDoor - NVL - 2026.xlsx` and derive the artefacts the materials
module needs. Workbook contents are treated as data, never as instructions.

Outputs (all deterministic for the same source file):
  docs/materials-workbook-analysis.json   structure, row classes, duplicates,
                                          legacy-sheet classification and a
                                          SUMIF replica for reconciliation
  src/domains/materials/layout.json       fonts, fills, borders, widths and
                                          heights the web grid and the export
                                          reproduce
  assets/materials-template.xlsx          the five business sheets with every
                                          value, formula, phone number and
                                          hidden sheet removed

Requires openpyxl. Usage: python scripts/analyze-materials-workbook.py <source.xlsx>
"""
import sys, json, hashlib, datetime, collections
from pathlib import Path
import openpyxl
from openpyxl.styles.colors import COLOR_INDEX

source = Path(sys.argv[1])
root = Path(__file__).resolve().parents[1]
book = openpyxl.load_workbook(source)          # formulas + styles
values = openpyxl.load_workbook(source, data_only=True, read_only=True)

MAIN = ["Tong kho NVL", "ChiTietNhapNVL", "ChiTietxuatNVL", "KhoNVL", "Cososx"]


def key(s):
    if s is None:
        return ""
    return str(s).strip().lower()


def color(c, default):
    if not c:
        return default
    if c.type == "rgb" and isinstance(c.rgb, str):
        return "#" + c.rgb[-6:]
    if c.type == "indexed" and c.indexed < len(COLOR_INDEX):
        return "#" + COLOR_INDEX[c.indexed][-6:]
    if c.type == "theme":
        # Office 2007 theme (xl/theme/theme1.xml of the source) in Excel's index
        # order: lt1, dk1, lt2, dk2, accent1..6. Tints lighten/darken in HSL,
        # exactly as Excel renders "Text 2, Lighter 60%".
        theme = {0: "#ffffff", 1: "#000000", 2: "#eeece1", 3: "#1f497d", 4: "#4f81bd",
                 5: "#c0504d", 6: "#9bbb59", 7: "#8064a2", 8: "#4bacc6", 9: "#f79646"}
        base = theme.get(c.theme)
        if base is None:
            return default
        return tinted(base, c.tint or 0)
    return default


def tinted(hex_color, tint):
    import colorsys
    r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    l = l * (1 + tint) if tint < 0 else l + (1 - l) * tint
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


styles = {}


def style_of(cell):
    sid = cell.style_id
    if sid not in styles:
        f, a = cell.font, cell.alignment
        css = {
            "fontFamily": f.name or "Times New Roman",
            "fontSize": round((f.sz or 12) * 4 / 3, 2),
            "fontWeight": 700 if f.b else 400,
            "fontStyle": "italic" if f.i else "normal",
            "color": color(f.color, "#000000"),
            "backgroundColor": color(cell.fill.fgColor, "#ffffff") if cell.fill.patternType == "solid" else "#ffffff",
            "textAlign": a.horizontal if a.horizontal in ["left", "center", "right", "justify"] else "left",
            "verticalAlign": {"center": "middle"}.get(a.vertical, a.vertical or "bottom"),
            "whiteSpace": "pre-wrap" if a.wrap_text else "nowrap",
        }
        for side in ["left", "right", "top", "bottom"]:
            b = getattr(cell.border, side)
            css["border" + side.title()] = ("1px solid " + color(b.color, "#000000")) if b and b.style else "1px solid #e2e2e2"
        styles[sid] = {"css": css, "format": cell.number_format}
    return sid


def width(ws, col):
    dim = next((d for d in ws.column_dimensions.values() if d.min and d.min <= col <= d.max), None)
    return round(dim.width, 2) if dim and dim.width else round(ws.sheet_format.defaultColWidth or 8.43, 2)


def height(ws, r):
    h = ws.row_dimensions[r].height
    return round((h if h else ws.sheet_format.defaultRowHeight) * 4 / 3, 2)


def is_formula(v):
    return isinstance(v, str) and v.startswith("=")


def blank(v):
    return v is None or (isinstance(v, str) and v.strip() == "")


def iso(d):
    if isinstance(d, datetime.datetime):
        return d.date().isoformat()
    if isinstance(d, datetime.date):
        return d.isoformat()
    return None


# ---------------------------------------------------------------- ledgers
def ledger(name, cols, codecol, qtycol, datecol=1):
    ws, wsv = book[name], values[name]
    rows, classes, anomalies = [], collections.Counter(), []
    cached = {r: row for r, row in enumerate(wsv.iter_rows(min_row=1, max_row=ws.max_row, max_col=12, values_only=True), start=1)}
    for r in range(4, ws.max_row + 1):
        raw = [ws.cell(r, c).value for c in range(1, 13)]
        if all(v is None for v in raw):
            classes["empty"] += 1
            continue
        if all(v is None or is_formula(v) for v in raw):
            classes["formulaOnly"] += 1
            continue
        if all(v is None or is_formula(v) or blank(v) for v in raw):
            classes["whitespaceOnly"] += 1
            anomalies.append({"row": r, "kind": "whitespace-only", "cells": [ws.cell(r, c).coordinate for c in range(1, 13) if isinstance(raw[c - 1], str) and blank(raw[c - 1]) and raw[c - 1] != ""]})
            continue
        date, code, qty = raw[datecol - 1], raw[codecol - 1], raw[qtycol - 1]
        if not isinstance(date, (datetime.datetime, datetime.date)) or blank(code) or qty is None:
            classes["partial"] += 1
            anomalies.append({"row": r, "kind": "partial", "values": {ws.cell(r, c).coordinate: (iso(v) or v) for c, v in enumerate(raw, 1) if v is not None and not is_formula(v) and not blank(v)}})
            continue
        classes["transaction"] += 1
        q = cached[r][qtycol - 1] if is_formula(qty) else qty
        rec = {"row": r, "date": iso(date), "quantity": q}
        for c in cols:
            v = raw[c - 1]
            rec[cols[c]] = cached[r][c - 1] if is_formula(v) else v
            if isinstance(rec[cols[c]], datetime.datetime):
                rec[cols[c]] = iso(rec[cols[c]])
        if is_formula(qty):
            anomalies.append({"row": r, "kind": "quantity-formula", "formula": qty, "cached": q})
        if date.year != 2026:
            anomalies.append({"row": r, "kind": "date-outside-2026", "date": iso(date)})
        if isinstance(code, str) and code != code.strip():
            anomalies.append({"row": r, "kind": "code-whitespace", "code": code})
        rows.append(rec)
    outside = [(ws.cell(r, c).coordinate, ws.cell(r, c).value, cached[r][c - 1]) for r in range(1, ws.max_row + 1) for c in range(10, 13) if ws.cell(r, c).value is not None]
    header = [ws.cell(3, c).value for c in range(1, 10)]
    ps = ws.page_setup
    return {
        "sheet": name, "dimension": ws.dimensions, "title": ws["A1"].value, "merged": [str(m) for m in ws.merged_cells.ranges],
        "freezePanesInSource": ws.freeze_panes, "header": header, "headerRow": 3, "firstDataRow": 4,
        "widths": [width(ws, c) for c in range(1, 10)],
        "heights": {"title": height(ws, 1), "spacer": height(ws, 2), "header": height(ws, 3), "data": height(ws, 4)},
        "rowHeightHistogram": collections.Counter(height(ws, r) for r in range(4, ws.max_row + 1)).most_common(5),
        "formats": {ws.cell(4, c).column_letter: ws.cell(4, c).number_format for c in range(1, 10)},
        "pageSetup": {"orientation": ps.orientation, "paperSize": ps.paperSize, "fitToWidth": ps.fitToWidth, "fitToHeight": ps.fitToHeight, "printArea": ws.print_area, "printTitleRows": ws.print_title_rows},
        "rowClasses": dict(classes), "transactions": rows, "anomalies": anomalies,
        "cellsOutsideTable": [{"cell": a, "value": v, "cached": c} for a, v, c in outside],
        "styles": {"title": style_of(ws["A1"]), "header": [style_of(ws.cell(3, c)) for c in range(1, 10)], "data": [style_of(ws.cell(4, c)) for c in range(1, 10)]},
    }


inbound = ledger("ChiTietNhapNVL", {2: "materialCode", 3: "materialName", 4: "description", 5: "unit", 7: "unitPrice", 8: "amount", 9: "note"}, 2, 6)
outbound = ledger("ChiTietxuatNVL", {2: "facilityCode", 3: "facilityName", 4: "materialCode", 5: "materialName", 6: "description", 7: "unit", 9: "note"}, 4, 8)

# ---------------------------------------------------------------- masters
ws = book["KhoNVL"]
catalog = []
for r in range(3, ws.max_row + 1):
    code = ws.cell(r, 2).value
    if blank(code):
        if any(not blank(ws.cell(r, c).value) for c in range(1, 7)):
            catalog.append({"row": r, "code": None, "cells": {ws.cell(r, c).coordinate: ws.cell(r, c).value for c in range(1, 7) if ws.cell(r, c).value is not None}})
        continue
    catalog.append({"row": r, "stt": ws.cell(r, 1).value, "code": code, "name": ws.cell(r, 3).value, "unit": ws.cell(r, 4).value, "openingE": ws.cell(r, 5).value, "columnF": ws.cell(r, 6).value})
cat_rows = [c for c in catalog if c["code"]]
dups = collections.defaultdict(list)
for c in cat_rows:
    dups[key(c["code"])].append(c["row"])
kho = {
    "sheet": "KhoNVL", "dimension": ws.dimensions, "header": [ws.cell(2, c).value for c in range(1, 7)], "headerRow": 2, "firstDataRow": 3,
    "widths": [width(ws, c) for c in range(1, 7)], "heights": {"header": height(ws, 2), "data": height(ws, 3)},
    "rows": catalog, "materialCount": len(cat_rows),
    "caseInsensitiveDuplicates": {k: v for k, v in dups.items() if len(v) > 1},
    "codesWithWhitespace": [c["code"] for c in cat_rows if c["code"] != c["code"].strip()],
    "duplicateNames": {k: v for k, v in collections.Counter(key(c["name"]) for c in cat_rows).items() if v > 1},
    "columnEValues": {c["code"]: c["openingE"] for c in cat_rows if c["openingE"] is not None},
    "columnFValues": {c["code"]: c["columnF"] for c in cat_rows if c["columnF"] is not None},
    "columnFHeader": ws.cell(2, 6).value,
    "styles": {"header": [style_of(ws.cell(2, c)) for c in range(1, 7)], "data": [style_of(ws.cell(3, c)) for c in range(1, 7)]},
}

ws = book["Cososx"]
facilities = []
for r in range(5, ws.max_row + 1):
    code = ws.cell(r, 3).value
    if blank(code):
        continue
    facilities.append({"row": r, "type": ws.cell(r, 2).value, "code": code, "name": ws.cell(r, 4).value, "phone": ws.cell(r, 5).value, "note": ws.cell(r, 6).value})
fd = collections.defaultdict(list)
for f in facilities:
    fd[key(f["code"])].append(f["row"])
coso = {
    "sheet": "Cososx", "dimension": ws.dimensions, "header": [ws.cell(4, c).value for c in range(1, 7)], "headerRow": 4, "firstDataRow": 5,
    "widths": [width(ws, c) for c in range(1, 7)], "heights": {"header": height(ws, 4), "data": height(ws, 5)},
    "facilityCount": len(facilities),
    "rows": [{k: v for k, v in f.items() if k != "phone"} | {"hasPhone": bool(f["phone"]) and str(f["phone"]).strip() not in ("", "0")} for f in facilities],
    "caseInsensitiveDuplicates": {k: v for k, v in fd.items() if len(v) > 1},
    "codesWithWhitespace": [f["code"] for f in facilities if f["code"] != f["code"].strip()],
    "namedRangeCoverage": "MaNhaCungCap = Cososx!$C$5:$E$103",
    "styles": {"header": [style_of(ws.cell(4, c)) for c in range(1, 7)], "data": [style_of(ws.cell(5, c)) for c in range(1, 7)]},
}

# ---------------------------------------------------------------- summary sheet (Tong kho NVL)
ws, wsv = book["Tong kho NVL"], values["Tong kho NVL"]
cached = {r: row for r, row in enumerate(wsv.iter_rows(min_row=1, max_row=ws.max_row, max_col=14, values_only=True), start=1)}
summary_rows, extra = [], []
trailer = False   # everything from the "Tổng" row down is signature/footer, not material rows
for r in range(4, ws.max_row + 1):
    code = ws.cell(r, 4).value
    if key(ws.cell(r, 3).value) == "tổng":
        trailer = True
    if blank(code) or trailer:
        cells = {ws.cell(r, c).coordinate: ws.cell(r, c).value for c in range(1, 15) if ws.cell(r, c).value is not None}
        if cells:
            extra.append({"row": r, "cells": cells, "height": height(ws, r), "styles": [style_of(ws.cell(r, c)) for c in range(1, 12)]})
        continue
    summary_rows.append({
        "row": r, "stt": ws.cell(r, 3).value, "code": code,
        "nameFormula": ws.cell(r, 5).value if is_formula(ws.cell(r, 5).value) else None, "name": cached[r][4], "unit": ws.cell(r, 6).value,
        "opening": ws.cell(r, 7).value, "inboundFormula": ws.cell(r, 8).value, "inbound": cached[r][7],
        "outboundFormula": ws.cell(r, 9).value, "outbound": cached[r][8], "closingFormula": ws.cell(r, 10).value, "closing": cached[r][9],
        "note": ws.cell(r, 11).value,
        "stray": {ws.cell(r, c).coordinate: ws.cell(r, c).value for c in range(12, 15) if ws.cell(r, c).value is not None},
    })
sd = collections.defaultdict(list)
for s in summary_rows:
    sd[key(s["code"])].append(s["row"])
cat_by_key = {}
for c in cat_rows:
    cat_by_key.setdefault(key(c["code"]), c)   # VLOOKUP: first match wins
tong = {
    "sheet": "Tong kho NVL", "dimension": ws.dimensions, "title": ws["C1"].value, "subtitle": ws["C2"].value, "merged": [str(m) for m in ws.merged_cells.ranges],
    "hiddenColumns": [k for k, v in ws.column_dimensions.items() if v.hidden], "freezePanesInSource": ws.freeze_panes, "autoFilterInSource": ws.auto_filter.ref,
    "header": [ws.cell(3, c).value for c in range(1, 12)], "headerRow": 3, "firstDataRow": 4,
    "widths": [width(ws, c) for c in range(1, 12)], "heights": {"title": height(ws, 1), "subtitle": height(ws, 2), "header": height(ws, 3), "data": height(ws, 4)},
    "formats": {ws.cell(4, c).column_letter: ws.cell(4, c).number_format for c in range(1, 12)},
    "rows": summary_rows, "materialCount": len(summary_rows), "rowsAfterTable": extra,
    "caseInsensitiveDuplicates": {k: v for k, v in sd.items() if len(v) > 1},
    "notInKhoNVL": [s["code"] for s in summary_rows if key(s["code"]) not in cat_by_key],
    "unitConflictsWithKhoNVL": [{"code": s["code"], "tongKho": s["unit"], "khoNVL": cat_by_key[key(s["code"])]["unit"]} for s in summary_rows if key(s["code"]) in cat_by_key and key(s["unit"]) != key(cat_by_key[key(s["code"])]["unit"])],
    "caseDiffersFromKhoNVL": [{"tongKho": s["code"], "khoNVL": cat_by_key[key(s["code"])]["code"]} for s in summary_rows if key(s["code"]) in cat_by_key and s["code"] != cat_by_key[key(s["code"])]["code"]],
    "floatArtifacts": [{"cell": f"{col}{s['row']}", "value": v} for s in summary_rows for col, v in (("G", s["opening"]), ("H", s["inbound"]), ("I", s["outbound"]), ("J", s["closing"])) if isinstance(v, float) and abs(v - round(v, 6)) > 1e-9],
    "styles": {"title": style_of(ws["C1"]), "subtitle": style_of(ws["C2"]), "header": [style_of(ws.cell(3, c)) for c in range(1, 12)], "data": [style_of(ws.cell(4, c)) for c in range(1, 12)]},
}


# ---------------------------------------------------------------- SUMIF replica (case-insensitive, trimmed — Excel semantics)
def sumif(rows, field):
    out = collections.defaultdict(float)
    for t in rows:
        out[key(t[field])] += float(t["quantity"] or 0)
    return out


in_sum, out_sum = sumif(inbound["transactions"], "materialCode"), sumif(outbound["transactions"], "materialCode")
recon, mism = [], 0
for s in summary_rows:
    k = key(s["code"])
    ci, co = in_sum.get(k, 0.0), out_sum.get(k, 0.0)
    closing = float(s["opening"] or 0) + ci - co
    ok = abs(ci - float(s["inbound"] or 0)) < 1e-6 and abs(co - float(s["outbound"] or 0)) < 1e-6 and abs(closing - float(s["closing"] or 0)) < 1e-6
    mism += 0 if ok else 1
    recon.append({"code": s["code"], "opening": s["opening"], "excelInbound": s["inbound"], "replicaInbound": round(ci, 6), "excelOutbound": s["outbound"], "replicaOutbound": round(co, 6), "excelClosing": s["closing"], "replicaClosing": round(closing, 6), "matches": ok})
listed = {key(s["code"]) for s in summary_rows}
movement_only = sorted({k for k in list(in_sum) + list(out_sum) if k not in listed})
unknown_material = sorted({t["materialCode"] for t in inbound["transactions"] + outbound["transactions"] if key(t["materialCode"]) not in cat_by_key})
fac_by_key = {}
for f in facilities:
    fac_by_key.setdefault(key(f["code"]), f)
unknown_facility = sorted({t["facilityCode"] for t in outbound["transactions"] if key(t["facilityCode"]) not in fac_by_key})


# ---------------------------------------------------------------- other sheets
def classify(name):
    ws = values[name]
    first_row = next(iter(ws.iter_rows(min_row=1, max_row=1, max_col=3, values_only=True)), (None,))
    title = first_row[0] if isinstance(first_row[0], str) else ""
    dates = [c for row in ws.iter_rows(min_row=1, max_row=min(ws.max_row, 400), max_col=12, values_only=True) for c in row if isinstance(c, datetime.datetime)]
    years = sorted({d.year for d in dates})
    if "BÁN HÀNG" in title:
        kind = "legacy-2016-paint-sales"
    elif "SỔ CHI TIẾT" in title or "XUẤT KHO" in title.upper():
        kind = "legacy-per-material-ledger"
    elif name in ("Sheet4", "Sheet6", "Sheet10"):
        kind = "blank"
    else:
        kind = "form-or-unrelated"
    return {"name": name, "state": book[name].sheet_state, "dimension": book[name].dimensions, "title": title.replace("\n", " / "), "years": years, "dateRows": len(dates), "kind": kind}


others = [classify(s.title) for s in book.worksheets if s.title not in MAIN]

# overlap of per-material ledgers with ChiTietxuatNVL (date, facility, material, quantity)
out_index = collections.Counter((t["date"], key(t["facilityCode"]), key(t["materialCode"]), float(t["quantity"] or 0)) for t in outbound["transactions"])
out_index_noyear = collections.Counter((t["date"][5:], key(t["facilityCode"]), key(t["materialCode"]), float(t["quantity"] or 0)) for t in outbound["transactions"])
overlap = []
for o in others:
    if o["kind"] != "legacy-per-material-ledger":
        continue
    ws = values[o["name"]]
    total = exact = noyear = rows2026 = 0
    for row in ws.iter_rows(min_row=3, max_row=ws.max_row, max_col=9, values_only=True):
        d = row[0]
        if not isinstance(d, datetime.datetime) or not isinstance(row[7], (int, float)):
            continue
        total += 1
        rows2026 += d.year == 2026
        k = (iso(d), key(row[1]), key(row[3]), float(row[7]))
        if out_index.get(k):
            exact += 1
        elif out_index_noyear.get((k[0][5:],) + k[1:]):
            noyear += 1
    overlap.append({"sheet": o["name"], "state": o["state"], "years": o["years"], "dataRows": total, "rows2026": rows2026, "matchExact": exact, "matchIgnoringYear": noyear, "unmatched": total - exact - noyear})

report = {
    "source": source.name, "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(), "sheetCount": len(book.sheetnames),
    "definedNames": {k: v.attr_text for k, v in book.defined_names.items()},
    "sheetLocalNames": {ws.title: {k: v.attr_text for k, v in ws.defined_names.items()} for ws in book.worksheets if ws.defined_names},
    "summary": tong, "inbound": inbound, "outbound": outbound, "catalog": kho, "facilities": coso,
    "reconciliation": {"materials": len(recon), "matched": len(recon) - mism, "mismatched": mism, "rows": recon, "movementWithoutSummaryRow": movement_only, "unknownMaterialCodes": unknown_material, "unknownFacilityCodes": unknown_facility},
    "otherSheets": others, "legacyOverlap": overlap,
}
(root / "docs/materials-workbook-analysis.json").write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf8")

layout = {
    "sourceSha256": report["sourceSha256"],
    "styles": styles,
    "summary": {
        "title": tong["title"], "headers": tong["header"][2:11], "widths": tong["widths"][2:11], "heights": tong["heights"], "formats": [tong["formats"][c] for c in "CDEFGHIJK"],
        "styles": {"title": tong["styles"]["title"], "subtitle": tong["styles"]["subtitle"], "header": tong["styles"]["header"][2:11], "data": tong["styles"]["data"][2:11]},
        "rowsAfterTable": [{"cells": e["cells"], "height": e["height"], "styles": e["styles"][2:11]} for e in extra],
    },
    "inbound": {"title": inbound["title"], "headers": inbound["header"], "widths": inbound["widths"], "heights": inbound["heights"], "formats": [inbound["formats"][c] for c in "ABCDEFGHI"], "styles": inbound["styles"]},
    "outbound": {"title": outbound["title"], "headers": outbound["header"], "widths": outbound["widths"], "heights": outbound["heights"], "formats": [outbound["formats"][c] for c in "ABCDEFGHI"], "styles": outbound["styles"]},
    "catalog": {"headers": kho["header"], "widths": kho["widths"], "heights": kho["heights"], "styles": kho["styles"]},
    "facilities": {"headers": coso["header"], "widths": coso["widths"], "heights": coso["heights"], "styles": coso["styles"]},
}
(root / "src/domains/materials/layout.json").write_text(json.dumps(layout, ensure_ascii=False, separators=(",", ":")), encoding="utf8")

# ---------------------------------------------------------------- template: five sheets, no data, no names, no hidden sheets
for other in list(book):
    if other.title not in MAIN:
        book.remove(other)
book.defined_names.clear()
for ws in book.worksheets:
    ws.defined_names.clear()
    ws.data_validations.dataValidation = []
    ws.conditional_formatting = type(ws.conditional_formatting)()

    ws.sheet_view.topLeftCell = "A1"
first = {"Tong kho NVL": 4, "ChiTietNhapNVL": 4, "ChiTietxuatNVL": 4, "KhoNVL": 3, "Cososx": 5}
for name, start in first.items():
    ws = book[name]
    for rng in list(ws.merged_cells.ranges):
        if rng.min_row >= start:
            ws.unmerge_cells(str(rng))
    for row in ws.iter_rows(min_row=1, max_row=start):
        for cell in row:
            if cell.row >= start or is_formula(cell.value):
                cell.value = None
    if ws.max_row > start:
        ws.delete_rows(start + 1, ws.max_row - start)
    for r in list(ws.row_dimensions):
        if r > start:
            del ws.row_dimensions[r]
    ws.auto_filter.ref = None
    ws.print_area = None
book["Tong kho NVL"].freeze_panes = "A4"
book["ChiTietNhapNVL"].freeze_panes = "A4"
book["ChiTietxuatNVL"].freeze_panes = "A4"
book["KhoNVL"].freeze_panes = "A3"
book["Cososx"].freeze_panes = "A5"
for name in ("Tong kho NVL", "ChiTietNhapNVL", "ChiTietxuatNVL"):
    book[name].print_title_rows = "1:3"
book["Cososx"]["A1"].value = None
book["Cososx"]["A2"].value = None
book.active = 0
book.save(root / "assets/materials-template.xlsx")

print(json.dumps({
    "sheets": len(report["otherSheets"]) + 5, "inbound": inbound["rowClasses"], "outbound": outbound["rowClasses"],
    "materialsKhoNVL": kho["materialCount"], "materialsTongKho": tong["materialCount"], "facilities": coso["facilityCount"],
    "reconciliation": {k: v for k, v in report["reconciliation"].items() if k != "rows"},
    "reconMismatches": [r for r in recon if not r["matches"]],
    "legacyOverlap": overlap, "tongKhoUnitConflicts": tong["unitConflictsWithKhoNVL"], "tongKhoDup": tong["caseInsensitiveDuplicates"],
    "khoDup": kho["caseInsensitiveDuplicates"], "khoDupNames": kho["duplicateNames"], "cosoDup": coso["caseInsensitiveDuplicates"], "cosoWhitespace": coso["codesWithWhitespace"],
    "khoWhitespace": kho["codesWithWhitespace"], "columnF": kho["columnFValues"], "columnE": kho["columnEValues"], "columnFHeader": kho["columnFHeader"],
    "inAnomalies": inbound["anomalies"], "outAnomalies": outbound["anomalies"], "outsideCells": outbound["cellsOutsideTable"] + inbound["cellsOutsideTable"],
    "tongExtra": [e["cells"] for e in extra], "floatArtifacts": tong["floatArtifacts"], "notInKho": tong["notInKhoNVL"], "caseDiffers": tong["caseDiffersFromKhoNVL"],
    "formats": {"summary": tong["formats"], "inbound": inbound["formats"], "outbound": outbound["formats"]},
    "heights": {"summary": tong["heights"], "inbound": inbound["heights"], "outbound": outbound["heights"]},
    "pageSetup": {"inbound": inbound["pageSetup"], "outbound": outbound["pageSetup"]},
}, ensure_ascii=False, indent=1, default=str))
