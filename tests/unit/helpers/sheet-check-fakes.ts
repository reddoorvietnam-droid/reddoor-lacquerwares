import { Decimal } from "decimal.js";

import type { Permission } from "@/domains/identity/permissions";
import {
  emptyParsedRow,
  isCodeField,
  isDateField,
  isMoneyField,
  templateFields,
  type CanonicalField,
  type CheckResult,
  type MappingProposal,
  type NewSheetCheckRecord,
  type NewSheetRowRecord,
  type ParsedRow,
  type RowOutcome,
  type RowResult,
  type RowSystemView,
  type SheetCell,
  type SheetCheckDto,
  type SheetCheckListFilter,
  type SheetCheckStore,
  type SheetCheckTemplate,
  type SheetMapping,
  type SheetRow,
  type SheetRowDto,
  type SheetRowListOptions,
} from "@/domains/sheet-checks/contracts";
import {
  countBySeverity,
  issue,
  severityRank,
  worstSeverity,
  type Issue,
  type IssueSeverity,
} from "@/domains/sheet-checks/issues";
import type { SheetAnalysis } from "@/domains/sheet-checks/parsing/header";
import type {
  ParsedSheet,
  ParsedWorkbook,
  RawRow,
  UploadInput,
} from "@/domains/sheet-checks/parsing/intake";
import type {
  ParsedRowEntry,
  ParsedRows,
  ParseRowsContext,
} from "@/domains/sheet-checks/parsing/rows";
import type {
  ReconcileInput,
  ReconcileOutput,
} from "@/domains/sheet-checks/reconcile";
import {
  SheetCheckService,
  type SheetCheckPipeline,
} from "@/domains/sheet-checks/service";
import { formatBusinessDay } from "@/domains/tasks/policy";
import type { AccessContext } from "@/lib/auth/authorization";
import { money, type Currency, type Money } from "@/lib/money";

import {
  auditRepository,
  FakeCustomerStore,
  FakeFinanceEntryStore,
  FakeInvoiceStore,
  FakeOrderStore,
  nextId,
  occurredAt,
} from "./finance-fakes";

/**
 * In-memory pieces for the sheet-check service tests: a store that mimics
 * the Mongo store's conditional writes and scope filter, a tiny parsing +
 * reconciliation pipeline driven by a `|`-separated text grid, business
 * stores wrapped so that ANY write method throws, and builders for DTOs.
 * The permission decisions themselves come from the real evaluator through
 * `authFor(snapshotFor(role))` in the tests.
 */

export const sheetCheckNow = new Date("2026-09-06T02:00:00.000Z");
export const sheetCheckTimeZone = "Asia/Ho_Chi_Minh";

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export class FakeSheetCheckStore implements SheetCheckStore {
  checks = new Map<string, SheetCheckDto>();
  rows = new Map<string, SheetRowDto[]>();
  private readonly clock: () => Date;

  constructor(clock: () => Date = () => occurredAt) {
    this.clock = clock;
  }

  async insert(
    record: NewSheetCheckRecord,
    rows: readonly NewSheetRowRecord[],
  ): Promise<SheetCheckDto> {
    const id = nextId("5");
    const now = this.clock();
    const check: SheetCheckDto = {
      ...record,
      id,
      createdAt: now,
      updatedAt: now,
      revision: 0,
    };
    this.checks.set(id, check);
    this.rows.set(
      id,
      rows.map((row) => ({
        checkId: id,
        index: row.index,
        sheetRowNumber: row.sheetRowNumber,
        kind: row.kind,
        hidden: row.hidden,
        cells: row.cells.map((cell) => ({ ...cell })),
        result: null,
      })),
    );
    return check;
  }

  async findById(checkId: string): Promise<SheetCheckDto | null> {
    return this.checks.get(checkId) ?? null;
  }

  async list(filter: SheetCheckListFilter): Promise<SheetCheckDto[]> {
    const scope = filter.scope;
    const matching = [...this.checks.values()]
      .filter((check) => {
        if (scope.kind === "businessUnits") {
          const covered = new Set(scope.businessUnitIds);
          const reached =
            check.businessUnitIds.length > 0 &&
            check.businessUnitIds.every((unitId) => covered.has(unitId));
          if (!reached && check.createdByUserId !== scope.userId) return false;
        } else if (scope.kind === "own") {
          if (check.createdByUserId !== scope.userId) return false;
        }
        if (filter.template && check.template !== filter.template) return false;
        if (filter.status && check.status !== filter.status) return false;
        return true;
      })
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id),
      );
    const offset = filter.offset ?? 0;
    return matching.slice(offset, offset + (filter.limit ?? 50));
  }

  private worstOf(row: SheetRowDto): IssueSeverity | null {
    return row.result ? worstSeverity(row.result.issues) : null;
  }

  async countRowsWithIssues(
    checkId: string,
    minSeverity: IssueSeverity,
  ): Promise<number> {
    return (this.rows.get(checkId) ?? []).filter((row) => {
      const worst = this.worstOf(row);
      return worst !== null && severityRank[worst] >= severityRank[minSeverity];
    }).length;
  }

  async listRows(
    checkId: string,
    options: SheetRowListOptions,
  ): Promise<SheetRowDto[]> {
    const min = options.minSeverity;
    return (this.rows.get(checkId) ?? [])
      .filter((row) => {
        if (!min) return true;
        const worst = this.worstOf(row);
        return worst !== null && severityRank[worst] >= severityRank[min];
      })
      .sort((left, right) => left.index - right.index)
      .slice(options.offset, options.offset + options.limit);
  }

  async findRow(
    checkId: string,
    rowIndex: number,
  ): Promise<SheetRowDto | null> {
    return (
      (this.rows.get(checkId) ?? []).find((row) => row.index === rowIndex) ??
      null
    );
  }

  async markChecked(input: {
    checkId: string;
    expectedRevision: number;
    mapping: SheetMapping;
    result: CheckResult;
    rowResults: readonly { rowIndex: number; result: RowResult }[];
    requiredPermissions: readonly Permission[];
    checkedAt: Date;
    expiresAt: Date;
  }): Promise<SheetCheckDto | null> {
    const check = this.checks.get(input.checkId);
    if (
      !check ||
      check.status !== "mapping" ||
      check.revision !== input.expectedRevision
    ) {
      return null;
    }
    const updated: SheetCheckDto = {
      ...check,
      status: "checked",
      mapping: input.mapping,
      result: input.result,
      requiredPermissions: [...input.requiredPermissions],
      checkedAt: input.checkedAt,
      expiresAt: input.expiresAt,
      updatedAt: this.clock(),
      revision: check.revision + 1,
    };
    this.checks.set(check.id, updated);
    const results = new Map(
      input.rowResults.map((entry) => [entry.rowIndex, entry.result]),
    );
    this.rows.set(
      check.id,
      (this.rows.get(check.id) ?? []).map((row) => ({
        ...row,
        result: results.get(row.index) ?? row.result,
      })),
    );
    return updated;
  }

  async discard(input: {
    checkId: string;
    expectedRevision: number;
  }): Promise<boolean> {
    const check = this.checks.get(input.checkId);
    if (
      !check ||
      check.status !== "mapping" ||
      check.revision !== input.expectedRevision
    ) {
      return false;
    }
    this.checks.delete(check.id);
    this.rows.delete(check.id);
    return true;
  }
}

/* ------------------------------------------------------------------ */
/* Grid builders                                                       */
/* ------------------------------------------------------------------ */

export function cell(
  text: string,
  partial: Partial<SheetCell> = {},
): SheetCell {
  return {
    text,
    type: text === "" ? "z" : "s",
    number: null,
    numberFormat: null,
    formula: false,
    noCache: false,
    mergedFill: false,
    truncated: false,
    ...partial,
  };
}

/** A grid as upload bytes: one line per row, cells separated by `|`, first line = header. */
export function gridBytes(lines: readonly (readonly string[])[]): Uint8Array {
  return new TextEncoder().encode(
    lines.map((cells) => cells.join("|")).join("\n"),
  );
}

export function sheetRow(
  index: number,
  cells: readonly string[],
  partial: Partial<Omit<SheetRow, "cells" | "index">> = {},
): SheetRow {
  return {
    index,
    sheetRowNumber: partial.sheetRowNumber ?? index + 2,
    kind: partial.kind ?? "data",
    hidden: partial.hidden ?? false,
    cells: cells.map((text) => cell(text)),
  };
}

const headerSynonyms: Record<string, CanonicalField> = {
  ngày: "date",
  date: "date",
  "số tiền": "amount",
  amount: "amount",
  "giá bán": "amount",
  khách: "customerName",
  "khách hàng": "customerName",
  customer: "customerName",
  "mã khách": "customerCode",
  "mã đơn": "orderCode",
  order: "orderCode",
  "hóa đơn": "invoiceNumber",
  invoice: "invoiceNumber",
  "dư nợ": "outstanding",
  outstanding: "outstanding",
  "ghi chú": "note",
  "trạng thái": "stage",
  "loại tiền": "currency",
  "số ct": "bankRef",
  stt: "ignore",
};

function fieldForHeader(header: string): CanonicalField {
  return headerSynonyms[header.trim().toLowerCase()] ?? "ignore";
}

function isBlank(cells: readonly SheetCell[]): boolean {
  return cells.every((entry) => entry.text === "");
}

function fakeReadUpload(input: UploadInput): ParsedWorkbook {
  const text = new TextDecoder().decode(input.bytes);
  const lines = text.split("\n").map((line) => line.replace(/\r$/, ""));
  const columnCount = Math.max(
    1,
    ...lines.map((line) => line.split("|").length),
  );
  const rows: RawRow[] = lines.map((line, index) => {
    const texts = line.split("|");
    while (texts.length < columnCount) texts.push("");
    return {
      sheetRowNumber: index + 1,
      hidden: false,
      cells: texts.map((entry) => cell(entry.trim())),
    };
  });
  const chosen: ParsedSheet = {
    index: 0,
    name: "Sheet1",
    rows,
    columnCount,
    hiddenColumnCount: 0,
  };
  return {
    fileFormat: input.fileName.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv",
    date1904: false,
    sheets: [
      {
        index: 0,
        name: "Sheet1",
        rowCount: rows.filter((row) => !isBlank(row.cells)).length,
      },
    ],
    chosen,
    issues: [],
  };
}

function fakeAnalyzeSheet(sheet: ParsedSheet): SheetAnalysis {
  const header = sheet.rows[0];
  const headerTexts = header ? header.cells.map((entry) => entry.text) : [];
  const rows: SheetRow[] = sheet.rows.slice(1).map((raw, index) => {
    const first = raw.cells.find((entry) => entry.text !== "")?.text ?? "";
    const kind: SheetRow["kind"] = isBlank(raw.cells)
      ? "blank"
      : /^(tổng|total)/i.test(first)
        ? "total"
        : "data";
    return {
      index,
      sheetRowNumber: raw.sheetRowNumber,
      kind,
      hidden: raw.hidden,
      cells: raw.cells,
    };
  });
  return {
    headerRowOffset: header ? 0 : null,
    headerSheetRowNumber: header ? 1 : null,
    headerTexts,
    titleLines: [],
    periodHint: null,
    rows,
    dataRowCount: rows.filter((row) => row.kind === "data").length,
    issues: [],
  };
}

function fakeProposeMapping(analysis: SheetAnalysis): {
  proposal: MappingProposal;
  mapping: SheetMapping;
} {
  const columns = analysis.headerTexts.map((header, columnIndex) => ({
    columnIndex,
    header,
    field: fieldForHeader(header),
  }));
  return {
    proposal: {
      headerSheetRowNumber: analysis.headerSheetRowNumber,
      headerFound: analysis.headerRowOffset !== null,
      columns: columns.map((column) => ({
        ...column,
        confidence: column.field === "ignore" ? "low" : "high",
        suggestedMultiplier: "1",
        inferredStyle: isMoneyField(column.field) ? "vi" : null,
        inferredDateOrder: isDateField(column.field) ? "assumed" : null,
        sampleValues: analysis.rows
          .filter((row) => row.kind === "data")
          .map((row) => row.cells[column.columnIndex]?.text ?? "")
          .filter((text) => text !== "")
          .slice(0, 3),
      })),
      periodHint: null,
      titleLines: [],
    },
    mapping: {
      columns: columns.map((column) => ({
        columnIndex: column.columnIndex,
        field: column.field,
        fixedCurrency: null,
        unitMultiplier: "1",
        numberStyle: null,
        dateOrder: null,
      })),
      defaultCurrency: "VND",
      period: null,
      compareSellingPrice: false,
    },
  };
}

function relevantFields(template: SheetCheckTemplate): Set<CanonicalField> {
  const fields = templateFields[template];
  return new Set([
    ...fields.required,
    ...fields.identityAnyOf,
    ...fields.optional,
  ]);
}

function fakeValidateMapping(
  mapping: SheetMapping,
  template: SheetCheckTemplate,
): Issue[] {
  const issues: Issue[] = [];
  const relevant = relevantFields(template);
  const mapped = mapping.columns.filter(
    (column) => column.field !== "ignore" && relevant.has(column.field),
  );
  const fields = templateFields[template];
  const missing = fields.required.filter(
    (field) => !mapped.some((column) => column.field === field),
  );
  if (!fields.identityAnyOf.some((f) => mapped.some((c) => c.field === f))) {
    missing.push(fields.identityAnyOf[0]!);
  }
  if (missing.length > 0) {
    issues.push(
      issue("REQUIRED_COLUMN_MISSING", { fields: missing.join(", ") }),
    );
  }
  const seen = new Map<CanonicalField, number>();
  for (const column of mapped) {
    const earlier = seen.get(column.field);
    if (earlier !== undefined) {
      issues.push(
        issue("MAPPING_CONFLICT", {
          a: String(earlier),
          b: String(column.columnIndex),
          field: column.field,
        }),
      );
    } else {
      seen.set(column.field, column.columnIndex);
    }
  }
  return issues;
}

function parseFakeMoney(
  text: string,
  currency: Currency,
  multiplier: string,
): Money | null {
  const digits = text.replace(/[.,\s]/g, "");
  if (!/^-?\d+$/.test(digits)) return null;
  const value = new Decimal(digits).times(multiplier);
  return money(value.toFixed(currency === "USD" ? 2 : 0), currency);
}

function fakeParseRows(
  rows: readonly SheetRow[],
  ctx: ParseRowsContext,
): ParsedRows {
  const relevant = relevantFields(ctx.template);
  const entries: ParsedRowEntry[] = rows.map((row) => {
    const parsed: ParsedRow = emptyParsedRow();
    const issues: Issue[] = [];
    const skipped = row.kind !== "data";
    for (const column of ctx.mapping.columns) {
      if (column.field === "ignore" || !relevant.has(column.field)) continue;
      const text = row.cells[column.columnIndex]?.text ?? "";
      if (isMoneyField(column.field)) {
        if (text === "") continue;
        const value = parseFakeMoney(
          text,
          column.fixedCurrency ?? ctx.mapping.defaultCurrency,
          column.unitMultiplier,
        );
        if (value) parsed[column.field] = value;
        else if (!skipped) {
          issues.push(
            issue(
              "AMOUNT_NOT_NUMBER",
              { raw: text },
              {
                columnIndex: column.columnIndex,
              },
            ),
          );
        }
        continue;
      }
      if (skipped) continue;
      if (isDateField(column.field)) {
        if (text === "") continue;
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) parsed[column.field] = text;
        else {
          issues.push(
            issue(
              "DATE_INVALID",
              { raw: text },
              {
                columnIndex: column.columnIndex,
              },
            ),
          );
        }
        continue;
      }
      if (isCodeField(column.field)) {
        parsed[column.field] = text === "" ? null : text.toUpperCase();
        continue;
      }
      if (column.field === "currency") {
        parsed.currency =
          text === "USD" ? "USD" : text === "VND" ? "VND" : null;
        continue;
      }
      if (
        column.field === "customerName" ||
        column.field === "method" ||
        column.field === "bankRef" ||
        column.field === "stage" ||
        column.field === "note"
      ) {
        parsed[column.field] = text === "" ? null : text;
      }
    }
    if (!skipped) {
      for (const field of templateFields[ctx.template].required) {
        if (field !== "ignore" && parsed[field] === null) {
          issues.push(issue("REQUIRED_EMPTY", { field }));
        }
      }
    }
    return { rowIndex: row.index, parsed, issues, skipped };
  });
  return { rows: entries, columnIssues: [], columnStyles: {}, dateOrders: {} };
}

/**
 * A reconciliation just rich enough for the service tests: orders resolve
 * inside `system.orders` only, receipts match on equal amount, balances
 * match by customer name, and `exercised` follows the snapshot exactly as
 * the real engine's contract says.
 */
export function fakeReconcile(seen: ReconcileInput[]) {
  return (input: ReconcileInput): ReconcileOutput => {
    seen.push(input);
    const { system, template } = input;
    if (template !== "generic" && (!system.receipts || !system.refunds)) {
      throw new Error("A money template needs receipts and refunds.");
    }
    const hasInvoiceColumn = input.mapping.columns.some(
      (column) => column.field === "invoiceNumber",
    );
    const amountColumn = input.mapping.columns.find(
      (column) => column.field === "amount",
    );
    const rowResults = input.parsed.rows.map((entry) => {
      if (entry.skipped) {
        return {
          rowIndex: entry.rowIndex,
          result: {
            parsed: entry.parsed,
            issues: entry.issues,
            system: null,
            outcome: "skipped" as RowOutcome,
          },
        };
      }
      const issues: Issue[] = [...entry.issues];
      let outcome: RowOutcome = issues.some((i) => i.severity === "error")
        ? "invalid"
        : "matched";
      const view: RowSystemView = {};
      let hasSystem = false;
      const code = entry.parsed.orderCode;
      if (code && system.orders) {
        const order = system.orders.find((o) => o.orderCode === code);
        if (order) {
          issues.push(
            issue("ORDER_MATCHED", {
              code,
              stage: order.stage,
              customer: order.customerName,
            }),
          );
          view.order = {
            id: order.id,
            orderCode: order.orderCode,
            stage: order.stage,
            customerName: order.customerName,
            sellingPrice: system.sellingPriceVisible
              ? order.sellingPrice
              : null,
          };
          hasSystem = true;
          if (system.sellingPriceVisible && entry.parsed.amount) {
            const same =
              order.sellingPrice?.amount === entry.parsed.amount.amount &&
              order.sellingPrice.currency === entry.parsed.amount.currency;
            issues.push(
              same
                ? issue("SELLING_PRICE_MATCH", { code, system: "" })
                : issue("SELLING_PRICE_MISMATCH", { code }),
            );
            if (!same && outcome === "matched") outcome = "mismatch";
          }
        } else {
          issues.push(issue("ORDER_NOT_FOUND", { code }));
          outcome = "notFound";
        }
      }
      if (template === "incomingCash" && system.receipts) {
        const amount = entry.parsed.amount;
        const receipt = amount
          ? system.receipts.find(
              (r) =>
                r.amount.amount === amount.amount &&
                r.amount.currency === amount.currency,
            )
          : undefined;
        if (receipt) {
          const day = formatBusinessDay(receipt.occurredAt, input.timeZone);
          issues.push(
            issue("RECEIPT_MATCHED", {
              d: day,
              amount: `${receipt.amount.amount} ${receipt.amount.currency}`,
            }),
          );
          view.receipts = [
            {
              id: receipt.id,
              occurredDay: day,
              amount: money(receipt.amount.amount, receipt.amount.currency),
              counterparty: receipt.counterparty,
              method: receipt.method,
              allocations: [],
              status: receipt.status,
              voidReason: receipt.voidReason,
            },
          ];
          hasSystem = true;
        } else if (amount) {
          issues.push(
            issue("RECEIPT_NOT_FOUND", {
              customer: entry.parsed.customerName ?? "…",
              d: entry.parsed.date ?? "…",
              amount: `${amount.amount} ${amount.currency}`,
            }),
          );
          outcome = "notFound";
        }
      }
      if (template === "receivables" && entry.parsed.outstanding) {
        issues.push(
          issue("BALANCE_MATCH", {
            balance: `${entry.parsed.outstanding.amount} ${entry.parsed.outstanding.currency}`,
          }),
        );
        view.balance = {
          customerId: null,
          customerName: entry.parsed.customerName ?? "",
          currency: entry.parsed.outstanding.currency,
          invoiced: entry.parsed.outstanding,
          received: money("0", entry.parsed.outstanding.currency),
          refunded: money("0", entry.parsed.outstanding.currency),
          outstanding: entry.parsed.outstanding,
          credit: money("0", entry.parsed.outstanding.currency),
          balance: entry.parsed.outstanding,
          overdueInvoiceCount: 0,
        };
        hasSystem = true;
      }
      return {
        rowIndex: entry.rowIndex,
        result: {
          parsed: entry.parsed,
          issues,
          system: hasSystem ? view : null,
          outcome,
        },
      };
    });

    const sheetIssues: Issue[] = [];
    if (template === "generic" && amountColumn && !system.sellingPriceVisible) {
      sheetIssues.push(
        issue(
          "AMOUNT_NOT_COMPARED",
          {},
          { columnIndex: amountColumn.columnIndex },
        ),
      );
    }
    const exercised: Permission[] = [];
    if (template === "generic") {
      if (system.sellingPriceVisible) exercised.push("orders.readSellingPrice");
      if (hasInvoiceColumn && system.invoices) exercised.push("invoices.read");
      if (system.customers) exercised.push("customers.read");
    }
    const rowIssues = rowResults.flatMap((entry) => entry.result.issues);
    const counts = countBySeverity([...rowIssues, ...sheetIssues]);
    const outcomes: Record<RowOutcome, number> = {
      matched: 0,
      mismatch: 0,
      notFound: 0,
      notCompared: 0,
      invalid: 0,
      skipped: 0,
    };
    for (const entry of rowResults) outcomes[entry.result.outcome] += 1;
    return {
      rowResults,
      sheetIssues,
      summary: {
        dataRows: rowResults.length - outcomes.skipped,
        skippedRows: outcomes.skipped,
        errors: counts.error,
        warnings: counts.warn,
        infos: counts.info,
        outcomes,
        totals: [],
      },
      systemOnly: [],
      exercised,
    };
  };
}

export function fakePipeline(seen: ReconcileInput[]): SheetCheckPipeline {
  return {
    readUpload: fakeReadUpload,
    analyzeSheet: (sheet) => fakeAnalyzeSheet(sheet),
    proposeMapping: (analysis) => fakeProposeMapping(analysis),
    validateMapping: (mapping, template) =>
      fakeValidateMapping(mapping, template),
    parseRows: fakeParseRows,
    reconcile: fakeReconcile(seen),
  };
}

/* ------------------------------------------------------------------ */
/* Business stores that refuse every write                             */
/* ------------------------------------------------------------------ */

const readMethods = new Set([
  "list",
  "listActive",
  "findById",
  "findByIds",
  "findByCode",
  "listByCustomer",
  "sumActiveByOrder",
  "seed",
]);

/**
 * Wraps a store so that reads are counted and any other method throws:
 * proof that the sheet check never writes to a business store, whatever
 * its dependency type says.
 */
export function refuseWrites<T extends object>(
  store: T,
  calls: Map<string, number>,
  label: string,
): T {
  return new Proxy(store, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver) as unknown;
      if (typeof value !== "function") return value;
      const name = String(property);
      if (readMethods.has(name)) {
        return (...args: unknown[]) => {
          const key = `${label}.${name}`;
          calls.set(key, (calls.get(key) ?? 0) + 1);
          return (value as (...inner: unknown[]) => unknown).apply(
            target,
            args,
          );
        };
      }
      return () => {
        throw new Error(`${label}.${name}: a sheet check attempted a write`);
      };
    },
  });
}

/* ------------------------------------------------------------------ */
/* Service harness                                                     */
/* ------------------------------------------------------------------ */

export function buildSheetCheckService(
  options: { now?: Date; checkedRetentionDays?: number } = {},
) {
  const now = options.now ?? sheetCheckNow;
  const orders = new FakeOrderStore();
  const invoices = new FakeInvoiceStore();
  const finance = new FakeFinanceEntryStore();
  const customers = new FakeCustomerStore();
  const calls = new Map<string, number>();
  const store = new FakeSheetCheckStore(() => now);
  const audit = auditRepository();
  const seen: ReconcileInput[] = [];
  const service = new SheetCheckService({
    store,
    orderStore: refuseWrites(orders, calls, "orderStore"),
    invoiceStore: refuseWrites(invoices, calls, "invoiceStore"),
    financeEntryStore: refuseWrites(finance, calls, "financeEntryStore"),
    customerStore: refuseWrites(customers, calls, "customerStore"),
    auditRepository: audit,
    timeZone: sheetCheckTimeZone,
    now: () => now,
    ...(options.checkedRetentionDays !== undefined
      ? { checkedRetentionDays: options.checkedRetentionDays }
      : {}),
    pipeline: fakePipeline(seen),
  });
  return {
    service,
    store,
    audit,
    orders,
    invoices,
    finance,
    customers,
    calls,
    seen,
    now,
  };
}

export function mergeContexts(
  base: AccessContext,
  ...extras: AccessContext[]
): AccessContext {
  return {
    ...base,
    permissions: [
      ...base.permissions,
      ...extras.flatMap((extra) => extra.permissions),
    ],
  };
}

/* ------------------------------------------------------------------ */
/* DTO builders                                                        */
/* ------------------------------------------------------------------ */

export function sheetCheckDto(
  partial: Partial<SheetCheckDto> & { headers?: readonly string[] } = {},
): SheetCheckDto {
  const headers = partial.headers ?? ["Mã đơn", "Số tiền"];
  const template = partial.template ?? "generic";
  const proposal: MappingProposal = partial.proposal ?? {
    headerSheetRowNumber: 1,
    headerFound: true,
    columns: headers.map((header, columnIndex) => ({
      columnIndex,
      header,
      field: fieldForHeader(header),
      confidence: "high",
      suggestedMultiplier: "1",
      inferredStyle: null,
      inferredDateOrder: null,
      sampleValues: [],
    })),
    periodHint: null,
    titleLines: [],
  };
  return {
    id: partial.id ?? nextId("5"),
    template,
    status: partial.status ?? "checked",
    sourceKind: "file",
    fileName: partial.fileName ?? "bao-cao.xlsx",
    fileBytes: 1_024,
    fileFormat: partial.fileFormat ?? "xlsx",
    sheets: [{ index: 0, name: "Sheet1", rowCount: 3 }],
    sheetIndex: 0,
    sheetName: "Sheet1",
    columnCount: partial.columnCount ?? headers.length,
    date1904: false,
    rowCount: partial.rowCount ?? 0,
    dataRowCount: partial.dataRowCount ?? 0,
    intakeIssues: partial.intakeIssues ?? [],
    proposal,
    mapping: partial.mapping ?? {
      columns: proposal.columns.map((column) => ({
        columnIndex: column.columnIndex,
        field: column.field,
        fixedCurrency: null,
        unitMultiplier: "1",
        numberStyle: null,
        dateOrder: null,
      })),
      defaultCurrency: "VND",
      period: null,
      compareSellingPrice: false,
    },
    result: partial.result ?? null,
    requiredPermissions: partial.requiredPermissions ?? ["orders.read"],
    scopeKind: partial.scopeKind ?? "all",
    businessUnitIds: partial.businessUnitIds ?? [],
    createdByUserId: partial.createdByUserId ?? "d1d1d1d1d1d1d1d1d1d1d1d1",
    rerunOf: partial.rerunOf ?? null,
    checkedAt:
      partial.checkedAt === undefined ? sheetCheckNow : partial.checkedAt,
    expiresAt: partial.expiresAt ?? sheetCheckNow,
    createdAt: partial.createdAt ?? sheetCheckNow,
    updatedAt: sheetCheckNow,
    revision: partial.revision ?? 1,
  };
}

export function sheetRowDto(
  checkId: string,
  index: number,
  cells: readonly string[],
  result: RowResult | null = null,
  partial: Partial<Omit<SheetRow, "cells" | "index">> = {},
): SheetRowDto {
  return { ...sheetRow(index, cells, partial), checkId, result };
}

export function rowResult(
  partial: Partial<RowResult> & { issues?: readonly Issue[] } = {},
): RowResult {
  return {
    parsed: partial.parsed ?? emptyParsedRow(),
    issues: partial.issues ?? [],
    system: partial.system ?? null,
    outcome: partial.outcome ?? "matched",
  };
}
