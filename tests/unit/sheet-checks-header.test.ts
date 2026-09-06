import { describe, expect, it } from "vitest";

import {
  SheetCheckError,
  type SheetCell,
  type SheetCheckTemplate,
  type SheetMapping,
} from "@/domains/sheet-checks/contracts";
import { sheetCheckLimits as limits } from "@/domains/sheet-checks/limits";
import {
  analyzeSheet,
  detectPeriodHint,
  fixedCurrencyOf,
  headerSynonyms,
  matchHeader,
  multiplierHintOf,
  proposeMapping,
  validateMapping,
} from "@/domains/sheet-checks/parsing/header";
import {
  blankCell,
  type ParsedSheet,
} from "@/domains/sheet-checks/parsing/intake";

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

function sheetOf(
  grid: readonly (readonly Cellish[])[],
  options: { hiddenRows?: readonly number[] } = {},
): ParsedSheet {
  const columnCount = grid.reduce((max, row) => Math.max(max, row.length), 0);
  return {
    index: 0,
    name: "Sheet1",
    columnCount,
    hiddenColumnCount: 0,
    rows: grid.map((row, index) => ({
      sheetRowNumber: index + 1,
      hidden: options.hiddenRows?.includes(index) ?? false,
      cells: Array.from({ length: columnCount }, (_unused, column) =>
        cellOf(row[column] ?? null),
      ),
    })),
  };
}

function propose(
  grid: readonly (readonly Cellish[])[],
  template: SheetCheckTemplate,
) {
  const analysis = analyzeSheet(sheetOf(grid), template);
  return { analysis, ...proposeMapping(analysis, template) };
}

function fieldsOf(
  grid: readonly (readonly Cellish[])[],
  template: SheetCheckTemplate,
) {
  return propose(grid, template).proposal.columns.map((column) => column.field);
}

function mappingOf(
  columns: readonly {
    columnIndex: number;
    field: SheetMapping["columns"][number]["field"];
    fixedCurrency?: "VND" | "USD";
    dateOrder?: "dmy" | "mdy";
  }[],
): SheetMapping {
  return {
    columns: columns.map((column) => ({
      columnIndex: column.columnIndex,
      field: column.field,
      fixedCurrency: column.fixedCurrency ?? null,
      unitMultiplier: "1",
      numberStyle: null,
      dateOrder: column.dateOrder ?? null,
    })),
    defaultCurrency: "VND",
    period: null,
    compareSellingPrice: false,
  };
}

const cashHeader = ["STT", "Khách hàng", "Ngày", "Số tiền", "Ghi chú"];
const cashRows: Cellish[][] = [
  [1, "Cty A", "15/08/2026", "25.000.000", ""],
  [2, "Cty B", "16/08/2026", "1.000.000", "chuyển khoản"],
];

describe("header detection", () => {
  it("finds the header under title rows and reads the month from the title", () => {
    const { analysis } = propose(
      [
        ["CÔNG TY TNHH SƠN MÀI ABC"],
        ["BÁO CÁO TIỀN VỀ THÁNG 8/2026"],
        [],
        cashHeader,
        ...cashRows,
      ],
      "incomingCash",
    );
    expect(analysis.headerRowOffset).toBe(3);
    expect(analysis.headerSheetRowNumber).toBe(4);
    expect(analysis.titleLines).toEqual([
      "CÔNG TY TNHH SƠN MÀI ABC",
      "BÁO CÁO TIỀN VỀ THÁNG 8/2026",
    ]);
    expect(analysis.periodHint).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(analysis.headerTexts).toEqual(cashHeader);
    expect(analysis.rows.map((row) => row.kind)).toEqual(["data", "data"]);
    expect(analysis.rows.map((row) => row.sheetRowNumber)).toEqual([5, 6]);
    expect(analysis.dataRowCount).toBe(2);
    expect(analysis.issues).toEqual([]);
  });

  it("does not let a merged title cell masquerade as a header", () => {
    const title = { text: "CÔNG TY TNHH ABC" };
    const { analysis } = propose(
      [
        [
          title,
          { ...title, mergedFill: true },
          { ...title, mergedFill: true },
          { ...title, mergedFill: true },
        ],
        cashHeader.slice(0, 4),
        ...cashRows.map((row) => row.slice(0, 4)),
      ],
      "incomingCash",
    );
    expect(analysis.headerRowOffset).toBe(1);
    expect(analysis.titleLines).toEqual(["CÔNG TY TNHH ABC"]);
  });

  it("reads an explicit date range from the title", () => {
    const { analysis } = propose(
      [["Từ ngày 01/08/2026 đến ngày 31/08/2026"], cashHeader, ...cashRows],
      "incomingCash",
    );
    expect(analysis.periodHint).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("reads the month when the title spells out 'năm', and keeps a bare year a year", () => {
    expect(detectPeriodHint(["BÁO CÁO TIỀN VỀ THÁNG 8 NĂM 2026"], [])).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(detectPeriodHint(["Công nợ quý 3 năm 2026"], [])).toEqual({
      from: "2026-07-01",
      to: "2026-09-30",
    });
    expect(detectPeriodHint(["Báo cáo tháng 8 2026"], [])).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("never resolves an inherited object key as a column currency", () => {
    expect(fixedCurrencyOf("constructor")).toBeNull();
    expect(fixedCurrencyOf("__proto__")).toBeNull();
    expect(fixedCurrencyOf("toString")).toBeNull();
    expect(fixedCurrencyOf("Số tiền (USD)")).toBe("USD");
    expect(fixedCurrencyOf("Số tiền (VNĐ)")).toBe("VND");
  });

  it("reads quarters, years, English months and mm/yyyy", () => {
    expect(detectPeriodHint(["Báo cáo công nợ quý 3/2026"], [])).toEqual({
      from: "2026-07-01",
      to: "2026-09-30",
    });
    expect(detectPeriodHint(["Tổng hợp năm 2026"], [])).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(detectPeriodHint(["Cash received August 2026"], [])).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(detectPeriodHint([], ["Số tiền 02/2028"])).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
    expect(detectPeriodHint(["Công ty Việt Nam"], ["Ngày"])).toBeNull();
  });

  it("joins a two-row header: 'Số tiền' over 'VND' / 'USD' gives two fixed-currency amount columns", () => {
    const { analysis, proposal, mapping } = propose(
      [
        [
          "Khách hàng",
          "Ngày",
          "Số tiền",
          { text: "Số tiền", mergedFill: true },
        ],
        ["", "", "VND", "USD"],
        ["Cty A", "15/08/2026", "25.000.000", ""],
        ["Cty B", "16/08/2026", "", "1,250.00"],
      ],
      "incomingCash",
    );
    expect(analysis.headerTexts).toEqual([
      "Khách hàng",
      "Ngày",
      "Số tiền / VND",
      "Số tiền / USD",
    ]);
    expect(analysis.rows).toHaveLength(2);
    expect(proposal.columns.map((column) => column.field)).toEqual([
      "customerName",
      "date",
      "amount",
      "amount",
    ]);
    expect(mapping.columns.map((column) => column.fixedCurrency)).toEqual([
      null,
      null,
      "VND",
      "USD",
    ]);
    expect(validateMapping(mapping, "incomingCash", analysis.rows)).toEqual([]);
  });

  it("joins a group label above the scored header row", () => {
    const { analysis, proposal } = propose(
      [
        ["", "", "Số tiền", { text: "Số tiền", mergedFill: true }],
        ["Khách hàng", "Ngày", "VND", "USD"],
        ["Cty A", "15/08/2026", "25.000.000", ""],
      ],
      "incomingCash",
    );
    expect(analysis.headerTexts).toEqual([
      "Khách hàng",
      "Ngày",
      "Số tiền / VND",
      "Số tiền / USD",
    ]);
    expect(analysis.headerRowOffset).toBe(0);
    expect(proposal.columns.map((column) => column.field)).toEqual([
      "customerName",
      "date",
      "amount",
      "amount",
    ]);
  });

  it("joins 'Ngày' over 'Chứng từ' into a date column", () => {
    const { analysis, proposal } = propose(
      [
        ["Khách hàng", "Ngày", "Số tiền"],
        ["", "Chứng từ", ""],
        ["Cty A", "15/08/2026", "25.000.000"],
      ],
      "incomingCash",
    );
    expect(analysis.headerTexts[1]).toBe("Ngày / Chứng từ");
    expect(proposal.columns[1]?.field).toBe("date");
    expect(analysis.rows).toHaveLength(1);
  });

  it("does not swallow a data row of short words as a second header row", () => {
    const { analysis } = propose(
      [
        ["Khách hàng", "Mã đơn", "Số tiền"],
        ["Cty A", "RD-20260906-E2E1", "25.000.000"],
      ],
      "generic",
    );
    expect(analysis.rows).toHaveLength(1);
    expect(analysis.rows[0]?.kind).toBe("data");
  });
});

describe("synonyms", () => {
  it("matches headers without diacritics and English headers", () => {
    expect(
      fieldsOf(
        [
          ["Khach hang", "Ngay", "So tien"],
          ["A", "15/08/2026", "1.000.000"],
        ],
        "incomingCash",
      ),
    ).toEqual(["customerName", "date", "amount"]);
    expect(
      fieldsOf(
        [
          [
            "Customer",
            "Invoice No",
            "Payment date",
            "Amount",
            "Currency",
            "Bank ref",
          ],
          ["A", "INV-1", "15/08/2026", "1,000.00", "USD", "FT123"],
        ],
        "incomingCash",
      ),
    ).toEqual([
      "customerName",
      "invoiceNumber",
      "date",
      "amount",
      "currency",
      "bankRef",
    ]);
  });

  it("reads 'Đã thu' per template and 'Còn lại' as ignore for incoming cash", () => {
    const grid: Cellish[][] = [
      ["Khách hàng", "Đã thu", "Còn lại"],
      ["A", "1.000.000", "2.000.000"],
    ];
    expect(fieldsOf(grid, "incomingCash")).toEqual([
      "customerName",
      "amount",
      "ignore",
    ]);
    expect(fieldsOf(grid, "receivables")).toEqual([
      "customerName",
      "received",
      "outstanding",
    ]);
  });

  it("maps 'Số tiền' in a receivables sheet to outstanding only when it is the sole money column", () => {
    expect(
      fieldsOf(
        [
          ["Khách hàng", "Số tiền"],
          ["A", "1.000.000"],
        ],
        "receivables",
      ),
    ).toEqual(["customerName", "outstanding"]);
    expect(
      fieldsOf(
        [
          ["Khách hàng", "Số tiền", "Dư nợ"],
          ["A", "1.000.000", "500.000"],
        ],
        "receivables",
      ),
    ).toEqual(["customerName", "invoiced", "outstanding"]);
  });

  it("prefers the longest synonym and the trailing token", () => {
    expect(matchHeader("Ngày thanh toán", "incomingCash")?.field).toBe("date");
    expect(matchHeader("Hạn thanh toán", "receivables")?.field).toBe("dueDate");
    expect(matchHeader("Hình thức thanh toán", "incomingCash")?.field).toBe(
      "method",
    );
    expect(matchHeader("Số tiền còn lại", "receivables")?.field).toBe(
      "outstanding",
    );
    expect(matchHeader("Số tiền (VND)", "incomingCash")).toMatchObject({
      field: "amount",
      kind: "leading",
    });
    expect(matchHeader("Mã khách hàng", "generic")?.field).toBe("customerCode");
    expect(matchHeader("STT", "generic")?.field).toBe("ignore");
    expect(matchHeader("#", "generic")?.field).toBe("ignore");
    expect(matchHeader("TM/CK", "incomingCash")?.field).toBe("method");
    expect(matchHeader("Đơn vị tiền", "incomingCash")?.field).toBe("currency");
    expect(matchHeader("Đơn vị", "incomingCash")?.field).toBe("customerName");
    expect(matchHeader("Bất kỳ", "incomingCash")).toBeNull();
  });

  it("lists template-specific groups before the shared ones", () => {
    const groups = headerSynonyms("receivables");
    expect(groups[0]?.field).toBe("outstanding");
    expect(groups.some((group) => group.field === "orderCode")).toBe(true);
    expect(headerSynonyms("incomingCash")[0]?.field).toBe("amount");
  });

  it("treats 'ID' as ignore only over small integers", () => {
    expect(
      fieldsOf(
        [
          ["ID", "Khách hàng", "Số tiền"],
          [1, "A", "1.000.000"],
          [2, "B", "2.000.000"],
        ],
        "incomingCash",
      )[0],
    ).toBe("ignore");
    expect(
      fieldsOf(
        [
          ["ID", "Khách hàng", "Số tiền"],
          ["RD-20260906-E2E1", "A", "1.000.000"],
        ],
        "incomingCash",
      )[0],
    ).toBe("orderCode");
  });
});

describe("mapping proposal", () => {
  it("suggests a multiplier from the header without applying it", () => {
    const { proposal, mapping } = propose(
      [
        ["Khách hàng", "Ngày", "Số tiền (nghìn đồng)"],
        ["A", "15/08/2026", "1.250"],
      ],
      "incomingCash",
    );
    expect(proposal.columns[2]).toMatchObject({
      field: "amount",
      suggestedMultiplier: "1000",
      inferredStyle: "unknown",
    });
    expect(mapping.columns[2]?.unitMultiplier).toBe("1");
    expect(multiplierHintOf("ĐVT: 1.000 đ")).toBe("1000");
    expect(multiplierHintOf("Số tiền (triệu đồng)")).toBe("1000000");
    expect(multiplierHintOf("Đơn vị: 1.000.000 đồng")).toBe("1000000");
    expect(multiplierHintOf("Ngân hàng")).toBeNull();
    expect(multiplierHintOf("Số tiền")).toBeNull();
  });

  it("takes a title-line unit for every money column", () => {
    const { proposal } = propose(
      [
        ["BÁO CÁO CÔNG NỢ (ĐVT: nghìn đồng)"],
        ["Khách hàng", "Dư đầu", "Dư nợ"],
        ["A", "1.250", "2.500"],
      ],
      "receivables",
    );
    expect(
      proposal.columns.map((column) => column.suggestedMultiplier),
    ).toEqual(["1", "1000", "1000"]);
    expect(proposal.titleLines).toEqual(["BÁO CÁO CÔNG NỢ (ĐVT: nghìn đồng)"]);
  });

  it("reports fixed currencies, styles, date evidence, samples and confidence", () => {
    const { proposal, mapping } = propose(
      [
        ["Khách hàng", "Ngày", "Số tiền (USD)", "Ghi chú"],
        ["A", "05/06/2026", "1,250.00", "x"],
        ["B", "07/06/2026", "3,000.50", "x"],
        ["C", "08/06/2026", "", "y"],
        ["D", "09/06/2026", "", "z"],
      ],
      "incomingCash",
    );
    expect(proposal.headerFound).toBe(true);
    expect(proposal.headerSheetRowNumber).toBe(1);
    expect(proposal.columns[1]).toMatchObject({
      field: "date",
      inferredDateOrder: "assumed",
    });
    expect(proposal.columns[2]).toMatchObject({
      field: "amount",
      confidence: "medium",
      inferredStyle: "en",
      inferredDateOrder: null,
    });
    expect(proposal.columns[3]?.sampleValues).toEqual(["x", "y", "z"]);
    expect(proposal.columns[0]?.confidence).toBe("high");
    expect(mapping.columns[2]?.fixedCurrency).toBe("USD");
    expect(mapping.defaultCurrency).toBe("USD");
    expect(mapping.compareSellingPrice).toBe(false);
    expect(fixedCurrencyOf("Số tiền (đ)")).toBe("VND");
    expect(fixedCurrencyOf("Amount ($)")).toBe("USD");
    expect(fixedCurrencyOf("Đã thu")).toBeNull();
    expect(fixedCurrencyOf("VND / USD")).toBeNull();
  });

  it("defaults to VND and reports date-order evidence", () => {
    const { proposal, mapping } = propose(
      [
        ["Khách hàng", "Ngày", "Số tiền"],
        ["A", "15/08/2026", "25.000.000"],
      ],
      "incomingCash",
    );
    expect(mapping.defaultCurrency).toBe("VND");
    expect(proposal.columns[1]?.inferredDateOrder).toBe("dmy");
    expect(proposal.columns[2]?.inferredStyle).toBe("vi");
  });

  it("flags conflicting date evidence", () => {
    const { proposal } = propose(
      [
        ["Khách hàng", "Ngày", "Số tiền"],
        ["A", "15/08/2026", "1"],
        ["B", "08/15/2026", "2"],
      ],
      "incomingCash",
    );
    expect(proposal.columns[1]?.inferredDateOrder).toBe("conflict");
  });

  it("proposes from value shapes when no header exists", () => {
    const { analysis, proposal, mapping } = propose(
      [
        ["RD-20260906-E2E1", "Cty A", "15/08/2026", "25.000.000"],
        ["RD-20260906-E2E2", "Cty B", "16/08/2026", "1.000.000"],
        ["RD-20260906-E2E3", "Cty C", "17/08/2026", "2.000.000"],
      ],
      "generic",
    );
    expect(analysis.headerRowOffset).toBeNull();
    expect(analysis.issues).toContainEqual(
      expect.objectContaining({ code: "HEADER_NOT_FOUND", params: { n: 1 } }),
    );
    expect(analysis.rows).toHaveLength(3);
    expect(analysis.titleLines).toEqual([]);
    expect(proposal.headerFound).toBe(false);
    expect(proposal.headerSheetRowNumber).toBeNull();
    expect(proposal.columns.map((column) => column.field)).toEqual([
      "orderCode",
      "ignore",
      "date",
      "amount",
    ]);
    expect(
      proposal.columns.every((column) => column.confidence === "low"),
    ).toBe(true);
    expect(mapping.columns).toHaveLength(4);
  });

  it("demotes a duplicate field to ignore so the proposal never conflicts with itself", () => {
    const { proposal } = propose(
      [
        ["Khách hàng", "Ngày", "Số tiền", "Thành tiền"],
        ["A", "15/08/2026", "1.000", "1.000"],
      ],
      "incomingCash",
    );
    expect(proposal.columns.map((column) => column.field)).toEqual([
      "customerName",
      "date",
      "amount",
      "ignore",
    ]);
  });
});

describe("row classification", () => {
  it("names the last totals row, mid-sheet subtotals and group labels", () => {
    const { analysis } = propose(
      [
        cashHeader,
        ["", "Khách hàng miền Bắc", "", "", ""],
        [1, "Cty A", "15/08/2026", "25.000.000", ""],
        ["", "Cộng Cty A", "", "25.000.000", ""],
        [2, "Cty B", "16/08/2026", "1.000.000", ""],
        ["", "Tổng cộng", "", "26.000.000", ""],
        [],
        ["", "Người lập", "", "Kế toán trưởng", "Giám đốc"],
        ["", "(Ký, ghi rõ họ tên)", "", "", ""],
      ],
      "incomingCash",
    );
    expect(analysis.rows.map((row) => row.kind)).toEqual([
      "group",
      "data",
      "subtotal",
      "data",
      "total",
    ]);
    expect(analysis.rows.map((row) => row.index)).toEqual([0, 1, 2, 3, 4]);
    expect(analysis.dataRowCount).toBe(2);
    expect(analysis.issues).toContainEqual(
      expect.objectContaining({ code: "GROUP_ROWS_SKIPPED", params: { n: 2 } }),
    );
  });

  it("keeps a customer called 'Tổng công ty …' as data", () => {
    const { analysis } = propose(
      [cashHeader, [1, "Tổng công ty Sông Đà", "15/08/2026", "25.000.000", ""]],
      "incomingCash",
    );
    expect(analysis.rows[0]?.kind).toBe("data");
  });

  it("stores blank rows inside the region and ends it after three blank rows", () => {
    const { analysis } = propose(
      [
        cashHeader,
        [1, "Cty A", "15/08/2026", "25.000.000", ""],
        [],
        [2, "Cty B", "16/08/2026", "1.000.000", ""],
        [],
        [],
        [],
        ["Bảng khác", "x", "y", "z", "w"],
      ],
      "incomingCash",
    );
    expect(analysis.rows.map((row) => row.kind)).toEqual([
      "data",
      "blank",
      "data",
    ]);
    expect(analysis.issues).toContainEqual(
      expect.objectContaining({
        code: "TRAILING_CONTENT_IGNORED",
        params: { n: 3 },
      }),
    );
  });

  it("counts hidden data rows", () => {
    const analysis = analyzeSheet(
      sheetOf(
        [cashHeader, ...cashRows, [3, "Cty C", "17/08/2026", "5.000", ""]],
        {
          hiddenRows: [2, 3],
        },
      ),
      "incomingCash",
    );
    expect(analysis.rows.map((row) => row.hidden)).toEqual([false, true, true]);
    expect(analysis.issues).toContainEqual(
      expect.objectContaining({ code: "HIDDEN_ROWS", params: { n: 2 } }),
    );
  });

  it("throws FILE_TOO_MANY_ROWS above the data cap", () => {
    const grid: Cellish[][] = [
      cashHeader,
      ...Array.from({ length: limits.maxRows + 1 }, (_unused, index) => [
        index + 1,
        `Cty ${index}`,
        "15/08/2026",
        "1.000.000",
        "",
      ]),
    ];
    let caught: unknown;
    try {
      analyzeSheet(sheetOf(grid), "incomingCash");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SheetCheckError);
    expect((caught as SheetCheckError).code).toBe("FILE_TOO_MANY_ROWS");
  });

  it("does not turn single-cell rows of a narrow sheet into groups", () => {
    const { analysis } = propose(
      [["Mã đơn"], ["RD-20260906-E2E1"], ["RD-20260906-E2E2"]],
      "generic",
    );
    expect(analysis.headerRowOffset).toBe(0);
    expect(analysis.rows.map((row) => row.kind)).toEqual(["data", "data"]);
  });
});

describe("validateMapping", () => {
  const rows = analyzeSheet(
    sheetOf([cashHeader, ...cashRows]),
    "incomingCash",
  ).rows;

  it("accepts a complete mapping", () => {
    const mapping = mappingOf([
      { columnIndex: 1, field: "customerName" },
      { columnIndex: 2, field: "date" },
      { columnIndex: 3, field: "amount" },
    ]);
    expect(validateMapping(mapping, "incomingCash", rows)).toEqual([]);
  });

  it("reports a missing required column and a missing identity", () => {
    const noDate = mappingOf([
      { columnIndex: 1, field: "customerName" },
      { columnIndex: 3, field: "amount" },
    ]);
    expect(validateMapping(noDate, "incomingCash", rows)).toEqual([
      expect.objectContaining({
        code: "REQUIRED_COLUMN_MISSING",
        params: { fields: "Ngày" },
      }),
    ]);
    const noIdentity = mappingOf([
      { columnIndex: 2, field: "date" },
      { columnIndex: 3, field: "amount" },
    ]);
    const issues = validateMapping(noIdentity, "incomingCash", rows);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("REQUIRED_COLUMN_MISSING");
    expect(String(issues[0]?.params.fields)).toContain("Tên khách");
    const generic = validateMapping(
      mappingOf([{ columnIndex: 1, field: "customerName" }]),
      "generic",
      rows,
    );
    expect(generic).toEqual([
      expect.objectContaining({
        code: "REQUIRED_COLUMN_MISSING",
        params: { fields: "Mã đơn" },
      }),
    ]);
  });

  it("reports the same field on two columns unless they are money columns fixed to different currencies", () => {
    const twice = mappingOf([
      { columnIndex: 1, field: "customerName" },
      { columnIndex: 2, field: "date" },
      { columnIndex: 3, field: "amount" },
      { columnIndex: 4, field: "amount" },
    ]);
    expect(validateMapping(twice, "incomingCash", rows)).toEqual([
      expect.objectContaining({
        code: "MAPPING_CONFLICT",
        params: { a: "D", b: "E", field: "Số tiền" },
      }),
    ]);
    const fixed = mappingOf([
      { columnIndex: 1, field: "customerName" },
      { columnIndex: 2, field: "date" },
      { columnIndex: 3, field: "amount", fixedCurrency: "VND" },
      { columnIndex: 4, field: "amount", fixedCurrency: "USD" },
    ]);
    expect(validateMapping(fixed, "incomingCash", rows)).toEqual([]);
  });

  it("ignores template-irrelevant fields and out-of-range columns", () => {
    const mapping = mappingOf([
      { columnIndex: 0, field: "orderCode" },
      { columnIndex: 1, field: "outstanding" },
      { columnIndex: 2, field: "outstanding" },
      { columnIndex: 99, field: "date" },
    ]);
    expect(validateMapping(mapping, "generic", rows)).toEqual([]);
  });

  it("blocks a date column whose values prove both orders until one is chosen", () => {
    const conflictRows = analyzeSheet(
      sheetOf([
        ["Khách hàng", "Ngày", "Số tiền"],
        ["A", "15/08/2026", "1"],
        ["B", "08/15/2026", "2"],
      ]),
      "incomingCash",
    ).rows;
    const open = mappingOf([
      { columnIndex: 0, field: "customerName" },
      { columnIndex: 1, field: "date" },
      { columnIndex: 2, field: "amount" },
    ]);
    expect(validateMapping(open, "incomingCash", conflictRows)).toEqual([
      expect.objectContaining({
        code: "DATE_ORDER_CONFLICT",
        columnIndex: 1,
        params: { header: "B" },
      }),
    ]);
    const chosen = mappingOf([
      { columnIndex: 0, field: "customerName" },
      { columnIndex: 1, field: "date", dateOrder: "dmy" },
      { columnIndex: 2, field: "amount" },
    ]);
    expect(validateMapping(chosen, "incomingCash", conflictRows)).toEqual([]);
  });
});
