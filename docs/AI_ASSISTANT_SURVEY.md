# Khảo sát hiện trạng trước khi tích hợp trợ lý AI

Ngày khảo sát: 2026-09-05. Nguồn: đọc trực tiếp mã nguồn trên nhánh `main`
(commit `a98cc02`), chạy `npm run typecheck` và `npx vitest run` (30 file,
389 test, pass), và kiểm kê cơ sở dữ liệu phát triển qua script tạm.

Tài liệu này phân biệt rõ: **(Y)** yêu cầu của khách hàng, **(C)** hành vi
mã nguồn đang thực hiện, **(D)** nội dung tài liệu trong `docs/`, **(G)** giả
định chưa xác minh.

## A. Bản đồ chức năng (bằng chứng là đường dẫn file)

| Khu vực                       | Trạng thái (C)                                                                                                    | Bằng chứng                                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Runtime / stack               | Next.js 16.3.2 App Router, React 19.2, TypeScript strict, Mongoose 9, MongoDB Atlas, Node 22, npm 10              | `package.json`, `tsconfig.json`, `next.config.ts`, `src/lib/db/mongoose.ts`                                              |
| Đăng nhập / phiên             | next-auth v4, JWT 8h, Google OAuth (chưa cấu hình) + `dev-preview` một-click khi `DEV_LOGIN_PASSWORD` có          | `src/lib/auth/config.ts`, `src/domains/identity/dev-login.ts`                                                            |
| Phân quyền                    | Catalog permission `resource.action`, scope `own < assignedBusinessUnits < all`, guard server, audit deny         | `src/domains/identity/permissions.ts`, `src/lib/auth/authorization.ts`, `src/lib/auth/guard.ts`, `src/lib/auth/index.ts` |
| Sáu vai trò                   | `DIRECTOR`, `WAREHOUSE_MANAGER`, `FACTORY_MANAGER`, `FACTORY_ACCOUNTANT`, `COMPANY_ACCOUNTANT`, `CONTENT_CREATOR` | `src/domains/identity/role-definitions.ts` (`admin` là alias dev-preview của `DIRECTOR`)                                 |
| Đơn hàng                      | 15 bước, state machine, revision, cổng duyệt Giám đốc, redaction giá bán                                          | `src/domains/orders/{workflow,service,contracts}.ts`, `src/app/[locale]/admin/(portal)/orders/**`                        |
| Phê duyệt                     | Hàng đợi pending, tách bạch người trình/người duyệt, ghim revision, unique index 1 pending/subject                | `src/domains/approvals/**`, `src/app/[locale]/admin/(portal)/approvals/**`                                               |
| Khách hàng / nhà cung cấp     | CRUD có revision, 78 khách và 144 NCC đã import                                                                   | `src/domains/customers/**`, `src/domains/suppliers/**`                                                                   |
| Tài chính                     | Sổ thu–chi, hóa đơn INV, phân bổ tiền, tỷ giá USD→VND, công nợ tính thuần (pure)                                  | `src/domains/finance/{service,invoice-service,fx-service,receivables}.ts`, `src/app/[locale]/admin/(portal)/finance/**`  |
| Nội dung / shop / báo giá web | CMS nội dung, tin tức, sản phẩm, bộ sưu tập, cửa hàng, yêu cầu báo giá + email Resend                             | `src/domains/{content,news,products,collections,shop,quote-requests}/**`                                                 |
| Email                         | Resend qua một hàm `sendEmail`, best-effort, không có outbox                                                      | `src/lib/email/resend.ts`; ADR-006 (D) mô tả outbox nhưng chưa có mã                                                     |
| Cron / worker                 | **Không có.** `CRON_SECRET` chỉ nằm trong `.env.example`, không file nào đọc                                      | `grep CRON_SECRET src scripts` trả về rỗng                                                                               |
| AI / Zalo                     | **Không có.** Không package AI, không adapter Zalo                                                                | `package.json`, `node_modules` (không có `@anthropic-ai`, `openai`)                                                      |
| Task / kế hoạch / nhắc việc   | **Không có thực thể.** `docs/DATA_MODEL.md` (D) nhắc `OutboxMessage`, `SampleOrder.deadline` nhưng chưa có mã     | `docs/DATA_MODEL.md` §8, `find src -name "*task*"` rỗng                                                                  |
| Kho, sản xuất, mua hàng       | Chỉ có permission và định nghĩa form (`planned`), không màn hình, không persistence                               | `src/domains/organization/responsibilities.ts`, `docs/ORGANIZATION.md` §3                                                |
| Test                          | Vitest (unit, fake store in-memory), Playwright (public site; admin E2E chạy bằng script tạm)                     | `vitest.config.mts`, `playwright.config.ts`, `tests/unit/helpers/finance-fakes.ts`                                       |

Placeholder / mock còn tồn tại (C): DEMO repositories chỉ dùng khi thiếu Mongo;
form vận hành (`operationalForms`) toàn bộ `planned`; trang `/admin/operations`
và `/admin/organization` chỉ hiển thị định nghĩa tĩnh.

Dữ liệu phát triển (kiểm kê 2026-09-05): 8 đơn hàng E2E (7 `received`, 1
`closed`), 78 khách, 144 NCC, 6 phiếu thu–chi, 0 hóa đơn, 0 tỷ giá, 3 yêu cầu
phê duyệt, 11 user dev-preview (gồm 5 user của role đã retire), 5 đơn vị DEMO.
Mọi grant dev-preview đều **global** (`businessUnitId: null`).

## B. Ma trận quyền thực tế của sáu vai trò

Trích từ `role-definitions.ts`; mọi thao tác ghi đều được service re-assert
(`assertHolds`) và cổng duyệt Giám đốc chặn thêm (`assertApproved`).

| Nhóm dữ liệu                           | DIRECTOR | COMPANY_ACCOUNTANT | FACTORY_ACCOUNTANT | FACTORY_MANAGER | WAREHOUSE_MANAGER | CONTENT_CREATOR |
| -------------------------------------- | -------- | ------------------ | ------------------ | --------------- | ----------------- | --------------- |
| `orders.read`                          | all      | all                | unit               | unit            | unit              | —               |
| `orders.readSellingPrice`              | all      | all                | —                  | —               | —                 | —               |
| `invoices.read` / `payments.read`      | all      | all                | —                  | —               | —                 | —               |
| `receivables.read`                     | all      | all                | —                  | —               | —                 | —               |
| `expenses.read` / `finance.readCost`   | all      | all                | unit               | unit            | —                 | —               |
| `procurement.readPrice` (giá mua)      | all      | all                | unit               | unit            | unit              | —               |
| `customers.read`                       | all      | all                | —                  | —               | —                 | —               |
| `approvals.read` / `approvals.request` | all      | all                | unit               | unit            | unit              | —               |
| `approvals.decide`                     | all      | —                  | —                  | —               | —                 | —               |
| `content.*`, `shop.*`                  | all      | — (`shopOrders.*`) | —                  | —               | —                 | all             |
| `notifications.retry`                  | all      | all                | —                  | —               | —                 | —               |

Kết luận đối chiếu với yêu cầu (Y):

1. Giá bán chỉ `DIRECTOR` và `COMPANY_ACCOUNTANT`: **khớp** (C). Kế toán nhà máy
   không có `payments.read`/`invoices.read`, đúng ghi chú 2026-09-05 trong mã.
2. `CONTENT_CREATOR` không có bất kỳ quyền `orders.*`, `finance.*`,
   `payments.*`, `customers.*`: **khớp**. `tests/unit/role-definitions.test.ts`
   ghim quy tắc này.
3. Scope theo đơn vị (`assignedBusinessUnits`) tồn tại cho 3 role vận hành;
   AI phải giữ nguyên (dùng `requireListAccess`/`requirePermission` với
   `businessUnitIds` của bản ghi).
4. Nhiều role trên một user: evaluator gộp các grant còn hiệu lực theo từng
   permission (`candidatesForPermission`), scope hẹp nhất giữa grant và role
   thắng; AI dùng đúng guard nên không cần quy tắc gộp riêng.
5. Mâu thuẫn/lưu ý phát hiện:
   - `DEV_LOGIN_PASSWORD` đang bật trong `.env` và mọi grant dev là global, nên
     trên máy dev các role đơn vị nhìn thấy mọi đơn. Không phải lỗi mã; phải xóa
     biến này trước khi deploy (đã ghi trong `.env.example`).
   - Chưa có màn hình cấp/thu hồi grant; thu hồi quyền chỉ làm được bằng script
     hoặc sửa DB rồi tăng `authzVersion` (guard bắt `STALE_SESSION`).
   - Không có permission nào cho "công việc/nhắc việc"; phải bổ sung mới
     (xem mục C), không mở rộng quyền cũ.

## C. Yêu cầu AI → module hiện có → cách tái sử dụng → phần thiếu → rủi ro

| Yêu cầu (Y)                    | Module/dữ liệu hiện có (C)                                                           | Tái sử dụng                                                                | Phần thiếu                                                                                      | Rủi ro chính                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Trợ lý trong khu quản trị      | Shell admin, nav lọc theo quyền, dictionary vi/en                                    | Thêm mục nav + trang `/admin/assistant` dùng cùng layout                   | Adapter provider AI (server), route `POST /api/assistant/chat`, giới hạn token/tool/vòng lặp    | Rò rỉ dữ liệu ngoài quyền qua tool; prompt injection từ dữ liệu     |
| Tra cứu đơn, bước, vướng mắc   | `orderCommandService`, `approvalService.findForResource`, `stageDefinition`          | Tool `get_order`, `list_orders` gọi đúng guard + redaction giá bán         | Không                                                                                           | Trộn giá bán vào tóm tắt cho role không có quyền                    |
| Kiểm tra bảng biểu, công nợ    | `computeReceivables` (pure), `financeCommandService.receivables/customerReceivables` | Tool `get_customer_receivables`, `get_receivables_overview` (cùng service) | Không tính lại trong AI; chỉ giải thích                                                         | Cộng USD với VND; báo "đối soát ngân hàng" khi không có nguồn       |
| Ghi nhớ / sắp xếp việc cần làm | **Không có**                                                                         | Mẫu domain (contracts/model/store/service/runtime) và guard hiện có        | Domain `tasks` mới: thực thể Task, quyền `tasks.*`, màn hình `/admin/tasks`                     | Tạo schema song song — kiểm tra: không có thực thể tương đương      |
| Lên kế hoạch khi có đơn        | `orderStageDefinitions` (chủ bước, quyền, cổng duyệt), `expectedReadyAt` trên đơn    | Kế hoạch = các bước còn lại của state machine, không đặt quy trình mới     | Thực thể `AssistantProposal` (bản nháp → duyệt → áp dụng idempotent), kiểm tra phụ thuộc/hạn    | AI "đã làm" khi mới sinh văn bản; duyệt hai lần tạo trùng           |
| Theo dõi tiến độ               | `stageHistory`, `updatedAt`, audit                                                   | Tóm tắt từ bản ghi, có mã đối tượng và link                                | Task status cập nhật từ UI (một chạm), không qua chat                                           | Xem câu chat "đã xong" là bằng chứng                                |
| Nhắc việc nền                  | `sendEmail` (Resend, sandbox sender), **không có cron/outbox**                       | Dùng `sendEmail` làm channel adapter                                       | `NotificationIntent` (outbox, dedupe, retry), route cron có `CRON_SECRET`, nút chạy tay có RBAC | Gửi trùng khi job chạy lặp; gửi cho người thật khi test             |
| Zalo                           | **Không có**                                                                         | Cùng chính sách quyền, cùng outbox                                         | Adapter OA API, webhook có chữ ký, liên kết danh tính có xác minh                               | Tài liệu chính thức render JS, không fetch được; chưa có credential |

Quyết định nền tảng tối thiểu cần thêm (không viết lại module đang chạy):

- Quyền mới trong catalog: `tasks.read`, `tasks.create`, `tasks.update`,
  `tasks.assign`, `tasks.approvePlan`, `assistant.use`. Cấp theo role trong
  `role-definitions.ts`; `CONTENT_CREATOR` chỉ có `tasks.*` ở scope `own` và
  `assistant.use` (không có tool nào chạm đơn hàng/tài chính vì thiếu
  `orders.read`).
- Ba domain mới: `tasks`, `assistant`, `notifications` theo đúng mẫu domain
  hiện có. Adapter Zalo ở `src/lib/zalo`.
- Biến môi trường mới (tên, không giá trị): `ANTHROPIC_API_KEY`, `AI_MODEL`,
  `AI_PROVIDER` (`anthropic` | `mock`, mock chỉ cho dev/test), `CRON_SECRET`
  (đã có tên), `BUSINESS_TIMEZONE` (mặc định `Asia/Ho_Chi_Minh`),
  `NOTIFICATION_TEST_RECIPIENT`, `ZALO_APP_ID`, `ZALO_OA_ACCESS_TOKEN`,
  `ZALO_OA_SECRET_KEY`, `ZALO_OA_GROUP_ID`.

## D. Baseline test và lỗi có trước

- `npm run typecheck`: pass (exit 0) trước khi sửa.
- `npx vitest run`: 30 file, 389 test pass, 2.6 s.
- `npm run lint`: pass (0 warning) trước khi sửa; chạy lại sau khi hoàn tất,
  kết quả trong `docs/AI_ASSISTANT.md` mục 7.
- Playwright public suite cần build production; admin E2E trước đây chạy bằng
  script tạm (memory dự án), không có spec admin nào được commit.
- Lỗi có trước: không phát hiện lỗi build/test. Ghi nhận: `docs/IMPLEMENTATION_STATUS.md`
  cập nhật lần cuối 2026-08-27, chưa phản ánh tài chính/khách hàng/shop đã có
  (D lệch C).

## E. Kế hoạch triển khai theo phụ thuộc và rủi ro

1. Quyền + env + domain `tasks` (nền cho mọi thứ khác).
2. Domain `assistant`: tool registry có guard, adapter provider, orchestrator
   có giới hạn, proposal + áp dụng idempotent.
3. UI: `/admin/assistant`, `/admin/tasks`, mục "Việc liên quan" trên chi tiết
   đơn, dòng trạng thái ở `/admin/settings`.
4. Domain `notifications`: outbox, scheduler thuần, route cron, adapter email
   - Zalo, webhook Zalo, liên kết danh tính.
5. Test: unit (chính sách, kế hoạch, lịch nhắc, projection quyền, injection),
   eval fixture có version, E2E theo sáu role bằng dev-preview trên server
   dev, review bảo mật diff.
6. Docs + báo cáo.
