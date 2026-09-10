# Bảng xuất kho sơn (sổ chi tiết xuất kho sơn)

Cập nhật: 2026-09-09. Thay thế việc mở và gõ tay sheet `ChiTietxuatkho` trong
`BANG XUAT KHO SON -2026.xlsx`. Database là nguồn dữ liệu; Excel chỉ còn là nguồn migration ban đầu, kênh
nhập/xuất file và công cụ đối soát.

Trang: `/vi/admin/paint-warehouse` — mục **Bảng xuất kho sơn** trong cổng quản trị.

## 1. Vị trí trong hệ thống

| Lớp           | File                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Trang         | `src/app/[locale]/admin/(portal)/paint-warehouse/page.tsx`                                                                        |
| Menu          | `src/components/admin/admin-shell.tsx` — hiện khi có `paintWarehouse.read`                                                        |
| UI            | `src/components/admin/paint-warehouse/` (`paint-warehouse.tsx`, `editor.tsx`, `paste-panel.tsx`, `confirm.tsx`, `shared.ts`)      |
| API           | `src/app/api/paint-warehouse/route.ts` (đọc / lưu / xóa / xuất Excel), `src/app/api/paint-warehouse/import/route.ts` (nhập Excel) |
| Domain        | `src/domains/paint-warehouse/{contracts,models,access,service,import-workbook,export-workbook}.ts`, `layout.json`                 |
| Migration     | `scripts/import-paint-warehouse.ts` (`npm run import:paint -- "<file.xlsx>" [--apply]`), `scripts/analyze-paint-workbook.py`      |
| Template xuất | `assets/paint-warehouse-template.xlsx` (sinh từ file gốc, đã xóa sạch dữ liệu)                                                    |
| Kiểm thử      | `tests/unit/paint-warehouse*.test.ts`, `tests/e2e-admin/paint-warehouse.spec.ts`                                                  |

## 2. Phân tích file nguồn

`BANG XUAT KHO SON -2026.xlsx` (SHA-256 `bede037d…a91918`) có 15 sheet; sheet nghiệp vụ của module này là
`ChiTietxuatkho` (`A1:T3733`).

- **Dòng 1** merge `A1:N1`: `SỔ CHI TIẾT XUẤT KHO SƠN / NĂM 2026`, cao 51.75, Times New Roman đậm, canh giữa,
  wrap. **Dòng 2** trống (giữ nguyên trong bố cục). **Dòng 3** là header, cao 73.5.
- 14 cột nghiệp vụ A–N; độ rộng thật: A 15 · B 24.44 · C 25.66 · D 25.66 · E 30.55 · F 11 · G 8 · H 7.44 ·
  I 16 · J 14.44 · K 10.33 · L 14.44 · M (mặc định) · N 14.33. Cột **L** có nền vàng ở vùng dữ liệu.
- Toàn bộ font/viền/nền/định dạng số/chiều cao từng dòng được trích bằng
  `scripts/analyze-paint-workbook.py` vào `src/domains/paint-warehouse/layout.json` (**file xuất** đọc từ đây;
  bảng trên web dùng giao diện chung của cổng quản trị) và `docs/paint-workbook-analysis.json` (báo cáo cấu trúc).
- **Màu theme**: `xl/theme1.xml` liệt kê `dk1, lt1, dk2, lt2, accent1…` nhưng chỉ số `theme` của ô lại đếm
  `0=lt1, 1=dk1, 2=lt2, 3=dk2`. Đọc theo thứ tự tài liệu (lỗi đã sửa 2026-09-09) làm chữ đen thành trắng, nền
  header xanh nhạt thành trắng và nền trắng thành đen — cả bảng gần như không đọc được. Giá trị đúng: chữ
  `#000000`, header `#8EB4E3` (theme 3 + tint 0.6 = "Text 2, Lighter 60%"), ô dữ liệu trắng, cột L vàng
  `#FFFF00`. `tests/unit/paint-warehouse.test.ts` khóa các màu này lại để lỗi không quay lại.
- Phân loại 3 730 dòng từ dòng 4: **2 065 dòng giao dịch đủ dữ liệu**, **1 dòng dở dang** (dòng 2069: có ngày,
  cơ sở `Haohut`, mã `951a1`, diễn giải `xuất kho`, chưa có số lượng), 1 664 dòng trống. Dòng dữ liệu cuối: 2069.
- 7 ô nháp nằm ngoài bảng (`P16`, `P102`, `Q961`, `O1060`, `S1472`, `T1474`, `P2064`) — phép tính tay, bỏ qua.
- `freeze A2059` trong file chỉ là vị trí cuộn lúc lưu, không phải thiết kế; template và web freeze ở header.

### Named ranges và phụ thuộc

| Tên                | Vùng                                              | Dùng ở                                                 |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------ |
| `MaNhaCungCap`     | `Cososx!$C$5:$E$91`                               | `ChiTietxuatkho!C = VLOOKUP(B, MaNhaCungCap, 2, 0)`    |
| `khoson`           | `'Kho son'!$B$2:$E$1007`                          | `E`, `G`, `I`, `L` của sổ xuất và `C`, `E` của sổ nhập |
| `dmvattu`          | `'Kho son'!$B$3:$E$1048576`                       | `Tong kho son!E`, `kho son pha!E`                      |
| `BR_MVT` / `BR_SL` | `ChiTietxuatkho!$D$4:$D$6161` / `$H$4:$H$1048576` | `SUMIF` cột **xuất** của hai bảng tổng kho             |
| `MV_MVT` / `MV_SL` | `ChiTietNhapson!$B$4:$B$8063` / `$F$4:$F$1048576` | `SUMIF` cột **nhập** của hai bảng tổng kho             |

## 3. Mô hình dữ liệu

**`PaintWarehouseExport`** (`paintwarehouseexports`) — mỗi dòng sổ là một document, `_id` là chuỗi (UUID cho
dòng tạo trên web, `xlsx_<hash24>_<row6>` cho dòng nhập từ Excel):

`version` (compare-and-swap), `sourceRow`, `importKey` (unique sparse, `<sha256 file>:<dòng>`), `deleted`
(soft delete), `exportDate` (Date UTC-midnight), `facilityCode` + `facilityNameSnapshot`, `materialCode` +
`materialNameSnapshot`, `description`, `unit`, `quantity`, `unitPrice`, `amount`, `actualQuantity`,
`discountedUnitPrice`, `actualAmount`, `actualQuantityManual`, `discountedPriceManual`, `note`,
`createdAt/By`, `updatedAt/By`.

Mọi số lưu **chuỗi decimal chuẩn** (decimal.js ở tầng nghiệp vụ) — không dùng float nhị phân cho tiền.

**`PaintWarehouseMaster`** (`paintwarehousemasters`) — danh mục dùng chung: `kind` (`facility` | `material`),
`key` (= `codeKey(code)`, unique theo `kind`), `code`, `name`, `unit`, `unitPrice`, và `salePrice` (giá bán,
do module **Hóa đơn bán hàng** ghi và đọc — module này không sửa trường đó).

Chỉ mục: `importKey` unique sparse · `{deleted, exportDate, _id}` (bảng chính) · `{materialCode, exportDate}` ·
`{facilityCode, exportDate}` · `{kind, key}` unique cho danh mục.

## 4. Ánh xạ Excel → database

| Cột | Tiêu đề               | Trường                                          | Ghi chú                                                                 |
| --- | --------------------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| A   | Ngày/Tháng/Năm        | `exportDate`                                    | Excel date → `Date` UTC 00:00; UI `dd/MM/yyyy`; xuất lại là ô ngày thật |
| B   | Mã cơ sở SX           | `facilityCode`                                  | so khớp không phân biệt hoa/thường (giống VLOOKUP)                      |
| C   | Tên cơ sở SX          | `facilityNameSnapshot`                          | **tự tính** từ danh mục, lưu snapshot                                   |
| D   | Mã vật tư             | `materialCode`                                  |                                                                         |
| E   | Vật tư                | `materialNameSnapshot`                          | **tự tính**, snapshot                                                   |
| F   | Diễn giải             | `description`                                   | mặc định `xuất kho` khi thêm dòng                                       |
| G   | Đơn vị tính           | `unit`                                          | **tự tính**, snapshot                                                   |
| H   | Số lượng              | `quantity`                                      | thập phân (0.05 / 0.9 / 2.5…), không làm tròn                           |
| I   | Đơn giá               | `unitPrice`                                     | **tự tính** từ danh mục, snapshot theo thời điểm ghi                    |
| J   | Thành tiền            | `amount`                                        | **tự tính** `H × I`, server tính lại                                    |
| K   | Số lượng (thực nhận)  | `actualQuantity` + `actualQuantityManual`       | mặc định bằng H; sửa tay được                                           |
| L   | Đơn giá đã chiết khấu | `discountedUnitPrice` + `discountedPriceManual` | mặc định bằng I; sửa tay được (nền vàng)                                |
| M   | Thành tiền thực nhận  | `actualAmount`                                  | **tự tính** `K × L`                                                     |
| N   | Ghi chú               | `note`                                          |                                                                         |

## 5. Công thức Excel → nghiệp vụ (`contracts.ts: applyPatch`)

| Excel                                             | Hệ thống                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `C = IFERROR(VLOOKUP(B, MaNhaCungCap, 2, 0), "")` | đổi B → tra danh mục cơ sở → ghi `facilityNameSnapshot`; mã lạ bị từ chối                        |
| `E/G/I = VLOOKUP(D, khoson, 2/3/4, 0)`            | đổi D → tra danh mục vật tư → tên, ĐVT, đơn giá; nếu K/L chưa sửa tay thì L nhận lại đơn giá mới |
| `J = I * H`                                       | `amount = quantity × unitPrice`, tính ở server, không nhận giá trị từ trình duyệt                |
| `K = H`                                           | khi H đổi và K chưa sửa tay, K theo H; xóa K → quay lại theo H                                   |
| `M = L * K`                                       | `actualAmount = actualQuantity × discountedUnitPrice`                                            |

Snapshot: sửa danh mục về sau **không** làm đổi các dòng đã ghi (`unitPrice` cũ được giữ) — đã có unit test.

## 6. Sửa dữ liệu trên web

Trang dùng chung ngôn ngữ thiết kế với các mục khác trong cổng quản trị (Theo dõi tiến độ mẫu, Nguyên vật
liệu, Hóa đơn bán hàng): eyebrow + tiêu đề serif + dòng tóm tắt (số dòng · **thành tiền thực nhận của cả sổ
theo bộ lọc**, do server cộng · trạng thái), thẻ công cụ, nút viên, bảng sạch, khung xác nhận và thông báo
ngay trong trang. Không còn bảng mô phỏng Excel trên web — **file `.xlsx` xuất ra vẫn giữ nguyên bố cục
workbook gốc** (mục 11).

- **Thẻ công cụ**: bộ lọc có nhãn (Tìm · Từ ngày · Đến ngày · **Lọc** · **Xóa bộ lọc**) và các nút
  **+ Thêm phiếu xuất** · **Dán từ Excel** · **Nhập Excel** · **Xuất Excel** · **Tải lại**, kèm trạng thái
  `Đang tải... / Đã tải dữ liệu / Đang lưu... / Đã lưu / Lỗi lưu`.
- **Bảng**: 14 cột nghiệp vụ theo đúng thứ tự workbook (Ngày · Mã cơ sở · Cơ sở SX · Mã vật tư · Vật tư ·
  Diễn giải · ĐVT · Số lượng · Đơn giá · Thành tiền · SL thực nhận · Đơn giá đã chiết khấu · Thành tiền thực
  nhận · Ghi chú) + cột **Thao tác** dính bên phải. Ngày `dd/MM/yyyy`, tiền và số lượng căn phải có dấu phân
  cách nghìn. Ô **Đơn giá đã chiết khấu** có nền hổ phách nhạt để giữ tín hiệu nghiệp vụ của ô vàng trong
  Excel (đây là ô được sửa tay).
- **Sửa / Thêm**: mỗi dòng có nút **Sửa**; nút **+ Thêm phiếu xuất** mở cùng một form thẻ. Trong form, gõ
  **mã hoặc tên** cơ sở / vật tư là các ô Tên cơ sở SX · Vật tư · ĐVT · Đơn giá · Thành tiền · Thành tiền thực
  nhận tự điền theo đúng công thức cũ (mục 5); **Số lượng thực nhận** và **Đơn giá đã chiết khấu** để trống
  nghĩa là lấy mặc định, gõ vào là giữ giá trị sửa tay. Bấm **Áp dụng** là ghi ngay vào sổ.
- **Xóa dòng**: khung xác nhận ngay trong trang rồi xóa mềm (`deleted: true`), không mất vết.
- **Dán từ Excel**: dán nhiều dòng theo thứ tự `Ngày ⇥ Mã cơ sở ⇥ Mã vật tư ⇥ Số lượng ⇥ SL thực nhận ⇥
Đơn giá đã chiết khấu ⇥ Ghi chú`, xem trước từng dòng rồi ghi một lần (tối đa 500 dòng, tất cả hoặc không).
- **Phân trang**: 200 dòng mỗi lần, nút **Tải thêm (n dòng còn lại)**; bộ lọc và tổng tiền do server tính nên
  luôn đúng trên toàn bộ sổ chứ không chỉ phần đã tải.

## 7. Đồng thời và toàn vẹn

Mỗi lần lưu chạy trong một transaction MongoDB: đọc dòng theo `_id`, so `version` (compare-and-swap), ghi giá
trị **server tự tính lại** (`amount`, `actualAmount`, các snapshot), tăng `version`, ghi audit. Hai tab cùng
sửa một dòng thì tab cũ nhận **409** kèm thông báo tiếng Việt và giữ nguyên bản nháp — không có ghi đè âm thầm.
Một lô dán nhiều dòng là **tất cả hoặc không**: một dòng xung đột thì cả lô bị hủy.

## 8. Phân quyền

| Quyền                   | Cho phép                           |
| ----------------------- | ---------------------------------- |
| `paintWarehouse.read`   | mở trang, đọc dòng, đọc danh mục   |
| `paintWarehouse.create` | thêm dòng (kể cả dán tạo dòng mới) |
| `paintWarehouse.update` | sửa dòng đã có                     |
| `paintWarehouse.delete` | xóa mềm dòng                       |
| `paintWarehouse.export` | tải file `.xlsx`                   |
| `paintWarehouse.import` | nhập từ file Excel                 |

`WAREHOUSE_MANAGER` (Thủ kho) giữ cả 6 ở scope `all`; `DIRECTOR` có toàn bộ catalog. Vai trò khác: không thấy
menu, vào thẳng URL nhận 404, mọi API trả 401/403 (đã kiểm chứng bằng E2E với `CONTENT_CREATOR`). Guard của
module không nhận `DEV_OPEN_ACCESS`. Mọi API tự kiểm tra quyền, không dựa vào việc ẩn nút.

## 9. Audit

Mỗi lần tạo/sửa/xóa ghi một `AuditEvent` trong cùng transaction (`resourceType: "paintWarehouse"`,
`resourceId` = id dòng, `changes: { before, after }`), action `paintWarehouse.create|update|delete`; nhập file
ghi `paintWarehouse.import` kèm tên file, số dòng và checksum. Cột `createdBy/updatedBy` lưu id người dùng
(hoặc `paint-workbook-migration` cho dữ liệu chuyển từ Excel).

## 10. Migration dữ liệu cũ

```
npm run import:paint -- "assets/BANG XUAT KHO SON -2026.xlsx"          # dry-run, chỉ báo cáo
npm run import:paint -- "assets/BANG XUAT KHO SON -2026.xlsx" --apply  # ghi trong một transaction
```

Idempotent nhờ `importKey = <sha256 file>:<số dòng>`; chạy lại lần hai chèn 0 dòng. Kết quả đã chạy thật
(báo cáo đầy đủ ở `backups/paint-import-report.json`):

|                                          |                                   |
| ---------------------------------------- | --------------------------------- |
| Dòng nguồn có dữ liệu                    | 2 066                             |
| Đã nhập                                  | **2 066**                         |
| Dòng trống bỏ qua                        | 1 664                             |
| Dòng lỗi                                 | **0**                             |
| Tổng `Thành tiền` (Excel / DB)           | **1 253 865 460 / 1 253 865 460** |
| Tổng `Thành tiền thực nhận` (Excel / DB) | **1 252 609 560 / 1 252 609 560** |
| Lệch (`mismatches`)                      | **0** — `verified: true`          |

Danh mục: 901 mã vật tư từ sheet `Kho son` và 87 mã cơ sở từ `Cososx` (bảng `paintwarehousemasters` hiện có
985 vật tư và 94 cơ sở vì module Hóa đơn bán hàng bổ sung thêm; xem `docs/sales-invoice-migration.md`).

Ba cảnh báo được ghi lại, không có lỗi:

- `Kho son` dòng 14: mã `Cndenmo` trùng (khác hoa/thường) — giữ lần xuất hiện đầu, đúng ngữ nghĩa VLOOKUP.
- `Kho son` dòng 793: mã `WC-450NY-P` trùng — như trên.
- `ChiTietxuatkho` dòng 2069: dòng dở dang, giữ nguyên ô trống, **không tự điền** số lượng/đơn giá.

## 11. Nhập / xuất Excel

- **Xuất** (`GET /api/paint-warehouse?export=1` + bộ lọc đang xem): dựng từ `assets/paint-warehouse-template.xlsx`
  bằng OOXML viết tay — giữ tên sheet `ChiTietxuatkho`, tiêu đề merge `A1:N1`, độ rộng cột, chiều cao từng dòng,
  font, viền, nền (kể cả cột L vàng), định dạng số/ngày, freeze và print setup của bản gốc. Ngày là ô ngày thật,
  số là ô số thật, chuỗi ghi dạng `inlineStr` nên nội dung như `=HYPERLINK(...)` không bao giờ trở thành công
  thức. File mở được bằng Microsoft Excel, tiếng Việt đúng.
- **Nhập** (`POST /api/paint-warehouse/import`, multipart: `file` (.xlsx/.xlsm ≤ 5 MB, kiểm tra chữ ký ZIP,
  đọc theo luồng có giới hạn — không tin `content-length`), `mode=preview|apply`, `includeDuplicates=1`):
  Upload → Parse → **Xem trước** → Xác nhận → ghi trong một transaction kèm một sự kiện audit.
  - `mode=preview` trả `{ hash, fileName, rows[], counts, sourceAmount, sourceActualAmount, issues, warnings }`;
    mỗi dòng mang trạng thái **hợp lệ / lỗi / đã nhập trước đó / trùng nội dung** và cờ `unknownMaterial`,
    `unknownFacility` (mã không có trong danh mục — vẫn nhập được, giữ snapshot của file). Xem trước
    **không ghi gì**.
  - `already-imported` xét theo `importKey` (`<sha256 tệp>:<dòng>`) — đúng khóa mà script migration dùng, nên
    nhập lại chính tệp đã migrate sẽ không tạo bản sao. `duplicate` là dòng trùng nội dung nghiệp vụ (cùng
    ngày, mã vật tư, mã cơ sở, số lượng, ghi chú) với một dòng đang có; chỉ được ghi khi tích
    "Nhập cả các dòng trùng".
  - `mode=apply` trả `{ hash, imported, skipped }`. Danh mục vật tư/cơ sở **không** bị sửa bởi đường nhập trên
    web (chỉ script migration mới ghi danh mục).
  - Đã kiểm chứng trên dữ liệu thật: nhập lại `BANG XUAT KHO SON -2026.xlsx` cho `counts = { valid: 0,
invalid: 0, already-imported: 2066, duplicate: 0 }`, apply trả lỗi "Không có dòng hợp lệ để nhập." và sổ
    vẫn đúng 2 066 dòng.

## 12. Phụ thuộc tồn kho (chưa thay đổi trong phạm vi này)

Trong workbook, sổ xuất này là nguồn của cột **xuất** ở hai bảng tổng kho:

| Sheet                       | Công thức                                                                     | Ý nghĩa                                     |
| --------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------- |
| `Tong kho son` (A1:ET61)    | `H = SUMIF(MV_MVT, D, MV_SL)`, `I = SUMIF(BR_MVT, D, BR_SL)`, `J = G + H − I` | tồn kho sơn: tồn đầu + nhập − xuất          |
| `kho son pha` (A1:U574)     | cùng công thức                                                                | tồn kho sơn pha                             |
| `ChiTietNhapson` (A1:M8335) | nguồn `MV_MVT`/`MV_SL`                                                        | sổ chi tiết **nhập** sơn (chưa đưa lên web) |

Nghĩa là mỗi dòng xuất kho ảnh hưởng trực tiếp tồn kho. Module này **không** tự ý thay đổi nghiệp vụ tồn kho,
nhưng dữ liệu đã đủ để sau này tính `Tồn cuối = Tồn đầu + Nhập − Xuất` thẳng từ database: mỗi dòng có
`materialCode`, `quantity` và `exportDate`, chỉ mục `{materialCode, exportDate}` sẵn sàng cho aggregation
`$group`, và mẫu đã được hiện thực đầy đủ ở module **Nguyên vật liệu** (`docs/material-inventory.md` mục 3).
Việc còn thiếu để khép vòng tồn kho sơn: đưa `ChiTietNhapson` (sổ nhập) và tồn đầu kỳ của `Tong kho son` /
`kho son pha` vào database.

## 13. Kiểm thử

- `tests/unit/paint-warehouse.test.ts` — nhân số chính xác (1×200 000, 2.5×120 000 = 300 000, 3×120 000 =
  360 000, 0.1×0.2 = 0.02), tra mã không phân biệt hoa/thường, K/L mặc định và khi sửa tay, giữ snapshot đơn
  giá, từ chối mã lạ / ngày sai / số âm / `amount` do client gửi, và ma trận phân quyền.
- `tests/unit/paint-warehouse-export.test.ts` — mở lại file xuất bằng SheetJS: tên sheet, tiêu đề, merge, độ
  rộng, ô ngày, số thập phân, nền vàng cột L, chuỗi không thành công thức.
- `tests/unit/paint-warehouse-import.test.ts` — parser và bảng xem trước (hợp lệ / lỗi / đã nhập / trùng),
  khóa nhập idempotent, mã lạ so với danh mục.
- `tests/unit/paint-warehouse.test.ts` còn khóa màu và độ rộng cột lấy từ workbook cho **file xuất** (mục 2).
- `tests/unit/paint-warehouse-ui.test.tsx` — trang dựng bảng và thanh công cụ, form chỉ ghi khi hợp lệ, các ô
  tự tính từ danh mục, xóa dòng phải xác nhận.
- `tests/e2e-admin/paint-warehouse.spec.ts` (chạy với dev server đang bật):
  `npx playwright test -c playwright.admin.config.ts tests/e2e-admin/paint-warehouse.spec.ts --project=desktop`
  — thủ kho thêm dòng, dán 14 cột, đọc lại, sửa L rồi kiểm tra M, tải Excel; hai phiên không ghi đè nhau
  (409, lô dán là tất-cả-hoặc-không); biên tập nội dung bị chặn trang, danh sách, xuất và mọi thao tác ghi.

## 14. Điểm chưa chắc chắn

1. Cột **K** trong file gốc là công thức `=H` ở hầu hết dòng nhưng có dòng đã sửa tay; hệ thống giữ cả hai
   hành vi (mặc định theo H, sửa tay thì giữ nguyên, xóa thì quay lại theo H). Nếu nghiệp vụ muốn K luôn bằng H
   thì phải nói rõ để khóa ô.
2. **L** mặc định bằng đơn giá danh mục và sửa tay được (ô vàng). File gốc không ghi lý do chiết khấu; hệ thống
   không tự suy diễn.
3. Hai mã vật tư trùng chỉ khác hoa/thường trong `Kho son` (`Cndenmo`, `WC-450NY-P`) — đang giữ bản đầu tiên
   như Excel. Cần thủ kho xác nhận đâu là mã chuẩn.
4. Dòng 2069 chưa có số lượng: giữ nguyên trạng thái dở dang, không tự điền.
5. Sổ **nhập** sơn (`ChiTietNhapson`) và tồn đầu kỳ chưa được đưa lên web nên chưa tính được tồn kho sơn trực
   tiếp từ database (mục 12).
