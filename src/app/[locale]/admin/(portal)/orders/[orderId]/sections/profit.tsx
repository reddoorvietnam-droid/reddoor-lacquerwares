import type { OrderProfit } from "@/domains/finance/profit";
import { formatMoney, isNegative } from "@/lib/money";

import { cardClass, headingClass } from "./styles";

/**
 * The Director's profit line for one order: invoices minus the costs booked
 * against it, in VND. Rendered only for `finance.readProfit`, which no other
 * position holds (confirmed 2026-09-14).
 */

const copy = {
  vi: {
    title: "Lợi nhuận đơn hàng",
    hint: "Chỉ Giám đốc xem. Doanh thu = tổng hóa đơn còn hiệu lực; chi phí = tổng phiếu chi gắn với đơn; USD quy đổi theo tỷ giá đã chốt trên từng chứng từ.",
    revenue: "Doanh thu (INV)",
    cost: "Chi phí đã ghi",
    profit: "Lợi nhuận",
    unconverted: (invoices: number, expenses: number) =>
      `Chưa tính: ${invoices} hóa đơn và ${expenses} phiếu chi USD chưa có tỷ giá.`,
  },
  en: {
    title: "Order profit",
    hint: "Director only. Revenue = active invoices; cost = expense entries on the order; USD converts at the rate stored on each document.",
    revenue: "Revenue (INV)",
    cost: "Costs recorded",
    profit: "Profit",
    unconverted: (invoices: number, expenses: number) =>
      `Left out: ${invoices} invoice(s) and ${expenses} USD expense(s) without a rate.`,
  },
} as const;

export function ProfitSection({
  locale,
  profit,
}: {
  locale: "vi" | "en";
  profit: OrderProfit;
}) {
  const text = copy[locale];
  const negative = isNegative(profit.profitVnd);
  return (
    <section className={cardClass}>
      <h2 className={headingClass}>{text.title}</h2>
      <p className="text-charcoal/55 mt-2 text-sm">{text.hint}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-charcoal/60">{text.revenue}</dt>
        <dd className="text-right font-mono">
          {formatMoney(profit.revenueVnd, locale)}
        </dd>
        <dt className="text-charcoal/60">{text.cost}</dt>
        <dd className="text-lacquer text-right font-mono">
          {formatMoney(profit.costVnd, locale)}
        </dd>
        <dt className="text-charcoal/80 font-semibold">{text.profit}</dt>
        <dd
          className={`text-right font-mono font-semibold ${
            negative ? "text-lacquer" : "text-emerald-700"
          }`}
        >
          {formatMoney(profit.profitVnd, locale)}
        </dd>
      </dl>
      {profit.unconvertedInvoices > 0 || profit.unconvertedExpenses > 0 ? (
        <p className="text-charcoal/50 mt-3 text-xs">
          {text.unconverted(
            profit.unconvertedInvoices,
            profit.unconvertedExpenses,
          )}
        </p>
      ) : null}
    </section>
  );
}
