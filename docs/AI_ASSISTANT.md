# Trợ lý AI, việc cần làm và nhắc việc

Trạng thái: triển khai ngày 2026-09-06 trên nhánh `main`. Tài liệu này là
thiết kế, ma trận quyền, runbook và bằng chứng kiểm thử của phần trợ lý AI.
Khảo sát hiện trạng trước khi thiết kế nằm ở `docs/AI_ASSISTANT_SURVEY.md`.

Quy ước: **PASS** = đã chạy và đạt; **BLOCKED** = không chạy được vì thiếu
credential/dịch vụ; **NOT RUN** = có thể chạy nhưng chưa chạy. "Mock" chỉ
chứng minh đường ống quanh mô hình, không chứng minh mô hình thật.

## 1. Yêu cầu khách hàng → chức năng đã có

| Yêu cầu                                            | Chức năng                                                                                               | Nơi thực hiện                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Trợ lý trong khu quản trị, tra cứu theo đúng quyền | Trang **Trợ lý AI** (`/admin/assistant`), API `POST /api/assistant/chat`, 10 tool có guard server       | `src/domains/assistant/**`, `src/app/api/assistant/chat/route.ts`, `src/components/admin/assistant-chat.tsx` |
| Ghi nhớ và theo dõi công việc                      | Trang **Việc cần làm** (`/admin/tasks`): tạo, xong, mở lại, hủy có lý do; mục "Việc liên quan" trên đơn | `src/domains/tasks/**`, `src/app/[locale]/admin/(portal)/tasks/**`, order detail page                        |
| Khi có đơn hàng, AI lên kế hoạch                   | Tool `propose_order_plan` → **đề xuất** (bản nháp) theo các bước còn lại của quy trình 15 bước          | `src/domains/assistant/planning.ts`, `service.ts`                                                            |
| Người có quyền duyệt rồi mới tạo việc              | Thẻ đề xuất trong chat và mục "Đề xuất chờ duyệt" trên trang việc; duyệt idempotent theo slot           | `tasks/actions.ts` (`decideProposalAction`), `AssistantProposalService.decide`                               |
| Kiểm tra bảng biểu, dư nợ                          | Tool `get_customer_receivables`, `get_receivables_overview` dùng đúng `computeReceivables` của trang    | `src/domains/assistant/tools/finance.ts`                                                                     |
| Nhắc việc qua chatbot Zalo/email                   | Outbox `NotificationIntent`, job quét + gửi, route cron, nút chạy tay, adapter email/Zalo               | `src/domains/notifications/**`, `src/app/api/cron/reminders/route.ts`, `src/lib/zalo/**`                     |
| Tích hợp Zalo                                      | Gửi tin OA tới người đã liên kết; webhook liên kết danh tính bằng mã; **chưa** gửi nhóm (chưa xác minh) | `src/lib/zalo/oa-client.ts`, `webhook.ts`, `src/app/api/zalo/webhook/route.ts`                               |

## 2. Kiến trúc và luồng dữ liệu

```
Trình duyệt (assistant-chat.tsx, transcript chỉ trong bộ nhớ trang)
  └─ POST /api/assistant/chat  ── requirePermission("assistant.use") ── rate limit 20/5 phút
       └─ runAssistantChat (chat.ts): system prompt + lịch sử text + tool đã lọc theo quyền
            ├─ provider: AnthropicAssistantProvider (claude-opus-5, tool_choice auto, timeout, 1 retry)
            │            hoặc MockAssistantProvider (AI_PROVIDER=mock, cấm production)
            └─ tool.run(input, context) → requirePermission/requireListAccess thật → service hiện có
                 ├─ orders / approvals / customers / finance (chỉ đọc, redaction giá bán như trang)
                 ├─ tasks (đọc)
                 └─ propose_* → AssistantProposal (status proposed) — KHÔNG tạo việc
Duyệt (server action decideProposalAction) ── tasks.approvePlan + tasks.create trên đơn/đơn vị
  └─ AssistantProposalService.decide: kiểm tra revision đơn, hạn, phụ thuộc → TaskCommandService.applyPlanItems
       (unique index (proposalId,itemIndex) → duyệt hai lần/đồng thời không nhân đôi) → proposal approved + audit
Job nhắc việc (cron GET/POST /api/cron/reminders, bearer CRON_SECRET; hoặc nút "Chạy nhắc việc ngay")
  └─ runReminderJob: quét task mở có hạn → planReminders (dueSoon/due/overdue, 1 lần/ngày)
       → upsert NotificationIntent (dedupeKey unique) → claimDue (atomic) → kiểm tra task còn hợp lệ
       → NOTIFICATION_DELIVERY off/test/live → email (Resend, idempotencyKey) / Zalo OA → sent/failed/skipped/deadLetter
Zalo webhook POST /api/zalo/webhook ── chữ ký sha256(appId+body+timestamp+secret), tuổi ≤ 5 phút, msg_id một lần
  └─ user_send_text chứa mã RD-XXXXXX → ChannelLinkService.completeZaloLink (theo mã, không theo tên)
```

Giới hạn mã hóa cứng: tối đa `AI_MAX_TOOL_ROUNDS` vòng tool (mặc định 6),
timeout mỗi lượt gọi mô hình `AI_REQUEST_TIMEOUT_MS` (90 s, vòng lặp tự
ngắt kể cả khi provider bỏ qua tín hiệu), kết quả tool cắt ở 12.000 ký tự,
tối đa 4.096 token đầu ra, 20 lượt hỏi/5 phút/người, lịch sử tối đa 20 lượt
text (không gửi lại tool block), 1 đề xuất tối đa 10 việc ad-hoc.

## 3. Quyền và phạm vi

Permission mới (catalog `src/domains/identity/permissions.ts`):
`tasks.read`, `tasks.create`, `tasks.update`, `tasks.assign`,
`tasks.approvePlan`, `assistant.use`, `notifications.manageOwnChannels`.
Không permission cũ nào bị nới.

| Role               | assistant.use | tasks read/create/update | tasks.assign | tasks.approvePlan | Tool được cung cấp cho trợ lý                                                                                                    |
| ------------------ | ------------- | ------------------------ | ------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| DIRECTOR           | all           | all                      | all          | all               | tất cả 10 tool                                                                                                                   |
| COMPANY_ACCOUNTANT | all           | all                      | all          | all               | tasks, orders, approvals, customers, receivables, propose_*, editorial (có content.read? không → không có `list_editorial_work`) |
| FACTORY_MANAGER    | unit          | unit + own               | unit         | unit              | list_my_tasks, list_orders, get_order, list_pending_approvals, propose_order_plan, propose_tasks                                 |
| FACTORY_ACCOUNTANT | unit          | unit + own               | —            | —                 | như FACTORY_MANAGER (không có tool tài chính khách hàng)                                                                         |
| WAREHOUSE_MANAGER  | unit          | unit + own               | —            | —                 | như FACTORY_MANAGER                                                                                                              |
| CONTENT_CREATOR    | all           | —                        | —            | —                 | chỉ `list_editorial_work`                                                                                                        |

Bằng chứng: `tests/unit/assistant-chat.test.ts` ("offers every role exactly
the tools its grants allow") và `tests/unit/role-definitions.test.ts` (giá
bán/hóa đơn/công nợ vẫn chỉ DIRECTOR + COMPANY_ACCOUNTANT).

Quy tắc đã giữ nguyên: giá bán, hóa đơn, tiền khách trả chỉ vào kết quả tool
khi người hỏi giữ quyền tương ứng và **không xuất hiện kể cả dưới dạng
`null`**; `content_creator` không có tool nào chạm đơn hàng/tài chính;
scope theo đơn vị đi qua `requireListAccess`/`requirePermission` với
`businessUnitIds` của bản ghi.

Việc không gắn đơn (việc cá nhân) được đóng dấu bằng chính các đơn vị của
người tạo (lấy từ grant trên server, không từ form) để grant theo đơn vị
với tới được; lý do: evaluator hiện coi `own` dưới grant theo đơn vị chỉ
phủ bản ghi có cùng đơn vị (`tests/unit/authorization-dual-scope.test.ts`).

Thay đổi ở lớp auth: `candidatesForPermission` giờ sinh một ứng viên cho
**mỗi** dòng role khai cùng permission (trước đây chỉ dòng đầu tiên được
tính). Cần thiết vì `tasks.read` được khai ở cả `assignedBusinessUnits` và
`own`; không đổi kết quả cho các role chỉ khai một scope.

## 4. Quyết định quan trọng

1. **AI chỉ đề xuất.** Mọi thay đổi dữ liệu đi qua `AssistantProposal` →
   người có quyền duyệt trên web. Trạng thái phân biệt rõ: `proposed`,
   `approved`, `rejected`, `expired` (đơn đổi revision hoặc đã đóng).
2. **Kế hoạch = các bước còn lại của state machine hiện có**, chủ bước theo
   `orderStageDefinitions`; AI chỉ chỉnh thời lượng/ghi chú; mọi giả định
   (chưa có ngày sẵn hàng, thời lượng mặc định, vị trí chưa có/nhiều người)
   được ghi vào đề xuất. Không đặt trạng thái hay quy trình mới.
3. **Hạn = cuối ngày làm việc theo `BUSINESS_TIMEZONE`** (mặc định
   `Asia/Ho_Chi_Minh`), lưu là instant 23:59:59.999 giờ địa phương.
4. **Không lưu hội thoại server-side.** Transcript chỉ nằm trong trang; mỗi
   lượt ghi một audit `assistant.chat` (tool đã gọi, kết quả, usage, độ dài
   câu hỏi; không lưu nội dung). Thu hồi quyền có hiệu lực ngay ở lượt sau.
5. **Provider giả lập** (`AI_PROVIDER=mock`) chỉ cho phát triển/test; schema
   env từ chối trong production; UI gắn nhãn "GIẢ LẬP" trên từng câu trả lời.
6. **Gửi thông báo mặc định tắt** (`NOTIFICATION_DELIVERY=off`): intent vẫn
   được ghi và hiển thị `skipped: DELIVERY_OFF`. `test` chuyển toàn bộ tới
   `NOTIFICATION_TEST_RECIPIENT` (Zalo không có địa chỉ test → skipped).
7. **Ngoài chat, việc được cập nhật trên web** (một chạm "Xong" trên điện
   thoại). Không có tool nào cho AI đánh dấu hoàn thành.
8. Dùng SDK chính thức `@anthropic-ai/sdk`, model mặc định `claude-opus-5`
   (đổi bằng `AI_MODEL`), `tool_choice: auto`, prompt hệ thống cố định đặt
   trước để cache. Chưa bật `fallbacks` (beta) cho trường hợp mô hình từ
   chối; câu trả lời `refusal` được hiển thị trung thực.

## 5. Cấu hình và runbook

Biến môi trường (tên, không giá trị; xem `.env.example`):

| Biến                                                        | Ý nghĩa                                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `AI_PROVIDER`                                               | `anthropic` (mặc định) hoặc `mock` (chỉ dev/test)                                     |
| `ANTHROPIC_API_KEY`                                         | Bắt buộc khi `anthropic`; thiếu → trang trợ lý báo "chưa cấu hình", phần còn lại chạy |
| `AI_MODEL`, `AI_MAX_TOOL_ROUNDS`, `AI_REQUEST_TIMEOUT_MS`   | Model, số vòng tool, timeout mỗi lượt                                                 |
| `BUSINESS_TIMEZONE`                                         | Múi giờ nghiệp vụ, mặc định `Asia/Ho_Chi_Minh`                                        |
| `NOTIFICATION_DELIVERY`                                     | `off` (mặc định) / `test` / `live`                                                    |
| `NOTIFICATION_TEST_RECIPIENT`                               | Email nhận mọi thông báo ở chế độ `test`                                              |
| `REMINDER_LEAD_DAYS`, `REMINDER_QUIET_HOURS`                | Nhắc trước hạn N ngày (1); giờ yên lặng `21-7`                                        |
| `CRON_SECRET`                                               | ≥ 32 ký tự; bearer cho `/api/cron/reminders`; thiếu → route trả 503, chỉ chạy tay     |
| `ZALO_APP_ID`, `ZALO_OA_ACCESS_TOKEN`, `ZALO_OA_SECRET_KEY` | Kênh Zalo và webhook                                                                  |

Vận hành:

- Sau khi pull: `npm run seed` (cập nhật 6 role với permission mới) và
  `npm run migrate` (tạo index cho `tasks`, `assistantproposals`,
  `notificationintents`, `channellinks`, `processedwebhookevents`). Đã chạy
  trên DB dev ngày 2026-09-06.
- Lịch nhắc việc: cấu hình scheduler gọi `GET /api/cron/reminders` với header
  `Authorization: Bearer <CRON_SECRET>` mỗi 30–60 phút (Vercel Cron tự gửi
  header này khi có biến `CRON_SECRET`). Job idempotent; chạy chồng an toàn.
  Không có lịch → Giám đốc/Kế toán công ty bấm "Chạy nhắc việc ngay".
- Trang `/admin/settings` hiển thị trạng thái AI, chế độ gửi, cron, Zalo.
- Rollback/tắt: bỏ `ANTHROPIC_API_KEY` (hoặc `AI_PROVIDER`) → trợ lý báo chưa
  cấu hình, trang việc và mọi màn hình khác không đổi; `NOTIFICATION_DELIVERY=off`
  dừng gửi ngay lượt job kế tiếp; các collection mới có thể xóa mà không ảnh
  hưởng dữ liệu cũ (không sửa schema cũ; chỉ thêm `findByCode` cho đơn).
- Lỗi thường gặp: `PROVIDER_TIMEOUT` (mô hình chậm, không có thao tác nào
  xảy ra), `RATE_LIMITED` (429), `NOT_CONFIGURED` (503). Nhắc việc lỗi hiện
  trong bảng "Nhắc việc" với `lastError`; nút "Gửi lại" xếp lại hàng.

## 6. Zalo — mức độ xác minh

- Đã làm: adapter gửi tin `POST https://openapi.zalo.me/v3.0/oa/message/cs`
  (header `access_token`, body `{recipient:{user_id}, message:{text}}`), phân
  loại lỗi credential/rate-limit/ứng dụng/timeout; webhook xác minh
  `X-ZEvent-Signature` = `mac=sha256(appId + rawBody + timestamp + secretKey)`,
  chống replay (tuổi ≤ 5 phút, `msg_id` một lần, TTL 7 ngày); liên kết danh
  tính bằng mã `RD-XXXXXX` 15 phút, một Zalo ↔ một tài khoản (unique index).
- **Chưa xác minh với tài liệu chính thức**: trang developers.zalo.me render
  bằng JavaScript, không lấy được nội dung ngày 2026-09-06; endpoint và công
  thức chữ ký lấy từ wrapper mã nguồn mở và thread cộng đồng của Zalo. Phải
  đối chiếu lại khi có credential trước lần gửi thật đầu tiên.
- **Không hỗ trợ gửi vào nhóm Zalo**: không tìm được endpoint nhóm chính
  thức; thiết kế hiện tại gửi riêng cho từng người đã liên kết. Nếu khách hàng
  cần nhóm, cần xác nhận với Zalo về loại OA/ZNS phù hợp.
- Trạng thái kiểm thử: contract/mock **PASS** (`tests/unit/zalo-webhook.test.ts`),
  live **BLOCKED** (không có `ZALO_*`).

## 7. Kiểm thử và bằng chứng

Chạy ngày 2026-09-06 trên máy dev (Windows 11, Node 22.14, MongoDB Atlas dev).

| Nhóm                | Lệnh                                                              | Kết quả                                                                                                                           |
| ------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck           | `npm run typecheck`                                               | PASS                                                                                                                              |
| Lint                | `npm run lint`                                                    | PASS (0 warning)                                                                                                                  |
| Build sản xuất      | `npm run build`                                                   | PASS — 5 route mới (`/api/assistant/chat`, `/api/cron/reminders`, `/api/zalo/webhook`, `/admin/assistant`, `/admin/tasks`)        |
| Prettier            | `npm run format:check`                                            | 61 file lệch định dạng **có từ trước** (ví dụ `tests/unit/role-definitions.test.ts`), không thuộc gate CI; file mới/sửa đã format |
| Unit + eval (mock)  | `npx vitest run`                                                  | PASS — 39 file, 472 test (389 có trước + 83 mới)                                                                                  |
| Eval live model     | `ASSISTANT_EVAL_LIVE=1 npm run eval:assistant`                    | **BLOCKED** — không có `ANTHROPIC_API_KEY` trên máy này                                                                           |
| E2E admin (6 role)  | `E2E_ADMIN_BASE_URL=http://localhost:3000 npm run test:e2e:admin` | PASS — 11/11 (10 desktop + 1 mobile Pixel 5), dev server `AI_PROVIDER=mock`                                                       |
| Gửi email/Zalo thật | —                                                                 | **NOT RUN** (không có test recipient được chỉ định; `NOTIFICATION_DELIVERY=off`)                                                  |

Bộ eval `tests/eval/assistant-cases.json` (version `2026-09-06.1`, 17 case)
chạy qua `tests/eval/harness.ts`: registry tool thật, vòng lặp chat thật,
service thật, **evaluator quyền thật với seed role thật** trên store in-memory.
Assertion về tool được cung cấp/gọi, payload tool (ví dụ payload cho kế toán
nhà máy không chứa `"sellingPrice":{` hay số hóa đơn) và facts, không về văn
phong. Ở chế độ live các assertion phụ thuộc văn phong được nới về "chứa".

Đối chiếu 32 ca nghiệm thu trọng yếu của đề bài:

| #     | Ca                                                | Bằng chứng                                                                                                    |
| ----- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1     | Chưa đăng nhập gọi API                            | E2E test 1: 401, không có dữ liệu; cron/webhook 503 khi chưa cấu hình                                         |
| 2     | Mỗi role có ca cho phép và bị cấm                 | eval `cc-*`, `fa-*`, `wm-*`, `ca-*`, `dir-*`; E2E test 2–7                                                    |
| 3     | content_creator hỏi/gọi API đơn hàng              | eval `cc-order-denied`, `cc-plan-denied`; E2E test 2 (API trực tiếp, trace rỗng)                              |
| 4     | factory_accountant hỏi giá bán                    | eval `fa-price-hidden`, `fa-receivables-denied`; E2E test 3                                                   |
| 5     | Đổi ID/scope                                      | eval `wm-order-other-unit` (PERMISSION_DENIED ở server)                                                       |
| 6     | Thu hồi quyền                                     | eval `revoked-no-tools`; guard so `authzVersion` mỗi lượt (có sẵn)                                            |
| 7     | Prompt injection chat và dữ liệu                  | eval `dir-injection-chat`, `dir-injected-task-title`; E2E test 9                                              |
| 8     | Không tồn tại / DB lỗi                            | eval `dir-order-not-found`; `assistant-chat.test.ts` UNAVAILABLE                                              |
| 9     | Hai đối tượng giống tên                           | eval `dir-ambiguous-customer` (không gọi tool ghi)                                                            |
| 10    | Timeout                                           | `assistant-chat.test.ts` PROVIDER_TIMEOUT, không ghi gì                                                       |
| 11    | Thiếu dữ liệu lập kế hoạch                        | `assistant-planning.test.ts` assumptions                                                                      |
| 12    | Phụ thuộc vòng / hạn mâu thuẫn                    | `assistant-planning.test.ts` validatePlanItems                                                                |
| 13    | Duyệt hai lần / đồng thời                         | `assistant-proposals.test.ts`; E2E test 5                                                                     |
| 14    | Dữ liệu nguồn đổi                                 | `assistant-proposals.test.ts` SOURCE_CHANGED → expired                                                        |
| 15    | Hai người cập nhật một việc                       | revision-conditional update (`TaskCommandService`, test REVISION_CONFLICT)                                    |
| 16–18 | Công nợ fixture, payment hủy/hoàn, nhiều currency | `finance-fixture-receivables.test.ts` (120M − 50M = 70M; giảm trừ qua void+phát hành lại → 65M; USD tách VND) |
| 19–21 | Import file/OCR                                   | **Không làm** — dự án chưa có import bảng biểu; xem mục 9                                                     |
| 22    | Job chạy lặp/đồng thời                            | dedupeKey unique + claimDue atomic; E2E test 8 (lần 2 tạo 0)                                                  |
| 23    | Việc xong/đổi hạn không nhắc cũ                   | `notifications-scheduler.test.ts` reminderStillApplies                                                        |
| 24    | Biên ngày 23:59/00:00                             | `tasks-policy.test.ts`, `notifications-scheduler.test.ts`                                                     |
| 25    | Provider nhận nhưng timeout                       | Zalo client trả `UNKNOWN` retryable; email dùng idempotencyKey                                                |
| 26    | Thiếu cấu hình/token/rate limit                   | `zalo-webhook.test.ts`; email channel phân loại lỗi vĩnh viễn                                                 |
| 27    | Webhook giả/replay                                | `zalo-webhook.test.ts`; route dedupe msg_id                                                                   |
| 28    | Giả danh bằng display name                        | liên kết chỉ theo mã; `extractVerificationCode` bỏ qua tên                                                    |
| 29    | Nhóm không hỗ trợ                                 | không giả tích hợp; ghi rõ mục 6                                                                              |
| 30    | Link thông báo trên mobile                        | E2E mobile: redirect sign-in → mở đúng task                                                                   |
| 31    | Lưu xong refresh                                  | E2E test 4, 6                                                                                                 |
| 32    | Hồi quy phần dùng chung                           | toàn bộ 389 test cũ vẫn pass; E2E các trang cũ vẫn 200                                                        |

## 8. Hướng dẫn chạy thử (dữ liệu tổng hợp có nhãn)

1. `.env` có `MONGODB_URI`, `AUTH_SECRET`, `DEV_LOGIN_PASSWORD`. Chạy
   `npm run seed`, `npm run migrate`.
2. Khởi động: `AI_PROVIDER=mock NOTIFICATION_DELIVERY=off npm run dev`
   (hoặc đặt `ANTHROPIC_API_KEY` và bỏ `AI_PROVIDER` để dùng mô hình thật).
3. Tạo đơn thử: dùng `/admin/orders/new` hoặc script fixture (mã
   `RD-20260906-E2E1`, khách "E2E AI Khách Kế Hoạch"). Mọi bản ghi thử có
   tiền tố `E2E`.
4. Đăng nhập `company_accountant` → Trợ lý AI → "Lập kế hoạch cho đơn RD-…"
   → xem giả định → "Duyệt và tạo việc" → Việc cần làm.
5. Đăng nhập `factory_manager` / `warehouse_manager` → Việc cần làm → "Xong".
6. Đăng nhập `admin` → "Chạy nhắc việc ngay" → xem bảng intent (skipped
   `DELIVERY_OFF`); `/admin/settings` xem trạng thái cấu hình.
7. Đăng nhập `content_creator` → Trợ lý chỉ trả lời về nội dung; hỏi đơn
   hàng → từ chối.
8. Dọn: `E2E_AI_ORDER_CODE=RD-20260906-E2E1 npx tsx --env-file-if-exists=.env --conditions=react-server <scratch>/e2e-ai-fixture.ts --cleanup`
   (script nằm ngoài repo; có thể xóa tay theo mã đơn).

## 9. Chưa làm / cần quyết định

- **Import bảng biểu (Excel/CSV/PDF/ảnh, OCR)**: dự án chưa có form vận
  hành hay parser nào (`operationalForms` toàn bộ `planned`); không có gì để
  tái sử dụng nên không dựng. Cần chọn biểu mẫu đầu tiên và mẫu file thật.
- **Cấp `tasks.approvePlan`**: hiện DIRECTOR, COMPANY_ACCOUNTANT (toàn hệ
  thống) và FACTORY_MANAGER (đơn vị của mình). Xác nhận hoặc thu hẹp.
- **CONTENT_CREATOR** không có việc cần làm (seed role này bắt buộc scope
  `all`, nên cấp `tasks.*` sẽ lộ việc của đơn hàng). Nếu cần, phải quyết định
  mô hình quyền riêng.
- **Zalo**: cần OA, `ZALO_*`, xác minh tài liệu chính thức; quyết định có
  dùng ZNS/nhóm hay không.
- **Gửi thật**: cần địa chỉ test (`NOTIFICATION_TEST_RECIPIENT`) và quyết
  định chuyển `NOTIFICATION_DELIVERY=live`; Resend đang dùng sender sandbox.
- **Khóa AI**: cần `ANTHROPIC_API_KEY` của công ty để chạy eval live và dùng
  thật; chi phí theo usage (route ghi `usage` vào audit mỗi lượt).
- Dev preview: mọi grant dev là global nên vai trò theo đơn vị nhìn thấy mọi
  đơn trên máy dev; hành vi theo đơn vị được chứng minh bằng eval
  `wm-order-other-unit`, chưa bằng E2E (chưa có màn hình cấp grant theo đơn vị).
