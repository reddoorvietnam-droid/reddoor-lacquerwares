import { SheetCheckError } from "@/domains/sheet-checks/contracts";
import { issue, type Issue } from "@/domains/sheet-checks/issues";

/**
 * CSV intake: bytes → text → grid. A CSV never goes through SheetJS (ADR-005
 * keeps the attack surface to one parser we fully control for plain text),
 * nothing is evaluated ("=HYPERLINK(...)" stays the literal text) and every
 * value stays a string — money and dates are read later by the dedicated
 * parsers, never by the CSV layer.
 */

export type DecodedText = { text: string; issues: Issue[] };

export type CsvDelimiter = "," | ";" | "\t" | "|";

const UTF8_BOM = [0xef, 0xbb, 0xbf] as const;
const UTF16LE_BOM = [0xff, 0xfe] as const;
const UTF16BE_BOM = [0xfe, 0xff] as const;

/** Legacy Vietnamese code page first; Windows-1252 only when the runtime lacks it. */
const FALLBACK_ENCODINGS = ["windows-1258", "windows-1252"] as const;

const REPLACEMENT_CHARACTER = "�";
const C1_CONTROLS = /[\u0080-\u009f]/g;

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((value, index) => bytes[index] === value);
}

/**
 * Decodes with a named encoding. Returns null when the runtime does not know
 * the label or when a fatal decode meets an invalid sequence.
 */
function tryDecode(
  bytes: Uint8Array,
  label: string,
  fatal: boolean,
): string | null {
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(label, { fatal });
  } catch {
    return null;
  }
  try {
    return decoder.decode(bytes);
  } catch {
    return null;
  }
}

function decodeUtf16(
  bytes: Uint8Array,
  label: "utf-16le" | "utf-16be",
): DecodedText {
  // The decoder strips the BOM that matches its own encoding.
  const text = tryDecode(bytes, label, false);
  if (text === null) {
    throw new SheetCheckError(
      "ENCODING_UNKNOWN",
      `The runtime cannot decode ${label}.`,
    );
  }
  return {
    text,
    issues: text.includes(REPLACEMENT_CHARACTER)
      ? [issue("ENCODING_LOSSY")]
      : [],
  };
}

/**
 * UTF-8 (with or without BOM) and UTF-16 with a BOM are read as declared.
 * Anything else is tried as strict UTF-8 first; a failure means a legacy
 * export, read as Windows-1258 with ENCODING_FALLBACK so the reader knows
 * to check the diacritics.
 */
export function decodeCsv(bytes: Uint8Array): DecodedText {
  if (startsWith(bytes, UTF8_BOM)) {
    const body = bytes.subarray(UTF8_BOM.length);
    const strict = tryDecode(body, "utf-8", true);
    if (strict !== null) return { text: strict, issues: [] };
    // The file declares UTF-8; reinterpreting it as a code page would only
    // hide the corruption, so keep UTF-8 and flag the loss.
    const lossy = tryDecode(body, "utf-8", false) ?? "";
    return { text: lossy, issues: [issue("ENCODING_LOSSY")] };
  }
  if (startsWith(bytes, UTF16LE_BOM)) return decodeUtf16(bytes, "utf-16le");
  if (startsWith(bytes, UTF16BE_BOM)) return decodeUtf16(bytes, "utf-16be");

  const utf8 = tryDecode(bytes, "utf-8", true);
  if (utf8 !== null) return { text: utf8, issues: [] };

  for (const label of FALLBACK_ENCODINGS) {
    const decoded = tryDecode(bytes, label, false);
    if (decoded === null) continue;
    // Unassigned code-page bytes come out as U+FFFD per the WHATWG tables,
    // but Node's ICU maps them to C1 controls instead; neither belongs in a
    // report, so both are shown as the replacement character.
    const text = decoded.replace(C1_CONTROLS, REPLACEMENT_CHARACTER);
    const issues: Issue[] = [issue("ENCODING_FALLBACK")];
    if (text.includes(REPLACEMENT_CHARACTER))
      issues.push(issue("ENCODING_LOSSY"));
    return { text, issues };
  }

  throw new SheetCheckError(
    "ENCODING_UNKNOWN",
    "The file is neither UTF-8 nor a supported legacy code page.",
  );
}

const CANDIDATES: readonly CsvDelimiter[] = [",", ";", "\t", "|"];
const DELIMITER_SAMPLE_LINES = 20;
const DECIMAL_COMMA = /\d,\d/;

type LineCounts = Record<CsvDelimiter, number>;

/** Counts each candidate delimiter outside quotes, per logical line. */
function sampleLineCounts(text: string): LineCounts[] {
  const lines: LineCounts[] = [];
  let current: LineCounts = { ",": 0, ";": 0, "\t": 0, "|": 0 };
  let nonEmpty = false;
  let inQuotes = false;

  const endLine = (): void => {
    if (nonEmpty) lines.push(current);
    current = { ",": 0, ";": 0, "\t": 0, "|": 0 };
    nonEmpty = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') inQuotes = false;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      nonEmpty = true;
      continue;
    }
    if (char === "\n" || char === "\r") {
      endLine();
      if (lines.length >= DELIMITER_SAMPLE_LINES) break;
      continue;
    }
    if (char === "," || char === ";" || char === "\t" || char === "|") {
      current[char] += 1;
      nonEmpty = true;
      continue;
    }
    if (char !== " ") nonEmpty = true;
  }
  if (lines.length < DELIMITER_SAMPLE_LINES) endLine();
  return lines;
}

type DelimiterScore = { presence: number; consistency: number; total: number };

function scoreDelimiter(
  lines: readonly LineCounts[],
  delimiter: CsvDelimiter,
): DelimiterScore {
  const counts = lines.map((line) => line[delimiter]);
  const present = counts.filter((count) => count > 0);
  // A real delimiter yields the same field count on most lines; a decimal
  // comma or a comma inside a name does not.
  const frequency = new Map<number, number>();
  for (const count of present)
    frequency.set(count, (frequency.get(count) ?? 0) + 1);
  let consistency = 0;
  for (const value of frequency.values())
    consistency = Math.max(consistency, value);
  return {
    presence: present.length,
    consistency,
    total: present.reduce((sum, count) => sum + count, 0),
  };
}

/**
 * Votes over the first sample lines: the delimiter present on the most lines
 * with the steadiest count wins. A full tie falls back to ";" when decimal
 * commas appear in the text (Vietnamese exports) and to "," otherwise.
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const lines = sampleLineCounts(text);
  const scores = new Map<CsvDelimiter, DelimiterScore>(
    CANDIDATES.map((delimiter) => [
      delimiter,
      scoreDelimiter(lines, delimiter),
    ]),
  );
  let best: CsvDelimiter[] = [];
  let bestScore: DelimiterScore | null = null;
  for (const delimiter of CANDIDATES) {
    const score = scores.get(delimiter);
    if (!score || score.presence === 0) continue;
    if (
      !bestScore ||
      score.presence > bestScore.presence ||
      (score.presence === bestScore.presence &&
        (score.consistency > bestScore.consistency ||
          (score.consistency === bestScore.consistency &&
            score.total > bestScore.total)))
    ) {
      best = [delimiter];
      bestScore = score;
    } else if (
      score.presence === bestScore.presence &&
      score.consistency === bestScore.consistency &&
      score.total === bestScore.total
    ) {
      best.push(delimiter);
    }
  }
  if (best.length === 0) return ",";
  if (best.length === 1) return best[0] ?? ",";
  if (best.includes(";") && DECIMAL_COMMA.test(text)) return ";";
  if (best.includes(",")) return ",";
  return best[0] ?? ",";
}

/**
 * RFC 4180 with the usual leniencies: quotes are recognised only at the
 * start of a field, a doubled quote inside quotes is a literal quote,
 * newlines inside quotes belong to the field, and CR, LF and CRLF all end
 * a record. A quote left open at the end of the file is an error naming the
 * line where it began. Rows keep their own field count; the caller pads.
 */
export function parseCsv(text: string, delimiter: CsvDelimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  const parts: string[] = [];
  let segmentStart = 0;
  let line = 1;
  let inQuotes = false;
  let quoteLine = 0;
  let fieldStart = true;
  let index = 0;

  const flushField = (end: number): void => {
    parts.push(text.slice(segmentStart, end));
    row.push(parts.join(""));
    parts.length = 0;
  };

  while (index < text.length) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          parts.push(text.slice(segmentStart, index + 1));
          index += 2;
          segmentStart = index;
          continue;
        }
        parts.push(text.slice(segmentStart, index));
        inQuotes = false;
        index += 1;
        segmentStart = index;
        continue;
      }
      if (char === "\r") {
        // Embedded line breaks are kept, normalised to "\n".
        parts.push(text.slice(segmentStart, index), "\n");
        line += 1;
        index += text[index + 1] === "\n" ? 2 : 1;
        segmentStart = index;
        continue;
      }
      if (char === "\n") line += 1;
      index += 1;
      continue;
    }
    if (char === '"' && fieldStart) {
      inQuotes = true;
      quoteLine = line;
      fieldStart = false;
      index += 1;
      segmentStart = index;
      continue;
    }
    if (char === delimiter) {
      flushField(index);
      index += 1;
      segmentStart = index;
      fieldStart = true;
      continue;
    }
    if (char === "\r" || char === "\n") {
      flushField(index);
      rows.push(row);
      row = [];
      line += 1;
      index += char === "\r" && text[index + 1] === "\n" ? 2 : 1;
      segmentStart = index;
      fieldStart = true;
      continue;
    }
    fieldStart = false;
    index += 1;
  }

  if (inQuotes) {
    throw new SheetCheckError("CSV_MALFORMED", `line ${quoteLine}`);
  }
  if (segmentStart < text.length || parts.length > 0 || row.length > 0) {
    flushField(text.length);
    rows.push(row);
  }
  return rows;
}
