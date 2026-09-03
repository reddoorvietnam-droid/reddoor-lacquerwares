import type { FinanceEntryCategory } from "@/domains/finance/contracts";
import { financePaymentMethods } from "@/domains/finance/contracts";
import type { OrderReadDto } from "@/domains/orders/contracts";
import type { AdminLocale } from "@/lib/i18n/admin";
import { supportedCurrencies } from "@/lib/money";

import { recordFinanceEntryAction } from "./actions";
import { categoryLabels, methodLabels } from "./shared";

const formCopy = {
  vi: {
    order: "Đơn hàng",
    noOrder: "— Không gắn đơn hàng —",
    category: "Hạng mục",
    counterparty: "Đối tác (khách hàng / nhà cung cấp)",
    counterpartyHint: "Để trống nếu gắn đơn hàng — sẽ lấy tên khách của đơn.",
    amount: "Số tiền",
    currency: "Tiền tệ",
    method: "Hình thức",
    date: "Ngày",
    note: "Ghi chú",
    submit: "Ghi phiếu",
  },
  en: {
    order: "Order",
    noOrder: "— No linked order —",
    category: "Category",
    counterparty: "Counterparty (customer / supplier)",
    counterpartyHint: "Leave blank on a linked order — the customer is used.",
    amount: "Amount",
    currency: "Currency",
    method: "Method",
    date: "Date",
    note: "Note",
    submit: "Record entry",
  },
} as const;

const fieldClass =
  "border-burgundy/20 focus:border-burgundy/50 w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none";
const labelClass =
  "text-charcoal/55 mb-1.5 block text-xs font-semibold tracking-[0.08em] uppercase";

export function FinanceEntryForm({
  locale,
  title,
  returnTo,
  categories,
  orders,
  orderRequired,
}: {
  locale: AdminLocale;
  title: string;
  returnTo: "payments" | "ledger" | "expenses";
  categories: readonly FinanceEntryCategory[];
  /** Selectable orders; omit to record entries without an order link. */
  orders: readonly OrderReadDto[];
  orderRequired: boolean;
}) {
  const text = formCopy[locale];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="border-burgundy/15 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)]">
      <h2 className="text-burgundy font-serif text-2xl">{title}</h2>
      <form
        action={recordFinanceEntryAction}
        className="mt-5 grid gap-4 md:grid-cols-2"
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="returnTo" value={returnTo} />

        {orders.length > 0 || orderRequired ? (
          <div className="md:col-span-2">
            <label className={labelClass} htmlFor={`${returnTo}-order`}>
              {text.order}
            </label>
            <select
              id={`${returnTo}-order`}
              name="orderId"
              required={orderRequired}
              defaultValue=""
              className={fieldClass}
            >
              {orderRequired ? null : <option value="">{text.noOrder}</option>}
              {orderRequired ? (
                <option value="" disabled>
                  —
                </option>
              ) : null}
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderCode} · {order.customerName}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label className={labelClass} htmlFor={`${returnTo}-category`}>
            {text.category}
          </label>
          <select
            id={`${returnTo}-category`}
            name="category"
            required
            className={fieldClass}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {categoryLabels[locale][category]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor={`${returnTo}-counterparty`}>
            {text.counterparty}
          </label>
          <input
            id={`${returnTo}-counterparty`}
            type="text"
            name="counterparty"
            maxLength={240}
            required={!orderRequired}
            placeholder={orderRequired ? text.counterpartyHint : undefined}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor={`${returnTo}-amount`}>
            {text.amount}
          </label>
          <input
            id={`${returnTo}-amount`}
            type="text"
            name="amount"
            required
            inputMode="decimal"
            pattern="[0-9]+([.][0-9]+)?"
            placeholder="1500000"
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor={`${returnTo}-currency`}>
            {text.currency}
          </label>
          <select
            id={`${returnTo}-currency`}
            name="currency"
            required
            className={fieldClass}
          >
            {supportedCurrencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor={`${returnTo}-method`}>
            {text.method}
          </label>
          <select
            id={`${returnTo}-method`}
            name="method"
            required
            className={fieldClass}
          >
            {financePaymentMethods.map((method) => (
              <option key={method} value={method}>
                {methodLabels[locale][method]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor={`${returnTo}-date`}>
            {text.date}
          </label>
          <input
            id={`${returnTo}-date`}
            type="date"
            name="occurredAt"
            required
            defaultValue={today}
            className={fieldClass}
          />
        </div>

        <div className="md:col-span-2">
          <label className={labelClass} htmlFor={`${returnTo}-note`}>
            {text.note}
          </label>
          <input
            id={`${returnTo}-note`}
            type="text"
            name="note"
            maxLength={2000}
            className={fieldClass}
          />
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-11 items-center rounded-full px-7 text-sm font-semibold shadow-[0_0.75rem_2rem_rgb(61_13_16/0.18)]"
          >
            {text.submit}
          </button>
        </div>
      </form>
    </section>
  );
}
