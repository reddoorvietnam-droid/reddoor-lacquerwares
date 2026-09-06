import type {
  ParsedRow,
  SheetCheckTemplate,
  SheetRow,
} from "@/domains/sheet-checks/contracts";
import { issue, type Issue } from "@/domains/sheet-checks/issues";
import { normalizeName } from "@/domains/sheet-checks/parsing/code";
import type { ParsedRowEntry } from "@/domains/sheet-checks/parsing/rows";
import { moneyText } from "@/domains/sheet-checks/parsing/money";

/**
 * Rows that repeat. An identical row (every parsed field equal) is an
 * error on the later copy; rows that share the template's key but differ
 * elsewhere are a warning on every member of the group, because either
 * one may be the stray entry.
 */

type DuplicateKey = { key: string; label: string };

function isEmptyRow(parsed: ParsedRow): boolean {
  return Object.values(parsed).every((value) => value === null);
}

/** The identity part shared by the money templates: every identity column present. */
function identityParts(parsed: ParsedRow): {
  key: string;
  label: string;
} | null {
  const parts: string[] = [];
  const labels: string[] = [];
  if (parsed.customerCode) {
    parts.push(`code=${parsed.customerCode.toUpperCase()}`);
    labels.push(`mã khách ${parsed.customerCode}`);
  }
  if (parsed.customerName) {
    parts.push(`name=${normalizeName(parsed.customerName)}`);
    labels.push(`khách ${parsed.customerName}`);
  }
  if (parsed.orderCode) {
    parts.push(`order=${parsed.orderCode.toUpperCase()}`);
    labels.push(`đơn ${parsed.orderCode}`);
  }
  if (parsed.invoiceNumber) {
    parts.push(`invoice=${parsed.invoiceNumber.toUpperCase()}`);
    labels.push(`hóa đơn ${parsed.invoiceNumber}`);
  }
  if (parts.length === 0) return null;
  return { key: parts.join("|"), label: labels.join(", ") };
}

function templateKey(
  parsed: ParsedRow,
  template: SheetCheckTemplate,
): DuplicateKey | null {
  switch (template) {
    case "incomingCash": {
      const identity = identityParts(parsed);
      if (!identity || !parsed.amount || !parsed.date) return null;
      const amount = moneyText(parsed.amount);
      return {
        key: `${identity.key}|${amount}|${parsed.date}`,
        label: `${identity.label}, ngày ${parsed.date}, số tiền ${amount}`,
      };
    }
    case "receivables": {
      const identity = identityParts(parsed);
      if (!identity) return null;
      const currency = parsed.outstanding?.currency ?? parsed.currency;
      return {
        key: `${identity.key}|${currency ?? ""}`,
        label: currency ? `${identity.label} (${currency})` : identity.label,
      };
    }
    case "generic": {
      if (!parsed.orderCode) return null;
      const code = parsed.orderCode.toUpperCase();
      return { key: `order=${code}`, label: `mã đơn ${parsed.orderCode}` };
    }
  }
}

function push(map: Map<number, Issue[]>, rowIndex: number, entry: Issue): void {
  const list = map.get(rowIndex) ?? [];
  list.push(entry);
  map.set(rowIndex, list);
}

/**
 * DUPLICATE_ROW on every later copy of an identical data row; DUPLICATE_KEY
 * on every member of a group sharing the template key with different
 * content. `rows` supplies the sheet row numbers people see; without it
 * the 1-based position among the stored rows is used.
 */
export function findDuplicates(
  entries: readonly ParsedRowEntry[],
  template: SheetCheckTemplate,
  rows: readonly Pick<SheetRow, "index" | "sheetRowNumber">[] = [],
): Map<number, Issue[]> {
  const result = new Map<number, Issue[]>();
  const sheetRowNumbers = new Map(
    rows.map((row) => [row.index, row.sheetRowNumber]),
  );
  const rowNumber = (rowIndex: number): number =>
    sheetRowNumbers.get(rowIndex) ?? rowIndex + 1;

  const firstIdentical = new Map<string, number>();
  const keyGroups = new Map<string, { label: string; rowIndexes: number[] }>();

  for (const entry of entries) {
    if (entry.skipped || isEmptyRow(entry.parsed)) continue;
    const fingerprint = JSON.stringify(entry.parsed);
    const earlier = firstIdentical.get(fingerprint);
    if (earlier !== undefined) {
      push(
        result,
        entry.rowIndex,
        issue("DUPLICATE_ROW", { n: rowNumber(earlier) }),
      );
      // An identical copy is fully explained; it does not join a key group.
      continue;
    }
    firstIdentical.set(fingerprint, entry.rowIndex);

    const key = templateKey(entry.parsed, template);
    if (!key) continue;
    const group = keyGroups.get(key.key) ?? {
      label: key.label,
      rowIndexes: [],
    };
    group.rowIndexes.push(entry.rowIndex);
    keyGroups.set(key.key, group);
  }

  for (const group of keyGroups.values()) {
    if (group.rowIndexes.length < 2) continue;
    const [first, second] = group.rowIndexes;
    if (first === undefined || second === undefined) continue;
    for (const rowIndex of group.rowIndexes) {
      push(
        result,
        rowIndex,
        issue("DUPLICATE_KEY", {
          key: group.label,
          n: rowNumber(rowIndex === first ? second : first),
        }),
      );
    }
  }

  return result;
}
