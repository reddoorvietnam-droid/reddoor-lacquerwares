import { describe, expect, it } from "vitest";

import type { SheetCell } from "@/domains/sheet-checks/contracts";
import type { IssueCode } from "@/domains/sheet-checks/issues";
import {
  feeToleranceFor,
  inferColumnStyle,
  moneyText,
  parseCurrencyText,
  parseMoneyCell,
  withinFeeTolerance,
  type MoneyParseContext,
} from "@/domains/sheet-checks/parsing/money";
import { money } from "@/lib/money";

function cell(overrides: Partial<SheetCell>): SheetCell {
  return {
    text: "",
    type: "z",
    number: null,
    numberFormat: null,
    formula: false,
    noCache: false,
    mergedFill: false,
    truncated: false,
    ...overrides,
  };
}

function textCell(text: string): SheetCell {
  return cell({ text, type: "s" });
}

function numberCell(
  number: number,
  numberFormat: string | null = null,
  text: string = String(number),
): SheetCell {
  return cell({ text, type: "n", number, numberFormat });
}

function context(
  overrides: Partial<MoneyParseContext> = {},
): MoneyParseContext {
  return {
    unitMultiplier: "1",
    columnStyle: "unknown",
    fixedCurrency: null,
    currencyCellText: null,
    defaultCurrency: "VND",
    template: "incomingCash",
    field: "amount",
    ...overrides,
  };
}

function codesOf(result: {
  issues: readonly { code: IssueCode }[];
}): IssueCode[] {
  return result.issues.map((entry) => entry.code);
}

function parseText(text: string, overrides: Partial<MoneyParseContext> = {}) {
  return parseMoneyCell(textCell(text), context(overrides));
}

type TextCase = {
  text: string;
  ctx?: Partial<MoneyParseContext>;
  amount: string | null;
  currency?: "VND" | "USD" | null;
  codes: IssueCode[];
  style?: "vi" | "en" | null;
};

describe("parseMoneyCell — text cells, decision table", () => {
  const cases: TextCase[] = [
    {
      text: "1.250.000",
      amount: "1250000",
      currency: "VND",
      codes: [],
      style: "vi",
    },
    {
      text: "1.250.000",
      ctx: { defaultCurrency: "USD" },
      amount: "1250000.00",
      currency: "USD",
      codes: [],
      style: "vi",
    },
    { text: "1.250,50", amount: null, codes: ["AMOUNT_SCALE"], style: "vi" },
    {
      text: "1.250,50",
      ctx: { defaultCurrency: "USD" },
      amount: "1250.50",
      currency: "USD",
      codes: [],
      style: "vi",
    },
    {
      text: "1,250.00",
      amount: "1250",
      currency: "VND",
      codes: [],
      style: "en",
    },
    {
      text: "1,250.00",
      ctx: { defaultCurrency: "USD" },
      amount: "1250.00",
      currency: "USD",
      codes: [],
      style: "en",
    },
    { text: "1250", amount: "1250", currency: "VND", codes: [], style: null },
    {
      text: "1250",
      ctx: { defaultCurrency: "USD" },
      amount: "1250.00",
      currency: "USD",
      codes: [],
      style: null,
    },
    { text: "1.25", amount: null, codes: ["AMOUNT_SCALE"], style: "en" },
    {
      text: "1.25",
      ctx: { defaultCurrency: "USD" },
      amount: "1.25",
      currency: "USD",
      codes: [],
      style: "en",
    },
    {
      text: "1.25",
      ctx: { defaultCurrency: "USD", columnStyle: "vi" },
      amount: "1.25",
      currency: "USD",
      codes: [],
      style: "en",
    },
    {
      text: "(500)",
      amount: "-500",
      currency: "VND",
      codes: ["AMOUNT_NEGATIVE", "AMOUNT_UNIT_SUSPECT"],
    },
    {
      text: "-500",
      amount: "-500",
      currency: "VND",
      codes: ["AMOUNT_NEGATIVE", "AMOUNT_UNIT_SUSPECT"],
    },
    {
      text: "1.000-",
      amount: "-1000",
      currency: "VND",
      codes: ["AMOUNT_NEGATIVE"],
    },
    { text: "500 USD", amount: "500.00", currency: "USD", codes: [] },
    {
      text: "500 USD",
      ctx: { currencyCellText: "VND" },
      amount: null,
      currency: null,
      codes: ["CURRENCY_CONFLICT"],
    },
    { text: "$500", amount: "500.00", currency: "USD", codes: [] },
    {
      text: "$100",
      ctx: { currencyCellText: "VND" },
      amount: null,
      codes: ["CURRENCY_CONFLICT"],
    },
    {
      text: "$500",
      ctx: { fixedCurrency: "VND" },
      amount: null,
      codes: ["CURRENCY_CONFLICT"],
    },
    {
      text: "500đ",
      amount: "500",
      currency: "VND",
      codes: ["AMOUNT_UNIT_SUSPECT"],
    },
    {
      text: "500đ",
      ctx: { template: "receivables", field: "outstanding" },
      amount: "500",
      currency: "VND",
      codes: ["AMOUNT_UNIT_SUSPECT"],
    },
    {
      text: "500đ",
      ctx: { template: "generic" },
      amount: "500",
      currency: "VND",
      codes: [],
    },
    { text: "1 250 000", amount: "1250000", currency: "VND", codes: [] },
    { text: "1'250'000", amount: "1250000", currency: "VND", codes: [] },
    { text: "1 25", amount: null, codes: ["AMOUNT_NOT_NUMBER"] },
    {
      text: "12.500",
      amount: "12500",
      currency: "VND",
      codes: [],
      style: null,
    },
    {
      text: "12.500",
      ctx: { defaultCurrency: "USD" },
      amount: "12500.00",
      currency: "USD",
      codes: ["AMOUNT_AMBIGUOUS"],
      style: null,
    },
    {
      text: "12.500",
      ctx: { defaultCurrency: "USD", columnStyle: "en" },
      amount: null,
      codes: ["AMOUNT_SCALE"],
    },
    {
      text: "12.500",
      ctx: { defaultCurrency: "USD", columnStyle: "vi" },
      amount: "12500.00",
      currency: "USD",
      codes: [],
    },
    { text: "12,500", amount: "12500", currency: "VND", codes: [] },
    {
      text: "12,500",
      ctx: { defaultCurrency: "USD" },
      amount: "12500.00",
      currency: "USD",
      codes: ["AMOUNT_AMBIGUOUS"],
    },
    {
      text: "12,500",
      ctx: { defaultCurrency: "USD", columnStyle: "vi" },
      amount: null,
      codes: ["AMOUNT_SCALE"],
    },
    {
      text: "12,500",
      ctx: { defaultCurrency: "USD", columnStyle: "en" },
      amount: "12500.00",
      currency: "USD",
      codes: [],
    },
    { text: "1.250.000,-", amount: "1250000", currency: "VND", codes: [] },
    { text: "25,000,000 VND", amount: "25000000", currency: "VND", codes: [] },
    { text: "25.000.000 VNĐ", amount: "25000000", currency: "VND", codes: [] },
    { text: "25.000.000 đồng", amount: "25000000", currency: "VND", codes: [] },
    { text: "1.250.000d", amount: "1250000", currency: "VND", codes: [] },
    { text: "US$ 1.250,00", amount: "1250.00", currency: "USD", codes: [] },
    { text: "₫1.250.000", amount: "1250000", currency: "VND", codes: [] },
    { text: "+1.250.000", amount: "1250000", currency: "VND", codes: [] },
    { text: "0001250", amount: "1250", currency: "VND", codes: [] },
    { text: "€100", amount: null, codes: ["CURRENCY_UNSUPPORTED"] },
    { text: "100 EUR", amount: null, codes: ["CURRENCY_UNSUPPORTED"] },
    { text: "1.250 đ $", amount: null, codes: ["CURRENCY_CONFLICT"] },
    {
      text: "−1.250.000",
      amount: "-1250000",
      currency: "VND",
      codes: ["AMOUNT_NEGATIVE"],
    },
    {
      text: "1\u00A0250\u00A0000",
      amount: "1250000",
      currency: "VND",
      codes: [],
    },
    { text: "1.250\u200B.000", amount: "1250000", currency: "VND", codes: [] },
  ];

  it.each(cases)("$text → $amount $codes", (entry) => {
    const result = parseText(entry.text, entry.ctx);
    expect(result.blank).toBe(false);
    expect(result.amount).toBe(entry.amount);
    if (entry.currency !== undefined) {
      expect(result.currency).toBe(entry.currency);
    }
    if (entry.style !== undefined) expect(result.style).toBe(entry.style);
    expect(codesOf(result)).toEqual(entry.codes);
  });

  it.each([
    "1.2.3",
    "1.25.000",
    "1,25,000",
    "12.345.67",
    "1.250.",
    "1.2500",
    "1.2tr",
    "500k",
    "1e6",
    "12%",
    "≈ 1.000",
    "abc",
    "1 25",
    "VND",
  ])("%s → AMOUNT_NOT_NUMBER", (text) => {
    const result = parseText(text);
    expect(result.amount).toBeNull();
    expect(result.currency).toBeNull();
    expect(codesOf(result)).toEqual(["AMOUNT_NOT_NUMBER"]);
    expect(result.issues[0]?.params).toEqual({ raw: text });
  });

  it("names both readings of an ambiguous USD cell", () => {
    const result = parseText("12.500", { defaultCurrency: "USD" });
    expect(result.issues[0]).toMatchObject({
      code: "AMOUNT_AMBIGUOUS",
      severity: "warn",
      params: { raw: "12.500", asThousands: "12500.00", asDecimal: "12.500" },
    });
  });

  it("treats placeholders as blank without an issue", () => {
    for (const text of [
      "",
      "-",
      "N/A",
      "n/a",
      "–",
      "—",
      "null",
      "none",
      "#N/A",
    ]) {
      const result = parseText(text);
      expect(result).toEqual({
        amount: null,
        currency: null,
        style: null,
        blank: true,
        currencySource: null,
        issues: [],
      });
    }
    expect(parseMoneyCell(cell({}), context()).blank).toBe(true);
    expect(
      parseMoneyCell(
        cell({ type: "n", formula: true, noCache: true }),
        context(),
      ).blank,
    ).toBe(true);
  });

  it("reports where the currency came from", () => {
    expect(parseText("500 USD").currencySource).toBe("cell");
    expect(parseText("500", { currencyCellText: "USD" })).toMatchObject({
      amount: "500.00",
      currency: "USD",
      currencySource: "column",
    });
    expect(parseText("500", { fixedCurrency: "USD" })).toMatchObject({
      amount: "500.00",
      currency: "USD",
      currencySource: "fixed",
    });
    expect(parseText("500", { defaultCurrency: "USD" })).toMatchObject({
      amount: "500.00",
      currencySource: "default",
    });
  });

  it("rejects an unreadable currency column value and a column/header disagreement", () => {
    const invalid = parseText("500", { currencyCellText: "abc" });
    expect(invalid.amount).toBeNull();
    expect(invalid.issues).toEqual([
      expect.objectContaining({
        code: "CURRENCY_INVALID",
        params: { raw: "abc" },
      }),
    ]);
    const conflict = parseText("500", {
      currencyCellText: "USD",
      fixedCurrency: "VND",
    });
    expect(conflict.issues).toEqual([
      expect.objectContaining({
        code: "CURRENCY_CONFLICT",
        params: { a: "USD", b: "VND" },
      }),
    ]);
  });

  it("names the conflicting currencies of a cell against its column", () => {
    const result = parseText("$100", { currencyCellText: "VND" });
    expect(result.issues[0]?.params).toEqual({ a: "USD", b: "VND" });
  });
});

describe("parseMoneyCell — numeric cells", () => {
  it("does not read another country's dollar in a number format as USD", () => {
    for (const format of [
      "[$CA$-1009]#,##0.00",
      "[$A$-C09]#,##0.00",
      "[$S$-1004]#,##0.00",
      "[$HK$-C04]#,##0.00",
    ]) {
      const result = parseMoneyCell(numberCell(1250, format), context());
      expect(result.amount).toBeNull();
      expect(result.issues.map((entry) => entry.code)).toContain(
        "CURRENCY_UNSUPPORTED",
      );
    }
    // The plain US format still reads as USD.
    expect(
      parseMoneyCell(numberCell(1250, "[$$-409]#,##0.00"), context()).currency,
    ).toBe("USD");
  });

  it("compares a value with hidden decimals as displayed and says so", () => {
    const result = parseMoneyCell(
      numberCell(1250000.4, "#,##0", "1,250,000"),
      context(),
    );
    expect(result.amount).toBe("1250000");
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "AMOUNT_HIDDEN_DECIMALS",
        severity: "warn",
        params: { raw: "1250000.4", used: "1250000" },
      }),
    ]);
  });

  it("absorbs binary noise before judging the scale", () => {
    const result = parseMoneyCell(
      numberCell(0.30000000000000004, "0.00", "0.30"),
      context({ defaultCurrency: "USD" }),
    );
    expect(result).toMatchObject({
      amount: "0.30",
      currency: "USD",
      issues: [],
    });
  });

  it("reads the currency from the number format", () => {
    const usd = parseMoneyCell(
      numberCell(1250, "[$$-409]#,##0.00", "$1,250.00"),
      context(),
    );
    expect(usd).toMatchObject({
      amount: "1250.00",
      currency: "USD",
      currencySource: "cell",
      issues: [],
    });
    const vnd = parseMoneyCell(
      numberCell(25000000, "[$₫-42A]#,##0", "₫25,000,000"),
      context({ defaultCurrency: "USD" }),
    );
    expect(vnd).toMatchObject({ amount: "25000000", currency: "VND" });
    const quoted = parseMoneyCell(
      numberCell(1250, '#,##0.00 "USD"'),
      context(),
    );
    expect(quoted).toMatchObject({ amount: "1250.00", currency: "USD" });
  });

  it("ignores locale prefixes and date codes in the number format", () => {
    expect(
      parseMoneyCell(numberCell(1250000, "[$-409]#,##0"), context()),
    ).toMatchObject({ currency: "VND", currencySource: "default" });
    expect(
      parseMoneyCell(
        numberCell(1250000, "dd/mm/yyyy"),
        context({ defaultCurrency: "USD" }),
      ),
    ).toMatchObject({ currency: "USD", currencySource: "default" });
  });

  it("refuses percentages, booleans, errors and huge doubles", () => {
    expect(
      codesOf(parseMoneyCell(numberCell(0.15, "0%", "15%"), context())),
    ).toEqual(["AMOUNT_NOT_NUMBER"]);
    expect(
      codesOf(parseMoneyCell(cell({ type: "b", text: "TRUE" }), context())),
    ).toEqual(["AMOUNT_NOT_NUMBER"]);
    expect(
      codesOf(parseMoneyCell(cell({ type: "e", text: "#REF!" }), context())),
    ).toEqual(["AMOUNT_NOT_NUMBER"]);
    expect(codesOf(parseMoneyCell(numberCell(1e16), context()))).toEqual([
      "AMOUNT_NOT_NUMBER",
    ]);
    expect(codesOf(parseMoneyCell(numberCell(Number.NaN), context()))).toEqual([
      "AMOUNT_NOT_NUMBER",
    ]);
  });

  it("keeps large integers exact", () => {
    expect(parseMoneyCell(numberCell(12345678901), context())).toMatchObject({
      amount: "12345678901",
      issues: [],
    });
  });

  it("flags a numeric cell against an unsupported format currency", () => {
    expect(
      parseMoneyCell(numberCell(100, "[$€-2] #,##0.00"), context()).issues,
    ).toEqual([
      expect.objectContaining({
        code: "CURRENCY_UNSUPPORTED",
        params: { raw: "€" },
      }),
    ]);
  });

  it("checks sign and sanity on numeric cells too", () => {
    expect(codesOf(parseMoneyCell(numberCell(-500), context()))).toEqual([
      "AMOUNT_NEGATIVE",
      "AMOUNT_UNIT_SUSPECT",
    ]);
    expect(codesOf(parseMoneyCell(numberCell(0), context()))).toEqual([
      "AMOUNT_ZERO",
    ]);
  });
});

describe("parseMoneyCell — unit multiplier", () => {
  it("multiplies typed text after parsing", () => {
    expect(parseText("1.250", { unitMultiplier: "1000" })).toMatchObject({
      amount: "1250000",
      currency: "VND",
      issues: [],
    });
    expect(parseText("1,5", { unitMultiplier: "1000000" })).toMatchObject({
      amount: "1500000",
      issues: [],
    });
    expect(codesOf(parseText("1,5"))).toEqual(["AMOUNT_SCALE"]);
  });

  it("multiplies numeric cells and still reports hidden decimals", () => {
    const result = parseMoneyCell(
      numberCell(1250.0004, "#,##0", "1,250"),
      context({ unitMultiplier: "1000" }),
    );
    expect(result.amount).toBe("1250000");
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "AMOUNT_HIDDEN_DECIMALS",
        params: { raw: "1250000.4", used: "1250000" },
      }),
    ]);
  });

  it("states the ambiguous USD readings in the multiplied unit", () => {
    const result = parseText("12.500", {
      defaultCurrency: "USD",
      unitMultiplier: "1000",
    });
    expect(result.amount).toBe("12500000.00");
    expect(result.issues[0]?.params).toEqual({
      raw: "12.500",
      asThousands: "12500000.00",
      asDecimal: "12.500",
    });
  });
});

describe("parseMoneyCell — sanity thresholds", () => {
  it("suspects a unit problem for tiny VND amounts in money templates only", () => {
    expect(codesOf(parseText("500"))).toEqual(["AMOUNT_UNIT_SUSPECT"]);
    expect(
      codesOf(
        parseText("500", { template: "receivables", field: "outstanding" }),
      ),
    ).toEqual(["AMOUNT_UNIT_SUSPECT"]);
    expect(codesOf(parseText("500", { template: "generic" }))).toEqual([]);
    expect(codesOf(parseText("5", { defaultCurrency: "USD" }))).toEqual([]);
  });

  it("flags implausible magnitudes per currency", () => {
    expect(codesOf(parseText("25.000.000.000.000"))).toEqual([
      "AMOUNT_IMPLAUSIBLE",
    ]);
    expect(codesOf(parseText("10.000.000.000.000"))).toEqual([]);
    expect(
      codesOf(
        parseText("2,000,000,000", {
          defaultCurrency: "USD",
          template: "receivables",
          field: "outstanding",
        }),
      ),
    ).toEqual(["AMOUNT_IMPLAUSIBLE"]);
    expect(
      codesOf(parseText("25.000.000.000.000", { template: "generic" })),
    ).toEqual([]);
  });

  it("grades a zero amount by template", () => {
    const cash = parseText("0");
    expect(cash.amount).toBe("0");
    expect(cash.issues).toEqual([
      expect.objectContaining({ code: "AMOUNT_ZERO", severity: "warn" }),
    ]);
    expect(parseText("(0)").amount).toBe("0");
    expect(parseText("0", { template: "generic" }).issues).toEqual([
      expect.objectContaining({ code: "AMOUNT_ZERO", severity: "info" }),
    ]);
    expect(
      parseText("0", { template: "receivables", field: "outstanding" }).issues,
    ).toEqual([
      expect.objectContaining({ code: "AMOUNT_ZERO", severity: "info" }),
    ]);
  });

  it("flags negative amounts only for incoming cash", () => {
    expect(
      codesOf(
        parseText("-5.000.000", {
          template: "receivables",
          field: "outstanding",
        }),
      ),
    ).toEqual([]);
    expect(codesOf(parseText("-5.000.000", { template: "generic" }))).toEqual(
      [],
    );
    expect(codesOf(parseText("-5.000.000"))).toEqual(["AMOUNT_NEGATIVE"]);
  });
});

describe("inferColumnStyle", () => {
  it.each([
    { cells: ["1.250.000,00", "1.250"], style: "vi" },
    { cells: ["1,250.00", "3,000"], style: "en" },
    { cells: ["1.250", "2.500"], style: "unknown" },
    { cells: ["1.250.000", "1,250.00"], style: "mixed" },
    { cells: ["1.250,5", "1,250.5"], style: "mixed" },
    { cells: ["1.250.000", "abc", "", "-"], style: "vi" },
    { cells: ["25,000,000 VND", "(1,250.50)"], style: "en" },
    { cells: [], style: "unknown" },
  ])("$cells → $style", ({ cells, style }) => {
    expect(inferColumnStyle(cells.map(textCell))).toBe(style);
  });

  it("lets numeric cells and formulas without cache stay silent", () => {
    expect(
      inferColumnStyle([
        numberCell(1250000.5),
        cell({ type: "s", text: "1.250,50", formula: true, noCache: true }),
      ]),
    ).toBe("unknown");
  });

  it("parses a cell by its own form under a column of the other style", () => {
    expect(
      parseText("1,250.00", { columnStyle: "vi", defaultCurrency: "USD" }),
    ).toMatchObject({ amount: "1250.00", style: "en", issues: [] });
    expect(parseText("1.250", { columnStyle: "vi" })).toMatchObject({
      amount: "1250",
      issues: [],
    });
    expect(
      parseText("1.250", { columnStyle: "en", defaultCurrency: "USD" }).issues,
    ).toEqual([expect.objectContaining({ code: "AMOUNT_SCALE" })]);
  });
});

describe("parseCurrencyText", () => {
  it.each([
    ["VND", "VND"],
    ["vnđ", "VND"],
    ["đ", "VND"],
    ["₫", "VND"],
    ["D", "VND"],
    ["USD", "USD"],
    ["$", "USD"],
    ["US$", "USD"],
    ["", null],
    ["-", null],
    ["EUR", "INVALID"],
    ["abc", "INVALID"],
  ] as const)("%s → %s", (text, expected) => {
    expect(parseCurrencyText(text)).toBe(expected);
  });
});

describe("fee tolerance helpers", () => {
  it("renders money as the param form", () => {
    expect(moneyText(money("25000000", "VND"))).toBe("25000000 VND");
    expect(moneyText(money("1250.5", "USD"))).toBe("1250.50 USD");
  });

  it("uses ratio × amount between the floor and the cap", () => {
    expect(feeToleranceFor(money("25000000", "VND"))).toEqual(
      money("125000", "VND"),
    );
    expect(feeToleranceFor(money("1000000", "VND"))).toEqual(
      money("30000", "VND"),
    );
    expect(feeToleranceFor(money("1000000000", "VND"))).toEqual(
      money("500000", "VND"),
    );
    expect(feeToleranceFor(money("1000", "USD"))).toEqual(money("5", "USD"));
    expect(feeToleranceFor(money("1000000", "USD"))).toEqual(
      money("50", "USD"),
    );
    expect(feeToleranceFor(money("-25000000", "VND"))).toEqual(
      money("125000", "VND"),
    );
  });

  it("judges a difference against the system figure", () => {
    expect(
      withinFeeTolerance(money("25001000", "VND"), money("25000000", "VND")),
    ).toBe(true);
    expect(
      withinFeeTolerance(money("24975000", "VND"), money("25000000", "VND")),
    ).toBe(true);
    expect(
      withinFeeTolerance(money("24000000", "VND"), money("25000000", "VND")),
    ).toBe(false);
    expect(
      withinFeeTolerance(money("999000", "VND"), money("1000000", "VND")),
    ).toBe(true);
    expect(
      withinFeeTolerance(money("100000000", "VND"), money("99000000", "VND")),
    ).toBe(false);
    expect(
      withinFeeTolerance(money("100.01", "USD"), money("100.00", "USD")),
    ).toBe(true);
    expect(withinFeeTolerance(money("1000", "USD"), money("1000", "VND"))).toBe(
      false,
    );
  });
});
