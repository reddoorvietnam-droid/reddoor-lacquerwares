import { describe, expect, it } from "vitest";

import {
  emptyParsedRow,
  type CanonicalField,
  type ColumnMapping,
  type ParsedRow,
  type SheetCell,
  type SheetCheckTemplate,
  type SheetMapping,
  type SheetRow,
  type SheetRowKind,
  type SystemSnapshot,
} from "@/domains/sheet-checks/contracts";
import {
  countBySeverity,
  issue,
  type Issue,
} from "@/domains/sheet-checks/issues";
import type {
  ParsedRowEntry,
  ParsedRows,
} from "@/domains/sheet-checks/parsing/rows";
import {
  reconcile,
  type ReconcileInput,
} from "@/domains/sheet-checks/reconcile/index";
import { money } from "@/lib/money";

import {
  FakeCustomerStore,
  FakeFinanceEntryStore,
  FakeInvoiceStore,
  FakeOrderStore,
  unitId,
} from "./helpers/finance-fakes";

/**
 * The orchestrator: one result per stored row, findings in a fixed order
 * (parsing, duplicates, comparison), outcomes and counts that agree with
 * the findings, and a template engine chosen by the mapping.
 */

const now = new Date("2026-09-06T02:00:00Z");
const timeZone = "Asia/Ho_Chi_Minh";
const customerId = "c0c0c0c0c0c0c0c0c0c0c0c0";

const vnd = (amount: string) => money(amount, "VND");

function cell(text: string): SheetCell {
  return {
    text,
    type: text === "" ? "z" : "s",
    number: null,
    numberFormat: null,
    formula: false,
    noCache: false,
    mergedFill: false,
    truncated: false,
  };
}

function column(columnIndex: number, field: CanonicalField): ColumnMapping {
  return {
    columnIndex,
    field,
    fixedCurrency: null,
    unitMultiplier: "1",
    numberStyle: null,
    dateOrder: null,
  };
}

type RowSpec = {
  kind?: SheetRowKind;
  cells?: string[];
  parsed: Partial<ParsedRow>;
  issues?: Issue[];
};

function build(
  template: SheetCheckTemplate,
  fields: readonly CanonicalField[],
  specs: readonly RowSpec[],
  system: SystemSnapshot,
  options: { columnIssues?: Issue[] } = {},
): ReconcileInput {
  const mapping: SheetMapping = {
    columns: fields.map((field, index) => column(index, field)),
    defaultCurrency: "VND",
    period: null,
    compareSellingPrice: false,
  };
  const rows: SheetRow[] = specs.map((spec, index) => ({
    index,
    sheetRowNumber: index + 2,
    kind: spec.kind ?? "data",
    hidden: false,
    cells: fields.map((_field, column) => cell(spec.cells?.[column] ?? "x")),
  }));
  const entries: ParsedRowEntry[] = specs.map((spec, index) => ({
    rowIndex: index,
    parsed: { ...emptyParsedRow(), ...spec.parsed },
    issues: spec.issues ?? [],
    skipped: (spec.kind ?? "data") !== "data",
  }));
  const parsed: ParsedRows = {
    rows: entries,
    columnIssues: options.columnIssues ?? [],
    columnStyles: {},
    dateOrders: {},
  };
  return {
    template,
    mapping,
    rows,
    parsed,
    headerTexts: [...fields],
    system,
    now,
    timeZone,
  };
}

function snapshot(partial: Partial<SystemSnapshot>): SystemSnapshot {
  return {
    orders: null,
    invoices: null,
    receipts: null,
    refunds: null,
    customers: null,
    sellingPriceVisible: false,
    ...partial,
  };
}

describe("reconcile — generic order list", () => {
  async function scopedOrders() {
    const orders = new FakeOrderStore();
    const a1 = orders.seed({
      orderCode: "RD-A1",
      customerName: "Khách A",
      businessUnitIds: [unitId],
      stage: "inProduction",
      sellingPrice: { amount: "10000.00", currency: "USD" },
    });
    return {
      a1,
      list: await orders.list({
        kind: "businessUnits",
        businessUnitIds: [unitId],
      }),
    };
  }

  it("returns one result per stored row with outcomes and ordered findings", async () => {
    const { list } = await scopedOrders();
    const columnIssue = issue(
      "CURRENCY_DEFAULTED",
      { header: "Số tiền", currency: "VND" },
      { columnIndex: 1 },
    );
    const output = reconcile(
      build(
        "generic",
        ["orderCode", "amount"],
        [
          {
            parsed: { orderCode: "RD-A1", amount: vnd("1000000") },
            issues: [issue("CELL_TRUNCATED", { max: 200 })],
          },
          { parsed: { orderCode: "RD-NOPE", amount: vnd("2000000") } },
          {
            parsed: { orderCode: null, amount: vnd("3000000") },
            issues: [issue("REQUIRED_EMPTY", { field: "Mã đơn" })],
          },
          {
            kind: "total",
            cells: ["Tổng cộng", "7.000.000"],
            parsed: { amount: vnd("7000000") },
          },
          { parsed: { orderCode: "RD-A1", amount: vnd("1000000") } },
        ],
        snapshot({ orders: list }),
        { columnIssues: [columnIssue] },
      ),
    );

    expect(output.rowResults.map((row) => row.rowIndex)).toEqual([
      0, 1, 2, 3, 4,
    ]);
    const outcomes = output.rowResults.map((row) => row.result.outcome);
    expect(outcomes).toEqual([
      "matched",
      "notFound",
      "invalid",
      "skipped",
      "mismatch",
    ]);

    const first = output.rowResults[0]?.result;
    expect(first?.issues.map((item) => item.code)).toEqual([
      "CELL_TRUNCATED",
      "ORDER_MATCHED",
    ]);
    expect(first?.system?.order?.orderCode).toBe("RD-A1");
    expect(first?.system?.order?.sellingPrice).toBeNull();

    const duplicate = output.rowResults[4]?.result;
    expect(duplicate?.issues.map((item) => item.code)).toEqual([
      "DUPLICATE_ROW",
      "ORDER_MATCHED",
    ]);
    expect(duplicate?.issues[0]?.params).toEqual({ n: 2 });

    const total = output.rowResults[3]?.result;
    expect(total?.outcome).toBe("skipped");
    expect(total?.system).toBeNull();
    expect(total?.issues).toEqual([]);
    expect(total?.parsed.amount).toEqual({
      amount: "7000000",
      currency: "VND",
    });

    expect(output.rowResults[1]?.result.system).toEqual({ order: null });
    expect(output.rowResults[2]?.result.system).toBeNull();

    expect(output.sheetIssues[0]).toEqual(columnIssue);
    expect(output.sheetIssues.map((item) => item.code)).toContain(
      "AMOUNT_NOT_COMPARED",
    );
    expect(
      output.sheetIssues.find((item) => item.code === "AMOUNT_NOT_COMPARED")
        ?.columnIndex,
    ).toBe(1);

    expect(output.summary.dataRows).toBe(4);
    expect(output.summary.skippedRows).toBe(1);
    expect(output.summary.outcomes).toEqual({
      matched: 1,
      mismatch: 1,
      notFound: 1,
      notCompared: 0,
      invalid: 1,
      skipped: 1,
    });
    const counted = countBySeverity([
      ...output.rowResults.flatMap((row) => row.result.issues),
      ...output.sheetIssues,
    ]);
    expect(output.summary.errors).toBe(counted.error);
    expect(output.summary.warnings).toBe(counted.warn);
    expect(output.summary.infos).toBe(counted.info);
    expect(output.summary.errors).toBeGreaterThanOrEqual(3);

    const amountLine = output.summary.totals.find(
      (line) => line.field === "amount" && line.currency === "VND",
    );
    expect(amountLine?.computed).toBe("7000000");
    expect(amountLine?.system).toBeNull();
    expect(output.systemOnly).toEqual([]);
    expect(output.exercised).toEqual([]);
    expect(JSON.stringify(output)).not.toContain("10000.00");
  });

  it("passes the exercised permissions of a global run through", async () => {
    const orders = new FakeOrderStore();
    orders.seed({
      orderCode: "RD-A1",
      customerName: "Khách A",
      sellingPrice: { amount: "10000.00", currency: "USD" },
    });
    const input = build(
      "generic",
      ["orderCode", "amount"],
      [{ parsed: { orderCode: "RD-A1", amount: money("9500.00", "USD") } }],
      snapshot({
        orders: await orders.list({ kind: "all" }),
        sellingPriceVisible: true,
      }),
    );
    const output = reconcile({
      ...input,
      mapping: { ...input.mapping, compareSellingPrice: true },
    });

    expect(output.exercised).toEqual(["orders.readSellingPrice"]);
    expect(
      output.rowResults[0]?.result.issues.map((item) => item.code),
    ).toEqual(["ORDER_MATCHED", "SELLING_PRICE_MISMATCH"]);
    expect(output.rowResults[0]?.result.outcome).toBe("matched");
    expect(output.rowResults[0]?.result.system?.order?.sellingPrice).toEqual({
      amount: "10000.00",
      currency: "USD",
    });
  });
});

describe("reconcile — money templates", () => {
  function financeFixture() {
    const orders = new FakeOrderStore();
    const invoices = new FakeInvoiceStore();
    const entries = new FakeFinanceEntryStore();
    const customers = new FakeCustomerStore();
    customers.seed({ id: customerId, name: "Khách Fixture" });
    const order = orders.seed({
      orderCode: "RD-FIXTURE",
      customerId,
      customerName: "Khách Fixture",
      stage: "invoiced",
    });
    const invoice = invoices.seed({
      orderId: order.id,
      orderCode: order.orderCode,
      customerId,
      customerName: "Khách Fixture",
      invoiceNumber: "INV-120",
      amount: { amount: "120000000", currency: "VND" },
      issuedAt: new Date("2026-08-01T00:00:00Z"),
      dueAt: new Date("2026-08-31T00:00:00Z"),
    });
    for (const [amount, day] of [
      ["30000000", "2026-08-10"],
      ["20000000", "2026-08-15"],
    ] as const) {
      entries.seed({
        kind: "receipt",
        category: "orderPayment",
        customerId,
        counterparty: "Khách Fixture",
        amount: { amount, currency: "VND" },
        occurredAt: new Date(`${day}T03:00:00Z`),
        allocations: [
          {
            target: "invoice",
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            orderId: order.id,
            orderCode: order.orderCode,
            amount,
          },
        ],
      });
    }
    return snapshot({
      orders: [...orders.orders.values()],
      invoices: [...invoices.invoices.values()],
      receipts: [...entries.entries.values()],
      refunds: [],
      customers: [...customers.customers.values()],
    });
  }

  it("runs the receivables engine and carries the system total into the totals table", () => {
    const output = reconcile(
      build(
        "receivables",
        ["customerName", "outstanding"],
        [
          {
            parsed: {
              customerName: "Khách Fixture",
              outstanding: vnd("70000000"),
            },
          },
          {
            parsed: {
              customerName: "Khách Nobody",
              outstanding: vnd("5000000"),
            },
          },
          {
            parsed: {
              customerName: "Khách Fixture",
              outstanding: vnd("60000000"),
            },
          },
        ],
        financeFixture(),
      ),
    );

    expect(output.rowResults.map((row) => row.result.outcome)).toEqual([
      "matched",
      "notFound",
      "mismatch",
    ]);
    expect(output.rowResults[0]?.result.system?.balance?.balance.amount).toBe(
      "70000000",
    );
    // Both members of a duplicated key are flagged (either may be the stray
    // row); the duplicate finding precedes the comparison on each.
    expect(
      output.rowResults[0]?.result.issues.map((item) => item.code),
    ).toEqual(["DUPLICATE_KEY", "BALANCE_MATCH"]);
    expect(
      output.rowResults[1]?.result.issues.map((item) => item.code),
    ).toEqual(["CUSTOMER_NOT_FOUND"]);
    expect(
      output.rowResults[2]?.result.issues.map((item) => item.code),
    ).toEqual(["DUPLICATE_KEY", "BALANCE_MISMATCH"]);

    const line = output.summary.totals.find(
      (entry) => entry.field === "outstanding" && entry.currency === "VND",
    );
    expect(line?.computed).toBe("135000000");
    expect(line?.system).toBe("70000000");
    expect(output.sheetIssues.map((item) => item.code)).toContain(
      "RECEIVABLES_TOTAL_MISMATCH",
    );
    expect(output.exercised).toEqual([]);
    expect(output.summary.outcomes.matched).toBe(1);
    expect(output.summary.outcomes.mismatch).toBe(1);
    expect(output.summary.outcomes.notFound).toBe(1);
  });

  it("runs the cash engine and injects its period totals", () => {
    const output = reconcile(
      build(
        "incomingCash",
        ["date", "customerName", "amount"],
        [
          {
            parsed: {
              date: "2026-08-10",
              customerName: "Khách Fixture",
              amount: vnd("30000000"),
            },
          },
          {
            parsed: {
              date: "2026-08-15",
              customerName: "Khách Fixture",
              amount: vnd("20000000"),
            },
          },
        ],
        financeFixture(),
      ),
    );

    for (const row of output.rowResults) {
      expect(row.result.issues.map((item) => item.code)).toContain(
        "RECEIPT_MATCHED",
      );
      expect(row.result.outcome).toBe("matched");
      expect(row.result.system?.receipts).toHaveLength(1);
    }
    const line = output.summary.totals.find(
      (entry) => entry.field === "amount" && entry.currency === "VND",
    );
    expect(line?.computed).toBe("50000000");
    expect(line?.system).toBe("50000000");
    expect(output.sheetIssues.map((item) => item.code)).not.toContain(
      "PERIOD_TOTAL_MISMATCH",
    );
    expect(output.systemOnly).toEqual([]);
    expect(output.exercised).toEqual([]);
  });
});
