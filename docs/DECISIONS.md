# Architecture Decision Records

Cập nhật lần cuối: 2026-08-24.

Tài liệu này ghi lại các quyết định có ảnh hưởng dài hạn đến Red Door / Lacquerwares Platform. Mỗi thay đổi làm đảo ngược một quyết định bên dưới phải đi qua pull request, cập nhật ADR liên quan và mô tả phương án migration/rollback.

## ADR-001 — Next.js 16.3.2, React 19 và Node.js LTS

**Trạng thái:** Chấp nhận, kèm cổng kiểm tra bảo mật bắt buộc tại ADR-010.

### Bối cảnh

Ứng dụng cần public site có SEO/ISR, admin động, Route Handlers, Server Components và khả năng triển khai serverless trên Vercel. Tại ngày chốt kiến trúc, `next@16.3.2` và `react@19.2.8` là các bản stable tương thích; Next.js yêu cầu Node.js từ 20.9, còn Mongoose 9 nâng mức tối thiểu lên Node.js 20.19.

### Quyết định

- Dùng Next.js App Router 16.3.2 với React và React DOM 19.2.8.
- Ghim exact `next`, `react`, `react-dom` và `eslint-config-next`; commit `package-lock.json` và dùng `npm ci` trong CI.
- Chuẩn hóa môi trường phát triển/CI/production trên Node.js 24 LTS. Không dùng một bản Node lẻ khác với CI nếu chưa có compatibility run.
- Server Components là mặc định. Chỉ thêm `"use client"` tại ranh giới thật sự cần state, browser API, chart, animation hoặc page flip.
- Các module Mongoose, Cloudinary signing, XLSX và PDF chỉ chạy trong Node runtime; không đưa vào Edge bundle.
- API công khai và admin không dựa vào experimental Next.js API nếu chưa có ADR riêng.

### Hệ quả

- Có thể dùng React 19 và mô hình render/caching hiện hành của Next 16, nhưng mọi snippet từ Next 14/15 phải được đối chiếu với tài liệu đi kèm phiên bản đã cài.
- Nâng minor/major Next hoặc React cần chạy lại lint, typecheck, unit/integration, build và Playwright.
- Patch bảo mật có thể buộc nâng phiên bản ngoài chu kỳ release thông thường.

## ADR-002 — Auth.js stable v4, JWT session và RBAC từ MongoDB

**Trạng thái:** Chấp nhận.

### Bối cảnh

Auth.js/NextAuth v5 vẫn là beta tại thời điểm quyết định. Ứng dụng chỉ dùng Google để xác thực danh tính, trong khi quyền nghiệp vụ, phạm vi đơn vị và trạng thái đình chỉ thuộc dữ liệu nội bộ.

### Quyết định

- Dùng `next-auth@4.24.15` stable và API của v4; không trộn API `auth()` của v5 beta.
- Google là identity provider duy nhất. Đăng nhập Google thành công không đồng nghĩa có quyền admin.
- Dùng JWT session để tránh collection session và adapter không cần thiết. JWT mang định danh tối thiểu; MongoDB `User`, role, permission, business-unit scope và trạng thái suspension là nguồn sự thật về authorization.
- Mọi Route Handler, Server Action và server-rendered admin route đều kiểm tra session và permission phía server. Với thao tác nhạy cảm, đọc lại user/permission từ MongoDB hoặc kiểm tra `permissionVersion`; không tin role cũ trong một JWT dài hạn.
- User hợp lệ trên Google nhưng chưa được mời nhận trạng thái `Access pending` và không được đọc dữ liệu admin.
- `ADMIN_EMAILS` chỉ là cơ chế bootstrap một lần. Sau khi Super Admin đầu tiên đã được lưu và xác minh, phải xóa biến này ở Local/Preview/Production theo quy trình trong `DEPLOYMENT.md`.
- Audit login, logout, authorization failure, role/permission change, suspension và hành động bootstrap.

### Hệ quả

- Không cần `@auth/mongodb-adapter` cho session JWT.
- Thay đổi quyền có hiệu lực ở lần kiểm tra server kế tiếp, thay vì chờ JWT hết hạn.
- Auth v5 chỉ được xem xét sau khi có stable release và một ADR migration riêng.

## ADR-003 — Tailwind CSS 4 và UI sở hữu trong source

**Trạng thái:** Chấp nhận.

### Bối cảnh

Sản phẩm cần design system nhất quán nhưng không phụ thuộc một component runtime thương mại hoặc một package UI khó tùy biến. Tailwind 4 và shadcn/ui hỗ trợ React 19; shadcn phân phối source code thay vì runtime black box.

### Quyết định

- Dùng Tailwind CSS 4 qua `@tailwindcss/postcss` và cú pháp `@import "tailwindcss"`.
- Component shadcn/ui được copy vào repository và được xem là source của dự án. Mọi thay đổi từ CLI phải được review như code nội bộ.
- Token màu, typography, spacing, radius, shadow, focus ring và motion nằm trong lớp theme dùng chung; không rải magic values giữa các page.
- Ưu tiên semantic component variants và utility composition; không tạo một abstraction component nếu nó chỉ bọc một thẻ mà không thêm hành vi hoặc tính nhất quán.
- Tất cả component tương tác phải hỗ trợ keyboard, focus-visible, reduced motion và contrast. Animation utility dùng `tw-animate-css` khi cần; không thêm `tailwindcss-animate` cũ.

### Hệ quả

- Dự án sở hữu trách nhiệm accessibility và việc cập nhật các component đã copy.
- Hướng dẫn/config Tailwind v3 không được dùng nguyên trạng.
- UI không bị khóa vào một vendor runtime và có thể được kiểm thử ở cấp source.

## ADR-004 — Page flip sau adapter, luôn có trải nghiệm fallback

**Trạng thái:** Chấp nhận có điều kiện.

### Bối cảnh

`page-flip` cung cấp hiệu ứng catalogue mong muốn nhưng thư viện ít được duy trì, phụ thuộc DOM và có rủi ro về resize, touch, trang cuối cũng như React lifecycle. Landing page HTML vẫn phải tồn tại độc lập cho SEO và accessibility.

### Quyết định

- Dùng trực tiếp `page-flip`, không dùng wrapper `react-pageflip` cũ.
- Chỉ một adapter nội bộ được phép import package. Adapter chịu trách nhiệm dynamic import sau mount, khởi tạo, resize, chuyển trang, event cleanup và `destroy()` khi unmount.
- Flipbook là progressive enhancement trong Client Component, lazy-load dưới fold và không phải nguồn nội dung duy nhất.
- Luôn có fallback cuộn dọc/thumbnail list cho mobile yếu, lỗi JavaScript, reduced motion, screen reader và khi asset PDF/page chưa sẵn sàng.
- Test tối thiểu: 1/2/nhiều trang, odd/even last spread, resize/orientation, keyboard, touch, tải chậm, asset lỗi và cleanup khi điều hướng.
- Metadata/version của collection nằm ở MongoDB; page image/PDF nằm ở Cloudinary. Adapter không tự tạo URL tùy ý mà dùng media URL builder chung.

### Hệ quả

- Có thể thay thư viện mà không đổi domain/UI contract.
- Chi phí có thêm adapter và fallback, nhưng lỗi thư viện không làm mất nội dung catalogue.
- Mọi upgrade `page-flip` phải chạy lại bộ Playwright dành cho flipbook.

## ADR-005 — SheetJS CE 0.20.3 được vendor từ nguồn chính thức

**Trạng thái:** Chấp nhận.

### Bối cảnh

Package `xlsx` trên public npm registry dừng ở 0.18.5 và không phải nguồn phát hành hiện hành của SheetJS CE. SheetJS công bố tarball 0.20.3 trên CDN chính thức và khuyến nghị vendoring để tránh phụ thuộc hạ tầng phân phối lúc cài đặt.

### Quyết định

- Dùng tarball chính thức `xlsx-0.20.3.tgz`, lưu tại `vendor/` và khai báo dependency `file:vendor/xlsx-0.20.3.tgz`.
- Commit tarball và lockfile. Lưu checksum/source/version trong `vendor/README.md`; không thay binary nếu không có review nguồn và checksum.
- XLSX chỉ được parse/generate phía server trong Node runtime.
- Import phải giới hạn bytes, số sheet, row, column/cell; validate toàn bộ và hiển thị preview/error theo dòng trước khi commit dữ liệu.
- Không partial-write một workbook lỗi. Với batch lớn, dùng staging/import job và idempotency key.
- Không thực thi macro, formula hoặc external link từ workbook như code/URL đáng tin.

### Hệ quả

- Cài đặt reproducible và không lấy nhầm bản npm cũ.
- Việc nâng SheetJS là thao tác chủ động, không tự trôi theo semver.
- Repository lớn hơn một tarball nhỏ nhưng giảm supply-chain ambiguity.

## ADR-006 — React Email v6, Resend và transactional outbox

**Trạng thái:** Chấp nhận.

### Bối cảnh

Ứng dụng cần email giao dịch cho quote, invitation, order/report và notification. Gửi email trực tiếp trong request nghiệp vụ có thể làm mất dữ liệu hoặc gửi trùng khi provider timeout.

### Quyết định

- Dùng React Email v6 với import component/render từ `react-email`; không thêm các package components/render tách rời của API cũ.
- Dùng SDK `resend` phía server. API key và sender configuration không bao giờ vào client bundle.
- Nghiệp vụ quan trọng lưu bản ghi và outbox trong MongoDB trước; worker/cron gửi theo idempotency key, ghi provider message ID, attempt, last error và retry schedule.
- Template được version hóa, có plain-text alternative, locale rõ ràng và test render/snapshot cho dữ liệu biên.
- Request thành công không bị rollback chỉ vì Resend tạm lỗi; UI thể hiện trạng thái email pending/failed và admin có manual retry.

### Hệ quả

- Email đạt at-least-once delivery, vì vậy idempotency/deduplication là bắt buộc.
- Cần cron hoặc manual worker để drain outbox.
- Domain gửi phải hoàn tất SPF/DKIM và quy trình DNS trong `DEPLOYMENT.md`.

## ADR-007 — Sinh PDF bằng @react-pdf/renderer

**Trạng thái:** Chấp nhận.

### Bối cảnh

Quote, invoice, packing/shipping và report cần PDF có layout kiểm soát, hỗ trợ template React/TypeScript và tiếng Việt. Browser-only rendering gây khác biệt font và không phù hợp workflow server.

### Quyết định

- Dùng `@react-pdf/renderer` v4 cho PDF tạo mới; phiên bản resolved được khóa bởi lockfile và upgrade qua PR có golden tests.
- Template PDF là code server-only. Render buffer/stream trong Node runtime hoặc background job; không dùng Edge.
- Đăng ký font được phép sử dụng, có glyph tiếng Việt và nhúng nhất quán. Không kéo font tùy ý từ mạng trong lúc render production.
- Version template và snapshot dữ liệu nghiệp vụ tại thời điểm phát hành tài liệu. PDF đã phát hành là immutable; bản sửa tạo document version mới.
- Lưu PDF binary trên Cloudinary và metadata/checksum/publicId/version trong MongoDB.
- Chỉ thêm `pdf-lib` sau này nếu có nhu cầu merge/stamp/fill PDF có sẵn; nó không thay thế layout engine chính.

### Hệ quả

- PDF có thể tái tạo và test được, nhưng render tốn CPU/memory nên cần giới hạn concurrency/timeout.
- Font, page break và rounding tiền phải có golden tests trước release.

## ADR-008 — Repository contract tách Demo và MongoDB

**Trạng thái:** Chấp nhận.

### Bối cảnh

Giao diện cần phát triển/test khi chưa có external services, nhưng production phải dùng dữ liệu thật, không được âm thầm hiển thị dữ liệu bịa khi MongoDB lỗi.

### Quyết định

- Domain/application layer phụ thuộc repository interfaces, không import Mongoose trực tiếp từ UI.
- `Mongo*Repository` là implementation duy nhất được phép ở production.
- `Demo*Repository` chỉ được inject tường minh trong development, Storybook/test hoặc một demo deployment được gắn nhãn rõ `DEMO`; dữ liệu demo cũng phải có marker `DEMO`.
- Production thiếu `MONGODB_URI` hoặc không kết nối được phải fail rõ ràng/health check unhealthy. Không fallback sang in-memory/demo.
- Preview có hai chế độ tách biệt: preview tích hợp dùng database preview riêng; preview UI cô lập dùng demo repository. Không dùng production database mặc định.
- Repository contract dùng domain DTO ổn định; Mongoose document không vượt qua ranh giới repository.

### Hệ quả

- UI/domain test nhanh và ít phụ thuộc hạ tầng.
- Cần contract tests chạy cùng một tập hành vi cho Demo và Mongo implementations.
- Lỗi production không bị che bởi dữ liệu mẫu.

## ADR-009 — Đặt compute và database tại Singapore

**Trạng thái:** Chấp nhận.

### Bối cảnh

Người dùng và vận hành chính ở Việt Nam/Đông Nam Á. Query admin phụ thuộc MongoDB, nên khoảng cách giữa Vercel Functions và Atlas ảnh hưởng lớn hơn vị trí CDN của static assets.

### Quyết định

- Tạo MongoDB Atlas cluster tại region Singapore gần nhất mà plan/provider đã chọn hỗ trợ.
- Đặt Vercel Functions tại `sin1` khi project plan cho phép; route không được tự phân tán sang nhiều region trong khi chỉ có một primary database.
- Static content/image vẫn phân phối toàn cầu qua Vercel/Cloudinary CDN.
- Cron và background operation chạy cùng region với database khi có lựa chọn.
- Ghi lại region/provider thực tế và các cam kết data residency của Atlas, Cloudinary, Resend trong hồ sơ vận hành; không suy diễn CDN region thành nơi lưu dữ liệu.

### Hệ quả

- Giảm latency DB cho luồng chính và đơn giản connection behavior.
- Nếu `sin1` không có trên plan hiện tại, deployment phải ghi rõ region thực tế và đo latency trước khi chấp nhận; không âm thầm bỏ qua.
- Chuyển Atlas region sau này cần kế hoạch migration, maintenance window và restore test.

## ADR-010 — Cổng bảo mật Next.js ngày 2026-08-26

**Trạng thái:** Chấp nhận — blocking release gate.

### Bối cảnh

Ngày 2026-08-20, Next.js thông báo sẽ phát hành bản vá ngày 2026-08-26 cho nhánh 16.3/15.5 để xử lý một lỗ hổng mức critical. Tại thời điểm scaffold ngày 2026-08-24, `16.3.2` vẫn là latest nhưng không thể được coi là phiên bản production cuối cùng.

### Quyết định

- Không go-live production trên `next@16.3.2` nếu chưa hoàn tất recheck sau khi bản tin ngày 2026-08-26 được công bố.
- Người release phải đọc advisory chính thức, xác định patched version cho nhánh 16.3, nâng exact `next` và `eslint-config-next`, tạo lockfile mới và ghi phiên bản/advisory vào release notes.
- Chạy lại lint, typecheck, Vitest, build, Playwright, auth, upload, PDF/XLSX và smoke test trên preview; sau đó redeploy production, không chỉ đổi lockfile.
- Nếu upstream lùi ngày hoặc chưa phát hành, production release tiếp tục bị chặn hoặc phải có risk acceptance bằng văn bản từ owner; không tự suy đoán 16.3.2 đã an toàn.
- Sau cột mốc này, vẫn theo dõi Next.js security advisories và xử lý critical/high ngoài chu kỳ thông thường.

### Hệ quả

- Có thể làm chậm go-live tối thiểu đến khi có patch và verification.
- Tránh phát hành một phiên bản đã biết sắp có critical fix.
- Checklist thực thi nằm trong `DEPLOYMENT.md` và phải lưu evidence trong release/incident record.
