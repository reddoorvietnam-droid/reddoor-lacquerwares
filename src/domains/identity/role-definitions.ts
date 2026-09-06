import {
  permissionCatalog,
  type Permission,
} from "@/domains/identity/permissions";
import type { PermissionScope } from "@/domains/identity/contracts";

export const systemRoleKeys = [
  "DIRECTOR",
  "FACTORY_MANAGER",
  "WAREHOUSE_MANAGER",
  "FACTORY_ACCOUNTANT",
  "COMPANY_ACCOUNTANT",
  "CONTENT_CREATOR",
] as const;

export type SystemRoleKey = (typeof systemRoleKeys)[number];

/**
 * Role keys that existed in earlier seeds and were merged into a surviving
 * role. The five operational roles mirror the five actual people on the
 * client's staff thread: the Director, the Factory Manager, the Storekeeper,
 * the Factory Accountant (who also purchases), and the Company Accountant (who
 * also coordinates orders). The Content Creator was added later for the
 * website editor; it is not a revival of the retired `CONTENT_EDITOR` key,
 * which stays retired. The seed script uses this map to deactivate the
 * retired definitions and to replace any grants they still carry with a grant
 * on the surviving role.
 */
export const retiredRoleReplacements = {
  SUPER_ADMIN: "DIRECTOR",
  REPORT_VIEWER: "DIRECTOR",
  CONTENT_EDITOR: "DIRECTOR",
  PRODUCT_DESIGNER: "FACTORY_MANAGER",
  PRODUCTION_UNIT: "FACTORY_MANAGER",
  SUPPLIER_MANAGER: "FACTORY_ACCOUNTANT",
  ORDER_MANAGER: "COMPANY_ACCOUNTANT",
} as const satisfies Record<string, SystemRoleKey>;

export type RetiredSystemRoleKey = keyof typeof retiredRoleReplacements;

export const retiredSystemRoleKeys = Object.keys(
  retiredRoleReplacements,
) as readonly RetiredSystemRoleKey[];

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
    key: "DIRECTOR",
    labels: { vi: "Giám đốc", en: "Director" },
    summary: {
      vi: "Quản trị hệ thống, duyệt toàn bộ nghiệp vụ trọng yếu, xem mọi báo cáo và quản lý nội dung website.",
      en: "Platform administration, approval of every significant operation, all reporting, and website content.",
    },
    // The Director absorbs the former Super Admin, Report Viewer, and Content
    // Editor roles: one person administers the platform, approves every
    // commercially significant action, reads every report, and owns the public
    // website. The only role holding the complete catalog; still bound by
    // state machines, separation of duties, and audit requirements.
    permissions: grants({ all: permissionCatalog }),
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
        // Work items and the assistant: the storekeeper tracks their own
        // steps of an order and asks about orders inside their units.
        "tasks.read",
        "tasks.create",
        "tasks.update",
        "assistant.use",
      ],
      own: [
        "media.updateOwnMetadata",
        "media.softDelete",
        "notifications.manageOwnChannels",
        // A personal to-do without an order has no business unit; `own`
        // lets the holder create and keep those alongside the unit ones.
        "tasks.read",
        "tasks.create",
        "tasks.update",
      ],
    }),
  },
  {
    key: "FACTORY_MANAGER",
    labels: { vi: "Quản lý nhà máy", en: "Factory Manager" },
    summary: {
      vi: "Tổ chức sản xuất, kế hoạch, xưởng phụ, chi phí nhà máy, chất lượng, phát triển sản phẩm và đơn hàng mẫu.",
      en: "Production organisation and planning, sub-workshops, factory cost, quality, product development, and sample orders.",
    },
    // Absorbs the former Production Unit and Product Designer roles: the
    // sub-workshops no longer sign in, so the Factory Manager records their
    // progress, material use, and QC evidence, and also develops products and
    // runs sample orders. That means the same person records progress and
    // approves QC — the Director approval gates remain the outside check.
    permissions: grants({
      own: [
        "expenses.create",
        "expenses.updateDraft",
        "expenses.submit",
        "media.updateOwnMetadata",
        "media.softDelete",
        "notifications.manageOwnChannels",
        "tasks.read",
        "tasks.create",
        "tasks.update",
      ],
      assignedBusinessUnits: [
        ...sharedOperationalReads,
        // Production planning (step 4) is this position's stage, so the
        // Factory Manager may approve an assistant-drafted plan for their
        // units and assign the resulting work.
        "tasks.read",
        "tasks.create",
        "tasks.update",
        "tasks.assign",
        "tasks.approvePlan",
        "assistant.use",
        "products.readCost",
        "products.create",
        "products.update",
        "products.manageVariants",
        "products.submitReview",
        "products.manageBom",
        "collections.readDraft",
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
        "samples.create",
        "samples.update",
        "samples.addRevision",
        "samples.submitInternalReview",
        "samples.recordInternalReview",
        "samples.recordCustomerReview",
        "samples.convert",
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
    labels: {
      vi: "Kế toán nhà máy & mua hàng",
      en: "Factory Accountant & Purchasing",
    },
    summary: {
      vi: "Chi phí nhà máy và xưởng phụ, lao động, nhà cung cấp, đơn mua nguyên liệu, tạm ứng và thay đổi đơn giá.",
      en: "Factory and sub-workshop cost, labor, suppliers, material purchase orders, advances, and unit-price changes.",
    },
    // Absorbs the former Supplier Manager role: the same person controls
    // factory cost and coordinates suppliers and purchasing. Submits cost and
    // supplier financial changes; approval and posting belong to the Company
    // Accountant or the Director. Never sees selling price or profit.
    permissions: grants({
      assignedBusinessUnits: [
        ...sharedOperationalReads,
        "products.readCost",
        "expenses.read",
        "expenses.create",
        "expenses.updateDraft",
        "expenses.submit",
        // No `payments.read`: a customer receipt reveals what the customer
        // paid and, through it, the selling price (confirmed 2026-09-05).
        "payables.read",
        "finance.readCost",
        "inventory.readValue",
        "inventory.export",
        "production.recordLabor",
        "production.readLaborQuantity",
        "labor.readSalary",
        "labor.manageRecords",
        "suppliers.create",
        "suppliers.update",
        "procurement.create",
        "procurement.update",
        "procurement.addVersion",
        "procurement.submit",
        "procurement.requestPriceChange",
        "procurement.requestAdvance",
        "tradeDocuments.read",
        "tradeDocuments.manage",
        "documents.generate",
        "documents.readSensitive",
        "documents.import",
        "documents.export",
        "media.upload",
        "reports.submitDaily",
        "approvals.request",
        "tasks.read",
        "tasks.create",
        "tasks.update",
        "assistant.use",
      ],
      own: [
        "media.updateOwnMetadata",
        "notifications.manageOwnChannels",
        "tasks.read",
        "tasks.create",
        "tasks.update",
      ],
    }),
  },
  {
    key: "COMPANY_ACCOUNTANT",
    labels: { vi: "Kế toán công ty", en: "Company Accountant" },
    summary: {
      vi: "Kế toán tài chính, đơn hàng và khách hàng, báo giá, điều phối giao hàng, hồ sơ nhập/xuất khẩu, lương và báo cáo lãi lỗ.",
      en: "Accounting and finance, orders and customers, quotes, delivery coordination, import/export files, payroll, and the profit and loss report.",
    },
    // Absorbs the former Order Manager role: the same person keeps the books
    // and runs customer, quote, and order coordination. That means this role
    // both requests and approves a price adjustment — the Director approval
    // gate on every price change remains the separation of duties. Confirmed
    // rule: together with the Director, the only role that may read selling
    // price and profit.
    permissions: grants({
      all: [
        ...sharedOperationalReads,
        "settings.read",
        "customers.read",
        "customers.readSensitive",
        "customers.create",
        "customers.update",
        // Website quote requests are the Director's inbox alone (confirmed
        // 2026-09-05); the accountant works from the quotes that follow.
        "quotes.read",
        "quotes.readSellingPrice",
        "quotes.create",
        "quotes.update",
        "quotes.addVersion",
        "quotes.submitReview",
        "quotes.send",
        "quotes.expire",
        "quotes.requestPriceAdjustment",
        "quotes.approvePriceAdjustment",
        "products.readSellingPrice",
        "products.readCost",
        "orders.readSellingPrice",
        "orders.create",
        "orders.updateDraft",
        // Step 2 of the order process: the Company Accountant opens the order
        // file and submits it for the Director's decision.
        "orders.submitForApproval",
        "orders.assignBusinessUnits",
        "orders.assignResponsibleUsers",
        "orders.transitionOperational",
        "orders.requestPriceAdjustment",
        "orders.approvePriceAdjustment",
        "orders.requestCancel",
        // Export progress on the order file: expected ready date and booking.
        "orders.updateExportProgress",
        "deliveries.plan",
        "deliveries.update",
        "packing.create",
        "packing.update",
        "packing.complete",
        "shipments.create",
        "shipments.update",
        "samples.create",
        "samples.update",
        "samples.addRevision",
        "samples.recordCustomerReview",
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
        // Sales invoices: revenue is recognised per INV.
        "invoices.read",
        "invoices.manage",
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
        // Retail shop orders placed by visitors: the accountant receives,
        // confirms, completes, and cancels them alongside the Director.
        "shopOrders.read",
        "shopOrders.manage",
        // Order coordination: the accountant opens the order file, so she
        // may approve the assistant's plan for it and assign the steps.
        "tasks.read",
        "tasks.create",
        "tasks.update",
        "tasks.assign",
        "tasks.approvePlan",
        "assistant.use",
      ],
      own: ["media.updateOwnMetadata", "notifications.manageOwnChannels"],
    }),
  },
  {
    key: "CONTENT_CREATOR",
    labels: { vi: "Biên tập nội dung", en: "Content Creator" },
    summary: {
      vi: "Viết và xuất bản tin tức, sản phẩm, bộ sưu tập và mặt hàng cửa hàng trên website. Không xem đơn hàng hay tài chính.",
      en: "Writes and publishes news, products, collections, and shop items on the website. No access to orders or finance.",
    },
    // Confirmed rule: the Director and the Content Creator are the only two
    // people who publish, and each may edit the other's work — so every
    // editorial write is global, not `own`. The shop retail price is public
    // data; the role still holds no internal price, order, or finance read.
    permissions: grants({
      all: [
        "content.read",
        "content.create",
        "content.update",
        "content.review",
        "content.publish",
        "content.archive",
        "media.read",
        "media.upload",
        "media.updateOwnMetadata",
        "media.softDelete",
        "shop.read",
        "shop.manage",
        "shop.publish",
        // The assistant answers about editorial work only: with no
        // `orders.read`, `tasks.read`, or finance permission, none of the
        // operational tools can run for this role.
        "assistant.use",
        "notifications.manageOwnChannels",
      ],
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
  "DIRECTOR",
] as const satisfies readonly SystemRoleKey[];
