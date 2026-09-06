# Kiểm tra bảng biểu, dư nợ (sheet checks)

Tính năng cho phép nhân viên tải một bảng Excel/CSV nhận từ nhóm Zalo (báo cáo
tiền về, bảng công nợ, danh sách đơn hàng) lên cổng quản trị; hệ thống đọc từng
ô, kiểm tra định dạng và **đối chiếu với dữ liệu thật trong phần mềm** (đơn
hàng, hóa đơn, phiếu thu, công nợ) rồi trả về một bản kết quả bất biến. Kết quả
chỉ để xem: không ghi gì vào hệ thống, không lưu tệp gốc.

Mã nguồn: `src/domains/sheet-checks/`, trang `/[locale]/admin/checks`, API
`POST /api/sheet-checks`, `GET /api/sheet-checks/[id]/export`, bốn công cụ
của trợ lý AI trong `src/domains/assistant/tools/sheet-checks.ts`.

## Luồng sử dụng

1. **Tải bảng** (`/admin/checks/new`): chọn loại bảng (mẫu), chọn tệp
   `.xlsx` / `.xls` / `.csv` (≤ 4 MB, ≤ 2.000 dòng dữ liệu, ≤ 40 cột, ≤ 10 sheet),
   tùy chọn sheet. Tệp được phân tích ngay trên máy chủ và **không được lưu**;
   chỉ lưới đã đọc (text + số + định dạng số) được lưu.
2. **Xác nhận cột** (`/admin/checks/[id]`, trạng thái `mapping`): hệ thống đề
   xuất ý nghĩa từng cột theo dòng tiêu đề (bảng từ đồng nghĩa vi/en) và theo
   dữ liệu; người dùng sửa lại, chọn đơn vị (× 1.000, × 1.000.000), kiểu số
   (1.250.000,50 / 1,250,000.50), định dạng ngày (ngày/tháng/năm hay
   tháng/ngày/năm) khi không tự phân biệt được, tiền tệ mặc định và kỳ báo cáo.
3. **Chạy kiểm tra**: mọi ô được đọc lại theo mapping đã xác nhận; từng dòng
   được đối chiếu; kết quả (tổng quan, tổng cộng theo cột và loại tiền, phát
   hiện chung, khoản có trong hệ thống nhưng thiếu trên bảng, từng dòng) được
   lưu bất biến (trạng thái `checked`). Muốn chạy lại với cột khác hoặc dữ liệu
   mới → "Chạy lại với tệp này" tạo bản mới (`rerunOf`).
4. **Xuất CSV** (có BOM, chống formula injection) và **tạo việc theo dõi** qua
   trợ lý (`propose_sheet_check_follow_ups`): chỉ tạo **đề xuất** chờ duyệt ở
   trang Việc cần làm; tiêu đề việc do máy chủ đặt, không chứa số tiền hay nội
   dung ô.

Bản nháp chưa chạy tự xóa sau 7 ngày; kết quả đã chạy tự xóa sau
`SHEET_CHECK_RETENTION_DAYS` ngày (mặc định 180, giới hạn 7–365) bằng TTL index
(`npm run migrate` để đồng bộ index).

## Ba mẫu bảng

| Mẫu                              | Cột bắt buộc                                                               | Đối chiếu với                                                                                                                                                                                                                                                                              | Quyền cần (toàn cục)                                 |
| -------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `incomingCash` — báo cáo tiền về | ngày, số tiền + một cột định danh (khách / mã khách / mã đơn / số hóa đơn) | phiếu thu `orderPayment` (kể cả đã hủy) theo 7 mức khớp: số chứng từ, khách + số tiền + ngày (±7 ngày), đơn/hóa đơn được gắn, số tiền + ngày, dung sai phí ngân hàng (≤ 0,5 %, trần 500.000 ₫ / 50 USD, sàn 30.000 ₫ / 5 USD), nhiều dòng gộp một phiếu thu, một dòng bằng nhiều phiếu thu | `payments.read`                                      |
| `receivables` — báo cáo công nợ  | dư nợ cuối kỳ + một cột định danh                                          | `computeReceivables` (cùng công thức với trang Công nợ) tính đến cuối kỳ; dư đầu kỳ, phát sinh, đã thu trong kỳ; hóa đơn/đơn theo mã                                                                                                                                                       | `receivables.read`, `invoices.read`, `payments.read` |
| `generic` — danh sách đơn hàng   | mã đơn                                                                     | đơn hàng trong phạm vi `orders.read` của người chạy (trạng thái, khách); **chỉ khi có quyền toàn cục** mới so thêm giá bán (`orders.readSellingPrice`, phải bật tùy chọn), hóa đơn (`invoices.read`), danh bạ khách (`customers.read`)                                                     | `orders.read` (mọi phạm vi)                          |

Không so VND với USD; không có tổng gộp hai loại tiền ở bất kỳ đâu. Kết quả
so với sổ hóa đơn và phiếu thu đã ghi trong hệ thống, **chưa đối soát với sao kê
ngân hàng**.

## Quyền và phạm vi

- Không thêm quyền mới. Tải/chạy/hủy nháp: `documents.import`; xem/danh sách:
  `documents.read`; xuất CSV: `documents.export`. Mẫu tiền cần thêm các quyền
  tài chính **ở phạm vi toàn cục** (giống trang Công nợ); `documents.readSensitive`
  không bao giờ được dùng làm cổng xem tiền.
- Mỗi bản kiểm tra ghi `requiredPermissions` = quyền mẫu + mọi quyền cơ hội đã
  thực sự dùng khi chạy. **Mọi** lần đọc (trang, dòng, xuất, công cụ trợ lý)
  đều kiểm tra lại `documents.read` **và** từng quyền trong danh sách này với
  ảnh chụp quyền hiện tại; thiếu một quyền → trang 404 / công cụ
  `PERMISSION_DENIED`, không có bản xem rút gọn. Danh sách chỉ hiện những bản
  người đọc được mở (không có trạng thái "khóa").
- Phạm vi đơn vị (`businessUnitIds`) lấy từ grant `documents.import` của người
  tải, không lấy từ biểu mẫu hay tệp. Người chạy phạm vi đơn vị (Kế toán nhà
  máy, Thủ kho) chỉ dùng được mẫu `generic`: cột số tiền được kiểm tra định
  dạng và cộng dồn nhưng **không** đối chiếu (`AMOUNT_NOT_COMPARED` một lần cho
  cả cột), kho tài chính và danh bạ khách không bao giờ được truy vấn, dòng
  không lưu dữ liệu tiền của hệ thống; đơn không tồn tại và đơn ngoài phạm vi
  cho cùng một phát hiện `ORDER_NOT_FOUND`.
- Người tạo nội dung (`CONTENT_CREATOR`) không có mục menu, mọi trang 404, API
  403, không được cung cấp công cụ trợ lý nào của tính năng.
- Mọi lần từ chối và mọi thao tác được ghi audit (`sheetCheck.created/run/
discarded/rerun/exported/denied`) với metadata không chứa nội dung ô.

## Đọc tệp an toàn (ADR-005)

- Kiểm tra magic bytes trước đuôi tệp; `.xlsm/.xltm` bị từ chối
  (`FILE_MACRO_REJECTED`), `.xlsb/.ods`/tệp đổi đuôi → `FILE_TYPE_REJECTED`.
- Kiểm tra central directory của zip bằng mã riêng trước khi SheetJS đọc: ≤ 200
  entry, mỗi entry ≤ 30 MB, tổng ≤ 60 MB, không ZIP64, không `../`, có
  `xl/vbaProject*` → từ chối.
- SheetJS đọc với `cellFormula: true` chỉ để **gắn cờ** công thức (giá trị đã
  lưu được dùng; công thức không có giá trị → `FORMULA_NO_CACHE`), `cellDates:
false`, `bookVBA/bookFiles/bookProps: false`, giới hạn dòng. CSV có bộ phân
  tích RFC-4180 riêng (UTF-8, UTF-16 BOM, dự phòng Windows-1258), không qua SheetJS.
- Tiền: chỉ `decimal.js`; số trong ô Excel được lấy đúng giá trị thật (phần lẻ
  ẩn → `AMOUNT_HIDDEN_DECIMALS`); văn bản theo bảng quyết định vi/en; ngày:
  serial Excel (kể cả hệ 1904), văn bản d/m/y với suy luận thứ tự theo cột;
  mọi so sánh theo ngày làm việc `Asia/Ho_Chi_Minh`.

## Phát hiện (issue catalogue)

Mọi phát hiện lưu dạng `code + params` (`src/domains/sheet-checks/issues.ts`)
và được dịch thành câu khi hiển thị (vi/en); nội dung ô chỉ là tham số, không
bao giờ là khuôn mẫu. Ba mức: `error` (không khớp / không đọc được), `warn`
(cần xem), `info` (đã khớp, ghi nhận). Kết quả từng dòng: `matched`,
`mismatch`, `notFound`, `notCompared`, `invalid`, `skipped`.

## Trợ lý AI

Bốn công cụ (chỉ cung cấp khi có `documents.read`): `list_sheet_checks`,
`get_sheet_check`, `get_sheet_check_row`, `propose_sheet_check_follow_ups`
(cần thêm `tasks.create`). Mỗi công cụ tự kiểm tra lại quyền trên máy chủ theo
đúng quy tắc đọc ở trên; payload không bao giờ chứa cả lưới. Provider giả lập
(`AI_PROVIDER=mock`) hiểu các câu "kết quả kiểm tra bảng biểu <id>", "dòng N
trong kiểm tra <id>", "đề xuất việc theo dõi cho kiểm tra <id>".

## Đã sửa sau rà soát đối kháng (2026-09-06)

Một vòng rà soát nhiều góc (quyền, nội dung không tin cậy, tiền, ngày, đối
chiếu, đọc tệp, lưu trữ, bám đặc tả) đã phát hiện và các lỗi sau đã được sửa
kèm test hồi quy:

- **Phạm vi đơn vị khi người chạy có quyền rộng hơn**: bản kiểm tra do kế toán
  nhà máy tải lên nhưng do Giám đốc bấm chạy trước đây nạp đơn hàng của **mọi**
  đơn vị và lưu vào dòng; nay ảnh chụp dữ liệu bị thu hẹp đúng bằng phạm vi đã
  đóng dấu trên bản kiểm tra.
- **Dấu của tiền hoàn trong bảng công nợ**: công thức kiểm tra số học của dòng
  nay là `dư đầu + phát sinh − đã thu + hoàn = dư cuối`, khớp với cách hệ thống
  tính (`credit = đã thu − hoàn`).
- **Kỳ báo cáo "THÁNG 8 NĂM 2026"**: trước đây bị hiểu thành cả năm 2026.
- **Cột tiền hai loại tiền** ("Số tiền" gộp trên "VND"/"USD"): mỗi cột nay được
  cộng theo ô của chính nó, không còn báo `TOTAL_MIXED_CURRENCY` sai.
- **Ghép phiếu thu**: dòng ghi tên khách nhưng không tra được nữa **không** bị
  ghép với phiếu thu của khách khác; dung sai phí ngân hàng không còn nuốt các
  khoản nhỏ hơn chính ngưỡng sàn.
- **Tiền tệ theo định dạng Excel**: `[$₫-42A]` không còn bị hiểu là USD;
  `[$CA$-1009]`, `[$A$-C09]`… bị từ chối là tiền tệ không hỗ trợ.
- **Văn bản không tin cậy**: tiêu đề cột và tham số `?error=`/`?notice=` không
  còn tra được qua chuỗi prototype (`__proto__`, `constructor`).
- **Tải lên**: xác thực và giới hạn tần suất chạy **trước** khi đọc thân yêu
  cầu (yêu cầu chunked không còn vượt được giới hạn kích thước).
- **Danh sách**: trang danh sách nay đọc tiếp cho tới khi đủ số dòng người đọc
  được phép mở, thay vì trả trang thiếu.
- **Ghi kết quả**: nếu ghi kết quả từng dòng thất bại, bản kiểm tra được trả về
  trạng thái nháp thay vì "đã kiểm tra" mà dòng rỗng.
- **Chạy lại** chỉ áp dụng cho bản đã chạy; **kỳ báo cáo** phải là ngày có thật;
  **tên sheet** bị cắt và làm sạch; **dòng tổng lỗi #REF!** được báo; số dòng
  "không đọc được" không còn tính các ô gạch ngang/ô gộp; **số hóa đơn quá hạn**
  tính đến cuối kỳ chứ không phải lúc chạy; nhắn tin sai về quyền khi người dùng
  chỉ tắt tùy chọn so giá bán đã được tách thành thông báo riêng.
- **Giới hạn kho dữ liệu**: nếu ảnh chụp chạm trần (1.000 đơn / 5.000 phiếu thu
  / 1.000 khách) kết quả kèm cảnh báo `SYSTEM_DATA_TRUNCATED` thay vì im lặng
  kết luận "không tìm thấy".

## Kiểm thử

- Unit (Vitest): `tests/unit/sheet-checks-*.test.ts`,
  `tests/unit/assistant-sheet-check-tools.test.ts` (parser tiền/ngày/mã, CSV,
  intake, tiêu đề, dòng, ba engine đối chiếu, service/quyền với bộ đánh giá
  thật, xuất CSV, công cụ trợ lý).
- Eval trợ lý: `tests/eval/assistant-cases.json` phiên bản `2026-09-06.2`
  thêm 8 case về bảng biểu (`npm run eval:assistant`).
- E2E (Playwright): `tests/e2e-admin/sheet-checks.spec.ts`, chạy với
  `E2E_ADMIN_BASE_URL` trỏ vào server đang chạy. Cần fixture đơn
  `RD-20260906-E2E1` cùng hóa đơn `INV-E2E-0001` và hai phiếu thu (script trong
  scratchpad của phiên làm việc; xóa bằng `--cleanup`).

  Trạng thái lần chạy 2026-09-06 trên bản `next build` + `next start` (cổng
  3100), dữ liệu MongoDB thật của môi trường phát triển:

  | Kịch bản                                                                                                                                                               | Kết quả     |
  | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
  | Khách vãng lai: trang và API tải lên đều bị chặn                                                                                                                       | PASS        |
  | Content creator: không có menu, trang 404, tải lên 403                                                                                                                 | PASS        |
  | Kế toán công ty: tải báo cáo tiền về → xác nhận cột → chạy → khớp 2 phiếu thu, báo 1 dòng không có phiếu thu, dòng tổng khớp, xuất CSV có BOM và vô hiệu hóa công thức | PASS        |
  | Kế toán công ty: bảng công nợ → phát hiện khớp "còn phải thu" nhưng khách đang trả trước 500 USD                                                                       | PASS        |
  | Kế toán nhà máy: bản kiểm tra tiền không tồn tại với họ, xuất 404, tải mẫu tiền 403, chạy danh sách đơn không lộ tiền                                                  | **NOT RUN** |
  | Giám đốc: đề xuất việc theo dõi từ bản kiểm tra                                                                                                                        | **NOT RUN** |

  Hai kịch bản cuối cần trợ lý chạy provider giả lập; bản `next start` từ chối
  provider giả lập (đúng thiết kế) và server `next dev` đang bật provider thật,
  nên test **tự bỏ qua thay vì gọi mô hình thật**. Muốn chạy đủ: khởi động lại
  dev server bằng `AI_PROVIDER=mock NOTIFICATION_DELIVERY=off npm run dev` rồi
  chạy `E2E_ADMIN_BASE_URL=http://localhost:3100
E2E_ASSISTANT_BASE_URL=http://localhost:3000 npx playwright test -c
playwright.admin.config.ts tests/e2e-admin/sheet-checks.spec.ts`. Phần quyền
  và payload của bốn công cụ trợ lý hiện được chứng minh bằng 25 test đơn vị
  chạy qua bộ đánh giá quyền thật và 8 case eval.

## Chưa làm / cần khách hàng chốt

- Đọc **ảnh** bảng (chụp từ Zalo) cần khóa mô hình có khả năng xem ảnh; dữ liệu
  đã dự trữ `sourceKind: "image"`, chưa có đường nhận dạng.
- Công nợ **phải trả** nhà cung cấp/nhà máy: chưa có quy tắc kế toán, chưa làm.
- Danh sách câu hỏi mở (kỳ báo cáo, ý nghĩa "dư nợ" trong bảng của khách, dung
  sai phí ngân hàng, thời hạn lưu…) xem `docs/AI_ASSISTANT.md` và biên bản
  thiết kế.
