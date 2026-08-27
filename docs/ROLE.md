# Vai trò và quyền hạn

Trạng thái: bản mô tả đọc-được-bởi-người của cấu hình phân quyền đang chạy.

Nguồn sự thật là code, không phải tài liệu này:

- `src/domains/identity/permissions.ts` — danh mục 193 quyền, quyền bắt buộc phạm vi toàn cục, quyền trường nhạy cảm.
- `src/domains/identity/role-definitions.ts` — 12 vai trò hệ thống và trần quyền của từng vai trò.
- `src/lib/auth/authorization.ts` — thuật toán quyết định cho phép hay từ chối.
- `src/domains/approvals/` — cổng phê duyệt của Giám đốc.
- `src/domains/organization/responsibilities.ts` — vị trí công việc và vai trò gắn kèm.

Khi tài liệu này và code mâu thuẫn, **code đúng**. Tài liệu liên quan: `docs/RBAC.md` (cơ chế phân quyền đầy đủ), `docs/ORGANIZATION.md` (vị trí công việc), `docs/ORDER_WORKFLOW.md` (15 bước đơn hàng).

---

## 1. Một yêu cầu được cho phép khi nào

Đăng nhập chỉ chứng minh danh tính. Cho phép hay không là quyết định riêng, và phải đúng **cả sáu** điều kiện:

1. Phiên đăng nhập hợp lệ và trỏ tới một `User` trong MongoDB.
2. Trạng thái người dùng là `active` (không phải `pending`, không phải `suspended`).
3. Có ít nhất một `AccessGrant` đang hoạt động, chưa hết hạn, sinh ra đúng quyền cần thiết.
4. Phạm vi (scope) của grant phủ được bản ghi đích và mọi đơn vị kinh doanh bị ảnh hưởng.
5. Ràng buộc cấp trường và ràng buộc luồng trạng thái cho phép thao tác.
6. Các kiểm tra phê duyệt, tách biệt trách nhiệm, revision kỳ vọng và lý do đều qua.

Ẩn một nút bấm ở giao diện **không** phải là một quyết định phân quyền.

Mã từ chối có thể trả về: `AUTH_NOT_CONFIGURED`, `UNAUTHENTICATED`, `USER_NOT_FOUND`, `USER_PENDING`, `USER_SUSPENDED`, `STALE_SESSION`, `PERMISSION_DENIED`, `AUTHORIZATION_UNAVAILABLE`.

`ADMIN_EMAILS` chỉ dùng để khởi tạo Super Admin đầu tiên khi hệ thống chưa có Super Admin nào. Nó không bao giờ được dùng như một kiểm tra phân quyền thông thường.

---

## 2. Ba quy tắc công ty đã chốt

Ba quy tắc dưới đây được xác nhận với nhóm làm việc của khách hàng và là lý do tồn tại của phần lớn cấu hình quyền.

**Quy tắc 1 — Giá bán, biên lợi nhuận và lợi nhuận chỉ Giám đốc và Kế toán công ty được xem.**
Đây là các quyền riêng biệt (`*.readSellingPrice`, `finance.readProfit`), không bao giờ được suy ra từ quyền đọc tài nguyên. Đọc được đơn hàng không có nghĩa là đọc được giá bán của đơn hàng đó.

**Quy tắc 2 — Giá mua và dữ liệu vận hành còn lại thì mọi người đều xem được.**
Đọc thì rộng, ghi thì không. Danh sách đọc dùng chung (`sharedOperationalReads`) gồm 16 quyền, được cấp cho hầu hết các vai trò nghiệp vụ:

```
businessUnits.read   products.read        media.read           orders.read
deliveries.read      suppliers.read       procurement.read     procurement.readPrice
inventory.read       production.read      packing.read         shipments.read
documents.read       documents.download   reports.readOperational  approvals.read
```

Cố ý **không** nằm trong danh sách này: giá bán, biên lợi nhuận, lợi nhuận, lương, giá trị tồn kho, và dữ liệu riêng tư của khách hàng.

**Quy tắc 3 — Sửa dữ liệu phải được cấp quyền tường minh, và mọi nghiệp vụ trọng yếu đều cần Giám đốc phê duyệt.**
Khi được hỏi thao tác nào cần Giám đốc duyệt — đơn hàng, giá bán, thay đổi giá, mua nguyên vật liệu, chi phí phát sinh, xuất hàng — câu trả lời là "tất cả". Xem mục 6.

---

## 3. Phạm vi (scope)

Mỗi quyền chỉ có nghĩa khi đi kèm một phạm vi. Thứ tự từ hẹp đến rộng:

```
own  <  assignedBusinessUnits  <  all
```

| Phạm vi                 | Ý nghĩa                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `own`                   | Chỉ bản ghi do chính người đó sở hữu, xác định bằng trường đã lưu đáng tin cậy (`createdBy`, `ownerUserId`, `assigneeIds`). Chủ sở hữu do client gửi lên không bao giờ đủ. Với lệnh tạo, service tự gán chủ sở hữu là người thao tác.                                                                                                                     |
| `assignedBusinessUnits` | Bản ghi thuộc đơn vị kinh doanh mà người đó được cấp grant. Tạo mới: mọi đơn vị yêu cầu phải được phủ. Sửa nhiều đơn vị: mọi đơn vị bị ảnh hưởng phải được phủ. Chuyển kho liên đơn vị: cả nơi đi và nơi đến đều phải được phủ. Danh sách/đọc: repository áp bộ lọc đơn vị **trước** khi truy vấn; bộ lọc từ client chỉ được thu hẹp, không được mở rộng. |
| `all`                   | Không giới hạn theo đơn vị kinh doanh. `all` **không** vượt qua được quyền trường nhạy cảm, luồng trạng thái, quy tắc phê duyệt hay yêu cầu ghi audit.                                                                                                                                                                                                    |

Ba cơ chế điều chỉnh quan trọng, cài trong `authorization.ts` — vai trò định nghĩa **năng lực**, grant định nghĩa **độ phủ**, và bên hẹp hơn thắng theo cả hai chiều:

- Nếu định nghĩa vai trò cho phạm vi `all` nhưng grant lại gắn với một đơn vị kinh doanh cụ thể, phạm vi hiệu lực **bị hạ xuống** `assignedBusinessUnits`. Grant hẹp luôn thắng.
- Ngược lại, một grant toàn cục có chủ đích (`businessUnitId = null`) trên quyền phạm vi `assignedBusinessUnits` phủ **mọi** đơn vị — "đơn vị được cấp" của một grant toàn cục là tất cả. (Bổ sung 2026-08-27, chốt bằng test trong `tests/unit/authorization.test.ts`.)
- Các quyền trong danh sách "bắt buộc toàn cục" chỉ được thỏa mãn bởi grant `all` với `businessUnitId = null`. Grant gắn đơn vị không bao giờ đủ, kể cả khi vai trò có tên quyền đó.

### Quyền bắt buộc phạm vi toàn cục

Đây là các thao tác duyệt, phê chuẩn, xuất bản, rollback và quản trị nền tảng:

```
users.manageSuperAdmin   roles.update              settings.publishPublic   settings.manageSystem
content.review           content.publish           content.archive
translations.review      translations.publish
collections.approve      collections.publish       collections.rollback     collections.archive
products.review          products.publish          products.discontinue     products.archive
samples.approve          samples.reject
quotes.approve           quotes.reject
orders.approve           orders.cancel             orders.close
reports.readConsolidated reports.sendDigest        approvals.decide
```

---

## 4. Quyền trường nhạy cảm

Quyền đọc tài nguyên **không** kéo theo quyền đọc các trường dưới đây. Khi thiếu quyền, server phải lược bỏ hoặc che trường **trước khi** serialize, xuất file, sinh tài liệu, tổng hợp biểu đồ và đánh index tìm kiếm.

| Quyền                       | Bảo vệ trường gì                                                               |
| --------------------------- | ------------------------------------------------------------------------------ |
| `customers.readSensitive`   | Liên hệ riêng, ghi chú, mã số thuế, thông tin định danh xuất nhập khẩu         |
| `orders.readSellingPrice`   | Giá bán, chiết khấu, điều chỉnh thương mại, tổng giá trị đơn                   |
| `quotes.readSellingPrice`   | Đơn giá báo giá, chiết khấu, tổng báo giá                                      |
| `products.readSellingPrice` | Giá bán catalogue và giá niêm yết                                              |
| `products.readCost`         | Giá thành chuẩn/ước tính của sản phẩm và định mức BOM                          |
| `inventory.readValue`       | Giá trị tồn kho (không phải số lượng vật lý)                                   |
| `procurement.readPrice`     | Giá nhà cung cấp, tạm ứng, giá trị hợp đồng                                    |
| `finance.readCost`          | Chi phí vật tư, nhân công, xưởng, vận chuyển, chi phí thực tế                  |
| `finance.readProfit`        | Biên lợi nhuận và lợi nhuận ước tính/thực tế                                   |
| `labor.readSalary`          | Lương, đơn giá công, các trường chi phí lao động mang tính cá nhân             |
| `documents.readSensitive`   | Tài liệu tài chính, bảng lương, chứng từ hải quan nhạy cảm, tài liệu định danh |
| `audit.export`              | Trích xuất hàng loạt nhật ký audit                                             |

---

## 5. Mười hai vai trò hệ thống

Một người có thể giữ nhiều vai trò, và giữ vai trò khác nhau ở các đơn vị kinh doanh khác nhau. Quyền của các vai trò **hợp nhất theo phép hợp**, nhưng mỗi service vẫn áp riêng ràng buộc phạm vi, trường, luồng và tách biệt trách nhiệm.

Bảng tổng quan:

| Mã vai trò           | Tên                         | Số quyền | Phạm vi chủ đạo                       |
| -------------------- | --------------------------- | -------- | ------------------------------------- |
| `SUPER_ADMIN`        | Quản trị hệ thống           | 193      | `all`                                 |
| `DIRECTOR`           | Giám đốc                    | 190      | `all`                                 |
| `COMPANY_ACCOUNTANT` | Kế toán công ty             | 64       | `all`                                 |
| `ORDER_MANAGER`      | Quản lý đơn hàng            | 62       | `assignedBusinessUnits`               |
| `FACTORY_MANAGER`    | Quản lý nhà máy             | 52       | `assignedBusinessUnits`               |
| `WAREHOUSE_MANAGER`  | Thủ kho / Quản lý kho       | 48       | `assignedBusinessUnits`               |
| `FACTORY_ACCOUNTANT` | Kế toán nhà máy             | 37       | `assignedBusinessUnits`               |
| `PRODUCT_DESIGNER`   | Nhân viên thiết kế          | 36       | `assignedBusinessUnits` + `own`       |
| `SUPPLIER_MANAGER`   | Quản lý nhà cung cấp        | 35       | `assignedBusinessUnits`               |
| `CONTENT_EDITOR`     | Biên tập nội dung           | 19       | `all` (đọc) + `own` (ghi)             |
| `PRODUCTION_UNIT`    | Đơn vị sản xuất / Xưởng phụ | 19       | `own` + `assignedBusinessUnits` (hẹp) |
| `REPORT_VIEWER`      | Người xem báo cáo           | 17       | `assignedBusinessUnits`, chỉ đọc      |

---

### 5.1 `SUPER_ADMIN` — Quản trị hệ thống

Thiết lập nền tảng, quản lý người dùng và toàn bộ nghiệp vụ.

**Quyền:** toàn bộ 193 quyền trong danh mục, phạm vi `all`. Đây là vai trò duy nhất giữ trọn danh mục.

**Vẫn bị ràng buộc bởi:** luồng trạng thái, tách biệt trách nhiệm (không tự duyệt yêu cầu do chính mình tạo), và ghi audit. Quyền đầy đủ không có nghĩa là bỏ qua quy trình.

**Riêng vai trò này có:** `users.manageSuperAdmin`, `roles.update`, `settings.manageSystem`, `notifications.manageDeadLetter`.

**Ghi chú:** đây là vai trò quản trị nền tảng, không phải một vị trí trên sơ đồ tổ chức công ty.

---

### 5.2 `DIRECTOR` — Giám đốc

Duyệt toàn bộ nghiệp vụ trọng yếu và xem báo cáo hợp nhất.

**Quyền:** 190 quyền, phạm vi `all` — tức toàn bộ danh mục **trừ ba quyền** dành riêng cho quản trị nền tảng:

```
users.manageSuperAdmin    roles.update    settings.manageSystem
```

**Ý nghĩa của việc loại trừ:** Giám đốc điều hành toàn bộ nghiệp vụ nhưng không tự sửa được định nghĩa vai trò, không tự nâng mình hay người khác lên Super Admin, và không đổi được cấu hình hệ thống. Đây là ranh giới chống leo thang quyền, không phải hạn chế nghiệp vụ.

**Nắm giữ:** `approvals.decide` — cùng với `SUPER_ADMIN`, đây là hai vai trò duy nhất được quyết định một yêu cầu phê duyệt (`approvalDecidingRoleKeys`).

**Cùng Kế toán công ty độc quyền:** `finance.readProfit`, `orders.readSellingPrice`, `quotes.readSellingPrice`, `products.readSellingPrice`.

**Sở hữu dữ liệu:** đơn hàng khách đặt / đã xuất / đã đặt cọc / đã thanh toán; quyết định phê duyệt và lý do từ chối.

---

### 5.3 `COMPANY_ACCOUNTANT` — Kế toán công ty

Kế toán và tài chính, hồ sơ thanh toán, hồ sơ nhập/xuất khẩu, xác nhận lương, báo cáo lãi lỗ hàng tháng.

**64 quyền, gần như toàn bộ ở phạm vi `all`** (trừ `media.updateOwnMetadata` ở phạm vi `own`).

Đọc dùng chung: 16 quyền `sharedOperationalReads`, cộng `settings.read`.

| Nhóm       | Quyền                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| Khách hàng | `customers.read`, `customers.readSensitive`                                                                 |
| Báo giá    | `quotes.read`, `quotes.readSellingPrice`, `quotes.approvePriceAdjustment`                                   |
| Sản phẩm   | `products.readSellingPrice`, `products.readCost`                                                            |
| Đơn hàng   | `orders.readSellingPrice`, `orders.submitForApproval`, `orders.approvePriceAdjustment`                      |
| Mua hàng   | `procurement.approve`, `procurement.cancel`, `procurement.approvePriceChange`, `procurement.approveAdvance` |
| Tồn kho    | `inventory.readValue`, `inventory.approveAdjustment`, `inventory.export`                                    |
| Chi phí    | `expenses.read`, `expenses.approve`, `expenses.reject`, `expenses.post`, `expenses.reverse`                 |
| Thanh toán | `payments.read/record/allocate/reverse/refund`, `receivables.read`, `payables.read`                         |
| Tài chính  | `finance.readCost`, `finance.readProfit`, `finance.manageFxSnapshot`                                        |
| Lương      | `labor.readSalary`, `labor.confirmPayroll`, `production.readLaborQuantity`                                  |
| Chứng từ   | `tradeDocuments.read`, `tradeDocuments.manage`, `documents.generate/readSensitive/import/export`            |
| Báo cáo    | `reports.readConsolidated`, `reports.reviewDaily`                                                           |
| Khác       | `media.upload`, `notifications.retry`, `approvals.request`                                                  |

**Không có:** `approvals.decide`, `orders.approve`, `orders.confirm`, `orders.cancel`, `orders.close`, `quotes.approve`. Kế toán công ty **đề nghị và ghi nhận**, Giám đốc **quyết định**.

**Vị trí trong quy trình đơn hàng:** bước 2 (`fileOpened` — mở hồ sơ và trình Giám đốc), bước 11 (`tradeDocumentation`), bước 14 (`invoiced` — ghi nhận thanh toán).

---

### 5.4 `ORDER_MANAGER` — Quản lý đơn hàng

Khách hàng, yêu cầu báo giá, báo giá và điều phối giao hàng.

**62 quyền**, hầu hết ở phạm vi `assignedBusinessUnits`; riêng `settings.read` ở phạm vi `all`.

| Nhóm                  | Quyền                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đọc dùng chung        | 16 quyền `sharedOperationalReads`                                                                                                                                                                                         |
| Khách hàng            | `customers.read`, `customers.readSensitive`, `customers.create`, `customers.update`                                                                                                                                       |
| Yêu cầu báo giá       | `quoteRequests.read/assign/update/close/markSpam`                                                                                                                                                                         |
| Báo giá               | `quotes.read/create/update/addVersion/submitReview/send/expire/requestPriceAdjustment`                                                                                                                                    |
| Đơn hàng              | `orders.create`, `orders.updateDraft`, `orders.submitForApproval`, `orders.assignBusinessUnits`, `orders.assignResponsibleUsers`, `orders.transitionOperational`, `orders.requestPriceAdjustment`, `orders.requestCancel` |
| Giao hàng             | `deliveries.plan`, `deliveries.update`                                                                                                                                                                                    |
| Đóng gói & vận chuyển | `packing.create/update/complete`, `shipments.create/update`                                                                                                                                                               |
| Chứng từ              | `tradeDocuments.read`, `tradeDocuments.manage`, `documents.generate`, `documents.export`                                                                                                                                  |
| Mẫu                   | `samples.read/create/update/addRevision/recordCustomerReview`                                                                                                                                                             |
| Tài chính (đọc)       | `payments.read`, `receivables.read`                                                                                                                                                                                       |
| Khác                  | `notifications.retry`, `approvals.request`                                                                                                                                                                                |

**Không có:** `quotes.readSellingPrice`, `orders.readSellingPrice` — quản lý đơn hàng **soạn** báo giá và đơn hàng nhưng **không đọc được trường giá bán** đã chốt. Cũng không có `quotes.approve`, `orders.approve`, `orders.cancel`, `shipments.dispatch`.

**Mẫu hình:** mọi hành động thương mại đều là `request*` — `requestPriceAdjustment`, `requestCancel`, `submitForApproval`. Không có `approve*` nào.

**Vị trí trong quy trình đơn hàng:** bước 1 (`received`).

---

### 5.5 `FACTORY_MANAGER` — Quản lý nhà máy

Tổ chức sản xuất, lập kế hoạch, quản lý xưởng phụ, chi phí nhà máy và theo dõi chất lượng.

**52 quyền:** 47 ở `assignedBusinessUnits`, 5 ở `own`.

Phạm vi `assignedBusinessUnits`:

| Nhóm       | Quyền                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Đọc chung  | 16 quyền `sharedOperationalReads`                                                                                                       |
| Sản phẩm   | `products.readCost`, `products.manageBom`                                                                                               |
| Sản xuất   | `production.createPlan/updatePlan/assignWork/updateProgress/reportBlocker/recordMaterialUse/recordLabor/readLaborQuantity/completeWork` |
| Chất lượng | `production.recordQcEvidence`, `production.approveQc`, `production.requireRework`, `production.rejectQc`                                |
| Tồn kho    | `inventory.reserve`, `inventory.release`                                                                                                |
| Đơn hàng   | `orders.transitionOperational`                                                                                                          |
| Chi phí    | `expenses.read`, `finance.readCost`                                                                                                     |
| Mẫu        | `samples.read/update/addRevision/submitInternalReview/recordInternalReview`                                                             |
| Báo cáo    | `reports.submitDaily`, `reports.reviewDaily`                                                                                            |
| Khác       | `media.upload`, `documents.generate`, `documents.export`, `approvals.request`                                                           |

Phạm vi `own`: `expenses.create`, `expenses.updateDraft`, `expenses.submit`, `media.updateOwnMetadata`, `media.softDelete`.

**Đọc được giá thành** (`products.readCost`, `finance.readCost`) nhưng **không đọc được giá bán hay lợi nhuận**.

**Chi phí:** chỉ tạo và trình bản nháp của chính mình. Duyệt, hạch toán và đảo bút toán thuộc về Kế toán công ty.

**Lưu ý về QC:** `production.approveQc` là quyền vận hành trong phạm vi đơn vị, khác hẳn với `samples.approve` (quyền toàn cục, thuộc Giám đốc).

**Vị trí trong quy trình đơn hàng:** bước 4 (`productionPlanning`), bước 7 (`inProduction`), bước 9 (`qualityControl`).

---

### 5.6 `WAREHOUSE_MANAGER` — Thủ kho / Quản lý kho

Tồn kho, nhận và xuất vật tư, đối chiếu tồn kho, hồ sơ lao động và bán hàng nội bộ.

**48 quyền:** 46 ở `assignedBusinessUnits`, 2 ở `own`.

| Nhóm            | Quyền                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Đọc chung       | 16 quyền `sharedOperationalReads`                                                                                     |
| Tồn kho         | `inventory.receive/issue/reserve/release/transfer/transferCrossUnit/requestAdjustment/adjust/stocktake/import/export` |
| Mua hàng        | `procurement.receive`                                                                                                 |
| Sản xuất        | `production.recordMaterialUse`, `production.readLaborQuantity`                                                        |
| Lao động        | `labor.manageRecords`                                                                                                 |
| Giao hàng       | `deliveries.plan`, `deliveries.update`, `deliveries.confirmDispatch`                                                  |
| Đóng gói & xuất | `packing.create/update/complete`, `shipments.create/update/dispatch`                                                  |
| Chứng từ        | `documents.generate`, `documents.import`, `documents.export`                                                          |
| Khác            | `media.upload`, `reports.submitDaily`, `approvals.request`                                                            |

Phạm vi `own`: `media.updateOwnMetadata`, `media.softDelete`.

**Quyền trên số lượng không bao giờ kéo theo giá trị.** Thủ kho có `inventory.adjust` và `inventory.stocktake` nhưng **không có** `inventory.readValue` — thấy số lượng, không thấy giá trị tồn kho.

**Lao động:** có `labor.manageRecords` (ghi hồ sơ công) nhưng **không có** `labor.readSalary` (đọc lương). Đây là sự tách biệt cố ý: thủ kho duy trì hồ sơ lao động mà không nhìn thấy tiền lương.

**Điều chỉnh tồn kho:** có cả `inventory.requestAdjustment` lẫn `inventory.adjust`, nhưng `inventory.approveAdjustment` thuộc Kế toán công ty, và điều chỉnh vẫn phải qua cổng phê duyệt `inventory.adjustment`.

**Vị trí trong quy trình đơn hàng:** bước 5 (`inventoryCheck`), bước 6 (`materialProcurement`, `materialIssued`), bước 10 (`packing`), bước 12 (`loadingScheduled`), bước 13 (`shipped`).

---

### 5.7 `FACTORY_ACCOUNTANT` — Kế toán nhà máy

Kiểm soát và báo cáo chi phí nhà máy, xưởng phụ và lao động lên Kế toán công ty.

**37 quyền:** 36 ở `assignedBusinessUnits`, 1 ở `own` (`media.updateOwnMetadata`).

| Nhóm       | Quyền                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| Đọc chung  | 16 quyền `sharedOperationalReads`                                                                           |
| Giá thành  | `products.readCost`, `finance.readCost`, `inventory.readValue`                                              |
| Chi phí    | `expenses.read`, `expenses.create`, `expenses.updateDraft`, `expenses.submit`                               |
| Thanh toán | `payments.read`, `payables.read`                                                                            |
| Lao động   | `production.recordLabor`, `production.readLaborQuantity`, `labor.readSalary`, `labor.manageRecords`         |
| Chứng từ   | `documents.generate`, `documents.readSensitive`, `documents.import`, `documents.export`, `inventory.export` |
| Khác       | `reports.submitDaily`, `approvals.request`                                                                  |

**Đọc được lương** (`labor.readSalary`) — khác với Thủ kho. Nhưng **không có** `labor.confirmPayroll`; xác nhận lương thuộc Kế toán công ty và phải qua cổng phê duyệt `payroll.confirmation`.

**Đọc được giá trị tồn kho** (`inventory.readValue`) nhưng **không có** quyền nào ghi tồn kho.

**Chi phí:** chỉ đến bước `submit`. Duyệt, hạch toán, đảo bút toán thuộc Kế toán công ty.

**Không có:** mọi quyền `*.approve*`, `finance.readProfit`, `*.readSellingPrice`.

**Ghi chú tổ chức:** trên sơ đồ, vị trí `factory-accountant` giữ **cả hai** vai trò `FACTORY_ACCOUNTANT` và `SUPPLIER_MANAGER`, vì cùng một người điều phối nhà cung cấp và mua nguyên vật liệu. Nếu tách cho hai người, chỉ cần cấp grant riêng — không sửa code.

---

### 5.8 `PRODUCT_DESIGNER` — Nhân viên thiết kế

Đơn hàng mẫu, phát triển sản phẩm, chuẩn bị mẫu và theo dõi mẫu theo yêu cầu khách hàng.

**36 quyền:** 28 ở `assignedBusinessUnits`, 8 ở `own`.

Phạm vi `assignedBusinessUnits`:

| Nhóm       | Quyền                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| Đọc chung  | 16 quyền `sharedOperationalReads`                                                                    |
| Sản phẩm   | `products.create`, `products.manageBom`                                                              |
| Bộ sưu tập | `collections.readDraft`                                                                              |
| Mẫu        | `samples.read`, `samples.create`, `samples.recordCustomerReview`, `samples.convert`                  |
| Khác       | `media.upload`, `documents.generate`, `documents.export`, `reports.submitDaily`, `approvals.request` |

Phạm vi `own` — chỉ sửa được thứ do chính mình tạo:

```
products.update    products.manageVariants    products.submitReview
samples.update     samples.addRevision        samples.submitInternalReview
media.updateOwnMetadata    media.softDelete
```

**Mẫu hình `own` cho việc sửa:** thiết kế viên tạo sản phẩm ở phạm vi đơn vị, nhưng chỉ sửa được sản phẩm của chính mình. Sản phẩm của đồng nghiệp là chỉ đọc.

**Không có:** `products.review`, `products.publish`, `samples.approve`, `samples.reject` — đều là quyền toàn cục, thuộc Giám đốc.

**Ghi chú tổ chức:** vị trí `product-designer` giữ **cả** `PRODUCT_DESIGNER` và `CONTENT_EDITOR`, vì cùng một người phụ trách hình ảnh sản phẩm và mỹ thuật bộ sưu tập trên website.

---

### 5.9 `SUPPLIER_MANAGER` — Quản lý nhà cung cấp

Nhà cung cấp, hợp đồng đang thực hiện, đơn mua nguyên liệu, tạm ứng và thay đổi đơn giá.

**35 quyền:** 34 ở `assignedBusinessUnits`, 1 ở `own` (`media.updateOwnMetadata`).

| Nhóm          | Quyền                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đọc chung     | 16 quyền `sharedOperationalReads`                                                                                                                          |
| Nhà cung cấp  | `suppliers.create`, `suppliers.update`                                                                                                                     |
| Mua hàng      | `procurement.create`, `procurement.update`, `procurement.addVersion`, `procurement.submit`, `procurement.requestPriceChange`, `procurement.requestAdvance` |
| Công nợ (đọc) | `payables.read`, `payments.read`                                                                                                                           |
| Chứng từ      | `tradeDocuments.read`, `tradeDocuments.manage`, `documents.generate`, `documents.import`, `documents.export`                                               |
| Khác          | `media.upload`, `reports.submitDaily`, `approvals.request`                                                                                                 |

**Ranh giới cốt lõi:** người mua đề nghị, người khác duyệt. `procurement.approve`, `procurement.approvePriceChange`, `procurement.approveAdvance` đều thuộc Kế toán công ty và Giám đốc. Không có `suppliers.archive`.

**Không nhận hàng:** `procurement.receive` thuộc Thủ kho. Người đặt mua không được xác nhận hàng đã về — đây là tách biệt trách nhiệm, và cũng là lý do bước `materialProcurement` do Thủ kho sở hữu.

---

### 5.10 `CONTENT_EDITOR` — Biên tập nội dung

Nội dung website, tin tức, bản dịch, bản nháp bộ sưu tập và thư viện ảnh.

**19 quyền.** Đây là vai trò duy nhất **không dùng phạm vi đơn vị kinh doanh** — nội dung là tài nguyên toàn cục, nên đọc ở `all` và ghi ở `own`.

Phạm vi `all` (đọc và tải lên):

```
content.read    media.read    media.upload    collections.readDraft
settings.read   products.read businessUnits.read
approvals.read  approvals.request
```

Phạm vi `own` (chỉ bản nháp do chính mình tạo):

```
content.create    content.update    translations.update
collections.create    collections.update    collections.updateHotspots    collections.submitReview
settings.updatePublic
media.updateOwnMetadata    media.softDelete
```

**Không có bất kỳ quyền xuất bản nào.** `content.review`, `content.publish`, `content.archive`, `translations.review`, `translations.publish`, `collections.approve`, `collections.publish`, `collections.rollback`, `collections.archive`, `settings.publishPublic` — tất cả đều là quyền toàn cục, chỉ Giám đốc và Super Admin có. Biên tập viên soạn và trình duyệt; xuất bản là quyết định khác.

**Không có dữ liệu vận hành:** không đọc được đơn hàng, tồn kho, nhà cung cấp, sản xuất, tài chính. Đây là vai trò duy nhất **không** nhận `sharedOperationalReads`.

---

### 5.11 `PRODUCTION_UNIT` — Đơn vị sản xuất / Xưởng phụ

Thực hiện sản xuất, năng suất lao động, sử dụng nguyên vật liệu, đảm bảo chất lượng và giao hàng đúng kế hoạch.

**19 quyền** — vai trò nghiệp vụ hẹp nhất.

Phạm vi `own` — chỉ công việc được giao cho chính đơn vị mình:

```
production.updateProgress    production.reportBlocker    production.recordMaterialUse
production.recordLabor       production.readLaborQuantity  production.recordQcEvidence
media.upload    media.updateOwnMetadata    documents.read
```

Phạm vi `assignedBusinessUnits` — chỉ 10 quyền đọc, **không phải** trọn bộ `sharedOperationalReads`:

```
businessUnits.read    products.read    media.read    orders.read
inventory.read    production.read    reports.readOperational    reports.submitDaily
approvals.read    approvals.request
```

**Cố ý không có, so với các vai trò khác:** `suppliers.read`, `procurement.read`, `procurement.readPrice`, `deliveries.read`, `packing.read`, `shipments.read`, `documents.download`.

**Không bao giờ thấy:** giá bán, lợi nhuận, lương, dữ liệu riêng tư của khách hàng, và **công việc của đơn vị khác**. Phạm vi `own` trên các quyền sản xuất chính là ranh giới ngăn xưởng phụ này nhìn thấy tiến độ của xưởng phụ kia.

**Ghi nhận chất lượng, không phê duyệt chất lượng:** có `production.recordQcEvidence`, không có `production.approveQc` / `requireRework` / `rejectQc` — những quyền đó thuộc Quản lý nhà máy.

---

### 5.12 `REPORT_VIEWER` — Người xem báo cáo

Chỉ đọc báo cáo vận hành trong phạm vi đơn vị được cấp.

**17 quyền**, tất cả ở `assignedBusinessUnits`: 16 quyền `sharedOperationalReads` cộng `documents.export`.

**Không có bất kỳ quyền ghi nào.** Cũng không có `reports.submitDaily` và không có `approvals.request` — chỉ có `approvals.read` để nhìn hàng đợi.

**Không có:** `reports.readConsolidated` (quyền toàn cục, thuộc Giám đốc và Kế toán công ty), và mọi quyền trường nhạy cảm ngoài `procurement.readPrice`.

**Ghi chú:** đây là grant cấp cho người quan sát, không phải một vị trí trên sơ đồ tổ chức.

---

## 6. Cổng phê duyệt của Giám đốc

Giữ quyền để **làm** một việc không đồng nghĩa với được phép **hoàn tất** việc đó. Với 17 chủ thể dưới đây, thao tác không có hiệu lực ngay: nó dừng lại ở một yêu cầu phê duyệt đang chờ, và máy trạng thái từ chối tiến tiếp cho tới khi có quyết định.

| Chủ thể phê duyệt         | Quyền cần có để quyết định       |
| ------------------------- | -------------------------------- |
| `order.confirm`           | `orders.approve`                 |
| `order.sellingPrice`      | `orders.approvePriceAdjustment`  |
| `order.priceAdjustment`   | `orders.approvePriceAdjustment`  |
| `order.cancel`            | `orders.cancel`                  |
| `order.dispatch`          | `approvals.decide`               |
| `quote.send`              | `quotes.approve`                 |
| `quote.priceAdjustment`   | `quotes.approvePriceAdjustment`  |
| `procurement.purchase`    | `procurement.approve`            |
| `procurement.priceChange` | `procurement.approvePriceChange` |
| `procurement.advance`     | `procurement.approveAdvance`     |
| `expense.incurred`        | `expenses.approve`               |
| `inventory.adjustment`    | `inventory.approveAdjustment`    |
| `production.plan`         | `approvals.decide`               |
| `sample.approval`         | `samples.approve`                |
| `content.publication`     | `content.publish`                |
| `collection.publication`  | `collections.approve`            |
| `payroll.confirmation`    | `labor.confirmPayroll`           |

Quy tắc áp dụng cho mọi yêu cầu (`src/domains/approvals/policy.ts`):

- **Một yêu cầu chờ duy nhất** cho mỗi cặp (bản ghi, chủ thể). Không thể xếp chồng yêu cầu trùng lặp.
- **Tách biệt trách nhiệm:** người tạo yêu cầu không bao giờ là người quyết định. Điều này đúng **kể cả khi Giám đốc tự tạo yêu cầu của mình** — nhật ký audit luôn phải ghi hai danh tính.
- **Từ chối phải có lý do.** Lý do trống hoặc chỉ có khoảng trắng bị chặn.
- **Khóa theo revision:** nếu bản ghi thay đổi sau khi yêu cầu được tạo hoặc được duyệt, quyết định cũ mất hiệu lực và phải xin duyệt lại (`REVISION_CONFLICT`).

Chỉ `SUPER_ADMIN` và `DIRECTOR` nằm trong `approvalDecidingRoleKeys`.

---

## 7. Vai trò theo 15 bước quy trình đơn hàng

| Bước | Giai đoạn                  | Vai trò sở hữu       | Quyền để tiến tiếp         | Cần Giám đốc duyệt     |
| ---- | -------------------------- | -------------------- | -------------------------- | ---------------------- |
| 1    | `received`                 | `ORDER_MANAGER`      | `orders.updateDraft`       | —                      |
| 2    | `fileOpened`               | `COMPANY_ACCOUNTANT` | `orders.submitForApproval` | —                      |
| 3    | `awaitingDirectorApproval` | `DIRECTOR`           | `orders.confirm`           | `order.confirm`        |
| 4    | `productionPlanning`       | `FACTORY_MANAGER`    | `production.createPlan`    | `production.plan`      |
| 5    | `inventoryCheck`           | `WAREHOUSE_MANAGER`  | `inventory.read`           | —                      |
| 6    | `materialProcurement`      | `WAREHOUSE_MANAGER`  | `procurement.receive`      | `procurement.purchase` |
| 6    | `materialIssued`           | `WAREHOUSE_MANAGER`  | `inventory.issue`          | —                      |
| 7    | `inProduction`             | `FACTORY_MANAGER`    | `production.completeWork`  | —                      |
| 9    | `qualityControl`           | `FACTORY_MANAGER`    | `production.approveQc`     | —                      |
| 10   | `packing`                  | `WAREHOUSE_MANAGER`  | `packing.complete`         | —                      |
| 11   | `tradeDocumentation`       | `COMPANY_ACCOUNTANT` | `tradeDocuments.manage`    | —                      |
| 12   | `loadingScheduled`         | `WAREHOUSE_MANAGER`  | `shipments.dispatch`       | `order.dispatch`       |
| 13   | `shipped`                  | `WAREHOUSE_MANAGER`  | `documents.generate`       | —                      |
| 14   | `invoiced`                 | `COMPANY_ACCOUNTANT` | `payments.record`          | —                      |
| 15   | `settled` → `closed`       | `DIRECTOR`           | `orders.close`             | —                      |
| —    | `cancelled`                | `DIRECTOR`           | `orders.cancel`            | —                      |

Chi tiết đồ thị chuyển trạng thái và quy tắc chặn (`TERMINAL_STAGE`, `INVALID_TRANSITION`, `APPROVAL_REQUIRED`, `QC_NOT_PASSED`, `REASON_REQUIRED`) xem `docs/ORDER_WORKFLOW.md`.

---

## 8. Cấp vai trò cho người dùng

Vai trò là định nghĩa; `AccessGrant` mới là thứ gắn một người vào vai trò đó.

- `RoleDefinition` chứa trần quyền và phạm vi của một vai trò.
- `AccessGrant` gắn một vai trò cho một người dùng, kèm một đơn vị kinh doanh tùy chọn.
- `businessUnitId = null` là grant toàn cục **có chủ đích**, do người quản lý vai trò cấp tường minh — không bao giờ là ký tự đại diện nhận từ form.
- Mã vai trò hệ thống là cố định và được seed. Nhãn hiển thị có thể dịch.

Quy trình đưa một người vào một vị trí:

1. Mời hoặc kích hoạt người dùng. Một danh tính Google chưa được mời sẽ ở trạng thái `pending` và chỉ thấy màn hình chờ cấp quyền.
2. Đọc `roleKeys` của vị trí trong `organizationPositions`.
3. Tạo một `AccessGrant` cho mỗi mã vai trò, với phạm vi đơn vị kinh doanh mà vị trí đó cần.
4. Đối chiếu với quy tắc chống leo thang bên dưới.

Bàn giao công việc = thu hồi grant của người cũ và cấp đúng grant đó cho người mới. Đình chỉ người dùng sẽ thu hồi phiên đang hoạt động hoặc tăng `authzVersion`, khiến phiên cũ trả về `STALE_SESSION`.

### Quy tắc chống leo thang

- Không ai được cấp quyền vượt quá trần quyền hiệu lực của chính mình.
- Không ai được tự cấp quyền cho bản thân.
- Chỉ `users.manageSuperAdmin` mới được đụng vào một grant Super Admin.
- Chỉ `roles.update` mới sửa được định nghĩa vai trò — và cả hai quyền này chỉ `SUPER_ADMIN` có.

### Ba điều không bao giờ được làm

1. Hard-code tên người, email hay user ID vào một policy, một bước quy trình, một định nghĩa form hay một bộ lọc báo cáo.
2. Dùng mã vai trò như một quy tắc nghiệp vụ trong code ứng dụng. Policy kiểm tra **quyền**. Ngoại lệ duy nhất được phép là vòng đời Super Admin được bảo vệ, cộng với `approvalDecidingRoleKeys` — tồn tại để service phê duyệt không phải so sánh tên vai trò rải rác trong code.
3. Nới rộng định nghĩa một vai trò để vừa với một cá nhân. Nếu người đó cần thêm năng lực, hãy cấp thêm grant của vai trò vốn đã mang quyền đó.

---

## 9. Đọc nhanh: ai thấy gì

| Dữ liệu                            | Ai đọc được                                                               |
| ---------------------------------- | ------------------------------------------------------------------------- |
| Giá bán, biên lợi nhuận, lợi nhuận | `DIRECTOR`, `COMPANY_ACCOUNTANT` (và `SUPER_ADMIN`)                       |
| Giá mua nguyên vật liệu            | Mọi vai trò nghiệp vụ **trừ** `CONTENT_EDITOR` và `PRODUCTION_UNIT`       |
| Giá thành sản phẩm                 | `DIRECTOR`, `COMPANY_ACCOUNTANT`, `FACTORY_MANAGER`, `FACTORY_ACCOUNTANT` |
| Giá trị tồn kho                    | `DIRECTOR`, `COMPANY_ACCOUNTANT`, `FACTORY_ACCOUNTANT`                    |
| Lương                              | `DIRECTOR`, `COMPANY_ACCOUNTANT`, `FACTORY_ACCOUNTANT`                    |
| Số lượng tồn kho                   | Mọi vai trò nghiệp vụ                                                     |
| Dữ liệu riêng tư của khách hàng    | `DIRECTOR`, `COMPANY_ACCOUNTANT`, `ORDER_MANAGER`                         |
| Báo cáo hợp nhất                   | `DIRECTOR`, `COMPANY_ACCOUNTANT`                                          |
| Nhật ký audit                      | `SUPER_ADMIN`, `DIRECTOR`                                                 |

| Hành động                        | Ai được làm                      |
| -------------------------------- | -------------------------------- |
| Quyết định yêu cầu phê duyệt     | `SUPER_ADMIN`, `DIRECTOR`        |
| Xuất bản nội dung / bộ sưu tập   | `SUPER_ADMIN`, `DIRECTOR`        |
| Duyệt / xuất bản sản phẩm        | `SUPER_ADMIN`, `DIRECTOR`        |
| Duyệt chi phí, hạch toán         | `COMPANY_ACCOUNTANT`, `DIRECTOR` |
| Duyệt mua hàng, tạm ứng, đổi giá | `COMPANY_ACCOUNTANT`, `DIRECTOR` |
| Ghi nhận thanh toán              | `COMPANY_ACCOUNTANT`             |
| Xác nhận lương                   | `COMPANY_ACCOUNTANT`             |
| Duyệt điều chỉnh tồn kho         | `COMPANY_ACCOUNTANT`             |
| Ghi tồn kho (nhập/xuất/chuyển)   | `WAREHOUSE_MANAGER`              |
| Xuất hàng (`shipments.dispatch`) | `WAREHOUSE_MANAGER`              |
| Duyệt QC sản xuất                | `FACTORY_MANAGER`                |
| Sửa định nghĩa vai trò           | `SUPER_ADMIN`                    |

---

## 10. Bảo trì tài liệu này

Tài liệu này được viết từ dữ liệu trích trực tiếp trong `role-definitions.ts` và `permissions.ts`. Khi thêm một quyền, một vai trò, hoặc đổi phạm vi của một quyền, hãy cập nhật:

1. Số lượng quyền ở bảng tổng quan mục 5.
2. Mục con của vai trò bị ảnh hưởng.
3. Bảng đọc nhanh mục 9 nếu quyền đó là quyền trường nhạy cảm hoặc quyền phê duyệt.
4. `docs/RBAC.md` mục 7 (ma trận quyền mặc định) nếu ma trận thay đổi.

Nếu một mục nào đó ở đây không khớp với `roleDefinitionSeeds`, tài liệu sai — hãy sửa tài liệu, đừng sửa code cho vừa tài liệu.
