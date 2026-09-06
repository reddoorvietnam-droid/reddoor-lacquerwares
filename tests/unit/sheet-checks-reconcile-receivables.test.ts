import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";

import type {
  FinanceEntryRecordDto,
  ReceiptAllocation,
} from "@/domains/finance/contracts";
import {
  SheetCheckError,
  emptyParsedRow,
  type CanonicalField,
  type ColumnMapping,
  type ParsedRow,
  type SheetCell,
  type SheetMapping,
  type SheetPeriod,
  type SheetRow,
  type SystemSnapshot,
} from "@/domains/sheet-checks/contracts";
import type { Issue, IssueCode } from "@/domains/sheet-checks/issues";
import type {
  ParsedRowEntry,
  ParsedRows,
} from "@/domains/sheet-checks/parsing/rows";
import { buildOrderIndex } from "@/domains/sheet-checks/reconcile/orders";
import {
  reconcileReceivables,
  type ReceivablesOutput,
} from "@/domains/sheet-checks/reconcile/receivables";
import { money, type Currency } from "@/lib/money";

import {
  FakeCustomerStore,
  FakeFinanceEntryStore,
  FakeInvoiceStore,
  FakeOrderStore,
} from "./helpers/finance-fakes";

/**
 * The receivables engine against the acceptance fixture of the finance
 * tests: 120M invoiced, 30M + 20M received, 70M outstanding. Every case
 * builds the snapshot exactly as the service would load it for a runner
 * holding the template gate, then hands the engine hand-parsed rows.
 */

const now = new Date("2026-09-06T02:00:00Z");
const timeZone = "Asia/Ho_Chi_Minh";
const customerId = "c0c0c0c0c0c0c0c0c0c0c0c0";
const otherCustomerId = "c1c1c1c1c1c1c1c1c1c1c1c1";

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
  period: SheetPeriod | null = null,
): SheetMapping {
  return {
    columns: fields.map((field, index) => column(index, field)),
    defaultCurrency: "VND",
    period,
    compareSellingPrice: false,
  };
}

function entry(rowIndex: number, parsed: Partial<ParsedRow>): ParsedRowEntry {
  return {
    rowIndex,
    parsed: { ...emptyParsedRow(), ...parsed },
    issues: [],
    skipped: false,
  };
}

type Fixture = {
  orders: FakeOrderStore;
  invoices: FakeInvoiceStore;
  entries: FakeFinanceEntryStore;
  customers: FakeCustomerStore;
  order: ReturnType<FakeOrderStore["seed"]>;
  invoice: ReturnType<FakeInvoiceStore["seed"]>;
  receipt: (input: ReceiptInput) => FinanceEntryRecordDto;
  snapshot: () => SystemSnapshot;
};

type ReceiptInput = {
  amount: string;
  currency?: Currency;
  day: string;
  customerId?: string | null;
  counterparty?: string;
  allocations?: readonly ReceiptAllocation[];
  category?: "orderPayment" | "refund";
};

function fixture(): Fixture {
  const orders = new FakeOrderStore();
  const invoices = new FakeInvoiceStore();
  const entries = new FakeFinanceEntryStore();
  const customers = new FakeCustomerStore();
  customers.seed({ id: customerId, name: "Khách Fixture", code: "KH0001" });
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
  const receipt = (input: ReceiptInput): FinanceEntryRecordDto =>
    entries.seed({
      kind: input.category === "refund" ? "expense" : "receipt",
      category: input.category ?? "orderPayment",
      customerId:
        input.customerId === undefined ? customerId : input.customerId,
      counterparty: input.counterparty ?? "Khách Fixture",
      amount: { amount: input.amount, currency: input.currency ?? "VND" },
      occurredAt: new Date(`${input.day}T03:00:00Z`),
      allocations: input.allocations ?? [],
    });
  const toInvoice = (amount: string): ReceiptAllocation[] => [
    {
      target: "invoice",
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      orderId: order.id,
      orderCode: order.orderCode,
      amount,
    },
  ];
  receipt({
    amount: "30000000",
    day: "2026-08-10",
    allocations: toInvoice("30000000"),
  });
  receipt({
    amount: "20000000",
    day: "2026-08-20",
    allocations: toInvoice("20000000"),
  });

  const snapshot = (): SystemSnapshot => {
    const all = [...entries.entries.values()];
    return {
      orders: [...orders.orders.values()],
      invoices: [...invoices.invoices.values()],
      receipts: all.filter(
        (item) => item.kind === "receipt" && item.category === "orderPayment",
      ),
      refunds: all.filter(
        (item) => item.category === "refund" && item.status === "active",
      ),
      customers: [...customers.customers.values()],
      sellingPriceVisible: false,
    };
  };
  return {
    orders,
    invoices,
    entries,
    customers,
    order,
    invoice,
    receipt,
    snapshot,
  };
}

type RunOptions = {
  period?: SheetPeriod;
  directory?: boolean;
  system?: SystemSnapshot;
};

function run(
  fx: Fixture,
  rows: readonly Partial<ParsedRow>[],
  fields: readonly CanonicalField[],
  options: RunOptions = {},
): ReceivablesOutput {
  const system = options.system ?? fx.snapshot();
  if (options.directory === false) system.customers = null;
  const parsed: ParsedRows = {
    rows: rows.map((row, index) => entry(index, row)),
    columnIssues: [],
    columnStyles: {},
    dateOrders: {},
  };
  const sheetRows: SheetRow[] = rows.map((_row, index) => ({
    index,
    sheetRowNumber: index + 2,
    kind: "data",
    hidden: false,
    cells: fields.map(() => cell("x")),
  }));
  return reconcileReceivables({
    template: "receivables",
    mapping: mappingOf(fields, options.period ?? null),
    rows: sheetRows,
    parsed,
    headerTexts: [...fields],
    system,
    now,
    timeZone,
    orderIndex: buildOrderIndex(system.orders ?? []),
  });
}

function codes(output: ReceivablesOutput, rowIndex: number): IssueCode[] {
  return (output.rowIssues.get(rowIndex) ?? []).map((item) => item.code);
}

function find(
  output: ReceivablesOutput,
  rowIndex: number,
  code: IssueCode,
): Issue | undefined {
  return output.rowIssues.get(rowIndex)?.find((item) => item.code === code);
}

const customerSheet: CanonicalField[] = ["customerName", "outstanding"];

describe("reconcileReceivables — customer balances", () => {
  it("matches the closing balance of the acceptance fixture (120M − 50M = 70M)", () => {
    const fx = fixture();
    const output = run(
      fx,
      [{ customerName: "Khách Fixture", outstanding: vnd("70000000") }],
      customerSheet,
    );

    expect(codes(output, 0)).toEqual(["BALANCE_MATCH"]);
    expect(find(output, 0, "BALANCE_MATCH")?.params).toEqual({
      balance: "70000000 VND",
    });
    const system = output.rowSystem.get(0);
    expect(system?.customer).toEqual({
      id: customerId,
      name: "Khách Fixture",
      code: "KH0001",
    });
    expect(system?.balance?.balance).toEqual({
      amount: "70000000",
      currency: "VND",
    });
    expect(system?.balance?.outstanding.amount).toBe("70000000");
    expect(output.systemOnly).toEqual([]);
    expect(output.sheetIssues).toEqual([]);
    expect(output.systemTotals.get("outstanding")?.get("VND")).toBe("70000000");
  });

  it("an unallocated advance: the sheet's outstanding matches only ignoring the credit", () => {
    const fx = fixture();
    fx.receipt({ amount: "20000000", day: "2026-08-25" });
    const output = run(
      fx,
      [
        { customerName: "Khách Fixture", outstanding: vnd("70000000") },
        { customerName: "Khách Fixture", outstanding: vnd("60000000") },
      ],
      customerSheet,
    );

    expect(codes(output, 0)).toEqual(["BALANCE_MATCH_IGNORING_CREDIT"]);
    expect(find(output, 0, "BALANCE_MATCH_IGNORING_CREDIT")?.params).toEqual({
      outstanding: "70000000 VND",
      credit: "20000000 VND",
      balance: "50000000 VND",
    });
    expect(codes(output, 1)).toEqual(["BALANCE_MISMATCH"]);
    expect(find(output, 1, "BALANCE_MISMATCH")?.params).toEqual({
      sheet: "60000000 VND",
      outstanding: "70000000 VND",
      credit: "20000000 VND",
      balance: "50000000 VND",
      diff: "10000000 VND",
      explanation: "không tìm được khoản đơn lẻ",
    });
  });

  it("explains a gap that equals one open invoice the sheet misses", () => {
    const fx = fixture();
    fx.receipt({ amount: "20000000", day: "2026-08-25" });
    fx.invoices.seed({
      orderId: fx.order.id,
      orderCode: fx.order.orderCode,
      customerId,
      customerName: "Khách Fixture",
      invoiceNumber: "INV-15",
      amount: { amount: "15000000", currency: "VND" },
      issuedAt: new Date("2026-08-20T00:00:00Z"),
      dueAt: new Date("2026-09-20T00:00:00Z"),
    });
    const output = run(
      fx,
      [{ customerName: "Khách Fixture", outstanding: vnd("50000000") }],
      customerSheet,
    );

    const mismatch = find(output, 0, "BALANCE_MISMATCH");
    expect(mismatch?.params.balance).toBe("65000000 VND");
    expect(mismatch?.params.diff).toBe("-15000000 VND");
    expect(mismatch?.params.explanation).toBe("bằng hóa đơn INV-15 còn thiếu");
  });

  it("explains a void-and-reissue reduction by the voided invoice", async () => {
    const fx = fixture();
    await fx.invoices.void({
      invoiceId: fx.invoice.id,
      expectedRevision: fx.invoice.revision,
      reason: "Giảm trừ đã duyệt 5.000.000",
      updatedBy: "u",
    });
    const corrected = fx.invoices.seed({
      orderId: fx.order.id,
      orderCode: fx.order.orderCode,
      customerId,
      customerName: "Khách Fixture",
      invoiceNumber: "INV-115",
      amount: { amount: "115000000", currency: "VND" },
      issuedAt: new Date("2026-08-01T00:00:00Z"),
      dueAt: new Date("2026-08-31T00:00:00Z"),
    });
    for (const item of await fx.entries.listActive({ kind: "receipt" })) {
      await fx.entries.setAllocations({
        entryId: item.id,
        expectedRevision: item.revision,
        allocations: [
          {
            target: "invoice",
            invoiceId: corrected.id,
            invoiceNumber: corrected.invoiceNumber,
            orderId: fx.order.id,
            orderCode: fx.order.orderCode,
            amount: item.amount.amount,
          },
        ],
        updatedBy: "u",
      });
    }
    const output = run(
      fx,
      [{ customerName: "Khách Fixture", outstanding: vnd("70000000") }],
      customerSheet,
    );

    const mismatch = find(output, 0, "BALANCE_MISMATCH");
    expect(mismatch?.params.balance).toBe("65000000 VND");
    expect(mismatch?.params.diff).toBe("5000000 VND");
    expect(mismatch?.params.explanation).toBe("hóa đơn INV-120 đã hủy");
  });

  it("explains a gap that equals one receipt of the customer", () => {
    const fx = fixture();
    fx.receipt({ amount: "7000000", day: "2026-08-28" });
    // 70M outstanding − 7M credit = 63M; the sheet says 56M, one receipt short.
    const output = run(
      fx,
      [{ customerName: "Khách Fixture", outstanding: vnd("56000000") }],
      customerSheet,
    );

    const mismatch = find(output, 0, "BALANCE_MISMATCH");
    expect(mismatch?.params.diff).toBe("-7000000 VND");
    expect(mismatch?.params.explanation).toBe("bằng phiếu thu ngày 2026-08-28");
  });

  it("compares a negative balance as-is", () => {
    const fx = fixture();
    fx.customers.seed({ id: otherCustomerId, name: "Khách Advance" });
    fx.receipt({
      amount: "5000000",
      day: "2026-08-05",
      customerId: otherCustomerId,
      counterparty: "Khách Advance",
    });
    const output = run(
      fx,
      [{ customerName: "Khách Advance", outstanding: vnd("-5000000") }],
      customerSheet,
    );

    expect(codes(output, 0)).toEqual(["BALANCE_MATCH"]);
    expect(find(output, 0, "BALANCE_MATCH")?.params.balance).toBe(
      "-5000000 VND",
    );
  });

  it("compares a USD row only with the customer's USD figures", () => {
    const fx = fixture();
    fx.invoices.seed({
      orderId: fx.order.id,
      orderCode: fx.order.orderCode,
      customerId,
      customerName: "Khách Fixture",
      invoiceNumber: "INV-USD",
      amount: { amount: "1000.00", currency: "USD" },
      fxRateToVnd: "25000",
      issuedAt: new Date("2026-08-15T00:00:00Z"),
      dueAt: new Date("2026-09-15T00:00:00Z"),
    });
    const output = run(
      fx,
      [
        { customerName: "Khách Fixture", outstanding: vnd("70000000") },
        { customerName: "Khách Fixture", outstanding: usd("1000.00") },
        { customerName: "Khách Fixture", outstanding: usd("900.00") },
      ],
      customerSheet,
    );

    expect(codes(output, 0)).toEqual(["BALANCE_MATCH"]);
    expect(codes(output, 1)).toEqual(["BALANCE_MATCH"]);
    expect(find(output, 1, "BALANCE_MATCH")?.params.balance).toBe(
      "1000.00 USD",
    );
    const usdMismatch = find(output, 2, "BALANCE_MISMATCH");
    expect(usdMismatch?.params.outstanding).toBe("1000.00 USD");
    expect(usdMismatch?.params.diff).toBe("-100.00 USD");
    expect(JSON.stringify(output.rowIssues.get(2))).not.toContain("70000000");
    expect(output.rowSystem.get(1)?.balance?.currency).toBe("USD");
  });

  it("reports the currency when the customer holds balances only in the other currency", () => {
    const fx = fixture();
    const output = run(
      fx,
      [{ customerName: "Khách Fixture", outstanding: usd("100.00") }],
      customerSheet,
    );

    expect(codes(output, 0)).toEqual(["CURRENCY_MISMATCH"]);
    expect(find(output, 0, "CURRENCY_MISMATCH")?.params).toEqual({
      sheet: "USD",
      system: "VND",
    });
  });

  it("adds a refund back, the way the system's own credit formula does", () => {
    const fx = fixture();
    // 10 opening + 120 invoiced − 50 received + 5 refunded = 85: money handed
    // back to the customer is money they owe again (credit = received −
    // refunded in computeReceivables), so this statement adds up.
    const balanced = run(
      fx,
      [
        {
          customerName: "Khách Fixture",
          openingBalance: vnd("10000000"),
          invoiced: vnd("120000000"),
          received: vnd("50000000"),
          refunded: vnd("5000000"),
          outstanding: vnd("85000000"),
        },
      ],
      [
        "customerName",
        "openingBalance",
        "invoiced",
        "received",
        "refunded",
        "outstanding",
      ],
    );
    expect(codes(balanced, 0)).not.toContain("ROW_ARITHMETIC_MISMATCH");

    // Subtracting the refund instead is what the sheet must not do.
    const wrong = run(
      fx,
      [
        {
          customerName: "Khách Fixture",
          openingBalance: vnd("10000000"),
          invoiced: vnd("120000000"),
          received: vnd("50000000"),
          refunded: vnd("5000000"),
          outstanding: vnd("75000000"),
        },
      ],
      [
        "customerName",
        "openingBalance",
        "invoiced",
        "received",
        "refunded",
        "outstanding",
      ],
    );
    expect(find(wrong, 0, "ROW_ARITHMETIC_MISMATCH")?.params).toMatchObject({
      r: "5000000 VND",
      calc: "85000000 VND",
      sheet: "75000000 VND",
    });
  });

  it("flags the sheet's own arithmetic and skips the system comparison", () => {
    const fx = fixture();
    const output = run(
      fx,
      [
        {
          customerName: "Khách Fixture",
          openingBalance: vnd("10000000"),
          invoiced: vnd("120000000"),
          received: vnd("50000000"),
          outstanding: vnd("70000000"),
        },
      ],
      ["customerName", "openingBalance", "invoiced", "received", "outstanding"],
    );

    expect(codes(output, 0)).toEqual(["ROW_ARITHMETIC_MISMATCH"]);
    expect(find(output, 0, "ROW_ARITHMETIC_MISMATCH")?.params).toEqual({
      a: "10000000 VND",
      b: "120000000 VND",
      c: "50000000 VND",
      r: "0 VND",
      calc: "80000000 VND",
      sheet: "70000000 VND",
      diff: "-10000000 VND",
    });
    expect(output.rowSystem.get(0)?.customer?.id).toBe(customerId);
    expect(output.rowSystem.get(0)?.balance).toBeUndefined();
  });

  it("matches names through the report itself when the directory is not readable", () => {
    const fx = fixture();
    const output = run(
      fx,
      [
        { customerName: "Cty Khách Fixture", outstanding: vnd("70000000") },
        { customerName: "Khách Nobody", outstanding: vnd("1000000") },
      ],
      customerSheet,
      { directory: false },
    );

    expect(codes(output, 0)).toEqual([
      "CUSTOMER_MATCH_NORMALIZED",
      "BALANCE_MATCH",
    ]);
    expect(output.rowSystem.get(0)?.customer).toBeUndefined();
    expect(output.rowSystem.get(0)?.balance?.balance.amount).toBe("70000000");
    expect(codes(output, 1)).toEqual(["CUSTOMER_NOT_FOUND"]);
    expect(output.rowSystem.get(1)).toBeUndefined();
  });

  it("refuses to run without the finance parts of the snapshot", () => {
    const fx = fixture();
    const system = fx.snapshot();
    system.receipts = null;
    expect(() => run(fx, [], customerSheet, { system })).toThrowError(
      SheetCheckError,
    );
    try {
      run(fx, [], customerSheet, { system });
    } catch (error) {
      expect((error as SheetCheckError).code).toBe("PERMISSION_DENIED");
    }
  });
});

describe("reconcileReceivables — period columns", () => {
  const period: SheetPeriod = { from: "2026-08-01", to: "2026-08-31" };

  function periodFixture(): Fixture {
    const fx = fixture();
    fx.invoices.seed({
      orderId: fx.order.id,
      orderCode: fx.order.orderCode,
      customerId,
      customerName: "Khách Fixture",
      invoiceNumber: "INV-JUL",
      amount: { amount: "10000000", currency: "VND" },
      issuedAt: new Date("2026-07-15T00:00:00Z"),
      dueAt: new Date("2026-07-31T00:00:00Z"),
    });
    fx.receipt({ amount: "5000000", day: "2026-08-15" });
    fx.receipt({ amount: "2000000", day: "2026-08-25", category: "refund" });
    const september = fx.invoices.seed({
      orderId: fx.order.id,
      orderCode: fx.order.orderCode,
      customerId,
      customerName: "Khách Fixture",
      invoiceNumber: "INV-SEP",
      amount: { amount: "10000000", currency: "VND" },
      issuedAt: new Date("2026-09-02T00:00:00Z"),
      dueAt: new Date("2026-09-30T00:00:00Z"),
    });
    fx.receipt({
      amount: "7000000",
      day: "2026-09-03",
      allocations: [
        {
          target: "invoice",
          invoiceId: september.id,
          invoiceNumber: september.invoiceNumber,
          orderId: fx.order.id,
          orderCode: fx.order.orderCode,
          amount: "7000000",
        },
      ],
    });
    return fx;
  }

  it("excludes invoices and receipts after period.to and counts the refund", () => {
    const fx = periodFixture();
    const inPeriod = run(
      fx,
      [{ customerName: "Khách Fixture", outstanding: vnd("77000000") }],
      customerSheet,
      { period },
    );
    expect(codes(inPeriod, 0)).toEqual(["BALANCE_MATCH"]);
    expect(inPeriod.rowSystem.get(0)?.balance?.credit.amount).toBe("3000000");

    const unbounded = run(
      fx,
      [{ customerName: "Khách Fixture", outstanding: vnd("77000000") }],
      customerSheet,
    );
    expect(find(unbounded, 0, "BALANCE_MISMATCH")?.params.balance).toBe(
      "80000000 VND",
    );
  });

  it("compares the opening balance with the balance as of period.from − 1", () => {
    const fx = periodFixture();
    const output = run(
      fx,
      [
        {
          customerName: "Khách Fixture",
          openingBalance: vnd("12000000"),
          outstanding: vnd("77000000"),
        },
        {
          customerName: "Khách Fixture",
          openingBalance: vnd("10000000"),
          outstanding: vnd("77000000"),
        },
      ],
      ["customerName", "openingBalance", "outstanding"],
      { period },
    );

    expect(find(output, 0, "OPENING_MISMATCH")?.params).toEqual({
      sheet: "12000000 VND",
      system: "10000000 VND",
      day: "2026-07-31",
    });
    expect(codes(output, 1)).not.toContain("OPENING_MISMATCH");
  });

  it("compares the invoiced column with the invoices issued in the period", () => {
    const fx = periodFixture();
    const output = run(
      fx,
      [
        {
          customerName: "Khách Fixture",
          invoiced: vnd("100000000"),
          outstanding: vnd("77000000"),
        },
      ],
      ["customerName", "invoiced", "outstanding"],
      { period },
    );

    expect(find(output, 0, "INVOICED_PERIOD_MISMATCH")?.params).toEqual({
      sheet: "100000000 VND",
      system: "120000000 VND",
      invoices: "INV-120",
    });
  });

  it("compares the received column with the receipts of the period", () => {
    const fx = periodFixture();
    const output = run(
      fx,
      [
        {
          customerName: "Khách Fixture",
          received: vnd("50000000"),
          outstanding: vnd("77000000"),
        },
      ],
      ["customerName", "received", "outstanding"],
      { period },
    );

    const mismatch = find(output, 0, "RECEIVED_PERIOD_MISMATCH");
    expect(mismatch?.params.sheet).toBe("50000000 VND");
    expect(mismatch?.params.system).toBe("55000000 VND");
    expect(String(mismatch?.params.receipts)).toContain(
      "2026-08-10 30000000 VND",
    );
    expect(String(mismatch?.params.receipts)).not.toContain("2026-09-03");
  });

  it("skips the period comparisons when the sheet names no period", () => {
    const fx = periodFixture();
    const output = run(
      fx,
      [
        {
          customerName: "Khách Fixture",
          openingBalance: vnd("1"),
          invoiced: vnd("1"),
          received: vnd("1"),
          outstanding: vnd("80000000"),
        },
      ],
      ["customerName", "openingBalance", "invoiced", "received", "outstanding"],
    );
    // The arithmetic check fires first; nothing period-related is raised.
    expect(codes(output, 0)).toEqual(["ROW_ARITHMETIC_MISMATCH"]);
  });
});

describe("reconcileReceivables — system-only records and totals", () => {
  it("lists customers with a balance absent from the sheet, not zero-balance ones", () => {
    const fx = fixture();
    fx.customers.seed({ id: otherCustomerId, name: "Khách B" });
    const orderB = fx.orders.seed({
      orderCode: "RD-B",
      customerId: otherCustomerId,
      customerName: "Khách B",
      stage: "invoiced",
    });
    fx.invoices.seed({
      orderId: orderB.id,
      orderCode: orderB.orderCode,
      customerId: otherCustomerId,
      customerName: "Khách B",
      invoiceNumber: "INV-B",
      amount: { amount: "5000000", currency: "VND" },
      issuedAt: new Date("2026-08-05T00:00:00Z"),
      dueAt: new Date("2026-09-05T00:00:00Z"),
    });
    const paidId = "c2c2c2c2c2c2c2c2c2c2c2c2";
    fx.customers.seed({ id: paidId, name: "Khách C" });
    const orderC = fx.orders.seed({
      orderCode: "RD-C",
      customerId: paidId,
      customerName: "Khách C",
      stage: "settled",
    });
    const invoiceC = fx.invoices.seed({
      orderId: orderC.id,
      orderCode: orderC.orderCode,
      customerId: paidId,
      customerName: "Khách C",
      invoiceNumber: "INV-C",
      amount: { amount: "3000000", currency: "VND" },
      issuedAt: new Date("2026-08-05T00:00:00Z"),
      dueAt: new Date("2026-09-05T00:00:00Z"),
    });
    fx.receipt({
      amount: "3000000",
      day: "2026-08-06",
      customerId: paidId,
      counterparty: "Khách C",
      allocations: [
        {
          target: "invoice",
          invoiceId: invoiceC.id,
          invoiceNumber: invoiceC.invoiceNumber,
          orderId: orderC.id,
          orderCode: orderC.orderCode,
          amount: "3000000",
        },
      ],
    });

    const output = run(
      fx,
      [{ customerName: "Khách Fixture", outstanding: vnd("70000000") }],
      customerSheet,
    );

    expect(output.systemOnly).toHaveLength(1);
    expect(output.systemOnly[0]).toMatchObject({
      kind: "customer",
      label: "Khách B",
      day: null,
      amount: { amount: "5000000", currency: "VND" },
    });
    expect(output.systemOnly[0]?.issue.code).toBe("CUSTOMER_NOT_IN_SHEET");
    expect(output.systemOnly[0]?.issue.params).toEqual({
      customer: "Khách B",
      balance: "5000000 VND",
    });
    expect(output.sheetIssues.map((item) => item.code)).toEqual([
      "RECEIVABLES_TOTAL_MISMATCH",
    ]);
    expect(output.sheetIssues[0]?.params).toEqual({
      currency: "VND",
      sheet: "70000000 VND",
      system: "75000000 VND",
      onlySheet: "0 VND",
      onlySystem: "5000000 VND",
      differing: "0 VND",
    });
  });

  it("decomposes the total per currency exactly and never sums VND with USD", () => {
    const fx = fixture();
    fx.invoices.seed({
      orderId: fx.order.id,
      orderCode: fx.order.orderCode,
      customerId,
      customerName: "Khách Fixture",
      invoiceNumber: "INV-USD",
      amount: { amount: "1000.00", currency: "USD" },
      fxRateToVnd: "25000",
      issuedAt: new Date("2026-08-15T00:00:00Z"),
      dueAt: new Date("2026-09-15T00:00:00Z"),
    });
    fx.customers.seed({ id: otherCustomerId, name: "Khách B" });
    const orderB = fx.orders.seed({
      orderCode: "RD-B",
      customerId: otherCustomerId,
      customerName: "Khách B",
      stage: "invoiced",
    });
    fx.invoices.seed({
      orderId: orderB.id,
      orderCode: orderB.orderCode,
      customerId: otherCustomerId,
      customerName: "Khách B",
      invoiceNumber: "INV-B",
      amount: { amount: "5000000", currency: "VND" },
      issuedAt: new Date("2026-08-05T00:00:00Z"),
      dueAt: new Date("2026-09-05T00:00:00Z"),
    });

    const output = run(
      fx,
      [
        { customerName: "Khách Fixture", outstanding: vnd("60000000") },
        { customerName: "Khách Fixture", outstanding: usd("800.00") },
        { customerName: "Khách Unknown", outstanding: vnd("5000000") },
      ],
      customerSheet,
    );

    const totals = output.sheetIssues.filter(
      (item) => item.code === "RECEIVABLES_TOTAL_MISMATCH",
    );
    expect(totals.map((item) => item.params.currency).sort()).toEqual([
      "USD",
      "VND",
    ]);
    for (const item of totals) {
      const amount = (key: string) =>
        new Decimal(String(item.params[key]).split(" ")[0] ?? "");
      expect(amount("sheet").minus(amount("system")).toString()).toBe(
        amount("onlySheet")
          .minus(amount("onlySystem"))
          .plus(amount("differing"))
          .toString(),
      );
    }
    const vndTotal = totals.find((item) => item.params.currency === "VND");
    expect(vndTotal?.params).toEqual({
      currency: "VND",
      sheet: "65000000 VND",
      system: "75000000 VND",
      onlySheet: "5000000 VND",
      onlySystem: "5000000 VND",
      differing: "-10000000 VND",
    });
    const usdTotal = totals.find((item) => item.params.currency === "USD");
    expect(usdTotal?.params).toMatchObject({
      sheet: "800.00 USD",
      system: "1000.00 USD",
      differing: "-200.00 USD",
    });
    const naive = new Decimal("65000000").plus("800").toString();
    const naiveSystem = new Decimal("75000000").plus("1000").toString();
    const serialized = JSON.stringify(output.sheetIssues);
    expect(serialized).not.toContain(naive);
    expect(serialized).not.toContain(naiveSystem);
    expect(output.systemTotals.get("outstanding")?.get("VND")).toBe("75000000");
    expect(output.systemTotals.get("outstanding")?.get("USD")).toBe("1000.00");
  });

  it("does not count the invoices of a cancelled order, like computeReceivables", () => {
    const fx = fixture();
    fx.orders.orders.set(fx.order.id, { ...fx.order, stage: "cancelled" });
    const output = run(
      fx,
      [
        { customerName: "Khách Fixture", outstanding: vnd("70000000") },
        { invoiceNumber: "INV-120", outstanding: vnd("70000000") },
      ],
      ["customerName", "invoiceNumber", "outstanding"],
    );

    expect(find(output, 0, "BALANCE_MISMATCH")?.params).toMatchObject({
      outstanding: "0 VND",
      credit: "50000000 VND",
      balance: "-50000000 VND",
    });
    expect(codes(output, 1)).toEqual([
      "INVOICE_MATCHED",
      "ORDER_CANCELLED",
      "INVOICE_REMAINING_MISMATCH",
    ]);
    expect(
      find(output, 1, "INVOICE_REMAINING_MISMATCH")?.params.remaining,
    ).toBe("0 VND");
  });
});

describe("reconcileReceivables — invoice and order rows", () => {
  const invoiceSheet: CanonicalField[] = [
    "invoiceNumber",
    "orderCode",
    "customerName",
    "invoiced",
    "received",
    "outstanding",
    "dueDate",
  ];

  function depositFixture(): Fixture {
    const fx = fixture();
    // Replace the 20M invoice payment with a 20M deposit on the order.
    const [, second] = [...fx.entries.entries.values()];
    if (second) {
      fx.entries.entries.set(second.id, {
        ...second,
        allocations: [
          {
            target: "order",
            orderId: fx.order.id,
            orderCode: fx.order.orderCode,
            amount: "20000000",
          },
        ],
      });
    }
    return fx;
  }

  it("compares remaining and paid with amount, allocations and the deposit applied", () => {
    const fx = depositFixture();
    const output = run(
      fx,
      [
        {
          invoiceNumber: "INV-120",
          outstanding: vnd("70000000"),
          received: vnd("50000000"),
        },
        {
          invoiceNumber: "INV-120",
          outstanding: vnd("60000000"),
          received: vnd("30000000"),
        },
      ],
      invoiceSheet,
    );

    expect(codes(output, 0)).toEqual(["INVOICE_MATCHED"]);
    expect(codes(output, 1)).toEqual([
      "INVOICE_MATCHED",
      "INVOICE_REMAINING_MISMATCH",
      "INVOICE_PAID_MISMATCH",
    ]);
    expect(find(output, 1, "INVOICE_REMAINING_MISMATCH")?.params).toEqual({
      amount: "120000000 VND",
      paid: "30000000 VND",
      deposit: "20000000 VND",
      remaining: "70000000 VND",
      sheet: "60000000 VND",
    });
    expect(find(output, 1, "INVOICE_PAID_MISMATCH")?.params).toEqual({
      number: "INV-120",
      system: "50000000 VND",
      paid: "30000000 VND",
      deposit: "20000000 VND",
      sheet: "30000000 VND",
    });
    const view = output.rowSystem.get(0)?.invoice;
    expect(view).toMatchObject({
      invoiceNumber: "INV-120",
      paid: { amount: "30000000", currency: "VND" },
      depositApplied: { amount: "20000000", currency: "VND" },
      remaining: { amount: "70000000", currency: "VND" },
      issuedDay: "2026-08-01",
      dueDay: "2026-08-31",
      status: "active",
    });
  });

  it("checks the invoice amount, the order, the customer and the due date", () => {
    const fx = fixture();
    const output = run(
      fx,
      [
        {
          invoiceNumber: "INV-120",
          orderCode: "RD-OTHER",
          customerName: "Khách Khác",
          invoiced: vnd("110000000"),
          dueDate: "2026-09-15",
          outstanding: vnd("70000000"),
        },
      ],
      invoiceSheet,
    );

    expect(codes(output, 0)).toEqual([
      "INVOICE_MATCHED",
      "INVOICE_ORDER_MISMATCH",
      "INVOICE_CUSTOMER_MISMATCH",
      "INVOICE_AMOUNT_MISMATCH",
      "INVOICE_DUE_MISMATCH",
    ]);
    expect(find(output, 0, "INVOICE_ORDER_MISMATCH")?.params).toEqual({
      number: "INV-120",
      system: "RD-FIXTURE",
      sheet: "RD-OTHER",
    });
    expect(find(output, 0, "INVOICE_CUSTOMER_MISMATCH")?.params).toEqual({
      number: "INV-120",
      system: "Khách Fixture",
      sheet: "Khách Khác",
    });
    expect(find(output, 0, "INVOICE_AMOUNT_MISMATCH")?.params).toEqual({
      number: "INV-120",
      system: "120000000 VND",
      sheet: "110000000 VND",
      diff: "-10000000 VND",
    });
    expect(find(output, 0, "INVOICE_DUE_MISMATCH")?.params).toEqual({
      number: "INV-120",
      system: "2026-08-31",
      sheet: "2026-09-15",
    });
  });

  it("treats a voided invoice on the statement as an error and matches a reissue loosely", async () => {
    const fx = fixture();
    await fx.invoices.void({
      invoiceId: fx.invoice.id,
      expectedRevision: 0,
      reason: "Giảm trừ",
      updatedBy: "u",
    });
    fx.invoices.seed({
      orderId: fx.order.id,
      orderCode: fx.order.orderCode,
      customerId,
      customerName: "Khách Fixture",
      invoiceNumber: "INV-115",
      amount: { amount: "115000000", currency: "VND" },
      issuedAt: new Date("2026-08-01T00:00:00Z"),
      dueAt: new Date("2026-08-31T00:00:00Z"),
    });
    const output = run(
      fx,
      [
        { invoiceNumber: "INV-120", outstanding: vnd("70000000") },
        { invoiceNumber: "INV 115", outstanding: vnd("115000000") },
        { invoiceNumber: "INV-999", outstanding: vnd("1000000") },
      ],
      invoiceSheet,
    );

    const voided = find(output, 0, "INVOICE_VOIDED");
    expect(voided?.severity).toBe("error");
    expect(voided?.params).toEqual({ number: "INV-120", reason: "Giảm trừ" });
    expect(codes(output, 0)).toEqual(["INVOICE_VOIDED"]);
    expect(output.rowSystem.get(0)?.invoice?.status).toBe("voided");
    expect(codes(output, 1)).toEqual([
      "INVOICE_MATCH_LOOSE",
      "INVOICE_MATCHED",
    ]);
    expect(find(output, 1, "INVOICE_MATCH_LOOSE")?.params).toEqual({
      sheet: "INV 115",
      system: "INV-115",
    });
    expect(codes(output, 2)).toEqual(["INVOICE_NOT_FOUND"]);
    expect(output.rowSystem.get(2)).toEqual({ invoice: null });
  });

  it("reports a USD invoice against a VND row without converting", () => {
    const fx = fixture();
    fx.invoices.seed({
      orderId: fx.order.id,
      orderCode: fx.order.orderCode,
      customerId,
      customerName: "Khách Fixture",
      invoiceNumber: "INV-USD",
      amount: { amount: "1000.00", currency: "USD" },
      fxRateToVnd: "25000",
      issuedAt: new Date("2026-08-15T00:00:00Z"),
      dueAt: new Date("2026-09-15T00:00:00Z"),
    });
    const output = run(
      fx,
      [{ invoiceNumber: "INV-USD", outstanding: vnd("25000000") }],
      invoiceSheet,
    );

    expect(codes(output, 0)).toEqual([
      "INVOICE_MATCHED",
      "INVOICE_CURRENCY_MISMATCH",
    ]);
    expect(find(output, 0, "INVOICE_CURRENCY_MISMATCH")?.params).toEqual({
      number: "INV-USD",
      system: "USD",
      sheet: "VND",
    });
  });

  it("lists open invoices absent from an invoice-keyed sheet", () => {
    const fx = fixture();
    fx.invoices.seed({
      orderId: fx.order.id,
      orderCode: fx.order.orderCode,
      customerId,
      customerName: "Khách Fixture",
      invoiceNumber: "INV-15",
      amount: { amount: "15000000", currency: "VND" },
      issuedAt: new Date("2026-08-20T00:00:00Z"),
      dueAt: new Date("2026-09-20T00:00:00Z"),
    });
    const output = run(
      fx,
      [{ invoiceNumber: "INV-120", outstanding: vnd("70000000") }],
      invoiceSheet,
    );

    expect(output.systemOnly).toHaveLength(1);
    expect(output.systemOnly[0]).toMatchObject({
      kind: "invoice",
      label: "INV-15",
      day: "2026-08-20",
      amount: { amount: "15000000", currency: "VND" },
    });
    expect(output.systemOnly[0]?.issue.params).toEqual({
      number: "INV-15",
      remaining: "15000000 VND",
    });
    expect(output.sheetIssues[0]?.params).toMatchObject({
      sheet: "70000000 VND",
      system: "85000000 VND",
      onlySystem: "15000000 VND",
    });
  });

  it("compares order rows with the order's remaining", () => {
    const fx = fixture();
    const output = run(
      fx,
      [
        { orderCode: "RD-FIXTURE", outstanding: vnd("60000000") },
        { orderCode: "RD-FIXTURE", outstanding: vnd("70000000") },
        { orderCode: "RD-NOPE", outstanding: vnd("1000000") },
      ],
      ["orderCode", "outstanding"],
    );

    expect(codes(output, 0)).toEqual([
      "ORDER_MATCHED",
      "ORDER_REMAINING_MISMATCH",
    ]);
    expect(find(output, 0, "ORDER_REMAINING_MISMATCH")?.params).toEqual({
      code: "RD-FIXTURE",
      system: "70000000 VND",
      sheet: "60000000 VND",
    });
    expect(codes(output, 1)).toEqual(["ORDER_MATCHED"]);
    expect(output.rowSystem.get(1)?.order).toMatchObject({
      orderCode: "RD-FIXTURE",
      sellingPrice: null,
    });
    expect(codes(output, 2)).toEqual(["ORDER_NOT_FOUND"]);
    expect(output.rowSystem.get(2)).toEqual({ order: null });
    // Second row on the same order counts as sheet-only in the decomposition.
    expect(output.sheetIssues[0]?.params).toMatchObject({
      sheet: "131000000 VND",
      system: "70000000 VND",
      onlySheet: "71000000 VND",
      differing: "-10000000 VND",
    });
  });
});
