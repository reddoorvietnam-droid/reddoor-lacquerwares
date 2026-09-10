# Hóa đơn bán hàng (Phiếu bán hàng) — kiến trúc module

Cập nhật: 2026-09-09. Thay thế việc lập từng sheet Excel trong `08092026.xlsx`; database là nguồn dữ liệu duy nhất,
Excel chỉ còn là nguồn migration ban đầu, định dạng xuất file và công cụ đối soát. Báo cáo phân tích/migration:
`docs/sales-invoice-migration.md`.

## 1. Mục đích và ranh giới

- Menu **Hóa đơn bán hàng** lập, xác nhận, hủy, in, xuất PDF/Excel các **Phiếu bán hàng** của kho sơn (bán vật tư
  cho cơ sở / thợ). Bản in giữ nguyên tiêu đề **PHIẾU BÁN HÀNG** và bố cục sheet `HOADONMAU`.
- Đây là chứng từ nội bộ. Không phải hóa đơn GTGT điện tử: không có mã cơ quan thuế, ký hiệu, mẫu số, QR, VAT, MST
  người mua, thuế suất — workbook nguồn không có các trường đó và không được tự thêm.
- Khác với **Hóa đơn (INV)** của kế toán công ty (`src/domains/finance`, model `SalesInvoice`, quyền `invoices.*`):
  INV ghi nhận doanh thu đơn hàng xuất khẩu. Vì model `SalesInvoice` đã tồn tại, module này dùng tên kỹ thuật
  **sales slip** (`SalesSlip`, `salesSlips.*`, `/sales-slips`) để không trùng.

## 2. Vị trí trong hệ thống

| Lớp            | File                                                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trang          | `src/app/[locale]/admin/(portal)/sales-slips/page.tsx` (danh sách), `new/page.tsx` (tạo), `[slipId]/page.tsx` (chi tiết/sửa), `[slipId]/print/page.tsx` (bản in) |
| Menu           | `src/components/admin/admin-shell.tsx` — mục **Hóa đơn bán hàng**, hiện khi có `salesSlips.read`                                                                 |
| UI             | `src/components/admin/sales-slips/*` (danh sách, editor + autocomplete, bản in, toolbar in, api client, CSS)                                                     |
| API            | `src/app/api/sales-slips/route.ts`, `[slipId]/route.ts`, `[slipId]/transition`, `[slipId]/history`, `[slipId]/export`                                            |
| Domain         | `src/domains/sales-slips/{contracts,layout,sheet,models,access,http,service,export-workbook,pdf,import-workbook}.ts(x)`, `layout.json`                           |
| Số tiền → chữ  | `src/lib/money/vietnamese-words.ts`                                                                                                                              |
| Migration      | `scripts/import-sales-slips.ts` (`npm run import:sales-slips -- assets/08092026.xlsx [--apply]`), `scripts/analyze-sales-workbook.py`                            |
| Template Excel | `assets/sales-slip-template.xlsx` (một sheet `PhieuBanHang` = `HOADONMAU` đã xóa dữ liệu mẫu, named range, validation)                                           |
| Font PDF       | `assets/fonts/Tinos-{Regular,Bold}.ttf` (Apache 2.0, cùng metric với Times New Roman, đủ glyph tiếng Việt)                                                       |
| Kiểm thử       | `tests/unit/sales-slips-*.test.ts`                                                                                                                               |

`next.config.ts` khai báo `outputFileTracingIncludes` cho template và font, và giữ `@react-pdf/renderer` là external.

## 3. Mô hình dữ liệu (MongoDB, mongoose)

**`SalesSlip`** (`salesslips`) — một document mỗi phiếu, các dòng nhúng trong `lines` (phiếu ngắn, luôn đọc/ghi/audit
trọn vẹn). `_id` là UUID do trình duyệt sinh (tạo lạc quan, POST idempotent); `version` để compare-and-swap.

| Trường                                                                                                      | Ý nghĩa                                                                                          |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `internalNumber`                                                                                            | `PBH-yyyyMMdd-nnn`, mã phiếu nội bộ (không phải số hóa đơn điện tử); `null` với phiếu migration  |
| `slipDate` (Date UTC 00:00)                                                                                 | Ngày trên dòng 5 của phiếu                                                                       |
| `recipientId`, `recipientCode`, `recipientName`, `recipientUnit`                                            | Người nhận: liên kết tùy chọn tới danh mục + snapshot tên/đơn vị (tên có thể nhập tay như Excel) |
| `content`, `note`                                                                                           | Nội dung (in) và ghi chú nội bộ (không in)                                                       |
| `lines[]`: `id, lineNumber, itemId, itemCode, itemName, unit, quantity, unitPrice, lineAmount, priceManual` | Snapshot đầy đủ; `Decimal128` cho số                                                             |
| `subtotal`, `totalPayment`, `totalInWords`                                                                  | Server tính; `totalPayment = subtotal` (mẫu không có VAT/chiết khấu)                             |
| `status`                                                                                                    | `DRAFT` → `CONFIRMED` → (`DRAFT` khi mở lại) ; `CANCELLED` từ cả hai                             |
| `sourceType`, `migrationSource`, `migrationSheet`, `migrationIssues`, `importKey`, `fingerprint`            | Nguồn gốc và tính idempotent của migration                                                       |
| `linkedInventoryDocumentId`                                                                                 | Dành sẵn cho liên kết phiếu xuất kho sau này; module này không bao giờ ghi                       |
| `confirmedAt/By`, `cancelledAt/By`, `cancelReason`, `createdAt/By`, `updatedAt/By`                          | Dấu vết                                                                                          |

Chỉ mục: `internalNumber` unique partial (chỉ khi là string), `importKey` unique partial, `{slipDate:-1, createdAt:-1}`,
`{status, slipDate}`, `{recipientId, slipDate}`, `{createdBy, slipDate}`, `{lines.itemId}`, `{fingerprint}`.

**`SalesSlipCounter`** (`salesslipcounters`) — `{ _id: "PBH-20260908", seq }`, tăng bằng `findOneAndUpdate` trong cùng
transaction tạo phiếu → không trùng số. Số gán khi tạo nháp theo `slipDate` lúc đó và không đổi.

**Danh mục dùng chung** — không tạo collection `KhoSon` mới. `PaintWarehouseMaster` (danh mục của Bảng xuất kho sơn)
là master duy nhất:

- `kind: "material"` = vật tư (Mã VT, Vật tư, ĐVT). Thêm trường **`salePrice`** = "Gía bán" của `KhoSon!E`; giá này
  chỉ là **giá mặc định khi chọn mã**. `unitPrice` (giá của sổ xuất kho) không bị đụng tới và không dùng cho phiếu.
- `kind: "facility"` = người nhận (`MaNhaCungCap` ≈ `Cososx` của workbook sơn).

## 4. Ánh xạ Excel → hệ thống (`HOADONMAU`, vùng in A1:G19)

| Ô Excel                                                  | Web / DB                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| A1 `CÔNG TY TNHH CỬA ĐỎ`, A2 địa chỉ                     | Hằng số `company` trong `layout.ts` (đọc từ workbook; xem mục 12)                |
| A3 `=NOW()` (`m/d/yy h:mm`)                              | `createdAt` của phiếu, hiển thị theo giờ Việt Nam đúng định dạng đó              |
| A4:G4 `PHIẾU BÁN HÀNG`                                   | Tiêu đề cố định, Times New Roman 18 đậm, giữa                                    |
| A5:G5 `Ngày   dd   Tháng   mm    năm yyyy`               | Sinh từ `slipDate` (DB lưu Date, không lưu chuỗi)                                |
| A6 / C6:E6                                               | Nhãn / `recipientName`                                                           |
| A7:C7 `Đơn vị:`                                          | `recipientUnit` (in nối sau nhãn)                                                |
| A8 `Nội dung:`                                           | `content`                                                                        |
| Dòng 10 header                                           | Stt · Mã VT · Vật tư · ĐVT · Số lượng · Giá · Thành tiền                         |
| Dòng 11.. (B, C, D, E, F, G)                             | `itemCode`, `itemName`, `unit`, `quantity`, `unitPrice`, `lineAmount` (snapshot) |
| `=IFERROR(VLOOKUP(B,khoson,2/3/4,0),"")`                 | Tra danh mục trong DB khi chọn mã, không VLOOKUP                                 |
| `G = F*E`, `Tổng tiền = SUM(G)`, `Tổng cộng = Tổng tiền` | `applyDraft()` tính bằng `decimal.js`; client không được gửi thành tiền          |
| `Bằng chữ :`                                             | `vndInWords(subtotal)` ghi nối sau nhãn trong A16 (Excel không có công thức)     |
| E17 `Ngày….tháng….năm yyyy`                              | Năm lấy từ `slipDate`                                                            |
| Dòng 18–19: 4 vùng chữ ký                                | Giữ nguyên nhãn và merge                                                         |

Kích thước: `layout.json` giữ độ rộng cột (A 6.89 … G 15.11 ký tự), chiều cao dòng (dòng 10: 44.25pt, dòng hàng
24pt…), font/màu/viền từng ô (header `#95B3D7`, ô nhập B/E `#DBEEF4`), lề trang (0.4/0.23/0.31/0.16 in), A4 dọc.
`fitToPage` với `fitToHeight=0` nghĩa là "vừa 1 trang ngang" nên tỷ lệ in được tính từ bề rộng in được (~87.6 %),
không dùng số 84 % Excel lưu lại; ba renderer (HTML, PDF, XLSX) dùng chung `sheet.ts`.

## 5. Phân quyền (`src/domains/identity`)

| Quyền                  | Cho phép                                                   | Mặc định                                                |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| `salesSlips.read`      | thấy menu, danh sách, chi tiết, lịch sử (không có tiền)    | DIRECTOR, COMPANY_ACCOUNTANT, WAREHOUSE_MANAGER (`all`) |
| `salesSlips.create`    | tạo nháp                                                   | như trên                                                |
| `salesSlips.update`    | sửa nháp (ngày, người nhận, nội dung, dòng, số lượng)      | như trên                                                |
| `salesSlips.confirm`   | xác nhận, mở lại phiếu đã xác nhận (có lý do)              | như trên                                                |
| `salesSlips.cancel`    | hủy (có lý do)                                             | như trên                                                |
| `salesSlips.readPrice` | thấy Giá / Thành tiền / Tổng / Bằng chữ, sắp xếp theo tiền | như trên; nằm trong `sensitiveFieldPermissions`         |
| `salesSlips.editPrice` | gửi `unitPrice` khác giá danh mục/snapshot                 | như trên (kho sửa được giá trên phiếu)                  |
| `salesSlips.print`     | trang bản in                                               | như trên                                                |
| `salesSlips.export`    | PDF, XLSX                                                  | như trên                                                |
| `salesSlips.import`    | (dành cho migration/nhập file sau này)                     | DIRECTOR, COMPANY_ACCOUNTANT (không cấp cho kho)        |

Guard tạo bằng `createPermissionGuard` **không** có bypass `DEV_OPEN_ACCESS` (như kho sơn/NVL): chỉ grant global mới
tới được. Mọi route kiểm tra ở server; `readPrice` thiếu thì service **và** route đều `redactPrices()` (giá, thành
tiền, tổng, chữ = null, `pricesRedacted: true`) — không chỉ ẩn bằng CSS. Thủ kho (`WAREHOUSE_MANAGER`) được cấp
trọn luồng lập/sửa/xác nhận/hủy, xem và sửa đơn giá, in, xuất file (chốt 2026-09-09: "mục Hóa đơn bán hàng là của
role kho"); chỉ `salesSlips.import` (migration workbook) ở lại với Giám đốc/Kế toán công ty.

## 6. Vòng đời

1. **Tạo** — trang `/sales-slips/new` giữ nháp trong trình duyệt; lần autosave đầu (`POST`) tạo phiếu, cấp
   `internalNumber`, URL đổi sang `/sales-slips/<id>`. Autosave 800 ms sau mỗi thay đổi (`PATCH` với `version`).
2. **Sửa nháp** — server nhận toàn bộ header + dòng, `applyDraft()`:
   - mã đổi/dòng mới → snapshot tên, ĐVT, `salePrice` danh mục (`priceManual=false`);
   - mã giữ nguyên → giữ snapshot cũ (giá danh mục đổi sau không ảnh hưởng);
   - `unitPrice` gửi lên khác snapshot → cần `editPrice`, nếu không 403; giá bằng nhau không tính là sửa;
   - dòng trống bị bỏ; `lineAmount = quantity × unitPrice`; tổng và chữ tính lại.
     Không thay đổi thực sự → không ghi, không tăng `version`. Xung đột `version` → 409 "Phiếu đã được người khác cập
     nhật. Vui lòng tải lại dữ liệu."
3. **Xác nhận** (`POST /transition {action:"confirm"}`) — server kiểm: có người nhận, ≥1 dòng, mọi mã có trong danh
   mục, số lượng > 0, có đơn giá; lỗi trả 400 kèm danh sách. Modal "Xác nhận phiếu bán hàng?" ở client.
4. **Mở lại** (`reopen`, cần `confirm` + lý do) → về DRAFT, audit ghi lý do.
5. **Hủy** (`cancel`, lý do bắt buộc) → CANCELLED, lưu `cancelledBy/At/Reason`; không xóa cứng; bản in/PDF có
   watermark **ĐÃ HỦY**, XLSX ghi tiêu đề "PHIẾU BÁN HÀNG (ĐÃ HỦY)".

## 7. Audit

Mọi ghi chạy trong transaction cùng `appendAuditEventWithSession` (`resourceType: "salesSlip"`): `salesSlips.create`,
`.update`, `.confirm`, `.reopen`, `.cancel`, `.export` (metadata format), `.import` (migration). `changes.before/after`
giữ nguyên bản; `metadata.changes` là dòng đọc được, ví dụ `Đơn giá sonpha7505C-pt: 170,000 → 160,000`,
`Số lượng Hopnhuato: 1 → 2`, `Thêm mặt hàng XANG2 × 2 @ 55,000`, `Xóa mặt hàng …`, `Trạng thái: DRAFT → CONFIRMED`.
`GET /history` trả các dòng này kèm tên người thực hiện; người không có `readPrice` không nhận dòng có tiền.

## 8. In, PDF, XLSX

- **Bản in** (`/sales-slips/<id>/print`): `SalesSlipSheet` dựng bảng HTML theo `sheet.ts` với đúng font/size/màu/viền/độ
  rộng/chiều cao, scale như Excel; `print.css` đặt `@page A4` lề như workbook, ẩn header/sidebar/toolbar, lặp header
  bảng ở trang sau (`thead`), giữ khối chữ ký không tách trang. Font: Times New Roman (máy Windows) → Tinos → serif.
- **PDF** (`GET /export?format=pdf`): `@react-pdf/renderer` với font Tinos nhúng, cùng geometry; tên file
  `PBH-20260908-001.pdf`. Chưa lặp header bảng khi tràn trang (giới hạn của react-pdf).
- **XLSX** (`?format=xlsx`): ghi OOXML tay lên template (`export-workbook.ts`): dòng 1–10 giữ ô/style gốc, dòng hàng
  nhân bản style dòng 11, footer đánh số lại kèm merge và Print_Area; chỉ ghi **giá trị** (inline string / số), không
  công thức → không thể có `#REF!`/`#VALUE!`. Không giữ các named range hỏng của workbook cũ.

## 9. Danh sách, tìm kiếm, lọc

`GET /api/sales-slips?q&from&to&recipient&status&createdBy&sort&offset&limit(≤100)`; `q` tìm mã phiếu, người nhận,
mã/tên vật tư, tên sheet migration; sort `newest|oldest|dateAsc|dateDesc|totalAsc|totalDesc` (hai giá trị cuối chỉ có
tác dụng khi có `readPrice`). Phân trang server, "Tải thêm". Cột Tổng tiền chỉ render cho người có `readPrice`.

## 10. Tích hợp kho

Chưa liên kết. Phiếu bán hàng **không** trừ tồn và **không** tạo dòng Bảng xuất kho sơn hay giao dịch NVL: chưa xác
minh Phiếu bán hàng có phải là bản in của một nhóm dòng xuất kho sơn hay là giao dịch độc lập; trừ hai lần sẽ làm sai
tồn. Trường `linkedInventoryDocumentId` và audit đã sẵn để sau này "xác nhận phiếu → tạo phiếu xuất" với idempotency
(một phiếu chỉ được sinh một chứng từ). Xem `docs/sales-invoice-migration.md` mục "Câu hỏi nghiệp vụ còn mở".

## 11. Kiểm thử

| File                                         | Nội dung                                                                                                                                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/sales-slips-words.test.ts`       | 0, 1.000, 10.000, 105.000, 865.000, 1.000.000, 10.700.000, tỷ, nghìn tỷ, làm tròn, số âm                                                                                                 |
| `tests/unit/sales-slips-contracts.test.ts`   | 5×170000, 0.05×800000, nhiều dòng = 865000, snapshot giá khi danh mục đổi, quyền sửa giá, confirm từ chối mã lạ / 0 / thiếu giá, trùng mặt hàng chỉ cảnh báo, redact, paste, sheet model |
| `tests/unit/sales-slips-permissions.test.ts` | catalog + seed role: DIRECTOR/COMPANY_ACCOUNTANT có đủ, các role khác không                                                                                                              |
| `tests/unit/sales-slips-routes.test.ts`      | 401/403 trước khi đọc body, same-origin, redact ở route, editPrice truyền xuống, transition đúng quyền                                                                                   |
| `tests/unit/sales-slips-import.test.ts`      | phân loại 21 sheet, 8 phiếu, tổng từng sheet (865000/40000/425000/85000/85000/800000/3560000), HOADONMAU (2) cần kiểm tra, fingerprint ổn định                                           |
| `tests/unit/sales-slips-export.test.ts`      | XLSX: merge/width/height/màu/giá trị/Print_Area/không formula; PDF có font Tinos                                                                                                         |

E2E (Playwright script tạm, dev server + dev-preview sign-in): kế toán công ty tạo phiếu → chọn người nhận, mã vật
tư autocomplete, Enter thêm dòng, dán 2 dòng, autosave, reload, sửa giá, lịch sử, xác nhận, PDF/XLSX tải về, bản in,
mở lại, hủy có watermark; thủ kho không thấy menu, API 403, trang 404; Giám đốc đọc phiếu migration.

## 12. Câu hỏi nghiệp vụ chưa chốt (không tự quyết)

1. **Kế toán công ty có cần lập/xác nhận/hủy phiếu?** Module đã được chốt là của kho; Giám đốc và Kế toán công ty
   vẫn giữ toàn bộ quyền để tra cứu, chỉnh giá và đối soát. Nếu muốn tối giản, bỏ `create/update/confirm/cancel`
   khỏi `COMPANY_ACCOUNTANT` trong `role-definitions.ts` rồi chạy `npm run seed`.
2. **Liên kết kho** (mục 10).
3. **Tên/địa chỉ in**: bản in giữ đúng workbook (`CÔNG TY TNHH CỬA ĐỎ`, `Số 25A,Lô 15,cụm CN làng nghề Hạ Thái,Duyên
Thái,Thường Tín,Hà Nội`). Site Settings hiện lưu tên thương hiệu "Cửa Đỏ Việt Nam" và địa chỉ theo địa giới mới (xã
   Hồng Vân) — chưa rõ bản in phải theo bên nào; nếu đổi, sửa `company` trong `layout.ts` hoặc thêm thiết lập pháp lý.
4. **Vật tư chưa có giá bán** (danh mục sơn có 899 mã, `KhoSon` chỉ 500): chọn mã đó thì dòng không có giá, chỉ người
   có `editPrice` nhập được; không tự lấy `unitPrice` của sổ xuất kho làm giá bán.
5. **Cách đọc số**: dùng "linh" (miền Bắc) và "tư" sau hàng chục (24 → "hai mươi tư"); đổi trong
   `vietnamese-words.ts` nếu kế toán muốn "lẻ"/"bốn".
6. **Đơn vị** (dòng 7) và **Nội dung** (dòng 8) đều trống trong mọi phiếu nguồn; giữ là ô nhập tự do.
