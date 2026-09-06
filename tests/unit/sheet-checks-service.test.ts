import { describe, expect, it } from "vitest";

import type { Permission } from "@/domains/identity/permissions";
import type { SystemRoleKey } from "@/domains/identity/role-definitions";
import {
  opportunisticPermissions,
  SheetCheckError,
  sheetCheckReadPermissions,
  templateGates,
  type RunSheetCheckInput,
  type SheetCheckAuthorizationView,
  type SheetCheckDto,
  type SheetCheckReadStores,
  type SheetCheckServiceDependencies,
  type SheetCheckTemplate,
} from "@/domains/sheet-checks/contracts";
import { sheetCheckLimits } from "@/domains/sheet-checks/limits";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";

import { authFor, roleUsers, snapshotFor } from "./helpers/assistant-fakes";
import { accessContext, nextId, unitId } from "./helpers/finance-fakes";
import {
  buildSheetCheckService,
  gridBytes,
  mergeContexts,
  sheetCheckNow,
} from "./helpers/sheet-check-fakes";

/**
 * The permission logic of the sheet check, proven with the REAL role seeds
 * and the REAL evaluator: every context is obtained exactly the way the
 * route, the page and the action obtain it (requireListAccess / a chain of
 * requirePermission calls merged together), so a role can only reach what
 * its grants reach — and the service is shown to refuse on its own when a
 * context arrives without the permission a check needs.
 */

const otherUnitId = "222222222222222222222222";
const DAY_MS = 86_400_000;

type Harness = ReturnType<typeof buildSheetCheckService>;

const genericGrid = [
  ["Mã đơn", "Khách", "Số tiền"],
  ["RD-0001", "Công ty ABC", "1.000.000"],
  ["RD-0002", "Đơn vị khác", "2.000.000"],
  ["RD-9999", "Bí Mật Xyzzy Co", "3.000.000"],
];
const cashGrid = [
  ["Ngày", "Khách", "Số tiền"],
  ["2026-08-15", "Công ty ABC", "25.000.000"],
  ["2026-08-20", "Công ty ABC", "7.000.000"],
];
const receivablesGrid = [
  ["Khách", "Dư nợ"],
  ["Công ty ABC", "70.000.000"],
];

function guardFor(
  role: SystemRoleKey,
  options: { businessUnitId?: string | null; revoked?: boolean } = {},
) {
  const snapshot = snapshotFor(role, options);
  return { snapshot, guard: authFor(snapshot, sheetCheckNow) };
}

/** The upload route: `documents.import` list access + the template gate (+ global extras, as the action does for generic). */
async function uploadContext(
  role: SystemRoleKey,
  template: SheetCheckTemplate,
  options: { businessUnitId?: string; extras?: readonly Permission[] } = {},
): Promise<AccessContext> {
  const { guard } = guardFor(
    role,
    options.businessUnitId ? { businessUnitId: options.businessUnitId } : {},
  );
  let context = (await guard.requireListAccess("documents.import")).context;
  if (template === "generic") {
    context = mergeContexts(
      context,
      (await guard.requireListAccess("orders.read")).context,
    );
  } else {
    for (const permission of templateGates[template]) {
      context = mergeContexts(
        context,
        await guard.requirePermission(permission),
      );
    }
  }
  const extras = options.extras ?? [];
  if (extras.length > 0) {
    const coverages = await guard.coverages(extras);
    for (const permission of extras) {
      if (coverages[permission].global) {
        context = mergeContexts(
          context,
          await guard.requirePermission(permission),
        );
      }
    }
  }
  return context;
}

function viewOf(check: SheetCheckDto): SheetCheckAuthorizationView {
  return {
    id: check.id,
    status: check.status,
    template: check.template,
    createdByUserId: check.createdByUserId,
    businessUnitIds: check.businessUnitIds,
    requiredPermissions: check.requiredPermissions,
  };
}

/** The result page / export route / tools: `documents.read` on the target + every stamped permission. */
async function readerContext(
  role: SystemRoleKey,
  view: SheetCheckAuthorizationView,
  options: { businessUnitId?: string; revoked?: boolean } = {},
): Promise<AccessContext> {
  const { guard } = guardFor(role, {
    ...(options.businessUnitId
      ? { businessUnitId: options.businessUnitId }
      : {}),
    ...(options.revoked ? { revoked: true } : {}),
  });
  let context = await guard.requirePermission("documents.read", {
    resourceId: view.id,
    ownerUserId: view.createdByUserId,
    businessUnitIds: view.businessUnitIds,
  });
  for (const permission of view.requiredPermissions) {
    context = mergeContexts(
      context,
      await guard.requirePermission(permission, {
        resourceId: view.id,
        businessUnitIds: view.businessUnitIds,
      }),
    );
  }
  return context;
}

/** The run/discard/rerun actions: `documents.import` on the target + gates (+ global extras). */
async function actorContext(
  role: SystemRoleKey,
  view: SheetCheckAuthorizationView,
  options: { extras?: readonly Permission[]; businessUnitId?: string } = {},
): Promise<AccessContext> {
  const { guard } = guardFor(
    role,
    options.businessUnitId ? { businessUnitId: options.businessUnitId } : {},
  );
  let context = await guard.requirePermission("documents.import", {
    resourceId: view.id,
    ownerUserId: view.createdByUserId,
    businessUnitIds: view.businessUnitIds,
  });
  if (view.template === "generic") {
    context = mergeContexts(
      context,
      (await guard.requireListAccess("orders.read")).context,
    );
  } else {
    for (const permission of templateGates[view.template]) {
      context = mergeContexts(
        context,
        await guard.requirePermission(permission),
      );
    }
  }
  const extras = options.extras ?? [];
  if (extras.length > 0) {
    const coverages = await guard.coverages(extras);
    for (const permission of extras) {
      if (coverages[permission].global) {
        context = mergeContexts(
          context,
          await guard.requirePermission(permission),
        );
      }
    }
  }
  return context;
}

function seedBusinessData(h: Harness) {
  h.orders.seed({
    orderCode: "RD-0001",
    customerName: "Công ty ABC",
    businessUnitIds: [unitId],
    sellingPrice: { amount: "1000000", currency: "VND" },
    stage: "inProduction",
  });
  h.orders.seed({
    orderCode: "RD-0002",
    customerName: "Đơn vị khác",
    businessUnitIds: [otherUnitId],
    sellingPrice: { amount: "2500000", currency: "VND" },
  });
  h.finance.seed({
    amount: { amount: "25000000", currency: "VND" },
    category: "orderPayment",
    occurredAt: new Date("2026-08-15T03:00:00.000Z"),
    counterparty: "Công ty ABC",
  });
  h.finance.seed({
    amount: { amount: "7000000", currency: "VND" },
    category: "orderPayment",
    status: "voided",
    voidReason: "nhầm",
    occurredAt: new Date("2026-08-20T03:00:00.000Z"),
  });
  h.finance.seed({
    amount: { amount: "999000", currency: "VND" },
    category: "otherIncome",
    occurredAt: new Date("2026-08-21T03:00:00.000Z"),
  });
  h.finance.seed({
    kind: "expense",
    category: "refund",
    amount: { amount: "500000", currency: "VND" },
    occurredAt: new Date("2026-08-22T03:00:00.000Z"),
  });
  h.customers.seed({ name: "Công ty ABC", code: "KH0001" });
  h.invoices.seed({
    orderId: [...h.orders.orders.keys()][0]!,
    orderCode: "RD-0001",
    invoiceNumber: "INV-0001",
  });
}

function build() {
  const h = buildSheetCheckService();
  seedBusinessData(h);
  return h;
}

async function create(
  h: Harness,
  role: SystemRoleKey,
  template: SheetCheckTemplate,
  options: {
    businessUnitId?: string;
    grid?: readonly (readonly string[])[];
    fileName?: string;
  } = {},
): Promise<SheetCheckDto> {
  const context = await uploadContext(
    role,
    template,
    options.businessUnitId ? { businessUnitId: options.businessUnitId } : {},
  );
  const grid =
    options.grid ??
    (template === "generic"
      ? genericGrid
      : template === "incomingCash"
        ? cashGrid
        : receivablesGrid);
  return h.service.createFromFile(context, {
    template,
    bytes: gridBytes(grid),
    fileName: options.fileName ?? "bao-cao.xlsx",
    sheetSelector: null,
  });
}

function runInput(
  check: SheetCheckDto,
  overrides: Partial<RunSheetCheckInput["mapping"]> = {},
  expectedRevision = check.revision,
): RunSheetCheckInput {
  return {
    checkId: check.id,
    expectedRevision,
    mapping: {
      columns: check.mapping.columns.map((column) => ({ ...column })),
      defaultCurrency: check.mapping.defaultCurrency,
      period: check.mapping.period,
      compareSellingPrice: false,
      ...overrides,
    },
  };
}

async function run(
  h: Harness,
  role: SystemRoleKey,
  check: SheetCheckDto,
  options: {
    extras?: readonly Permission[];
    mapping?: Partial<RunSheetCheckInput["mapping"]>;
    businessUnitId?: string;
  } = {},
): Promise<SheetCheckDto> {
  const context = await actorContext(role, viewOf(check), {
    ...(options.extras ? { extras: options.extras } : {}),
    ...(options.businessUnitId
      ? { businessUnitId: options.businessUnitId }
      : {}),
  });
  return h.service.run(context, runInput(check, options.mapping ?? {}));
}

async function expectDenied(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(ContentAccessDeniedError);
}

async function expectCode(
  promise: Promise<unknown>,
  code: SheetCheckError["code"],
): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    name: "SheetCheckError",
    code,
  });
}

/* ------------------------------------------------------------------ */
/* Dependency type: read methods only                                  */
/* ------------------------------------------------------------------ */

type WriteMethod =
  | "insert"
  | "update"
  | "void"
  | "setAllocations"
  | "applyTransition"
  | "setQcPassed"
  | "setSellingPrice"
  | "setExportProgress"
  | "addPaymentDocument"
  | "removePaymentDocument"
  | "addDocument"
  | "removeDocument"
  | "setStatus"
  | "upsert"
  | "create"
  | "delete";
type NoWrites<T> = [Extract<keyof T, WriteMethod>] extends [never]
  ? true
  : false;
type StoreKeys = keyof SheetCheckReadStores;

const orderStoreIsReadOnly: NoWrites<SheetCheckReadStores["orderStore"]> = true;
const invoiceStoreIsReadOnly: NoWrites<SheetCheckReadStores["invoiceStore"]> =
  true;
const financeStoreIsReadOnly: NoWrites<
  SheetCheckReadStores["financeEntryStore"]
> = true;
const customerStoreIsReadOnly: NoWrites<SheetCheckReadStores["customerStore"]> =
  true;
const dependenciesCarryOnlyReadStores: NoWrites<
  SheetCheckServiceDependencies[StoreKeys]
> = true;

describe("SheetCheckService dependency type", () => {
  it("names no write method on any business store", () => {
    expect(orderStoreIsReadOnly).toBe(true);
    expect(invoiceStoreIsReadOnly).toBe(true);
    expect(financeStoreIsReadOnly).toBe(true);
    expect(customerStoreIsReadOnly).toBe(true);
    expect(dependenciesCarryOnlyReadStores).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Create: gates and scope stamping                                    */
/* ------------------------------------------------------------------ */

describe("SheetCheckService.createFromFile", () => {
  it("refuses a FACTORY_ACCOUNTANT cash report at the guard and again in the service, with an audit denial", async () => {
    const h = build();
    const { guard } = guardFor("FACTORY_ACCOUNTANT");
    // The route asks the guard for the gate: the role has no payments.read.
    await expectDenied(guard.requirePermission("payments.read"));
    // A context that only carries documents.import is refused by the service itself.
    const importOnly = (await guard.requireListAccess("documents.import"))
      .context;
    await expectDenied(
      h.service.createFromFile(importOnly, {
        template: "incomingCash",
        bytes: gridBytes(cashGrid),
        fileName: "tien-ve.xlsx",
        sheetSelector: null,
      }),
    );
    expect(h.store.checks.size).toBe(0);
    expect(
      h.audit.events.some(
        (event) =>
          event.action === "sheetCheck.denied" &&
          event.permissionDecision?.permission === "payments.read" &&
          event.permissionDecision.outcome === "denied",
      ),
    ).toBe(true);
  });

  it("refuses a FACTORY_ACCOUNTANT receivables statement", async () => {
    const h = build();
    const { guard } = guardFor("FACTORY_ACCOUNTANT");
    await expectDenied(guard.requirePermission("receivables.read"));
    const importOnly = (await guard.requireListAccess("documents.import"))
      .context;
    await expectDenied(
      h.service.createFromFile(importOnly, {
        template: "receivables",
        bytes: gridBytes(receivablesGrid),
        fileName: "cong-no.xlsx",
        sheetSelector: null,
      }),
    );
  });

  it("stamps a FACTORY_ACCOUNTANT generic check with the grant's units, not anything in the file", async () => {
    const h = build();
    const check = await create(h, "FACTORY_ACCOUNTANT", "generic", {
      grid: [
        ["Mã đơn", "Khách", "Đơn vị"],
        ["RD-0001", "Công ty ABC", otherUnitId],
      ],
    });
    expect(check.status).toBe("mapping");
    expect(check.scopeKind).toBe("businessUnits");
    expect(check.businessUnitIds).toEqual([unitId]);
    expect(check.requiredPermissions).toEqual(["orders.read"]);
    expect(check.createdByUserId).toBe(roleUsers.FACTORY_ACCOUNTANT.id);
    expect(check.result).toBeNull();
    expect(check.rowCount).toBe(1);
    expect(check.dataRowCount).toBe(1);
    expect(check.proposal.columns.map((column) => column.field)).toEqual([
      "orderCode",
      "customerName",
      "ignore",
    ]);
    expect(check.expiresAt.getTime()).toBe(
      check.createdAt.getTime() + sheetCheckLimits.draftRetentionDays * DAY_MS,
    );
    expect(h.store.rows.get(check.id)).toHaveLength(1);
  });

  it("stamps a COMPANY_ACCOUNTANT receivables check global with the three money gates", async () => {
    const h = build();
    const check = await create(h, "COMPANY_ACCOUNTANT", "receivables");
    expect(check.scopeKind).toBe("all");
    expect(check.businessUnitIds).toEqual([]);
    expect(check.requiredPermissions).toEqual([
      "receivables.read",
      "invoices.read",
      "payments.read",
    ]);
  });

  it("writes an audit event with units, request id and metadata free of cell text", async () => {
    const h = build();
    const check = await create(h, "FACTORY_ACCOUNTANT", "generic");
    const event = h.audit.events.find(
      (entry) => entry.action === "sheetCheck.created",
    );
    expect(event).toBeDefined();
    expect(event?.resourceId).toBe(check.id);
    expect(event?.businessUnitIds).toEqual([unitId]);
    expect(event?.requestId).toBe("req");
    expect(event?.metadata).toEqual({
      template: "generic",
      fileFormat: "xlsx",
      fileBytes: gridBytes(genericGrid).length,
      rowCount: 3,
      columnCount: 3,
      headerFound: true,
    });
    const serialized = JSON.stringify(h.audit.events);
    expect(serialized).not.toContain("Bí Mật");
    expect(serialized).not.toContain("RD-9999");
    expect(serialized).not.toContain("3.000.000");
  });

  it("denies CONTENT_CREATOR at the guard and in the service", async () => {
    const h = build();
    const { guard } = guardFor("CONTENT_CREATOR");
    await expectDenied(guard.requireListAccess("documents.import"));
    await expectDenied(guard.requireListAccess("documents.read"));
    const editorial = accessContext(
      ["assistant.use", "content.read"],
      "all",
      roleUsers.CONTENT_CREATOR.id,
    );
    await expectDenied(
      h.service.createFromFile(editorial, {
        template: "generic",
        bytes: gridBytes(genericGrid),
        fileName: "x.xlsx",
        sheetSelector: null,
      }),
    );
    await expectDenied(
      h.service.listForReader(editorial, {}, { limit: 50, offset: 0 }),
    );
  });

  it("keeps a personal (own-scope) importer's check reachable by the creator only", async () => {
    const h = build();
    const own = accessContext(
      ["documents.import", "orders.read"],
      "own",
      roleUsers.WAREHOUSE_MANAGER.id,
    );
    const check = await h.service.createFromFile(own, {
      template: "generic",
      bytes: gridBytes(genericGrid),
      fileName: "x.xlsx",
      sheetSelector: null,
    });
    expect(check.scopeKind).toBe("businessUnits");
    expect(check.businessUnitIds).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Read rule                                                           */
/* ------------------------------------------------------------------ */

describe("SheetCheckService read rule", () => {
  it("denies a FACTORY_ACCOUNTANT the COMPANY_ACCOUNTANT's receivables check", async () => {
    const h = build();
    const check = await create(h, "COMPANY_ACCOUNTANT", "receivables");
    await expectDenied(readerContext("FACTORY_ACCOUNTANT", viewOf(check)));
    const { guard } = guardFor("FACTORY_ACCOUNTANT");
    const readOnly = (await guard.requireListAccess("documents.read")).context;
    await expectDenied(h.service.get(readOnly, check.id));
    await expectDenied(
      h.service.listRows(readOnly, check.id, { offset: 0, limit: 10 }),
    );
    await expectDenied(h.service.findRow(readOnly, check.id, 0));
    await expectDenied(h.service.exportCsv(readOnly, check.id, "vi"));
  });

  it("lets a WAREHOUSE_MANAGER of the same unit read the FACTORY_ACCOUNTANT's generic check", async () => {
    const h = build();
    const check = await run(
      h,
      "FACTORY_ACCOUNTANT",
      await create(h, "FACTORY_ACCOUNTANT", "generic"),
    );
    const context = await readerContext("WAREHOUSE_MANAGER", viewOf(check));
    const read = await h.service.get(context, check.id);
    expect(read.id).toBe(check.id);
    const page = await h.service.listRows(context, check.id, {
      offset: 0,
      limit: 10,
    });
    expect(page.rows).toHaveLength(3);
    expect(page.issueRowCount).toBe(3);
    const row = await h.service.findRow(context, check.id, 2);
    expect(row.result?.outcome).toBe("notFound");
  });

  it("denies a FACTORY_MANAGER the DIRECTOR's generic check that compared selling prices", async () => {
    const h = build();
    const check = await run(
      h,
      "DIRECTOR",
      await create(h, "DIRECTOR", "generic"),
      {
        extras: opportunisticPermissions,
        mapping: { compareSellingPrice: true },
      },
    );
    expect(check.requiredPermissions).toContain("orders.readSellingPrice");
    await expectDenied(readerContext("FACTORY_MANAGER", viewOf(check)));
    const { guard } = guardFor("FACTORY_MANAGER");
    const partial = mergeContexts(
      (await guard.requireListAccess("documents.read")).context,
      (await guard.requireListAccess("orders.read")).context,
    );
    await expectDenied(h.service.get(partial, check.id));
    await expectDenied(h.service.exportCsv(partial, check.id, "vi"));
  });

  it("lets the DIRECTOR and the COMPANY_ACCOUNTANT read every check", async () => {
    const h = build();
    const cash = await run(
      h,
      "COMPANY_ACCOUNTANT",
      await create(h, "COMPANY_ACCOUNTANT", "incomingCash"),
    );
    const generic = await create(h, "FACTORY_ACCOUNTANT", "generic");
    for (const role of ["DIRECTOR", "COMPANY_ACCOUNTANT"] as const) {
      for (const check of [cash, generic]) {
        const context = await readerContext(role, viewOf(check));
        expect((await h.service.get(context, check.id)).id).toBe(check.id);
      }
    }
  });

  it("denies a reader whose grant was revoked or whose session went stale", async () => {
    const h = build();
    const check = await run(
      h,
      "COMPANY_ACCOUNTANT",
      await create(h, "COMPANY_ACCOUNTANT", "incomingCash"),
    );
    const before = await readerContext("COMPANY_ACCOUNTANT", viewOf(check));
    expect((await h.service.get(before, check.id)).id).toBe(check.id);

    await expectDenied(
      readerContext("COMPANY_ACCOUNTANT", viewOf(check), { revoked: true }),
    );

    const snapshot = snapshotFor("COMPANY_ACCOUNTANT");
    const guard = authFor(snapshot, sheetCheckNow);
    snapshot.user.authzVersion += 1;
    await expect(
      guard.requirePermission("documents.read", { resourceId: check.id }),
    ).rejects.toMatchObject({ code: "STALE_SESSION" });

    // Even a context that still names documents.read but lost payments.read is refused.
    const withoutMoney = accessContext(
      ["documents.read"],
      "all",
      roleUsers.COMPANY_ACCOUNTANT.id,
    );
    await expectDenied(h.service.get(withoutMoney, check.id));
  });

  it("answers NOT_FOUND for an unknown check and an unknown row", async () => {
    const h = build();
    const check = await create(h, "DIRECTOR", "generic");
    const context = await readerContext("DIRECTOR", viewOf(check));
    await expectCode(h.service.get(context, nextId("5")), "NOT_FOUND");
    await expectCode(h.service.findRow(context, check.id, 99), "NOT_FOUND");
    expect(await h.service.findForAuthorization(nextId("5"))).toBeNull();
    expect(await h.service.findForAuthorization(check.id)).toEqual(
      viewOf(check),
    );
  });
});

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */

describe("SheetCheckService.listForReader", () => {
  it("shows a unit reader only the generic checks of their unit — never a money check, never a locked placeholder", async () => {
    const h = build();
    const ownUnit = await create(h, "FACTORY_ACCOUNTANT", "generic");
    const colleague = await create(h, "WAREHOUSE_MANAGER", "generic");
    const otherUnit = await create(h, "FACTORY_ACCOUNTANT", "generic", {
      businessUnitId: otherUnitId,
    });
    const receivables = await create(h, "COMPANY_ACCOUNTANT", "receivables");
    const cash = await create(h, "DIRECTOR", "incomingCash");
    const directorGeneric = await run(
      h,
      "DIRECTOR",
      await create(h, "DIRECTOR", "generic"),
      {
        extras: opportunisticPermissions,
        mapping: { compareSellingPrice: true },
      },
    );

    const { guard } = guardFor("WAREHOUSE_MANAGER");
    const { context } = await guard.requireListAccess("documents.read");
    const coverages = await guard.coverages(sheetCheckReadPermissions);
    const listed = await h.service.listForReader(context, coverages, {
      limit: 50,
      offset: 0,
    });
    const ids = listed.map((check) => check.id).sort();
    expect(ids).toEqual([ownUnit.id, colleague.id].sort());
    for (const hidden of [otherUnit, receivables, cash, directorGeneric]) {
      expect(ids).not.toContain(hidden.id);
    }
    expect(JSON.stringify(listed)).not.toMatch(/locked/i);

    const filtered = await h.service.listForReader(context, coverages, {
      template: "generic",
      status: "mapping",
      limit: 1,
      offset: 1,
    });
    expect(filtered).toHaveLength(1);
  });

  it("shows the DIRECTOR everything and a FACTORY_MANAGER only unit generic checks without money permissions", async () => {
    const h = build();
    const generic = await create(h, "FACTORY_ACCOUNTANT", "generic");
    const cash = await create(h, "COMPANY_ACCOUNTANT", "incomingCash");
    const priced = await run(
      h,
      "DIRECTOR",
      await create(h, "DIRECTOR", "generic"),
      {
        extras: opportunisticPermissions,
        mapping: { compareSellingPrice: true },
      },
    );

    const director = guardFor("DIRECTOR").guard;
    const all = await h.service.listForReader(
      (await director.requireListAccess("documents.read")).context,
      await director.coverages(sheetCheckReadPermissions),
      { limit: 50, offset: 0 },
    );
    expect(all.map((check) => check.id).sort()).toEqual(
      [generic.id, cash.id, priced.id].sort(),
    );

    const manager = guardFor("FACTORY_MANAGER").guard;
    const visible = await h.service.listForReader(
      (await manager.requireListAccess("documents.read")).context,
      await manager.coverages(sheetCheckReadPermissions),
      { limit: 50, offset: 0 },
    );
    expect(visible.map((check) => check.id)).toEqual([generic.id]);
  });

  it("requires documents.read", async () => {
    const h = build();
    const context = accessContext(["orders.read"], "all");
    await expectDenied(
      h.service.listForReader(context, {}, { limit: 10, offset: 0 }),
    );
  });
});

/* ------------------------------------------------------------------ */
/* Run                                                                 */
/* ------------------------------------------------------------------ */

describe("SheetCheckService.run", () => {
  it("loads only the orders of the runner's units for a FACTORY_ACCOUNTANT generic run and never touches finance or customers", async () => {
    const h = build();
    const check = await run(
      h,
      "FACTORY_ACCOUNTANT",
      await create(h, "FACTORY_ACCOUNTANT", "generic"),
    );
    expect(check.status).toBe("checked");
    expect(check.requiredPermissions).toEqual(["orders.read"]);
    expect(check.checkedAt).toEqual(sheetCheckNow);
    expect(check.expiresAt.getTime()).toBe(
      sheetCheckNow.getTime() + sheetCheckLimits.checkedRetentionDays * DAY_MS,
    );
    expect(check.revision).toBe(1);

    expect(h.calls.get("orderStore.list")).toBe(1);
    expect(h.calls.get("invoiceStore.list")).toBeUndefined();
    expect(h.calls.get("financeEntryStore.list")).toBeUndefined();
    expect(h.calls.get("financeEntryStore.listActive")).toBeUndefined();
    expect(h.calls.get("customerStore.list")).toBeUndefined();

    const input = h.seen[0]!;
    expect(input.system.orders?.map((order) => order.orderCode)).toEqual([
      "RD-0001",
    ]);
    expect(input.system.invoices).toBeNull();
    expect(input.system.receipts).toBeNull();
    expect(input.system.refunds).toBeNull();
    expect(input.system.customers).toBeNull();
    expect(input.system.sellingPriceVisible).toBe(false);
    expect(input.timeZone).toBe("Asia/Ho_Chi_Minh");
    expect(input.now).toEqual(sheetCheckNow);

    // An order of another unit and a non-existent order yield the same finding.
    const rows = h.store.rows.get(check.id)!;
    const otherUnitIssue = rows[1]!.result!.issues.find(
      (entry) => entry.code === "ORDER_NOT_FOUND",
    );
    const missingIssue = rows[2]!.result!.issues.find(
      (entry) => entry.code === "ORDER_NOT_FOUND",
    );
    expect(otherUnitIssue).toEqual({
      ...missingIssue,
      params: { code: "RD-0002" },
    });
    expect(rows[0]!.result!.system?.order?.sellingPrice).toBeNull();
    expect(JSON.stringify(rows)).not.toContain("2500000");
    expect(
      check.result?.sheetIssues.some(
        (entry) =>
          entry.code === "AMOUNT_NOT_COMPARED" && entry.columnIndex === 2,
      ),
    ).toBe(true);
    expect(check.result?.dataAt).toEqual(sheetCheckNow);
  });

  it("loads receipts (orderPayment, voided included), active refunds and orders globally for a cash report", async () => {
    const h = build();
    const check = await run(
      h,
      "COMPANY_ACCOUNTANT",
      await create(h, "COMPANY_ACCOUNTANT", "incomingCash"),
    );
    expect(check.requiredPermissions).toEqual(["payments.read"]);
    expect(h.calls.get("financeEntryStore.list")).toBe(1);
    expect(h.calls.get("financeEntryStore.listActive")).toBe(1);
    expect(h.calls.get("customerStore.list")).toBeUndefined();
    const input = h.seen[0]!;
    expect(input.system.orders?.map((order) => order.orderCode).sort()).toEqual(
      ["RD-0001", "RD-0002"],
    );
    expect(
      input.system.receipts?.map((entry) => entry.amount.amount).sort(),
    ).toEqual(["25000000", "7000000"]);
    expect(
      input.system.receipts?.every((e) => e.category === "orderPayment"),
    ).toBe(true);
    expect(input.system.refunds?.map((entry) => entry.amount.amount)).toEqual([
      "500000",
    ]);
    expect(input.system.invoices).toBeNull();
    const rows = h.store.rows.get(check.id)!;
    expect(rows[0]!.result?.outcome).toBe("matched");
    expect(rows[0]!.result?.system?.receipts?.[0]?.amount).toEqual({
      amount: "25000000",
      currency: "VND",
    });
    expect(rows[1]!.result?.outcome).toBe("matched");
    expect(rows[1]!.result?.system?.receipts?.[0]?.status).toBe("voided");
  });

  it("loads invoices, receipts and refunds for a receivables statement", async () => {
    const h = build();
    const check = await run(
      h,
      "DIRECTOR",
      await create(h, "DIRECTOR", "receivables"),
    );
    expect(h.calls.get("invoiceStore.list")).toBe(1);
    expect(h.calls.get("financeEntryStore.list")).toBe(1);
    expect(h.calls.get("financeEntryStore.listActive")).toBe(1);
    const input = h.seen[0]!;
    expect(input.system.invoices?.map((i) => i.invoiceNumber)).toEqual([
      "INV-0001",
    ]);
    expect(check.result?.summary.outcomes.matched).toBe(1);
  });

  it("compares selling prices for the DIRECTOR only when asked and stamps the permission", async () => {
    const h = build();
    const check = await run(
      h,
      "DIRECTOR",
      await create(h, "DIRECTOR", "generic"),
      {
        extras: opportunisticPermissions,
        mapping: { compareSellingPrice: true },
      },
    );
    expect(h.seen[0]!.system.sellingPriceVisible).toBe(true);
    expect(h.seen[0]!.system.customers).not.toBeNull();
    expect(check.requiredPermissions).toEqual([
      "orders.read",
      "orders.readSellingPrice",
      "customers.read",
    ]);
    const first = h.store.rows.get(check.id)![0]!.result!;
    expect(first.system?.order?.sellingPrice).toEqual({
      amount: "1000000",
      currency: "VND",
    });
    expect(first.issues.some((e) => e.code === "SELLING_PRICE_MATCH")).toBe(
      true,
    );

    const plain = await run(
      h,
      "DIRECTOR",
      await create(h, "DIRECTOR", "generic"),
      { extras: opportunisticPermissions },
    );
    expect(plain.requiredPermissions).toEqual([
      "orders.read",
      "customers.read",
    ]);
    expect(plain.mapping.compareSellingPrice).toBe(false);
  });

  it("refuses compareSellingPrice for a runner without the global permission", async () => {
    const h = build();
    const check = await create(h, "FACTORY_ACCOUNTANT", "generic");
    await expectDenied(
      run(h, "FACTORY_ACCOUNTANT", check, {
        mapping: { compareSellingPrice: true },
      }),
    );
    expect((await h.store.findById(check.id))?.status).toBe("mapping");
    expect(h.calls.get("orderStore.list")).toBeUndefined();
  });

  it("refuses to run a money check for a context without the global gate", async () => {
    const h = build();
    const check = await create(h, "COMPANY_ACCOUNTANT", "receivables");
    const { guard } = guardFor("FACTORY_ACCOUNTANT");
    await expectDenied(
      guard.requirePermission("documents.import", {
        resourceId: check.id,
        ownerUserId: check.createdByUserId,
        businessUnitIds: check.businessUnitIds,
      }),
    );
    const unitImporter = mergeContexts(
      (await guard.requireListAccess("documents.import")).context,
      accessContext(
        ["receivables.read", "invoices.read", "payments.read"],
        "assignedBusinessUnits",
        roleUsers.FACTORY_ACCOUNTANT.id,
      ),
    );
    await expectDenied(h.service.run(unitImporter, runInput(check)));
  });

  it("blocks a mapping missing a required column with MAPPING_INVALID and its issues", async () => {
    const h = build();
    const check = await create(h, "DIRECTOR", "generic");
    const context = await actorContext("DIRECTOR", viewOf(check));
    const error = await h.service
      .run(
        context,
        runInput(check, {
          columns: check.mapping.columns.map((column) => ({
            ...column,
            field: "ignore",
          })),
        }),
      )
      .catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(SheetCheckError);
    expect((error as SheetCheckError).code).toBe("MAPPING_INVALID");
    expect((error as SheetCheckError).issues[0]?.code).toBe(
      "REQUIRED_COLUMN_MISSING",
    );
    expect(h.calls.get("orderStore.list")).toBeUndefined();
  });

  it("drops mapped columns outside the grid and never posts compareSellingPrice on a money template", async () => {
    const h = build();
    const draft = await create(h, "COMPANY_ACCOUNTANT", "incomingCash");
    const check = await run(h, "COMPANY_ACCOUNTANT", draft, {
      mapping: {
        compareSellingPrice: true,
        columns: [
          ...draft.mapping.columns.map((column) => ({ ...column })),
          {
            columnIndex: 39,
            field: "note",
            fixedCurrency: null,
            unitMultiplier: "1",
            numberStyle: null,
            dateOrder: null,
          },
        ],
      },
    });
    expect(check.mapping.compareSellingPrice).toBe(false);
    expect(check.mapping.columns.map((column) => column.columnIndex)).toEqual([
      0, 1, 2,
    ]);
  });

  it("refuses a second run (ALREADY_CHECKED) and a stale revision (REVISION_CONFLICT)", async () => {
    const h = build();
    const draft = await create(h, "DIRECTOR", "generic");
    const context = await actorContext("DIRECTOR", viewOf(draft));
    await expectCode(
      h.service.run(context, runInput(draft, {}, draft.revision + 1)),
      "REVISION_CONFLICT",
    );
    const checked = await h.service.run(context, runInput(draft));
    await expectCode(
      h.service.run(context, runInput(checked)),
      "ALREADY_CHECKED",
    );
    await expectCode(
      h.service.run(context, runInput(draft)),
      "ALREADY_CHECKED",
    );
  });

  it("writes an audit event whose metadata carries counts and permissions but no cell text", async () => {
    const h = build();
    const check = await run(
      h,
      "FACTORY_ACCOUNTANT",
      await create(h, "FACTORY_ACCOUNTANT", "generic"),
    );
    const event = h.audit.events.find(
      (entry) => entry.action === "sheetCheck.run",
    );
    expect(event?.resourceId).toBe(check.id);
    expect(event?.businessUnitIds).toEqual([unitId]);
    expect(event?.metadata).toEqual({
      template: "generic",
      dataRows: 3,
      errors: 2,
      warnings: 0,
      requiredPermissions: ["orders.read"],
    });
    expect(JSON.stringify(h.audit.events)).not.toContain("Bí Mật");
  });

  it("never writes to a business store across all three templates", async () => {
    const h = build();
    await run(h, "DIRECTOR", await create(h, "DIRECTOR", "generic"), {
      extras: opportunisticPermissions,
      mapping: { compareSellingPrice: true },
    });
    await run(h, "DIRECTOR", await create(h, "DIRECTOR", "incomingCash"));
    await run(h, "DIRECTOR", await create(h, "DIRECTOR", "receivables"));
    expect(h.orders.orders.size).toBe(2);
    expect(h.finance.entries.size).toBe(4);
    expect(h.invoices.invoices.size).toBe(1);
    expect(h.customers.customers.size).toBe(1);
    for (const key of h.calls.keys()) {
      expect(key).toMatch(
        /^(orderStore|invoiceStore|financeEntryStore|customerStore)\.(list|listActive)$/,
      );
    }
  });

  it("clamps the retention from the dependencies to the allowed range", async () => {
    const short = buildSheetCheckService({ checkedRetentionDays: 1 });
    seedBusinessData(short);
    const quick = await run(
      short,
      "DIRECTOR",
      await create(short, "DIRECTOR", "generic"),
    );
    expect(quick.expiresAt.getTime()).toBe(
      sheetCheckNow.getTime() + sheetCheckLimits.minRetentionDays * DAY_MS,
    );
    const long = buildSheetCheckService({ checkedRetentionDays: 10_000 });
    seedBusinessData(long);
    const kept = await run(
      long,
      "DIRECTOR",
      await create(long, "DIRECTOR", "generic"),
    );
    expect(kept.expiresAt.getTime()).toBe(
      sheetCheckNow.getTime() + sheetCheckLimits.maxRetentionDays * DAY_MS,
    );
  });
});

/* ------------------------------------------------------------------ */
/* Discard and rerun                                                   */
/* ------------------------------------------------------------------ */

describe("SheetCheckService cross-scope safety", () => {
  it("compares only the units the check is stamped with, whatever the runner may read", async () => {
    const h = build();
    // A unit accountant uploads a list that also names another unit's order.
    const draft = await create(h, "FACTORY_ACCOUNTANT", "generic");
    expect(draft.businessUnitIds).toEqual([unitId]);

    // The Director, who may read every order, runs the colleague's draft.
    const checked = await run(h, "DIRECTOR", draft);
    expect(checked.businessUnitIds).toEqual([unitId]);

    // The snapshot the reconciliation saw carries the stamped unit only, so
    // the stored rows cannot tell a unit reader about another unit's order.
    const snapshot = h.seen.at(-1)!.system;
    const codes = (snapshot.orders ?? []).map((order) => order.orderCode);
    expect(codes).toContain("RD-0001");
    expect(codes).not.toContain("RD-0002");
  });

  it("lets a global check keep the runner's full scope", async () => {
    const h = build();
    const draft = await create(h, "DIRECTOR", "generic");
    expect(draft.businessUnitIds).toEqual([]);
    await run(h, "DIRECTOR", draft);
    const codes = (h.seen.at(-1)!.system.orders ?? []).map(
      (order) => order.orderCode,
    );
    expect(codes).toEqual(expect.arrayContaining(["RD-0001", "RD-0002"]));
  });
});

describe("SheetCheckService.listForReader paging", () => {
  it("fills a page even when checks the reader may not open sit in between", async () => {
    const h = build();
    const visible: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const own = await create(h, "FACTORY_ACCOUNTANT", "generic", {
        fileName: `don-${index}.xlsx`,
      });
      visible.push(own.id);
      // A money check the unit reader may never open, between two of theirs.
      await create(h, "COMPANY_ACCOUNTANT", "incomingCash");
    }

    const { guard } = guardFor("FACTORY_ACCOUNTANT");
    const { context } = await guard.requireListAccess("documents.read");
    const coverages = await guard.coverages(sheetCheckReadPermissions);
    const first = await h.service.listForReader(context, coverages, {
      limit: 2,
      offset: 0,
    });
    const second = await h.service.listForReader(context, coverages, {
      limit: 2,
      offset: 2,
    });
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(1);
    expect([...first, ...second].map((check) => check.id).sort()).toEqual(
      [...visible].sort(),
    );
  });
});

describe("SheetCheckService.discard", () => {
  it("lets the creator discard a draft, refuses a unit colleague, allows a global importer", async () => {
    const h = build();
    const draft = await create(h, "FACTORY_ACCOUNTANT", "generic");

    const colleague = await actorContext("WAREHOUSE_MANAGER", viewOf(draft));
    await expectDenied(
      h.service.discard(colleague, {
        checkId: draft.id,
        expectedRevision: draft.revision,
      }),
    );
    expect(h.store.checks.has(draft.id)).toBe(true);

    const creator = await actorContext("FACTORY_ACCOUNTANT", viewOf(draft));
    await expectCode(
      h.service.discard(creator, {
        checkId: draft.id,
        expectedRevision: draft.revision + 1,
      }),
      "REVISION_CONFLICT",
    );
    await h.service.discard(creator, {
      checkId: draft.id,
      expectedRevision: draft.revision,
    });
    expect(h.store.checks.has(draft.id)).toBe(false);
    expect(h.store.rows.has(draft.id)).toBe(false);
    expect(
      h.audit.events.some(
        (event) =>
          event.action === "sheetCheck.discarded" &&
          event.resourceId === draft.id,
      ),
    ).toBe(true);

    const another = await create(h, "FACTORY_ACCOUNTANT", "generic");
    const director = await actorContext("DIRECTOR", viewOf(another));
    await h.service.discard(director, {
      checkId: another.id,
      expectedRevision: another.revision,
    });
    expect(h.store.checks.has(another.id)).toBe(false);
  });

  it("refuses to discard a checked result", async () => {
    const h = build();
    const checked = await run(
      h,
      "DIRECTOR",
      await create(h, "DIRECTOR", "generic"),
    );
    const director = await actorContext("DIRECTOR", viewOf(checked));
    await expectCode(
      h.service.discard(director, {
        checkId: checked.id,
        expectedRevision: checked.revision,
      }),
      "INVALID_STATE",
    );
    expect(h.store.checks.has(checked.id)).toBe(true);
  });
});

describe("SheetCheckService.rerun", () => {
  it("refuses a draft as the source: only a finished check can be run again", async () => {
    const h = build();
    const draft = await create(h, "FACTORY_ACCOUNTANT", "generic");
    const context = mergeContexts(
      await actorContext("FACTORY_ACCOUNTANT", viewOf(draft)),
      await readerContext("FACTORY_ACCOUNTANT", viewOf(draft)),
    );
    await expectCode(
      h.service.rerun(context, { checkId: draft.id }),
      "INVALID_STATE",
    );
  });

  it("creates a new mapping check pointing back, with the mapping copied and the rows cloned without results", async () => {
    const h = build();
    const checked = await run(
      h,
      "FACTORY_ACCOUNTANT",
      await create(h, "FACTORY_ACCOUNTANT", "generic"),
    );
    const context = mergeContexts(
      await actorContext("FACTORY_ACCOUNTANT", viewOf(checked)),
      await readerContext("FACTORY_ACCOUNTANT", viewOf(checked)),
    );
    const again = await h.service.rerun(context, { checkId: checked.id });
    expect(again.id).not.toBe(checked.id);
    expect(again.rerunOf).toBe(checked.id);
    expect(again.status).toBe("mapping");
    expect(again.result).toBeNull();
    expect(again.mapping).toEqual(checked.mapping);
    expect(again.proposal).toEqual(checked.proposal);
    expect(again.requiredPermissions).toEqual(["orders.read"]);
    expect(again.businessUnitIds).toEqual([unitId]);
    expect(again.expiresAt.getTime()).toBe(
      sheetCheckNow.getTime() + sheetCheckLimits.draftRetentionDays * DAY_MS,
    );
    const cloned = h.store.rows.get(again.id)!;
    const source = h.store.rows.get(checked.id)!;
    expect(cloned.map((row) => row.cells)).toEqual(
      source.map((row) => row.cells),
    );
    expect(cloned.every((row) => row.result === null)).toBe(true);
    expect(source.every((row) => row.result !== null)).toBe(true);
    expect((await h.store.findById(checked.id))?.status).toBe("checked");

    const rerunAgain = await h.service.run(
      await actorContext("FACTORY_ACCOUNTANT", viewOf(again)),
      runInput(again),
    );
    expect(rerunAgain.status).toBe("checked");
  });

  it("requires the read rule and documents.import", async () => {
    const h = build();
    const checked = await run(
      h,
      "DIRECTOR",
      await create(h, "DIRECTOR", "generic"),
      {
        extras: opportunisticPermissions,
        mapping: { compareSellingPrice: true },
      },
    );
    const manager = mergeContexts(
      (
        await guardFor("FACTORY_MANAGER").guard.requireListAccess(
          "documents.read",
        )
      ).context,
      (await guardFor("FACTORY_MANAGER").guard.requireListAccess("orders.read"))
        .context,
    );
    await expectDenied(h.service.rerun(manager, { checkId: checked.id }));
    const readerOnly = await readerContext(
      "COMPANY_ACCOUNTANT",
      viewOf(checked),
    );
    await expectDenied(
      h.service.rerun(
        {
          ...readerOnly,
          permissions: readerOnly.permissions.filter(
            (p) => p.permission !== "documents.import",
          ),
        },
        { checkId: checked.id },
      ),
    );
  });
});

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

describe("SheetCheckService.exportCsv", () => {
  it("needs documents.export plus the read rule, a checked result, and audits the export", async () => {
    const h = build();
    const draft = await create(h, "FACTORY_ACCOUNTANT", "generic");
    const { guard } = guardFor("WAREHOUSE_MANAGER");
    const target = {
      resourceId: draft.id,
      ownerUserId: draft.createdByUserId,
      businessUnitIds: draft.businessUnitIds,
    };
    const exporter = mergeContexts(
      await guard.requirePermission("documents.export", target),
      await readerContext("WAREHOUSE_MANAGER", viewOf(draft)),
    );
    await expectCode(
      h.service.exportCsv(exporter, draft.id, "vi"),
      "INVALID_STATE",
    );

    const checked = await run(h, "FACTORY_ACCOUNTANT", draft);
    const file = await h.service.exportCsv(exporter, checked.id, "vi");
    expect(file.fileName).toMatch(
      /^kiem-tra-generic-20260906-[a-f0-9]{6}\.csv$/,
    );
    expect(file.content.charCodeAt(0)).toBe(0xfeff);
    expect(file.content).toContain("Bí Mật Xyzzy Co");
    expect(file.content).not.toContain("Hệ thống");
    expect(
      h.audit.events.some(
        (event) =>
          event.action === "sheetCheck.exported" &&
          event.resourceId === checked.id,
      ),
    ).toBe(true);

    const noExport = await readerContext("WAREHOUSE_MANAGER", viewOf(checked));
    await expectDenied(h.service.exportCsv(noExport, checked.id, "vi"));
  });
});
