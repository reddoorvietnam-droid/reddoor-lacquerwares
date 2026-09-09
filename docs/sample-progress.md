# Theo dõi tiến độ mẫu

Website thay thế hoàn toàn việc sửa và nộp file Excel hằng tuần. Chị Nương cập
nhật trực tiếp trên web, dữ liệu lưu vào MongoDB, anh Toản mở lên xem ngay.
Excel chỉ còn hai việc: nhập dữ liệu cũ lên web, và xuất báo cáo khi cần gửi ra
ngoài hoặc lưu trữ.

Mở `/vi/admin/sample-progress` từ mục **Theo dõi tiến độ mẫu** trong cổng quản trị.

## Phân quyền

| Vai trò | Quyền |
| --- | --- |
| `CONTENT_CREATOR` (biên tập nội dung) | Xem, tạo tuần mới, kế thừa tuần trước, nhập Excel, thêm/sửa/bỏ mẫu, lưu phiên bản, xóa cả báo cáo tuần, xem lịch sử, xuất Excel, in |
| `DIRECTOR` (giám đốc) | Xem mọi báo cáo đã lưu, chọn tuần và phiên bản, xem lịch sử, tìm kiếm và lọc, xuất Excel, in |
| Vai trò khác | Không thấy menu, vào thẳng URL nhận 404, mọi API trả 403 |

Giám đốc **chỉ đọc**: mọi thao tác ghi (`POST`) đều đi qua
`requireSampleProgressEditor()`, nên một phiên bản đã lưu luôn mang tên người
thực sự cập nhật báo cáo.

Vì `CONTENT_CREATOR` có tập quyền là tập con của `DIRECTOR`, không permission
nào phân biệt được hai vai trò này — việc phân tách dựa trên `roleKeys` của
`AccessContext`. Tài khoản giữ cả hai vai trò được coi là biên tập viên.

Kiểm tra quyền diễn ra ở menu, Server Component của trang, API route, và cả
endpoint nhập/xuất Excel. Module này tự dựng guard riêng **không truyền**
`openAccess`, nên `DEV_OPEN_ACCESS` không bỏ qua được kiểm tra: cơ chế bypass
gắn `roleKeys: ["DEV_OPEN_ACCESS"]`, không khớp danh sách cho phép.

## Sử dụng

1. **Lần đầu / chuyển dữ liệu cũ:** chọn **Nhập Excel**, chọn file `.xlsx` hoặc
   `.xlsm`. Hệ thống hiện bảng xem trước kèm số dòng, số lỗi và số cảnh báo.
   Dữ liệu trong file **thay cho toàn bộ bảng đang soạn** (không trộn vào bảng
   cũ), và không có gì được lưu cho tới khi bấm **Lưu báo cáo**. Chọn nhầm file
   thì bấm **Hủy nhập file** ở khung vàng: bảng quay lại đúng như trước khi
   nhập.
2. **Hằng tuần:** mở báo cáo tuần trước rồi bấm **Kế thừa sang tuần mới**. Hộp
   xác nhận nêu rõ tuần nguồn và tuần đích; sau khi xác nhận, toàn bộ mẫu được
   sao chép sang tuần kế tiếp ở phiên bản 1.
3. **Cập nhật:** bấm **Sửa** ở từng mẫu, đổi trạng thái, nơi làm, các cột ngày và
   ghi chú, rồi **Áp dụng vào bảng**. Dùng **Thêm mẫu** / **Bỏ mẫu** khi cần.
4. **Lưu:** bắt buộc ghi **Nội dung cập nhật lần này** (giải thích phiên bản này
   thay đổi gì — không thay cho cột ghi chú của từng mẫu), rồi **Lưu báo cáo**.
5. **Xem lại:** chọn tuần trong **Báo cáo đã lưu**, hoặc **Lịch sử chỉnh sửa** để
   mở một phiên bản cũ. Phiên bản cũ chỉ đọc; dùng **Mở phiên bản mới nhất** để
   quay lại bản đang dùng.
6. **Xóa cả báo cáo tuần:** khi đã lỡ lưu nhầm file, bấm **Xóa báo cáo tuần
   này**, ghi lý do (bắt buộc), rồi xác nhận. Toàn bộ tuần đó biến mất — mọi mẫu
   và mọi phiên bản — và tuần được giải phóng để nhập lại file khác. Không xóa
   được lẻ từng phiên bản: lịch sử của một tuần đang dùng không thể bị tỉa dần.
7. **Xuất và in:** **Xuất Excel** tải file `.xlsx` của đúng phiên bản đang xem.
   **In báo cáo** dùng hộp thoại in của trình duyệt (A4 ngang, ẩn menu và nút
   thao tác, lặp lại tiêu đề bảng); có thể chọn "Save as PDF" ở đó.

## File tải lên

File Excel chị chọn ở **Nhập Excel** không được lưu ở đâu cả: route đọc bytes vào
bộ nhớ, bóc ra dữ liệu, trả về bảng xem trước rồi bỏ. Không ghi đĩa, không đẩy
lên Cloudinary, không có collection đính kèm — file tiến độ mẫu mang tên khách
hàng nên không để lại trên máy chủ. Thứ duy nhất được lưu là dữ liệu 9 cột, và
chỉ khi người dùng bấm **Lưu báo cáo**.

## Xóa một tuần

`DELETE /api/sample-progress` (biên tập nội dung, cùng origin) xóa mọi phiên bản
của một tuần. Trước khi xóa, toàn bộ snapshot được chép sang collection
`sampleprogressreportarchives` kèm `deletedAt` / `deletedBy` / `deleteReason`;
nếu bản chép thất bại thì không xóa gì cả. Một sự kiện
`sampleProgress.report.deleted` cũng được ghi vào `auditevents`.

Bản lưu trữ — chứ không phải audit log — mới là thứ khôi phục được: giá trị
trong audit đi qua `redactAuditValue`, hàm này **cắt mảng còn 50 phần tử**, nên
một báo cáo trên 50 mẫu sẽ mất dòng nếu chỉ dựa vào đó.

Xóa hẳn khỏi collection chính (thay vì đánh dấu ẩn) là có chủ ý: khóa
`tuần:phiên-bản` được giải phóng, nên tuần đó nhập lại được từ phiên bản 1 mà
không đụng khóa cũ. Không giao diện nào đọc collection lưu trữ; khôi phục là
việc phải làm thủ công, có cân nhắc.

## Mô hình dữ liệu

Collection `sampleprogressreports`, mỗi lần lưu là một **snapshot bất biến**:

- `week` (thứ Hai) và `weekEnd` (Chủ nhật), múi giờ `Asia/Ho_Chi_Minh`
- `reportDate`, `revision`, `previousRevision`, `inheritedFrom`
- `rows[]`: 9 cột nghiệp vụ của Excel, cộng `id` (UUID ổn định — STT không dùng
  làm khoá vì thứ tự thay đổi được) và `updatedAt` / `updatedBy` /
  `updatedByName`
- `changeNote`, `createdAt` / `createdBy` / `createdByName`,
  `savedAt` / `savedBy` / `savedByName` — tất cả lấy từ máy chủ

`_id` có dạng `thứ-hai:phiên-bản`, nên hai người lưu cùng lúc thì chỉ một người
thắng; người còn lại nhận 409 kèm thông báo tiếng Việt và **không mất** nội dung
đang nhập trên màn hình. Không có API nào sửa hay xoá phiên bản cũ.

Dấu thời gian của từng dòng chỉ đổi khi nội dung dòng đó thật sự thay đổi, nên
cột "Cập nhật lúc" trả lời "mẫu này động đậy khi nào", không phải "báo cáo được
lưu khi nào".

### Ba cột ngày

Các cột `Thời điểm nhận mẫu`, `Ngày kiểm (QC)`, `Ngày gửi mẫu` lưu dạng có cấu
trúc `{ kind, value }` với ba trường hợp:

- `date` — ngày thật, hiển thị `dd/MM/yyyy`, xuất Excel thành ô ngày thật
- `text` — chữ giữ nguyên từ file gốc (`Chờ gửi`, `18/07/`,
  `( hàng chỉ chụp ảnh không gửi )`)
- `empty` — trống

Snapshot cũ lưu ngày dạng chuỗi vẫn đọc được: dữ liệu được chuyển tiếp sang dạng
mới lúc đọc, **không ghi đè** bản ghi đã lưu.

## Đối chiếu với file gốc

- Giữ đủ 9 cột, đúng 4 trạng thái, văn bản nhiều dòng, STT gốc và ghi chú.
- Tổng số mẫu đếm theo **số dòng**, không cộng số chiếc/bộ trong phần mô tả. File
  được cung cấp có 24 mẫu, phân bố `2 / 7 / 1 / 14`.
- Ô ngày kiểu số trong Excel được đọc theo **giá trị ngày Excel lưu** (giá trị
  này không mơ hồ), kèm cảnh báo khi cách hiển thị của ô khác cách đọc — đây
  đúng là các ô định dạng `m/d/yy` dễ bị đọc ngược ngày/tháng.
- Ngày viết tay mà cả ngày lẫn tháng đều ≤ 12 (ví dụ `06/05/2026`) được **giữ
  nguyên làm chữ** kèm cảnh báo, hệ thống không tự đoán.
- Trạng thái lạ hoặc thiếu tên mẫu là **lỗi ở mức dòng**: dòng vẫn được giữ để
  sửa, và nút Lưu bị khoá cho tới khi sửa xong. Không âm thầm bỏ dòng.
- Giới hạn: 500 mẫu/báo cáo, 500.000 ký tự dữ liệu mẫu, file nhập tối đa 2 MB.

## File Excel xuất ra

Tên file: `Bao-cao-tien-do-mau-Red-Door-2026-W35-v2.xlsx`.

Một sheet duy nhất, đặt tên theo năm (`Tien Do Mau 2026`), **không có sheet
metadata** — thông tin phiên bản và người lưu đã nằm trên website. File giữ bố
cục của báo cáo gốc: tiêu đề lớn, ngày báo cáo, bảng thống kê tổng hợp, bảng chi
tiết 9 cột, merged cells, font Times New Roman, màu trạng thái, border, wrap
text, độ rộng cột, chiều cao dòng theo nội dung, autofilter, freeze pane ở dòng
tiêu đề, định dạng ngày `dd/mm/yyyy`, định dạng phần trăm, biểu đồ doughnut, và
thiết lập in A4 ngang.

File được sinh trực tiếp dưới dạng OOXML rồi đóng gói ZIP bằng `node:zlib`, vì
SheetJS bản cộng đồng không ghi được style lẫn biểu đồ (xem
`src/domains/sample-progress/export-workbook.ts` và `zip.ts`). Không thêm thư
viện mới.

Ba lỗi của file gốc được sửa có chủ ý:

- `COUNTIF` chạy theo đúng số dòng thực tế, thay vì khoá cứng `E15:E99`.
- Data validation trạng thái chỉ áp cho cột trạng thái, không lan sang cột
  *Nơi làm* và *Thời điểm nhận mẫu*.
- Ngày báo cáo là ngày đã lưu của phiên bản, không phải `TODAY()`, nên mở lại
  file cũ không bị đổi ngày.

## Vận hành

```bash
npm run migrate            # tạo/đồng bộ index, an toàn khi chạy lại
npm run migrate -- --dry-run
npm run backup             # gồm sampleprogressreports + sampleprogressreportarchives
```

`migrate` chỉ đồng bộ index (`syncIndexes`), không đụng dữ liệu và chạy lại được
nhiều lần.

## Kiểm thử

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run test:e2e:admin -- tests/e2e-admin/sample-progress.spec.ts --project=desktop
npm run test:e2e:admin:cleanup   # xoá riêng dữ liệu thử của E2E
```

Biến môi trường `SAMPLE_PROGRESS_WORKBOOK` trỏ tới file Excel gốc sẽ bật thêm:

- unit test đối chiếu đủ 24 mẫu, phân bố `2 / 7 / 1 / 14`, ghi chú và các ô ngày
  đặc biệt, cùng vòng xuất — nhập lại;
- E2E nhập file thật qua giao diện. Bài test tự đổi ngày báo cáo trong file sang
  tuần thử nghiệm năm 2098 và gắn nhãn vào tên mẫu, nên **không** ghi đè lên tuần
  có dữ liệu thật.

E2E chạy trên ba tuần thử nghiệm năm 2098 và được dọn bằng script chỉ xoá đúng
các bản ghi mang nhãn thử nghiệm (`tests/e2e-admin/sample-progress-cleanup.ts`).
Script không bao giờ reset database.
