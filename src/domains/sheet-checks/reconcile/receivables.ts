import type { CustomerRecordDto } from "@/domains/customers/contracts";
import type {
  FinanceEntryRecordDto,
  InvoiceRecordDto,
} from "@/domains/finance/contracts";
import {
  computeReceivables,
  type CustomerReceivableRow,
  type InvoiceReceivableRow,
  type OrderReceivableRow,
  type ReceivableOrder,
  type ReceivablesReport,
} from "@/domains/finance/receivables";
import type { OrderRecordDto } from "@/domains/orders/contracts";
import { businessDayEnd } from "@/domains/tasks/policy";
import {
  SheetCheckError,
  templateFields,
  type CanonicalField,
  type MoneyField,
  type ParsedRow,
  type RowSystemView,
  type SheetPeriod,
  type SystemBalanceView,
  type SystemInvoiceView,
  type SystemOnlyItem,
} from "@/domains/sheet-checks/contracts";
import { issue, type Issue } from "@/domains/sheet-checks/issues";
import { looseKey, normalizeName } from "@/domains/sheet-checks/parsing/code";
import { moneyText } from "@/domains/sheet-checks/parsing/money";
import { resolveCustomer } from "@/domains/sheet-checks/reconcile/customers";
import {
  orderIssues,
  resolveOrder,
  type OrderIndex,
} from "@/domains/sheet-checks/reconcile/orders";
import {
  addDays,
  customerKeyOf,
  customerView,
  dayOf,
  diff,
  isDayWithin,
  moneyOf,
  orderView,
  type ReconcileInput,
} from "@/domains/sheet-checks/reconcile/shared";
import {
  add,
  compare,
  isNegative,
  isZero,
  negate,
  subtract,
  zero,
  type Currency,
  type Money,
} from "@/lib/money";

/**
 * Receivables statement engine ("báo cáo công nợ / dư nợ").
 *
 * The system side is the same `computeReceivables` the receivables page
 * uses, fed only with what existed on the sheet's cut-off day: invoices
 * issued, receipts and refunds recorded up to `period.to`. A row is keyed
 * by its invoice number, else its order code, else its customer, and each
 * key is compared with the matching figure of the report — never across
 * currencies, never through a conversion.
 *
 * The sheet's arithmetic is checked before anything else: a row whose own
 * columns do not add up is not compared with the system, because the
 * comparison would only restate the sheet's internal error.
 */

export type ReceivablesOutput = {
  rowIssues: Map<number, Issue[]>;
  rowSystem: Map<number, RowSystemView>;
  sheetIssues: Issue[];
  systemOnly: SystemOnlyItem[];
  /** The system's total per money field and currency, for the totals table. */
  systemTotals: Map<MoneyField, Map<Currency, string>>;
};

type RowKeyKind = "invoice" | "order" | "customer";

/** The system state as of one cut-off day, indexed for row lookups. */
type AsOfState = {
  report: ReceivablesReport;
  invoicesByNumber: Map<string, InvoiceRecordDto[]>;
  invoicesByLoose: Map<string, InvoiceRecordDto[]>;
  invoiceRowById: Map<string, InvoiceReceivableRow>;
  /** `orderId|currency` → row. */
  orderRows: Map<string, OrderReceivableRow>;
  /** `customerKey|currency` → row. */
  customerRows: Map<string, CustomerReceivableRow>;
  /** Invoice id → the customer key the report grouped it under. */
  invoiceCustomerKey: Map<string, string>;
  /** Active `orderPayment` receipts up to the cut-off. */
  receipts: readonly FinanceEntryRecordDto[];
  ordersById: Map<string, OrderRecordDto>;
};

type Tally = {
  sheet: Money;
  matchedSystem: Money;
  onlySheet: Money;
  onlySystem: Money;
  differing: Money;
};

type RowMatch = { kind: "entry"; id: string; system: Money } | { kind: "none" };

type CustomerLookup = {
  customerKey: string | null;
  customerId: string | null;
  customerName: string | null;
  issues: Issue[];
};

type ReportCustomer = {
  customerKey: string;
  customerId: string | null;
  customerName: string;
};

function isPositive(value: Money): boolean {
  return compare(value, zero(value.currency)) > 0;
}

function abs(value: Money): Money {
  return isNegative(value) ? negate(value) : value;
}

/** Same normalisation `normalizeInvoiceNumber` applies to a sheet cell. */
function invoiceKey(text: string): string {
  return text.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
}

/** Same normalisation `normalizeOrderCode` applies to a sheet cell. */
function orderCodeKey(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, "")
    .toUpperCase();
}

/** The key `computeReceivables` groups an invoice under. */
function invoiceCustomerKeyOf(
  invoice: InvoiceRecordDto,
  ordersById: Map<string, OrderRecordDto>,
): string {
  const order = ordersById.get(invoice.orderId);
  return customerKeyOf(
    invoice.customerId ?? order?.customerId ?? null,
    invoice.customerName || order?.customerName || "",
  );
}

function receiptKey(entry: FinanceEntryRecordDto): string {
  return customerKeyOf(entry.customerId, entry.counterparty);
}

function listOf(items: readonly string[], max = 3): string {
  const shown = items.slice(0, max).join(", ");
  return items.length > max ? `${shown}, …` : shown;
}

/**
 * Everything the run holds, restricted to what existed on `until` (a
 * business day) — or unrestricted when the sheet names no period.
 */
function buildAsOf(
  input: ReconcileInput,
  until: string | null,
  parts: {
    invoices: readonly InvoiceRecordDto[];
    receipts: readonly FinanceEntryRecordDto[];
    refunds: readonly FinanceEntryRecordDto[];
  },
): AsOfState {
  const upTo = (instant: Date): boolean =>
    until === null || dayOf(instant, input.timeZone) <= until;
  const orders = input.system.orders ?? [];
  const invoices = parts.invoices.filter((invoice) => upTo(invoice.issuedAt));
  const receipts = parts.receipts.filter((entry) => upTo(entry.occurredAt));
  const refunds = parts.refunds.filter((entry) => upTo(entry.occurredAt));
  const receivableOrders: ReceivableOrder[] = orders.map((order) => ({
    id: order.id,
    orderCode: order.orderCode,
    customerId: order.customerId,
    customerName: order.customerName,
    stage: order.stage,
  }));
  const report = computeReceivables({
    orders: receivableOrders,
    invoices,
    receipts,
    refunds,
    // "Overdue" is judged at the end of the period the statement covers, not
    // at the moment the check happens to run.
    now: until === null ? input.now : businessDayEnd(until, input.timeZone),
  });

  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const invoicesByNumber = new Map<string, InvoiceRecordDto[]>();
  const invoicesByLoose = new Map<string, InvoiceRecordDto[]>();
  const invoiceCustomerKey = new Map<string, string>();
  for (const invoice of invoices) {
    const key = invoiceKey(invoice.invoiceNumber);
    invoicesByNumber.set(key, [...(invoicesByNumber.get(key) ?? []), invoice]);
    const loose = looseKey(invoice.invoiceNumber);
    invoicesByLoose.set(loose, [
      ...(invoicesByLoose.get(loose) ?? []),
      invoice,
    ]);
    invoiceCustomerKey.set(
      invoice.id,
      invoiceCustomerKeyOf(invoice, ordersById),
    );
  }

  return {
    report,
    invoicesByNumber,
    invoicesByLoose,
    invoiceRowById: new Map(
      report.invoices.map((row) => [row.invoice.id, row]),
    ),
    orderRows: new Map(
      report.orders.map((row) => [`${row.orderId}|${row.currency}`, row]),
    ),
    customerRows: new Map(
      report.customers.map((row) => [
        `${row.customerKey}|${row.currency}`,
        row,
      ]),
    ),
    invoiceCustomerKey,
    receipts: receipts.filter(
      (entry) => entry.status === "active" && entry.category === "orderPayment",
    ),
    ordersById,
  };
}

/** Prefers an active invoice; a voided one only when nothing else carries the number. */
function pickInvoice(
  candidates: readonly InvoiceRecordDto[] | undefined,
): InvoiceRecordDto | null {
  if (!candidates || candidates.length === 0) return null;
  return (
    candidates.find((invoice) => invoice.status === "active") ??
    candidates[0] ??
    null
  );
}

function findInvoice(
  state: AsOfState,
  number: string,
): { invoice: InvoiceRecordDto; loose: boolean } | null {
  const exact = pickInvoice(state.invoicesByNumber.get(invoiceKey(number)));
  if (exact) return { invoice: exact, loose: false };
  const loose = pickInvoice(state.invoicesByLoose.get(looseKey(number)));
  return loose ? { invoice: loose, loose: true } : null;
}

function invoiceView(
  invoice: InvoiceRecordDto,
  figures: { paid: Money; depositApplied: Money; remaining: Money },
  timeZone: string,
): SystemInvoiceView {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    orderCode: invoice.orderCode,
    customerName: invoice.customerName,
    amount: moneyOf(invoice.amount),
    paid: figures.paid,
    depositApplied: figures.depositApplied,
    remaining: figures.remaining,
    issuedDay: dayOf(invoice.issuedAt, timeZone),
    dueDay: dayOf(invoice.dueAt, timeZone),
    status: invoice.status,
    voidReason: invoice.voidReason,
  };
}

function balanceView(row: CustomerReceivableRow): SystemBalanceView {
  return {
    customerId: row.customerId,
    customerName: row.customerName,
    currency: row.currency,
    invoiced: row.invoiced,
    received: row.received,
    refunded: row.refunded,
    outstanding: row.outstanding,
    credit: row.credit,
    balance: row.balance,
    overdueInvoiceCount: row.overdueInvoiceCount,
  };
}

function emptyCustomerRow(
  customerKey: string,
  customerId: string | null,
  customerName: string,
  currency: Currency,
): CustomerReceivableRow {
  return {
    customerKey,
    customerId,
    customerName,
    currency,
    invoiced: zero(currency),
    received: zero(currency),
    refunded: zero(currency),
    outstanding: zero(currency),
    credit: zero(currency),
    balance: zero(currency),
    overdueInvoiceCount: 0,
  };
}

/**
 * The sheet's arithmetic: opening + invoiced − received + refunded = closing.
 * Money handed back to the customer raises what they owe again, which is
 * how `computeReceivables` treats a refund (credit = received − refunded),
 * so the statement is checked against the same convention.
 */
function rowArithmetic(row: ParsedRow): Issue | null {
  const a = row.openingBalance;
  const b = row.invoiced;
  const c = row.received;
  const sheet = row.outstanding;
  if (!a || !b || !c || !sheet) return null;
  const r = row.refunded ?? zero(a.currency);
  const currencies = new Set(
    [a, b, c, r, sheet].map((value) => value.currency),
  );
  // Mixed currencies on one row cannot be added; the money parser has
  // already flagged the cells, so the check simply does not apply.
  if (currencies.size > 1) return null;
  const calc = add(subtract(add(a, b), c), r);
  if (compare(calc, sheet) === 0) return null;
  return issue("ROW_ARITHMETIC_MISMATCH", {
    a: moneyText(a),
    b: moneyText(b),
    c: moneyText(c),
    r: moneyText(r),
    calc: moneyText(calc),
    sheet: moneyText(sheet),
    diff: moneyText(diff(sheet, calc)),
  });
}

/** Distinct customers the report knows, for name matching without a directory. */
function reportCustomers(state: AsOfState): ReportCustomer[] {
  const seen = new Map<string, ReportCustomer>();
  for (const row of state.report.customers) {
    if (!seen.has(row.customerKey)) {
      seen.set(row.customerKey, {
        customerKey: row.customerKey,
        customerId: row.customerId,
        customerName: row.customerName,
      });
    }
  }
  return [...seen.values()];
}

function notFound(issues: Issue[]): CustomerLookup {
  return { customerKey: null, customerId: null, customerName: null, issues };
}

/**
 * Finds the customer a row is about. With the directory the resolution is
 * shared with every template; without it the report's own customer list
 * stands in, matched by normalised name the same way.
 */
function lookupCustomer(
  row: ParsedRow,
  state: AsOfState,
  directory: readonly CustomerRecordDto[] | null,
): CustomerLookup {
  const sheetName = row.customerName;
  const sheetCode = row.customerCode;

  if (directory !== null) {
    const resolution = resolveCustomer({
      name: sheetName,
      code: sheetCode,
      directory,
      fallback: null,
    });
    // A directory match always carries the record's id; none means the
    // resolver already raised NOT_FOUND / AMBIGUOUS.
    if (resolution.customerId === null) return notFound(resolution.issues);
    // Orders recorded before the customer list existed are grouped by name
    // in the report; try the id first, then the name keys.
    const candidates = [
      resolution.customerId,
      resolution.customerName
        ? customerKeyOf(null, resolution.customerName)
        : null,
      sheetName ? customerKeyOf(null, sheetName) : null,
    ].filter((key): key is string => key !== null);
    const known = candidates.find((key) =>
      state.report.customers.some((entry) => entry.customerKey === key),
    );
    return {
      customerKey: known ?? resolution.customerId,
      customerId: resolution.customerId,
      customerName: resolution.customerName ?? sheetName,
      issues: resolution.issues,
    };
  }

  if (!sheetName) {
    // A bare code cannot be resolved without the directory.
    return notFound([issue("CUSTOMER_NOT_FOUND", { sheet: sheetCode ?? "" })]);
  }
  const target = normalizeName(sheetName);
  const customers = reportCustomers(state);
  const exact = customers.find(
    (entry) => normalizeName(entry.customerName) === target,
  );
  if (exact) {
    const issues =
      exact.customerName.trim() === sheetName.trim()
        ? []
        : [
            issue("CUSTOMER_MATCH_NORMALIZED", {
              sheet: sheetName,
              system: exact.customerName,
            }),
          ];
    return { ...exact, issues };
  }
  const contains =
    target.length === 0
      ? []
      : customers.filter((entry) => {
          const name = normalizeName(entry.customerName);
          return (
            name.length > 0 && (name.includes(target) || target.includes(name))
          );
        });
  const [only] = contains;
  if (contains.length === 1 && only) {
    return {
      ...only,
      issues: [
        issue("CUSTOMER_MATCH_FUZZY", {
          sheet: sheetName,
          system: only.customerName,
        }),
      ],
    };
  }
  if (contains.length > 1) {
    return notFound([
      issue("CUSTOMER_AMBIGUOUS", {
        sheet: sheetName,
        list: listOf(contains.map((entry) => entry.customerName)),
      }),
    ]);
  }
  return notFound([issue("CUSTOMER_NOT_FOUND", { sheet: sheetName })]);
}

/** Whether the sheet's customer name disagrees with a system record's. */
function customerNameDiffers(
  sheetName: string | null,
  systemName: string,
): boolean {
  if (sheetName === null) return false;
  return normalizeName(sheetName) !== normalizeName(systemName);
}

/**
 * A short Vietnamese reason for a balance difference, when one single
 * record explains the whole gap: an invoice the sheet misses, a voided
 * (or void-and-reissued) invoice the sheet still carries, or one receipt.
 */
function explainDifference(input: {
  state: AsOfState;
  customerKey: string;
  currency: Currency;
  difference: Money;
  sheet: Money;
  period: SheetPeriod | null;
  timeZone: string;
  voidedInvoices: readonly InvoiceRecordDto[];
}): string {
  const { state, customerKey, currency } = input;
  const magnitude = abs(input.difference);
  const isCustomer = (invoice: InvoiceRecordDto): boolean =>
    state.invoiceCustomerKey.get(invoice.id) === customerKey &&
    invoice.amount.currency === currency;

  const openInvoices = state.report.invoices.filter(
    (row) =>
      isCustomer(row.invoice) &&
      isPositive(row.remaining) &&
      compare(row.remaining, magnitude) === 0,
  );
  const [openInvoice] = openInvoices;
  if (openInvoices.length === 1 && openInvoice) {
    return `bằng hóa đơn ${openInvoice.invoice.invoiceNumber} còn thiếu`;
  }

  const voided = input.voidedInvoices.find((invoice) => {
    if (!isCustomer(invoice)) return false;
    const amount = moneyOf(invoice.amount);
    if (
      compare(amount, magnitude) === 0 ||
      compare(amount, input.sheet) === 0
    ) {
      return true;
    }
    // Void-and-reissue: the gap equals the reduction between the voided
    // invoice and an active invoice on the same order.
    return state.report.invoices.some(
      (row) =>
        row.invoice.orderId === invoice.orderId &&
        row.invoice.amount.currency === currency &&
        compare(subtract(amount, moneyOf(row.invoice.amount)), magnitude) === 0,
    );
  });
  if (voided) return `hóa đơn ${voided.invoiceNumber} đã hủy`;

  const receipt = state.receipts.find((entry) => {
    if (receiptKey(entry) !== customerKey) return false;
    if (entry.amount.currency !== currency) return false;
    if (compare(moneyOf(entry.amount), magnitude) !== 0) return false;
    const day = dayOf(entry.occurredAt, input.timeZone);
    return (
      input.period === null ||
      isDayWithin(day, input.period.from, input.period.to)
    );
  });
  if (receipt) {
    return `bằng phiếu thu ngày ${dayOf(receipt.occurredAt, input.timeZone)}`;
  }
  return "không tìm được khoản đơn lẻ";
}

export function reconcileReceivables(
  input: ReconcileInput & { orderIndex: OrderIndex },
): ReceivablesOutput {
  const { system, mapping, timeZone } = input;
  // The service loads these three parts only for a runner holding the
  // template gate globally; their absence means the gate was bypassed.
  if (
    system.invoices === null ||
    system.receipts === null ||
    system.refunds === null
  ) {
    throw new SheetCheckError(
      "PERMISSION_DENIED",
      "The receivables template needs invoices, receipts and refunds.",
    );
  }
  const parts = {
    invoices: system.invoices,
    receipts: system.receipts,
    refunds: system.refunds,
  };
  const period = mapping.period;
  const closing = buildAsOf(input, period?.to ?? null, parts);
  const voidedInvoices = parts.invoices.filter(
    (invoice) => invoice.status === "voided",
  );
  const openingDay = period ? addDays(period.from, -1) : null;
  let opening: AsOfState | null = null;
  const openingState = (): AsOfState => {
    opening ??= buildAsOf(input, openingDay, parts);
    return opening;
  };

  const relevant = new Set<CanonicalField>([
    ...templateFields.receivables.required,
    ...templateFields.receivables.identityAnyOf,
    ...templateFields.receivables.optional,
  ]);
  const mapped = new Set(
    mapping.columns
      .map((column) => column.field)
      .filter((field) => relevant.has(field)),
  );
  const sheetKind: RowKeyKind = mapped.has("invoiceNumber")
    ? "invoice"
    : mapped.has("orderCode")
      ? "order"
      : "customer";

  const rowIssues = new Map<number, Issue[]>();
  const rowSystem = new Map<number, RowSystemView>();
  const tallies = new Map<Currency, Tally>();
  const matchedEntries = new Set<string>();
  const touchedCustomers = new Set<string>();
  const matchedInvoices = new Set<string>();

  const tally = (currency: Currency): Tally => {
    let entry = tallies.get(currency);
    if (!entry) {
      entry = {
        sheet: zero(currency),
        matchedSystem: zero(currency),
        onlySheet: zero(currency),
        onlySystem: zero(currency),
        differing: zero(currency),
      };
      tallies.set(currency, entry);
    }
    return entry;
  };
  const record = (sheet: Money, match: RowMatch): void => {
    const entry = tally(sheet.currency);
    entry.sheet = add(entry.sheet, sheet);
    if (match.kind === "entry" && !matchedEntries.has(match.id)) {
      matchedEntries.add(match.id);
      entry.matchedSystem = add(entry.matchedSystem, match.system);
      entry.differing = add(entry.differing, diff(sheet, match.system));
    } else {
      // A second row on the same record is a sheet-only figure: the system
      // holds the record once.
      entry.onlySheet = add(entry.onlySheet, sheet);
    }
  };

  for (const entry of input.parsed.rows) {
    if (entry.skipped) continue;
    const row = entry.parsed;
    const issues: Issue[] = [];
    const view: RowSystemView = {};
    const arithmetic = rowArithmetic(row);
    if (arithmetic) issues.push(arithmetic);
    const blocked = arithmetic !== null;
    const sheet = row.outstanding;
    const currency = sheet?.currency ?? row.currency ?? mapping.defaultCurrency;
    let match: RowMatch = { kind: "none" };

    const kind: RowKeyKind | null = row.invoiceNumber
      ? "invoice"
      : row.orderCode
        ? "order"
        : row.customerName || row.customerCode
          ? "customer"
          : null;

    if (kind === "invoice" && row.invoiceNumber) {
      const found = findInvoice(closing, row.invoiceNumber);
      if (!found) {
        issues.push(issue("INVOICE_NOT_FOUND", { number: row.invoiceNumber }));
        view.invoice = null;
      } else {
        const { invoice } = found;
        const number = invoice.invoiceNumber;
        if (found.loose) {
          issues.push(
            issue("INVOICE_MATCH_LOOSE", {
              sheet: row.invoiceNumber,
              system: number,
            }),
          );
        }
        const customerKey = closing.invoiceCustomerKey.get(invoice.id);
        if (customerKey) {
          touchedCustomers.add(`${customerKey}|${invoice.amount.currency}`);
        }
        if (invoice.status === "voided") {
          // A statement that still carries a voided invoice is wrong by the
          // whole invoice, so this is an error here, not the usual warning.
          issues.push(
            issue(
              "INVOICE_VOIDED",
              { number, reason: invoice.voidReason ?? "" },
              { severity: "error" },
            ),
          );
          const nothing = zero(invoice.amount.currency);
          view.invoice = invoiceView(
            invoice,
            { paid: nothing, depositApplied: nothing, remaining: nothing },
            timeZone,
          );
        } else {
          matchedInvoices.add(invoice.id);
          issues.push(issue("INVOICE_MATCHED", { number }));
          if (
            row.orderCode &&
            row.orderCode !== orderCodeKey(invoice.orderCode)
          ) {
            issues.push(
              issue("INVOICE_ORDER_MISMATCH", {
                number,
                system: invoice.orderCode,
                sheet: row.orderCode,
              }),
            );
          }
          if (customerNameDiffers(row.customerName, invoice.customerName)) {
            issues.push(
              issue("INVOICE_CUSTOMER_MISMATCH", {
                number,
                system: invoice.customerName,
                sheet: row.customerName ?? "",
              }),
            );
          }
          const reportRow = closing.invoiceRowById.get(invoice.id);
          const invoiceCurrency = invoice.amount.currency;
          const nothing = zero(invoiceCurrency);
          const figures = reportRow
            ? {
                paid: reportRow.paid,
                depositApplied: reportRow.depositApplied,
                remaining: reportRow.remaining,
              }
            : { paid: nothing, depositApplied: nothing, remaining: nothing };
          if (!reportRow) {
            // An active invoice the report leaves out belongs to a cancelled
            // (or unknown) order: nothing is collectable on it.
            const order = closing.ordersById.get(invoice.orderId);
            if (order?.stage === "cancelled") {
              issues.push(issue("ORDER_CANCELLED", { code: order.orderCode }));
            }
          }
          view.invoice = invoiceView(invoice, figures, timeZone);

          if (!blocked) {
            if (sheet) {
              if (sheet.currency !== invoiceCurrency) {
                issues.push(
                  issue("INVOICE_CURRENCY_MISMATCH", {
                    number,
                    system: invoiceCurrency,
                    sheet: sheet.currency,
                  }),
                );
              } else {
                match = {
                  kind: "entry",
                  id: `invoice:${invoice.id}`,
                  system: figures.remaining,
                };
                if (compare(sheet, figures.remaining) !== 0) {
                  issues.push(
                    issue("INVOICE_REMAINING_MISMATCH", {
                      amount: moneyText(moneyOf(invoice.amount)),
                      paid: moneyText(figures.paid),
                      deposit: moneyText(figures.depositApplied),
                      remaining: moneyText(figures.remaining),
                      sheet: moneyText(sheet),
                    }),
                  );
                }
              }
            }
            if (row.invoiced && row.invoiced.currency === invoiceCurrency) {
              const amount = moneyOf(invoice.amount);
              if (compare(row.invoiced, amount) !== 0) {
                issues.push(
                  issue("INVOICE_AMOUNT_MISMATCH", {
                    number,
                    system: moneyText(amount),
                    sheet: moneyText(row.invoiced),
                    diff: moneyText(diff(row.invoiced, amount)),
                  }),
                );
              }
            }
            if (row.received && row.received.currency === invoiceCurrency) {
              const paidTotal = add(figures.paid, figures.depositApplied);
              if (compare(row.received, paidTotal) !== 0) {
                issues.push(
                  issue("INVOICE_PAID_MISMATCH", {
                    number,
                    system: moneyText(paidTotal),
                    paid: moneyText(figures.paid),
                    deposit: moneyText(figures.depositApplied),
                    sheet: moneyText(row.received),
                  }),
                );
              }
            }
            if (row.dueDate) {
              const dueDay = dayOf(invoice.dueAt, timeZone);
              if (row.dueDate !== dueDay) {
                issues.push(
                  issue("INVOICE_DUE_MISMATCH", {
                    number,
                    system: dueDay,
                    sheet: row.dueDate,
                  }),
                );
              }
            }
          }
        }
      }
    } else if (kind === "order" && row.orderCode) {
      const resolved = resolveOrder(row.orderCode, input.orderIndex);
      issues.push(...resolved.issues);
      const order = resolved.order;
      if (!order) {
        view.order = null;
      } else {
        issues.push(...orderIssues(order));
        view.order = orderView(order);
        const customerKey = customerKeyOf(order.customerId, order.customerName);
        touchedCustomers.add(`${customerKey}|${currency}`);
        if (customerNameDiffers(row.customerName, order.customerName)) {
          issues.push(
            issue("ORDER_CUSTOMER_MISMATCH", {
              sheet: row.customerName ?? "",
              system: order.customerName,
            }),
          );
        }
        if (!blocked && sheet) {
          const orderRow = closing.orderRows.get(
            `${order.id}|${sheet.currency}`,
          );
          const other = orderRow
            ? null
            : closing.report.orders.find((entry) => entry.orderId === order.id);
          if (other) {
            issues.push(
              issue("CURRENCY_MISMATCH", {
                sheet: sheet.currency,
                system: other.currency,
              }),
            );
          } else {
            const remaining = orderRow?.remaining ?? zero(sheet.currency);
            match = {
              kind: "entry",
              id: `order:${order.id}|${sheet.currency}`,
              system: remaining,
            };
            if (compare(sheet, remaining) !== 0) {
              issues.push(
                issue("ORDER_REMAINING_MISMATCH", {
                  code: order.orderCode,
                  system: moneyText(remaining),
                  sheet: moneyText(sheet),
                }),
              );
            }
          }
        }
      }
    } else if (kind === "customer") {
      const lookup = lookupCustomer(row, closing, system.customers);
      issues.push(...lookup.issues);
      const customerKey = lookup.customerKey;
      if (customerKey) {
        touchedCustomers.add(`${customerKey}|${currency}`);
        const record = lookup.customerId
          ? system.customers?.find((entry) => entry.id === lookup.customerId)
          : undefined;
        if (record) view.customer = customerView(record);
        if (!blocked) {
          const customerRow = closing.customerRows.get(
            `${customerKey}|${currency}`,
          );
          const other = customerRow
            ? null
            : closing.report.customers.find(
                (entry) => entry.customerKey === customerKey,
              );
          if (other) {
            issues.push(
              issue("CURRENCY_MISMATCH", {
                sheet: currency,
                system: other.currency,
              }),
            );
          } else {
            const balanceRow =
              customerRow ??
              emptyCustomerRow(
                customerKey,
                lookup.customerId,
                lookup.customerName ?? "",
                currency,
              );
            view.balance = balanceView(balanceRow);
            if (sheet) {
              match = {
                kind: "entry",
                id: `customer:${customerKey}|${currency}`,
                system: balanceRow.balance,
              };
              if (compare(sheet, balanceRow.balance) === 0) {
                issues.push(
                  issue("BALANCE_MATCH", {
                    balance: moneyText(balanceRow.balance),
                  }),
                );
              } else if (
                compare(sheet, balanceRow.outstanding) === 0 &&
                isPositive(balanceRow.credit)
              ) {
                issues.push(
                  issue("BALANCE_MATCH_IGNORING_CREDIT", {
                    outstanding: moneyText(balanceRow.outstanding),
                    credit: moneyText(balanceRow.credit),
                    balance: moneyText(balanceRow.balance),
                  }),
                );
              } else {
                const difference = diff(sheet, balanceRow.balance);
                issues.push(
                  issue("BALANCE_MISMATCH", {
                    sheet: moneyText(sheet),
                    outstanding: moneyText(balanceRow.outstanding),
                    credit: moneyText(balanceRow.credit),
                    balance: moneyText(balanceRow.balance),
                    diff: moneyText(difference),
                    explanation: explainDifference({
                      state: closing,
                      customerKey,
                      currency,
                      difference,
                      sheet,
                      period,
                      timeZone,
                      voidedInvoices,
                    }),
                  }),
                );
              }
            }
            if (period && openingDay) {
              if (row.openingBalance) {
                const openingCurrency = row.openingBalance.currency;
                const openingRow = openingState().customerRows.get(
                  `${customerKey}|${openingCurrency}`,
                );
                const openingBalance =
                  openingRow?.balance ?? zero(openingCurrency);
                if (compare(row.openingBalance, openingBalance) !== 0) {
                  issues.push(
                    issue("OPENING_MISMATCH", {
                      sheet: moneyText(row.openingBalance),
                      system: moneyText(openingBalance),
                      day: openingDay,
                    }),
                  );
                }
              }
              if (row.invoiced) {
                const invoicedCurrency = row.invoiced.currency;
                const inPeriod = closing.report.invoices.filter(
                  (entry) =>
                    closing.invoiceCustomerKey.get(entry.invoice.id) ===
                      customerKey &&
                    entry.invoice.amount.currency === invoicedCurrency &&
                    isDayWithin(
                      dayOf(entry.invoice.issuedAt, timeZone),
                      period.from,
                      period.to,
                    ),
                );
                const total = inPeriod.reduce(
                  (sum, entry) => add(sum, moneyOf(entry.invoice.amount)),
                  zero(invoicedCurrency),
                );
                if (compare(row.invoiced, total) !== 0) {
                  issues.push(
                    issue("INVOICED_PERIOD_MISMATCH", {
                      sheet: moneyText(row.invoiced),
                      system: moneyText(total),
                      invoices: listOf(
                        inPeriod.map((entry) => entry.invoice.invoiceNumber),
                      ),
                    }),
                  );
                }
              }
              if (row.received) {
                const receivedCurrency = row.received.currency;
                const inPeriod = closing.receipts.filter(
                  (entry) =>
                    receiptKey(entry) === customerKey &&
                    entry.amount.currency === receivedCurrency &&
                    isDayWithin(
                      dayOf(entry.occurredAt, timeZone),
                      period.from,
                      period.to,
                    ),
                );
                const total = inPeriod.reduce(
                  (sum, entry) => add(sum, moneyOf(entry.amount)),
                  zero(receivedCurrency),
                );
                if (compare(row.received, total) !== 0) {
                  issues.push(
                    issue("RECEIVED_PERIOD_MISMATCH", {
                      sheet: moneyText(row.received),
                      system: moneyText(total),
                      receipts: listOf(
                        inPeriod.map(
                          (entry) =>
                            `${dayOf(entry.occurredAt, timeZone)} ${moneyText(moneyOf(entry.amount))}`,
                        ),
                      ),
                    }),
                  );
                }
              }
            }
          }
        }
      }
    }

    if (sheet) record(sheet, match);
    if (issues.length > 0) rowIssues.set(entry.rowIndex, issues);
    if (Object.keys(view).length > 0) rowSystem.set(entry.rowIndex, view);
  }

  // A VND-only statement is about VND: system-only records and the total
  // are reported for the currencies the sheet actually carries.
  const covered = new Set<Currency>(tallies.keys());
  if (covered.size === 0) covered.add(mapping.defaultCurrency);

  const systemOnly: SystemOnlyItem[] = [];
  for (const row of closing.report.customers) {
    if (!covered.has(row.currency) || isZero(row.balance)) continue;
    if (touchedCustomers.has(`${row.customerKey}|${row.currency}`)) continue;
    systemOnly.push({
      kind: "customer",
      label: row.customerName,
      day: null,
      amount: row.balance,
      issue: issue("CUSTOMER_NOT_IN_SHEET", {
        customer: row.customerName,
        balance: moneyText(row.balance),
      }),
    });
  }
  if (sheetKind === "invoice") {
    for (const row of closing.report.invoices) {
      const currency = row.invoice.amount.currency;
      if (!covered.has(currency) || !isPositive(row.remaining)) continue;
      if (matchedInvoices.has(row.invoice.id)) continue;
      systemOnly.push({
        kind: "invoice",
        label: row.invoice.invoiceNumber,
        day: dayOf(row.invoice.issuedAt, timeZone),
        amount: row.remaining,
        issue: issue("INVOICE_NOT_IN_SHEET", {
          number: row.invoice.invoiceNumber,
          remaining: moneyText(row.remaining),
        }),
      });
    }
  }

  // System-only figures come from the sheet's own key kind, so the
  // decomposition sheet − system = onlySheet − onlySystem + differing holds
  // exactly for every currency.
  for (const currency of covered) {
    const entry = tally(currency);
    if (sheetKind === "invoice") {
      for (const row of closing.report.invoices) {
        if (row.invoice.amount.currency !== currency) continue;
        if (matchedEntries.has(`invoice:${row.invoice.id}`)) continue;
        entry.onlySystem = add(entry.onlySystem, row.remaining);
      }
    } else if (sheetKind === "order") {
      for (const row of closing.report.orders) {
        if (row.currency !== currency) continue;
        if (matchedEntries.has(`order:${row.orderId}|${currency}`)) continue;
        entry.onlySystem = add(entry.onlySystem, row.remaining);
      }
    } else {
      for (const row of closing.report.customers) {
        if (row.currency !== currency) continue;
        if (matchedEntries.has(`customer:${row.customerKey}|${currency}`))
          continue;
        entry.onlySystem = add(entry.onlySystem, row.balance);
      }
    }
  }

  const sheetIssues: Issue[] = [];
  const outstandingTotals = new Map<Currency, string>();
  for (const currency of covered) {
    const entry = tally(currency);
    const systemTotal = add(entry.matchedSystem, entry.onlySystem);
    outstandingTotals.set(currency, systemTotal.amount);
    if (compare(entry.sheet, systemTotal) === 0) continue;
    sheetIssues.push(
      issue("RECEIVABLES_TOTAL_MISMATCH", {
        currency,
        sheet: moneyText(entry.sheet),
        system: moneyText(systemTotal),
        onlySheet: moneyText(entry.onlySheet),
        onlySystem: moneyText(entry.onlySystem),
        differing: moneyText(entry.differing),
      }),
    );
  }

  return {
    rowIssues,
    rowSystem,
    sheetIssues,
    systemOnly,
    systemTotals: new Map<MoneyField, Map<Currency, string>>([
      ["outstanding", outstandingTotals],
    ]),
  };
}
