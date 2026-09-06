import {
  columnLabel,
  emptyParsedRow,
  fieldLabels,
  isCodeField,
  isDateField,
  isMoneyField,
  templateFields,
  type CanonicalField,
  type ColumnMapping,
  type ColumnNumberStyle,
  type DateOrder,
  type DateOrderSource,
  type ParsedRow,
  type SheetCell,
  type SheetCheckTemplate,
  type SheetMapping,
  type SheetRow,
} from "@/domains/sheet-checks/contracts";
import {
  issue,
  type Issue,
  type IssueCode,
} from "@/domains/sheet-checks/issues";
import { sheetCheckLimits as limits } from "@/domains/sheet-checks/limits";
import {
  normalizeCustomerCode,
  normalizeInvoiceNumber,
  normalizeOrderCode,
} from "@/domains/sheet-checks/parsing/code";
import {
  inferDateOrder,
  parseDateCell,
} from "@/domains/sheet-checks/parsing/date";
import { effectiveColumns } from "@/domains/sheet-checks/parsing/header";
import { blankCell, isBlankCell } from "@/domains/sheet-checks/parsing/intake";
import {
  inferColumnStyle,
  isPlaceholderText,
  parseCurrencyText,
  parseMoneyCell,
} from "@/domains/sheet-checks/parsing/money";
import { money, type Currency, type Money } from "@/lib/money";

/**
 * Applies a confirmed mapping to the stored rows. Column decisions (number
 * style, day/month order, unit multiplier) are made once per column in a
 * pre-pass so every cell of a column is read the same way; each cell then
 * goes through the dedicated parser and every finding is pinned to its
 * column. Nothing here compares with the system — that is the
 * reconciliation's job — and nothing here is ever a JS number for money.
 */

export type ParsedRowEntry = {
  rowIndex: number;
  parsed: ParsedRow;
  issues: Issue[];
  /** `kind !== "data"`: totals and subtotals still carry their money cells. */
  skipped: boolean;
};

export type ParsedRows = {
  rows: ParsedRowEntry[];
  columnIssues: Issue[];
  columnStyles: Record<number, ColumnNumberStyle>;
  dateOrders: Record<number, { order: DateOrder; source: DateOrderSource }>;
};

export type ParseRowsContext = {
  template: SheetCheckTemplate;
  mapping: SheetMapping;
  headerTexts: readonly string[];
  date1904: boolean;
  /** Business day today, YYYY-MM-DD. */
  today: string;
};

type MoneyColumnStats = {
  defaulted: boolean;
  currencies: Set<Currency>;
  styleConflict: boolean;
};

/** Findings that make sense on a totals cell; sanity flags do not. */
const TOTALS_ROW_ISSUES: ReadonlySet<IssueCode> = new Set<IssueCode>([
  "AMOUNT_NOT_NUMBER",
  "AMOUNT_SCALE",
  "AMOUNT_AMBIGUOUS",
  "AMOUNT_HIDDEN_DECIMALS",
  "CURRENCY_CONFLICT",
  "CURRENCY_UNSUPPORTED",
  "CURRENCY_INVALID",
]);

function pinned(issues: readonly Issue[], columnIndex: number): Issue[] {
  return issues.map((entry) => ({ ...entry, columnIndex }));
}

function cellAt(row: SheetRow, columnIndex: number): SheetCell {
  return row.cells[columnIndex] ?? blankCell();
}

/** Columns whose value identifies or quantifies the row; an error cell there is a finding. */
function isKeyField(field: CanonicalField): boolean {
  return (
    isMoneyField(field) ||
    isDateField(field) ||
    isCodeField(field) ||
    field === "customerName" ||
    field === "currency"
  );
}

function toMoney(
  amount: string,
  currency: Currency,
  raw: string,
  columnIndex: number,
  issues: Issue[],
): Money | null {
  try {
    return money(amount, currency);
  } catch {
    issues.push(issue("AMOUNT_NOT_NUMBER", { raw }, { columnIndex }));
    return null;
  }
}

export function parseRows(
  rows: readonly SheetRow[],
  ctx: ParseRowsContext,
): ParsedRows {
  const columnCount = rows[0]?.cells.length ?? null;
  const columns = effectiveColumns(ctx.mapping, ctx.template, columnCount)
    .filter((column) => column.field !== "ignore")
    .sort((a, b) => a.columnIndex - b.columnIndex);
  const headerOf = (columnIndex: number): string =>
    ctx.headerTexts[columnIndex]?.trim() || columnLabel(columnIndex);
  const dataRows = rows.filter((row) => row.kind === "data");
  const cellsOf = (columnIndex: number): SheetCell[] =>
    dataRows.map((row) => cellAt(row, columnIndex));

  const columnIssues: Issue[] = [];
  const columnStyles: Record<number, ColumnNumberStyle> = {};
  const dateOrders: Record<
    number,
    { order: DateOrder; source: DateOrderSource }
  > = {};
  const moneyStats = new Map<number, MoneyColumnStats>();

  for (const column of columns) {
    const { columnIndex, field } = column;
    if (isMoneyField(field)) {
      const style =
        column.numberStyle ?? inferColumnStyle(cellsOf(columnIndex));
      columnStyles[columnIndex] = style;
      moneyStats.set(columnIndex, {
        defaulted: false,
        currencies: new Set(),
        styleConflict: false,
      });
      if (style === "mixed") {
        columnIssues.push(
          issue(
            "COLUMN_STYLE_MIXED",
            { header: headerOf(columnIndex) },
            { columnIndex },
          ),
        );
      }
      if (column.unitMultiplier !== "1") {
        columnIssues.push(
          issue(
            "UNIT_MULTIPLIER_APPLIED",
            {
              header: headerOf(columnIndex),
              multiplier: column.unitMultiplier,
            },
            { columnIndex },
          ),
        );
      }
    } else if (isDateField(field)) {
      if (column.dateOrder !== null) {
        dateOrders[columnIndex] = {
          order: column.dateOrder,
          source: "confirmed",
        };
        continue;
      }
      const evidence = inferDateOrder(cellsOf(columnIndex));
      if (evidence.dmyProven && !evidence.mdyProven) {
        dateOrders[columnIndex] = { order: "dmy", source: "proven" };
      } else if (evidence.mdyProven && !evidence.dmyProven) {
        dateOrders[columnIndex] = { order: "mdy", source: "proven" };
        columnIssues.push(
          issue(
            "DATE_ORDER_MDY",
            { header: headerOf(columnIndex) },
            { columnIndex },
          ),
        );
      } else {
        // No proof either way (or contradictory proof, which validateMapping
        // blocks): day-first is the local convention, and each cell says so.
        dateOrders[columnIndex] = { order: "dmy", source: "assumed" };
        columnIssues.push(
          issue(
            "DATE_ORDER_ASSUMED",
            { header: headerOf(columnIndex) },
            { columnIndex },
          ),
        );
      }
    }
  }

  const currencyColumn =
    columns.find((column) => column.field === "currency") ?? null;
  // `ignore` is never required, but the type must say so for the row lookup.
  const isParsedKey = (
    field: CanonicalField,
  ): field is Exclude<CanonicalField, "ignore"> => field !== "ignore";
  const required = templateFields[ctx.template].required.filter(
    (field): field is Exclude<CanonicalField, "ignore"> =>
      isParsedKey(field) && columns.some((column) => column.field === field),
  );

  /**
   * Cell-level findings that precede parsing. Returns null when the cell
   * holds nothing readable; `seen` records that the row did provide input
   * for the field, so a required field is not also reported as empty.
   */
  const preflight = (
    cell: SheetCell,
    column: ColumnMapping,
    issues: Issue[],
    seen: Set<CanonicalField>,
  ): SheetCell | null => {
    const { columnIndex, field } = column;
    const moneyOrDate = isMoneyField(field) || isDateField(field);
    if (cell.noCache) {
      issues.push(
        issue(
          "FORMULA_NO_CACHE",
          {},
          { columnIndex, severity: moneyOrDate ? "error" : "info" },
        ),
      );
      seen.add(field);
      return null;
    }
    if (cell.type === "e") {
      if (isKeyField(field))
        issues.push(issue("CELL_ERROR_VALUE", {}, { columnIndex }));
      seen.add(field);
      return null;
    }
    if (cell.truncated) {
      issues.push(
        issue("CELL_TRUNCATED", { max: limits.maxCellChars }, { columnIndex }),
      );
    }
    if (cell.mergedFill) {
      // A merged amount belongs to the first row only; a merged name or
      // date applies to every row of the range.
      if (isMoneyField(field)) return null;
      if (!isBlankCell(cell)) {
        issues.push(
          issue(
            "MERGED_FILL",
            { field: fieldLabels[field].vi },
            { columnIndex },
          ),
        );
      }
    }
    return cell;
  };

  const parseMoney = (
    cell: SheetCell,
    column: ColumnMapping,
    field: CanonicalField & keyof ParsedRow,
    parsed: ParsedRow,
    issues: Issue[],
    seen: Set<CanonicalField>,
    currencyCellText: string | null,
    stats: MoneyColumnStats | null,
    keep: (code: IssueCode) => boolean,
  ): void => {
    if (!isMoneyField(field)) return;
    const { columnIndex } = column;
    const columnStyle = columnStyles[columnIndex] ?? "unknown";
    const result = parseMoneyCell(cell, {
      unitMultiplier: column.unitMultiplier,
      columnStyle,
      fixedCurrency: column.fixedCurrency,
      currencyCellText,
      defaultCurrency: ctx.mapping.defaultCurrency,
      template: ctx.template,
      field,
    });
    issues.push(
      ...pinned(
        result.issues.filter((entry) => keep(entry.code)),
        columnIndex,
      ),
    );
    if (!result.blank) seen.add(field);
    if (stats) {
      if (result.currencySource === "default") stats.defaulted = true;
      if (result.currency) stats.currencies.add(result.currency);
      if (
        result.style &&
        (columnStyle === "vi" || columnStyle === "en") &&
        result.style !== columnStyle
      ) {
        stats.styleConflict = true;
      }
    }
    if (
      result.amount !== null &&
      result.currency !== null &&
      parsed[field] === null
    ) {
      parsed[field] = toMoney(
        result.amount,
        result.currency,
        cell.text,
        columnIndex,
        issues,
      );
    }
  };

  const readCurrencyCell = (
    row: SheetRow,
    parsed: ParsedRow,
    issues: Issue[],
    seen: Set<CanonicalField>,
  ): string | null => {
    if (!currencyColumn) return null;
    const cell = preflight(
      cellAt(row, currencyColumn.columnIndex),
      currencyColumn,
      issues,
      seen,
    );
    if (!cell) return null;
    const value = parseCurrencyText(cell.text);
    if (value === null) return null;
    if (value === "INVALID") {
      // Reported once here; the money parser gets no currency text so it
      // does not report the same cell again.
      issues.push(
        issue(
          "CURRENCY_INVALID",
          { raw: cell.text },
          { columnIndex: currencyColumn.columnIndex },
        ),
      );
      return null;
    }
    parsed.currency = value;
    return cell.text;
  };

  const parseDataRow = (row: SheetRow): ParsedRowEntry => {
    const parsed = emptyParsedRow();
    const issues: Issue[] = [];
    const seen = new Set<CanonicalField>();
    if (row.hidden) issues.push(issue("HIDDEN_ROW"));
    const currencyCellText = readCurrencyCell(row, parsed, issues, seen);

    for (const column of columns) {
      if (column === currencyColumn) continue;
      const { columnIndex, field } = column;
      const cell = preflight(cellAt(row, columnIndex), column, issues, seen);
      if (!cell) continue;
      if (isMoneyField(field)) {
        parseMoney(
          cell,
          column,
          field,
          parsed,
          issues,
          seen,
          currencyCellText,
          moneyStats.get(columnIndex) ?? null,
          () => true,
        );
      } else if (isDateField(field)) {
        const order = dateOrders[columnIndex] ?? {
          order: "dmy",
          source: "assumed",
        };
        const result = parseDateCell(cell, {
          date1904: ctx.date1904,
          columnOrder: order.order,
          columnOrderSource: order.source,
          period: ctx.mapping.period,
          field,
          today: ctx.today,
        });
        issues.push(...pinned(result.issues, columnIndex));
        if (!result.blank) seen.add(field);
        if (result.day !== null && parsed[field] === null)
          parsed[field] = result.day;
      } else if (isCodeField(field)) {
        const result =
          field === "orderCode"
            ? normalizeOrderCode(cell)
            : field === "invoiceNumber"
              ? normalizeInvoiceNumber(cell)
              : normalizeCustomerCode(cell);
        issues.push(...pinned(result.issues, columnIndex));
        if (!result.blank) seen.add(field);
        if (result.code !== null && parsed[field] === null)
          parsed[field] = result.code;
      } else if (
        field === "customerName" ||
        field === "method" ||
        field === "bankRef" ||
        field === "stage" ||
        field === "note"
      ) {
        const text = cell.text.trim();
        if (text === "" || isPlaceholderText(text)) continue;
        seen.add(field);
        if (parsed[field] === null) parsed[field] = text;
      }
    }

    for (const field of required) {
      if (parsed[field] !== null || seen.has(field)) continue;
      const first = columns.find((column) => column.field === field);
      issues.push(
        issue(
          "REQUIRED_EMPTY",
          { field: fieldLabels[field].vi },
          { columnIndex: first ? first.columnIndex : null },
        ),
      );
    }
    return { rowIndex: row.index, parsed, issues, skipped: false };
  };

  /** Totals and subtotals: money cells only, so the totals check can read them. */
  const parseTotalsRow = (row: SheetRow): ParsedRowEntry => {
    const parsed = emptyParsedRow();
    const issues: Issue[] = [];
    const seen = new Set<CanonicalField>();
    const currencyColumnCell = currencyColumn
      ? cellAt(row, currencyColumn.columnIndex)
      : null;
    const currencyCellText =
      currencyColumnCell &&
      !currencyColumnCell.noCache &&
      currencyColumnCell.type === "s" &&
      parseCurrencyText(currencyColumnCell.text) !== "INVALID"
        ? currencyColumnCell.text
        : null;
    for (const column of columns) {
      if (!isMoneyField(column.field)) continue;
      const cell = cellAt(row, column.columnIndex);
      if (cell.noCache || cell.type === "e" || cell.mergedFill) continue;
      parseMoney(
        cell,
        column,
        column.field,
        parsed,
        issues,
        seen,
        currencyCellText,
        null,
        (code) => TOTALS_ROW_ISSUES.has(code),
      );
    }
    return { rowIndex: row.index, parsed, issues, skipped: true };
  };

  const entries = rows.map((row): ParsedRowEntry => {
    switch (row.kind) {
      case "data":
        return parseDataRow(row);
      case "total":
      case "subtotal":
        return parseTotalsRow(row);
      case "group":
      case "blank":
        return {
          rowIndex: row.index,
          parsed: emptyParsedRow(),
          issues: [],
          skipped: true,
        };
    }
  });

  for (const column of columns) {
    const stats = moneyStats.get(column.columnIndex);
    if (!stats) continue;
    const { columnIndex } = column;
    if (stats.styleConflict && columnStyles[columnIndex] !== "mixed") {
      columnIssues.push(
        issue(
          "COLUMN_STYLE_MIXED",
          { header: headerOf(columnIndex) },
          { columnIndex },
        ),
      );
    }
    if (stats.defaulted) {
      columnIssues.push(
        issue(
          "CURRENCY_DEFAULTED",
          {
            header: headerOf(columnIndex),
            currency: ctx.mapping.defaultCurrency,
          },
          { columnIndex },
        ),
      );
    }
    if (stats.currencies.size > 1) {
      columnIssues.push(
        issue(
          "CURRENCY_MIXED_COLUMN",
          { header: headerOf(columnIndex) },
          { columnIndex },
        ),
      );
    }
  }

  return { rows: entries, columnIssues, columnStyles, dateOrders };
}
