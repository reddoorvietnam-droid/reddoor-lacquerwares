import { describe, expect, it } from "vitest";

import {
  getSheetCheckRowTool,
  getSheetCheckTool,
  listSheetChecksTool,
  proposeSheetCheckFollowUpsTool,
  sheetCheckToolPermissions,
  sheetCheckTools,
} from "@/domains/assistant/tools/sheet-checks";
import type {
  AssistantTool,
  ToolContext,
  ToolOutcome,
  ToolServices,
} from "@/domains/assistant/tools/types";
import type { SystemRoleKey } from "@/domains/identity/role-definitions";
import { orderStageDefinitions } from "@/domains/orders/workflow";
import { issue } from "@/domains/sheet-checks/issues";
import { SheetCheckService } from "@/domains/sheet-checks/service";

import {
  buildWorld,
  now,
  otherUnitId,
  seeded,
  tz,
  type HarnessWorld,
} from "../eval/harness";
import { authFor, roleUsers, snapshotFor } from "./helpers/assistant-fakes";
import {
  auditRepository,
  FakeCustomerStore,
  FakeFinanceEntryStore,
  FakeInvoiceStore,
  FakeOrderStore,
  unitId,
} from "./helpers/finance-fakes";
import {
  cashFixture,
  collectKeys,
  FakeSheetCheckService,
  FakeSheetCheckStore,
  seedCashCheck,
  seedDraftCheck,
  seedGenericCheck,
  seededCheck,
  seedReceivablesCheck,
  type SheetCheckReadService,
} from "./helpers/sheet-check-tool-fakes";

/**
 * The four sheet-check tools judged by the REAL evaluator over the REAL
 * role seeds: who is offered them, who may open which check, what a
 * restricted reader's payload may contain, and that follow-ups are
 * proposals with amount-free titles — never tasks.
 */

const toolNames = [
  "list_sheet_checks",
  "get_sheet_check",
  "get_sheet_check_row",
  "propose_sheet_check_follow_ups",
];

const moneyKeys = [
  "invoice",
  "receipts",
  "candidates",
  "balance",
  "sellingPrice",
];

const strangerId = "9f9f9f9f9f9f9f9f9f9f9f9f";

function build() {
  const world = buildWorld();
  const store = new FakeSheetCheckStore();
  const service = new FakeSheetCheckService(store);
  return { world, store, service };
}

function contextFor(
  role: SystemRoleKey,
  world: HarnessWorld,
  service: SheetCheckReadService,
  options: {
    locale?: "vi" | "en";
    businessUnitId?: string | null;
    revoked?: boolean;
  } = {},
): ToolContext {
  const snapshot = snapshotFor(role, {
    ...(options.businessUnitId !== undefined
      ? { businessUnitId: options.businessUnitId }
      : {}),
    revoked: options.revoked ?? false,
  });
  return {
    userId: roleUsers[role].id,
    locale: options.locale ?? "vi",
    now,
    timeZone: tz,
    requestId: "test",
    auth: authFor(snapshot, now),
    // `sheetChecks` joins ToolServices when the orchestrator wires it.
    services: { ...world.services, sheetChecks: service } as ToolServices,
  };
}

/** Parses through the tool's own schema first, as the chat loop does. */
async function run<Input>(
  tool: AssistantTool<Input>,
  raw: unknown,
  context: ToolContext,
): Promise<ToolOutcome> {
  return tool.run(tool.inputSchema.parse(raw), context);
}

function dataOf(outcome: ToolOutcome): Record<string, unknown> {
  if (!outcome.ok) throw new Error(`expected ok, got ${outcome.code}`);
  return outcome.data as Record<string, unknown>;
}

function codeOf(outcome: ToolOutcome): string {
  return outcome.ok ? "OK" : outcome.code;
}

function minutesAgo(minutes: number): Date {
  return new Date(now.getTime() - minutes * 60_000);
}

/** Six checks of every shape, newest first in this order. */
function seedAll(store: FakeSheetCheckStore) {
  const cash = seedCashCheck(store, {
    createdByUserId: roleUsers.COMPANY_ACCOUNTANT.id,
    orderCode: seeded.orderCode,
    fileName: "tien-ve-thang-tam.xlsx",
    createdAt: minutesAgo(1),
  });
  const generic = seedGenericCheck(store, {
    createdByUserId: roleUsers.FACTORY_ACCOUNTANT.id,
    businessUnitIds: [unitId],
    orderCode: seeded.orderCode,
    fileName: "don-hang-xuong.xlsx",
    createdAt: minutesAgo(2),
  });
  const receivables = seedReceivablesCheck(store, {
    createdByUserId: roleUsers.DIRECTOR.id,
    createdAt: minutesAgo(3),
  });
  const draft = seedDraftCheck(store, {
    template: "generic",
    createdByUserId: roleUsers.WAREHOUSE_MANAGER.id,
    businessUnitIds: [unitId],
    createdAt: minutesAgo(4),
  });
  const otherUnitGeneric = seedGenericCheck(store, {
    createdByUserId: strangerId,
    businessUnitIds: [otherUnitId],
    orderCode: seeded.otherUnitOrderCode,
    createdAt: minutesAgo(5),
  });
  const pricedGeneric = seedGenericCheck(store, {
    createdByUserId: roleUsers.DIRECTOR.id,
    businessUnitIds: [],
    orderCode: seeded.orderCode,
    requiredPermissions: ["orders.read", "orders.readSellingPrice"],
    createdAt: minutesAgo(6),
  });
  return { cash, generic, receivables, draft, otherUnitGeneric, pricedGeneric };
}

describe("offered tools", () => {
  async function offered(role: SystemRoleKey): Promise<string[]> {
    const coverages = await authFor(snapshotFor(role), now).coverages(
      sheetCheckToolPermissions,
    );
    return sheetCheckTools
      .filter((tool) =>
        tool.requires.every((permission) => {
          const coverage = coverages[permission];
          return coverage.global || coverage.businessUnitIds.length > 0;
        }),
      )
      .map((tool) => tool.name);
  }

  it("declares documents.read on every tool and tasks.create on the follow-ups", () => {
    expect(sheetCheckTools.map((tool) => tool.name)).toEqual(toolNames);
    for (const tool of sheetCheckTools) {
      expect(tool.requires).toContain("documents.read");
    }
    expect(proposeSheetCheckFollowUpsTool.requires).toEqual([
      "documents.read",
      "tasks.create",
    ]);
  });

  it("offers the three read tools to every operational role, the follow-ups to the Director alone, nothing to the content creator", async () => {
    expect(await offered("DIRECTOR")).toEqual(toolNames);
    // The follow-up tool needs `tasks.create`, which only the Director holds
    // since work is handed out from one desk (2026-09-12).
    const readOnly = toolNames.filter(
      (name) => name !== "propose_sheet_check_follow_ups",
    );
    for (const role of [
      "COMPANY_ACCOUNTANT",
      "FACTORY_ACCOUNTANT",
      "WAREHOUSE_MANAGER",
      "FACTORY_MANAGER",
    ] as const) {
      expect(await offered(role), role).toEqual(readOnly);
    }
    expect(await offered("CONTENT_CREATOR")).toEqual([]);
  });
});

describe("list_sheet_checks", () => {
  it("lists every check for a global reader, newest first, without any grid", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    const outcome = await run(
      listSheetChecksTool,
      { limit: 20 },
      contextFor("DIRECTOR", world, service),
    );
    const data = dataOf(outcome);
    const items = data.items as { id: string; errors: number | null }[];
    expect(items.map((item) => item.id)).toEqual([
      all.cash.id,
      all.generic.id,
      all.receivables.id,
      all.draft.id,
      all.otherUnitGeneric.id,
      all.pricedGeneric.id,
    ]);
    expect(items[0]).toMatchObject({
      fileName: "tien-ve-thang-tam.xlsx",
      template: "incomingCash",
      templateLabel: "Báo cáo tiền về",
      status: "checked",
      createdDay: "2026-09-06",
      dataRows: 6,
      errors: 6,
      warnings: 1,
      mine: false,
    });
    expect(items[3]).toMatchObject({ status: "mapping", errors: null });
    const keys = collectKeys(data);
    expect(keys.has("cells")).toBe(false);
    expect(keys.has("rows")).toBe(false);
    expect(outcome.ok && outcome.sources[0]?.href).toBe("/vi/admin/checks");
  });

  it("omits every check a unit reader may not open — money checks, other units, exercised money permissions", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    for (const role of ["FACTORY_ACCOUNTANT", "FACTORY_MANAGER"] as const) {
      const data = dataOf(
        await run(listSheetChecksTool, {}, contextFor(role, world, service)),
      );
      const ids = (data.items as { id: string }[]).map((item) => item.id);
      expect(ids, role).toEqual([all.generic.id, all.draft.id]);
    }
    // The warehouse manager created the draft and shares the unit.
    const wm = dataOf(
      await run(
        listSheetChecksTool,
        {},
        contextFor("WAREHOUSE_MANAGER", world, service),
      ),
    );
    expect((wm.items as { id: string }[]).map((item) => item.id)).toEqual([
      all.generic.id,
      all.draft.id,
    ]);
  });

  it("denies the content creator and a revoked account", async () => {
    const { world, store, service } = build();
    seedAll(store);
    expect(
      codeOf(
        await run(
          listSheetChecksTool,
          {},
          contextFor("CONTENT_CREATOR", world, service),
        ),
      ),
    ).toBe("PERMISSION_DENIED");
    expect(
      codeOf(
        await run(
          listSheetChecksTool,
          {},
          contextFor("DIRECTOR", world, service, { revoked: true }),
        ),
      ),
    ).toBe("PERMISSION_DENIED");
    expect(service.calls).not.toContain("listForReader");
  });

  it("respects offset, limit and the template filter", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    const context = contextFor("DIRECTOR", world, service);
    const first = dataOf(await run(listSheetChecksTool, { limit: 2 }, context));
    expect((first.items as { id: string }[]).map((item) => item.id)).toEqual([
      all.cash.id,
      all.generic.id,
    ]);
    const second = dataOf(
      await run(listSheetChecksTool, { limit: 2, offset: 2 }, context),
    );
    expect((second.items as { id: string }[]).map((item) => item.id)).toEqual([
      all.receivables.id,
      all.draft.id,
    ]);
    expect(second.offset).toBe(2);
    expect(store.listCalls.at(-1)).toMatchObject({ limit: 2, offset: 2 });
    const cash = dataOf(
      await run(listSheetChecksTool, { template: "incomingCash" }, context),
    );
    expect((cash.items as { id: string }[]).map((item) => item.id)).toEqual([
      all.cash.id,
    ]);
    await expect(
      run(listSheetChecksTool, { limit: 50 }, context),
    ).rejects.toThrow();
  });
});

describe("get_sheet_check", () => {
  it("returns the summary, totals per currency, findings and the error rows — never the grid", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    const outcome = await run(
      getSheetCheckTool,
      { checkId: all.cash.id },
      contextFor("DIRECTOR", world, service),
    );
    const data = dataOf(outcome);
    expect(data.summary).toEqual({
      dataRows: 6,
      skippedRows: 1,
      errors: 6,
      warnings: 1,
      infos: 3,
      outcomes: {
        matched: 1,
        mismatch: 1,
        notFound: 3,
        notCompared: 0,
        invalid: 1,
        skipped: 1,
      },
    });
    const totals = data.totals as Record<string, unknown>[];
    expect(totals[0]).toMatchObject({
      field: "amount",
      fieldLabel: "Số tiền",
      column: "D",
      currency: "VND",
      computed: { amount: "81500000", currency: "VND" },
      sheetTotal: { amount: "81500000", currency: "VND" },
      system: { amount: "62975000", currency: "VND" },
    });
    const sheetIssues = data.sheetIssues as { code: string; text: string }[];
    expect(sheetIssues.map((entry) => entry.code)).toEqual([
      "TOTAL_MISMATCH",
      "PERIOD_TOTAL_MISMATCH",
    ]);
    expect(sheetIssues[1]?.text).toContain("Tổng tiền về trong kỳ");
    const systemOnly = data.systemOnly as { text: string }[];
    expect(systemOnly).toHaveLength(1);
    expect(systemOnly[0]?.text).toContain("không có trong bảng");
    expect(data.rowsWithErrors).toBe(5);
    const errorRows = data.errorRows as {
      sheetRowNumber: number;
      outcome: string;
      issues: string[];
    }[];
    expect(errorRows.map((row) => row.sheetRowNumber)).toEqual([
      6, 7, 8, 9, 10,
    ]);
    expect(errorRows[1]).toMatchObject({ outcome: "mismatch" });
    expect(errorRows[1]?.issues[1]).toContain("lệch 1025000 VND");
    expect((data.caveats as string[])[0]).toContain("sao kê ngân hàng");
    const keys = collectKeys(data);
    expect(keys.has("cells")).toBe(false);
    expect(keys.has("parsed")).toBe(false);
    expect(outcome.ok && outcome.sources[0]?.href).toBe(
      `/vi/admin/checks/${all.cash.id}`,
    );
  });

  it("denies the factory accountant a money check before the service is read, with a payload free of amounts", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    for (const checkId of [all.cash.id, all.receivables.id]) {
      const outcome = await run(
        getSheetCheckTool,
        { checkId },
        contextFor("FACTORY_ACCOUNTANT", world, service),
      );
      expect(codeOf(outcome)).toBe("PERMISSION_DENIED");
      const text = JSON.stringify(outcome);
      expect(text).not.toContain("amount");
      expect(text).not.toContain("system");
      expect(text).not.toContain(cashFixture.matchedAmount);
    }
    expect(service.calls).not.toContain("get");
    expect(service.calls).not.toContain("listRows");
  });

  it("gives the warehouse manager a generic check with no system key anywhere", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    const data = dataOf(
      await run(
        getSheetCheckTool,
        { checkId: all.generic.id },
        contextFor("WAREHOUSE_MANAGER", world, service),
      ),
    );
    const keys = collectKeys(data);
    expect(keys.has("system")).toBe(false);
    for (const key of moneyKeys) expect(keys.has(key), key).toBe(false);
    const line = (data.totals as Record<string, unknown>[])[0]!;
    expect(line).toMatchObject({
      field: "amount",
      fieldLabel: "Số tiền",
      column: "C",
      currency: "VND",
      computed: { amount: "4500", currency: "VND" },
      sheetTotal: null,
      rowsCounted: 3,
      rowsSkipped: 1,
    });
    expect(Object.keys(line)).not.toContain("system");
    expect(
      (data.sheetIssues as { code: string; column: string }[])[0],
    ).toMatchObject({ code: "AMOUNT_NOT_COMPARED", column: "C" });
  });

  it("applies the read rule per check: same-unit colleagues yes, exercised money permissions no", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    const fm = contextFor("FACTORY_MANAGER", world, service);
    expect(
      codeOf(await run(getSheetCheckTool, { checkId: all.generic.id }, fm)),
    ).toBe("OK");
    expect(
      codeOf(
        await run(getSheetCheckTool, { checkId: all.pricedGeneric.id }, fm),
      ),
    ).toBe("PERMISSION_DENIED");
    expect(
      codeOf(
        await run(getSheetCheckTool, { checkId: all.otherUnitGeneric.id }, fm),
      ),
    ).toBe("PERMISSION_DENIED");
    expect(
      codeOf(
        await run(
          getSheetCheckTool,
          { checkId: all.pricedGeneric.id },
          contextFor("COMPANY_ACCOUNTANT", world, service),
        ),
      ),
    ).toBe("OK");
    expect(
      codeOf(
        await run(
          getSheetCheckTool,
          { checkId: all.generic.id },
          contextFor("CONTENT_CREATOR", world, service),
        ),
      ),
    ).toBe("PERMISSION_DENIED");
  });

  it("reports a missing check as NOT_FOUND and an unrun check without a summary", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    const director = contextFor("DIRECTOR", world, service);
    expect(
      codeOf(
        await run(
          getSheetCheckTool,
          { checkId: "ffffffffffffffffffffffff" },
          director,
        ),
      ),
    ).toBe("NOT_FOUND");
    const draft = dataOf(
      await run(getSheetCheckTool, { checkId: all.draft.id }, director),
    );
    expect(draft.status).toBe("mapping");
    expect(draft.summary).toBeNull();
    expect(draft.nextStep).toContain("chưa chạy");
    const proposal = draft.proposal as { columns: Record<string, unknown>[] };
    expect(proposal.columns).toHaveLength(4);
    expect(collectKeys(draft).has("sampleValues")).toBe(false);
  });

  it("renders findings in the reader's language", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    const data = dataOf(
      await run(
        getSheetCheckTool,
        { checkId: all.cash.id },
        contextFor("DIRECTOR", world, service, { locale: "en" }),
      ),
    );
    expect(data.templateLabel).toBe("Cash received report");
    expect((data.sheetIssues as { text: string }[])[0]?.text).toContain(
      "Totals row says",
    );
    expect((data.caveats as string[])[0]).toContain("bank statement");
  });
});

describe("get_sheet_check_row", () => {
  it("returns one row by its Excel row number with cells, parsed fields, findings and the system side", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    const data = dataOf(
      await run(
        getSheetCheckRowTool,
        { checkId: all.cash.id, sheetRowNumber: 7 },
        contextFor("DIRECTOR", world, service),
      ),
    );
    expect(data).toMatchObject({
      sheetRowNumber: 7,
      rowIndex: 2,
      kind: "data",
      outcome: "mismatch",
      worst: "error",
    });
    const cells = data.cells as Record<string, unknown>[];
    expect(cells).toHaveLength(4);
    expect(cells[3]).toEqual({
      column: "D",
      header: "Số tiền",
      field: "amount",
      text: "26.000.000",
    });
    expect(data.parsed).toMatchObject({
      date: "2026-08-20",
      orderCode: seeded.orderCode,
      amount: { amount: cashFixture.sheetAmount, currency: "VND" },
    });
    const issues = data.issues as { code: string; text: string }[];
    expect(issues.map((entry) => entry.code)).toEqual([
      "ORDER_MATCHED",
      "RECEIPT_AMOUNT_MISMATCH",
    ]);
    expect(issues[0]?.text).toContain(`Đơn ${seeded.orderCode}`);
    const system = data.system as Record<string, unknown>;
    expect(system.order).toEqual({
      orderCode: seeded.orderCode,
      stage: "inProduction",
      stageLabel: orderStageDefinitions.inProduction.labels.vi,
      customerName: cashFixture.customer,
    });
    expect(
      (system.receipts as { amount: { amount: string } }[])[0]?.amount.amount,
    ).toBe(cashFixture.systemAmount);
    expect(system).not.toHaveProperty("candidates");
    expect(system).not.toHaveProperty("invoice");
  });

  it("accepts the stored row index and a check without a header row", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    const director = contextFor("DIRECTOR", world, service);
    const byIndex = dataOf(
      await run(
        getSheetCheckRowTool,
        { checkId: all.cash.id, rowIndex: 1 },
        director,
      ),
    );
    expect(byIndex.sheetRowNumber).toBe(6);
    expect(
      (byIndex.system as Record<string, unknown>).candidates as unknown[],
    ).toHaveLength(1);

    const headerless = seedGenericCheck(store, {
      createdByUserId: roleUsers.DIRECTOR.id,
      businessUnitIds: [],
      orderCode: seeded.orderCode,
      headerSheetRowNumber: null,
    });
    const located = dataOf(
      await run(
        getSheetCheckRowTool,
        { checkId: headerless.id, sheetRowNumber: 3 },
        director,
      ),
    );
    expect(located).toMatchObject({ sheetRowNumber: 3, rowIndex: 2 });
    expect(
      store.listRowsCalls.filter((call) => call.checkId === headerless.id)
        .length,
    ).toBeGreaterThan(0);
  });

  it("keeps a unit reader's generic row free of money keys while keeping the matched order", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    const data = dataOf(
      await run(
        getSheetCheckRowTool,
        { checkId: all.generic.id, rowIndex: 0 },
        contextFor("WAREHOUSE_MANAGER", world, service),
      ),
    );
    const system = data.system as Record<string, unknown>;
    expect(system.order).toMatchObject({ orderCode: seeded.orderCode });
    const keys = collectKeys(system);
    for (const key of moneyKeys) expect(keys.has(key), key).toBe(false);
  });

  it("shows the balance side of a receivables row to a global reader", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    const data = dataOf(
      await run(
        getSheetCheckRowTool,
        { checkId: all.receivables.id, sheetRowNumber: 5 },
        contextFor("COMPANY_ACCOUNTANT", world, service),
      ),
    );
    const system = data.system as { balance: Record<string, unknown> };
    expect(system.balance).toMatchObject({
      customerName: "Công ty Kiso",
      balance: { amount: "70000000", currency: "VND" },
      overdueInvoiceCount: 1,
    });
    expect((data.issues as { text: string }[])[0]?.text).toContain(
      "lệch -10000000 VND",
    );
  });

  it("denies forbidden checks, reports missing rows, and demands a row locator", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    expect(
      codeOf(
        await run(
          getSheetCheckRowTool,
          { checkId: all.cash.id, rowIndex: 0 },
          contextFor("FACTORY_ACCOUNTANT", world, service),
        ),
      ),
    ).toBe("PERMISSION_DENIED");
    const director = contextFor("DIRECTOR", world, service);
    expect(
      codeOf(
        await run(
          getSheetCheckRowTool,
          { checkId: all.cash.id, sheetRowNumber: 99 },
          director,
        ),
      ),
    ).toBe("NOT_FOUND");
    expect(
      codeOf(
        await run(
          getSheetCheckRowTool,
          { checkId: all.cash.id, rowIndex: 99 },
          director,
        ),
      ),
    ).toBe("NOT_FOUND");
    await expect(
      run(getSheetCheckRowTool, { checkId: all.cash.id }, director),
    ).rejects.toThrow();
  });
});

describe("propose_sheet_check_follow_ups", () => {
  const titlePattern = /^Kiểm tra dòng \d+ «.+»: .+$/u;
  const amountPattern = /\d[\d.,]{3,}/u;

  it("drafts one proposal per matched order plus one for the rest, with amount-free titles and no task", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    const tasksBefore = world.tasks.tasks.size;
    const outcome = await run(
      proposeSheetCheckFollowUpsTool,
      { checkId: all.cash.id },
      contextFor("DIRECTOR", world, service),
    );
    const data = dataOf(outcome);
    expect(data.rowsProposed).toBe(5);
    const proposals = data.proposals as {
      proposalId: string;
      orderCode: string | null;
      itemCount: number;
      items: { title: string; dueDate: string }[];
    }[];
    expect(proposals).toHaveLength(2);
    expect(proposals[0]).toMatchObject({
      orderCode: seeded.orderCode,
      itemCount: 2,
    });
    expect(proposals[1]).toMatchObject({ orderCode: null, itemCount: 3 });
    const titles = proposals.flatMap((proposal) =>
      proposal.items.map((item) => item.title),
    );
    expect(titles).toEqual([
      "Kiểm tra dòng 7 «tien-ve-thang-tam.xlsx»: lệch số tiền phiếu thu",
      "Kiểm tra dòng 8 «tien-ve-thang-tam.xlsx»: phiếu thu chưa có",
      "Kiểm tra dòng 6 «tien-ve-thang-tam.xlsx»: phiếu thu chưa có",
      "Kiểm tra dòng 9 «tien-ve-thang-tam.xlsx»: không thấy đơn",
      "Kiểm tra dòng 10 «tien-ve-thang-tam.xlsx»: số tiền không đọc được",
    ]);
    for (const title of titles) {
      expect(title).toMatch(titlePattern);
      expect(title).not.toMatch(amountPattern);
    }
    for (const proposal of proposals) {
      for (const item of proposal.items)
        expect(item.dueDate).toBe("2026-09-09");
    }

    // The stored proposals: order-linked drafts carry the order's units,
    // the rest the reader's (global) coverage; notes name only the check
    // and the row.
    const stored = proposals.map((proposal) =>
      world.proposals.proposals.get(proposal.proposalId)!,
    );
    expect(stored[0]!.businessUnitIds).toEqual([unitId]);
    expect(stored[0]!.orderId).toBe(world.order.id);
    expect(stored[1]!.businessUnitIds).toEqual([]);
    expect(stored[1]!.orderId).toBeNull();
    expect(stored[0]!.items[0]!.note).toBe(
      `Kiểm tra bảng biểu ${all.cash.id} · dòng 7`,
    );
    const everything = JSON.stringify(stored);
    for (const amount of [
      cashFixture.sheetAmount,
      cashFixture.systemAmount,
      cashFixture.missingAmount,
    ]) {
      expect(everything).not.toContain(amount);
    }
    expect(everything).not.toContain(cashFixture.customer);
    expect(world.tasks.tasks.size).toBe(tasksBefore);
    expect(
      world.audit.events.filter(
        (event) => event.action === "assistant.proposalCreated",
      ),
    ).toHaveLength(2);
    expect(data.nextStep).toContain("confirm");
    expect(outcome.ok && outcome.sources.map((source) => source.href)).toEqual([
      "/vi/admin/tasks#proposals",
      `/vi/admin/checks/${all.cash.id}`,
    ]);
  });

  it("caps the rows at maxItems in sheet order", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    const data = dataOf(
      await run(
        proposeSheetCheckFollowUpsTool,
        { checkId: all.cash.id, maxItems: 2 },
        contextFor("DIRECTOR", world, service),
      ),
    );
    expect(data.rowsProposed).toBe(2);
    const proposals = data.proposals as {
      orderCode: string | null;
      items: { title: string }[];
    }[];
    expect(proposals.map((proposal) => proposal.orderCode)).toEqual([
      seeded.orderCode,
      null,
    ]);
    expect(
      proposals.flatMap((proposal) =>
        proposal.items.map((item) => item.title.slice(0, 18)),
      ),
    ).toEqual(["Kiểm tra dòng 7 «t", "Kiểm tra dòng 6 «t"]);
  });

  it("groups the rows of a check by order and keeps the unlinked ones together", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    const director = contextFor("DIRECTOR", world, service);
    const data = dataOf(
      await run(
        proposeSheetCheckFollowUpsTool,
        { checkId: all.generic.id },
        director,
      ),
    );
    const proposals = data.proposals as {
      proposalId: string;
      orderCode: string | null;
      itemCount: number;
    }[];
    expect(proposals).toEqual([
      expect.objectContaining({ orderCode: seeded.orderCode, itemCount: 1 }),
      expect.objectContaining({ orderCode: null, itemCount: 2 }),
    ]);
    const unlinked = world.proposals.proposals.get(proposals[1]!.proposalId)!;
    expect(unlinked.proposedByUserId).toBe(roleUsers.DIRECTOR.id);
  });

  it("refuses a unit accountant, who no longer hands work out", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    const fa = contextFor("FACTORY_ACCOUNTANT", world, service);
    expect(
      codeOf(
        await run(
          proposeSheetCheckFollowUpsTool,
          { checkId: all.generic.id },
          fa,
        ),
      ),
    ).toBe("PERMISSION_DENIED");
    expect(world.proposals.proposals.size).toBe(0);
  });

  it("keeps rows whose order is closed in the order-less proposal and says so", async () => {
    // The unreadable-order half of this case is gone with the permission
    // change of 2026-09-12: the only role that may propose follow-ups is the
    // Director, who reads every order. The branch stays in the tool for a
    // future role that proposes without a global read.
    const { world, store, service } = build();
    const closed = world.orders.seed({
      orderCode: "RD-CLOSED-AA01",
      stage: "closed",
      businessUnitIds: [unitId],
    });
    const closedCheck = seedGenericCheck(store, {
      createdByUserId: roleUsers.DIRECTOR.id,
      businessUnitIds: [],
      orderCode: closed.orderCode,
    });
    const director = dataOf(
      await run(
        proposeSheetCheckFollowUpsTool,
        { checkId: closedCheck.id },
        contextFor("DIRECTOR", world, service),
      ),
    );
    expect(director.proposals).toEqual([
      expect.objectContaining({ orderCode: null, itemCount: 3 }),
    ]);
    expect(
      (director.assumptions as string[]).some((line) =>
        line.includes(`Đơn ${closed.orderCode} đã đóng/hủy`),
      ),
    ).toBe(true);
  });

  it("proposes nothing for a clean check, refuses an unrun one, and denies the forbidden", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    const director = contextFor("DIRECTOR", world, service);
    const clean = seededCheck(store, {
      template: "generic",
      createdByUserId: roleUsers.DIRECTOR.id,
      columns: [{ header: "Mã đơn", field: "orderCode" }],
      rows: [
        {
          cells: [seeded.orderCode],
          parsed: { orderCode: seeded.orderCode },
          issues: [
            issue("ORDER_MATCHED", {
              code: seeded.orderCode,
              stage: "Đang sản xuất",
              customer: "Công ty Kiso",
            }),
          ],
          outcome: "matched",
        },
      ],
    });
    const none = dataOf(
      await run(
        proposeSheetCheckFollowUpsTool,
        { checkId: clean.id },
        director,
      ),
    );
    expect(none.rowsProposed).toBe(0);
    expect(none.proposals).toEqual([]);
    expect(none.nextStep).toContain("Không có dòng nào");
    expect(
      codeOf(
        await run(
          proposeSheetCheckFollowUpsTool,
          { checkId: all.draft.id },
          director,
        ),
      ),
    ).toBe("INVALID_STATE");
    expect(
      codeOf(
        await run(
          proposeSheetCheckFollowUpsTool,
          { checkId: all.cash.id },
          contextFor("FACTORY_ACCOUNTANT", world, service),
        ),
      ),
    ).toBe("PERMISSION_DENIED");
    expect(
      codeOf(
        await run(
          proposeSheetCheckFollowUpsTool,
          { checkId: all.generic.id },
          contextFor("CONTENT_CREATOR", world, service),
        ),
      ),
    ).toBe("PERMISSION_DENIED");
    expect(world.proposals.proposals.size).toBe(0);
  });

  it("refuses the factory manager, who reads checks but hands no work out", async () => {
    const { world, store, service } = build();
    const all = seedAll(store);
    expect(
      codeOf(
        await run(
          proposeSheetCheckFollowUpsTool,
          { checkId: all.generic.id },
          contextFor("FACTORY_MANAGER", world, service),
        ),
      ),
    ).toBe("PERMISSION_DENIED");
    expect(world.proposals.proposals.size).toBe(0);
  });
});

describe("real SheetCheckService", () => {
  /** The real service over the in-memory store; the read stores stay empty because reading never touches them. */
  function realService(store: FakeSheetCheckStore): SheetCheckService {
    return new SheetCheckService({
      store,
      orderStore: new FakeOrderStore(),
      invoiceStore: new FakeInvoiceStore(),
      financeEntryStore: new FakeFinanceEntryStore(),
      customerStore: new FakeCustomerStore(),
      auditRepository: auditRepository(),
      timeZone: tz,
      now: () => now,
    });
  }

  it("applies the same read rule as the fake over the real class", async () => {
    const { world, store } = build();
    const all = seedAll(store);
    const real = realService(store);
    for (const checkId of [all.cash.id, all.receivables.id]) {
      const outcome = await run(
        getSheetCheckTool,
        { checkId },
        contextFor("FACTORY_ACCOUNTANT", world, real),
      );
      expect(codeOf(outcome)).toBe("PERMISSION_DENIED");
      expect(JSON.stringify(outcome)).not.toContain("amount");
    }
    const wm = dataOf(
      await run(
        getSheetCheckTool,
        { checkId: all.generic.id },
        contextFor("WAREHOUSE_MANAGER", world, real),
      ),
    );
    expect(collectKeys(wm).has("system")).toBe(false);
    expect(
      codeOf(
        await run(
          getSheetCheckTool,
          { checkId: all.pricedGeneric.id },
          contextFor("FACTORY_MANAGER", world, real),
        ),
      ),
    ).toBe("PERMISSION_DENIED");
    for (const role of ["FACTORY_ACCOUNTANT", "FACTORY_MANAGER"] as const) {
      const listed = dataOf(
        await run(listSheetChecksTool, {}, contextFor(role, world, real)),
      );
      expect(
        (listed.items as { id: string }[]).map((item) => item.id),
        role,
      ).toEqual([all.generic.id, all.draft.id]);
    }
    const director = dataOf(
      await run(
        listSheetChecksTool,
        { limit: 20 },
        contextFor("DIRECTOR", world, real),
      ),
    );
    expect((director.items as unknown[]).length).toBe(6);
  });

  it("serves rows and follow-ups through the real class", async () => {
    const { world, store } = build();
    const all = seedAll(store);
    const real = realService(store);
    const director = contextFor("DIRECTOR", world, real);
    const row = dataOf(
      await run(
        getSheetCheckRowTool,
        { checkId: all.cash.id, sheetRowNumber: 7 },
        director,
      ),
    );
    expect(row).toMatchObject({ rowIndex: 2, outcome: "mismatch" });
    expect(
      codeOf(
        await run(
          getSheetCheckRowTool,
          { checkId: all.cash.id, rowIndex: 42 },
          director,
        ),
      ),
    ).toBe("NOT_FOUND");
    const followUps = dataOf(
      await run(
        proposeSheetCheckFollowUpsTool,
        { checkId: all.cash.id },
        director,
      ),
    );
    expect(
      (followUps.proposals as { itemCount: number }[]).map(
        (proposal) => proposal.itemCount,
      ),
    ).toEqual([2, 3]);
    expect(world.tasks.tasks.size).toBe(2);
  });
});
