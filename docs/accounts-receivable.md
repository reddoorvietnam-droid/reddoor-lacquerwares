# Công nợ bán sơn — accounts receivable

The customer debt book that replaces `Reddoor-congno-2026.xlsx`. It answers one
question for one counterparty set: **how much does this customer owe Red Door,
and which transactions made it so.**

Route: `/{locale}/admin/receivables` · API: `/api/receivables/*` ·
Domain: [`src/domains/receivables`](../src/domains/receivables) ·
UI: [`src/components/admin/receivables`](../src/components/admin/receivables) ·
Migration: [`accounts-receivable-migration.md`](./accounts-receivable-migration.md)

---

## 1. Business model

The counter sells paint, thinner, MDF board and consumables to about fifty
workshops on credit. Each one has a short code (`Nha`, `Sang`, `QuyetBK`) and a
running balance. The workbook kept three sheets and one formula:

```
Dư cuối = Dư đầu + Phát sinh tăng − Phát sinh giảm

Phát sinh tăng = SUMIF(ChiTietBanHang!B, mã khách, ChiTietBanHang!L)
Phát sinh giảm = SUMIF(ThanhToan!C,      mã khách, ThanhToan!G)
```

Both SUMIFs match the customer code **case-insensitively**, which is why the
source freely mixes `Hien`/`hien` and `Sang`/`sang`. `codeKey` (trim +
lower-case) is the one identity used everywhere in this module.

This is receivables only. Supplier payables are a different ledger and are out
of scope; nothing here posts to one.

### Not to be confused with `Công nợ khách hàng`

The portal already had a receivables page at `/admin/finance/receivables`,
labelled **Công nợ khách hàng**. That one reads **export orders and INV
invoices** in USD and VND, for companies with tax codes. This module is
labelled **Công nợ bán sơn** and reads the **counter debt book** in VND, for the
workshops that buy paint. Different counterparties, different documents,
different permissions (`customerDebt.*` vs `receivables.read`). They never share
a figure.

The Director and the Company Accountant see both entries in the sidebar, which
is why the two labels are deliberately not alike.

---

## 2. The ledger

One collection, `receivableentries`, holds everything. There is no separate
opening-balance table and no stored total: **every figure on screen is
recomputed from the ledger**, so a closing balance can always be traced back to
an opening balance plus the entries that moved it.

| Field                                   | Meaning                                                                                                               |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `role`                                  | `OPENING` \| `DEBIT` \| `CREDIT` — which report column the entry lands in                                             |
| `type`                                  | `OPENING_BALANCE`, `SALE`, `PAYMENT`, `PAINT_OFFSET`, `MATERIAL_OFFSET`, `SALES_RETURN`, `OTHER_OFFSET`, `ADJUSTMENT` |
| `status`                                | `DRAFT` \| `POSTED` \| `CANCELLED` — only `POSTED` moves a balance                                                    |
| `amount`                                | Decimal128. Signed for `OPENING`; positive for `DEBIT` and `CREDIT`                                                   |
| `customerCode/Name/Phone`               | Snapshot, so a renamed master never rewrites history                                                                  |
| `itemCode/Name/unit/quantity/unitPrice` | Sale snapshot; the price is frozen on the line                                                                        |
| `referenceType` + `referenceId`         | Where the entry came from — **unique together**                                                                       |
| `sequence`                              | Stable tie-breaker so a running balance never reorders                                                                |
| `legacyDescription`                     | The source wording, kept verbatim                                                                                     |
| `issues[]`                              | Review flags carried over from migration                                                                              |

### Debit and credit, said once

This is a receivable, so a **sale is a DEBIT** that increases what the customer
owes, and a **payment, offset or return is a CREDIT** that reduces it.
`OPENING` is neither: it is the balance carried into the period, the starting
point the two movement columns move away from.

The Vietnamese UI keeps the workbook's wording — `Phát sinh tăng` /
`Phát sinh giảm` — because that is what the staff read every day.

### The closing balance is never stored

Nothing in the API accepts a closing balance and no screen lets anyone type
one. If a balance is wrong, the fix is at its cause: the opening balance, or
the entry that moved it. `computeBalance` in
[`contracts.ts`](../src/domains/receivables/contracts.ts) is the single
implementation, and the MongoDB aggregation in `service.ts` is checked against
it by the migration's own reconciliation.

### Negative balances are real

`QuyetBK` opens at −250 in the source workbook. A negative balance means the
customer has paid ahead and is shown as **Dư trả trước** in its own calm colour,
not as an error. Overpayment is allowed for the same reason: refusing it would
have made the migration lose a figure the client already relies on.

---

## 3. Opening balance

Migrated from `TongHopCongNo` column G, `Dư đầu ngày 02/01/2026`, one entry per
customer with `referenceType: "OPENING_BALANCE"` and
`referenceId: "2026:<customerId>"`. The unique index on
(`referenceType`, `referenceId`) means a customer can only ever have one.

**A date window never drops it.** Asking for the debt as of 01/01/2026 — before
the period opened — answers with the opening balance, not zero. It is the
period's starting point, not an event inside it.

Restating one requires `customerDebt.updateOpeningBalance` (accountant and
Director only) and always records before, after and a reason.

---

## 4. What increases a debt, and what may not

`ChiTietBanHang` is the **canonical source of `Phát sinh tăng`**. Every debit in
the ledger is a line from it, or a sale recorded through the module since.

### Why the sales slip does not post

`Hóa đơn bán hàng` (`salesslips`, migrated from `08092026.xlsx`) is a printed
slip handed to the customer. Its recipients **are** these customers, and
comparing the two sources line by line shows that **7 of its 20 lines already
exist in `ChiTietBanHang`** with the same date, item and quantity. Wiring
confirmed slips to post AR debits while also importing `ChiTietBanHang` would
count those sales twice.

So: **the AR ledger owns the debit side; a sales slip prints it.** The
`SALES_SLIP` reference type is reserved and the unique index would refuse a
second posting, but nothing writes it today. Linking the two is listed under
unresolved rules below.

### Why the stock ledgers do not post either

All 1,101 source lines carry the description `xuất kho`, and `Bảng xuất kho sơn`
and `Nguyên vật liệu` already track those movements as quantities. This module
records the **money**, never the stock, and creates no inventory document. A
sale recorded here does not decrement stock; issuing stock does not create a
debt. Connecting them is a business decision that has not been taken.

---

## 5. What decreases a debt

`Phát sinh giảm` is **not only cash**. The source proves it: alongside
`thanh toán` it carries `Trừ tiền sơn`, `Trừ tiền gỗ` and half a dozen
`Trả lại sơn …` lines. Modelling it as a `Payments` table would have flattened
real business meaning, so the credit side is a settlement with a type:

| Type              | UI                   | Count in the source |
| ----------------- | -------------------- | ------------------- |
| `PAYMENT`         | Thanh toán           | 81                  |
| `PAINT_OFFSET`    | Trừ tiền sơn         | 74                  |
| `MATERIAL_OFFSET` | Trừ tiền gỗ / vật tư | 6                   |
| `SALES_RETURN`    | Trả lại hàng         | 6                   |
| `OTHER_OFFSET`    | Bù trừ khác          | 1                   |

Offsets and returns record money only. Neither creates an inventory movement,
because the workbook gives no evidence one was made.

---

## 6. Recording, correcting, cancelling

`Ghi sổ` writes a posted entry in one click; `Lưu nháp` keeps a draft that does
not move any balance until it is posted.

### One customer, one visit, many items

A workshop buying six paints at once is **one form**: one date, one customer,
one document number, and a line per item. Each line still becomes its own ledger
entry — that is what keeps `Phát sinh tăng` traceable down to an item — and the
lines share a `batchId`, written in a single transaction so a half-recorded
purchase can never move a balance.

### New paint codes

The catalogue is not a fixed list: new codes appear every week. The storekeeper
adds one without leaving the sale, and it goes into the **shared** paint
catalogue (`paintwarehousemasters`) that `Bảng xuất kho sơn` and
`Hóa đơn bán hàng` also read — never a third copy that would drift away from
them. A new or changed price is only the default for the next sale; every debt
already recorded keeps the price snapshotted on its own line.

Not every code has a price yet: 500 of the 985 in the catalogue carry one, so
the price box simply stays empty for the rest until someone fills it in.

### Correcting a line in place

**Sửa** turns a row into inputs and edits every column: the date, the customer,
the document number, the item, the quantity, the price, a reduction's type and
amount, the note. Cancel-and-re-enter leaves two rows in the book for one real
transaction, which is why the spec's "restricted edit workflow" is offered
beside it.

Restricted means: the version is checked so two people cannot overwrite each
other, a cancelled line is never revived, an opening balance is never touched
here, a sale can never turn into a payment, and **every changed field is written
to the audit log with the actor and a reason**. A sale's `Thành tiền` stays the
server's product of quantity and price — a total can never be typed over its own
lines.

**Nothing is ever hard-deleted.** A posted entry is cancelled with a reason: it
stays in the ledger, stops contributing, and the balance returns to exactly what
it was. Cancelling an opening balance is refused outright — restate it instead.

### Double submission cannot double a debt

Each open form mints one `idempotencyKey` and reuses it on every retry. The
server returns the first entry rather than writing a second, and a unique index
backs it in the database. A customer paying 5.000.000 through a browser that
times out and retries reduces the debt by 5.000.000, once.

---

## 7. Permissions

Server-enforced on every route; hiding a menu item is not access control.

| Permission                          | Storekeeper | Accountant | Director |
| ----------------------------------- | :---------: | :--------: | :------: |
| `customerDebt.read`                 |      ✓      |     ✓      |    ✓     |
| `customerDebt.readAmount`           |      ✓      |     ✓      |    ✓     |
| `customerDebt.recordSale`           |      ✓      |     ✓      |    ✓     |
| `customerDebt.recordReduction`      |      ✓      |     ✓      |    ✓     |
| `customerDebt.updateEntry`          |      ✓      |     ✓      |    ✓     |
| `customerDebt.cancelEntry`          |      ✓      |     ✓      |    ✓     |
| `customerDebt.manageCatalog`        |      ✓      |     ✓      |    ✓     |
| `customerDebt.manageCustomer`       |      ✓      |     ✓      |    ✓     |
| `customerDebt.updateOpeningBalance` |      —      |     ✓      |    ✓     |
| `customerDebt.export`               |      ✓      |     ✓      |    ✓     |
| `customerDebt.import`               |      —      |     ✓      |    ✓     |

The **Factory Accountant holds none of them** — that role stays blind to
customer money (confirmed 2026-09-05). Neither does the Factory Manager or the
Content Creator.

`customerDebt.readAmount` is a sensitive-field permission: a reader without it
gets a payload with **no amounts in it**, not a number the browser is asked
politely to hide. Export re-checks it, so `customerDebt.export` alone cannot
carry a figure out of the building.

Grants are global scope only — a customer debt belongs to the company, not to a
business unit.

---

## 8. Reporting

**Tổng hợp công nợ** keeps the workbook's column order: STT, Mã khách, Tên
khách hàng, Số điện thoại, Dư đầu, Phát sinh tăng, Phát sinh giảm, Dư hiện tại,
Chú ý. The three movement columns and the balance are not editable. Clicking a
movement figure opens the entries behind it.

By default the board shows the customers the report is about — 51 of the 125 in
the master: the 50 the workbook lists (including the fifteen whose row is
entirely zero, because the accountant put them there) plus `linh`, whom the
workbook's report omits. Burying the sixteen who owe money among a hundred zero
rows is how a debt gets missed; the other 74 partners are one checkbox away.

`hasActivity` in `contracts.ts` is that rule, and the export uses the same
function, so **a downloaded workbook always holds exactly the rows that were on
screen** — including the "Hiện cả khách chưa phát sinh" toggle.

**The date window** is shared by every tab:

- `Đến ngày` alone → the balance as of that date (`công nợ đến ngày`).
- `Từ ngày` + `Đến ngày` → a period statement, where everything before
  `Từ ngày` folds into `Dư đầu kỳ` so no balance is lost to a filter.

**Chi tiết khách** is the chronological ledger with the balance after each
entry, ordered by (date, sequence) so two reads never disagree.

---

## 9. Export

`Xuất Excel` fills the checked-in template
(`assets/receivables-template.xlsx` — the three business sheets with the data
removed, generated by `scripts/analyze-receivables-workbook.py`), so the file
opens with the source's title, merges, column widths, number formats, freeze
panes, print area and the `Người lập / Phụ trách kế toán / Giám đốc` signature
block.

Cells are written as literal values. **No formula survives into the export**, so
a downloaded file can never recompute itself into a number the screen does not
show. `Xuất sổ công nợ` on a customer produces the same three sheets restricted
to that customer, for sending out to reconcile.

---

## 10. Audit

Every change is appended to the shared audit log with `resourceType:
"receivables"`, and the **Nhật ký** tab reads it back: actor, timestamp, action,
customer, and the reason where one is required.

Audited: reduction and sale created, entry posted, entry cancelled (with
reason), opening balance created or restated (with before, after and reason),
customer created or updated.

---

## 11. Performance

Balances come from a single `$group` over the ledger with Decimal128
arithmetic; the browser never downloads transactions to add them up. Indexes:

```
{ customerId, entryDate, sequence }          the customer ledger
{ status, entryDate }                        the summary and every window
{ type, status, entryDate }                  the tab lists
{ referenceType, referenceId }   unique      the double-count guard
{ importKey }                    unique      migration idempotency
{ idempotencyKey }               unique      retry safety
```

There is no cached balance table. The ledger is the only source of truth, and a
cache would be one more thing that can quietly disagree with it.

---

## 12. Tests

| File                                         | What it pins                                                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `tests/unit/receivables-contracts.test.ts`   | the balance arithmetic, period windows, cancellation, negative balances, price snapshots, description mapping   |
| `tests/unit/receivables-import.test.ts`      | the parser's rules, plus the real workbook: 1101/168/50 rows, per-customer reconciliation, sheet classification |
| `tests/unit/receivables-export.test.ts`      | the exported workbook's layout, totals, signature block and absence of formulas                                 |
| `tests/unit/receivables-permissions.test.ts` | who holds what, and who must not                                                                                |
| `tests/unit/receivables-routes.test.ts`      | server-side guards, same-origin, error shapes, no leaked internals                                              |
| `tests/e2e-admin/receivables.spec.ts`        | the storekeeper's round trip against a real server and database                                                 |

---

## 13. Unresolved business rules

Recorded rather than guessed. Each has a safe default in place.

1. **Sales slip → AR link.** Whether confirming a `Hóa đơn bán hàng` should post
   a debit automatically. Default: it does not; the AR ledger owns the debit
   side. The reference type and its unique index are reserved for the day this
   is decided.
2. **Return → stock.** Whether `Trả lại hàng` should also receive the goods back
   into `Bảng xuất kho sơn`. Default: money only. The schema can carry an
   inventory link later.
3. **Payment method.** The workbook records none, so no cash/transfer field was
   invented. `documentNumber` and `note` carry whatever is known.
4. **Due dates and aging.** The source has no payment term, so no aging buckets
   were built and no default term was assumed. `dueDate` is deliberately absent
   rather than guessed at 15 or 30 days.
5. **`TT toát nc 2 khay Kim`** (08/2026, one line). Mapped to `OTHER_OFFSET`
   with the original wording preserved and flagged for review, rather than
   guessed as a payment.
6. **Ten sales rows with a blank or zeroed `Thành tiền`** where a quantity and
   price exist. Imported at the amount the workbook itself summed (so the totals
   reconcile) and flagged `MISSING_AMOUNT` for the accountant to settle.
7. **Customer `linh`** trades 385.000 in and 385.000 out but has no row in
   `TongHopCongNo`. Carried with an opening balance of zero, which is why the
   ledger totals exceed the report's by exactly that on both sides while the
   closing total is identical.
