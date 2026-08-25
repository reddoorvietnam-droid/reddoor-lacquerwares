import { Decimal } from "decimal.js";

/**
 * Decimal-safe money.
 *
 * JavaScript numbers are never used to hold or compute a monetary value.
 * Amounts are carried as decimal strings and every operation goes through
 * `decimal.js`, so `0.1 + 0.2` problems cannot reach an invoice, a cost report,
 * or a profit figure.
 */

export const supportedCurrencies = ["VND", "USD", "EUR"] as const;
export type Currency = (typeof supportedCurrencies)[number];

/** Minor units used when rounding and formatting each currency. */
const currencyScale: Record<Currency, number> = {
  VND: 0,
  USD: 2,
  EUR: 2,
};

export type Money = {
  /** Decimal string, already rounded to the currency scale. */
  readonly amount: string;
  readonly currency: Currency;
};

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

const AMOUNT_PATTERN = /^-?\d+(\.\d+)?$/;

function assertCurrency(value: string): asserts value is Currency {
  if (!(supportedCurrencies as readonly string[]).includes(value)) {
    throw new MoneyError(`Unsupported currency: ${value}.`);
  }
}

function toDecimal(money: Money): Decimal {
  return new Decimal(money.amount);
}

function quantize(value: Decimal, currency: Currency): string {
  return value
    .toDecimalPlaces(currencyScale[currency], Decimal.ROUND_HALF_UP)
    .toFixed(currencyScale[currency]);
}

/**
 * Builds a Money value from a decimal string. Numbers are rejected on purpose:
 * accepting one would silently reintroduce binary floating point at the boundary.
 */
export function money(amount: string, currency: string): Money {
  assertCurrency(currency);

  const trimmed = amount.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) {
    throw new MoneyError(
      'A money amount must be a plain decimal string such as "1250.00".',
    );
  }

  const value = new Decimal(trimmed);
  if (!value.isFinite()) {
    throw new MoneyError("A money amount must be finite.");
  }

  if (value.decimalPlaces() > currencyScale[currency]) {
    throw new MoneyError(
      `${currency} carries ${currencyScale[currency]} decimal places; round explicitly before constructing the value.`,
    );
  }

  return { amount: quantize(value, currency), currency };
}

export function zero(currency: Currency): Money {
  return { amount: quantize(new Decimal(0), currency), currency };
}

function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) {
    throw new MoneyError(
      `Cannot combine ${left.currency} and ${right.currency}; convert through a stored exchange-rate snapshot first.`,
    );
  }
}

export function add(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return {
    amount: quantize(toDecimal(left).plus(toDecimal(right)), left.currency),
    currency: left.currency,
  };
}

export function subtract(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return {
    amount: quantize(toDecimal(left).minus(toDecimal(right)), left.currency),
    currency: left.currency,
  };
}

export function sum(values: readonly Money[], currency: Currency): Money {
  return values.reduce<Money>(
    (total, value) => add(total, value),
    zero(currency),
  );
}

/**
 * Multiplies by a quantity or a rate expressed as a decimal string. The result
 * is rounded once, at the end, to the currency scale.
 */
export function multiply(value: Money, factor: string): Money {
  const trimmed = factor.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) {
    throw new MoneyError("A multiplication factor must be a decimal string.");
  }

  return scaleBy(value, new Decimal(trimmed));
}

/**
 * Applies a percentage such as a discount, tax, or margin rate.
 *
 * The divided factor stays a Decimal rather than being rendered back to a
 * string: `Decimal.toString` switches to exponential notation for very small
 * values, which a decimal-string factor cannot represent.
 */
export function percentageOf(value: Money, percent: string): Money {
  const trimmed = percent.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) {
    throw new MoneyError("A percentage must be a decimal string.");
  }

  return scaleBy(value, new Decimal(trimmed).dividedBy(100));
}

function scaleBy(value: Money, factor: Decimal): Money {
  return {
    amount: quantize(toDecimal(value).times(factor), value.currency),
    currency: value.currency,
  };
}

export function negate(value: Money): Money {
  return {
    amount: quantize(toDecimal(value).negated(), value.currency),
    currency: value.currency,
  };
}

export function compare(left: Money, right: Money): -1 | 0 | 1 {
  assertSameCurrency(left, right);
  return toDecimal(left).comparedTo(toDecimal(right)) as -1 | 0 | 1;
}

export function equals(left: Money, right: Money): boolean {
  return left.currency === right.currency && compare(left, right) === 0;
}

export function isZero(value: Money): boolean {
  return toDecimal(value).isZero();
}

export function isNegative(value: Money): boolean {
  return toDecimal(value).isNegative();
}

/**
 * Splits an amount into `parts` shares without losing or inventing a minor
 * unit. Any remainder is distributed one minor unit at a time to the leading
 * shares, so the parts always sum back to the original value.
 */
export function allocate(value: Money, parts: number): Money[] {
  if (!Number.isInteger(parts) || parts < 1) {
    throw new MoneyError("An allocation must be split into at least one part.");
  }

  const scale = currencyScale[value.currency];
  const minorUnit = new Decimal(10).toPower(-scale);
  const totalMinor = toDecimal(value).dividedBy(minorUnit).toDecimalPlaces(0);
  const baseMinor = totalMinor
    .dividedBy(parts)
    .toDecimalPlaces(0, Decimal.ROUND_DOWN);
  const remainder = totalMinor.minus(baseMinor.times(parts)).toNumber();

  return Array.from({ length: parts }, (_unused, index) => {
    const shareMinor = baseMinor.plus(
      index < Math.abs(remainder) ? Math.sign(remainder) : 0,
    );
    return {
      amount: quantize(shareMinor.times(minorUnit), value.currency),
      currency: value.currency,
    };
  });
}

export type ExchangeRateSnapshot = {
  readonly from: Currency;
  readonly to: Currency;
  /** Decimal string: one unit of `from` expressed in `to`. */
  readonly rate: string;
  /** The moment the rate was captured. History is never recomputed. */
  readonly capturedAt: Date;
  readonly source: string;
};

/**
 * Converts using a stored snapshot. Historical documents keep the snapshot they
 * were issued with, so a later rate change never silently rewrites the past.
 */
export function convert(value: Money, snapshot: ExchangeRateSnapshot): Money {
  if (value.currency !== snapshot.from) {
    throw new MoneyError(
      `The snapshot converts ${snapshot.from}, not ${value.currency}.`,
    );
  }

  return {
    amount: quantize(
      toDecimal(value).times(new Decimal(snapshot.rate)),
      snapshot.to,
    ),
    currency: snapshot.to,
  };
}

/** Locale-aware presentation. Never used as an intermediate for arithmetic. */
export function formatMoney(value: Money, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
    minimumFractionDigits: currencyScale[value.currency],
    maximumFractionDigits: currencyScale[value.currency],
  }).format(Number(value.amount));
}
