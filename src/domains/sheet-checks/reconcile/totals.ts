import {
  fieldLabels,
  isMoneyField,
  templateFields,
  type ColumnMapping,
  type MoneyField,
  type SheetCell,
  type SheetCheckTemplate,
  type SheetMapping,
  type SheetRow,
  type TotalsLine,
} from "@/domains/sheet-checks/contracts";
import { issue, type Issue } from "@/domains/sheet-checks/issues";
import {
  isPlaceholderText,
  moneyText,
  parseMoneyCell,
} from "@/domains/sheet-checks/parsing/money";
import type {
  ParsedRowEntry,
  ParsedRows,
} from "@/domains/sheet-checks/parsing/rows";
import {
  add,
  compare,
  subtract,
  zero,
  type Currency,
  type Money,
} from "@/lib/money";

/**
 * Totals and subtotals, per money column and per currency — a column that
 * mixes VND and USD gets one line per currency and its single totals
 * figure is never compared with either. Every sum is decimal arithmetic on
 * the parsed amounts; unreadable cells are counted and reported, never
 * guessed.
 */

export type TotalsSystemInput = {
  /** incomingCash: the cash engine's per-currency period figures (field `amount`). */
  periodTotals?: ReadonlyMap<Currency, { sheet: string; system: string }>;
  /** Other engines: a system figure per money field and currency. */
  fieldTotals?: ReadonlyMap<MoneyField, ReadonlyMap<Currency, string>>;
};

export type CheckTotalsInput = {
  rows: readonly SheetRow[];
  parsed: ParsedRows;
  mapping: SheetMapping;
  headerTexts: readonly string[];
  system: TotalsSystemInput | null;
  /** Restricts the money columns to the template's fields when given. */
  template?: SheetCheckTemplate;
};

export type CheckTotalsOutput = { lines: TotalsLine[]; issues: Issue[] };

type CurrencyAccumulator = { total: Money; counted: number; hidden: number };

const SUBTOTAL_RESET_KINDS = new Set<SheetRow["kind"]>(["subtotal", "group"]);

function cellAt(row: SheetRow, columnIndex: number): SheetCell | null {
  return row.cells[columnIndex] ?? null;
}

/**
 * The money value of a non-data row's cell. Totals rows rarely repeat the
 * currency cell, so the figure is read in the currency the data rows of
 * the column use (`preferredCurrency`, when there is exactly one) unless
 * the row names one itself; rows.ts's own parse is the fallback.
 */
function moneyInCell(
  row: SheetRow,
  column: ColumnMapping,
  field: MoneyField,
  entry: ParsedRowEntry | undefined,
  input: CheckTotalsInput,
  preferredCurrency: Currency | null,
): Money | null {
  const parsed = entry?.parsed[field] ?? null;
  const cell = cellAt(row, column.columnIndex);
  if (!cell || cell.noCache || cell.type === "e" || cell.text === "") {
    return parsed;
  }
  const currencyColumn = input.mapping.columns.find(
    (mapped) => mapped.field === "currency",
  );
  const ownCurrencyText = currencyColumn
    ? (cellAt(row, currencyColumn.columnIndex)?.text ?? "")
    : "";
  const result = parseMoneyCell(cell, {
    unitMultiplier: column.unitMultiplier,
    columnStyle:
      column.numberStyle ??
      input.parsed.columnStyles[column.columnIndex] ??
      "unknown",
    fixedCurrency: column.fixedCurrency,
    currencyCellText:
      ownCurrencyText !== "" ? ownCurrencyText : preferredCurrency,
    defaultCurrency: preferredCurrency ?? input.mapping.defaultCurrency,
    template: input.template ?? "generic",
    field,
  });
  if (result.amount === null || result.currency === null) return parsed;
  return { amount: result.amount, currency: result.currency };
}

/** The single currency a column's data rows use, or null when none or several. */
function soleCurrency(currencies: readonly Currency[]): Currency | null {
  return currencies.length === 1 ? (currencies[0] ?? null) : null;
}

function rowLabel(row: SheetRow): string {
  return row.cells.find((cell) => cell.text !== "")?.text ?? "";
}

function systemFigure(
  system: TotalsSystemInput | null,
  field: MoneyField,
  currency: Currency,
): string | null {
  if (!system) return null;
  if (field === "amount" && system.periodTotals) {
    const period = system.periodTotals.get(currency);
    if (period) return period.system;
  }
  return system.fieldTotals?.get(field)?.get(currency) ?? null;
}

export function checkTotals(input: CheckTotalsInput): CheckTotalsOutput {
  const lines: TotalsLine[] = [];
  const issues: Issue[] = [];
  const relevant = input.template
    ? new Set<string>([
        ...templateFields[input.template].required,
        ...templateFields[input.template].optional,
      ])
    : null;
  const columns = input.mapping.columns.filter(
    (column): column is ColumnMapping & { field: MoneyField } =>
      isMoneyField(column.field) &&
      (relevant === null || relevant.has(column.field)),
  );
  if (columns.length === 0) return { lines, issues };

  const entries = new Map(
    input.parsed.rows.map((entry) => [entry.rowIndex, entry]),
  );
  const dataRows = input.rows.filter((row) => row.kind === "data");
  const totalRow = [...input.rows]
    .reverse()
    .find((row) => row.kind === "total");
  if (!totalRow) issues.push(issue("TOTAL_ABSENT"));

  // A field may be mapped twice — "Số tiền" over "VND" and "USD" is one
  // header with two columns — but a parsed row keeps one value per field,
  // so such a column is summed from its own cells instead.
  const perField = new Map<MoneyField, number>();
  for (const column of columns) {
    perField.set(column.field, (perField.get(column.field) ?? 0) + 1);
  }

  for (const column of columns) {
    const field = column.field;
    const ownCells = (perField.get(field) ?? 0) > 1;
    const sums = new Map<Currency, CurrencyAccumulator>();
    let skipped = 0;
    for (const row of dataRows) {
      const value = ownCells
        ? moneyInCell(
            row,
            column,
            field,
            undefined,
            input,
            column.fixedCurrency,
          )
        : (entries.get(row.index)?.parsed[field] ?? null);
      if (value) {
        const current = sums.get(value.currency) ?? {
          total: zero(value.currency),
          counted: 0,
          hidden: 0,
        };
        current.total = add(current.total, value);
        current.counted += 1;
        if (row.hidden) current.hidden += 1;
        sums.set(value.currency, current);
      } else {
        const cell = cellAt(row, column.columnIndex);
        // A dash, "N/A" or a cell filled from a merged range is an empty
        // figure, not an unreadable one; counting those as "skipped" would
        // accuse the sheet of numbers it never had.
        if (
          cell &&
          cell.text !== "" &&
          !cell.mergedFill &&
          !isPlaceholderText(cell.text)
        ) {
          skipped += 1;
        }
      }
    }
    const currencies: Currency[] =
      sums.size > 0
        ? [...sums.keys()]
        : [column.fixedCurrency ?? input.mapping.defaultCurrency];

    let sheetTotal: Money | null = null;
    if (totalRow) {
      const cell = cellAt(totalRow, column.columnIndex);
      if (cell?.noCache) {
        issues.push(
          issue("TOTAL_NOT_CACHED", {}, { columnIndex: column.columnIndex }),
        );
      } else if (cell?.type === "e") {
        // #REF! in the totals row: say so rather than silently comparing
        // nothing at all.
        issues.push(
          issue("CELL_ERROR_VALUE", {}, { columnIndex: column.columnIndex }),
        );
      } else {
        sheetTotal = moneyInCell(
          totalRow,
          column,
          field,
          entries.get(totalRow.index),
          input,
          soleCurrency(currencies),
        );
      }
    }
    // One figure cannot stand for two currencies; VND and USD are never
    // compared with each other, so the figure is set aside.
    if (
      sheetTotal &&
      (currencies.length > 1 || !currencies.includes(sheetTotal.currency))
    ) {
      issues.push(
        issue("TOTAL_MIXED_CURRENCY", {}, { columnIndex: column.columnIndex }),
      );
      sheetTotal = null;
    }

    for (const currency of currencies) {
      const accumulator = sums.get(currency) ?? {
        total: zero(currency),
        counted: 0,
        hidden: 0,
      };
      let lineSheetTotal: string | null = null;
      if (sheetTotal && sheetTotal.currency === currency) {
        lineSheetTotal = sheetTotal.amount;
        if (compare(sheetTotal, accumulator.total) === 0) {
          issues.push(
            issue(
              "TOTAL_MATCH",
              {
                field: fieldLabels[field].vi,
                currency,
                total: moneyText(sheetTotal),
              },
              { columnIndex: column.columnIndex },
            ),
          );
        } else {
          issues.push(
            issue(
              "TOTAL_MISMATCH",
              {
                sheetTotal: moneyText(sheetTotal),
                n: accumulator.counted,
                computed: moneyText(accumulator.total),
                diff: moneyText(subtract(sheetTotal, accumulator.total)),
                skipped,
                hidden: accumulator.hidden,
              },
              { columnIndex: column.columnIndex },
            ),
          );
        }
      }
      lines.push({
        field,
        columnIndex: column.columnIndex,
        currency,
        computed: accumulator.total.amount,
        sheetTotal: lineSheetTotal,
        rowsCounted: accumulator.counted,
        rowsSkipped: skipped,
        system: systemFigure(input.system, field, currency),
      });
    }

    issues.push(...subtotalIssues(column, field, entries, input));
  }

  return { lines, issues };
}

/** Each subtotal row against the data rows since the previous subtotal or group row. */
function subtotalIssues(
  column: ColumnMapping,
  field: MoneyField,
  entries: ReadonlyMap<number, ParsedRowEntry>,
  input: CheckTotalsInput,
): Issue[] {
  const issues: Issue[] = [];
  let section = new Map<Currency, Money>();
  for (const row of input.rows) {
    if (row.kind === "data") {
      const value = entries.get(row.index)?.parsed[field] ?? null;
      if (value) {
        section.set(
          value.currency,
          add(section.get(value.currency) ?? zero(value.currency), value),
        );
      }
      continue;
    }
    if (!SUBTOTAL_RESET_KINDS.has(row.kind)) continue;
    if (row.kind === "subtotal") {
      const sheet = moneyInCell(
        row,
        column,
        field,
        entries.get(row.index),
        input,
        soleCurrency([...section.keys()]),
      );
      if (sheet) {
        const computed = section.get(sheet.currency) ?? zero(sheet.currency);
        if (compare(sheet, computed) !== 0) {
          issues.push(
            issue(
              "SUBTOTAL_MISMATCH",
              {
                label: rowLabel(row),
                sheet: moneyText(sheet),
                computed: moneyText(computed),
              },
              { columnIndex: column.columnIndex },
            ),
          );
        }
      }
    }
    section = new Map();
  }
  return issues;
}
