import type { InvoiceRecordDto } from "@/domains/finance/contracts";
import {
  computeReceivables,
  type InvoiceReceivableRow,
} from "@/domains/finance/receivables";
import type { Permission } from "@/domains/identity/permissions";
import {
  templateFields,
  type CanonicalField,
  type ColumnMapping,
  type RowSystemView,
  type SystemInvoiceView,
} from "@/domains/sheet-checks/contracts";
import { issue, type Issue } from "@/domains/sheet-checks/issues";
import { looseKey, normalizeName } from "@/domains/sheet-checks/parsing/code";
import { moneyText } from "@/domains/sheet-checks/parsing/money";
import { resolveCustomer } from "@/domains/sheet-checks/reconcile/customers";
import {
  compareStage,
  orderIssues,
  resolveOrder,
  type OrderIndex,
} from "@/domains/sheet-checks/reconcile/orders";
import {
  customerView,
  dayOf,
  diffText,
  moneyOf,
  orderView,
  type ReconcileInput,
} from "@/domains/sheet-checks/reconcile/shared";
import { compare, zero } from "@/lib/money";

/**
 * Generic order-list engine ("danh sách đơn hàng").
 *
 * Every row names an order; that lookup is the only comparison the template
 * gate (`orders.read`) pays for. Everything else is opportunistic: a column
 * is compared only when the snapshot holds the governing part, and each
 * part actually used is reported in `exercised` so readers of the result
 * need the same permission. A part the runner lacks yields one sheet-level
 * `*_NOT_COMPARED` note and nothing per row — not a hint, not a count, and
 * no money in the row's system view.
 */

export type GenericOutput = {
  rowIssues: Map<number, Issue[]>;
  rowSystem: Map<number, RowSystemView>;
  sheetIssues: Issue[];
  systemOnly: [];
  exercised: Permission[];
};

/** Same normalisation `normalizeInvoiceNumber` applies to a sheet cell. */
function invoiceKey(text: string): string {
  return text.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
}

function mappedColumn(
  columns: readonly ColumnMapping[],
  field: CanonicalField,
): ColumnMapping | null {
  return columns.find((column) => column.field === field) ?? null;
}

function invoiceView(
  invoice: InvoiceRecordDto,
  row: InvoiceReceivableRow | undefined,
  timeZone: string,
): SystemInvoiceView {
  const nothing = zero(invoice.amount.currency);
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    orderCode: invoice.orderCode,
    customerName: invoice.customerName,
    amount: moneyOf(invoice.amount),
    paid: row?.paid ?? nothing,
    depositApplied: row?.depositApplied ?? nothing,
    remaining: row?.remaining ?? nothing,
    issuedDay: dayOf(invoice.issuedAt, timeZone),
    dueDay: dayOf(invoice.dueAt, timeZone),
    status: invoice.status,
    voidReason: invoice.voidReason,
  };
}

type InvoiceLookup = {
  byNumber: Map<string, InvoiceRecordDto[]>;
  byLoose: Map<string, InvoiceRecordDto[]>;
};

function indexInvoices(invoices: readonly InvoiceRecordDto[]): InvoiceLookup {
  const byNumber = new Map<string, InvoiceRecordDto[]>();
  const byLoose = new Map<string, InvoiceRecordDto[]>();
  for (const invoice of invoices) {
    const key = invoiceKey(invoice.invoiceNumber);
    byNumber.set(key, [...(byNumber.get(key) ?? []), invoice]);
    const loose = looseKey(invoice.invoiceNumber);
    byLoose.set(loose, [...(byLoose.get(loose) ?? []), invoice]);
  }
  return { byNumber, byLoose };
}

/** Prefers an active invoice; a voided one only when nothing else carries the number. */
function pick(
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
  lookup: InvoiceLookup,
  number: string,
): { invoice: InvoiceRecordDto; loose: boolean } | null {
  const exact = pick(lookup.byNumber.get(invoiceKey(number)));
  if (exact) return { invoice: exact, loose: false };
  const loose = pick(lookup.byLoose.get(looseKey(number)));
  return loose ? { invoice: loose, loose: true } : null;
}

export function reconcileGeneric(
  input: ReconcileInput & { orderIndex: OrderIndex },
): GenericOutput {
  const { system, mapping, timeZone } = input;
  const relevant = new Set<CanonicalField>([
    ...templateFields.generic.required,
    ...templateFields.generic.identityAnyOf,
    ...templateFields.generic.optional,
  ]);
  const columns = mapping.columns.filter((column) =>
    relevant.has(column.field),
  );
  const amountColumn = mappedColumn(columns, "amount");
  const invoiceColumn = mappedColumn(columns, "invoiceNumber");
  const stageColumn = mappedColumn(columns, "stage");
  const customerColumn =
    mappedColumn(columns, "customerName") ??
    mappedColumn(columns, "customerCode");

  const comparingSellingPrice =
    mapping.compareSellingPrice &&
    system.sellingPriceVisible &&
    amountColumn !== null;
  const invoicesVisible = system.invoices !== null;
  const comparingInvoices = invoiceColumn !== null && invoicesVisible;
  // Without a selling price to compare with, the amount column can still be
  // checked against the invoice when invoices are readable.
  const amountAgainstInvoice =
    comparingInvoices && !comparingSellingPrice && amountColumn !== null;

  const sheetIssues: Issue[] = [];
  if (amountColumn && !comparingSellingPrice && !amountAgainstInvoice) {
    sheetIssues.push(
      issue(
        // A runner who holds the permission but left the comparison off is
        // told exactly that; only a missing permission gets the other text.
        input.system.sellingPriceGranted && !input.mapping.compareSellingPrice
          ? "AMOUNT_COMPARE_DISABLED"
          : "AMOUNT_NOT_COMPARED",
        {},
        { columnIndex: amountColumn.columnIndex },
      ),
    );
  }
  if (invoiceColumn && !invoicesVisible) {
    sheetIssues.push(
      issue(
        "INVOICE_NOT_COMPARED",
        {},
        { columnIndex: invoiceColumn.columnIndex },
      ),
    );
  }
  if (customerColumn && system.customers === null) {
    sheetIssues.push(
      issue(
        "CUSTOMER_NOT_COMPARED",
        {},
        { columnIndex: customerColumn.columnIndex },
      ),
    );
  }

  const invoiceLookup =
    comparingInvoices && system.invoices
      ? indexInvoices(system.invoices)
      : null;
  let receiptsConsulted = false;
  let directoryConsulted = false;
  // Receipts are consulted only to show what a matched invoice still has
  // open — that is the moment `payments.read` becomes a requirement for
  // readers, so the report is built lazily.
  let invoiceFigures: Map<string, InvoiceReceivableRow> | null = null;
  const figuresFor = (invoiceId: string): InvoiceReceivableRow | undefined => {
    if (system.receipts === null || system.invoices === null) return undefined;
    if (invoiceFigures === null) {
      const report = computeReceivables({
        orders: (system.orders ?? []).map((order) => ({
          id: order.id,
          orderCode: order.orderCode,
          customerId: order.customerId,
          customerName: order.customerName,
          stage: order.stage,
        })),
        invoices: system.invoices,
        receipts: system.receipts,
        refunds: system.refunds ?? [],
        now: input.now,
      });
      invoiceFigures = new Map(
        report.invoices.map((row) => [row.invoice.id, row]),
      );
      receiptsConsulted = true;
    }
    return invoiceFigures.get(invoiceId);
  };

  const rowIssues = new Map<number, Issue[]>();
  const rowSystem = new Map<number, RowSystemView>();

  for (const entry of input.parsed.rows) {
    if (entry.skipped) continue;
    const row = entry.parsed;
    if (!row.orderCode) continue;
    const issues: Issue[] = [];
    const resolved = resolveOrder(row.orderCode, input.orderIndex);
    issues.push(...resolved.issues);
    const order = resolved.order;
    if (!order) {
      rowIssues.set(entry.rowIndex, issues);
      rowSystem.set(entry.rowIndex, { order: null });
      continue;
    }
    issues.push(...orderIssues(order));
    const sellingPrice =
      comparingSellingPrice && order.sellingPrice
        ? moneyOf(order.sellingPrice)
        : null;
    const view: RowSystemView = { order: orderView(order, sellingPrice) };

    if (customerColumn && (row.customerName || row.customerCode)) {
      const sheetLabel = row.customerName ?? row.customerCode ?? "";
      if (system.customers !== null) {
        directoryConsulted = true;
        const resolution = resolveCustomer({
          name: row.customerName,
          code: row.customerCode,
          directory: system.customers,
          fallback: null,
        });
        issues.push(...resolution.issues);
        const record = resolution.customerId
          ? system.customers.find(
              (candidate) => candidate.id === resolution.customerId,
            )
          : undefined;
        if (record) view.customer = customerView(record);
        // A customer code is not a name: comparing "KH0009" with "Khách A"
        // would contradict an order the sheet never disagreed with.
        const sheetName = resolution.customerName ?? row.customerName;
        const differs =
          resolution.customerId !== null && order.customerId !== null
            ? resolution.customerId !== order.customerId
            : sheetName !== null &&
              normalizeName(sheetName) !== normalizeName(order.customerName);
        if (differs) {
          issues.push(
            issue("ORDER_CUSTOMER_MISMATCH", {
              sheet: sheetLabel,
              system: order.customerName,
            }),
          );
        }
      } else if (
        row.customerName &&
        normalizeName(row.customerName) !== normalizeName(order.customerName)
      ) {
        issues.push(
          issue("ORDER_CUSTOMER_MISMATCH", {
            sheet: row.customerName,
            system: order.customerName,
          }),
        );
      }
    }

    if (stageColumn && row.stage) {
      const stageIssue = compareStage(row.stage, order);
      if (stageIssue) issues.push(stageIssue);
    }

    if (comparingSellingPrice) {
      if (!sellingPrice) {
        issues.push(issue("SELLING_PRICE_UNSET", { code: order.orderCode }));
      } else if (row.amount) {
        if (row.amount.currency !== sellingPrice.currency) {
          issues.push(
            issue("CURRENCY_MISMATCH", {
              sheet: row.amount.currency,
              system: sellingPrice.currency,
            }),
          );
        } else if (compare(row.amount, sellingPrice) === 0) {
          issues.push(
            issue("SELLING_PRICE_MATCH", {
              code: order.orderCode,
              system: moneyText(sellingPrice),
            }),
          );
        } else {
          issues.push(
            issue("SELLING_PRICE_MISMATCH", {
              code: order.orderCode,
              system: moneyText(sellingPrice),
              sheet: moneyText(row.amount),
              diff: diffText(row.amount, sellingPrice),
            }),
          );
        }
      }
    }

    if (invoiceLookup && row.invoiceNumber) {
      const found = findInvoice(invoiceLookup, row.invoiceNumber);
      if (!found) {
        issues.push(issue("INVOICE_NOT_FOUND", { number: row.invoiceNumber }));
      } else {
        const { invoice } = found;
        const number = invoice.invoiceNumber;
        issues.push(issue("INVOICE_MATCHED", { number }));
        if (found.loose) {
          issues.push(
            issue("INVOICE_MATCH_LOOSE", {
              sheet: row.invoiceNumber,
              system: number,
            }),
          );
        }
        if (invoice.status === "voided") {
          issues.push(
            issue("INVOICE_VOIDED", {
              number,
              reason: invoice.voidReason ?? "",
            }),
          );
        }
        if (invoice.orderId !== order.id) {
          issues.push(
            issue("INVOICE_ORDER_MISMATCH", {
              number,
              system: invoice.orderCode,
              sheet: order.orderCode,
            }),
          );
        }
        if (amountAgainstInvoice && row.amount) {
          const amount = moneyOf(invoice.amount);
          if (row.amount.currency !== amount.currency) {
            issues.push(
              issue("INVOICE_CURRENCY_MISMATCH", {
                number,
                system: amount.currency,
                sheet: row.amount.currency,
              }),
            );
          } else if (compare(row.amount, amount) !== 0) {
            issues.push(
              issue("INVOICE_AMOUNT_MISMATCH", {
                number,
                system: moneyText(amount),
                sheet: moneyText(row.amount),
                diff: diffText(row.amount, amount),
              }),
            );
          }
        }
        // The open figures need receipts; without them the row keeps the
        // findings only, never a "remaining" that would be a guess.
        if (system.receipts !== null) {
          view.invoice = invoiceView(invoice, figuresFor(invoice.id), timeZone);
        }
      }
    }

    rowIssues.set(entry.rowIndex, issues);
    rowSystem.set(entry.rowIndex, view);
  }

  const exercised: Permission[] = [];
  if (comparingSellingPrice) exercised.push("orders.readSellingPrice");
  if (comparingInvoices) exercised.push("invoices.read");
  if (receiptsConsulted) exercised.push("payments.read");
  if (directoryConsulted) exercised.push("customers.read");

  return { rowIssues, rowSystem, sheetIssues, systemOnly: [], exercised };
}
