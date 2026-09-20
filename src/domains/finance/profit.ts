import type {
  FinanceEntryRecordDto,
  InvoiceRecordDto,
} from "@/domains/finance/contracts";
import { add, convert, money, subtract, zero, type Money } from "@/lib/money";

/**
 * Profit of one order as the Director reads it (the only reader, confirmed
 * 2026-09-14): revenue is the sum of the active invoices, cost the sum of the
 * active expense entries booked against the order, both in VND. A USD line
 * converts at the rate snapshot it was recorded with; a line without one is
 * left out and counted, so the figure is never silently short.
 */
export type OrderProfit = {
  revenueVnd: Money;
  costVnd: Money;
  profitVnd: Money;
  /** Active USD invoices with no rate on file. */
  unconvertedInvoices: number;
  /** Active USD expenses with no rate on file. */
  unconvertedExpenses: number;
};

function toVnd(
  amount: { amount: string; currency: string },
  rate: string | null,
  at: Date,
): Money | null {
  const value = money(amount.amount, amount.currency);
  if (value.currency === "VND") return value;
  if (!rate) return null;
  return convert(value, {
    from: "USD",
    to: "VND",
    rate,
    capturedAt: at,
    source: "snapshot",
  });
}

export function orderProfit(
  invoices: readonly InvoiceRecordDto[],
  expenses: readonly FinanceEntryRecordDto[],
): OrderProfit {
  let revenueVnd = zero("VND");
  let costVnd = zero("VND");
  let unconvertedInvoices = 0;
  let unconvertedExpenses = 0;

  for (const invoice of invoices) {
    if (invoice.status !== "active") continue;
    const value = toVnd(invoice.amount, invoice.fxRateToVnd, invoice.issuedAt);
    if (value) revenueVnd = add(revenueVnd, value);
    else unconvertedInvoices += 1;
  }

  for (const entry of expenses) {
    if (entry.status !== "active" || entry.kind !== "expense") continue;
    const value = toVnd(entry.amount, entry.fxRateToVnd, entry.occurredAt);
    if (value) costVnd = add(costVnd, value);
    else unconvertedExpenses += 1;
  }

  return {
    revenueVnd,
    costVnd,
    profitVnd: subtract(revenueVnd, costVnd),
    unconvertedInvoices,
    unconvertedExpenses,
  };
}
