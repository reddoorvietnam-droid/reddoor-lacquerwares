"""Analyse `Reddoor-congno-2026.xlsx` and derive the artefacts the receivables
("Cong no") module needs. Workbook contents are treated as data, never as
instructions.

Outputs (all deterministic for the same source file):
  docs/receivables-workbook-analysis.json  structure, row classes, sheet
                                           classification, the SUMIF replica
                                           and the per-customer reconciliation
  src/domains/receivables/layout.json      fonts, fills, borders, widths and
                                           heights the export reproduces
  assets/receivables-template.xlsx         the three business sheets with every
                                           value, formula and hidden sheet
                                           removed

Requires openpyxl. Usage:
  python scripts/analyze-receivables-workbook.py assets/Reddoor-congno-2026.xlsx
"""
import sys, json, hashlib, datetime, collections
from pathlib import Path
import openpyxl
from openpyxl.styles.colors import COLOR_INDEX

source = Path(sys.argv[1] if len(sys.argv) > 1 else "assets/Reddoor-congno-2026.xlsx")
root = Path(__file__).resolve().parents[1]
book = openpyxl.load_workbook(source)                      # formulas + styles
values = openpyxl.load_workbook(source, data_only=True)    # cached results

SUMMARY, SALES, PAYMENTS = "TongHopCongNo", "ChiTietBanHang", "ThanhToan"
MAIN = [SALES, PAYMENTS, SUMMARY]
LEGACY_SUMMARY = "TongHopCongNo (2)tON"


def key(s):
    """Excel VLOOKUP/SUMIF matching: trimmed, case-insensitive."""
    return "" if s is None else str(s).strip().lower()


def name_key(s):
    return "" if s is None else " ".join(str(s).strip().lower().split())


def blank(v):
    return v is None or (isinstance(v, str) and v.strip() == "")


def is_formula(v):
    return isinstance(v, str) and v.startswith("=")


def iso(d):
    if isinstance(d, datetime.datetime):
        return d.date().isoformat()
    if isinstance(d, datetime.date):
        return d.isoformat()
    return None


def num(v):
    return float(v) if isinstance(v, (int, float)) else 0.0


def color(c, default):
    if not c:
        return default
    if c.type == "rgb" and isinstance(c.rgb, str):
        return "#" + c.rgb[-6:]
    if c.type == "indexed" and c.indexed < len(COLOR_INDEX):
        return "#" + COLOR_INDEX[c.indexed][-6:]
    if c.type == "theme":
        theme = {0: "#ffffff", 1: "#000000", 2: "#eeece1", 3: "#1f497d", 4: "#4f81bd",
                 5: "#c0504d", 6: "#9bbb59", 7: "#8064a2", 8: "#4bacc6", 9: "#f79646"}
        base = theme.get(c.theme)
        return default if base is None else tinted(base, c.tint or 0)
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
    return round((h if h else (ws.sheet_format.defaultRowHeight or 15)) * 4 / 3, 2)


def page_setup(ws):
    ps = ws.page_setup
    return {"orientation": ps.orientation, "paperSize": ps.paperSize, "fitToWidth": ps.fitToWidth,
            "fitToHeight": ps.fitToHeight, "printArea": ws.print_area, "printTitleRows": ws.print_title_rows}


# ---------------------------------------------------------------- sales ledger
def read_sales():
    ws, wsv = book[SALES], values[SALES]
    rows, classes, anomalies = [], collections.Counter(), []
    for r in range(4, ws.max_row + 1):
        raw = [ws.cell(r, c).value for c in range(1, 14)]
        cached = [wsv.cell(r, c).value for c in range(1, 14)]
        if all(v is None for v in raw):
            classes["empty"] += 1
            continue
        if all(v is None or is_formula(v) for v in raw):
            # The workbook fills VLOOKUP/product formulas thousands of rows past
            # the last real sale; those rows are not transactions.
            classes["formulaOnly"] += 1
            continue
        date, code, item, qty, price = raw[0], raw[1], raw[5], raw[9], raw[10]
        if not any(v not in (None, "", 0) for v in (date, code, item, qty, price)):
            classes["whitespaceOnly"] += 1
            continue
        classes["transaction"] += 1
        amount = cached[11]
        rows.append({
            "row": r, "date": iso(date), "customerCode": code,
            "customerName": cached[2], "phone": cached[3], "documentNumber": raw[4],
            "itemCode": item, "itemName": cached[6], "description": raw[7],
            "unit": cached[8], "quantity": qty, "unitPrice": cached[10],
            "amount": amount, "note": raw[12],
        })
        if not isinstance(date, (datetime.datetime, datetime.date)):
            anomalies.append({"row": r, "kind": "missing-date"})
        if blank(code):
            anomalies.append({"row": r, "kind": "missing-customer"})
        if amount is None or amount == 0:
            anomalies.append({"row": r, "kind": "no-amount", "quantity": qty, "unitPrice": cached[10],
                              "amountCell": raw[11], "cached": amount})
        elif isinstance(qty, (int, float)) and isinstance(cached[10], (int, float)):
            if abs(qty * cached[10] - amount) > 0.005:
                anomalies.append({"row": r, "kind": "amount-mismatch", "quantity": qty,
                                  "unitPrice": cached[10], "amount": amount})
        if isinstance(date, (datetime.datetime, datetime.date)) and date.year != 2026:
            anomalies.append({"row": r, "kind": "date-outside-2026", "date": iso(date)})
        if isinstance(code, str) and code != code.strip():
            anomalies.append({"row": r, "kind": "code-whitespace", "code": code})
    return {
        "sheet": SALES, "dimension": ws.dimensions, "title": ws["A1"].value,
        "merged": [str(m) for m in ws.merged_cells.ranges],
        "header": [ws.cell(3, c).value for c in range(1, 14)], "headerRow": 3, "firstDataRow": 4,
        "widths": [width(ws, c) for c in range(1, 14)],
        "heights": {"title": height(ws, 1), "spacer": height(ws, 2), "header": height(ws, 3), "data": height(ws, 4)},
        "formats": {ws.cell(4, c).column_letter: ws.cell(4, c).number_format for c in range(1, 14)},
        "pageSetup": page_setup(ws), "freezePanesInSource": ws.freeze_panes,
        "rowClasses": dict(classes), "transactions": rows, "anomalies": anomalies,
        "styles": {"title": style_of(ws["A1"]),
                   "header": [style_of(ws.cell(3, c)) for c in range(1, 14)],
                   "data": [style_of(ws.cell(4, c)) for c in range(1, 14)]},
    }


# ---------------------------------------------------------------- payment ledger
def read_payments():
    ws, wsv = book[PAYMENTS], values[PAYMENTS]
    rows, classes, anomalies = [], collections.Counter(), []
    for r in range(3, ws.max_row + 1):
        raw = [ws.cell(r, c).value for c in range(1, 9)]
        cached = [wsv.cell(r, c).value for c in range(1, 9)]
        if all(v is None for v in raw):
            classes["empty"] += 1
            continue
        if all(v is None or is_formula(v) for v in raw):
            classes["formulaOnly"] += 1
            continue
        date, doc, code, desc, amount = raw[0], raw[1], raw[2], raw[5], cached[6]
        if not any(v not in (None, "", 0) for v in (date, code, amount, desc)):
            classes["whitespaceOnly"] += 1
            continue
        classes["transaction"] += 1
        rows.append({"row": r, "date": iso(date), "documentNumber": doc, "customerCode": code,
                     "customerName": cached[3], "phone": cached[4], "description": desc,
                     "amount": amount, "note": raw[7]})
        if not isinstance(date, (datetime.datetime, datetime.date)):
            anomalies.append({"row": r, "kind": "missing-date"})
        if blank(code):
            anomalies.append({"row": r, "kind": "missing-customer"})
        if amount is None or amount == 0:
            anomalies.append({"row": r, "kind": "no-amount", "amount": amount})
        if isinstance(date, (datetime.datetime, datetime.date)) and date.year != 2026:
            anomalies.append({"row": r, "kind": "date-outside-2026", "date": iso(date)})
    return {
        "sheet": PAYMENTS, "dimension": ws.dimensions, "title": ws["A1"].value,
        "merged": [str(m) for m in ws.merged_cells.ranges],
        "header": [ws.cell(2, c).value for c in range(1, 9)], "headerRow": 2, "firstDataRow": 3,
        "widths": [width(ws, c) for c in range(1, 9)],
        "heights": {"title": height(ws, 1), "header": height(ws, 2), "data": height(ws, 3)},
        "formats": {ws.cell(3, c).column_letter: ws.cell(3, c).number_format for c in range(1, 9)},
        "pageSetup": page_setup(ws), "freezePanesInSource": ws.freeze_panes,
        "rowClasses": dict(classes), "transactions": rows, "anomalies": anomalies,
        "descriptions": collections.Counter(str(r["description"]).strip() for r in rows).most_common(),
        "styles": {"title": style_of(ws["A1"]),
                   "header": [style_of(ws.cell(2, c)) for c in range(1, 9)],
                   "data": [style_of(ws.cell(3, c)) for c in range(1, 9)]},
    }


# ---------------------------------------------------------------- summary
def read_summary():
    ws, wsv = book[SUMMARY], values[SUMMARY]
    rows, extra = [], []
    total_row = None
    for r in range(3, ws.max_row + 1):
        label = ws.cell(r, 3).value
        code = ws.cell(r, 4).value
        if total_row is None and isinstance(label, str) and "cong" in key(label).replace("ộ", "o"):
            total_row = {"row": r, "label": label,
                         "opening": wsv.cell(r, 7).value, "increase": wsv.cell(r, 8).value,
                         "decrease": wsv.cell(r, 9).value, "closing": wsv.cell(r, 10).value,
                         "formulas": {ws.cell(r, c).column_letter: ws.cell(r, c).value for c in range(7, 11)}}
            continue
        # Everything below "Cộng tổng" is the signature block, never a customer.
        if blank(code) or total_row is not None:
            cells = {ws.cell(r, c).coordinate: ws.cell(r, c).value
                     for c in range(1, 15) if ws.cell(r, c).value is not None}
            if cells:
                extra.append({"row": r, "height": height(ws, r), "cells": cells,
                              "styles": [style_of(ws.cell(r, c)) for c in range(3, 12)]})
            continue
        rows.append({"row": r, "stt": ws.cell(r, 3).value, "code": code,
                     "name": wsv.cell(r, 5).value, "phone": wsv.cell(r, 6).value,
                     "opening": wsv.cell(r, 7).value, "increase": wsv.cell(r, 8).value,
                     "decrease": wsv.cell(r, 9).value, "closing": wsv.cell(r, 10).value,
                     "note": ws.cell(r, 11).value,
                     "nameIsFormula": is_formula(ws.cell(r, 5).value),
                     "phoneIsFormula": is_formula(ws.cell(r, 6).value)})
    dups = collections.defaultdict(list)
    for row in rows:
        dups[key(row["code"])].append(row["row"])
    # Columns L..N carry a stale scratch list, outside the A1:K57 print area.
    scratch = [{"cell": ws.cell(r, c).coordinate, "value": wsv.cell(r, c).value}
               for r in range(1, ws.max_row + 1) for c in range(12, 15)
               if ws.cell(r, c).value is not None]
    return {
        "sheet": SUMMARY, "dimension": ws.dimensions, "title": ws["D1"].value,
        "merged": [str(m) for m in ws.merged_cells.ranges],
        "header": [ws.cell(2, c).value for c in range(1, 12)], "headerRow": 2, "firstDataRow": 3,
        "hiddenColumns": [c for c in "ABCDEFGHIJKLMN" if ws.column_dimensions[c].hidden],
        "widths": [width(ws, c) for c in range(1, 12)],
        "heights": {"title": height(ws, 1), "header": height(ws, 2), "data": height(ws, 3)},
        "formats": {ws.cell(3, c).column_letter: ws.cell(3, c).number_format for c in range(1, 12)},
        "pageSetup": page_setup(ws), "freezePanesInSource": ws.freeze_panes,
        "rows": rows, "customerCount": len(rows), "totalRow": total_row,
        "rowsAfterTable": extra, "scratchCells": scratch,
        "caseInsensitiveDuplicates": {k: v for k, v in dups.items() if len(v) > 1},
        "rowsWithoutStt": [r["row"] for r in rows if r["stt"] is None],
        "negativeOpening": [{"code": r["code"], "opening": r["opening"]} for r in rows if num(r["opening"]) < 0],
        "styles": {"title": style_of(ws["D1"]),
                   "header": [style_of(ws.cell(2, c)) for c in range(1, 12)],
                   "data": [style_of(ws.cell(3, c)) for c in range(1, 12)]},
    }


# ---------------------------------------------------------------- partners
def read_partners():
    ws = book["MaNhaCungCap"]
    rows = []
    for r in range(5, ws.max_row + 1):
        code = ws.cell(r, 3).value
        if blank(code):
            continue
        rows.append({"row": r, "stt": ws.cell(r, 1).value, "type": ws.cell(r, 2).value,
                     "code": str(code).strip(), "name": ws.cell(r, 4).value,
                     "phone": ws.cell(r, 5).value, "address": ws.cell(r, 6).value,
                     "note": ws.cell(r, 7).value})
    dups = collections.defaultdict(list)
    names = collections.defaultdict(list)
    for row in rows:
        dups[key(row["code"])].append(row["row"])
        names[name_key(row["name"])].append(row["code"])
    return {
        "sheet": "MaNhaCungCap", "dimension": ws.dimensions,
        "header": [ws.cell(4, c).value for c in range(1, 8)], "headerRow": 4, "firstDataRow": 5,
        "rows": rows, "partnerCount": len(rows),
        "caseInsensitiveDuplicates": {k: v for k, v in dups.items() if len(v) > 1},
        "duplicateNames": {k: v for k, v in names.items() if len(v) > 1 and k},
        "codesWithWhitespace": [r["code"] for r in rows if str(r["code"]) != str(r["code"]).strip()],
        "types": collections.Counter(str(r["type"]) for r in rows).most_common(),
    }


# ---------------------------------------------------------------- item catalogue
def read_items():
    ws = book["KhoSon"]
    rows = []
    # The sheet starts at A2 with its own header row (STT | Ma | Tên sơn | ...).
    for r in range(3, ws.max_row + 1):
        code = ws.cell(r, 2).value
        if blank(code):
            continue
        rows.append({"row": r, "code": str(code).strip(), "name": ws.cell(r, 3).value,
                     "unit": ws.cell(r, 4).value, "price": ws.cell(r, 5).value})
    dups = collections.defaultdict(list)
    for row in rows:
        dups[key(row["code"])].append(row["row"])
    return {"sheet": "KhoSon", "dimension": ws.dimensions, "itemCount": len(rows), "rows": rows,
            "caseInsensitiveDuplicates": {k: v for k, v in dups.items() if len(v) > 1}}


sales, payments, summary, partners, items = (
    read_sales(), read_payments(), read_summary(), read_partners(), read_items())

# ---------------------------------------------------------------- SUMIF replica
sales_by_code = collections.defaultdict(float)
for t in sales["transactions"]:
    sales_by_code[key(t["customerCode"])] += num(t["amount"])
pay_by_code = collections.defaultdict(float)
for t in payments["transactions"]:
    pay_by_code[key(t["customerCode"])] += num(t["amount"])

recon, mismatched = [], 0
for row in summary["rows"]:
    k = key(row["code"])
    inc, dec = sales_by_code.get(k, 0.0), pay_by_code.get(k, 0.0)
    closing = num(row["opening"]) + inc - dec
    ok = (abs(inc - num(row["increase"])) < 0.005 and abs(dec - num(row["decrease"])) < 0.005
          and abs(closing - num(row["closing"])) < 0.005)
    mismatched += 0 if ok else 1
    recon.append({"code": row["code"], "name": row["name"], "opening": num(row["opening"]),
                  "replicaIncrease": inc, "excelIncrease": num(row["increase"]),
                  "replicaDecrease": dec, "excelDecrease": num(row["decrease"]),
                  "replicaClosing": closing, "excelClosing": num(row["closing"]), "matches": ok})

summary_codes = {key(r["code"]) for r in summary["rows"]}
partner_codes = {key(r["code"]) for r in partners["rows"]}
unlisted = sorted({k for k in list(sales_by_code) + list(pay_by_code) if k and k not in summary_codes})
unlisted_detail = [{"code": k, "increase": sales_by_code.get(k, 0.0), "decrease": pay_by_code.get(k, 0.0),
                    "inPartnerMaster": k in partner_codes,
                    "salesRows": [t["row"] for t in sales["transactions"] if key(t["customerCode"]) == k],
                    "paymentRows": [t["row"] for t in payments["transactions"] if key(t["customerCode"]) == k]}
                   for k in unlisted]
unknown_customers = sorted({k for k in list(sales_by_code) + list(pay_by_code) if k and k not in partner_codes})
item_codes = {key(r["code"]) for r in items["rows"]}
unknown_items = sorted({key(t["itemCode"]) for t in sales["transactions"]
                        if t["itemCode"] and key(t["itemCode"]) not in item_codes})

replica_totals = {
    "opening": sum(num(r["opening"]) for r in summary["rows"]),
    "increase": sum(sales_by_code.get(key(r["code"]), 0.0) for r in summary["rows"]),
    "decrease": sum(pay_by_code.get(key(r["code"]), 0.0) for r in summary["rows"]),
}
replica_totals["closing"] = replica_totals["opening"] + replica_totals["increase"] - replica_totals["decrease"]
ledger_totals = {"salesRows": len(sales["transactions"]),
                 "salesAmount": sum(num(t["amount"]) for t in sales["transactions"]),
                 "paymentRows": len(payments["transactions"]),
                 "paymentAmount": sum(num(t["amount"]) for t in payments["transactions"])}

# ---------------------------------------------------------------- other sheets
master_fp = collections.Counter()
for t in sales["transactions"]:
    master_fp[(t["date"], key(t["itemCode"]), num(t["quantity"]), num(t["amount"]))] += 1

others = []
for ws in book.worksheets:
    if ws.title in MAIN + ["MaNhaCungCap", "KhoSon"]:
        continue
    title = str(ws.cell(1, 1).value or ws.cell(1, 4).value or "").replace("\n", " ").strip()
    rows = []
    for r in range(3, ws.max_row + 1):
        d = ws.cell(r, 1).value
        if not isinstance(d, (datetime.datetime, datetime.date)):
            continue
        rows.append({"row": r, "date": iso(d), "name": ws.cell(r, 2).value, "itemCode": ws.cell(r, 3).value,
                     "quantity": ws.cell(r, 7).value, "amount": values[ws.title].cell(r, 9).value})
    matched = sum(1 for x in rows
                  if master_fp.get((x["date"], key(x["itemCode"]), num(x["quantity"]), num(x["amount"])), 0) > 0)
    years = sorted({x["date"][:4] for x in rows if x["date"]})
    if "TONGHOPCONGNO (2)" in ws.title.upper():
        # A stale copy of the summary: the same SUMIF formulas over the same two
        # ledgers, only the opening column differs. Never a transaction source.
        kind = "legacyReport"
    elif not rows:
        kind = "emptyOrHelper"
    elif matched == len(rows):
        kind = "derivedReport"          # every line already in ChiTietBanHang
    elif years and max(years) < "2026":
        kind = "historicalSource"       # pre-2026, already inside the opening balance
    else:
        kind = "needsReview"
    others.append({"sheet": ws.title, "state": ws.sheet_state, "dimension": ws.dimensions, "title": title,
                   "titleYears": "".join(c for c in title if c.isdigit()), "rows": len(rows),
                   "matchedInSalesLedger": matched, "notMatched": len(rows) - matched,
                   "amount": sum(num(x["amount"]) for x in rows), "dateYears": years,
                   "customers": sorted({name_key(x["name"]) for x in rows if x["name"]}),
                   "classification": kind,
                   "unmatchedSample": [x for x in rows
                                       if master_fp.get((x["date"], key(x["itemCode"]),
                                                         num(x["quantity"]), num(x["amount"])), 0) == 0][:6]})

report = {
    "source": source.name, "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "sheetCount": len(book.sheetnames),
    "sheetNames": [{"name": ws.title, "state": ws.sheet_state} for ws in book.worksheets],
    "definedNames": {k: v.attr_text for k, v in book.defined_names.items()},
    "summary": summary, "sales": sales, "payments": payments, "partners": partners, "items": items,
    "reconciliation": {
        "customers": len(recon), "matched": len(recon) - mismatched, "mismatched": mismatched,
        "rows": recon, "replicaTotals": replica_totals,
        "excelTotals": summary["totalRow"], "ledgerTotals": ledger_totals,
        "customersOutsideSummary": unlisted_detail,
        "customerCodesNotInPartnerMaster": unknown_customers,
        "itemCodesNotInKhoSon": unknown_items,
    },
    "otherSheets": others,
}
(root / "docs/receivables-workbook-analysis.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf8")

layout = {
    "sourceSha256": report["sourceSha256"],
    "styles": styles,
    "summary": {
        "title": summary["title"], "headers": summary["header"][2:11], "widths": summary["widths"][2:11],
        "heights": summary["heights"], "formats": [summary["formats"][c] for c in "CDEFGHIJK"],
        "styles": {"title": summary["styles"]["title"], "header": summary["styles"]["header"][2:11],
                   "data": summary["styles"]["data"][2:11]},
        "rowsAfterTable": [{"cells": {k: str(v) for k, v in e["cells"].items() if not is_formula(v)},
                            "height": e["height"], "styles": e["styles"]} for e in summary["rowsAfterTable"]],
    },
    "sales": {"title": sales["title"], "headers": sales["header"], "widths": sales["widths"],
              "heights": sales["heights"], "formats": [sales["formats"][c] for c in "ABCDEFGHIJKLM"],
              "styles": sales["styles"]},
    "payments": {"title": payments["title"], "headers": payments["header"], "widths": payments["widths"],
                 "heights": payments["heights"], "formats": [payments["formats"][c] for c in "ABCDEFGH"],
                 "styles": payments["styles"]},
}
(root / "src/domains/receivables").mkdir(parents=True, exist_ok=True)
(root / "src/domains/receivables/layout.json").write_text(
    json.dumps(layout, ensure_ascii=False, separators=(",", ":")), encoding="utf8")

# ------------------------------------------- template: three sheets, no data
for other in list(book):
    if other.title not in MAIN:
        book.remove(other)
book.defined_names.clear()
first = {SUMMARY: 3, SALES: 4, PAYMENTS: 3}
for name, start in first.items():
    ws = book[name]
    ws.defined_names.clear()
    ws.data_validations.dataValidation = []
    ws.conditional_formatting = type(ws.conditional_formatting)()
    ws.sheet_view.topLeftCell = "A1"
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
book[SUMMARY].freeze_panes = "A3"
book[SALES].freeze_panes = "A4"
book[PAYMENTS].freeze_panes = "A3"
book[SUMMARY].print_title_rows = "1:2"
book[SALES].print_title_rows = "1:3"
book[PAYMENTS].print_title_rows = "1:2"
book.active = 0
book.save(root / "assets/receivables-template.xlsx")

print(json.dumps({
    "sheets": report["sheetCount"],
    "salesRowClasses": sales["rowClasses"], "paymentRowClasses": payments["rowClasses"],
    "customers": summary["customerCount"], "partners": partners["partnerCount"], "items": items["itemCount"],
    "ledgerTotals": ledger_totals, "replicaTotals": replica_totals,
    "excelTotals": {k: summary["totalRow"][k] for k in ("opening", "increase", "decrease", "closing")},
    "reconciliation": {k: v for k, v in report["reconciliation"].items()
                       if k not in ("rows", "customersOutsideSummary")},
    "mismatches": [r for r in recon if not r["matches"]],
    "customersOutsideSummary": unlisted_detail,
    "salesAnomalies": collections.Counter(a["kind"] for a in sales["anomalies"]),
    "paymentAnomalies": collections.Counter(a["kind"] for a in payments["anomalies"]),
    "descriptions": payments["descriptions"],
    "negativeOpening": summary["negativeOpening"], "rowsWithoutStt": summary["rowsWithoutStt"],
    "hiddenColumns": summary["hiddenColumns"],
    "otherSheets": [{k: s[k] for k in ("sheet", "state", "titleYears", "rows",
                                       "matchedInSalesLedger", "notMatched", "classification")} for s in others],
}, ensure_ascii=False, indent=1, default=str))
