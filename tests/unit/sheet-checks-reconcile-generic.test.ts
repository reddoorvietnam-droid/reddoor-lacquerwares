import { describe, expect, it } from "vitest";

import {
  emptyParsedRow,
  type CanonicalField,
  type ColumnMapping,
  type ParsedRow,
  type RowSystemView,
  type SheetCell,
  type SheetMapping,
  type SheetRow,
  type SystemSnapshot,
} from "@/domains/sheet-checks/contracts";
import {
  issue,
  type Issue,
  type IssueCode,
} from "@/domains/sheet-checks/issues";
import type {
  ParsedRowEntry,
  ParsedRows,
} from "@/domains/sheet-checks/parsing/rows";
import {
  reconcileGeneric,
  type GenericOutput,
} from "@/domains/sheet-checks/reconcile/generic";
import { reconcile } from "@/domains/sheet-checks/reconcile/index";
import { buildOrderIndex } from "@/domains/sheet-checks/reconcile/orders";
import { money } from "@/lib/money";

import {
  FakeCustomerStore,
  FakeFinanceEntryStore,
  FakeInvoiceStore,
  FakeOrderStore,
  unitId,
} from "./helpers/finance-fakes";

/**
 * The generic order-list engine with two kinds of runner: a unit-scoped
 * one whose snapshot carries nothing but its own orders, and a global one
 * that may compare selling prices, invoices, receipts and the directory.
 * The restricted runner's output is the oracle test: it must be a pure
 * function of the sheet text and the in-scope orders.
 */

const now = new Date("2026-09-06T02:00:00Z");
const timeZone = "Asia/Ho_Chi_Minh";
const unitB = "222222222222222222222222";
const customerA = "cacacacacacacacacacacaca";
const customerB = "cbcbcbcbcbcbcbcbcbcbcbcb";

const vnd = (amount: string) => money(amount, "VND");
const usd = (amount: string) => money(amount, "USD");

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

function mappingOf(
  fields: readonly CanonicalField[],
  compareSellingPrice = false,
): SheetMapping {
  return {
    columns: fields.map((field, index) => column(index, field)),
    defaultCurrency: "VND",
    period: null,
    compareSellingPrice,
  };
}

function entry(
  rowIndex: number,
  parsed: Partial<ParsedRow>,
  issues: Issue[] = [],
): ParsedRowEntry {
  return {
    rowIndex,
    parsed: { ...emptyParsedRow(), ...parsed },
    issues,
    skipped: false,
  };
}

type Stores = {
  orders: FakeOrderStore;
  invoices: FakeInvoiceStore;
  entries: FakeFinanceEntryStore;
  customers: FakeCustomerStore;
  a1: ReturnType<FakeOrderStore["seed"]>;
  a2: ReturnType<FakeOrderStore["seed"]>;
};

function stores(): Stores {
  const orders = new FakeOrderStore();
  const invoices = new FakeInvoiceStore();
  const entries = new FakeFinanceEntryStore();
  const customers = new FakeCustomerStore();
  customers.seed({ id: customerA, name: "Khách A", code: "KHA" });
  customers.seed({ id: customerB, name: "Khách B", code: "KHB" });
  const a1 = orders.seed({
    orderCode: "RD-A1",
    customerId: customerA,
    customerName: "Khách A",
    businessUnitIds: [unitId],
    stage: "inProduction",
    sellingPrice: { amount: "10000.00", currency: "USD" },
  });
  const a2 = orders.seed({
    orderCode: "RD-A2",
    customerId: customerA,
    customerName: "Khách A",
    businessUnitIds: [unitId],
    stage: "received",
    sellingPrice: null,
  });
  orders.seed({
    orderCode: "RD-CANCEL",
    customerName: "Khách A",
    businessUnitIds: [unitId],
    stage: "cancelled",
  });
  orders.seed({
    orderCode: "RD-CLOSED",
    customerName: "Khách A",
    businessUnitIds: [unitId],
    stage: "closed",
  });
  const b1 = orders.seed({
    orderCode: "RD-B1",
    customerId: customerB,
    customerName: "Khách B",
    businessUnitIds: [unitB],
    stage: "received",
    sellingPrice: { amount: "777000000", currency: "VND" },
  });
  const invoiceA1 = invoices.seed({
    orderId: a1.id,
    orderCode: a1.orderCode,
    customerId: customerA,
    customerName: "Khách A",
    invoiceNumber: "INV-A1",
    amount: { amount: "9500.00", currency: "USD" },
    issuedAt: new Date("2026-08-01T00:00:00Z"),
    dueAt: new Date("2026-08-31T00:00:00Z"),
  });
  invoices.seed({
    orderId: b1.id,
    orderCode: b1.orderCode,
    customerId: customerB,
    customerName: "Khách B",
    invoiceNumber: "INV-SECRET-77",
    amount: { amount: "777000000", currency: "VND" },
    issuedAt: new Date("2026-08-01T00:00:00Z"),
    dueAt: new Date("2026-08-31T00:00:00Z"),
  });
  entries.seed({
    kind: "receipt",
    category: "orderPayment",
    customerId: customerA,
    counterparty: "Khách A",
    amount: { amount: "2000.00", currency: "USD" },
    occurredAt: new Date("2026-08-10T03:00:00Z"),
    allocations: [
      {
        target: "invoice",
        invoiceId: invoiceA1.id,
        invoiceNumber: invoiceA1.invoiceNumber,
        orderId: a1.id,
        orderCode: a1.orderCode,
        amount: "2000.00",
      },
    ],
  });
  entries.seed({
    kind: "receipt",
    category: "orderPayment",
    customerId: customerB,
    counterparty: "Khách B",
    amount: { amount: "25000000", currency: "VND" },
    occurredAt: new Date("2026-08-11T03:00:00Z"),
  });
  return { orders, invoices, entries, customers, a1, a2 };
}

/** What the service loads for a unit-scoped runner: orders of the unit, nothing else. */
async function restricted(store: Stores): Promise<SystemSnapshot> {
  return {
    orders: await store.orders.list({
      kind: "businessUnits",
      businessUnitIds: [unitId],
    }),
    invoices: null,
    receipts: null,
    refunds: null,
    customers: null,
    sellingPriceVisible: false,
  };
}

/** What the service loads for a global runner holding every opportunistic permission. */
async function director(
  store: Stores,
  overrides: Partial<SystemSnapshot> = {},
): Promise<SystemSnapshot> {
  return {
    orders: await store.orders.list({ kind: "all" }),
    invoices: await store.invoices.list({}),
    receipts: [...store.entries.entries.values()],
    refunds: [],
    customers: await store.customers.list({}),
    sellingPriceVisible: true,
    ...overrides,
  };
}

function input(
  system: SystemSnapshot,
  rows: readonly ParsedRowEntry[],
  fields: readonly CanonicalField[],
  compareSellingPrice = false,
) {
  const parsed: ParsedRows = {
    rows: [...rows],
    columnIssues: [],
    columnStyles: {},
    dateOrders: {},
  };
  const sheetRows: SheetRow[] = rows.map((row) => ({
    index: row.rowIndex,
    sheetRowNumber: row.rowIndex + 2,
    kind: "data",
    hidden: false,
    cells: fields.map(() => cell("x")),
  }));
  return {
    template: "generic" as const,
    mapping: mappingOf(fields, compareSellingPrice),
    rows: sheetRows,
    parsed,
    headerTexts: [...fields],
    system,
    now,
    timeZone,
  };
}

function run(
  system: SystemSnapshot,
  rows: readonly Partial<ParsedRow>[],
  fields: readonly CanonicalField[],
  compareSellingPrice = false,
): GenericOutput {
  return reconcileGeneric({
    ...input(
      system,
      rows.map((row, index) => entry(index, row)),
      fields,
      compareSellingPrice,
    ),
    orderIndex: buildOrderIndex(system.orders ?? []),
  });
}

function codes(output: GenericOutput, rowIndex: number): IssueCode[] {
  return (output.rowIssues.get(rowIndex) ?? []).map((item) => item.code);
}

function find(
  output: GenericOutput,
  rowIndex: number,
  code: IssueCode,
): Issue | undefined {
  return output.rowIssues.get(rowIndex)?.find((item) => item.code === code);
}

function moneyKeys(view: RowSystemView | undefined): string[] {
  if (!view) return [];
  return Object.keys(view).filter((key) =>
    ["invoice", "receipts", "candidates", "balance"].includes(key),
  );
}

describe("reconcileGeneric — orders inside the runner's scope", () => {
  it("matches an order of the unit and reports its stage and customer", async () => {
    const store = stores();
    const output = run(
      await restricted(store),
      [{ orderCode: "RD-A1" }],
      ["orderCode"],
    );

    expect(codes(output, 0)).toEqual(["ORDER_MATCHED"]);
    expect(find(output, 0, "ORDER_MATCHED")?.params).toMatchObject({
      code: "RD-A1",
      customer: "Khách A",
    });
    expect(output.rowSystem.get(0)?.order).toEqual({
      id: store.a1.id,
      orderCode: "RD-A1",
      stage: "inProduction",
      customerName: "Khách A",
      sellingPrice: null,
    });
    expect(output.exercised).toEqual([]);
    expect(output.sheetIssues).toEqual([]);
  });

  it("yields the very same finding for an order in another unit and for one that does not exist", async () => {
    const store = stores();
    const output = run(
      await restricted(store),
      [{ orderCode: "RD-B1" }, { orderCode: "RD-NOPE" }],
      ["orderCode"],
    );

    const elsewhere = output.rowIssues.get(0);
    const absent = output.rowIssues.get(1);
    expect(elsewhere).toHaveLength(1);
    expect(elsewhere?.[0]).toEqual(issue("ORDER_NOT_FOUND", { code: "RD-B1" }));
    expect(absent?.[0]).toEqual(issue("ORDER_NOT_FOUND", { code: "RD-NOPE" }));
    expect({ ...elsewhere?.[0], params: {} }).toEqual({
      ...absent?.[0],
      params: {},
    });
    expect(Object.keys(elsewhere?.[0]?.params ?? {})).toEqual(
      Object.keys(absent?.[0]?.params ?? {}),
    );
    expect(output.rowSystem.get(0)).toEqual({ order: null });
    expect(output.rowSystem.get(1)).toEqual({ order: null });
    expect(JSON.stringify(output)).not.toContain("777000000");
  });

  it("notes cancelled and closed orders", async () => {
    const store = stores();
    const output = run(
      await restricted(store),
      [{ orderCode: "RD-CANCEL" }, { orderCode: "RD-CLOSED" }],
      ["orderCode"],
    );

    expect(codes(output, 0)).toEqual(["ORDER_MATCHED", "ORDER_CANCELLED"]);
    expect(codes(output, 1)).toEqual(["ORDER_MATCHED", "ORDER_CLOSED"]);
  });

  it("compares the customer name with the order when the directory is not readable", async () => {
    const store = stores();
    const output = run(
      await restricted(store),
      [
        { orderCode: "RD-A1", customerName: "Khách B" },
        { orderCode: "RD-A1", customerName: "Công ty Khách A" },
      ],
      ["orderCode", "customerName"],
    );

    expect(codes(output, 0)).toEqual([
      "ORDER_MATCHED",
      "ORDER_CUSTOMER_MISMATCH",
    ]);
    expect(find(output, 0, "ORDER_CUSTOMER_MISMATCH")?.params).toEqual({
      sheet: "Khách B",
      system: "Khách A",
    });
    expect(codes(output, 1)).toEqual(["ORDER_MATCHED"]);
    expect(output.sheetIssues).toEqual([
      issue("CUSTOMER_NOT_COMPARED", {}, { columnIndex: 1 }),
    ]);
    expect(output.exercised).toEqual([]);
    expect(output.rowSystem.get(0)?.customer).toBeUndefined();
  });

  it("compares the stage text with the order's stage", async () => {
    const store = stores();
    const output = run(
      await restricted(store),
      [
        { orderCode: "RD-A1", stage: "Đang sản xuất" },
        { orderCode: "RD-A1", stage: "Đang bay" },
        { orderCode: "RD-A1", stage: "Đã giao" },
      ],
      ["orderCode", "stage"],
    );

    expect(codes(output, 0)).toEqual(["ORDER_MATCHED"]);
    expect(codes(output, 1)).toEqual(["ORDER_MATCHED", "STAGE_UNRECOGNIZED"]);
    expect(find(output, 1, "STAGE_UNRECOGNIZED")?.params).toEqual({
      raw: "Đang bay",
    });
    expect(codes(output, 2)).toEqual(["ORDER_MATCHED", "STAGE_MISMATCH"]);
    expect(find(output, 2, "STAGE_MISMATCH")?.params.sheet).toBe("Đã giao");
    expect(
      String(find(output, 2, "STAGE_MISMATCH")?.params.system).length,
    ).toBeGreaterThan(0);
  });

  it("leaves rows without a usable order code to the parser", async () => {
    const store = stores();
    const output = run(
      await restricted(store),
      [{ orderCode: null, amount: vnd("1000000") }],
      ["orderCode", "amount"],
    );

    expect(output.rowIssues.size).toBe(0);
    expect(output.rowSystem.size).toBe(0);
  });
});

describe("reconcileGeneric — restricted runner", () => {
  const fields: CanonicalField[] = [
    "orderCode",
    "customerName",
    "amount",
    "invoiceNumber",
    "stage",
  ];

  it("notes each restricted column once and keeps money out of every row", async () => {
    const store = stores();
    const output = run(
      await restricted(store),
      [
        {
          orderCode: "RD-A1",
          customerName: "Khách A",
          amount: usd("9500.00"),
          invoiceNumber: "INV-A1",
          stage: "Đang sản xuất",
        },
        {
          orderCode: "RD-A2",
          customerName: "Khách A",
          amount: vnd("1000000"),
          invoiceNumber: "INV-A2",
        },
      ],
      fields,
    );

    expect(output.sheetIssues).toEqual([
      issue("AMOUNT_NOT_COMPARED", {}, { columnIndex: 2 }),
      issue("INVOICE_NOT_COMPARED", {}, { columnIndex: 3 }),
      issue("CUSTOMER_NOT_COMPARED", {}, { columnIndex: 1 }),
    ]);
    for (const [, view] of output.rowSystem) {
      expect(moneyKeys(view)).toEqual([]);
      expect(view.order?.sellingPrice).toBeNull();
    }
    for (const [, issues] of output.rowIssues) {
      const rowCodes = issues.map((item) => item.code);
      expect(
        rowCodes.some(
          (code) =>
            code.startsWith("INVOICE_") || code.startsWith("SELLING_PRICE_"),
        ),
      ).toBe(false);
    }
    expect(output.exercised).toEqual([]);
    const serialized = JSON.stringify(output);
    expect(serialized).not.toContain("10000.00");
    expect(serialized).not.toContain("INV-SECRET-77");
    expect(serialized).not.toContain("25000000");
  });

  it("ORACLE: the same sheet with different amounts yields identical findings", async () => {
    const store = stores();
    const system = await restricted(store);
    const sheet = (amount: string, flags: Issue[]): ParsedRowEntry[] => [
      entry(
        0,
        {
          orderCode: "RD-A1",
          customerName: "Khách A",
          amount: vnd(amount),
          invoiceNumber: "INV-A1",
          stage: "Đang sản xuất",
        },
        flags,
      ),
      entry(1, {
        orderCode: "RD-B1",
        customerName: "Khách B",
        amount: vnd(amount),
        invoiceNumber: "INV-SECRET-77",
      }),
      entry(2, { orderCode: "RD-CANCEL", amount: vnd(amount) }),
    ];
    const first = reconcile(input(system, sheet("1000000", []), fields));
    const second = reconcile(
      input(
        system,
        sheet("999999999", [
          issue("AMOUNT_UNIT_SUSPECT", { raw: "999999999" }),
        ]),
        fields,
      ),
    );

    const withoutFormatFlags = (issues: readonly Issue[]) =>
      issues.filter((item) => !item.code.startsWith("AMOUNT_"));
    expect(
      first.rowResults.map((row) => withoutFormatFlags(row.result.issues)),
    ).toEqual(
      second.rowResults.map((row) => withoutFormatFlags(row.result.issues)),
    );
    expect(first.rowResults.map((row) => row.result.outcome)).toEqual(
      second.rowResults.map((row) => row.result.outcome),
    );
    expect(withoutFormatFlags(first.sheetIssues)).toEqual(
      withoutFormatFlags(second.sheetIssues),
    );
    expect(first.rowResults.map((row) => row.result.system)).toEqual(
      second.rowResults.map((row) => row.result.system),
    );
    for (const result of [first, second]) {
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("10000.00");
      expect(serialized).not.toContain("777000000");
      expect(serialized).not.toContain("25000000");
      expect(result.exercised).toEqual([]);
      for (const row of result.rowResults) {
        expect(moneyKeys(row.result.system ?? undefined)).toEqual([]);
      }
    }
  });

  it("does not compare selling prices when the toggle is set but the permission is missing", async () => {
    const store = stores();
    const output = run(
      await restricted(store),
      [{ orderCode: "RD-A1", amount: usd("9500.00") }],
      ["orderCode", "amount"],
      true,
    );

    expect(codes(output, 0)).toEqual(["ORDER_MATCHED"]);
    expect(output.sheetIssues).toEqual([
      issue("AMOUNT_NOT_COMPARED", {}, { columnIndex: 1 }),
    ]);
    expect(output.exercised).toEqual([]);
    expect(JSON.stringify(output)).not.toContain("10000.00");
  });
});

describe("reconcileGeneric — global runner", () => {
  it("compares the amount with the selling price and stamps the permission", async () => {
    const store = stores();
    const output = run(
      await director(store),
      [
        { orderCode: "RD-A1", amount: usd("9500.00") },
        { orderCode: "RD-A2", amount: usd("1.00") },
        { orderCode: "RD-A1", amount: usd("10000.00") },
        { orderCode: "RD-A1", amount: vnd("250000000") },
      ],
      ["orderCode", "amount"],
      true,
    );

    expect(codes(output, 0)).toEqual([
      "ORDER_MATCHED",
      "SELLING_PRICE_MISMATCH",
    ]);
    expect(find(output, 0, "SELLING_PRICE_MISMATCH")?.params).toEqual({
      code: "RD-A1",
      system: "10000.00 USD",
      sheet: "9500.00 USD",
      diff: "-500.00 USD",
    });
    expect(codes(output, 1)).toEqual(["ORDER_MATCHED", "SELLING_PRICE_UNSET"]);
    expect(codes(output, 2)).toEqual(["ORDER_MATCHED", "SELLING_PRICE_MATCH"]);
    expect(codes(output, 3)).toEqual(["ORDER_MATCHED", "CURRENCY_MISMATCH"]);
    expect(find(output, 3, "CURRENCY_MISMATCH")?.params).toEqual({
      sheet: "VND",
      system: "USD",
    });
    expect(output.rowSystem.get(0)?.order?.sellingPrice).toEqual({
      amount: "10000.00",
      currency: "USD",
    });
    expect(output.sheetIssues).toEqual([]);
    expect(output.exercised).toEqual(["orders.readSellingPrice"]);
  });

  it("compares the invoice column and the amount against the invoice when selling prices are off", async () => {
    const store = stores();
    const output = run(
      await director(store),
      [
        { orderCode: "RD-A1", invoiceNumber: "INV-A1", amount: usd("9000.00") },
        { orderCode: "RD-A2", invoiceNumber: "inv a1" },
        { orderCode: "RD-A1", invoiceNumber: "INV-NOPE" },
      ],
      ["orderCode", "invoiceNumber", "amount"],
    );

    expect(codes(output, 0)).toEqual([
      "ORDER_MATCHED",
      "INVOICE_MATCHED",
      "INVOICE_AMOUNT_MISMATCH",
    ]);
    expect(find(output, 0, "INVOICE_AMOUNT_MISMATCH")?.params).toEqual({
      number: "INV-A1",
      system: "9500.00 USD",
      sheet: "9000.00 USD",
      diff: "-500.00 USD",
    });
    expect(codes(output, 1)).toEqual([
      "ORDER_MATCHED",
      "INVOICE_MATCHED",
      "INVOICE_MATCH_LOOSE",
      "INVOICE_ORDER_MISMATCH",
    ]);
    expect(find(output, 1, "INVOICE_ORDER_MISMATCH")?.params).toEqual({
      number: "INV-A1",
      system: "RD-A1",
      sheet: "RD-A2",
    });
    expect(codes(output, 2)).toEqual(["ORDER_MATCHED", "INVOICE_NOT_FOUND"]);
    expect(output.sheetIssues).toEqual([]);
    // Receipts were consulted for the open figures, so readers need them too.
    expect(output.rowSystem.get(0)?.invoice).toMatchObject({
      invoiceNumber: "INV-A1",
      paid: { amount: "2000.00", currency: "USD" },
      remaining: { amount: "7500.00", currency: "USD" },
    });
    expect(output.exercised).toEqual(["invoices.read", "payments.read"]);
  });

  it("keeps invoice figures out when receipts are not readable", async () => {
    const store = stores();
    const output = run(
      await director(store, { receipts: null, refunds: null }),
      [{ orderCode: "RD-A1", invoiceNumber: "INV-A1" }],
      ["orderCode", "invoiceNumber"],
    );

    expect(codes(output, 0)).toEqual(["ORDER_MATCHED", "INVOICE_MATCHED"]);
    expect(output.rowSystem.get(0)).not.toHaveProperty("invoice");
    expect(output.exercised).toEqual(["invoices.read"]);
  });

  it("resolves customers through the directory and stamps customers.read", async () => {
    const store = stores();
    const output = run(
      await director(store),
      [
        { orderCode: "RD-A1", customerName: "Khách B" },
        { orderCode: "RD-A1", customerCode: "kha" },
        { orderCode: "RD-A1", customerName: "Khách Lạ" },
      ],
      ["orderCode", "customerName", "customerCode"],
    );

    expect(codes(output, 0)).toEqual([
      "ORDER_MATCHED",
      "ORDER_CUSTOMER_MISMATCH",
    ]);
    expect(find(output, 0, "ORDER_CUSTOMER_MISMATCH")?.params).toEqual({
      sheet: "Khách B",
      system: "Khách A",
    });
    expect(output.rowSystem.get(0)?.customer).toEqual({
      id: customerB,
      name: "Khách B",
      code: "KHB",
    });
    expect(codes(output, 1)).toEqual(["ORDER_MATCHED"]);
    expect(output.rowSystem.get(1)?.customer).toEqual({
      id: customerA,
      name: "Khách A",
      code: "KHA",
    });
    expect(codes(output, 2)).toEqual([
      "ORDER_MATCHED",
      "CUSTOMER_NOT_FOUND",
      "ORDER_CUSTOMER_MISMATCH",
    ]);
    expect(output.sheetIssues).toEqual([]);
    expect(output.exercised).toEqual(["customers.read"]);
  });

  it("stamps only the permissions the rows actually used", async () => {
    const store = stores();
    // A directory is loaded but no row names a customer: nothing consulted.
    const output = run(
      await director(store),
      [{ orderCode: "RD-A1" }],
      ["orderCode", "customerName"],
    );
    expect(output.exercised).toEqual([]);
  });
});
