# Hóa đơn bán hàng — báo cáo phân tích và migration từ `08092026.xlsx`

Cập nhật: 2026-09-09. Nguồn: `assets/08092026.xlsx` (SHA-256 trong `docs/sales-workbook-analysis.json`, sinh bởi
`scripts/analyze-sales-workbook.py`). Kết quả chạy thật ở mục 6; bản đầy đủ tại `backups/sales-slip-import-report.json`.

## 1. Phân loại 21 sheet

Phân loại theo **cấu trúc** (A4 = `PHIẾU BÁN HÀNG` và dòng 10 = `Stt|Mã VT|Vật tư|ĐVT|Số lượng|Giá|Thành tiền`),
không theo tên sheet; sheet ẩn vẫn được đọc và báo cáo.

| Nhóm          | Sheet                                                                                                             | Xử lý                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Template      | `HOADONMAU` (hiện)                                                                                                | Nguồn của `layout.json` và `assets/sales-slip-template.xlsx`; dữ liệu mẫu (831a3/800d/XANG2, ngày 14/04/2026) **không nhập** |
| Phiếu thực tế | `C.Thanh (2)`, `C.Quag`, `C.Quag (2)`, `A.Tuấn1`, `A.Tuấn1 (2)`, `A.Mạnh` (hiện); `C.vank3`, `HOADONMAU (2)` (ẩn) | Mỗi sheet → 1 `SalesSlip` + N dòng                                                                                           |
| Master        | `KhoSon` (named range `khoson` = `KhoSon!$B$2:$E$516`), `MaNhaCungCap` (`MaNhaCungCap!$C$5:$E$68`)                | Vật tư + giá bán → `PaintWarehouseMaster.salePrice`; người nhận → facility                                                   |
| Tem gửi hàng  | `Home`, `Sheet5 (8)`, `Sheet5 (7)` (hiện); `Sheet5`, `Sheet5 (2)` (ẩn)                                            | Người gửi/nhận/SĐT/địa chỉ — **không** phải phiếu, không nhập                                                                |
| Sổ cũ         | `Xuyen0303`, `Xuyen1905` (ẩn)                                                                                     | "SỔ CHI TIẾT BÁN HÀNG NĂM 2017" — nghiệp vụ khác, không nhập                                                                 |
| Phụ / trống   | `mm` (bảng đổi đơn vị), `Aerobic` (lời chúc), `Sheet1` (trống)                                                    | Không nhập                                                                                                                   |

Named range hỏng (`#REF!`): `chitietbanhang`, `makhachhang` (workbook và từng sheet), `makhachthanhtoan`,
`sotienthanhtoan`, `thanhtien` — tàn dư, không được tái tạo; template xuất đã xóa mọi named range trừ `Print_Area`.

## 2. Template `HOADONMAU`

- Used range A1:V36 nhưng Print_Area `A1:G19`; cột H..V chỉ có ô trống có style → bỏ.
- Page setup: A4 (paperSize 9), portrait, `fitToPage` + `fitToHeight=0` (vừa một trang ngang; số `scale=84` bị Excel
  bỏ qua), lề trái 0.4 / phải 0.23 / trên 0.31 / dưới 0.16 in.
- Merge: A3:B3, A4:G4, A5:G5, C6:E6, A7:C7, A14:F14, A15:F15, A18:B18, D18:E18, F18:G18, A19:B19, D19:E19, F19:G19.
- Font Times New Roman: 14 (nhãn, header, Stt/Mã/Vật tư/ĐVT), 12 (Số lượng, Giá, Thành tiền, A3), 18 đậm (tiêu đề).
  Header fill theme accent1 lighter 40 % = `#95B3D7`; ô nhập B và E fill accent5 lighter 80 % = `#DBEEF4`; viền thin.
- Công thức: C/D/F = `IFERROR(VLOOKUP(B,khoson,2/3/4,0),"")`, G = `F*E`, G14 = `SUM(G11:G13)`, G15 = `G14`,
  A3 = `NOW()`. "Bằng chữ :" không có công thức.

## 3. Cấu trúc phiếu thực tế

Cùng bố cục template; số dòng hàng thay đổi (1–8), footer trượt theo. Điểm khác nhau đáng chú ý:

- Sáu phiếu tháng 9/2026 nhập **giá bằng số** ở cột F (không VLOOKUP) → `priceManual: true`; `C.vank3` và
  `HOADONMAU (2)` dùng VLOOKUP.
- Người nhận ghi tay ở C6 (chữ hoa, tên đầy đủ) — không trùng tên trong `MaNhaCungCap` (danh mục ghi "Chị Thanh",
  "Anh Quảng"…). Chỉ `ĐỖ MẠNH TUẤN` khớp `Tuan` = "Đỗ Mạnh Tuấn"; các phiếu khác giữ tên snapshot, `recipientId = null`.
- `HOADONMAU (2)` (08/11/2025): 5/8 mã (`FYL32A-20`, `FYL32A5-20`, `FYG32A5-20`, `952a1`, `952B1`) không có trong
  `KhoSon` (danh mục sau này đổi mã, ví dụ `FYL32A-20-01`) → C/D/F rỗng, G và tổng `#VALUE!`. Khi đối chiếu với danh
  mục trong DB (kho sơn có 899 mã) còn 1 mã lạ.
- Đơn vị (dòng 7) và Nội dung (dòng 8) trống ở mọi phiếu.

## 4. Đối soát từng phiếu

| Sheet              | Ngày       | Người nhận      | Dòng | Tổng Excel | Tính lại  | Lệch | Kết quả                                |
| ------------------ | ---------- | --------------- | ---- | ---------- | --------- | ---- | -------------------------------------- |
| C.Thanh (2)        | 08/09/2026 | ĐỖ THỊ THANH    | 2    | 865,000    | 865,000   | 0    | CONFIRMED                              |
| C.Quag             | 07/09/2026 | ĐỖ VĂN QUẢNG    | 1    | 40,000     | 40,000    | 0    | CONFIRMED (0.05 × 800,000)             |
| C.Quag (2)         | 08/09/2026 | ĐỖ VĂN QUẢNG    | 1    | 425,000    | 425,000   | 0    | CONFIRMED (2.5 × 170,000)              |
| A.Tuấn1            | 08/09/2026 | ĐỖ MẠNH TUẤN    | 1    | 85,000     | 85,000    | 0    | CONFIRMED, liên kết `Tuan`             |
| A.Tuấn1 (2)        | 08/09/2026 | NGÔ HUY SÁNG    | 1    | 85,000     | 85,000    | 0    | CONFIRMED                              |
| A.Mạnh             | 08/09/2026 | NGUYỄN VĂN MẠNH | 1    | 800,000    | 800,000   | 0    | CONFIRMED (5 × 160,000)                |
| C.vank3 (ẩn)       | 21/07/2026 | NGUYỄN THỊ VÂN  | 5    | 3,560,000  | 3,560,000 | 0    | CONFIRMED                              |
| HOADONMAU (2) (ẩn) | 08/11/2025 | NGUYỄN THỊ VÂN  | 8    | `#VALUE!`  | 1,155,000 | —    | **DRAFT** + `migrationIssues` (12 lỗi) |

Tổng Excel (7 phiếu hợp lệ): **5,860,000**. Tổng tính lại 8 phiếu: 7,015,000 (chênh 1,155,000 là phần
`HOADONMAU (2)` không có tổng Excel). Không có dòng nào lệch `E×F` so với G.

## 5. Quy tắc migration (`scripts/import-sales-slips.ts`)

- Phiếu hợp lệ (mọi mã có trong danh mục, số lượng > 0, có giá, G = E×F, tổng = Σ) → `CONFIRMED`,
  `confirmedBy = "sales-workbook-migration"`; ngược lại → `DRAFT`, `migrationIssues` ghi từng lý do, người dùng sửa và
  xác nhận trên web. Không bịa `internalNumber` (để `null`, danh sách hiển thị `Excel · <tên sheet>`).
- Snapshot dòng: mã đúng như gõ trên sheet (khớp danh mục không phân biệt hoa/thường), tên/ĐVT lấy giá trị đã tính của
  Excel (fallback danh mục), giá lấy giá trị đã tính; `lineAmount`/`subtotal` do server tính lại.
- Idempotent: `importKey = sha256(workbook):tên sheet` (unique partial), `$setOnInsert`; `fingerprint`
  (ngày|người nhận|mã:sl:giá…) để báo trùng khi cùng phiếu xuất hiện trong workbook khác.
- Danh mục: `KhoSon` 502 dòng → 500 mã (trùng `NauSCA-003`, `Phi`: giữ lần đầu như VLOOKUP). Mã đã có trong
  `PaintWarehouseMaster` chỉ được **set `salePrice`** (tên/ĐVT/`unitPrice` giữ nguyên — 94 tên khác nhau về
  hoa/thường, 45 giá bán khác giá sổ xuất); mã chưa có được thêm với `unitPrice: null`. `MaNhaCungCap` 65 mã: chỉ thêm
  mã chưa có.
- Cả migration chạy trong một transaction, kiểm tra lại tổng từ DB trước khi commit, ghi một audit
  `salesSlips.import`; sau đó bổ sung quyền `salesSlips.*` cho `DIRECTOR` và `COMPANY_ACCOUNTANT` nếu thiếu.

## 6. Kết quả chạy thật (2026-09-09)

```
Workbook: 21 sheet — template 1, phiếu 8, master 2, tem gửi hàng 5, sổ cũ 2, phụ 2, trống 1
Phiếu: hợp lệ 7, cần kiểm tra 1, không hợp lệ 0, đã nhập 8, trùng 0
Dòng: 20 — mã lạ 1 (so với danh mục DB; 5 so với KhoSon), lệch thành tiền 0, lệch tổng 0
Tổng: Excel 5,860,000 — DB 7,015,000 (gồm 1,155,000 của phiếu cần kiểm tra) — verified: true
Danh mục: 414 mã gán giá bán, 86 mã mới, 7 người nhận mới
Chạy lần 2 (--apply): đã nhập 0, trùng 8 (idempotent)
```

Lần chạy đầu bị hủy transaction vì index unique **sparse** trên `internalNumber` vẫn đánh index giá trị `null`
(E11000); đã đổi sang partial index (`$type: "string"`) — không có dữ liệu nào bị ghi trước khi sửa.

## 7. Câu hỏi nghiệp vụ còn mở

Xem `docs/sales-invoices.md` mục 12: quyền của thủ kho, liên kết xuất kho (không trừ tồn cho tới khi xác minh),
tên/địa chỉ pháp lý trên bản in, vật tư chưa có giá bán, cách đọc số, và các mã cũ trong `HOADONMAU (2)` cần người dùng
chọn lại mã mới rồi xác nhận.
