import { Decimal } from "decimal.js";

/**
 * Reads a VND amount in Vietnamese words, the way the "Bằng chữ" line of a
 * printed slip does. Northern reading: "linh" for a skipped tens digit
 * ("một trăm linh năm"), "mốt"/"tư"/"lăm" after a tens digit, "không trăm"
 * when a higher group exists. Amounts are rounded half-up to whole đồng.
 */

const digits = [
  "không",
  "một",
  "hai",
  "ba",
  "bốn",
  "năm",
  "sáu",
  "bảy",
  "tám",
  "chín",
] as const;

const groupUnits = ["", " nghìn", " triệu", " tỷ"] as const;

/** 0..999. `full` spells the leading "không trăm" when a higher group exists. */
function readTriple(value: number, full: boolean): string {
  const hundreds = Math.floor(value / 100);
  const tens = Math.floor((value % 100) / 10);
  const units = value % 10;
  const parts: string[] = [];
  if (hundreds > 0 || full) parts.push(`${digits[hundreds]} trăm`);
  if (tens === 0) {
    if (units > 0) {
      if (hundreds > 0 || full) parts.push("linh");
      parts.push(digits[units]!);
    }
  } else if (tens === 1) {
    parts.push("mười");
    if (units === 5) parts.push("lăm");
    else if (units > 0) parts.push(digits[units]!);
  } else {
    parts.push(`${digits[tens]} mươi`);
    if (units === 1) parts.push("mốt");
    else if (units === 4) parts.push("tư");
    else if (units === 5) parts.push("lăm");
    else if (units > 0) parts.push(digits[units]!);
  }
  return parts.join(" ");
}

/** Groups of three digits, most significant first; recursion above 10^12. */
function readGroups(groups: readonly number[], higherNonZero: boolean): string {
  const count = groups.length;
  if (count > 4) {
    const high = groups.slice(0, count - 3);
    const low = groups.slice(count - 3);
    const highText = `${readGroups(high, higherNonZero)} tỷ`;
    return low.some((group) => group > 0)
      ? `${highText} ${readGroups(low, true)}`
      : highText;
  }
  const parts: string[] = [];
  groups.forEach((group, index) => {
    if (group === 0) return;
    const anyHigher =
      higherNonZero || groups.slice(0, index).some((value) => value > 0);
    parts.push(
      `${readTriple(group, anyHigher)}${groupUnits[count - 1 - index]}`,
    );
  });
  return parts.join(" ");
}

/** Whole non-negative integer given as a digit string. */
export function readVietnameseInteger(integerDigits: string): string {
  const trimmed = integerDigits.replace(/^0+(?=\d)/, "");
  if (!/^\d+$/.test(trimmed)) {
    throw new Error("readVietnameseInteger expects a digit string.");
  }
  if (trimmed === "0") return digits[0];
  const padded = trimmed.padStart(Math.ceil(trimmed.length / 3) * 3, "0");
  const groups = Array.from({ length: padded.length / 3 }, (_, index) =>
    Number(padded.slice(index * 3, index * 3 + 3)),
  );
  return readGroups(groups, false);
}

/**
 * "865000" → "Tám trăm sáu mươi lăm nghìn đồng". Decimal strings only; the
 * value is rounded half-up to the đồng before reading.
 */
export function vndInWords(amount: string): string {
  const value = new Decimal(amount.trim());
  if (!value.isFinite()) throw new Error("Amount must be finite.");
  const rounded = value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const words = readVietnameseInteger(rounded.abs().toFixed(0));
  const signed =
    rounded.isNegative() && !rounded.isZero() ? `âm ${words}` : words;
  return `${signed.charAt(0).toUpperCase()}${signed.slice(1)} đồng`;
}
