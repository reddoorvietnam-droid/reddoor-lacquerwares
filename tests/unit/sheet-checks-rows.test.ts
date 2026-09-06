import { describe, expect, it } from "vitest";

import type {
  CanonicalField,
  ColumnMapping,
  SheetCell,
  SheetMapping,
  SheetRow,
  SheetRowKind,
} from "@/domains/sheet-checks/contracts";
import type { Issue } from "@/domains/sheet-checks/issues";
import { sheetCheckLimits as limits } from "@/domains/sheet-checks/limits";
import { blankCell } from "@/domains/sheet-checks/parsing/intake";
import {
  parseRows,
  type ParseRowsContext,
} from "@/domains/sheet-checks/parsing/rows";

type Cellish = string | number | null | Partial<SheetCell>;

function cellOf(value: Cellish): SheetCell {
  if (value === null) return blankCell();
  if (typeof value === "number") {
    return { ...blankCell(), type: "n", number: value, text: String(value) };
  }
  if (typeof value === "string") {
    return value === ""
      ? blankCell()
      : { ...blankCell(), type: "s", text: value };
  }
  return { ...blankCell(), type: "s", ...value };
}

type RowSpec = {
  kind?: SheetRowKind;
  hidden?: boolean;
  cells: readonly Cellish[];
};

function rowsOf(specs: readonly RowSpec[]): SheetRow[] {
  const columnCount = specs.reduce(
    (max, spec) => Math.max(max, spec.cells.length),
    0,
  );
  return specs.map((spec, index) => ({
    index,
    sheetRowNumber: index + 2,
    kind: spec.kind ?? "data",
    hidden: spec.hidden ?? false,
    cells: Array.from({ length: columnCount }, (_unused, column) =>
      cellOf(spec.cells[column] ?? null),
    ),
  }));
}

type ColumnSpec = { field: CanonicalField } & Partial<
  Omit<ColumnMapping, "field" | "columnIndex">
>;

function mappingOf(
  columns: readonly ColumnSpec[],
  extra: Partial<Omit<SheetMapping, "columns">> = {},
): SheetMapping {
  return {
    columns: columns.map((column, columnIndex) => ({
      columnIndex,
      field: column.field,
      fixedCurrency: column.fixedCurrency ?? null,
      unitMultiplier: column.unitMultiplier ?? "1",
      numberStyle: column.numberStyle ?? null,
      dateOrder: column.dateOrder ?? null,
    })),
    defaultCurrency: extra.defaultCurrency ?? "VND",
    period: extra.period ?? null,
    compareSellingPrice: extra.compareSellingPrice ?? false,
  };
}

function contextOf(
  mapping: SheetMapping,
  overrides: Partial<ParseRowsContext> = {},
): ParseRowsContext {
  return {
    template: "incomingCash",
    mapping,
    headerTexts: mapping.columns.map((column) => `H${column.columnIndex}`),
    date1904: false,
    today: "2026-09-06",
    ...overrides,
  };
}

function codes(issues: readonly Issue[]): string[] {
  return issues.map((entry) => entry.code);
}

const cashMapping = mappingOf([
  { field: "customerName" },
  { field: "date" },
  { field: "amount" },
  { field: "note" },
]);

describe("parseRows", () => {
  it("parses a plain incoming-cash row through the money, date and text parsers", () => {
    const rows = rowsOf([
      { cells: ["Cty A", "15/08/2026", "25.000.000", "chuyển khoản"] },
    ]);
    const result = parseRows(rows, contextOf(cashMapping));
    expect(result.rows).toHaveLength(1);
    const entry = result.rows[0];
    expect(entry?.skipped).toBe(false);
    expect(entry?.parsed).toMatchObject({
      customerName: "Cty A",
      date: "2026-08-15",
      amount: { amount: "25000000", currency: "VND" },
      note: "chuyển khoản",
      orderCode: null,
      currency: null,
    });
    expect(entry?.issues).toEqual([]);
    expect(result.columnStyles).toEqual({ 2: "vi" });
    expect(result.dateOrders).toEqual({
      1: { order: "dmy", source: "proven" },
    });
    expect(result.columnIssues).toEqual([
      expect.objectContaining({
        code: "CURRENCY_DEFAULTED",
        columnIndex: 2,
        params: { header: "H2", currency: "VND" },
      }),
    ]);
  });

  it("reports REQUIRED_EMPTY for blank required cells only", () => {
    const rows = rowsOf([
      { cells: ["Cty A", "", "", ""] },
      { cells: ["Cty B", "15/08/2026", "abc", ""] },
      { cells: ["Cty C", "15/08/2026", "-", ""] },
    ]);
    const result = parseRows(rows, contextOf(cashMapping));
    expect(result.rows[0]?.issues).toEqual([
      expect.objectContaining({
        code: "REQUIRED_EMPTY",
        columnIndex: 1,
        params: { field: "Ngày" },
      }),
      expect.objectContaining({
        code: "REQUIRED_EMPTY",
        columnIndex: 2,
        params: { field: "Số tiền" },
      }),
    ]);
    expect(codes(result.rows[1]?.issues ?? [])).toEqual(["AMOUNT_NOT_NUMBER"]);
    expect(codes(result.rows[2]?.issues ?? [])).toEqual(["REQUIRED_EMPTY"]);
    expect(result.rows[2]?.parsed.amount).toBeNull();
  });

  it("uses a merged name with MERGED_FILL but treats a merged amount as blank", () => {
    const rows = rowsOf([
      { cells: ["Cty A", "15/08/2026", "25.000.000", ""] },
      {
        cells: [
          { text: "Cty A", mergedFill: true },
          "16/08/2026",
          { text: "25.000.000", mergedFill: true },
          "",
        ],
      },
    ]);
    const result = parseRows(rows, contextOf(cashMapping));
    expect(result.rows[0]?.issues).toEqual([]);
    expect(result.rows[1]?.parsed.customerName).toBe("Cty A");
    expect(result.rows[1]?.parsed.amount).toBeNull();
    expect(result.rows[1]?.issues).toEqual([
      expect.objectContaining({
        code: "MERGED_FILL",
        columnIndex: 0,
        params: { field: "Tên khách" },
      }),
      expect.objectContaining({ code: "REQUIRED_EMPTY", columnIndex: 2 }),
    ]);
  });

  it("reports Excel error cells on key columns and stays silent on free-text columns", () => {
    const rows = rowsOf([
      {
        cells: [
          "Cty A",
          "15/08/2026",
          { type: "e", text: "#REF!" },
          { type: "e", text: "#N/A" },
        ],
      },
    ]);
    const result = parseRows(rows, contextOf(cashMapping));
    expect(result.rows[0]?.issues).toEqual([
      expect.objectContaining({
        code: "CELL_ERROR_VALUE",
        columnIndex: 2,
        severity: "error",
      }),
    ]);
    expect(result.rows[0]?.parsed.amount).toBeNull();
    expect(result.rows[0]?.parsed.note).toBeNull();
  });

  it("reports a formula without a cached value as an error on money/date columns and info elsewhere", () => {
    const noCache: Partial<SheetCell> = {
      type: "n",
      text: "",
      formula: true,
      noCache: true,
    };
    const rows = rowsOf([
      { cells: ["Cty A", noCache, noCache, { ...noCache, type: "s" }] },
    ]);
    const result = parseRows(rows, contextOf(cashMapping));
    expect(result.rows[0]?.issues).toEqual([
      expect.objectContaining({
        code: "FORMULA_NO_CACHE",
        columnIndex: 1,
        severity: "error",
      }),
      expect.objectContaining({
        code: "FORMULA_NO_CACHE",
        columnIndex: 2,
        severity: "error",
      }),
      expect.objectContaining({
        code: "FORMULA_NO_CACHE",
        columnIndex: 3,
        severity: "info",
      }),
    ]);
    expect(result.rows[0]?.parsed.amount).toBeNull();
    expect(result.rows[0]?.parsed.date).toBeNull();
  });

  it("marks hidden rows once and truncated cells per column", () => {
    const rows = rowsOf([
      {
        hidden: true,
        cells: [
          "Cty A",
          "15/08/2026",
          "25.000.000",
          { text: "x".repeat(200), truncated: true },
        ],
      },
    ]);
    const result = parseRows(rows, contextOf(cashMapping));
    expect(result.rows[0]?.issues).toEqual([
      expect.objectContaining({ code: "HIDDEN_ROW", columnIndex: null }),
      expect.objectContaining({
        code: "CELL_TRUNCATED",
        columnIndex: 3,
        params: { max: limits.maxCellChars },
      }),
    ]);
  });

  it("raises COLUMN_STYLE_MIXED once when the column mixes 1.250.000 and 1,250.00", () => {
    const rows = rowsOf([
      { cells: ["A", "15/08/2026", "1.250.000", ""] },
      { cells: ["B", "16/08/2026", "1,250.00", ""] },
    ]);
    const result = parseRows(rows, contextOf(cashMapping));
    expect(result.columnStyles[2]).toBe("mixed");
    expect(
      result.columnIssues.filter(
        (entry) => entry.code === "COLUMN_STYLE_MIXED",
      ),
    ).toHaveLength(1);
    expect(result.rows[0]?.parsed.amount?.amount).toBe("1250000");
    expect(result.rows[1]?.parsed.amount?.amount).toBe("1250");
  });

  it("raises COLUMN_STYLE_MIXED when a cell contradicts an explicit column style", () => {
    const mapping = mappingOf([
      { field: "customerName" },
      { field: "date" },
      { field: "amount", numberStyle: "vi", fixedCurrency: "USD" },
    ]);
    const rows = rowsOf([
      { cells: ["A", "15/08/2026", "1.250,50"] },
      { cells: ["B", "16/08/2026", "1,250.00"] },
    ]);
    const result = parseRows(rows, contextOf(mapping));
    expect(result.columnStyles[2]).toBe("vi");
    expect(
      result.columnIssues.filter(
        (entry) => entry.code === "COLUMN_STYLE_MIXED",
      ),
    ).toHaveLength(1);
    expect(result.rows[1]?.parsed.amount).toEqual({
      amount: "1250.00",
      currency: "USD",
    });
  });

  it("reports mixed currencies in a column and never defaults when every cell names one", () => {
    const rows = rowsOf([
      { cells: ["A", "15/08/2026", "500 USD", ""] },
      { cells: ["B", "16/08/2026", "1.000.000 VND", ""] },
    ]);
    const result = parseRows(rows, contextOf(cashMapping));
    expect(result.rows[0]?.parsed.amount).toEqual({
      amount: "500.00",
      currency: "USD",
    });
    expect(result.rows[1]?.parsed.amount).toEqual({
      amount: "1000000",
      currency: "VND",
    });
    expect(codes(result.columnIssues)).toEqual(["CURRENCY_MIXED_COLUMN"]);
  });

  it("applies a confirmed unit multiplier and says so once per column", () => {
    const mapping = mappingOf([
      { field: "customerName" },
      { field: "date" },
      { field: "amount", unitMultiplier: "1000" },
    ]);
    const rows = rowsOf([{ cells: ["A", "15/08/2026", "1.250"] }]);
    const result = parseRows(rows, contextOf(mapping));
    expect(result.rows[0]?.parsed.amount).toEqual({
      amount: "1250000",
      currency: "VND",
    });
    expect(result.columnIssues).toContainEqual(
      expect.objectContaining({
        code: "UNIT_MULTIPLIER_APPLIED",
        columnIndex: 2,
        params: { header: "H2", multiplier: "1000" },
      }),
    );
  });

  it("settles the day/month order per column: proven mdy, assumed dmy, confirmed", () => {
    const mdyRows = rowsOf([
      { cells: ["A", "08/15/2026", "1.000.000"] },
      { cells: ["B", "05/06/2026", "1.000.000"] },
    ]);
    const mdy = parseRows(mdyRows, contextOf(cashMapping));
    expect(mdy.dateOrders[1]).toEqual({ order: "mdy", source: "proven" });
    expect(codes(mdy.columnIssues)).toContain("DATE_ORDER_MDY");
    expect(mdy.rows.map((entry) => entry.parsed.date)).toEqual([
      "2026-08-15",
      "2026-05-06",
    ]);

    const assumedRows = rowsOf([{ cells: ["A", "05/06/2026", "1.000.000"] }]);
    const assumed = parseRows(assumedRows, contextOf(cashMapping));
    expect(assumed.dateOrders[1]).toEqual({ order: "dmy", source: "assumed" });
    expect(codes(assumed.columnIssues)).toContain("DATE_ORDER_ASSUMED");
    expect(assumed.rows[0]?.parsed.date).toBe("2026-06-05");
    expect(codes(assumed.rows[0]?.issues ?? [])).toContain("DATE_AMBIGUOUS");

    const confirmedMapping = mappingOf([
      { field: "customerName" },
      { field: "date", dateOrder: "dmy" },
      { field: "amount" },
    ]);
    const confirmed = parseRows(assumedRows, contextOf(confirmedMapping));
    expect(confirmed.dateOrders[1]).toEqual({
      order: "dmy",
      source: "confirmed",
    });
    expect(codes(confirmed.columnIssues)).not.toContain("DATE_ORDER_ASSUMED");
    expect(confirmed.rows[0]?.issues).toEqual([]);
  });

  it("parses money on totals and subtotal rows only, and nothing on group or blank rows", () => {
    const rows = rowsOf([
      { kind: "group", cells: ["Miền Bắc", "", "", ""] },
      { cells: ["A", "15/08/2026", "25.000.000", ""] },
      { kind: "subtotal", cells: ["Cộng A", "", "25.000.000", ""] },
      { kind: "blank", cells: ["", "", "", ""] },
      { kind: "total", cells: ["Tổng cộng", "", "xyz", "note"] },
    ]);
    const result = parseRows(rows, contextOf(cashMapping));
    expect(result.rows.map((entry) => entry.skipped)).toEqual([
      true,
      false,
      true,
      true,
      true,
    ]);
    expect(result.rows[0]?.parsed.customerName).toBeNull();
    expect(result.rows[2]?.parsed.amount).toEqual({
      amount: "25000000",
      currency: "VND",
    });
    expect(result.rows[2]?.parsed.customerName).toBeNull();
    expect(result.rows[2]?.issues).toEqual([]);
    expect(result.rows[4]?.parsed.amount).toBeNull();
    expect(result.rows[4]?.parsed.note).toBeNull();
    expect(result.rows[4]?.issues).toEqual([
      expect.objectContaining({ code: "AMOUNT_NOT_NUMBER", columnIndex: 2 }),
    ]);
    expect(result.rows[3]?.issues).toEqual([]);
  });

  it("reads the currency column once and feeds it to the money parser", () => {
    const mapping = mappingOf([
      { field: "customerName" },
      { field: "date" },
      { field: "amount" },
      { field: "currency" },
    ]);
    const rows = rowsOf([
      { cells: ["A", "15/08/2026", "1,250.00", "USD"] },
      { cells: ["B", "16/08/2026", "1.000.000", "EUR"] },
      { cells: ["C", "17/08/2026", "500 USD", "VND"] },
    ]);
    const result = parseRows(rows, contextOf(mapping));
    expect(result.rows[0]?.parsed.currency).toBe("USD");
    expect(result.rows[0]?.parsed.amount).toEqual({
      amount: "1250.00",
      currency: "USD",
    });
    expect(result.rows[1]?.parsed.currency).toBeNull();
    expect(
      result.rows[1]?.issues.filter(
        (entry) => entry.code === "CURRENCY_INVALID",
      ),
    ).toEqual([
      expect.objectContaining({ columnIndex: 3, params: { raw: "EUR" } }),
    ]);
    expect(result.rows[1]?.parsed.amount).toEqual({
      amount: "1000000",
      currency: "VND",
    });
    expect(codes(result.rows[2]?.issues ?? [])).toContain("CURRENCY_CONFLICT");
  });

  it("takes the first non-blank column when two columns map to one money field", () => {
    const mapping = mappingOf([
      { field: "customerName" },
      { field: "date" },
      { field: "amount", fixedCurrency: "VND" },
      { field: "amount", fixedCurrency: "USD" },
    ]);
    const rows = rowsOf([
      { cells: ["A", "15/08/2026", "25.000.000", ""] },
      { cells: ["B", "16/08/2026", "", "1,250.00"] },
    ]);
    const result = parseRows(rows, contextOf(mapping));
    expect(result.rows[0]?.parsed.amount).toEqual({
      amount: "25000000",
      currency: "VND",
    });
    expect(result.rows[1]?.parsed.amount).toEqual({
      amount: "1250.00",
      currency: "USD",
    });
    expect(result.rows[1]?.issues).toEqual([]);
    expect(codes(result.columnIssues)).toEqual([]);
  });

  it("ignores template-irrelevant fields and out-of-range columns", () => {
    const mapping: SheetMapping = {
      ...mappingOf([
        { field: "orderCode" },
        { field: "received" },
        { field: "stage" },
      ]),
    };
    mapping.columns = [
      ...mapping.columns,
      {
        columnIndex: 42,
        field: "date",
        fixedCurrency: null,
        unitMultiplier: "1",
        numberStyle: null,
        dateOrder: null,
      },
    ];
    const rows = rowsOf([
      { cells: [" rd-20260906-e2e1 ", "1.000.000", "Đang sản xuất"] },
    ]);
    const result = parseRows(rows, contextOf(mapping, { template: "generic" }));
    expect(result.rows[0]?.parsed).toMatchObject({
      orderCode: "RD-20260906-E2E1",
      received: null,
      stage: "Đang sản xuất",
      date: null,
    });
    expect(codes(result.rows[0]?.issues ?? [])).toEqual(["CODE_NORMALIZED"]);
    expect(result.columnStyles).toEqual({});
    expect(result.dateOrders).toEqual({});
  });

  it("treats placeholders in text columns as empty and trims the rest", () => {
    const mapping = mappingOf([
      { field: "customerName" },
      { field: "date" },
      { field: "amount" },
      { field: "method" },
      { field: "bankRef" },
      { field: "note" },
    ]);
    const rows = rowsOf([
      {
        cells: [
          "  Cty A ",
          "15/08/2026",
          "1.000.000",
          "-",
          "N/A",
          "  ghi chú  ",
        ],
      },
    ]);
    const result = parseRows(rows, contextOf(mapping));
    expect(result.rows[0]?.parsed).toMatchObject({
      customerName: "Cty A",
      method: null,
      bankRef: null,
      note: "ghi chú",
    });
  });

  it("does not flag REQUIRED_EMPTY for a required field the mapping never included", () => {
    const rows = rowsOf([{ cells: ["Cty A", "15/08/2026"] }]);
    const mapping = mappingOf([{ field: "customerName" }, { field: "date" }]);
    const result = parseRows(rows, contextOf(mapping));
    expect(result.rows[0]?.issues).toEqual([]);
  });
});
