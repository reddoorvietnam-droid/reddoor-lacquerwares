# Nguyên vật liệu — báo cáo phân tích và migration từ `RedDoor - NVL - 2026.xlsx`

Cập nhật: 2026-09-09. Nguồn: `assets/RedDoor - NVL - 2026.xlsx` (SHA-256 ghi trong
`docs/materials-workbook-analysis.json`, sinh bởi `scripts/analyze-materials-workbook.py`).
Kết quả chạy migration thật nằm ở mục 8; file máy `backups/materials-migration-report.json` là bản đầy đủ.

## 1. Các sheet đã đọc (82 sheet)

Toàn bộ workbook được đọc bằng openpyxl ở hai chế độ (công thức và giá trị đã tính). Phân loại:

| Nhóm                       | Sheet                                                                                                 | Vai trò                                                                   | Dùng cho migration                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Nghiệp vụ chính            | `Tong kho NVL`                                                                                        | Bảng tổng tồn 2026: tồn đầu (nhập tay) + SUMIF nhập/xuất + tồn cuối       | **Tồn đầu kỳ, ghi chú, thứ tự hiển thị, số đối soát**        |
| Nghiệp vụ chính            | `ChiTietNhapNVL`                                                                                      | Sổ chi tiết nhập NVL năm 2026                                             | **Giao dịch INBOUND**                                        |
| Nghiệp vụ chính            | `ChiTietxuatNVL`                                                                                      | Sổ chi tiết xuất NVL năm 2026                                             | **Giao dịch OUTBOUND**                                       |
| Danh mục                   | `KhoNVL`                                                                                              | Danh mục vật tư (mã, tên, ĐVT) — nguồn của mọi VLOOKUP `khoson`/`dmvattu` | **Material master**                                          |
| Danh mục                   | `Cososx`                                                                                              | Danh mục cơ sở / người nhận — nguồn VLOOKUP `MaNhaCungCap`                | **Facility master**                                          |
| Trích theo vật tư          | `CNdenbong`, `Decal PP`, `CN trang`                                                                   | Bản trích các dòng xuất của một vật tư (giá trị, không công thức)         | Không — trùng với `ChiTietxuatNVL` (xem mục 4)               |
| Lịch sử cũ theo vật tư     | `Vang la`, `Vang la1`, `Phichtron`, `Phichdet`, `Decal trong`, `HXP`                                  | Sổ 2016–2025 của một vật tư                                               | Không — trước kỳ 2026, tồn đầu 2026 đã gói các phát sinh này |
| Sổ bán sơn 2016            | 58 sheet ẩn tên người (`Van`, `Ha 0209`, `Quang 1908`, `xuyen 1410`, …)                               | "SỔ CHI TIẾT BÁN HÀNG NĂM 2016" — sơn/PU, không phải NVL                  | Không — nghiệp vụ khác, năm khác                             |
| Biểu mẫu / không liên quan | `Soxuatvattu`, `SXVT`, `Sheet1`, `Sheet9`, `Sheet8` (thông báo tuyển dụng), `Sheet2` (bảng chấm công) | Mẫu in, không có dữ liệu giao dịch                                        | Không                                                        |
| Trống                      | `Sheet4`, `Sheet6`, `Sheet10`                                                                         | —                                                                         | Không                                                        |

Bảng đầy đủ 77 sheet phụ (trạng thái ẩn/hiện, tiêu đề, năm, số dòng có ngày) nằm trong
`docs/materials-workbook-analysis.json` → `otherSheets`.

### Named ranges và phụ thuộc công thức

| Tên                                                                                        | Vùng                                              | Dùng ở                                                  |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------- |
| `MV_MVT` / `MV_SL`                                                                         | `ChiTietNhapNVL!$B$4:$B$8149` / `$F$4:$F$1048576` | `Tong kho NVL!H = SUMIF(MV_MVT, D, MV_SL)`              |
| `BR_MVT` / `BR_SL`                                                                         | `ChiTietxuatNVL!$D$4:$D$2612` / `$H$4:$H$1048576` | `Tong kho NVL!I = SUMIF(BR_MVT, D, BR_SL)`              |
| `dmvattu`                                                                                  | `KhoNVL!$B$3:$E$1048576`                          | `Tong kho NVL!E = VLOOKUP(D, dmvattu, 2, 0)`            |
| `khoson`                                                                                   | `KhoNVL!$B$2:$E$139`                              | `ChiTietNhapNVL!C,E` và `ChiTietxuatNVL!E,G` (tên, ĐVT) |
| `MaNhaCungCap`                                                                             | `Cososx!$C$5:$E$103`                              | `ChiTietxuatNVL!C = VLOOKUP(B, MaNhaCungCap, 2, 0)`     |
| `makhachthanhtoan`, `sotienthanhtoan`, `thanhtien`, `kho`, `chitietbanhang`, `makhachhang` | `#REF!` hoặc không được tham chiếu                | Tàn dư từ workbook bán sơn                              |

`Tong kho NVL!J = G + H − I`. Đây là toàn bộ "công thức tồn kho" của Excel; hệ thống mới tính cùng công thức
từ dữ liệu giao dịch (xem `docs/material-inventory.md`).

## 2. Cấu trúc từng sheet chính

### `Tong kho NVL` (A1:N89)

- Tiêu đề `C1` (merge C1:K1): `KHO NGUYÊN VẬT LIỆU 2026`; `C2`: `Ngày lập bảng : 02/01/2025`.
- Header dòng 3: A `Ngày tháng`, B `Số chứng từ` (cột A ẩn, cả hai cột trống ở mọi dòng → **không đưa lên web**),
  C `STT`, D `Mã vật tư`, E `Vật tư` (VLOOKUP), F `ĐVT` (nhập tay), G `Tồn đầu` (nhập tay), H `Nhập` (SUMIF),
  I `xuất` (SUMIF), J `Tồn cuối` (G+H−I), K `Ghi chú`.
- Dữ liệu: dòng 4–84 = **81 dòng vật tư**; dòng 85 `Tổng` (chỉ nhãn, không công thức); dòng 87 `Người lập`,
  dòng 88 tên người lập. `M28 = 20-9` là ô nháp rời, bỏ qua.
- Freeze ở `A21` và autofilter `D1:D89` là trạng thái cuộn/lọc lúc lưu, không phải thiết kế → template dùng
  freeze `A4`.

### `ChiTietNhapNVL` (A1:I8412)

- Tiêu đề `A1` (merge A1:I1): `SỔ CHI TIẾT NHẬP NVL / NĂM 2026`; header dòng 3: A Ngày tháng, B Mã vật tư,
  C Vật tư (VLOOKUP), D Diễn giải, E Đơn vị tính (VLOOKUP), F Số lượng, G Đơn giá, H Thành tiền, I Ghi chú.
- Phân loại 8 409 dòng từ dòng 4: **27 giao dịch**, 5 934 dòng chỉ có công thức VLOOKUP kéo sẵn, 2 446 dòng trống,
  2 dòng chỉ chứa khoảng trắng (B8149, B8412). Cột G/H **trống ở cả 27 dòng** → `unitPrice`/`amount` null.
- Bất thường: dòng 4 ngày `2025-01-05` (các dòng còn lại 2026-01-17 → 2026-09-05); dòng 22 số lượng là công thức
  `=36*4` (dùng giá trị đã tính 144).

### `ChiTietxuatNVL` (A1:L2900)

- Tiêu đề `A1` (merge A1:I1): `SỔ CHI TIẾT NVL / NĂM 2026`; header dòng 3: A Ngày tháng, B Mã cơ sở SX,
  C Tên cơ sở SX (VLOOKUP), D Mã vật tư, E Vật tư (VLOOKUP), F Diễn giải, G Đơn vị tính (VLOOKUP), H Số lượng,
  I Ghi chú.
- Phân loại 2 897 dòng: **385 giao dịch** (dòng 4–389, trừ dòng 383 chỉ có công thức), 382 dòng chỉ công thức,
  2 123 dòng trống, 2 dòng khoảng trắng (D2612, D2875), 5 dòng "partial" là các ô nháp ở J:L.
- `J:L` không thuộc bảng: `L2881=2200`, `K2882=3100`, `L2882==K2882*4`, `K2883=350`, `L2883==K2883*4`,
  `J2884==594/2`, `K2898==180+31+100`, `K2899=444`, `K2900=50` → phép tính tay, **bỏ qua**.
- Bất thường: dòng 10–11 ngày `2025-01-06`; số lượng công thức ở dòng 154 (`=755*4`), 193 (`=360*4`),
  311 (`=120*6`) → dùng giá trị đã tính. Freeze `A384` là vị trí cuộn.
- Diễn giải: 385/385 dòng là `xuất kho`; nhập: 27/27 là `nhập kho`.

### `KhoNVL` (A2:F139)

- Header dòng 2: A STT, B Mã vật tư, C Tên vật tư, D DonViTinh, E Tồn đầu kỳ, F **không có header**.
- **134 mã** ở dòng 3–137 (dòng 70 trống; dòng 138–139 chỉ có STT 68, 69 không có mã).
- Cột E chỉ có một giá trị: `Bangthit1000 = 250000`. `Tong kho NVL` ghi tồn đầu của mã này là 0 ở cả hai dòng
  (61 và 84) → giá trị này **không được dùng làm tồn đầu**; ghi nhận để hỏi lại.
- Cột F có 3 giá trị không header: `CNdenmo 160800`, `CNdenbong 96123`, `CNtrongbong 96375`. Không có công thức
  nào tham chiếu cột F; không xác định được là đơn giá, tồn năm trước hay số đặt hàng → **không migrate**
  (mục 7).
- Mã có khoảng trắng thừa: `HopXaPhong ` (dòng 108) → trim.
- Không có mã trùng theo chữ hoa/thường trong KhoNVL. Ba cặp tên trùng với mã khác nhau (giữ nguyên, vì
  Excel coi là hai mã): `Vít bản lề vàng` (`vitbanleV`, `Vitblvang`), `Đinh 1,2F gắn khay`
  (`Đinh1,2F(gankhay)`, `Dinh1,2F`), `Đinh 1F gắn khay` (`Đinh1F(gankhay)`, `Dinh1F`).

### `Cososx` (A1:F106)

- Header dòng 4: STT, Loại, Mã cơ sở SX, Tên cơ sở SX, Số điện thoại, Ghi chú. **99 mã** ở dòng 5–103.
- `Loại`: `Loại 1` ×22, `Loại 2`/`Loai 2` ×14, `Loai 3` ×6, trống ×57 (giữ nguyên chuỗi). Nhiều SĐT là `0`
  → lưu rỗng. Không có mã trùng.

## 3. Đối soát (SUMIF tái lập)

Tính lại `Nhập`/`Xuất` từ 27 + 385 dòng giao dịch với so khớp mã không phân biệt hoa/thường (đúng ngữ nghĩa
SUMIF) và so với giá trị Excel đã tính ở H/I/J của 81 dòng `Tong kho NVL`:

- **81/81 khớp, 0 lệch** (sai số < 1e-6). Excel giữ đuôi nhị phân ở `ChongAm` (`37.79999999999999`,
  `29.499999999999996`, `98.29999999999998`); database lưu decimal chuẩn `37.8`, `29.5`, `98.3`.
- 0 mã vật tư và 0 mã cơ sở trong hai sổ chi tiết không có trong danh mục.
- **8 mã có phát sinh nhưng không có dòng trong `Tong kho NVL`** (tồn đầu = 0, vì Tong kho không khai):

| Mã (KhoNVL)      | Nhập | Xuất | Tồn tính được |
| ---------------- | ---- | ---- | ------------- |
| `Bdgiay1F`       | 144  | 76   | 68            |
| `Bdgiay2F`       | 60   | 33   | 27            |
| `Bdgiay5F`       | 0    | 9    | **−9**        |
| `Bknho`          | 0    | 9    | **−9**        |
| `Blvuongtrangto` | 0    | 120  | **−120**      |
| `Dinh1,2F`       | 0    | 10   | **−10**       |
| `Dinh1F`         | 0    | 13   | **−13**       |
| `HXPden`         | 5000 | 246  | 4754          |

Năm mã âm là lịch sử Excel không theo dõi tồn đầu; hệ thống giữ nguyên số liệu (không bịa tồn đầu), hiển thị
`Hết hàng`, và **chặn xuất thêm** cho đến khi thủ kho nhập tồn đầu đúng trong tab Danh mục NVL.

## 4. Sheet theo vật tư có trùng với sổ xuất không?

So khớp từng dòng (ngày, mã cơ sở, mã vật tư, số lượng) với `ChiTietxuatNVL`:

| Sheet                                                                | Dòng                     | Khớp chính xác | Khớp nếu bỏ năm                                 | Không khớp | Kết luận                                                                                 |
| -------------------------------------------------------------------- | ------------------------ | -------------- | ----------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| `CNdenbong`                                                          | 108                      | 104            | 1 (dòng 3, `2025-01-08` ↔ sổ xuất `2026-01-08`) | 3          | Bản trích theo vật tư của sổ xuất → **không import** (nếu import sẽ đếm đôi 145 624 cái) |
| `Decal PP`                                                           | 3                        | 3              | 0                                               | 0          | Bản trích → không import                                                                 |
| `CN trang`                                                           | 1 (2025)                 | 0              | 0                                               | 1          | Lịch sử 2025 → không import                                                              |
| `Vang la`, `Vang la1`, `Phichtron`, `Phichdet`, `Decal trong`, `HXP` | 143 / 44 / 5 / 6 / 4 / 9 | 0              | 0                                               | tất cả     | Sổ 2016–2025, trước kỳ → không import                                                    |

Ba dòng `CNdenbong` không khớp (giá trị khác sổ xuất) được liệt kê trong `legacyOverlap` của file JSON để thủ
kho xem lại; hệ thống không tự thêm/sửa.

## 5. Ánh xạ Excel → database

### Material (`materialitems`)

| Nguồn                                | Trường                                   | Ghi chú                                                                                                                                                                                                                                                    |
| ------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KhoNVL!B` (trim)                    | `code`, `normalizedCode = codeKey(code)` | mã canonical lấy theo KhoNVL; `Tong kho` viết khác hoa/thường ở 7 mã (`Cndenmo`/`CNdenmo`, `Vitbanle`/`vitbanle`, `Gatden`/`gatden`, `Hopxaphong(moi)`/`HopXaPhong(moi)`, `VangLa`/`Vangla`, `duidenbl`/`DuidenBl`, `duidend`/`DuidenD`) → cùng một vật tư |
| `KhoNVL!C`                           | `name`                                   |                                                                                                                                                                                                                                                            |
| `KhoNVL!D`                           | `unit`                                   | ĐVT in trên sổ nhập/xuất (VLOOKUP cột 3)                                                                                                                                                                                                                   |
| `Tong kho NVL!G` (theo mã)           | `openingQuantity`                        | không có dòng → `0`                                                                                                                                                                                                                                        |
| `Tong kho NVL!K`                     | `note`                                   |                                                                                                                                                                                                                                                            |
| thứ tự `Tong kho NVL` rồi `KhoNVL`   | `sortOrder`                              | giữ thứ tự thủ kho quen nhìn                                                                                                                                                                                                                               |
| `Tong kho NVL` không có trong KhoNVL | tạo vật tư từ Tong kho                   | chỉ `Blhoakhe` (`Bản lề hoa khế`, Cái, tồn đầu 1 492)                                                                                                                                                                                                      |
| —                                    | `minimumStock`                           | null (Excel không có ngưỡng)                                                                                                                                                                                                                               |
| `KhoNVL!E`, `KhoNVL!F`               | **không migrate**                        | mục 7                                                                                                                                                                                                                                                      |

### Facility (`materialfacilities`)

`Cososx!B` → `type`, `C` → `code`/`normalizedCode`, `D` → `name`, `E` → `phone` (`0`/trống → rỗng), `F` → `note`,
thứ tự dòng → `sortOrder`.

### MaterialTransaction (`materialtransactions`)

| `ChiTietNhapNVL`                               | `ChiTietxuatNVL` | Trường                                                                    |
| ---------------------------------------------- | ---------------- | ------------------------------------------------------------------------- |
| A (ngày Excel → ngày lịch, không lệch múi giờ) | A                | `transactionDate` (UTC 00:00 của ngày)                                    |
| —                                              | B / C            | `facilityId` + `facilityCode`/`facilityName` snapshot (từ master)         |
| B / C                                          | D / E            | `materialId` + `materialCode`/`materialName`/`unit` snapshot              |
| D (`nhập kho`)                                 | F (`xuất kho`)   | `description`                                                             |
| E                                              | G                | `unit` (từ master, giống VLOOKUP)                                         |
| F (giá trị đã tính nếu là công thức)           | H                | `quantity` (Decimal128)                                                   |
| G / H                                          | —                | `unitPrice` / `amount` (null — sổ 2026 chưa có giá)                       |
| I                                              | I                | `note` (giữ nguyên: Caspari, SiSecam, Aslotel, Togas, Hunt, Kim, Mẫu, …)  |
| —                                              | —                | `type` = `INBOUND` / `OUTBOUND`, `status = POSTED`                        |
| `${sha256(file)}:${sheet}:${row}`              |                  | `importKey` (unique) — chạy lại không nhân đôi                            |
| tên file, số dòng                              |                  | `migrationSource`, `sourceRow` (chỉ là metadata, không phải ID nghiệp vụ) |

## 6. Chuẩn hóa

- `codeKey = trim + lowercase` cho mọi so khớp mã; unique index trên `normalizedCode`.
- Số: chuỗi decimal chuẩn (`212898.6`, không `212898.600000000006`), tối đa 8 chữ số thập phân.
- Ngày: `YYYY-MM-DD` trong DTO, `Date` UTC-midnight trong DB, `dd/MM/yyyy` trên UI và Excel.
- Ba dòng ngày 2025 (`Nhập` dòng 4; `Xuất` dòng 10, 11) được **import nguyên trạng** kèm cảnh báo — Excel vẫn
  cộng chúng vào SUMIF nên bỏ đi sẽ làm lệch tồn; thủ kho sửa ngày ngay trên bảng nếu là gõ nhầm.

## 7. Điểm chưa xác định — cần thủ kho/kế toán xác nhận

| #   | Vấn đề                                                                                                                                                                                                               | Cách hệ thống xử lý tạm thời                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | `KhoNVL!F`: 160 800 / 96 123 / 96 375 cho ba mã chân nhựa, không header, không công thức nào dùng                                                                                                                    | Không migrate; ghi trong report                                      |
| 2   | `KhoNVL!E` `Bangthit1000 = 250000` ("Tồn đầu kỳ") trong khi `Tong kho` ghi 0 ở cả hai dòng                                                                                                                           | Tồn đầu = 0 (theo Tong kho); ghi trong report                        |
| 3   | `Bangthit1000` xuất hiện hai lần trong `Tong kho` (dòng 61 `Cuộn`, dòng 84 `Cái`, đều 0)                                                                                                                             | Một vật tư, ĐVT `Cuộn` theo KhoNVL                                   |
| 4   | 7 mã lệch ĐVT giữa `Tong kho!F` và `KhoNVL!D`: `Nhanhkho` Hộp/Chai, `Mutx` Cái/Cuộn, `Mutbot` Cái/Cuộn, `Đinh1F(gankhay)` Cái/Hộp, `Đinh1,5F(gankhay)` Cái/Hộp, `Đinh1,8F(gankhay)` Cái/Hộp, `Bangthit1000` Cái/Cuộn | Dùng KhoNVL (ĐVT mà sổ nhập/xuất in ra); sửa được trong Danh mục NVL |
| 5   | 5 mã tồn âm (mục 3)                                                                                                                                                                                                  | Giữ số liệu, chặn xuất thêm                                          |
| 6   | 3 dòng ngày 2025 trong sổ 2026                                                                                                                                                                                       | Import nguyên trạng, cảnh báo                                        |
| 7   | 3 dòng `CNdenbong` không khớp sổ xuất                                                                                                                                                                                | Không import; liệt kê                                                |
| 8   | Đơn giá nhập: sổ 2026 trống hoàn toàn                                                                                                                                                                                | `unitPrice` nullable, tồn kho không phụ thuộc giá                    |
| 9   | Tổng kho không có tồn tối thiểu                                                                                                                                                                                      | `minimumStock` để trống, cấu hình sau trong Danh mục                 |
| 10  | Số chứng từ (`Tong kho!B`) trống toàn bộ                                                                                                                                                                             | Không tạo số phiếu lịch sử; giao dịch mới có `batchId` nội bộ        |
| 11  | `Cososx!B` viết `Loại 2` lẫn `Loai 2`                                                                                                                                                                                | Giữ nguyên chuỗi, có thể chuẩn hóa bằng tay                          |

## 8. Kết quả chạy migration (2026-09-09, `--apply` trên MongoDB Atlas)

```
npm run import:materials -- "assets/RedDoor - NVL - 2026.xlsx"          # dry-run: không kết nối DB
npm run import:materials -- "assets/RedDoor - NVL - 2026.xlsx" --apply  # ghi trong một transaction
```

### MATERIALS

|                                                            |         |
| ---------------------------------------------------------- | ------- |
| Source rows (KhoNVL)                                       | 134     |
| Valid (KhoNVL + 1 mã chỉ có ở Tong kho: `Blhoakhe`)        | 135     |
| Duplicates (không phân biệt hoa/thường)                    | 0       |
| Conflicting codes (lệch ĐVT Tong kho ↔ KhoNVL, giữ KhoNVL) | 7       |
| Imported                                                   | **135** |

### FACILITIES

Source rows 99 · Valid 99 · Duplicates 0 · Imported **99**.

### INBOUND (`ChiTietNhapNVL`)

Candidate rows 27 · Valid transactions 27 · Imported **27** · Invalid 0 · Duplicate 0 (lần chạy 2: imported 0, duplicate 27).
Bỏ qua: 5 934 dòng chỉ công thức, 2 446 dòng trống, 2 dòng khoảng trắng.

### OUTBOUND (`ChiTietxuatNVL`)

Candidate rows 385 · Valid transactions 385 · Imported **385** · Invalid 0 · Duplicate 0 (lần chạy 2: imported 0, duplicate 385).
Bỏ qua: 380 dòng chỉ công thức, 2 123 dòng trống, 2 dòng khoảng trắng, 7 dòng chỉ có ô nháp J:L (9 ô).

### STOCK RECONCILIATION (tính từ database sau khi ghi)

|                                    |        |
| ---------------------------------- | ------ |
| Material count (dòng Tong kho NVL) | 81     |
| Matched Excel closing stock        | **81** |
| Mismatch                           | **0**  |

Không có dòng lệch → không có bảng `Material Code / Excel Opening / Imported In / Imported Out / Calculated Closing /
Excel Closing / Difference` nào phải liệt kê. 8 mã có phát sinh nhưng không có dòng Tong kho (mục 3) được ghi trong
`movementWithoutSummaryRow`; 5 mã âm được trả về trong `negativeBalances`.

### Idempotency

Chạy `--apply` lần thứ hai ngay sau đó: materials imported 0, facilities imported 0, inbound 0 / duplicate 27,
outbound 0 / duplicate 385, reconciliation 81/81 — không có bản ghi nào bị nhân đôi.

### Cảnh báo ghi trong report (11)

`date-outside-year` ×3 (dòng 4 sổ nhập; dòng 10, 11 sổ xuất), `cell-outside-table` (J:L), `duplicate-code`
(Tong kho `Bangthit1000` dòng 84). Không có `issues`.

Sự kiện audit: một bản ghi `materials.import` (actor hệ thống `materials-workbook-migration`) với `batchId` của
lần chạy; mọi dòng nhập từ Excel giữ `migrationSource = "RedDoor - NVL - 2026.xlsx"` và `sourceRow`.
