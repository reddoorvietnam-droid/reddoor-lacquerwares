import { describe, expect, it } from "vitest";

import { customerKeyOf } from "@/domains/finance/receivables";
import type { OrderRecordDto } from "@/domains/orders/contracts";
import { orderStageDefinitions } from "@/domains/orders/workflow";
import { emptyParsedRow } from "@/domains/sheet-checks/contracts";
import { issue, type Issue } from "@/domains/sheet-checks/issues";
import {
  keysIntersect,
  receiptCustomerKeys,
  resolveCustomer,
  rowCustomerKeys,
} from "@/domains/sheet-checks/reconcile/customers";
import {
  buildOrderIndex,
  compareStage,
  orderIssues,
  resolveOrder,
} from "@/domains/sheet-checks/reconcile/orders";
import { RowAccumulator } from "@/domains/sheet-checks/reconcile/shared";

import {
  FakeCustomerStore,
  FakeOrderStore,
  unitId,
} from "./helpers/finance-fakes";

/**
 * Order and customer resolution, plus the row accumulator's outcomes. The
 * order index is built from an already-scoped list, so the test for
 * "absent" versus "out of scope" compares the two findings byte for byte.
 */

const otherUnit = "222222222222222222222222";

function scopedIndex(store: FakeOrderStore, units: readonly string[]) {
  return buildOrderIndex(
    [...store.orders.values()].filter((order) =>
      order.businessUnitIds.some((id) => units.includes(id)),
    ),
  );
}

describe("resolveOrder", () => {
  it("finds an exact code, case-insensitively", () => {
    const store = new FakeOrderStore();
    const order = store.seed({ orderCode: "RD-20260906-E2E1" });
    const index = buildOrderIndex([...store.orders.values()]);
    expect(resolveOrder("rd-20260906-e2e1", index)).toEqual({
      order,
      issues: [],
    });
  });

  it("yields byte-identical findings for an absent and an out-of-scope order", () => {
    const store = new FakeOrderStore();
    store.seed({ orderCode: "RD-20260906-E2E1", businessUnitIds: [otherUnit] });
    const index = scopedIndex(store, [unitId]);

    const outOfScope = resolveOrder("RD-20260906-E2E1", index);
    const absent = resolveOrder("RD-20260906-E2E9", index);
    expect(outOfScope.order).toBeNull();
    expect(absent.order).toBeNull();
    expect(outOfScope.issues).toEqual([
      issue("ORDER_NOT_FOUND", { code: "RD-20260906-E2E1" }),
    ]);
    expect(JSON.stringify(outOfScope.issues).replace("E2E1", "E2E9")).toBe(
      JSON.stringify(absent.issues),
    );
    expect(index.byCode.size).toBe(0);
  });

  it("never fuzzy-matches a code", () => {
    const store = new FakeOrderStore();
    store.seed({ orderCode: "RD-20260906-E2E1" });
    const index = buildOrderIndex([...store.orders.values()]);
    const result = resolveOrder("RD-20260906-E2E", index);
    expect(result.order).toBeNull();
    expect(result.issues.map((entry) => entry.code)).toEqual([
      "ORDER_NOT_FOUND",
    ]);
    expect(result.issues[0]?.params).toEqual({ code: "RD-20260906-E2E" });
  });

  it("matches a numeric cell's digits to the zero-padded code, once", () => {
    const unique = new FakeOrderStore();
    const padded = unique.seed({ orderCode: "000123" });
    const uniqueIndex = buildOrderIndex([...unique.orders.values()]);
    expect(resolveOrder("123", uniqueIndex)).toEqual({
      order: padded,
      issues: [issue("CODE_LEADING_ZERO_MATCH", { code: "000123" })],
    });

    const ambiguous = new FakeOrderStore();
    ambiguous.seed({ orderCode: "000123" });
    ambiguous.seed({ orderCode: "0123" });
    const ambiguousIndex = buildOrderIndex([...ambiguous.orders.values()]);
    const result = resolveOrder("123", ambiguousIndex);
    expect(result.order).toBeNull();
    expect(result.issues).toEqual([issue("CODE_AMBIGUOUS", { raw: "123" })]);
  });

  it("drops leading zeros inside a structured code but keeps the structure", () => {
    const store = new FakeOrderStore();
    const order = store.seed({ orderCode: "RD-000123" });
    const index = buildOrderIndex([...store.orders.values()]);
    expect(resolveOrder("RD-123", index).order).toBe(order);
    expect(resolveOrder("AB-123", index).order).toBeNull();
  });

  it("hints in-scope orders that carry a digits-only code, at most three", () => {
    const store = new FakeOrderStore();
    for (const suffix of ["A", "B", "C", "D"]) {
      store.seed({ orderCode: `RD-20260906-${suffix}` });
    }
    store.seed({ orderCode: "RD-20260906-X", businessUnitIds: [otherUnit] });
    const index = scopedIndex(store, [unitId]);

    const result = resolveOrder("20260906", index);
    expect(result.order).toBeNull();
    expect(result.issues[0]?.params).toEqual({
      code: "20260906",
      hints: "RD-20260906-A, RD-20260906-B, RD-20260906-C",
    });
    expect(resolveOrder("RD-2026", index).issues[0]?.params).toEqual({
      code: "RD-2026",
    });
  });
});

describe("orderIssues and compareStage", () => {
  const store = new FakeOrderStore();
  const active = store.seed({
    orderCode: "RD-1",
    stage: "inProduction",
    customerName: "Khách A",
  });

  it("describes a matched order with its Vietnamese stage label", () => {
    expect(orderIssues(active)).toEqual([
      issue("ORDER_MATCHED", {
        code: "RD-1",
        stage: orderStageDefinitions.inProduction.labels.vi,
        customer: "Khách A",
      }),
    ]);
  });

  it("adds the cancelled warning and the closed notice", () => {
    const cancelled = store.seed({ orderCode: "RD-2", stage: "cancelled" });
    const closed = store.seed({ orderCode: "RD-3", stage: "closed" });
    expect(orderIssues(cancelled).map((entry) => entry.code)).toEqual([
      "ORDER_MATCHED",
      "ORDER_CANCELLED",
    ]);
    expect(
      orderIssues(closed).map((entry) => [entry.code, entry.severity]),
    ).toEqual([
      ["ORDER_MATCHED", "info"],
      ["ORDER_CLOSED", "info"],
    ]);
  });

  it("compares the sheet's stage text with the order", () => {
    expect(compareStage("Đang sản xuất", active)).toBeNull();
    expect(compareStage("inProduction", active)).toBeNull();
    expect(compareStage("Đóng gói", active)).toEqual(
      issue("STAGE_MISMATCH", {
        sheet: "Đóng gói",
        system: orderStageDefinitions.inProduction.labels.vi,
      }),
    );
    expect(compareStage("???", active)).toEqual(
      issue("STAGE_UNRECOGNIZED", { raw: "???" }),
    );
  });
});

describe("resolveCustomer with the directory", () => {
  const store = new FakeCustomerStore();
  const abcImport = store.seed({
    id: "c0c0c0c0c0c0c0c0c0c0c0c0",
    name: "Công ty TNHH ABC Import",
    code: "KH0007",
  });
  store.seed({ id: "c1c1c1c1c1c1c1c1c1c1c1c1", name: "ABC Trading" });
  store.seed({ id: "c2c2c2c2c2c2c2c2c2c2c2c2", name: "ABC Export" });
  const nguyen = store.seed({
    id: "c3c3c3c3c3c3c3c3c3c3c3c3",
    name: "Nguyễn Văn A",
  });
  const directory = [...store.customers.values()];

  const resolve = (name: string | null, code: string | null = null) =>
    resolveCustomer({ name, code, directory, fallback: null });

  it("accepts a legal-form and diacritics variation with a notice", () => {
    expect(resolve("Cty TNHH ABC Import")).toEqual({
      customerId: abcImport.id,
      customerName: abcImport.name,
      customerKey: abcImport.id,
      issues: [
        issue("CUSTOMER_MATCH_NORMALIZED", {
          sheet: "Cty TNHH ABC Import",
          system: abcImport.name,
        }),
      ],
    });
    expect(resolve("Nguyen Van A")).toMatchObject({
      customerId: nguyen.id,
      issues: [
        issue("CUSTOMER_MATCH_NORMALIZED", {
          sheet: "Nguyen Van A",
          system: "Nguyễn Văn A",
        }),
      ],
    });
    expect(resolve("Công ty TNHH ABC Import").issues).toEqual([]);
  });

  it("accepts a unique containment as a warning and refuses an ambiguous one", () => {
    // "ABC Import" alone equals the directory name once the legal form is
    // stripped; an extra token makes it a containment, not an equality.
    expect(resolve("ABC Import")).toMatchObject({
      customerId: abcImport.id,
      issues: [
        issue("CUSTOMER_MATCH_NORMALIZED", {
          sheet: "ABC Import",
          system: abcImport.name,
        }),
      ],
    });
    expect(resolve("ABC Import HN")).toMatchObject({
      customerId: abcImport.id,
      customerKey: abcImport.id,
      issues: [
        issue("CUSTOMER_MATCH_FUZZY", {
          sheet: "ABC Import HN",
          system: abcImport.name,
        }),
      ],
    });
    const ambiguous = resolve("ABC");
    expect(ambiguous.customerId).toBeNull();
    expect(ambiguous.customerKey).toBeNull();
    expect(ambiguous.issues).toHaveLength(1);
    expect(ambiguous.issues[0]?.code).toBe("CUSTOMER_AMBIGUOUS");
    expect(ambiguous.issues[0]?.params.sheet).toBe("ABC");
    expect(String(ambiguous.issues[0]?.params.list).split(", ")).toHaveLength(
      3,
    );
  });

  it("matches a customer code exactly and reports an unknown name", () => {
    expect(resolve(null, "kh0007")).toEqual({
      customerId: abcImport.id,
      customerName: abcImport.name,
      customerKey: abcImport.id,
      issues: [],
    });
    expect(resolve("Khách lạ")).toEqual({
      customerId: null,
      customerName: null,
      customerKey: null,
      issues: [issue("CUSTOMER_NOT_FOUND", { sheet: "Khách lạ" })],
    });
    expect(resolve(null, "KH9999").issues).toEqual([
      issue("CUSTOMER_NOT_FOUND", { sheet: "KH9999" }),
    ]);
  });

  it("keeps the order's customer as the working identity after a directory miss", () => {
    const result = resolveCustomer({
      name: "Khách lạ",
      code: null,
      directory,
      fallback: { customerId: abcImport.id, customerName: abcImport.name },
    });
    expect(result).toEqual({
      customerId: abcImport.id,
      customerName: abcImport.name,
      customerKey: abcImport.id,
      issues: [issue("CUSTOMER_NOT_FOUND", { sheet: "Khách lạ" })],
    });
  });

  it("returns nothing for an empty row", () => {
    expect(resolve(null)).toEqual({
      customerId: null,
      customerName: null,
      customerKey: null,
      issues: [],
    });
  });
});

describe("resolveCustomer without the directory", () => {
  it("takes the order's customer and says so when the sheet named nobody", () => {
    const result = resolveCustomer({
      name: null,
      code: null,
      directory: null,
      fallback: {
        customerId: "c0c0c0c0c0c0c0c0c0c0c0c0",
        customerName: "Khách A",
      },
    });
    expect(result).toEqual({
      customerId: "c0c0c0c0c0c0c0c0c0c0c0c0",
      customerName: "Khách A",
      customerKey: "c0c0c0c0c0c0c0c0c0c0c0c0",
      issues: [issue("CUSTOMER_INFERRED", { customer: "Khách A" })],
    });
  });

  it("keeps the order's customer silently when the sheet has a name (the caller compares)", () => {
    const result = resolveCustomer({
      name: "Khách Z",
      code: null,
      directory: null,
      fallback: { customerId: null, customerName: "Khách A" },
    });
    expect(result).toEqual({
      customerId: null,
      customerName: "Khách A",
      customerKey: customerKeyOf(null, "Khách A"),
      issues: [],
    });
  });

  it("falls back to the legacy name key for a bare name", () => {
    const result = resolveCustomer({
      name: " Khách A ",
      code: null,
      directory: null,
      fallback: null,
    });
    expect(result).toEqual({
      customerId: null,
      customerName: "Khách A",
      customerKey: customerKeyOf(null, "Khách A"),
      issues: [],
    });
  });
});

describe("customer keys", () => {
  it("lets a legacy name-only receipt meet a sheet name spelled with a legal form", () => {
    const resolution = resolveCustomer({
      name: "Cty TNHH Khách A",
      code: null,
      directory: null,
      fallback: null,
    });
    const rowKeys = rowCustomerKeys(resolution, "Cty TNHH Khách A");
    const receiptKeys = receiptCustomerKeys({
      customerId: null,
      counterparty: "Khach A",
    });
    expect(keysIntersect(rowKeys, receiptKeys)).toBe(true);
    expect(
      keysIntersect(
        rowKeys,
        receiptCustomerKeys({ customerId: null, counterparty: "Khách B" }),
      ),
    ).toBe(false);
  });

  it("meets a receipt by id when the customer was resolved", () => {
    const resolution = resolveCustomer({
      name: null,
      code: null,
      directory: null,
      fallback: {
        customerId: "c0c0c0c0c0c0c0c0c0c0c0c0",
        customerName: "Khách A",
      },
    });
    const receiptKeys = receiptCustomerKeys({
      customerId: "c0c0c0c0c0c0c0c0c0c0c0c0",
      counterparty: "Tên khác hẳn",
    });
    expect(keysIntersect(rowCustomerKeys(resolution, null), receiptKeys)).toBe(
      true,
    );
  });
});

describe("RowAccumulator", () => {
  const parsed = { ...emptyParsedRow(), orderCode: "RD-1" };
  const build = (
    template: "incomingCash" | "generic" = "generic",
    parsingIssues: Issue[] = [],
    skipped = false,
  ) =>
    new RowAccumulator({
      rowIndex: 0,
      template,
      parsed,
      skipped,
      parsingIssues,
    });

  it("orders findings as parsing, duplicates, comparison", () => {
    const row = build("generic", [
      issue("AMOUNT_HIDDEN_DECIMALS", { raw: "1.5", used: "2" }),
    ]);
    row.addComparisonIssues([
      issue("ORDER_MATCHED", { code: "RD-1", stage: "x", customer: "y" }),
    ]);
    row.addDuplicateIssues([issue("DUPLICATE_KEY", { key: "k", n: 3 })]);
    expect(row.issues.map((entry) => entry.code)).toEqual([
      "AMOUNT_HIDDEN_DECIMALS",
      "DUPLICATE_KEY",
      "ORDER_MATCHED",
    ]);
    expect(row.outcome()).toBe("matched");
  });

  it("is skipped for non-data rows whatever else was recorded", () => {
    const row = build(
      "generic",
      [issue("AMOUNT_NOT_NUMBER", { raw: "x" })],
      true,
    );
    row.addComparisonIssues([issue("ORDER_NOT_FOUND", { code: "RD-1" })]);
    expect(row.outcome()).toBe("skipped");
  });

  it("is notFound when the record was not located, mismatch when it was", () => {
    const missing = build();
    missing.addComparisonIssues([issue("ORDER_NOT_FOUND", { code: "RD-1" })]);
    expect(missing.outcome()).toBe("notFound");

    const cash = build("incomingCash");
    cash.addComparisonIssues([
      issue("ORDER_MATCHED", { code: "RD-1", stage: "x", customer: "y" }),
      issue("RECEIPT_NOT_FOUND", {
        customer: "y",
        d: "2026-08-15",
        amount: "1 VND",
      }),
    ]);
    expect(cash.outcome()).toBe("notFound");

    const found = build("incomingCash");
    found.addComparisonIssues([
      issue("RECEIPT_MATCHED", { d: "2026-08-15", amount: "1 VND" }),
      issue("CUSTOMER_NOT_FOUND", { sheet: "z" }),
    ]);
    expect(found.outcome()).toBe("mismatch");

    const explicit = build();
    explicit.markFound();
    explicit.addComparisonIssues([
      issue("CURRENCY_MISMATCH", { sheet: "USD", system: "VND" }),
    ]);
    expect(explicit.outcome()).toBe("mismatch");

    const duplicate = build();
    duplicate.addDuplicateIssues([issue("DUPLICATE_ROW", { n: 2 })]);
    duplicate.addComparisonIssues([
      issue("ORDER_MATCHED", { code: "RD-1", stage: "x", customer: "y" }),
    ]);
    expect(duplicate.outcome()).toBe("mismatch");
  });

  it("is invalid when a parse error left nothing to compare, notCompared when restricted", () => {
    const invalid = build("incomingCash", [
      issue("DATE_INVALID", { raw: "x" }),
    ]);
    expect(invalid.outcome()).toBe("invalid");

    const restricted = build();
    restricted.markNotCompared();
    expect(restricted.outcome()).toBe("notCompared");

    const nothing = build("generic", [issue("CODE_SUSPICIOUS_CHARS")]);
    expect(nothing.outcome()).toBe("notCompared");
  });

  it("renders the row result with the system view it was given", () => {
    const row = build();
    row.setSystem({ order: null, receipts: [] });
    row.addComparisonIssues([issue("ORDER_NOT_FOUND", { code: "RD-1" })]);
    expect(row.toResult()).toEqual({
      parsed,
      issues: [issue("ORDER_NOT_FOUND", { code: "RD-1" })],
      system: { order: null, receipts: [] },
      outcome: "notFound",
    });
    const bare = build();
    expect(bare.toResult().system).toBeNull();
  });
});

describe("order index", () => {
  it("indexes each zero-stripped digit run", () => {
    const order: OrderRecordDto = new FakeOrderStore().seed({
      orderCode: "RD-20260906-0042",
    });
    const index = buildOrderIndex([order]);
    expect(index.byCode.get("RD-20260906-0042")).toBe(order);
    expect(index.byDigits.get("20260906")).toEqual([order]);
    expect(index.byDigits.get("42")).toEqual([order]);
    expect(index.byDigits.has("0042")).toBe(false);
  });
});
