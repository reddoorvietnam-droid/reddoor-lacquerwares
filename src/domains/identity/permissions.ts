/**
 * Authoritative permission catalog.
 *
 * Names are `resource.action`. A permission is only meaningful together with a
 * scope (`own` < `assignedBusinessUnits` < `all`) carried by an AccessGrant.
 *
 * Three confirmed company rules shape the defaults in `role-definitions.ts`:
 *
 * 1. Selling price, margin, and profit are visible only to the Director and the
 *    Company Accountant. They are separate permissions, never implied by a
 *    resource read.
 * 2. Purchase price and ordinary operational data are readable by every active
 *    staff role. Reading is broad; writing is not.
 * 3. Editing requires an explicit grant, and every commercially significant
 *    action requires Director approval (see `@/domains/approvals`).
 */

export const permissionCatalog = [
  // Identity, organization, settings, audit.
  "users.read",
  "users.invite",
  "users.activate",
  "users.suspend",
  "users.manageRoles",
  "users.manageSuperAdmin",
  "roles.read",
  "roles.update",
  "businessUnits.read",
  "businessUnits.manage",
  "settings.read",
  "settings.updatePublic",
  "settings.publishPublic",
  "settings.manageSystem",
  "audit.read",
  "audit.export",
  "notifications.retry",
  "notifications.manageDeadLetter",

  // Content, translation, media, collections.
  "content.read",
  "content.create",
  "content.update",
  "content.review",
  "content.publish",
  "content.archive",
  "translations.update",
  "translations.review",
  "translations.publish",
  "media.read",
  "media.upload",
  "media.updateOwnMetadata",
  "media.softDelete",
  "collections.readDraft",
  "collections.create",
  "collections.update",
  "collections.updateHotspots",
  "collections.submitReview",
  "collections.approve",
  "collections.publish",
  "collections.rollback",
  "collections.archive",

  // Products, BOM, samples.
  "products.read",
  "products.readSellingPrice",
  "products.readCost",
  "products.create",
  "products.update",
  "products.manageVariants",
  "products.submitReview",
  "products.review",
  "products.publish",
  "products.discontinue",
  "products.archive",
  "products.manageBom",
  "samples.read",
  "samples.create",
  "samples.update",
  "samples.addRevision",
  "samples.submitInternalReview",
  "samples.recordInternalReview",
  "samples.recordCustomerReview",
  "samples.approve",
  "samples.reject",
  "samples.convert",

  // Customers, quote requests, quotes.
  "customers.read",
  "customers.readSensitive",
  "customers.create",
  "customers.update",
  "customers.archive",
  "quoteRequests.read",
  "quoteRequests.assign",
  "quoteRequests.update",
  "quoteRequests.close",
  "quoteRequests.markSpam",
  "quotes.read",
  "quotes.readSellingPrice",
  "quotes.create",
  "quotes.update",
  "quotes.addVersion",
  "quotes.submitReview",
  "quotes.approve",
  "quotes.reject",
  "quotes.send",
  "quotes.expire",
  "quotes.requestPriceAdjustment",
  "quotes.approvePriceAdjustment",

  // Sales orders, deliveries.
  "orders.read",
  "orders.readSellingPrice",
  "orders.create",
  "orders.updateDraft",
  "orders.submitForApproval",
  "orders.approve",
  "orders.confirm",
  "orders.assignBusinessUnits",
  "orders.assignResponsibleUsers",
  "orders.transitionOperational",
  "orders.requestPriceAdjustment",
  "orders.approvePriceAdjustment",
  "orders.requestCancel",
  "orders.cancel",
  "orders.close",
  // Export progress the Company Accountant keeps on the order file: expected
  // ready date and booking. Payment documents ride on `payments.record`.
  "orders.updateExportProgress",
  "deliveries.read",
  "deliveries.plan",
  "deliveries.update",
  "deliveries.confirmDispatch",

  // Suppliers and procurement.
  "suppliers.read",
  "suppliers.create",
  "suppliers.update",
  "suppliers.archive",
  "procurement.read",
  "procurement.readPrice",
  "procurement.create",
  "procurement.update",
  "procurement.addVersion",
  "procurement.submit",
  "procurement.approve",
  "procurement.cancel",
  "procurement.receive",
  "procurement.requestPriceChange",
  "procurement.requestAdvance",
  "procurement.approvePriceChange",
  "procurement.approveAdvance",

  // Inventory.
  "paintWarehouse.read",
  "paintWarehouse.create",
  "paintWarehouse.update",
  "paintWarehouse.delete",
  "paintWarehouse.export",
  "paintWarehouse.import",
  // Raw-material ledger ("Nguyên vật liệu"): a company-wide stock book kept
  // by the storekeeper. Reading covers every tab; writes are split by the
  // step they change so a future role can receive without issuing.
  "materials.read",
  "materials.manageCatalog",
  "materials.receive",
  "materials.issue",
  "materials.cancel",
  "materials.export",
  "materials.import",
  "inventory.read",
  "inventory.readValue",
  "inventory.receive",
  "inventory.issue",
  "inventory.reserve",
  "inventory.release",
  "inventory.transfer",
  "inventory.transferCrossUnit",
  "inventory.requestAdjustment",
  "inventory.adjust",
  "inventory.approveAdjustment",
  "inventory.stocktake",
  "inventory.import",
  "inventory.export",

  // Production, labor, QC.
  "production.read",
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
  "labor.readSalary",
  "labor.manageRecords",
  "labor.confirmPayroll",

  // Finance.
  "expenses.read",
  "expenses.create",
  "expenses.updateDraft",
  "expenses.submit",
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
  // Sales invoices (INV): revenue is recognised per invoice, so the invoice
  // amount is as commercial as the selling price and stays with the Director
  // and the Company Accountant.
  "invoices.read",
  "invoices.manage",
  // Phiếu bán hàng ("Hóa đơn bán hàng"): the internal sales slip that replaces
  // `08092026.xlsx`. It carries a selling price, so reading money on it is a
  // separate permission (rule 1) that only the Director and the Company
  // Accountant hold by default; editing a price is separate again.
  "salesSlips.read",
  "salesSlips.create",
  "salesSlips.update",
  "salesSlips.confirm",
  "salesSlips.cancel",
  "salesSlips.readPrice",
  "salesSlips.editPrice",
  "salesSlips.print",
  "salesSlips.export",
  "salesSlips.import",
  // Công nợ phải thu khách hàng: the counter debt book that replaces
  // `Reddoor-congno-2026.xlsx`. Distinct from `receivables.read`, which reads
  // the order/INV receivables the Company Accountant keeps — these two ledgers
  // track different counterparties and never share a figure. Money on it is a
  // separate permission (rule 1); the storekeeper holds it because they run the
  // counter, the same way they already hold `salesSlips.readPrice`.
  "customerDebt.read",
  "customerDebt.readAmount",
  "customerDebt.recordSale",
  "customerDebt.recordReduction",
  // Correcting a recorded line in place, audited field by field. Kept apart
  // from recording so a future role could write without being able to rewrite.
  "customerDebt.updateEntry",
  "customerDebt.cancelEntry",
  // Adding a paint code or repricing one. It writes the SHARED paint
  // catalogue (paintwarehousemasters), never a copy of it.
  "customerDebt.manageCatalog",
  "customerDebt.manageCustomer",
  "customerDebt.updateOpeningBalance",
  "customerDebt.export",
  "customerDebt.import",

  // Packing, shipping, trade documents.
  "packing.read",
  "packing.create",
  "packing.update",
  "packing.complete",
  "shipments.read",
  "shipments.create",
  "shipments.update",
  "shipments.dispatch",
  "tradeDocuments.read",
  "tradeDocuments.manage",

  // Generated documents and reports.
  "documents.read",
  "documents.generate",
  "documents.download",
  "documents.readSensitive",
  "documents.import",
  "documents.export",
  "reports.readOperational",
  "reports.readConsolidated",
  "reports.submitDaily",
  "reports.reviewDaily",
  "reports.sendDigest",

  // Director approval queue (see `@/domains/approvals`).
  "approvals.read",
  "approvals.request",
  "approvals.decide",

  // Retail shop: items sold from stock at a public retail price, and the
  // guest orders visitors place against them. The retail price is public
  // data and is unrelated to the internal selling price (RBAC rule 1).
  "shop.read",
  "shop.manage",
  "shop.publish",
  "shopOrders.read",
  "shopOrders.manage",

  // Work items ("việc cần làm"): the durable to-do list behind the AI
  // assistant's plans and reminders. A task inherits the business units of
  // the order it belongs to; `own` reaches tasks the actor created or is
  // assigned to. `tasks.approvePlan` releases an assistant-proposed plan into
  // real tasks — a draft never becomes work without a person approving it.
  "tasks.read",
  "tasks.create",
  "tasks.update",
  "tasks.assign",
  "tasks.approvePlan",

  // The in-portal AI assistant. Holding it opens the chat; every tool the
  // assistant calls still re-checks the permission that governs the data.
  "assistant.use",
  // Linking one's own Zalo identity for reminders; never another user's.
  "notifications.manageOwnChannels",
] as const;

export type Permission = (typeof permissionCatalog)[number];

const permissionSet: ReadonlySet<string> = new Set<string>(permissionCatalog);

export function isPermission(value: string): value is Permission {
  return permissionSet.has(value);
}

/**
 * Permissions that expose commercially sensitive values. A resource read never
 * implies these; repositories must omit the protected fields when the actor
 * lacks the matching permission.
 */
export const sensitiveFieldPermissions = [
  "customers.readSensitive",
  "products.readSellingPrice",
  "products.readCost",
  "quotes.readSellingPrice",
  "orders.readSellingPrice",
  "inventory.readValue",
  "procurement.readPrice",
  "finance.readCost",
  "finance.readProfit",
  "labor.readSalary",
  "documents.readSensitive",
  "audit.export",
  "salesSlips.readPrice",
  "customerDebt.readAmount",
] as const satisfies readonly Permission[];

export type SensitiveFieldPermission =
  (typeof sensitiveFieldPermissions)[number];

/**
 * Permissions that only an explicitly global grant may satisfy.
 *
 * These are review, approval, publication, rollback, and platform-administration
 * actions. A grant narrowed to a business unit never satisfies them, so an
 * `assignedBusinessUnits` or `own` candidate is not enough even when the role
 * definition names the permission.
 */
export const globallyScopedPermissions = [
  "users.manageSuperAdmin",
  "roles.update",
  "settings.publishPublic",
  "settings.manageSystem",
  "content.review",
  "content.publish",
  "content.archive",
  "translations.review",
  "translations.publish",
  "collections.approve",
  "collections.publish",
  "collections.rollback",
  "collections.archive",
  "products.review",
  "products.publish",
  "products.discontinue",
  "products.archive",
  "samples.approve",
  "samples.reject",
  "quotes.approve",
  "quotes.reject",
  "orders.approve",
  "orders.cancel",
  "orders.close",
  "reports.readConsolidated",
  "reports.sendDigest",
  "approvals.decide",
  "shop.publish",
] as const satisfies readonly Permission[];

const globallyScopedPermissionSet: ReadonlySet<string> = new Set<string>(
  globallyScopedPermissions,
);

export function requiresGlobalGrant(permission: Permission): boolean {
  return globallyScopedPermissionSet.has(permission);
}
