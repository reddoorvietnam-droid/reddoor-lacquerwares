# Nguyên vật liệu (kho NVL) — kiến trúc module

Cập nhật: 2026-09-09. Thay thế `RedDoor - NVL - 2026.xlsx`; database là nguồn dữ liệu duy nhất, Excel chỉ còn là
nguồn migration ban đầu, kênh nhập/xuất file và công cụ đối soát. Báo cáo phân tích/migration:
`docs/material-inventory-migration.md`.

## 1. Vị trí trong hệ thống

| Lớp            | File                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Trang          | `src/app/[locale]/admin/(portal)/materials/page.tsx` → `/vi/admin/materials?tab=summary\|inbound\|outbound\|catalog`          |
| Menu           | `src/components/admin/admin-shell.tsx` — mục **Nguyên vật liệu**, hiện khi có `materials.read`                                |
| UI             | `src/components/admin/materials/*` (workspace, grid kiểu Excel, 4 tab, drawer chi tiết, form nhập/xuất, hộp thoại nhập Excel) |
| API            | `src/app/api/materials/{masters,summary,transactions,detail,export,import}/route.ts`                                          |
| Domain         | `src/domains/materials/{contracts,models,access,http,service,import-workbook,export-workbook}.ts`, `layout.json`              |
| Migration      | `scripts/import-materials.ts` (`npm run import:materials -- <file.xlsx> [--apply]`), `scripts/analyze-materials-workbook.py`  |
| Template Excel | `assets/materials-template.xlsx` (5 sheet trống giữ định dạng nguồn)                                                          |
| Kiểm thử       | `tests/unit/materials-*.test.ts(x)`, `tests/integration/materials-stock-check.ts`                                             |

## 2. Mô hình dữ liệu (MongoDB, mongoose)

Ba collection, `_id` là chuỗi UUID do client sinh (cho phép tạo dòng lạc quan trên bảng), `version` để
compare-and-swap, mọi số lượng là `Decimal128`.

**`MaterialItem`** (`materialitems`) — danh mục vật tư (`KhoNVL` + tồn đầu từ `Tong kho NVL`):
`code`, `normalizedCode` (unique, = trim+lowercase), `name`, `unit`, `openingQuantity`, `minimumStock` (null),
`note`, `active`, `sortOrder`, `migrationSource`, `sourceRow`, `createdAt/By`, `updatedAt/By`.

**`MaterialFacility`** (`materialfacilities`) — cơ sở / người nhận (`Cososx`): `code`, `normalizedCode` (unique),
`name`, `type`, `phone`, `note`, `active`, `sortOrder`, audit fields.

**`MaterialTransaction`** (`materialtransactions`) — sổ cái, mỗi dòng là một giao dịch:
`type` (`INBOUND` | `OUTBOUND` | `ADJUSTMENT`), `status` (`POSTED` | `CANCELLED`), `transactionDate` (UTC 00:00),
`materialId` + snapshot `materialCode/materialName/unit`, `quantity`, `unitPrice`, `amount` (= quantity × unitPrice,
server tính), `facilityId` + snapshot `facilityCode/facilityName`, `description`, `note`, `batchId` (các dòng lưu
cùng một lần), `importKey` (unique sparse — `${sha256}:${sheet}:${row}`), `fingerprint` (hash nghiệp vụ để cảnh báo
trùng khi nhập file), `migrationSource`, `sourceRow`, audit fields, `cancelledAt/By/Reason`.

Chỉ mục: `normalizedCode` unique (2 danh mục); `{status, materialId, type}` (tính tồn); `{type, status,
transactionDate, createdAt, _id}` (tab nhập/xuất); `{materialId, status, transactionDate, createdAt, _id}` (timeline
và click từ Tổng kho); `{facilityId, transactionDate}`; `{fingerprint}`; `{importKey}` unique.

## 3. Tồn kho là view tính toán

```
current = openingQuantity + Σ INBOUND − Σ OUTBOUND + Σ ADJUSTMENT   (chỉ dòng status = POSTED)
```

`service.readBalances()` chạy một aggregation `$group` theo `materialId` trên `Decimal128`; `readSummary()` ghép
với danh mục để ra bảng **Tổng kho** (STT, Mã, Vật tư, ĐVT, Tồn đầu, Nhập, Xuất, Tồn cuối, Ghi chú) và KPI đếm
số vật tư còn hàng / sắp hết / hết hàng (không cộng số lượng khác đơn vị). Mặc định bảng và KPI chỉ gồm vật tư
"đã theo dõi" — có tồn đầu, có ngưỡng tối thiểu hoặc có phát sinh — tương ứng 81 dòng của `Tong kho NVL`; ô
`Hiện toàn bộ danh mục` (API `includeInactive=1`) mở rộng ra mọi mã trong KhoNVL kể cả ngừng dùng. Không có
trường `currentStock` lưu sẵn; không có công thức Excel nào được lưu.

Trạng thái: `out` khi tồn ≤ 0, `low` khi tồn ≤ `minimumStock` (nếu có), còn lại `in`.

## 4. Vòng đời giao dịch

1. **Tạo** — bảng (autosave theo lô) hoặc form. Dòng chỉ được gửi khi đủ: vật tư, số lượng > 0, và cơ sở với
   xuất kho (`transactionCompleteness`). Server áp `applyTransactionPatch`: mã → id + snapshot từ danh mục (không
   phân biệt hoa/thường, giống VLOOKUP), từ chối mã lạ hoặc đã ngừng dùng, tính lại `amount`.
2. **Sửa** — chỉ các trường trong `editableTransactionFields[type]`; `{ _id, version }` compare-and-swap, lệch →
   409 "Dữ liệu đã được người khác thay đổi…".
3. **Hủy** — `status = CANCELLED` + lý do, không xóa cứng; loại khỏi tồn; ghi audit.
4. `ADJUSTMENT` có trong model và phép tính nhưng API chưa mở (chưa có quy trình phê duyệt điều chỉnh).

### Quy tắc không âm kho và xử lý đồng thời

Mọi ghi chạy trong `connection.transaction()`. Trước khi đọc tồn, service **ghi vào document vật tư** bị ảnh
hưởng (`$set updatedAt`) — đó là khóa: hai giao dịch cùng chạm một vật tư thì giao dịch sau gặp WriteConflict, được
mongoose thử lại sau khi giao dịch trước commit, và đọc thấy tồn mới. Sau khóa: đọc tồn bằng session, cộng delta của
cả lô, `decideStock(current, delta)`: từ chối khi delta < 0 và tồn sau < 0 với thông báo
`Số lượng xuất vượt quá tồn kho hiện tại. Tồn hiện tại: X ĐVT · Yêu cầu xuất: Y ĐVT` (409, kèm số liệu). Hủy
phiếu nhập cũng đi qua quy tắc này (không được làm tồn âm). Vật tư có lịch sử âm (migration) vẫn nhận nhập kho.
Kiểm chứng bằng `tests/integration/materials-stock-check.ts` (#79–#88 trong yêu cầu, gồm hai lệnh xuất đồng thời).

## 5. Phân quyền

Catalog `src/domains/identity/permissions.ts`, tất cả kiểm tra ở server (`requireMaterialsAccess`), UI chỉ ẩn nút:

| Quyền                     | Cho phép                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `materials.read`          | xem 4 tab, chi tiết vật tư, lịch sử                                                     |
| `materials.manageCatalog` | thêm/sửa danh mục vật tư và cơ sở (mã khóa khi đã có giao dịch; ngừng dùng thay vì xóa) |
| `materials.receive`       | tạo/sửa dòng nhập                                                                       |
| `materials.issue`         | tạo/sửa dòng xuất                                                                       |
| `materials.cancel`        | hủy giao dịch                                                                           |
| `materials.export`        | xuất Excel                                                                              |
| `materials.import`        | nhập Excel                                                                              |

`WAREHOUSE_MANAGER` (Thủ kho) giữ cả 7 ở scope `all`; `DIRECTOR` có toàn bộ catalog. Các vai trò khác không thấy
menu, URL trả 404, API trả 401/403. Guard không dùng `DEV_OPEN_ACCESS`.

## 6. Audit và lịch sử

Mỗi ghi thêm một `AuditEvent` trong cùng session (`resourceType: "materials"`, `resourceId`, `before/after`):
`materials.transaction.create|update|cancel`, `materials.material.create|update`,
`materials.facility.create|update`, `materials.import`. Drawer chi tiết vật tư hiển thị timeline giao dịch (tồn
sau từng dòng) và 50 sự kiện audit gần nhất với tên người thực hiện.

## 7. Giao diện

Cùng ngôn ngữ thiết kế với "Theo dõi tiến độ mẫu" (dùng chung `sample-progress-shared.ts`): eyebrow
"Kho / Quản lý kho", tiêu đề serif, dòng trạng thái (số vật tư · số giao dịch · cập nhật gần nhất bởi ai), thẻ
trắng bo góc, nút viên (đỏ sơn = hành động chính, viền = phụ), bảng sạch với badge, cột "Thao tác" dính bên phải,
khung xác nhận/thông báo ngay trong trang (không dùng hộp thoại trình duyệt), bản in A4 ngang.

- **Thanh công cụ**: 4 nút tab (Tổng kho · Nhập kho · Xuất kho · Danh mục NVL, đồng bộ `?tab=`), bên phải
  Nhập Excel · Dán từ Excel · Xuất Excel · In báo cáo theo quyền.
- **Tổng kho**: vòng doughnut + 4 ô (Còn hàng / Sắp hết / Hết hàng / Ngừng dùng), bộ lọc có nhãn, "Hiển thị
  x/y", bảng STT · Mã · Vật tư · ĐVT · Tồn đầu · Nhập · Xuất · Tồn cuối · Trạng thái · Ghi chú. Bấm số Nhập/Xuất
  mở sổ tương ứng lọc theo vật tư; bấm mã/tên mở **thẻ chi tiết vật tư** ngay phía trên bảng (tồn, Σ nhập/xuất,
  nút Nhập kho / Xuất kho mở form đã điền sẵn, timeline có "Tồn sau", lịch sử thay đổi).
- **Nhập kho / Xuất kho**: bộ lọc (Từ ngày · Đến ngày · Tìm · Hiện dòng đã hủy · chip vật tư) + nút **Thêm phiếu
  nhập / Thêm phiếu xuất**; form thẻ "Thêm/Cập nhật phiếu" (mã hoặc tên vật tư, cơ sở, tên/ĐVT tự điền, `Tồn
  hiện tại`, báo vượt tồn ngay và khóa nút Áp dụng) → **Áp dụng** ghi ngay vào kho; bảng có **Sửa** và **Hủy
  dòng** (khung xác nhận có ô lý do); dòng đã hủy gạch ngang; phân trang 200 dòng với "Tải thêm".
- **Danh mục NVL**: hai thẻ (vật tư, cơ sở/người nhận) với tìm kiếm, **Thêm**, bảng, form Sửa; mã khóa khi đã
  có giao dịch; **Ngừng dùng / Dùng lại** thay cho xóa. Hạ `Tồn đầu kỳ` đi qua quy tắc không âm kho.
- **Dán từ Excel**: ô dán nhiều dòng (Ngày ⇥ Mã ⇥ Số lượng ⇥ Ghi chú; xuất thêm Mã cơ sở) → bảng xem trước có
  trạng thái từng dòng, kiểm tra tồn lũy kế cả lô → ghi một lần (tối đa 500 dòng).
- **Nhập Excel**: khung vàng xem trước (hợp lệ / lỗi / trùng / đã nhập / vật tư lạ / cơ sở lạ) + "Nhập cả các dòng
  trùng" + **Hủy nhập file**.
- **Cuối trang**: Xuất Excel · In báo cáo · **Lịch sử chỉnh sửa** (bảng audit toàn kho: thời gian, người, thao
  tác, chi tiết; `GET /api/materials/history`).

## 8. Nhập / xuất Excel

- **Xuất** (`GET /api/materials/export?scope=all|summary|inbound|outbound&from&to&q&materialId`): dựng từ
  `assets/materials-template.xlsx` bằng OOXML viết tay (như `sample-progress`), giữ merge tiêu đề, font, độ rộng,
  chiều cao, viền, freeze, print titles; ngày là ô ngày thật, số là ô số thật, chuỗi là `inlineStr` (không bao giờ
  thành công thức); thêm autofilter. `scope` khác `all` bỏ các sheet còn lại khỏi gói.
- **Nhập** (`POST /api/materials/import`, multipart): Upload → Parse (layout sheet nguồn `ChiTietNhapNVL` /
  `ChiTietxuatNVL`) → Preview (hợp lệ / lỗi / trùng theo fingerprint / đã nhập theo importKey / vật tư lạ / cơ sở
  lạ) → Xác nhận → Import trong một transaction, audit `materials.import`. Không tự thêm danh mục.

## 9. Migration

`scripts/import-materials.ts`: dry-run mặc định, `--apply` ghi; idempotent nhờ `normalizedCode` (danh mục,
`$setOnInsert`) và `importKey` (giao dịch); sau khi ghi, đối soát tồn tính từ DB với `Tong kho NVL` và ghi
`backups/materials-migration-report.json`. Chi tiết và kết quả: `docs/material-inventory-migration.md`.

## 10. Kiểm thử

- `tests/unit/materials-contracts.test.ts` — công thức tồn, `decideStock`, `applyTransactionPatch`, parse/format.
- `tests/unit/materials-routes.test.ts` — guard trước dữ liệu, same-origin, quyền theo loại giao dịch.
- `tests/unit/materials-permissions.test.ts` — vai trò nào giữ `materials.*`.
- `tests/unit/materials-export.test.ts`, `materials-import.test.ts` — workbook mở được, ngày/số đúng, parser
  đúng layout nguồn.
- `tests/unit/materials-ui.test.tsx` — tab, ẩn nút theo quyền, form phiếu chỉ ghi khi hợp lệ, lỗi vượt tồn, hủy dòng cần lý do.
- `tests/integration/materials-stock-check.ts` — chạy với MongoDB thật (quy tắc âm kho, đồng thời, hủy).
- E2E: `tests/e2e-admin/materials.spec.ts` (đăng nhập thủ kho, 4 tab, thêm nhập/xuất, chặn vai trò khác).
