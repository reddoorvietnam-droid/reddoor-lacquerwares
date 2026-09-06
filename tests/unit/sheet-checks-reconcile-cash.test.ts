import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";

import type { CustomerRecordDto } from "@/domains/customers/contracts";
import type { FinanceEntryRecordDto } from "@/domains/finance/contracts";
import type { OrderRecordDto } from "@/domains/orders/contracts";
import type {
  CanonicalField,
  ColumnMapping,
  ParsedRow,
  SheetCell,
  SheetMapping,
  SheetRow,
  SystemSnapshot,
} from "@/domains/sheet-checks/contracts";
import { emptyParsedRow } from "@/domains/sheet-checks/contracts";
import type { Issue, IssueCode } from "@/domains/sheet-checks/issues";
import type {
  ParsedRowEntry,
  ParsedRows,
} from "@/domains/sheet-checks/parsing/rows";
import {
  methodFromText,
  reconcileIncomingCash,
} from "@/domains/sheet-checks/reconcile/cash";
import { buildOrderIndex } from "@/domains/sheet-checks/reconcile/orders";
import { money, type Money } from "@/lib/money";

import {
  FakeCustomerStore,
  FakeFinanceEntryStore,
  FakeOrderStore,
} from "./helpers/finance-fakes";

/**
 * The incoming-cash engine against hand-built parsed rows and in-memory
 * receipts. Rows are constructed directly (no parser involved) so every
 * case isolates the matching rules: strength order, one receipt per row,
 * fee tolerance, split/merged transfers, the not-found candidates, the
 * system-only list and the period decomposition.
 */

const now = new Date("2026-09-06T02:00:00Z");
const timeZone = "Asia/Ho_Chi_Minh";
const period = { from: "2026-08-01", to: "2026-08-31" };
const customerA = "c0c0c0c0c0c0c0c0c0c0c0c0";
const customerB = "c1c1c1c1c1c1c1c1c1c1c1c1";

function vnd(amount: string): Money {
  return money(amount, "VND");
}

function blankCell(): SheetCell {
  return {
    text: "",
    type: "z",
    number: null,
    numberFormat: null,
    formula: false,
    noCache: false,
    mergedFill: false,
    truncated: false,
  };
}

function column(
  columnIndex: number,
  field: CanonicalField,
  overrides: Partial<ColumnMapping> = {},
): ColumnMapping {
  return {
    columnIndex,
    field,
    fixedCurrency: null,
    unitMultiplier: "1",
    numberStyle: null,
    dateOrder: null,
    ...overrides,
  };
}

const defaultColumns: ColumnMapping[] = [
  column(0, "date"),
  column(1, "customerName"),
  column(2, "amount"),
  column(3, "orderCode"),
  column(4, "bankRef"),
  column(5, "method"),
  column(6, "note"),
];

function mappingOf(
  overrides: Partial<SheetMapping> = {},
  columns: ColumnMapping[] = defaultColumns,
): SheetMapping {
  return {
    columns,
    defaultCurrency: "VND",
    period,
    compareSellingPrice: false,
    ...overrides,
  };
}

function rowOf(index: number, kind: SheetRow["kind"] = "data"): SheetRow {
  return {
    index,
    sheetRowNumber: index + 2,
    kind,
    hidden: false,
    cells: Array.from({ length: 7 }, blankCell),
  };
}

function entryOf(
  rowIndex: number,
  parsed: Partial<ParsedRow>,
  options: { skipped?: boolean; issues?: Issue[] } = {},
): ParsedRowEntry {
  return {
    rowIndex,
    parsed: { ...emptyParsedRow(), ...parsed },
    issues: options.issues ?? [],
    skipped: options.skipped ?? false,
  };
}

function parsedOf(entries: ParsedRowEntry[]): ParsedRows {
  return { rows: entries, columnIssues: [], columnStyles: {}, dateOrders: {} };
}

/** A cash row: date, customer name and VND amount, plus whatever the case needs. */
function cashRow(
  rowIndex: number,
  date: string,
  amount: string,
  extra: Partial<ParsedRow> = {},
): ParsedRowEntry {
  return entryOf(rowIndex, {
    date,
    customerName: "Khách A",
    amount: vnd(amount),
    ...extra,
  });
}

function snapshotOf(overrides: Partial<SystemSnapshot> = {}): SystemSnapshot {
  return {
    orders: [],
    invoices: null,
    receipts: [],
    refunds: [],
    customers: null,
    sellingPriceVisible: false,
    ...overrides,
  };
}

/** 10:00 in Hanoi on the given day, so the business day is unambiguous. */
function at(day: string): Date {
  return new Date(`${day}T03:00:00.000Z`);
}

class Scenario {
  readonly entries = new FakeFinanceEntryStore();
  readonly orders = new FakeOrderStore();
  readonly customers = new FakeCustomerStore();

  receipt(
    day: string,
    amount: string,
    overrides: Partial<FinanceEntryRecordDto> = {},
  ): FinanceEntryRecordDto {
    return this.entries.seed({
      kind: "receipt",
      category: "orderPayment",
      customerId: customerA,
      counterparty: "Khách A",
      amount: { amount, currency: "VND" },
      method: "bankTransfer",
      occurredAt: at(day),
      allocations: [
        {
          target: "order",
          orderId: "0order0order0order0order",
          orderCode: "RD-AAAA",
          amount,
        },
      ],
      ...overrides,
    });
  }

  order(overrides: Partial<OrderRecordDto> = {}): OrderRecordDto {
    return this.orders.seed({
      orderCode: "RD-AAAA",
      customerId: customerA,
      customerName: "Khách A",
      ...overrides,
    });
  }

  customer(overrides: Partial<CustomerRecordDto> = {}): CustomerRecordDto {
    return this.customers.seed({
      id: customerA,
      name: "Khách A",
      ...overrides,
    });
  }

  run(
    entries: ParsedRowEntry[],
    options: {
      mapping?: SheetMapping;
      directory?: boolean;
      invoices?: SystemSnapshot["invoices"];
    } = {},
  ) {
    const orders = [...this.orders.orders.values()];
    const rows = entries.map((entry) => rowOf(entry.rowIndex));
    return reconcileIncomingCash({
      template: "incomingCash",
      mapping: options.mapping ?? mappingOf(),
      rows,
      parsed: parsedOf(entries),
      headerTexts: [],
      system: snapshotOf({
        orders,
        receipts: [...this.entries.entries.values()],
        customers: options.directory
          ? [...this.customers.customers.values()]
          : null,
        invoices: options.invoices ?? null,
      }),
      now,
      timeZone,
      orderIndex: buildOrderIndex(orders),
    });
  }
}

function codes(issues: readonly Issue[] | undefined): IssueCode[] {
  return (issues ?? []).map((entry) => entry.code);
}

function find(
  issues: readonly Issue[] | undefined,
  code: IssueCode,
): Issue | undefined {
  return (issues ?? []).find((entry) => entry.code === code);
}

function errorCount(issues: readonly Issue[] | undefined): number {
  return (issues ?? []).filter((entry) => entry.severity === "error").length;
}

describe("incoming cash: exact and near matches", () => {
  it("matches an exact amount on the same day with no error", () => {
    const scenario = new Scenario();
    scenario.receipt("2026-08-15", "25000000");
    const result = scenario.run([cashRow(0, "2026-08-15", "25000000")]);

    const issues = result.rowIssues.get(0);
    expect(find(issues, "RECEIPT_MATCHED")?.params).toEqual({
      d: "2026-08-15",
      amount: "25000000 VND",
    });
    expect(errorCount(issues)).toBe(0);
    const system = result.rowSystem.get(0);
    expect(system?.matchStrength).toBe("S2_CUSTOMER_AMOUNT_DATE");
    expect(system?.receipts).toHaveLength(1);
    expect(system?.receipts?.[0]?.amount).toEqual(vnd("25000000"));
    expect(system?.candidates).toEqual([]);
    expect(result.systemOnly).toEqual([]);
    expect(result.sheetIssues).toEqual([]);
    expect(result.periodTotals.get("VND")).toEqual({
      sheet: "25000000",
      system: "25000000",
    });
  });

  it("never pairs a row whose named customer could not be resolved with someone else's receipt", () => {
    const scenario = new Scenario();
    scenario.customers.seed({ name: "Khách A", code: "KH-A" });
    // The receipt belongs to Khách A; the sheet names a customer the
    // directory does not know, so the amounts must not be paired.
    scenario.receipt("2026-08-15", "25000000");
    const result = scenario.run(
      [
        cashRow(0, "2026-08-15", "25000000", {
          customerName: "Công ty Không Có Trong Danh Bạ",
        }),
      ],
      { directory: true },
    );

    const issues = result.rowIssues.get(0);
    expect(codes(issues)).toContain("CUSTOMER_NOT_FOUND");
    expect(codes(issues)).not.toContain("RECEIPT_MATCHED");
    expect(codes(issues)).not.toContain("CUSTOMER_INFERRED");
    expect(find(issues, "RECEIPT_NOT_FOUND")).toBeDefined();
    expect(result.rowSystem.get(0)?.receipts ?? []).toEqual([]);
  });

  it("keeps the bank-fee tolerance from swallowing amounts smaller than its own floor", () => {
    const scenario = new Scenario();
    // 40.000 ₫ and 25.000 ₫ are 15.000 ₫ apart — inside the 30.000 ₫ floor,
    // but nothing about them looks like a fee on a transfer.
    scenario.receipt("2026-08-15", "40000");
    const tiny = scenario.run([cashRow(0, "2026-08-15", "25000")]);
    expect(codes(tiny.rowIssues.get(0))).not.toContain(
      "RECEIPT_SHORT_BANK_FEE_LIKELY",
    );
    // The row is still reported: either no receipt at all, or the nearby
    // one with the difference named — never a silent match.
    expect(codes(tiny.rowIssues.get(0))).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^RECEIPT_(NOT_FOUND|AMOUNT_MISMATCH)$/),
      ]),
    );

    // A real transfer short by a fee still matches.
    const real = new Scenario();
    real.receipt("2026-08-15", "24975000");
    const fee = real.run([cashRow(0, "2026-08-15", "25000000")]);
    expect(codes(fee.rowIssues.get(0))).toContain(
      "RECEIPT_SHORT_BANK_FEE_LIKELY",
    );
  });

  it("reports a two-day gap as RECEIPT_DATE_MISMATCH", () => {
    const scenario = new Scenario();
    scenario.receipt("2026-08-17", "25000000");
    const result = scenario.run([cashRow(0, "2026-08-15", "25000000")]);

    expect(
      find(result.rowIssues.get(0), "RECEIPT_DATE_MISMATCH")?.params,
    ).toEqual({ n: 2, d: "2026-08-17" });
    expect(errorCount(result.rowIssues.get(0))).toBe(0);
  });

  it("still matches at seven days and stops at eight with a DATE_DIFF candidate", () => {
    const seven = new Scenario();
    seven.receipt("2026-08-22", "25000000");
    const atSeven = seven.run([cashRow(0, "2026-08-15", "25000000")]);
    expect(
      find(atSeven.rowIssues.get(0), "RECEIPT_DATE_MISMATCH")?.params,
    ).toEqual({ n: 7, d: "2026-08-22" });

    const eight = new Scenario();
    const receipt = eight.receipt("2026-08-23", "25000000");
    const atEight = eight.run([cashRow(0, "2026-08-15", "25000000")]);
    const issues = atEight.rowIssues.get(0);
    expect(find(issues, "RECEIPT_NOT_FOUND")?.params).toEqual({
      customer: "Khách A",
      d: "2026-08-15",
      amount: "25000000 VND",
    });
    expect(atEight.rowSystem.get(0)?.candidates).toEqual([
      {
        id: receipt.id,
        occurredDay: "2026-08-23",
        amount: vnd("25000000"),
        why: "DATE_DIFF",
        usedByRowIndex: null,
      },
    ]);
    expect(atEight.rowSystem.get(0)?.receipts).toEqual([]);
    expect(atEight.rowSystem.get(0)?.matchStrength).toBeNull();
  });

  it("treats a bank-fee-sized shortfall on either side as a likely fee", () => {
    const lower = new Scenario();
    lower.receipt("2026-08-15", "25000000");
    const sheetLower = lower.run([cashRow(0, "2026-08-15", "24975000")]);
    expect(
      find(sheetLower.rowIssues.get(0), "RECEIPT_SHORT_BANK_FEE_LIKELY")
        ?.params,
    ).toEqual({ side: "Bảng", diff: "25000 VND" });
    expect(sheetLower.rowSystem.get(0)?.matchStrength).toBe("S5_FEE_TOLERANCE");
    expect(sheetLower.systemOnly).toEqual([]);

    const higher = new Scenario();
    higher.receipt("2026-08-15", "25000000");
    const sheetHigher = higher.run([cashRow(0, "2026-08-15", "25025000")]);
    expect(
      find(sheetHigher.rowIssues.get(0), "RECEIPT_SHORT_BANK_FEE_LIKELY")
        ?.params,
    ).toEqual({ side: "Hệ thống", diff: "25000 VND" });
  });

  it("reports a larger difference as RECEIPT_AMOUNT_MISMATCH without consuming the receipt", () => {
    const scenario = new Scenario();
    const receipt = scenario.receipt("2026-08-15", "25000000");
    const result = scenario.run([cashRow(0, "2026-08-15", "24000000")]);

    const issues = result.rowIssues.get(0);
    expect(find(issues, "RECEIPT_AMOUNT_MISMATCH")?.params).toEqual({
      system: "25000000 VND",
      sheet: "24000000 VND",
      diff: "-1000000 VND",
    });
    expect(codes(issues)).not.toContain("RECEIPT_NOT_FOUND");
    expect(result.rowSystem.get(0)?.receipts).toEqual([]);
    expect(result.rowSystem.get(0)?.candidates?.[0]).toMatchObject({
      id: receipt.id,
      why: "AMOUNT_DIFF",
    });
    // The receipt stays unpaired, so it is also reported as absent from the sheet.
    expect(result.systemOnly.map((item) => item.issue.code)).toEqual([
      "RECEIPT_NOT_IN_SHEET",
    ]);
  });

  it("applies the fee floor and the fee cap", () => {
    const floor = new Scenario();
    floor.receipt("2026-08-15", "1000000");
    const withinFloor = floor.run([cashRow(0, "2026-08-15", "999000")]);
    expect(codes(withinFloor.rowIssues.get(0))).toContain(
      "RECEIPT_SHORT_BANK_FEE_LIKELY",
    );

    const cap = new Scenario();
    cap.receipt("2026-08-15", "99000000");
    const beyondCap = cap.run([cashRow(0, "2026-08-15", "100000000")]);
    expect(
      find(beyondCap.rowIssues.get(0), "RECEIPT_AMOUNT_MISMATCH")?.params,
    ).toEqual({
      system: "99000000 VND",
      sheet: "100000000 VND",
      diff: "1000000 VND",
    });
  });

  it("never converts: a USD row against a VND receipt is a currency mismatch", () => {
    const scenario = new Scenario();
    scenario.receipt("2026-08-15", "1000");
    const result = scenario.run([
      cashRow(0, "2026-08-15", "0", { amount: money("1000.00", "USD") }),
    ]);

    const issues = result.rowIssues.get(0);
    expect(find(issues, "CURRENCY_MISMATCH")?.params).toEqual({
      sheet: "USD",
      system: "VND",
    });
    expect(codes(issues)).not.toContain("RECEIPT_AMOUNT_MISMATCH");
    expect(codes(issues)).not.toContain("RECEIPT_NOT_FOUND");
    expect(result.rowSystem.get(0)?.candidates?.[0]?.why).toBe("CURRENCY_DIFF");
    expect(result.rowSystem.get(0)?.receipts).toEqual([]);
  });
});

describe("incoming cash: split and merged transfers", () => {
  it("pairs several rows of one customer with one combined receipt", () => {
    const scenario = new Scenario();
    const receipt = scenario.receipt("2026-08-15", "25000000");
    const result = scenario.run([
      cashRow(0, "2026-08-15", "10000000"),
      cashRow(1, "2026-08-15", "15000000"),
    ]);

    for (const rowIndex of [0, 1]) {
      expect(
        find(result.rowIssues.get(rowIndex), "RECEIPT_SPLIT_MATCH")?.params,
      ).toEqual({ rows: "2, 3", amount: "25000000 VND", d: "2026-08-15" });
      expect(result.rowSystem.get(rowIndex)?.matchStrength).toBe("S6_SPLIT");
      expect(result.rowSystem.get(rowIndex)?.receipts?.[0]?.id).toBe(
        receipt.id,
      );
    }
    expect(result.systemOnly).toEqual([]);
    expect(result.sheetIssues).toEqual([]);
    expect(result.periodTotals.get("VND")).toEqual({
      sheet: "25000000",
      system: "25000000",
    });
  });

  it("pairs one row with the sum of a few receipts, but not above the candidate cap", () => {
    const scenario = new Scenario();
    scenario.receipt("2026-08-14", "10000000");
    scenario.receipt("2026-08-17", "15000000");
    const result = scenario.run([cashRow(0, "2026-08-15", "25000000")]);

    expect(
      find(result.rowIssues.get(0), "RECEIPT_MERGED_MATCH")?.params,
    ).toEqual({
      n: 2,
      refs: "2026-08-14 10000000 VND; 2026-08-17 15000000 VND",
    });
    expect(result.rowSystem.get(0)?.matchStrength).toBe("S7_MERGED");
    expect(result.rowSystem.get(0)?.receipts).toHaveLength(2);
    expect(result.systemOnly).toEqual([]);

    // Seven receipts of the same customer inside the window (none next to
    // the sheet date) push the pool past mergedMaxCandidates: no search.
    const crowded = new Scenario();
    crowded.receipt("2026-08-13", "10000000");
    crowded.receipt("2026-08-18", "15000000");
    for (let index = 0; index < 5; index += 1) {
      crowded.receipt("2026-08-19", `${3000000 + index * 100000}`);
    }
    const capped = crowded.run([cashRow(0, "2026-08-15", "25000000")]);
    expect(codes(capped.rowIssues.get(0))).toContain("RECEIPT_NOT_FOUND");
    expect(codes(capped.rowIssues.get(0))).not.toContain(
      "RECEIPT_MERGED_MATCH",
    );
    expect(capped.rowSystem.get(0)?.candidates).toHaveLength(3);
  });
});

describe("incoming cash: duplicates on either side", () => {
  it("consumes a receipt once: the second identical row is not found with ALREADY_USED_BY_ROW", () => {
    const scenario = new Scenario();
    const receipt = scenario.receipt("2026-08-15", "25000000");
    const result = scenario.run([
      cashRow(0, "2026-08-15", "25000000"),
      cashRow(1, "2026-08-15", "25000000", { note: "lần 2" }),
    ]);

    expect(codes(result.rowIssues.get(0))).toContain("RECEIPT_MATCHED");
    expect(codes(result.rowIssues.get(1))).toContain("RECEIPT_NOT_FOUND");
    expect(result.rowSystem.get(1)?.candidates).toEqual([
      {
        id: receipt.id,
        occurredDay: "2026-08-15",
        amount: vnd("25000000"),
        why: "ALREADY_USED_BY_ROW",
        usedByRowIndex: 0,
      },
    ]);
    expect(result.systemOnly).toEqual([]);
    expect(find(result.sheetIssues, "PERIOD_TOTAL_MISMATCH")?.params).toEqual({
      sheet: "50000000 VND",
      system: "25000000 VND",
      diff: "25000000 VND",
      x: 1,
      a: "25000000 VND",
      y: 0,
      b: "0 VND",
      // Nothing was matched with a different amount, so the two remainders
      // account for the whole difference.
      residual: "0 VND",
    });
  });

  it("flags two identical system receipts and reports the spare one as absent", () => {
    const scenario = new Scenario();
    scenario.receipt("2026-08-15", "25000000");
    scenario.receipt("2026-08-15", "25000000");
    const result = scenario.run([cashRow(0, "2026-08-15", "25000000")]);

    const issues = result.rowIssues.get(0);
    expect(codes(issues)).toContain("RECEIPT_MATCHED");
    expect(find(issues, "RECEIPT_MATCH_TIE")?.params).toEqual({ n: 2 });
    expect(
      find(result.sheetIssues, "SYSTEM_DUPLICATE_SUSPECT")?.params,
    ).toEqual({
      d: "2026-08-15",
      refs: "2 × 25000000 VND (Khách A)",
    });
    expect(result.systemOnly).toHaveLength(1);
    expect(result.systemOnly[0]?.issue.params).toEqual({
      d: "2026-08-15",
      amount: "25000000 VND",
      customer: "Khách A",
    });
    expect(result.systemOnly[0]).toMatchObject({
      kind: "receipt",
      label: "Khách A",
      day: "2026-08-15",
      amount: vnd("25000000"),
    });
  });
});

describe("incoming cash: what a matched receipt says", () => {
  it("matches a voided receipt only when nothing else fits, as an error", () => {
    const scenario = new Scenario();
    scenario.receipt("2026-08-15", "25000000", {
      status: "voided",
      voidReason: "Nhập nhầm",
    });
    const result = scenario.run([cashRow(0, "2026-08-15", "25000000")]);

    const issues = result.rowIssues.get(0);
    expect(find(issues, "RECEIPT_VOIDED")?.params).toEqual({
      reason: "Nhập nhầm",
    });
    expect(codes(issues)).not.toContain("RECEIPT_UNALLOCATED");
    expect(result.rowSystem.get(0)?.receipts?.[0]?.status).toBe("voided");
    expect(result.systemOnly).toEqual([]);
  });

  it("prefers an active receipt over a voided twin", () => {
    const scenario = new Scenario();
    scenario.receipt("2026-08-15", "25000000", {
      status: "voided",
      voidReason: "Nhập nhầm",
    });
    const active = scenario.receipt("2026-08-15", "25000000");
    const result = scenario.run([cashRow(0, "2026-08-15", "25000000")]);

    expect(codes(result.rowIssues.get(0))).not.toContain("RECEIPT_VOIDED");
    expect(codes(result.rowIssues.get(0))).not.toContain("RECEIPT_MATCH_TIE");
    expect(result.rowSystem.get(0)?.receipts?.[0]?.id).toBe(active.id);
  });

  it("warns when the receipt is unallocated", () => {
    const scenario = new Scenario();
    scenario.receipt("2026-08-15", "25000000", { allocations: [] });
    const result = scenario.run([cashRow(0, "2026-08-15", "25000000")]);
    expect(codes(result.rowIssues.get(0))).toContain("RECEIPT_UNALLOCATED");
  });

  it("warns when the sheet names an order the receipt was not applied to", () => {
    const scenario = new Scenario();
    scenario.order({ orderCode: "RD-AAAA" });
    scenario.receipt("2026-08-15", "25000000", {
      allocations: [
        {
          target: "order",
          orderId: "0order0order0order0order",
          orderCode: "RD-BBBB",
          amount: "25000000",
        },
      ],
    });
    const result = scenario.run([
      cashRow(0, "2026-08-15", "25000000", { orderCode: "RD-AAAA" }),
    ]);

    const issues = result.rowIssues.get(0);
    expect(find(issues, "RECEIPT_ALLOCATION_DIFFERS")?.params).toEqual({
      sheetTarget: "RD-AAAA",
      systemTarget: "RD-BBBB",
    });
    expect(find(issues, "ORDER_MATCHED")?.params).toMatchObject({
      code: "RD-AAAA",
      customer: "Khách A",
    });
    expect(result.rowSystem.get(0)?.order).toMatchObject({
      orderCode: "RD-AAAA",
    });
  });

  it("notes a different payment method", () => {
    const scenario = new Scenario();
    scenario.receipt("2026-08-15", "25000000", { method: "cash" });
    const result = scenario.run([
      cashRow(0, "2026-08-15", "25000000", { method: "CK" }),
    ]);
    expect(
      find(result.rowIssues.get(0), "RECEIPT_METHOD_DIFFERS")?.params,
    ).toEqual({ sheet: "CK", system: "tiền mặt" });
  });

  it("reads the usual method spellings", () => {
    expect(methodFromText("CK")).toBe("bankTransfer");
    expect(methodFromText("Chuyển khoản")).toBe("bankTransfer");
    expect(methodFromText("TM")).toBe("cash");
    expect(methodFromText("Tiền mặt")).toBe("cash");
    expect(methodFromText("cash")).toBe("cash");
    expect(methodFromText("Khác")).toBe("other");
    expect(methodFromText("???")).toBeNull();
  });
});

describe("incoming cash: identity", () => {
  it("matches on a bank reference found in the receipt note regardless of the date", () => {
    const scenario = new Scenario();
    scenario.receipt("2026-08-25", "25000000", {
      note: "UNC FT26227ABC123 tiền hàng",
    });
    const result = scenario.run([
      cashRow(0, "2026-08-15", "25000000", { bankRef: "ft26227abc123" }),
    ]);

    const issues = result.rowIssues.get(0);
    expect(codes(issues)).toContain("RECEIPT_MATCHED");
    expect(codes(issues)).not.toContain("RECEIPT_DATE_MISMATCH");
    expect(result.rowSystem.get(0)?.matchStrength).toBe("S1_BANK_REF");
  });

  it("matches on the allocation target when the customer cannot be told", () => {
    const scenario = new Scenario();
    scenario.receipt("2026-08-15", "25000000", {
      customerId: customerB,
      counterparty: "Khách B",
    });
    const result = scenario.run([
      entryOf(0, {
        date: "2026-08-15",
        amount: vnd("25000000"),
        orderCode: "RD-AAAA",
      }),
    ]);

    const issues = result.rowIssues.get(0);
    expect(codes(issues)).toContain("ORDER_NOT_FOUND");
    expect(codes(issues)).toContain("RECEIPT_MATCHED");
    expect(result.rowSystem.get(0)?.matchStrength).toBe("S3_ALLOCATION_TARGET");
  });

  it("infers the customer from amount and date when the row names nobody", () => {
    const scenario = new Scenario();
    scenario.receipt("2026-08-15", "25000000");
    const result = scenario.run(
      [entryOf(0, { date: "2026-08-15", amount: vnd("25000000") })],
      { mapping: mappingOf({}, [column(0, "date"), column(2, "amount")]) },
    );

    const issues = result.rowIssues.get(0);
    expect(find(issues, "CUSTOMER_INFERRED")?.params).toEqual({
      customer: "Khách A",
    });
    expect(codes(issues)).toContain("RECEIPT_MATCHED");
    expect(result.rowSystem.get(0)?.matchStrength).toBe("S4_AMOUNT_DATE");
    expect(result.rowSystem.get(0)).not.toHaveProperty("order");
    expect(result.rowSystem.get(0)).not.toHaveProperty("customer");
  });

  it("uses the order's customer when the directory is not readable, and flags a different sheet name", () => {
    const scenario = new Scenario();
    scenario.order({ orderCode: "RD-AAAA" });
    scenario.receipt("2026-08-15", "25000000");
    const result = scenario.run([
      entryOf(0, {
        date: "2026-08-15",
        amount: vnd("25000000"),
        orderCode: "RD-AAAA",
      }),
      entryOf(1, {
        date: "2026-08-16",
        amount: vnd("5000000"),
        orderCode: "RD-AAAA",
        customerName: "Khách Z",
      }),
    ]);

    expect(find(result.rowIssues.get(0), "CUSTOMER_INFERRED")?.params).toEqual({
      customer: "Khách A",
    });
    expect(codes(result.rowIssues.get(0))).toContain("RECEIPT_MATCHED");
    expect(
      find(result.rowIssues.get(1), "ORDER_CUSTOMER_MISMATCH")?.params,
    ).toEqual({ sheet: "Khách Z", system: "Khách A" });
    expect(result.rowSystem.get(1)?.customer).toMatchObject({
      id: customerA,
      name: "Khách A",
      code: null,
    });
  });

  it("resolves the name through the directory and matches the receipt by id", () => {
    const scenario = new Scenario();
    scenario.customer({ code: "KH0007" });
    scenario.receipt("2026-08-15", "25000000", { counterparty: "KHACH A LTD" });
    const result = scenario.run(
      [cashRow(0, "2026-08-15", "25000000", { customerName: "Cty Khách A" })],
      { directory: true },
    );

    const issues = result.rowIssues.get(0);
    expect(codes(issues)).toContain("CUSTOMER_MATCH_NORMALIZED");
    expect(codes(issues)).toContain("RECEIPT_MATCHED");
    expect(result.rowSystem.get(0)?.customer).toEqual({
      id: customerA,
      name: "Khách A",
      code: "KH0007",
    });
  });

  it("matches a legacy name-only receipt through the name key", () => {
    const scenario = new Scenario();
    scenario.receipt("2026-08-15", "25000000", {
      customerId: null,
      counterparty: "Công ty TNHH Khách A",
    });
    const result = scenario.run([cashRow(0, "2026-08-15", "25000000")]);
    expect(codes(result.rowIssues.get(0))).toContain("RECEIPT_MATCHED");
  });

  it("does not pair a named customer's row with another customer's receipt", () => {
    const scenario = new Scenario();
    const other = scenario.receipt("2026-08-15", "25000000", {
      customerId: customerB,
      counterparty: "Khách B",
    });
    const result = scenario.run([cashRow(0, "2026-08-15", "25000000")]);

    expect(codes(result.rowIssues.get(0))).toContain("RECEIPT_NOT_FOUND");
    expect(result.rowSystem.get(0)?.candidates?.[0]).toMatchObject({
      id: other.id,
      why: "DATE_DIFF",
    });
  });
});

describe("incoming cash: the system side and the period", () => {
  it("lists unpaired receipts inside the period and ignores those far outside", () => {
    const scenario = new Scenario();
    scenario.receipt("2026-08-20", "7000000");
    scenario.receipt("2026-09-20", "9000000");
    const result = scenario.run([]);

    expect(result.systemOnly).toHaveLength(1);
    expect(result.systemOnly[0]?.issue.params).toEqual({
      d: "2026-08-20",
      amount: "7000000 VND",
      customer: "Khách A",
    });
  });

  it("without a period, looks a week around the sheet's own dates", () => {
    const scenario = new Scenario();
    scenario.receipt("2026-08-20", "7000000");
    scenario.receipt("2026-09-05", "9000000");
    const result = scenario.run([cashRow(0, "2026-08-15", "1000000")], {
      mapping: mappingOf({ period: null }),
    });

    expect(result.systemOnly.map((item) => item.day)).toEqual(["2026-08-20"]);
  });

  it("decomposes the period difference into unmatched rows minus absent receipts, exactly", () => {
    const scenario = new Scenario();
    scenario.receipt("2026-08-10", "25000000");
    scenario.receipt("2026-08-20", "7000000");
    scenario.receipt("2026-08-21", "4000000");
    scenario.receipt("2026-09-20", "99000000");
    const result = scenario.run([
      cashRow(0, "2026-08-10", "25000000"),
      cashRow(1, "2026-08-12", "3000000"),
      cashRow(2, "2026-08-13", "2500000"),
    ]);

    const mismatch = find(result.sheetIssues, "PERIOD_TOTAL_MISMATCH");
    expect(mismatch?.params).toEqual({
      sheet: "30500000 VND",
      system: "36000000 VND",
      diff: "-5500000 VND",
      x: 2,
      a: "5500000 VND",
      y: 2,
      b: "11000000 VND",
      residual: "0 VND",
    });
    const diff = new Decimal("30500000").minus("36000000");
    expect(new Decimal("5500000").minus("11000000").equals(diff)).toBe(true);
    expect(result.periodTotals.get("VND")).toEqual({
      sheet: "30500000",
      system: "36000000",
    });
  });

  it("keeps currencies apart in the period totals", () => {
    const scenario = new Scenario();
    scenario.receipt("2026-08-15", "25000000");
    scenario.receipt("2026-08-16", "1000.00", {
      amount: { amount: "1000.00", currency: "USD" },
    });
    const result = scenario.run([
      cashRow(0, "2026-08-15", "25000000"),
      cashRow(1, "2026-08-16", "0", { amount: money("1000.00", "USD") }),
    ]);

    expect(result.periodTotals.get("VND")).toEqual({
      sheet: "25000000",
      system: "25000000",
    });
    expect(result.periodTotals.get("USD")).toEqual({
      sheet: "1000.00",
      system: "1000.00",
    });
    expect(result.sheetIssues).toEqual([]);
  });

  it("skips rows without an amount or a date and leaves them without a system view", () => {
    const scenario = new Scenario();
    scenario.receipt("2026-08-15", "25000000");
    const result = scenario.run([
      entryOf(0, { date: "2026-08-15", customerName: "Khách A" }),
      entryOf(1, { customerName: "Khách A", amount: vnd("25000000") }),
      entryOf(
        2,
        { date: "2026-08-15", amount: vnd("25000000") },
        { skipped: true },
      ),
    ]);

    expect(result.rowIssues.size).toBe(0);
    expect(result.rowSystem.size).toBe(0);
    expect(result.systemOnly).toHaveLength(1);
  });

  it("refuses to run without receipts", () => {
    const scenario = new Scenario();
    expect(() =>
      reconcileIncomingCash({
        template: "incomingCash",
        mapping: mappingOf(),
        rows: [],
        parsed: parsedOf([]),
        headerTexts: [],
        system: snapshotOf({ receipts: null }),
        now,
        timeZone,
        orderIndex: buildOrderIndex([...scenario.orders.orders.values()]),
      }),
    ).toThrowError(/payments\.read/);
  });
});
