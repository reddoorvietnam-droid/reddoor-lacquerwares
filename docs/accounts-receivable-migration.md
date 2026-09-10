# Công nợ — migration of `Reddoor-congno-2026.xlsx`

What the source workbook contains, which parts of it were imported, which were
deliberately left out and why, and how the result reconciles.

```
npm run import:receivables -- "assets/Reddoor-congno-2026.xlsx"          # dry run
npm run import:receivables -- "assets/Reddoor-congno-2026.xlsx" --apply  # writes
```

Dry run by default. Writes are idempotent: customers key on `normalizedCode`,
entries on `importKey` (`sha256(workbook):sheet:row`), the opening balance on
(`referenceType`, `referenceId`). Running twice updates the same documents —
verified, second run created 0 customers and left every total unchanged.

Report: `backups/receivables-migration-report.json`.
Structural analysis: `docs/receivables-workbook-analysis.json`, produced by
`python scripts/analyze-receivables-workbook.py assets/Reddoor-congno-2026.xlsx`,
which also generates `src/domains/receivables/layout.json` and the export
template `assets/receivables-template.xlsx`.

Source SHA-256: `ca75029ab1df2f3ef56b59683c085ab0fda10cbccf998deabfb4fee37970b6d4`

---

## 1. All 31 sheets, classified

Classification is derived from the data, not from the sheet name: every row of a
per-customer sheet is fingerprinted on (date, item code, quantity, amount) and
looked up in `ChiTietBanHang`.

### Primary sources — imported (3)

| Sheet            | Rows                                  | Role                                           |
| ---------------- | ------------------------------------- | ---------------------------------------------- |
| `ChiTietBanHang` | 1,101 transactions of 5,317 used rows | every sale — `Phát sinh tăng`                  |
| `ThanhToan`      | 168 transactions of 724 used rows     | every payment/offset/return — `Phát sinh giảm` |
| `TongHopCongNo`  | 50 customers                          | `Dư đầu ngày 02/01/2026` (column G only)       |

`ChiTietBanHang` fills its VLOOKUP and product formulas 4,216 rows past the last
real sale, and `ThanhToan` 556. **Used-range row counts would have invented
almost five thousand transactions.** A row counts only when a business field
(date, customer, item, quantity or price) carries a value.

Columns H, I and J of `TongHopCongNo` are SUMIF and subtraction formulas over
the same two ledgers. They are read to reconcile against and **never imported as
figures** — importing a derived total is how a book stops adding up.

### Master data — imported (2)

| Sheet          | Rows         | Role                                    |
| -------------- | ------------ | --------------------------------------- |
| `MaNhaCungCap` | 125 partners | the customer master both SUMIFs look up |
| `KhoSon`       | 533 items    | item names, units and sale prices       |

### Derived reports — NOT imported (17)

Per-customer statements. Every one is a printed extract of `ChiTietBanHang`:

| Sheet          | Rows | Already in the sales ledger |
| -------------- | ---- | --------------------------- |
| `A.Kien2804`   | 2    | 2 / 2                       |
| `A.Luong2606`  | 2    | 2 / 2                       |
| `C.Quang2708`  | 11   | 11 / 11                     |
| `C.Van2708`    | 9    | 9 / 9                       |
| `A.Tuấn2708`   | 13   | 13 / 13                     |
| `C.Ha2708`     | 7    | 7 / 7                       |
| `A.Tuyen2708`  | 4    | 4 / 4                       |
| `C.Thanh2708`  | 9    | 9 / 9                       |
| `C.hai2708`    | 3    | 3 / 3                       |
| `A.Hiền2708`   | 6    | 6 / 6                       |
| `C.Nha2708`    | 13   | 13 / 13                     |
| `C.Nga2708`    | 13   | 13 / 13                     |
| `A.Xuyen2708`  | 5    | 5 / 5                       |
| `A.Sang2708`   | 18   | 18 / 18                     |
| `Ninh3107`     | 7    | 7 / 7                       |
| `ChuThanh2606` | 2    | 2 / 2                       |
| `A.Tai0506`    | 2    | 2 / 2                       |

**126 of 126 lines already exist in the sales ledger.** Importing them would
have added 183,022,000 đồng of duplicate debt.

### Historical sources — NOT imported (5)

Pre-2026 trade, already inside the 2026 opening balance:

| Sheet         | Period    | Rows | Amount     |
| ------------- | --------- | ---- | ---------- |
| `C.Hieu`      | 2020      | 13   | 2,685,000  |
| `C.hieu1`     | 2020      | 13   | 2,304,250  |
| `C.Tuyet2601` | 2021–2022 | 16   | 4,065,600  |
| `A.Tai`       | 2022      | 1    | 22,400,000 |
| `A.Quyết1005` | 2022      | 2    | 226,000    |

### Legacy report — NOT imported (1)

`TongHopCongNo (2)tÔN` (hidden), titled `BẢNG TỔNG HỢP CÔNG NỢ NĂM-2024`. Its H
and I columns are **the same SUMIF formulas over the same 2026 ledgers**; only
the opening column differs. It is a stale copy of the summary with an older
opening balance, not a second period of data.

### Empty or helper — NOT imported (3)

`1 (23)` (a 2025 header with no rows), `Sheet14 (2)`, `Sheet9`.

---

## 2. Customers

125 partners from `MaNhaCungCap`, in sheet order, `normalizedCode` unique.
No duplicate codes, no whitespace in codes, no code missing from the master
(every code used by either ledger resolves).

### Why a dedicated master

`MaNhaCungCap` is the same list the paint and materials modules already carry as
their facility masters — but **partially and inconsistently**:

- `materialfacilities` holds 99 of the 125; **65 codes are missing**.
- `paintwarehousemasters` (kind `facility`) holds 94; **61 are missing**,
  including `Sang`, who closes 2026 owing 16,225,050.
- Names conflict: code `Quang` reads _Anh Quảng_ in `materialfacilities` and
  _Đỗ Văn Quảng_ here.

Reusing either would have lost about half the customers and imported conflicting
names, and attaching an opening balance to an inventory master would put
customer money inside a document the Factory Accountant can read. The module
therefore owns `receivablecustomers`, migrated from `MaNhaCungCap`, following
the project's existing per-module master convention.

The company's `customers` collection is unrelated: 79 export customers with tax
codes (CÔNG TY CỔ PHẦN ECO BAMBOO VIỆT NAM and the like), a different
counterparty set entirely.

### Case-insensitive codes

Excel's SUMIF matches case-insensitively, so the source uses `Hien`/`hien`,
`Sang`/`sang`, `Ha`/`ha`, `Tuyen`/`tuyen` and `Hienthuat`/`hienthuat`
interchangeably. All collapse to one customer via `codeKey`. Entries store the
master's canonical spelling; the exact source row stays traceable through
`migrationSheet` + `sourceRow`.

---

## 3. Sales — 1,101 rows

02/01/2026 → 09/09/2026. Total 1,019,707,500.

Amounts are taken from the workbook's own `Thành tiền` column, **not** from
quantity × price — that column is what the SUMIFs added up, so using it is what
makes the totals reconcile. Prices are snapshotted per line and never re-read.

Dates convert from Excel serials with UTC arithmetic from the 1899-12-30 epoch.
The workbook is deliberately read **without** SheetJS's `cellDates`, which
builds `Date` objects in the machine's local zone: on any zone east of UTC that
shifted every one of the 1,101 dates back by a day. Verified stable under
`Asia/Ho_Chi_Minh`, `America/New_York` and `Pacific/Kiritimati`.

### Flagged rows — 10

Rows 274, 321, 330, 331, 345, 636, 637, 676, 738 and 897 carry a quantity and
usually a price, but `Thành tiền` is blank or a hand-typed 0. Excel summed 0 for
them, so the ledger does too — and each is imported with the quantity intact and
flagged `MISSING_AMOUNT`, visible in the UI as a warning on the line. **Nothing
was dropped and nothing was silently recalculated**; the accountant decides.

---

## 4. Reductions — 168 rows

06/01/2026 → 08/09/2026. Total 950,448,000.

| Description in the source   | Count | Mapped to                     |
| --------------------------- | ----- | ----------------------------- |
| `thanh toán`                | 81    | `PAYMENT`                     |
| `Trừ tiền sơn`              | 72    | `PAINT_OFFSET`                |
| `trừ tiền sơn`              | 2     | `PAINT_OFFSET`                |
| `Trừ tiền gỗ`               | 6     | `MATERIAL_OFFSET`             |
| `Trả lại sơn nhũ vàng`      | 1     | `SALES_RETURN`                |
| `trả lại sơn nhũ trắng`     | 1     | `SALES_RETURN`                |
| `Trả lại sơn`               | 1     | `SALES_RETURN`                |
| `trả lại sơn đen`           | 1     | `SALES_RETURN`                |
| `Trả sơn nhũ vàng`          | 1     | `SALES_RETURN`                |
| `Trả lại sơn bóng thường`   | 1     | `SALES_RETURN`                |
| **`TT toát nc 2 khay Kim`** | **1** | **`OTHER_OFFSET` — unmapped** |

Every row keeps its `legacyDescription` verbatim. The last one is not confidently
a payment despite the `TT` prefix, so it was **not** guessed: it is
`OTHER_OFFSET`, flagged `UNMAPPED_DESCRIPTION`, and shows a warning in the UI.

No `Số chứng từ` is filled in anywhere in either ledger, and none was invented.

---

## 5. Opening balance

50 customers from `TongHopCongNo` column G, dated 02/01/2026, total 72,014,650.
`QuyetBK` opens at −250 — a real prepayment, kept as-is.

Not derived from the 2020/2022/2024 sheets: the workbook's own 2026 column is
the authority, and those sheets are fragments, not a complete history.

Note the source's own total formula reads `=SUM(G3:G49)` and misses rows 50–52.
Those three cells are zero, so the printed total is unaffected — but the web
version sums every row rather than reproducing the range.

---

## 6. Reconciliation

### Against the workbook's own report

|                |           Excel | Rebuilt from the ledger |
| -------------- | --------------: | ----------------------: |
| Dư đầu         |      72,014,650 |              72,014,650 |
| Phát sinh tăng |   1,019,322,500 |           1,019,322,500 |
| Phát sinh giảm |     950,063,000 |             950,063,000 |
| **Dư cuối**    | **141,274,150** |         **141,274,150** |

`72,014,650 + 1,019,322,500 − 950,063,000 = 141,274,150` ✓

**Mismatched customers: 0 of 50.** Every listed customer's opening, increase,
decrease and closing agree to the đồng.

### Read back out of MongoDB after `--apply`

|                |        Database |           Excel |
| -------------- | --------------: | --------------: |
| Dư đầu         |      72,014,650 |      72,014,650 |
| Phát sinh tăng |   1,019,707,500 |   1,019,322,500 |
| Phát sinh giảm |     950,448,000 |     950,063,000 |
| **Dư cuối**    | **141,274,150** | **141,274,150** |

**Mismatched customers: 0.**

The two movement columns differ by exactly **385,000 on both sides**, and it is
accounted for: customer code **`linh`** trades in `ChiTietBanHang` (rows
260–263) and `ThanhToan` (row 36) but **has no row in `TongHopCongNo`** — the
report sums only the 50 rows someone typed into it. `linh` exists in
`MaNhaCungCap`, so the web version carries them with an opening balance of zero
and a closing balance of zero. The website is more complete than the report it
replaces; the closing total is identical because the trade nets out.

### The exported workbook, compared with the source file

Downloading `Xuất Excel` and diffing it against `Reddoor-congno-2026.xlsx` cell
by cell leaves **one difference**: the export carries 51 rows to the source's
50, because `linh` is there. All 50 shared customers match on every column, the
title and headers are identical, the signature block is intact, no formula
survived, and the closing total is the same 141,274,150. The two movement totals
are higher by exactly the 385,000 that `linh` traded.

### Spot checks against the printed report

| Code      |   Database |      Excel |
| --------- | ---------: | ---------: |
| `ALuong`  | 39,840,000 | 39,840,000 |
| `Sang`    | 16,225,050 | 16,225,050 |
| `Thanh`   | 14,361,250 | 14,361,250 |
| `Tuan`    | 14,193,100 | 14,193,100 |
| `Ninh`    | 13,370,000 | 13,370,000 |
| `Hien`    |  9,085,200 |  9,085,200 |
| `Ha`      |  7,746,000 |  7,746,000 |
| `Nha`     |  5,033,850 |  5,033,850 |
| `Tai`     |          0 |          0 |
| `QuyetBK` |       −250 |       −250 |
| `linh`    |          0 |   (absent) |

---

## 7. What was written

| Collection            |                                         Documents |
| --------------------- | ------------------------------------------------: |
| `receivablecustomers` |                                               125 |
| `receivableentries`   | 1,319 — 50 `OPENING`, 1,101 `DEBIT`, 168 `CREDIT` |

By type: 1,101 `SALE`, 81 `PAYMENT`, 74 `PAINT_OFFSET`, 6 `MATERIAL_OFFSET`,
6 `SALES_RETURN`, 1 `OTHER_OFFSET`, 50 `OPENING_BALANCE`. All `POSTED`.
Duplicate (referenceType, referenceId) pairs: **0**.

---

## 8. Double-count guards

1. `ChiTietBanHang` is the only source of debits. The 17 per-customer sheets
   were proven to be extracts of it and skipped.
2. `Hóa đơn bán hàng` does not post to AR. 7 of its 20 lines are already in
   `ChiTietBanHang`; posting both would double them.
3. A unique index on (`referenceType`, `referenceId`) makes a second posting of
   any source document impossible at the database level, not merely unlikely.
4. `importKey` makes re-running the migration update rather than insert.
5. No inventory document is created, so no stock is decremented twice.

---

## 9. Open items for the client

These are questions, not defects. Each has a safe default in place and is
listed in `docs/accounts-receivable.md` §13.

1. The ten sales rows with a blank or zeroed `Thành tiền` — what should they be?
2. `TT toát nc 2 khay Kim` — a payment, or something else?
3. Customer `linh` — should they appear on the printed summary from now on?
4. Should confirming a sales slip post a debit automatically?
5. Should `Trả lại hàng` also receive stock back?
6. Are payment terms and aging wanted? Nothing was assumed.
