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
] as const satisfies readonly Permission[];

const globallyScopedPermissionSet: ReadonlySet<string> = new Set<string>(
  globallyScopedPermissions,
);

export function requiresGlobalGrant(permission: Permission): boolean {
  return globallyScopedPermissionSet.has(permission);
}
