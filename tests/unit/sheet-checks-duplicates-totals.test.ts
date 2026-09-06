import { describe, expect, it } from "vitest";

import type {
  CanonicalField,
  ColumnMapping,
  ParsedRow,
  SheetCell,
  SheetMapping,
  SheetRow,
} from "@/domains/sheet-checks/contracts";
import { emptyParsedRow } from "@/domains/sheet-checks/contracts";
import type { Issue, IssueCode } from "@/domains/sheet-checks/issues";
import type {
  ParsedRowEntry,
  ParsedRows,
} from "@/domains/sheet-checks/parsing/rows";
import { findDuplicates } from "@/domains/sheet-checks/reconcile/duplicates";
import { checkTotals } from "@/domains/sheet-checks/reconcile/totals";
import { money, type Money } from "@/lib/money";

/**
 * Duplicate detection and the totals/subtotals check over hand-built rows.
 * Every figure is a decimal string; VND and USD lines never meet.
 */

function vnd(amount: string): Money {
  return money(amount, "VND");
}

function usd(amount: string): Money {
  return money(amount, "USD");
}

function cell(text: string, overrides: Partial<SheetCell> = {}): SheetCell {
  return {
    text,
    type: text === "" ? "z" : "s",
    number: null,
    numberFormat: null,
    formula: false,
    noCache: false,
    mergedFill: false,
    truncated: false,
    ...overrides,
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

function mappingOf(columns: ColumnMapping[]): SheetMapping {
  return {
    columns,
    defaultCurrency: "VND",
    period: null,
    compareSellingPrice: false,
  };
}

function rowOf(
  index: number,
  cells: string[],
  options: { kind?: SheetRow["kind"]; hidden?: boolean; noCache?: number } = {},
): SheetRow {
  return {
    index,
    sheetRowNumber: index + 5,
    kind: options.kind ?? "data",
    hidden: options.hidden ?? false,
    cells: cells.map((text, columnIndex) =>
      cell(
        text,
        columnIndex === options.noCache ? { noCache: true, formula: true } : {},
      ),
    ),
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

function codes(issues: readonly Issue[] | undefined): IssueCode[] {
  return (issues ?? []).map((entry) => entry.code);
}

function find(issues: readonly Issue[], code: IssueCode): Issue | undefined {
  return issues.find((entry) => entry.code === code);
}

describe("findDuplicates", () => {
  const cash = (
    rowIndex: number,
    extra: Partial<ParsedRow> = {},
    options: { skipped?: boolean } = {},
  ) =>
    entryOf(
      rowIndex,
      {
        date: "2026-08-15",
        customerName: "Khách A",
        amount: vnd("25000000"),
        ...extra,
      },
      options,
    );
  const rows = [0, 1, 2, 3].map((index) => rowOf(index, []));

  it("flags an identical later row with the first row's sheet number", () => {
    const result = findDuplicates([cash(0), cash(1)], "incomingCash", rows);
    expect(result.get(0)).toBeUndefined();
    expect(result.get(1)).toEqual([
      {
        code: "DUPLICATE_ROW",
        severity: "error",
        columnIndex: null,
        params: { n: 5 },
      },
    ]);
  });

  it("flags both rows that share the key but differ elsewhere", () => {
    const result = findDuplicates(
      [cash(0, { note: "đợt 1" }), cash(1, { note: "đợt 2" })],
      "incomingCash",
      rows,
    );
    const first = result.get(0)?.[0];
    const second = result.get(1)?.[0];
    expect(first?.code).toBe("DUPLICATE_KEY");
    expect(first?.severity).toBe("warn");
    expect(first?.params).toEqual({
      key: "khách Khách A, ngày 2026-08-15, số tiền 25000000 VND",
      n: 6,
    });
    expect(second?.params).toEqual({
      key: "khách Khách A, ngày 2026-08-15, số tiền 25000000 VND",
      n: 5,
    });
  });

  it("does not add a key warning to an identical copy nor to its original", () => {
    const result = findDuplicates([cash(0), cash(1)], "incomingCash", rows);
    expect(codes(result.get(0))).toEqual([]);
    expect(codes(result.get(1))).toEqual(["DUPLICATE_ROW"]);
  });

  it("stays quiet when the amount or the date differs", () => {
    const result = findDuplicates(
      [
        cash(0),
        cash(1, { amount: vnd("1000000") }),
        cash(2, { date: "2026-08-16" }),
      ],
      "incomingCash",
      rows,
    );
    expect(result.size).toBe(0);
  });

  it("ignores skipped and empty rows", () => {
    const result = findDuplicates(
      [
        entryOf(0, {}),
        entryOf(1, {}),
        cash(2, {}, { skipped: true }),
        cash(3, {}, { skipped: true }),
      ],
      "incomingCash",
      rows,
    );
    expect(result.size).toBe(0);
  });

  it("keys order lists by order code and statements by identity and currency", () => {
    const generic = findDuplicates(
      [
        entryOf(0, { orderCode: "RD-1", note: "a" }),
        entryOf(1, { orderCode: "rd-1", note: "b" }),
      ],
      "generic",
      rows,
    );
    // The group is labelled after its first row, so both members read alike.
    expect(generic.get(0)?.[0]?.params).toEqual({ key: "mã đơn RD-1", n: 6 });
    expect(generic.get(1)?.[0]?.params).toEqual({ key: "mã đơn RD-1", n: 5 });

    const receivables = findDuplicates(
      [
        entryOf(0, { customerName: "Khách A", outstanding: vnd("1") }),
        entryOf(1, { customerName: "Khách A", outstanding: usd("1.00") }),
        entryOf(2, { customerName: "Khách A", outstanding: vnd("2") }),
      ],
      "receivables",
      rows,
    );
    expect(receivables.get(1)).toBeUndefined();
    expect(receivables.get(0)?.[0]?.params).toEqual({
      key: "khách Khách A (VND)",
      n: 7,
    });
    expect(receivables.get(2)?.[0]?.params).toEqual({
      key: "khách Khách A (VND)",
      n: 5,
    });
  });

  it("falls back to the stored position when sheet row numbers are not given", () => {
    const result = findDuplicates([cash(0), cash(1)], "incomingCash");
    expect(result.get(1)?.[0]?.params).toEqual({ n: 1 });
  });
});

describe("checkTotals", () => {
  const columns = [column(0, "customerName"), column(1, "amount")];

  function scenario(input: {
    amounts: (Money | null)[];
    totalText?: string;
    totalValue?: Money | null;
    hidden?: number[];
    withTotal?: boolean;
    totalNoCache?: boolean;
  }) {
    const rows: SheetRow[] = input.amounts.map((amount, index) =>
      rowOf(index, ["Khách", amount ? amount.amount : "abc"], {
        hidden: input.hidden?.includes(index) ?? false,
      }),
    );
    const entries: ParsedRowEntry[] = input.amounts.map((amount, index) =>
      entryOf(index, { customerName: "Khách", amount }),
    );
    if (input.withTotal !== false) {
      const totalIndex = rows.length;
      rows.push(
        rowOf(totalIndex, ["Tổng cộng", input.totalText ?? ""], {
          kind: "total",
          ...(input.totalNoCache ? { noCache: 1 } : {}),
        }),
      );
      entries.push(
        entryOf(
          totalIndex,
          { amount: input.totalValue ?? null },
          { skipped: true },
        ),
      );
    }
    return checkTotals({
      rows,
      parsed: parsedOf(entries),
      mapping: mappingOf(columns),
      headerTexts: ["Khách hàng", "Số tiền"],
      system: null,
      template: "incomingCash",
    });
  }

  it("confirms a totals row that equals the sum of the rows", () => {
    const result = scenario({
      amounts: [vnd("20000000"), vnd("30000000")],
      totalText: "50.000.000",
      totalValue: vnd("50000000"),
    });
    expect(find(result.issues, "TOTAL_MATCH")?.params).toEqual({
      field: "Số tiền",
      currency: "VND",
      total: "50000000 VND",
    });
    expect(find(result.issues, "TOTAL_MATCH")?.columnIndex).toBe(1);
    expect(result.lines).toEqual([
      {
        field: "amount",
        columnIndex: 1,
        currency: "VND",
        computed: "50000000",
        sheetTotal: "50000000",
        rowsCounted: 2,
        rowsSkipped: 0,
        system: null,
      },
    ]);
  });

  it("sums each column of a two-currency amount header on its own cells", () => {
    // "Số tiền" over "VND" and "USD" is one header with two columns; a
    // parsed row keeps one value per field, so the totals must come from
    // the cells of each column rather than from that single value.
    const columnsTwo = [
      column(0, "customerName"),
      column(1, "amount", { fixedCurrency: "VND" }),
      column(2, "amount", { fixedCurrency: "USD" }),
    ];
    const rows: SheetRow[] = [
      rowOf(0, ["Khách A", "20.000.000", "1,000.00"]),
      rowOf(1, ["Khách B", "30.000.000", "500.00"]),
      rowOf(2, ["Tổng cộng", "50.000.000", "1,500.00"], { kind: "total" }),
    ];
    const entries: ParsedRowEntry[] = [
      entryOf(0, { customerName: "Khách A", amount: vnd("20000000") }),
      entryOf(1, { customerName: "Khách B", amount: vnd("30000000") }),
      entryOf(2, {}, { skipped: true }),
    ];
    const result = checkTotals({
      rows,
      parsed: parsedOf(entries),
      mapping: mappingOf(columnsTwo),
      headerTexts: ["Khách hàng", "Số tiền / VND", "Số tiền / USD"],
      system: null,
      template: "incomingCash",
    });

    expect(codes(result.issues)).not.toContain("TOTAL_MIXED_CURRENCY");
    expect(result.lines).toEqual([
      expect.objectContaining({
        columnIndex: 1,
        currency: "VND",
        computed: "50000000",
        sheetTotal: "50000000",
      }),
      expect.objectContaining({
        columnIndex: 2,
        currency: "USD",
        computed: "1500.00",
        sheetTotal: "1500.00",
      }),
    ]);
    expect(
      result.issues.filter((entry) => entry.code === "TOTAL_MATCH"),
    ).toHaveLength(2);
  });

  it("reads a totals row without a currency cell in the currency the data rows use", () => {
    // rows.ts parses the totals cell with the mapping default (VND) because
    // the totals row names no currency; the column itself is USD.
    const result = scenario({
      amounts: [usd("2000.00"), usd("500.00"), usd("300.00")],
      totalText: "2,800.00",
      totalValue: vnd("2800"),
    });
    expect(codes(result.issues)).not.toContain("TOTAL_MIXED_CURRENCY");
    expect(find(result.issues, "TOTAL_MATCH")?.params).toEqual({
      field: "Số tiền",
      currency: "USD",
      total: "2800.00 USD",
    });
    expect(result.lines).toEqual([
      expect.objectContaining({
        currency: "USD",
        computed: "2800.00",
        sheetTotal: "2800.00",
      }),
    ]);
  });

  it("reports the difference, the unreadable rows and the hidden rows on a mismatch", () => {
    const result = scenario({
      amounts: [vnd("20000000"), vnd("29000000"), null],
      totalText: "50.000.000",
      totalValue: vnd("50000000"),
      hidden: [1],
    });
    expect(find(result.issues, "TOTAL_MISMATCH")?.params).toEqual({
      sheetTotal: "50000000 VND",
      n: 2,
      computed: "49000000 VND",
      diff: "1000000 VND",
      skipped: 1,
      hidden: 1,
    });
    expect(result.lines[0]).toMatchObject({
      computed: "49000000",
      rowsCounted: 2,
      rowsSkipped: 1,
    });
  });

  it("keeps a VND line and a USD line apart and refuses one figure over both", () => {
    const result = scenario({
      amounts: [vnd("20000000"), usd("100.00"), vnd("5000000")],
      totalText: "25.000.000",
      totalValue: vnd("25000000"),
    });
    expect(codes(result.issues)).toContain("TOTAL_MIXED_CURRENCY");
    expect(codes(result.issues)).not.toContain("TOTAL_MATCH");
    expect(codes(result.issues)).not.toContain("TOTAL_MISMATCH");
    expect(
      result.lines.map((line) => [
        line.currency,
        line.computed,
        line.sheetTotal,
      ]),
    ).toEqual([
      ["VND", "25000000", null],
      ["USD", "100.00", null],
    ]);
    const naive = "25000100";
    expect(JSON.stringify(result)).not.toContain(naive);
  });

  it("notes the absence of a totals row once", () => {
    const result = scenario({ amounts: [vnd("1000000")], withTotal: false });
    expect(codes(result.issues)).toEqual(["TOTAL_ABSENT"]);
    expect(result.lines[0]).toMatchObject({
      computed: "1000000",
      sheetTotal: null,
    });
  });

  it("warns when the totals cell is a formula without a cached value", () => {
    const result = scenario({
      amounts: [vnd("1000000")],
      totalNoCache: true,
    });
    expect(find(result.issues, "TOTAL_NOT_CACHED")?.columnIndex).toBe(1);
    expect(result.lines[0]?.sheetTotal).toBeNull();
  });

  it("parses the totals cell itself when the parser left it unparsed", () => {
    const result = scenario({
      amounts: [vnd("20000000"), vnd("30000000")],
      totalText: "50.000.000",
      totalValue: null,
    });
    expect(codes(result.issues)).toContain("TOTAL_MATCH");
  });

  it("checks each subtotal against the rows since the previous subtotal or group", () => {
    const rows: SheetRow[] = [
      rowOf(0, ["Khách A", "10.000.000"]),
      rowOf(1, ["Khách A", "5.000.000"]),
      rowOf(2, ["Cộng Khách A", "15.000.000"], { kind: "subtotal" }),
      rowOf(3, ["Khách B", "7.000.000"]),
      rowOf(4, ["Cộng Khách B", "8.000.000"], { kind: "subtotal" }),
      rowOf(5, ["Tổng cộng", "22.000.000"], { kind: "total" }),
    ];
    const entries = [
      entryOf(0, { customerName: "Khách A", amount: vnd("10000000") }),
      entryOf(1, { customerName: "Khách A", amount: vnd("5000000") }),
      entryOf(2, {}, { skipped: true }),
      entryOf(3, { customerName: "Khách B", amount: vnd("7000000") }),
      entryOf(4, {}, { skipped: true }),
      entryOf(5, { amount: vnd("22000000") }, { skipped: true }),
    ];
    const result = checkTotals({
      rows,
      parsed: parsedOf(entries),
      mapping: mappingOf(columns),
      headerTexts: [],
      system: null,
    });
    const subtotal = result.issues.filter(
      (entry) => entry.code === "SUBTOTAL_MISMATCH",
    );
    expect(subtotal).toHaveLength(1);
    expect(subtotal[0]?.params).toEqual({
      label: "Cộng Khách B",
      sheet: "8000000 VND",
      computed: "7000000 VND",
    });
    expect(codes(result.issues)).toContain("TOTAL_MATCH");
  });

  it("carries the system period figure onto the amount line", () => {
    const result = checkTotals({
      rows: [rowOf(0, ["Khách", "1.000.000"])],
      parsed: parsedOf([entryOf(0, { amount: vnd("1000000") })]),
      mapping: mappingOf(columns),
      headerTexts: [],
      system: {
        periodTotals: new Map([
          ["VND", { sheet: "1000000", system: "3000000" }],
        ]),
      },
    });
    expect(result.lines[0]?.system).toBe("3000000");
  });

  it("skips money fields the template does not use, and yields no lines without money columns", () => {
    const result = checkTotals({
      rows: [rowOf(0, ["Khách", "1"])],
      parsed: parsedOf([entryOf(0, { outstanding: vnd("1") })]),
      mapping: mappingOf([column(0, "customerName"), column(1, "outstanding")]),
      headerTexts: [],
      system: null,
      template: "incomingCash",
    });
    expect(result.lines).toEqual([]);
    expect(result.issues).toEqual([]);

    const none = checkTotals({
      rows: [rowOf(0, ["Khách"])],
      parsed: parsedOf([entryOf(0, { customerName: "Khách" })]),
      mapping: mappingOf([column(0, "customerName")]),
      headerTexts: [],
      system: null,
    });
    expect(none.lines).toEqual([]);
    expect(none.issues).toEqual([]);
  });
});
