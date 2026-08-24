# Deployment Runbook

Cập nhật lần cuối: 2026-08-24. Mục tiêu production: Vercel Functions tại Singapore (`sin1`) kết nối MongoDB Atlas tại Singapore; static/media được phân phối qua CDN.

Tài liệu này là runbook, không phải bằng chứng rằng dịch vụ đã được cấu hình. Đánh dấu checklist và lưu link/evidence trong release record. Không dán secret, connection string, token DNS hoặc bản export credentials vào issue, pull request, log, ảnh chụp màn hình hay repository.

## 1. Cổng go-live

Production chỉ được mở khi tất cả mục sau đạt:

- [ ] ADR-010 đã hoàn tất: kiểm tra advisory Next.js ngày 2026-08-26, nâng lên patched version của nhánh 16.3 và lưu kết quả test.
- [ ] `npm ci`, lint, typecheck, Vitest và production build thành công từ clean checkout.
- [ ] Playwright/smoke test chạy trên Preview có cấu hình gần production.
- [ ] Atlas, Cloudinary, Google OAuth, Resend và Vercel dùng resource production riêng; không dùng tài khoản/dataset cá nhân hoặc development.
- [ ] Domain chính, redirect apex/`www`, TLS, Google callback và email DNS đã được xác minh.
- [ ] Super Admin đầu tiên đã được kiểm tra, sau đó `ADMIN_EMAILS` đã được xóa theo mục 10.
- [ ] Cron có authentication, idempotency, monitoring; hoặc manual fallback đã được owner xác nhận.
- [ ] Backup ban đầu và ít nhất một restore drill vào môi trường cô lập đã thành công.
- [ ] Owner, RPO, RTO, contact khi sự cố và quyền truy cập break-glass đã được ghi trong hệ thống nội bộ.

## 2. Topology và môi trường

### Production

- Vercel project production phục vụ domain chính.
- Vercel Functions ưu tiên `sin1`.
- Atlas production cluster/database ở Singapore gần nhất được plan hỗ trợ.
- Cloudinary production folder namespace riêng.
- Google OAuth production client chỉ chứa origin/callback production đã duyệt.
- Resend production API key và verified sending domain.

### Preview

- Dùng secrets/resource preview riêng. Không kết nối production Atlas mặc định.
- Google không hỗ trợ callback wildcard tùy ý; dùng một staging/preview domain ổn định đã được khai báo, hoặc mock auth trong ephemeral previews.
- Email preview gửi vào danh sách nội bộ/sandbox và phải được đánh dấu rõ; không gửi khách hàng thật.
- Cloudinary dùng folder prefix preview và có cleanup job.

### Local/Test

- Secrets chỉ nằm trong `.env.local` không commit hoặc secret manager của CI.
- Google callback local dùng site URL local và path `/api/auth/callback/google` đã đăng ký trên OAuth client development.
- Unit/integration không phụ thuộc Google/Cloudinary/Resend thật; dùng fake adapter ở test boundary, không fake authorization logic.

## 3. Biến môi trường và quản lý secret

Nhập giá trị thật trực tiếp trong Vercel Environment Variables và secret manager nội bộ. Không tạo giá trị mẫu trong repository. Một biến có prefix `NEXT_PUBLIC_` sẽ xuất hiện trong client bundle và tuyệt đối không được chứa secret.

| Biến                                   | Phạm vi                                   | Nguồn / yêu cầu                                                         |
| -------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | Public, mỗi environment                   | Canonical origin thực tế của environment, không có path cuối            |
| `MONGODB_URI`                          | Server secret, bắt buộc                   | Atlas connection string của DB user ứng dụng                            |
| `MONGODB_DB_NAME`                      | Server config, bắt buộc                   | Tên database thực tế; giữ tách biệt production/preview                  |
| `AUTH_SECRET`                          | Server secret, bắt buộc                   | Chuỗi ngẫu nhiên CSPRNG tối thiểu 32 bytes, độc lập với mọi secret khác |
| `AUTH_GOOGLE_ID`                       | Server config, bắt buộc cho auth          | OAuth client ID từ Google Cloud Console                                 |
| `AUTH_GOOGLE_SECRET`                   | Server secret, bắt buộc cho auth          | OAuth client secret từ Google Cloud Console                             |
| `ADMIN_EMAILS`                         | Server secret tạm thời                    | Chỉ đặt trong bootstrap window; phải xóa sau mục 10                     |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`    | Public                                    | Cloud name của Cloudinary production/preview tương ứng                  |
| `CLOUDINARY_API_KEY`                   | Server config nhạy cảm                    | API key của Cloudinary, không dùng ở client dù không phải API secret    |
| `CLOUDINARY_API_SECRET`                | Server secret, bắt buộc cho signed upload | API secret từ Cloudinary; không bao giờ expose/log                      |
| `CLOUDINARY_UPLOAD_FOLDER`             | Server config                             | Root folder production/preview thực tế                                  |
| `MAX_PDF_UPLOAD_MB`                    | Server/public validation config           | Giới hạn đã được owner phê duyệt; client và server dùng cùng policy     |
| `RESEND_API_KEY`                       | Server secret                             | API key giới hạn cho ứng dụng/environment này                           |
| `EMAIL_FROM`                           | Server config                             | Sender thuộc domain đã verify; không nhập trước khi DNS pass            |
| `ORDER_NOTIFICATION_EMAILS`            | Server config nhạy cảm                    | Danh sách mailbox vận hành thật, được owner xác nhận                    |
| `CRON_SECRET`                          | Server secret                             | Secret CSPRNG riêng; không tái dùng `AUTH_SECRET`                       |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Public, optional                          | Token thật từ Search Console; bỏ biến nếu chưa cấu hình                 |
| `NEXT_PUBLIC_GA_ID`                    | Public, optional                          | Chỉ đặt khi analytics và consent flow đã được duyệt                     |

Quy tắc vận hành:

- Tách giá trị Development, Preview và Production trong Vercel; không bật cùng một secret cho cả ba nếu không cần.
- Sau khi thay secret, redeploy environment liên quan vì deployment cũ vẫn giữ snapshot env cũ.
- Rotation phải có owner, ngày hết hạn/review và kế hoạch dual-key nếu provider hỗ trợ.
- Log chỉ ghi provider/request ID và lỗi đã lọc; không log URI, authorization header, signed upload payload đầy đủ hoặc email recipient list.
- Không thêm alias `NEXTAUTH_*` trừ khi env schema/code thực sự sử dụng. Với NextAuth v4, ứng dụng phải truyền các biến `AUTH_*` đã validate vào cấu hình một cách tường minh.

## 4. MongoDB Atlas

### Provision

- [ ] Tạo Atlas project/cluster production dưới organization của doanh nghiệp, bật MFA và tối thiểu hai owner phù hợp.
- [ ] Chọn region Singapore gần nhất mà provider/plan hỗ trợ; ghi chính xác provider, region code và tier vào release record.
- [ ] Tạo database user riêng cho ứng dụng, quyền tối thiểu trên đúng production database. Không dùng Atlas organization owner hoặc personal user trong URI.
- [ ] Lưu `MONGODB_URI` và `MONGODB_DB_NAME` vào Vercel Production; không lưu URI trong file hoặc command history chia sẻ.
- [ ] Network Access ưu tiên Vercel/Atlas integration hoặc fixed egress nếu plan có. Nếu free/serverless plan buộc mở nguồn động, việc dùng allow-list rộng phải được chấp nhận rõ, đi kèm TLS, credential mạnh/riêng, least privilege, rotation và alert; không coi allow-list rộng là lớp bảo mật duy nhất.
- [ ] Bật alerts cho connection spike, storage, query latency, auth failure và resource saturation trong giới hạn plan.
- [ ] Chạy migration/index sync được review. Không bật `autoIndex` production như một thay thế cho migration có kiểm soát.

### Verify

- [ ] Từ Vercel Preview cùng region, chạy health check server-only và xác nhận database name/region đúng mà không in URI.
- [ ] Xác nhận connection caching qua nhiều request và không tạo connection storm khi scale.
- [ ] Kiểm tra unique/index cho slug+locale, SKU, document/order numbers, status/date, TTL counters và foreign references thường query.
- [ ] Chạy một transaction canary nếu workflow dựa vào transaction; nếu tier/topology không hỗ trợ, xác nhận compensation path đã test.
- [ ] Xác nhận không có binary media/PDF trong MongoDB.

## 5. Cloudinary

### Provision và policy

- [ ] Tạo/đặt ownership Cloudinary account cho doanh nghiệp, bật MFA và giới hạn thành viên.
- [ ] Lưu cloud name, API key, API secret và upload root tương ứng vào đúng Vercel environment.
- [ ] Admin upload chỉ dùng signed upload. Quote attachment dùng policy/preset hạn chế riêng; không bật unsigned preset rộng.
- [ ] Giới hạn resource type, MIME/format, bytes, dimensions/page count và folder server-side. Client validation chỉ hỗ trợ UX.
- [ ] Dùng folder convention `reddoor/products`, `reddoor/collections`, `reddoor/news`, `reddoor/process`, `reddoor/documents` và `reddoor/temp`, với prefix environment nếu dùng chung account.
- [ ] Cấu hình `next/image` remote patterns đúng Cloudinary host và dùng một URL builder thống nhất để giới hạn transformation variants.

### Verify

- [ ] Browser lấy signed parameters từ một authenticated server route rồi upload trực tiếp Cloudinary; Vercel không proxy toàn bộ binary.
- [ ] Chữ ký hết hạn, folder/public ID bị ràng buộc và user không thể ký asset ngoài permission.
- [ ] MongoDB lưu `publicId`, resource type, version, dimensions, format, bytes và metadata cần thiết; URL không phải định danh duy nhất.
- [ ] DB save lỗi sau upload tạo compensation cleanup hoặc orphan record; cleanup cron chạy idempotent.
- [ ] Delete kiểm tra references và soft-delete trước; asset đang được dùng không bị xóa vật lý.
- [ ] Ghi rõ data center/storage policy thực tế của account; không suy diễn CDN edge là nơi lưu dữ liệu gốc.

## 6. Google OAuth / Auth.js

- [ ] Tạo OAuth consent screen dưới Google Cloud project của doanh nghiệp; khai báo app name, support email, privacy/terms domain thật và publishing status phù hợp.
- [ ] Tạo Web application OAuth client riêng cho Production và Development/Staging.
- [ ] Thêm canonical production origin vào Authorized JavaScript origins nếu console yêu cầu.
- [ ] Thêm callback bằng canonical site origin cộng chính xác path `/api/auth/callback/google` vào Authorized redirect URIs.
- [ ] Không dùng wildcard callback. Khi domain đổi, cập nhật Google trước hoặc trong cùng change window.
- [ ] Lưu client ID/secret vào đúng Vercel environment và redeploy.
- [ ] Xác nhận user Google hợp lệ nhưng không có Mongo permission chỉ thấy `Access pending`.
- [ ] Xác nhận suspended user, role scope và authorization failure được enforce server-side, kể cả khi gọi API trực tiếp.
- [ ] Kiểm tra audit log không chứa OAuth code/token/secret.

Nếu consent screen ở Testing, quản lý danh sách test users và giới hạn đó như một trạng thái tạm; production go-live phải dùng publishing/verification phù hợp với scope đang yêu cầu.

## 7. Resend và DNS email

- [ ] Add sending domain thực tế trong Resend.
- [ ] Tạo đúng các TXT/CNAME/MX mà Resend dashboard cung cấp. Không dùng giá trị DNS từ tài liệu mẫu hoặc environment khác.
- [ ] Chờ Resend xác nhận SPF/DKIM trước khi đặt `EMAIL_FROM` production.
- [ ] Thiết lập DMARC trên domain thật; bắt đầu policy theo mức owner chấp nhận, theo dõi aggregate reports rồi mới tăng enforcement.
- [ ] Tạo API key riêng cho production với quyền tối thiểu có thể; lưu vào Vercel và secret manager.
- [ ] Gửi canary tới mailbox thuộc các nhà cung cấp chính, kiểm tra From/Reply-To, tiếng Việt, text alternative, link, SPF/DKIM/DMARC và spam placement.
- [ ] Xác nhận quote/order được ghi DB và outbox trước khi gọi Resend; provider timeout không làm mất nghiệp vụ.
- [ ] Xác nhận retry có backoff/idempotency, manual retry hoạt động và không gửi trùng sau timeout.
- [ ] Thiết lập handling cho bounce/complaint nếu feature gửi ra khách hàng được bật.

## 8. Vercel tại `sin1`

### Project setup

- [ ] Import đúng Git repository/production branch vào Vercel team của doanh nghiệp.
- [ ] Framework preset là Next.js, install command dùng `npm ci`, Node runtime là Node.js 24 LTS.
- [ ] Chọn Function Region Singapore `sin1` trong Project Settings nếu plan hỗ trợ. Nếu cấu hình bằng code, kiểm tra route thực tế resolve về `sin1`; không chỉ dựa vào comment/config chưa deploy.
- [ ] Nếu plan không hỗ trợ `sin1`, ghi region thực tế, đo latency Vercel→Atlas và nhận risk acceptance trước go-live.
- [ ] Nhập env theo mục 3 với đúng scope, sau đó tạo deployment mới.
- [ ] Bật deployment protection cho Preview có dữ liệu tích hợp và giới hạn ai có thể promote Production.

### Build gate

Chạy từ clean checkout với đúng Node version:

```text
npm ci
npm run lint
npx tsc --noEmit
npx vitest run
npm run build
```

Sau khi Preview được tạo, chạy Playwright/smoke tests với base URL của deployment đó. Không đưa Google/Cloudinary/Resend thật vào CI test; các canary tích hợp production là bước có kiểm soát riêng.

### Runtime verify

- [ ] Public page, sitemap/robots/canonical/locale và ISR/revalidation hoạt động.
- [ ] Admin page là dynamic/no-store ở dữ liệu nhạy cảm; không rò user data vào public cache.
- [ ] Database, Cloudinary signing, XLSX và PDF routes chạy Node runtime tại region dự kiến.
- [ ] Security headers/CSP cho Google và Cloudinary pass mà không dùng wildcard quá rộng.
- [ ] Logs không chứa secret/PII không cần thiết; error trả client không có stack trace.
- [ ] Rollback deployment Vercel đã được thử trên Preview và không yêu cầu migration DB ngược phá hủy dữ liệu.

## 9. Cron và background jobs

Chỉ khai báo cron cho các Route Handler đã tồn tại và được test. Lưu danh sách route/schedule UTC thực tế trong release record; không copy một schedule mẫu mà chưa đối chiếu múi giờ Asia/Bangkok.

- [ ] Mỗi cron route xác minh `Authorization: Bearer <CRON_SECRET>` bằng so sánh an toàn và trả 401 khi thiếu/sai. Secret thật chỉ nằm trong Vercel.
- [ ] Schedule được viết theo UTC và ghi chú thời gian nghiệp vụ Asia/Bangkok, kể cả tác động khi thay lịch.
- [ ] Job có distributed/idempotency lock trong MongoDB theo job key + logical period; retry hoặc hai invocation đồng thời không tạo report/email/payment trùng.
- [ ] Outbox drain xử lý batch có giới hạn, backoff, max attempts/dead-letter và provider message ID.
- [ ] Daily report dùng business date/timezone rõ ràng; không dùng timezone của process làm mặc định.
- [ ] Orphan Cloudinary cleanup chỉ xóa sau grace period và reference check.
- [ ] Job ghi structured result: started/finished, scanned/succeeded/failed, duration và correlation ID; không ghi secret/payload nhạy cảm.
- [ ] Có alert/manual retry và nút chạy thủ công có RBAC/audit khi cron chưa cấu hình hoặc thất bại.
- [ ] Khi restore/migration/incident, disable cron trước và enable lại sau consistency checks.

## 10. Bootstrap Super Admin và loại bỏ `ADMIN_EMAILS`

`ADMIN_EMAILS` không phải allow-list vận hành lâu dài.

1. Chọn email Google Workspace/corporate thực tế của người nhận vai trò Super Admin và xác minh quyền sở hữu ngoài ứng dụng.
2. Đặt `ADMIN_EMAILS` chỉ trong environment cần bootstrap, deploy trong change window và ghi người phê duyệt.
3. Đăng nhập một lần, xác nhận MongoDB đã có user/role/permission đúng và audit event bootstrap.
4. Đăng xuất/đăng nhập lại; kiểm tra quyền server-side, một route Super Admin và một authorization denial.
5. Tạo ít nhất một phương án break-glass hoặc Super Admin thứ hai theo policy doanh nghiệp để tránh single-person lockout.
6. Xóa hoàn toàn `ADMIN_EMAILS` khỏi Vercel Development/Preview/Production và local shared secrets; không để chuỗi rỗng như một cấu hình vĩnh viễn.
7. Redeploy mọi environment bị ảnh hưởng và xác nhận Super Admin persisted vẫn đăng nhập được.
8. Thử một email khác không được mời và xác nhận chỉ nhận `Access pending`.
9. Kiểm tra logs/audit rồi đóng bootstrap window. Mọi admin sau đó phải qua invite/role workflow có audit.

Nếu bootstrap tạo sai user, không xóa audit/payment/business records để sửa. Suspend/revoke user sai và thực hiện role change có audit bằng Super Admin hợp lệ.

## 11. Domain và DNS web

- [ ] Add apex domain và `www` trong Vercel trước, sau đó tạo chính xác A/CNAME/TXT mà Vercel dashboard hiển thị. Không hard-code IP/CNAME từ một hướng dẫn khác.
- [ ] Chọn một canonical host; redirect host còn lại bằng permanent redirect và đồng bộ `NEXT_PUBLIC_SITE_URL`, metadata, sitemap, Google OAuth và email links.
- [ ] Giảm DNS TTL trước change window nếu domain đang phục vụ hệ thống khác; chỉ nâng lại sau verification.
- [ ] Chờ Vercel cấp TLS, kiểm tra certificate chain/renewal và HTTP→HTTPS.
- [ ] Thêm Search Console verification token thật khi sẵn sàng; bỏ env nếu chưa cấu hình.
- [ ] DNS của Resend được quản lý cùng change record nhưng không xóa record mail hiện hữu nếu chưa đánh giá MX/SPF hiện tại. Một domain chỉ nên có một SPF TXT hợp nhất đúng chuẩn.
- [ ] Kiểm tra DNS từ ít nhất hai resolver và kiểm tra web/auth/email sau propagation.

Thứ tự domain cutover: add/verify domain ở Vercel → cấu hình DNS → chờ TLS → đổi canonical env → cập nhật Google redirect → redeploy → smoke test → bật traffic/redirect.

## 12. Backup, restore và disaster recovery

### Trước go-live

- [ ] Owner phê duyệt RPO/RTO và retention. Không tuyên bố có backup nếu plan chỉ có data redundancy mà không có point-in-time restore.
- [ ] Kiểm tra Atlas tier có managed backup/PITR hay không. Nếu không, thiết lập logical `mongodump` có lịch, encryption và nơi lưu tách khỏi Atlas/Git repository.
- [ ] Chụp logical backup sau migration/seed và trước mỗi migration có rủi ro.
- [ ] Backup source/lockfile, migration version, index definitions và release SHA tương ứng với dữ liệu.
- [ ] Xuất inventory Cloudinary gồm publicId/version/checksum/metadata; bảo vệ originals theo capability của plan. Mongo backup không chứa media binary.
- [ ] Lưu cấu hình DNS, Google OAuth, Resend domain, Vercel project/region/env variable names và Cloudinary policy trong kho vận hành. Secret values ở password/secret manager, không nằm trong bản export tài liệu.
- [ ] Tạo checksum cho backup, mã hóa trước khi đưa off-site và kiểm thử khả năng đọc.

### Checklist backup định kỳ

- [ ] Backup job hoàn tất và kích thước/count hợp lý so với lần trước.
- [ ] Không có URI/secret trong job logs hoặc filename.
- [ ] Checksum/encryption/retention pass; bản quá hạn được xóa theo policy có audit.
- [ ] Có ít nhất một bản ngoài failure domain của production account/region.
- [ ] Alert khi job không chạy, archive rỗng hoặc upload nơi lưu thất bại.
- [ ] Cloudinary orphan/reference report và asset inventory được lưu cùng kỳ.

### Restore drill an toàn

1. Tạo database/cluster tạm, cô lập khỏi production và cron/email thật.
2. Checkout đúng release SHA và migration version đi kèm backup.
3. Restore vào database tạm; không dùng `--drop` trên production để thử nghiệm.
4. Chạy migration forward chỉ khi runbook của migration cho phép và đã sao lưu bản gốc.
5. Rebuild/verify indexes, TTL policies và unique constraints.
6. So sánh collection/document counts, sample references, order/inventory/payment aggregates, audit continuity và Money totals.
7. Kiểm tra các Cloudinary public IDs được tham chiếu; lập danh sách missing asset và khôi phục originals theo capability/backup thực tế.
8. Khởi chạy application cô lập với email/cron/upload bị vô hiệu hoặc trỏ sandbox; chạy auth/RBAC/read-only business smoke tests.
9. Ghi duration, data loss window, lỗi và RPO/RTO thực tế; xóa môi trường tạm theo policy sau khi evidence đã được lưu.

### Khôi phục production khi có sự cố

- [ ] Mở incident, đóng write traffic hoặc maintenance mode và disable cron/outbox sender.
- [ ] Xác định mốc restore và phạm vi ảnh hưởng; lưu forensic snapshot trước mọi thao tác phá hủy.
- [ ] Ưu tiên restore sang cluster/database mới rồi kiểm tra, thay vì ghi đè ngay production.
- [ ] Được hai người phê duyệt trước thao tác destructive hoặc chuyển connection string.
- [ ] Rotate credential bị nghi lộ, cập nhật Vercel và redeploy.
- [ ] Chạy consistency checks, sau đó mở read traffic rồi write traffic có giám sát.
- [ ] Enable cron/outbox sau cùng; deduplicate pending jobs/email trước khi drain.
- [ ] Hoàn thành incident review, xác nhận backup mới và cập nhật runbook.

Vercel rollback chỉ rollback code. Nếu release có schema/data migration, code phải backward-compatible qua change window hoặc có migration/restore plan riêng; không coi “Promote previous deployment” là rollback database.

## 13. Cổng bảo mật Next.js ngày 2026-08-26

Owner release thực hiện sau khi advisory chính thức xuất bản:

- [ ] Đọc thông báo/advisory từ `nextjs.org` hoặc GitHub `vercel/next.js`, không dựa vào bài tổng hợp.
- [ ] Xác định patched version chính xác cho nhánh 16.3 bằng registry/advisory chính thức.
- [ ] Nâng exact `next` và `eslint-config-next`; cập nhật lockfile từ clean install và review transitive diff.
- [ ] Chạy `npm audit` như tín hiệu bổ sung, không thay thế việc đọc advisory.
- [ ] Chạy build gate mục 8 và Playwright cho auth, RBAC, public render/cache, signed upload, XLSX import, PDF render và flipbook.
- [ ] Deploy Preview, smoke test, rồi deploy lại Production; xác nhận runtime version từ build evidence.
- [ ] Lưu patched version, advisory URL, test run, deployment ID, người duyệt và thời điểm hoàn tất.

Nếu patch chưa tồn tại hoặc test không đạt, trạng thái là **blocked**, không phải “đã kiểm tra”.

## 14. Post-deploy verification

- [ ] Canonical domain/TLS/redirect, robots/sitemap và locale đúng.
- [ ] Google login, pending user, authorized role, suspended user và direct API denial đúng.
- [ ] Create/read/update luồng canary không làm bẩn dữ liệu thật; dữ liệu canary được gắn nhãn và cleanup có audit.
- [ ] Cloudinary signed direct upload, transformation, reference check và cleanup path đúng.
- [ ] Quote/request lưu Mongo trước, outbox gửi Resend sau và không gửi trùng.
- [ ] PDF tiếng Việt, XLSX import validation/preview và flipbook fallback hoạt động desktop/mobile.
- [ ] Cron authorization/idempotency và manual retry đúng.
- [ ] Logs/alerts/usage quotas của Vercel, Atlas, Cloudinary và Resend bình thường.
- [ ] Backup đầu tiên sau deploy thành công và có checksum.
- [ ] `ADMIN_EMAILS` không còn trong environment sau bootstrap.

Kết thúc change window chỉ sau khi owner xác nhận checklist và link deployment/release evidence được lưu ngoài repository.
