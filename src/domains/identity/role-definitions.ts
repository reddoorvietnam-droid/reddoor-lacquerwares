import {
  permissionCatalog,
  type Permission,
} from "@/domains/identity/permissions";
import type { PermissionScope } from "@/domains/identity/contracts";

export const systemRoleKeys = [
  "SUPER_ADMIN",
  "DIRECTOR",
  "ORDER_MANAGER",
  "PRODUCT_DESIGNER",
  "CONTENT_EDITOR",
  "WAREHOUSE_MANAGER",
  "FACTORY_MANAGER",
  "FACTORY_ACCOUNTANT",
  "PRODUCTION_UNIT",
  "COMPANY_ACCOUNTANT",
  "SUPPLIER_MANAGER",
  "REPORT_VIEWER",
] as const;

export type SystemRoleKey = (typeof systemRoleKeys)[number];

export type RolePermissionSeed = {
  permission: Permission;
  scope: PermissionScope;
};

export type RoleDefinitionSeed = {
  key: SystemRoleKey;
  labels: { vi: string; en: string };
  /** Short statement of the position this role encodes, for the admin UI. */
  summary: { vi: string; en: string };
  permissions: readonly RolePermissionSeed[];
};

function grants(
  entries: Partial<Record<PermissionScope, readonly Permission[]>>,
): readonly RolePermissionSeed[] {
  return (
    Object.entries(entries) as [PermissionScope, readonly Permission[]][]
  ).flatMap(([scope, permissions]) =>
    permissions.map((permission) => ({ permission, scope })),
  );
}

/**
 * Operational data every active staff role may read.
 *
 * Confirmed rule: "giá mua và các phần còn lại thì mọi ng đều xem được" —
 * purchase price and the remaining operational data are readable by everyone;
 * editing requires an explicit grant. Selling price, margin, profit, salary and
 * customer-private fields are deliberately absent from this list.
 */
const sharedOperationalReads = [
  "businessUnits.read",
  "products.read",
  "media.read",
  "orders.read",
  "deliveries.read",
  "suppliers.read",
  "procurement.read",
  "procurement.readPrice",
  "inventory.read",
  "production.read",
  "packing.read",
  "shipments.read",
  "documents.read",
  "documents.download",
  "reports.readOperational",
  "approvals.read",
] as const satisfies readonly Permission[];

export const roleDefinitionSeeds = [
  {
    key: "SUPER_ADMIN",
    labels: { vi: "Quản trị hệ thống", en: "Super Admin" },
    summary: {
      vi: "Thiết lập nền tảng, quản lý người dùng và toàn bộ nghiệp vụ.",
      en: "Platform setup, user administration, and every business capability.",
    },
    // The only role holding the complete catalog. Still bound by state
    // machines, separation of duties, and audit requirements.
    permissions: grants({ all: permissionCatalog }),
  },
  {
    key: "DIRECTOR",
    labels: { vi: "Giám đốc", en: "Director" },
    summary: {
      vi: "Duyệt toàn bộ nghiệp vụ trọng yếu và xem báo cáo hợp nhất.",
      en: "Approves every significant operation and reads consolidated reports.",
    },
    // Confirmed rule: every commercially significant action needs Director
    // approval — orders, selling price, price changes, material purchases,
    // incurred expenses, and dispatch.
    permissions: grants({
      all: permissionCatalog.filter(
        (permission) =>
          permission !== "users.manageSuperAdmin" &&
          permission !== "roles.update" &&
          permission !== "settings.manageSystem",
      ),
    }),
  },
  {
    key: "ORDER_MANAGER",
    labels: { vi: "Quản lý đơn hàng", en: "Order Manager" },
    summary: {
      vi: "Khách hàng, yêu cầu báo giá, báo giá và điều phối giao hàng.",
      en: "Customers, quote requests, quotes, and delivery coordination.",
    },
    permissions: grants({
      all: ["settings.read"],
      assignedBusinessUnits: [
        ...sharedOperationalReads,
        "customers.read",
        "customers.readSensitive",
        "customers.create",
        "customers.update",
        "quoteRequests.read",
        "quoteRequests.assign",
        "quoteRequests.update",
        "quoteRequests.close",
        "quoteRequests.markSpam",
        "quotes.read",
        "quotes.create",
        "quotes.update",
        "quotes.addVersion",
        "quotes.submitReview",
        "quotes.send",
        "quotes.expire",
        "quotes.requestPriceAdjustment",
        "orders.create",
        "orders.updateDraft",
        "orders.submitForApproval",
        "orders.assignBusinessUnits",
        "orders.assignResponsibleUsers",
        "orders.transitionOperational",
        "orders.requestPriceAdjustment",
        "orders.requestCancel",
        "deliveries.plan",
        "deliveries.update",
        "packing.create",
        "packing.update",
        "packing.complete",
        "shipments.create",
        "shipments.update",
        "tradeDocuments.read",
        "tradeDocuments.manage",
        "samples.read",
        "samples.create",
        "samples.update",
        "samples.addRevision",
        "samples.recordCustomerReview",
        "payments.read",
        "receivables.read",
        "documents.generate",
        "documents.export",
        "notifications.retry",
        "approvals.request",
      ],
    }),
  },
  {
    key: "PRODUCT_DESIGNER",
    labels: { vi: "Nhân viên thiết kế", en: "Product Designer" },
    summary: {
      vi: "Đơn hàng mẫu, phát triển sản phẩm, chuẩn bị mẫu và theo dõi mẫu theo yêu cầu khách hàng.",
      en: "Sample orders, product development, sample preparation, and customer sample tracking.",
    },
    permissions: grants({
      own: [
        "products.update",
        "products.manageVariants",
        "products.submitReview",
        "samples.update",
        "samples.addRevision",
        "samples.submitInternalReview",
        "media.updateOwnMetadata",
        "media.softDelete",
      ],
      assignedBusinessUnits: [
        ...sharedOperationalReads,
        "products.create",
        "products.manageBom",
        "media.upload",
        "collections.readDraft",
        "samples.read",
        "samples.create",
        "samples.recordCustomerReview",
        "samples.convert",
        "documents.generate",
        "documents.export",
        "reports.submitDaily",
        "approvals.request",
      ],
    }),
  },
  {
    key: "CONTENT_EDITOR",
    labels: { vi: "Biên tập nội dung", en: "Content Editor" },
    summary: {
      vi: "Nội dung website, tin tức, bản dịch, bản nháp bộ sưu tập và thư viện ảnh.",
      en: "Public content, news, translations, collection drafts, and media.",
    },
    permissions: grants({
      own: [
        "content.create",
        "content.update",
        "translations.update",
        "collections.create",
        "collections.update",
        "collections.updateHotspots",
        "collections.submitReview",
        "settings.updatePublic",
        "media.updateOwnMetadata",
        "media.softDelete",
      ],
      all: [
        "content.read",
        "media.read",
        "media.upload",
        "collections.readDraft",
        "settings.read",
        "products.read",
        "businessUnits.read",
        "approvals.read",
        "approvals.request",
      ],
    }),
  },
  {
    key: "WAREHOUSE_MANAGER",
    labels: { vi: "Thủ kho / Quản lý kho", en: "Warehouse Manager" },
    summary: {
      vi: "Tồn kho, nhận và xuất vật tư, đối chiếu tồn kho, hồ sơ lao động và bán hàng nội bộ.",
      en: "Inventory, material receipt and issue, stocktake reconciliation, labor records, and internal sales.",
    },
    // Quantity access never implies inventory valuation, selling price, or profit.
    permissions: grants({
      assignedBusinessUnits: [
        ...sharedOperationalReads,
        "inventory.receive",
        "inventory.issue",
        "inventory.reserve",
        "inventory.release",
        "inventory.transfer",
        "inventory.transferCrossUnit",
        "inventory.requestAdjustment",
        "inventory.adjust",
        "inventory.stocktake",
        "inventory.import",
        "inventory.export",
        "procurement.receive",
        "production.recordMaterialUse",
        "production.readLaborQuantity",
        "labor.manageRecords",
        "deliveries.plan",
        "deliveries.update",
        "deliveries.confirmDispatch",
        "packing.create",
        "packing.update",
        "packing.complete",
        "shipments.create",
        "shipments.update",
        "shipments.dispatch",
        "documents.generate",
        "documents.import",
        "documents.export",
        "media.upload",
        "reports.submitDaily",
        "approvals.request",
      ],
      own: ["media.updateOwnMetadata", "media.softDelete"],
    }),
  },
  {
    key: "FACTORY_MANAGER",
    labels: { vi: "Quản lý nhà máy", en: "Factory Manager" },
    summary: {
      vi: "Tổ chức sản xuất, lập kế hoạch, quản lý xưởng phụ, chi phí nhà máy và theo dõi chất lượng.",
      en: "Production organisation and planning, sub-workshop management, factory cost, and quality tracking.",
    },
    permissions: grants({
      own: [
        "expenses.create",
        "expenses.updateDraft",
        "expenses.submit",
        "media.updateOwnMetadata",
        "media.softDelete",
      ],
      assignedBusinessUnits: [
        ...sharedOperationalReads,
        "products.readCost",
        "products.manageBom",
        "production.createPlan",
        "production.updatePlan",
        "production.assignWork",
        "production.updateProgress",
        "production.reportBlocker",
        "production.recordMaterialUse",
        "production.recordLabor",
        "production.readLaborQuantity",
        "production.recordQcEvidence",
        "production.approveQc",
        "production.requireRework",
        "production.rejectQc",
        "production.completeWork",
        "inventory.reserve",
        "inventory.release",
        "orders.transitionOperational",
        "expenses.read",
        "finance.readCost",
        "samples.read",
        "samples.update",
        "samples.addRevision",
        "samples.submitInternalReview",
        "samples.recordInternalReview",
        "media.upload",
        "documents.generate",
        "documents.export",
        "reports.submitDaily",
        "reports.reviewDaily",
        "approvals.request",
      ],
    }),
  },
  {
    key: "FACTORY_ACCOUNTANT",
    labels: { vi: "Kế toán nhà máy", en: "Factory Accountant" },
    summary: {
      vi: "Kiểm soát và báo cáo chi phí nhà máy, xưởng phụ và lao động lên kế toán công ty.",
      en: "Controls and reports factory, sub-workshop, and labor cost to the Company Accountant.",
    },
    // Submits unit cost; approval and posting belong to the Company Accountant
    // or the Director.
    permissions: grants({
      assignedBusinessUnits: [
        ...sharedOperationalReads,
        "products.readCost",
        "expenses.read",
        "expenses.create",
        "expenses.updateDraft",
        "expenses.submit",
        "payments.read",
        "payables.read",
        "finance.readCost",
        "inventory.readValue",
        "inventory.export",
        "production.recordLabor",
        "production.readLaborQuantity",
        "labor.readSalary",
        "labor.manageRecords",
        "documents.generate",
        "documents.readSensitive",
        "documents.import",
        "documents.export",
        "reports.submitDaily",
        "approvals.request",
      ],
      own: ["media.updateOwnMetadata"],
    }),
  },
  {
    key: "PRODUCTION_UNIT",
    labels: { vi: "Đơn vị sản xuất / Xưởng phụ", en: "Production Unit" },
    summary: {
      vi: "Thực hiện sản xuất, năng suất lao động, sử dụng nguyên vật liệu, đảm bảo chất lượng và giao hàng đúng kế hoạch.",
      en: "Executes production, labor productivity, material usage, quality assurance, and on-plan delivery.",
    },
    // Never sees selling price, profit, salary, customer-private data, or the
    // work of another unit.
    permissions: grants({
      own: [
        "production.updateProgress",
        "production.reportBlocker",
        "production.recordMaterialUse",
        "production.recordLabor",
        "production.readLaborQuantity",
        "production.recordQcEvidence",
        "media.upload",
        "media.updateOwnMetadata",
        "documents.read",
      ],
      assignedBusinessUnits: [
        "businessUnits.read",
        "products.read",
        "media.read",
        "orders.read",
        "inventory.read",
        "production.read",
        "reports.readOperational",
        "reports.submitDaily",
        "approvals.read",
        "approvals.request",
      ],
    }),
  },
  {
    key: "COMPANY_ACCOUNTANT",
    labels: { vi: "Kế toán công ty", en: "Company Accountant" },
    summary: {
      vi: "Kế toán và tài chính, hồ sơ thanh toán, hồ sơ nhập/xuất khẩu, xác nhận lương và báo cáo lãi lỗ hàng tháng.",
      en: "Accounting and finance, payment records, import/export files, payroll confirmation, and the monthly profit and loss report.",
    },
    // Confirmed rule: together with the Director, the only role that may read
    // selling price and profit.
    permissions: grants({
      all: [
        ...sharedOperationalReads,
        "settings.read",
        "customers.read",
        "customers.readSensitive",
        "quotes.read",
        "quotes.readSellingPrice",
        "quotes.approvePriceAdjustment",
        "products.readSellingPrice",
        "products.readCost",
        "orders.readSellingPrice",
        // Step 2 of the order process: the Company Accountant opens the order
        // file and submits it for the Director's decision.
        "orders.submitForApproval",
        "orders.approvePriceAdjustment",
        "procurement.approve",
        "procurement.cancel",
        "procurement.approvePriceChange",
        "procurement.approveAdvance",
        "inventory.readValue",
        "inventory.approveAdjustment",
        "inventory.export",
        "expenses.read",
        "expenses.approve",
        "expenses.reject",
        "expenses.post",
        "expenses.reverse",
        "payments.read",
        "payments.record",
        "payments.allocate",
        "payments.reverse",
        "payments.refund",
        "receivables.read",
        "payables.read",
        "finance.readCost",
        "finance.readProfit",
        "finance.manageFxSnapshot",
        "labor.readSalary",
        "labor.confirmPayroll",
        "production.readLaborQuantity",
        "tradeDocuments.read",
        "tradeDocuments.manage",
        "documents.generate",
        "documents.readSensitive",
        "documents.import",
        "documents.export",
        "reports.readConsolidated",
        "reports.reviewDaily",
        "notifications.retry",
        "media.upload",
        "approvals.request",
      ],
      own: ["media.updateOwnMetadata"],
    }),
  },
  {
    key: "SUPPLIER_MANAGER",
    labels: { vi: "Quản lý nhà cung cấp", en: "Supplier Manager" },
    summary: {
      vi: "Nhà cung cấp, hợp đồng đang thực hiện, đơn mua nguyên liệu, tạm ứng và thay đổi đơn giá.",
      en: "Suppliers, active contracts, material purchase orders, advances, and unit-price changes.",
    },
    // Submits supplier financial changes; approval belongs to the Company
    // Accountant or the Director.
    permissions: grants({
      assignedBusinessUnits: [
        ...sharedOperationalReads,
        "suppliers.create",
        "suppliers.update",
        "procurement.create",
        "procurement.update",
        "procurement.addVersion",
        "procurement.submit",
        "procurement.requestPriceChange",
        "procurement.requestAdvance",
        "payables.read",
        "payments.read",
        "tradeDocuments.read",
        "tradeDocuments.manage",
        "documents.generate",
        "documents.import",
        "documents.export",
        "media.upload",
        "reports.submitDaily",
        "approvals.request",
      ],
      own: ["media.updateOwnMetadata"],
    }),
  },
  {
    key: "REPORT_VIEWER",
    labels: { vi: "Người xem báo cáo", en: "Report Viewer" },
    summary: {
      vi: "Chỉ đọc báo cáo vận hành trong phạm vi đơn vị được cấp.",
      en: "Read-only operational reports within the granted business units.",
    },
    permissions: grants({
      assignedBusinessUnits: [...sharedOperationalReads, "documents.export"],
    }),
  },
] as const satisfies readonly RoleDefinitionSeed[];

const seedsByKey = new Map<SystemRoleKey, RoleDefinitionSeed>(
  roleDefinitionSeeds.map((seed) => [seed.key, seed]),
);

export function getRoleDefinitionSeed(
  key: SystemRoleKey,
): RoleDefinitionSeed | null {
  return seedsByKey.get(key) ?? null;
}

/**
 * Roles that may decide a Director approval request. Kept explicit so the
 * approval service never has to test a role name inline.
 */
export const approvalDecidingRoleKeys = [
  "SUPER_ADMIN",
  "DIRECTOR",
] as const satisfies readonly SystemRoleKey[];
