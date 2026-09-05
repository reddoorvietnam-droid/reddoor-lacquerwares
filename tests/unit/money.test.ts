import { describe, expect, it } from "vitest";

import {
  add,
  allocate,
  compare,
  convert,
  equals,
  isNegative,
  isZero,
  money,
  MoneyError,
  multiply,
  negate,
  percentageOf,
  subtract,
  sum,
  supportedCurrencies,
  zero,
  type Currency,
  type ExchangeRateSnapshot,
  type Money,
} from "@/lib/money";

const capturedAt = new Date("2026-08-25T02:00:00.000Z");

function snapshot(
  from: Currency,
  to: Currency,
  rate: string,
): ExchangeRateSnapshot {
  return { from, to, rate, capturedAt, source: "vietcombank" };
}

function total(parts: readonly Money[], currency: Currency): string {
  return sum(parts, currency).amount;
}

describe("money construction", () => {
  it("quantizes an in-scale amount to the currency scale", () => {
    expect(money("1250", "VND")).toEqual({ amount: "1250", currency: "VND" });
    expect(money("1250.5", "USD")).toEqual({
      amount: "1250.50",
      currency: "USD",
    });
    expect(money("-0.01", "USD")).toEqual({ amount: "-0.01", currency: "USD" });
    expect(money("  12.50  ", "USD").amount).toBe("12.50");
  });

  it.each([
    ["1250.5", "VND"],
    ["0.1", "VND"],
    ["1250.005", "USD"],
    ["0.001", "USD"],
  ])(
    "rejects %s as %s because it exceeds the currency scale",
    (amount, currency) => {
      expect(() => money(amount, currency)).toThrow(MoneyError);
    },
  );

  it.each(["1,250.00", "1e3", "12.50 USD", "", "abc", "--1.00", "1."])(
    "rejects the non-decimal string %j",
    (amount) => {
      expect(() => money(amount, "USD")).toThrow(MoneyError);
    },
  );

  it("rejects an unsupported currency, including the retired EUR", () => {
    expect(() => money("10.00", "GBP")).toThrow(MoneyError);
    expect(() => money("10.00", "EUR")).toThrow(MoneyError);
  });

  it("builds a zero for every supported currency", () => {
    expect(supportedCurrencies.map((currency) => zero(currency))).toEqual([
      { amount: "0", currency: "VND" },
      { amount: "0.00", currency: "USD" },
    ]);
  });
});

describe("money arithmetic", () => {
  it("adds, subtracts, negates, and sums", () => {
    expect(add(money("1250.25", "USD"), money("99.80", "USD")).amount).toBe(
      "1350.05",
    );
    expect(
      subtract(money("1250.25", "USD"), money("99.80", "USD")).amount,
    ).toBe("1150.45");
    expect(negate(money("1250.25", "USD")).amount).toBe("-1250.25");
    expect(
      sum(
        [money("1000", "VND"), money("2500", "VND"), money("-500", "VND")],
        "VND",
      ),
    ).toEqual({ amount: "3000", currency: "VND" });
    expect(sum([], "USD").amount).toBe("0.00");
  });

  it("avoids the classic binary floating point error", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sum([money("0.10", "USD"), money("0.20", "USD")], "USD")).toEqual({
      amount: "0.30",
      currency: "USD",
    });
    expect(
      sum(
        Array.from({ length: 10 }, () => money("0.10", "USD")),
        "USD",
      ).amount,
    ).toBe("1.00");
  });

  it("refuses to combine two currencies", () => {
    expect(() => add(money("1.00", "USD"), money("1", "VND"))).toThrow(
      MoneyError,
    );
    expect(() => subtract(money("1.00", "USD"), money("1", "VND"))).toThrow(
      MoneyError,
    );
    expect(() => compare(money("1.00", "USD"), money("1", "VND"))).toThrow(
      MoneyError,
    );
  });

  it("rounds a multiplication once, at the end", () => {
    // 0.6 VND would vanish if the factor were applied against an already
    // quantized intermediate; it is carried at full precision and rounded once.
    expect(multiply(money("1", "VND"), "0.6").amount).toBe("1");
    expect(multiply(money("100", "VND"), "0.333333333").amount).toBe("33");
    expect(multiply(money("19.99", "USD"), "3").amount).toBe("59.97");
    expect(multiply(money("0.01", "USD"), "3.5").amount).toBe("0.04");
    expect(() => multiply(money("10.00", "USD"), "3,5")).toThrow(MoneyError);
  });

  it("applies a percentage with a single final rounding", () => {
    expect(percentageOf(money("2500", "VND"), "8.25").amount).toBe("206");
    expect(percentageOf(money("1", "VND"), "60").amount).toBe("1");
    expect(percentageOf(money("1999.99", "USD"), "7.5").amount).toBe("150.00");
    expect(percentageOf(money("1250.00", "USD"), "0").amount).toBe("0.00");
  });

  // A percentage small enough that dividing by 100 would render in exponential
  // notation must still be applied, not rejected as a malformed factor.
  it("applies a percentage whose divided factor is below the exponential threshold", () => {
    expect(percentageOf(money("1000000.00", "USD"), "0.00001").amount).toBe(
      "0.10",
    );
    expect(percentageOf(money("100000000", "VND"), "0.0000001").amount).toBe(
      "0",
    );
  });

  it("rejects a percentage that is not a decimal string", () => {
    expect(() => percentageOf(money("100.00", "USD"), "7,5")).toThrow(
      MoneyError,
    );
    expect(() => percentageOf(money("100.00", "USD"), "1e-7")).toThrow(
      MoneyError,
    );
  });
});

describe("money allocation", () => {
  it.each([
    ["10.00", "USD", 2],
    ["10.00", "USD", 3],
    ["100", "VND", 3],
    ["100", "VND", 4],
    ["-10.00", "USD", 3],
    ["-100", "VND", 3],
    ["0.05", "USD", 7],
  ] as const)(
    "splits %s %s into %i parts without losing or inventing a minor unit",
    (amount, currency, parts) => {
      const value = money(amount, currency);
      const shares = allocate(value, parts);

      expect(shares).toHaveLength(parts);
      expect(shares.every((share) => share.currency === currency)).toBe(true);
      expect(total(shares, currency)).toBe(value.amount);
    },
  );

  it("distributes the remainder to the leading shares", () => {
    expect(
      allocate(money("10.00", "USD"), 3).map((share) => share.amount),
    ).toEqual(["3.34", "3.33", "3.33"]);
    expect(
      allocate(money("100", "VND"), 3).map((share) => share.amount),
    ).toEqual(["34", "33", "33"]);
    expect(
      allocate(money("-10.00", "USD"), 3).map((share) => share.amount),
    ).toEqual(["-3.34", "-3.33", "-3.33"]);
    expect(
      allocate(money("10.00", "USD"), 2).map((share) => share.amount),
    ).toEqual(["5.00", "5.00"]);
  });

  it("rejects a nonsensical number of parts", () => {
    expect(() => allocate(money("10.00", "USD"), 0)).toThrow(MoneyError);
    expect(() => allocate(money("10.00", "USD"), 2.5)).toThrow(MoneyError);
  });
});

describe("money conversion", () => {
  it("uses the rate stored on the snapshot", () => {
    expect(
      convert(money("100.00", "USD"), snapshot("USD", "VND", "25400.5")),
    ).toEqual({ amount: "2540050", currency: "VND" });
    expect(
      convert(money("2540050", "VND"), snapshot("VND", "USD", "0.0000394"))
        .amount,
    ).toBe("100.08");
  });

  it("refuses a snapshot that does not convert the value's currency", () => {
    expect(() =>
      convert(money("100", "VND"), snapshot("USD", "VND", "25400.5")),
    ).toThrow(MoneyError);
  });
});

describe("money comparison", () => {
  it("orders two amounts of the same currency", () => {
    expect(compare(money("1.00", "USD"), money("2.00", "USD"))).toBe(-1);
    expect(compare(money("2.00", "USD"), money("1.00", "USD"))).toBe(1);
    expect(compare(money("2.00", "USD"), money("2", "USD"))).toBe(0);
  });

  it("treats a different currency as unequal instead of comparable", () => {
    expect(equals(money("1.00", "USD"), money("1.00", "USD"))).toBe(true);
    expect(equals(money("1.00", "USD"), money("1", "VND"))).toBe(false);
  });

  it("reports zero and negative amounts", () => {
    expect(isZero(zero("VND"))).toBe(true);
    expect(isZero(money("0", "USD"))).toBe(true);
    expect(isZero(money("0.01", "USD"))).toBe(false);
    expect(isNegative(money("-0.01", "USD"))).toBe(true);
    expect(isNegative(money("0.01", "USD"))).toBe(false);
    expect(isNegative(zero("USD"))).toBe(false);
  });
});
