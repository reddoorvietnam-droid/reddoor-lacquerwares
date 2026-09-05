import type {
  FinanceEntryRecordDto,
  InvoiceRecordDto,
} from "@/domains/finance/contracts";
import type { OrderStage } from "@/domains/orders/workflow";
import {
  add,
  compare,
  convert,
  money,
  subtract,
  zero,
  type Currency,
  type Money,
} from "@/lib/money";

/**
 * The receivables computation, kept pure so every rule the accountant
 * confirmed can be tested with plain numbers.
 *
 * Inputs are records exactly as stored. Outputs are per invoice, per order,
 * and per customer, always per currency — USD and VND are never mixed except
 * in the VND-equivalent revenue figure, which uses the rate snapshotted on
 * each USD invoice.
 *
 * Definitions:
 *
 * - An invoice counts only while it is active and its order is not cancelled.
 * - An allocation counts only while its receipt is active and its target still
 *   counts. An allocation to a voided invoice or a cancelled order is
 *   "dangling": the money is still in the cash total, and it is treated as
 *   unallocated customer credit until the accountant re-allocates or refunds.
 * - A deposit (allocation to an order) is applied to that order's invoices
 *   earliest due date first. Whatever is left is credit.
 * - Invoice remaining = amount − payments − deposit applied. Overdue when
 *   remaining is positive and the due date has passed.
 * - Customer credit = receipts − refunds − the part of the money invoices
 *   actually consumed. Balance = outstanding − credit; negative means the
 *   customer is in advance and the credit offsets the next invoice.
 */

export type ReceivableOrder = {
  id: string;
  orderCode: string;
  customerId: string | null;
  customerName: string;
  stage: OrderStage;
};

export type ReceivablesInput = {
  orders: readonly ReceivableOrder[];
  invoices: readonly InvoiceRecordDto[];
  /** Active or voided; voided entries are ignored. Category `orderPayment`. */
  receipts: readonly FinanceEntryRecordDto[];
  /** Category `refund`. Voided entries are ignored. */
  refunds: readonly FinanceEntryRecordDto[];
  now: Date;
};

export type InvoiceReceivableRow = {
  invoice: InvoiceRecordDto;
  /** Direct payments allocated to this invoice. */
  paid: Money;
  /** Deposits on the order applied to this invoice, earliest due first. */
  depositApplied: Money;
  remaining: Money;
  overdue: boolean;
};

export type OrderReceivableRow = {
  orderId: string;
  orderCode: string;
  customerKey: string;
  customerId: string | null;
  customerName: string;
  currency: Currency;
  invoiced: Money;
  /** Payments allocated to the order's invoices. */
  paid: Money;
  /** Deposits allocated to the order itself. */
  deposits: Money;
  /** invoiced − paid − deposits; negative means the customer is in advance on this order. */
  remaining: Money;
};

export type CustomerReceivableRow = {
  customerKey: string;
  customerId: string | null;
  customerName: string;
  currency: Currency;
  invoiced: Money;
  received: Money;
  refunded: Money;
  /** Sum of the positive invoice remainders. */
  outstanding: Money;
  /** Money received that no invoice has consumed yet. */
  credit: Money;
  /** outstanding − credit. */
  balance: Money;
  overdueInvoiceCount: number;
};

export type ReceivablesTotals = {
  outstanding: readonly Money[];
  credit: readonly Money[];
  revenue: readonly Money[];
  /** Revenue converted to VND through each USD invoice's snapshot. */
  revenueVnd: Money;
  /** False when a USD invoice carries no rate and was left out of `revenueVnd`. */
  revenueVndComplete: boolean;
  overdueInvoiceCount: number;
};

export type ReceivablesReport = {
  invoices: readonly InvoiceReceivableRow[];
  orders: readonly OrderReceivableRow[];
  customers: readonly CustomerReceivableRow[];
  totals: ReceivablesTotals;
};

/** Customers recorded before the list existed are grouped by name. */
export function customerKeyOf(
  customerId: string | null,
  customerName: string,
): string {
  return customerId ?? `name:${customerName.trim().toLowerCase()}`;
}

function isPositive(value: Money): boolean {
  return compare(value, zero(value.currency)) > 0;
}

function min(left: Money, right: Money): Money {
  return compare(left, right) <= 0 ? left : right;
}

function addTo(totals: Map<string, Money>, key: string, value: Money): void {
  const current = totals.get(key);
  totals.set(key, current ? add(current, value) : value);
}

function byCurrency(totals: Map<string, Money>, key: string): Money[] {
  return [...totals.entries()]
    .filter(([entryKey]) => entryKey.startsWith(`${key}|`))
    .map(([, value]) => value);
}

function currencyKey(key: string, currency: Currency): string {
  return `${key}|${currency}`;
}

/** Earliest due first; ties by issue date, then id, so the order is stable. */
function compareInvoicesForSettlement(
  left: InvoiceRecordDto,
  right: InvoiceRecordDto,
): number {
  const due = left.dueAt.getTime() - right.dueAt.getTime();
  if (due !== 0) return due;
  const issued = left.issuedAt.getTime() - right.issuedAt.getTime();
  if (issued !== 0) return issued;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function computeReceivables(input: ReceivablesInput): ReceivablesReport {
  const orders = new Map(input.orders.map((order) => [order.id, order]));
  const isCountedOrder = (orderId: string): boolean => {
    const order = orders.get(orderId);
    return order !== undefined && order.stage !== "cancelled";
  };

  const invoices = input.invoices
    .filter(
      (invoice) => invoice.status === "active" && isCountedOrder(invoice.orderId),
    )
    .sort(compareInvoicesForSettlement);
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));

  const invoicesByOrder = new Map<string, InvoiceRecordDto[]>();
  for (const invoice of invoices) {
    const list = invoicesByOrder.get(invoice.orderId) ?? [];
    list.push(invoice);
    invoicesByOrder.set(invoice.orderId, list);
  }

  // 1. Gather what each receipt applied where. Dangling allocations (to a
  //    voided invoice, a cancelled order, or a wrong currency) are skipped:
  //    the money then simply stays unconsumed and shows as credit.
  const paidByInvoice = new Map<string, Money>();
  const depositsByOrder = new Map<string, Money>(); // key: orderId|currency
  const received = new Map<string, Money>(); // key: customerKey|currency

  for (const receipt of input.receipts) {
    if (receipt.status !== "active" || receipt.kind !== "receipt") continue;
    if (receipt.category !== "orderPayment") continue;
    const currency = receipt.amount.currency;
    const customerKey = customerKeyOf(receipt.customerId, receipt.counterparty);
    addTo(
      received,
      currencyKey(customerKey, currency),
      money(receipt.amount.amount, currency),
    );

    for (const allocation of receipt.allocations) {
      const amount = money(allocation.amount, currency);
      if (allocation.target === "invoice") {
        const invoice = invoiceById.get(allocation.invoiceId);
        if (!invoice || invoice.amount.currency !== currency) continue;
        addTo(paidByInvoice, invoice.id, amount);
      } else {
        if (!isCountedOrder(allocation.orderId)) continue;
        addTo(depositsByOrder, currencyKey(allocation.orderId, currency), amount);
      }
    }
  }

  const refunded = new Map<string, Money>(); // key: customerKey|currency
  for (const refund of input.refunds) {
    if (refund.status !== "active" || refund.category !== "refund") continue;
    const customerKey = customerKeyOf(refund.customerId, refund.counterparty);
    addTo(
      refunded,
      currencyKey(customerKey, refund.amount.currency),
      money(refund.amount.amount, refund.amount.currency),
    );
  }

  // 2. Apply deposits to each order's invoices, earliest due first.
  const depositAppliedByInvoice = new Map<string, Money>();
  for (const [orderId, orderInvoices] of invoicesByOrder) {
    for (const currency of new Set(
      orderInvoices.map((invoice) => invoice.amount.currency),
    )) {
      let depositLeft =
        depositsByOrder.get(currencyKey(orderId, currency)) ?? zero(currency);
      for (const invoice of orderInvoices) {
        if (invoice.amount.currency !== currency) continue;
        if (!isPositive(depositLeft)) break;
        const amount = money(invoice.amount.amount, currency);
        const paid = paidByInvoice.get(invoice.id) ?? zero(currency);
        const open = subtract(amount, paid);
        if (!isPositive(open)) continue;
        const applied = min(open, depositLeft);
        depositAppliedByInvoice.set(invoice.id, applied);
        depositLeft = subtract(depositLeft, applied);
      }
    }
  }

  // 3. Invoice rows.
  const invoiceRows: InvoiceReceivableRow[] = invoices.map((invoice) => {
    const currency = invoice.amount.currency;
    const amount = money(invoice.amount.amount, currency);
    const paid = paidByInvoice.get(invoice.id) ?? zero(currency);
    const depositApplied =
      depositAppliedByInvoice.get(invoice.id) ?? zero(currency);
    const remaining = subtract(subtract(amount, paid), depositApplied);
    const overdue =
      isPositive(remaining) && invoice.dueAt.getTime() < input.now.getTime();
    return { invoice, paid, depositApplied, remaining, overdue };
  });

  // 4. Order rows: every counted order that has an invoice or a deposit.
  const orderRowMap = new Map<string, OrderReceivableRow>();
  const ensureOrderRow = (
    orderId: string,
    currency: Currency,
  ): OrderReceivableRow | null => {
    const order = orders.get(orderId);
    if (!order) return null;
    const key = currencyKey(orderId, currency);
    let row = orderRowMap.get(key);
    if (!row) {
      row = {
        orderId,
        orderCode: order.orderCode,
        customerKey: customerKeyOf(order.customerId, order.customerName),
        customerId: order.customerId,
        customerName: order.customerName,
        currency,
        invoiced: zero(currency),
        paid: zero(currency),
        deposits: zero(currency),
        remaining: zero(currency),
      };
      orderRowMap.set(key, row);
    }
    return row;
  };
  for (const row of invoiceRows) {
    const currency = row.invoice.amount.currency;
    const orderRow = ensureOrderRow(row.invoice.orderId, currency);
    if (!orderRow) continue;
    orderRow.invoiced = add(
      orderRow.invoiced,
      money(row.invoice.amount.amount, currency),
    );
    orderRow.paid = add(orderRow.paid, row.paid);
  }
  for (const [key, deposit] of depositsByOrder) {
    const [orderId] = key.split("|") as [string, Currency];
    const orderRow = ensureOrderRow(orderId, deposit.currency);
    if (!orderRow) continue;
    orderRow.deposits = add(orderRow.deposits, deposit);
  }
  for (const row of orderRowMap.values()) {
    row.remaining = subtract(subtract(row.invoiced, row.paid), row.deposits);
  }

  // 5. Customer rows.
  const customerRowMap = new Map<string, CustomerReceivableRow>();
  const ensureCustomerRow = (
    customerKey: string,
    customerId: string | null,
    customerName: string,
    currency: Currency,
  ): CustomerReceivableRow => {
    const key = currencyKey(customerKey, currency);
    let row = customerRowMap.get(key);
    if (!row) {
      row = {
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
      customerRowMap.set(key, row);
    }
    return row;
  };

  const consumed = new Map<string, Money>(); // key: customerKey|currency
  for (const row of invoiceRows) {
    const currency = row.invoice.amount.currency;
    const order = orders.get(row.invoice.orderId);
    const customerKey = customerKeyOf(
      row.invoice.customerId ?? order?.customerId ?? null,
      row.invoice.customerName || order?.customerName || "",
    );
    const customerRow = ensureCustomerRow(
      customerKey,
      row.invoice.customerId ?? order?.customerId ?? null,
      row.invoice.customerName || order?.customerName || "",
      currency,
    );
    const amount = money(row.invoice.amount.amount, currency);
    customerRow.invoiced = add(customerRow.invoiced, amount);
    if (isPositive(row.remaining)) {
      customerRow.outstanding = add(customerRow.outstanding, row.remaining);
    }
    if (row.overdue) customerRow.overdueInvoiceCount += 1;
    // What this invoice actually consumed: never more than its amount.
    const paidTotal = add(row.paid, row.depositApplied);
    addTo(consumed, currencyKey(customerKey, currency), min(paidTotal, amount));
  }

  const nameByKey = new Map<string, { id: string | null; name: string }>();
  for (const order of input.orders) {
    nameByKey.set(customerKeyOf(order.customerId, order.customerName), {
      id: order.customerId,
      name: order.customerName,
    });
  }
  for (const receipt of input.receipts) {
    if (receipt.status !== "active" || receipt.category !== "orderPayment") {
      continue;
    }
    const key = customerKeyOf(receipt.customerId, receipt.counterparty);
    if (!nameByKey.has(key)) {
      nameByKey.set(key, { id: receipt.customerId, name: receipt.counterparty });
    }
  }
  for (const refund of input.refunds) {
    if (refund.status !== "active" || refund.category !== "refund") continue;
    const key = customerKeyOf(refund.customerId, refund.counterparty);
    if (!nameByKey.has(key)) {
      nameByKey.set(key, { id: refund.customerId, name: refund.counterparty });
    }
  }

  const moneyKeys = new Set([...received.keys(), ...refunded.keys()]);
  for (const key of moneyKeys) {
    const separator = key.lastIndexOf("|");
    const customerKey = key.slice(0, separator);
    const currency = key.slice(separator + 1) as Currency;
    const identity = nameByKey.get(customerKey) ?? {
      id: null,
      name: customerKey.replace(/^name:/, ""),
    };
    ensureCustomerRow(customerKey, identity.id, identity.name, currency);
  }

  for (const row of customerRowMap.values()) {
    const key = currencyKey(row.customerKey, row.currency);
    row.received = received.get(key) ?? zero(row.currency);
    row.refunded = refunded.get(key) ?? zero(row.currency);
    const consumedHere = consumed.get(key) ?? zero(row.currency);
    row.credit = subtract(subtract(row.received, row.refunded), consumedHere);
    row.balance = subtract(row.outstanding, row.credit);
  }

  // 6. Totals.
  const outstanding = new Map<string, Money>();
  const credit = new Map<string, Money>();
  for (const row of customerRowMap.values()) {
    addTo(outstanding, currencyKey("total", row.currency), row.outstanding);
    addTo(credit, currencyKey("total", row.currency), row.credit);
  }
  const revenue = new Map<string, Money>();
  let revenueVnd = zero("VND");
  let revenueVndComplete = true;
  for (const invoice of invoices) {
    const amount = money(invoice.amount.amount, invoice.amount.currency);
    addTo(revenue, currencyKey("total", amount.currency), amount);
    if (amount.currency === "VND") {
      revenueVnd = add(revenueVnd, amount);
    } else if (invoice.fxRateToVnd) {
      revenueVnd = add(
        revenueVnd,
        convert(amount, {
          from: amount.currency,
          to: "VND",
          rate: invoice.fxRateToVnd,
          capturedAt: invoice.issuedAt,
          source: "invoice",
        }),
      );
    } else {
      revenueVndComplete = false;
    }
  }

  const customers = [...customerRowMap.values()].sort((left, right) =>
    left.customerName.localeCompare(right.customerName, "vi"),
  );
  const orderRows = [...orderRowMap.values()].sort((left, right) =>
    left.orderCode.localeCompare(right.orderCode),
  );

  return {
    invoices: invoiceRows,
    orders: orderRows,
    customers,
    totals: {
      outstanding: byCurrency(outstanding, "total"),
      credit: byCurrency(credit, "total"),
      revenue: byCurrency(revenue, "total"),
      revenueVnd,
      revenueVndComplete,
      overdueInvoiceCount: invoiceRows.filter((row) => row.overdue).length,
    },
  };
}

/** The credit one customer holds in one currency, zero when none. */
export function customerCredit(
  report: ReceivablesReport,
  customerKey: string,
  currency: Currency,
): Money {
  const row = report.customers.find(
    (candidate) =>
      candidate.customerKey === customerKey && candidate.currency === currency,
  );
  return row ? row.credit : zero(currency);
}

/**
 * How much of an invoice is still open for allocation: its amount minus every
 * direct allocation from active receipts other than `excludingEntryId`.
 * Deposits are ignored on purpose — a deposit applied by the FIFO rule does
 * not stop the accountant from allocating a later payment explicitly.
 */
export function invoiceAllocationCapacity(
  invoice: InvoiceRecordDto,
  receipts: readonly FinanceEntryRecordDto[],
  excludingEntryId: string | null,
): Money {
  const currency = invoice.amount.currency;
  let allocated = zero(currency);
  for (const receipt of receipts) {
    if (receipt.status !== "active" || receipt.id === excludingEntryId) continue;
    if (receipt.amount.currency !== currency) continue;
    for (const allocation of receipt.allocations) {
      if (
        allocation.target === "invoice" &&
        allocation.invoiceId === invoice.id
      ) {
        allocated = add(allocated, money(allocation.amount, currency));
      }
    }
  }
  return subtract(money(invoice.amount.amount, currency), allocated);
}
