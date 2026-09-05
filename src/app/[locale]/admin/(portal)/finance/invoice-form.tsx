import type { AdminLocale } from "@/lib/i18n/admin";
import { supportedCurrencies, type Currency } from "@/lib/money";

import { createInvoiceAction } from "./actions";
import type { EntryFormOption } from "./entry-form";

const formCopy = {
  vi: {
    order: "Đơn hàng",
    number: "Số hóa đơn (INV)",
    issuedAt: "Ngày lập",
    dueAt: "Hạn thanh toán",
    amount: "Giá trị hóa đơn",
    currency: "Tiền tệ",
    rate: "Tỷ giá VND/USD",
    rateHint: (rate: string | null) =>
      rate
        ? `Bỏ trống để lấy tỷ giá trong bảng của ngày lập (hôm nay: ${rate}). Chỉ dùng cho hóa đơn USD.`
        : "Chỉ dùng cho hóa đơn USD. Bảng tỷ giá chưa có tỷ giá cho hôm nay, hãy nhập vào đây hoặc thêm vào bảng tỷ giá.",
    note: "Ghi chú",
    submit: "Lập hóa đơn",
    hint: "Doanh thu ghi theo giá trị hóa đơn. Một đơn có thể có nhiều hóa đơn, mỗi hóa đơn một hạn thanh toán. Lập xong có thể tải file INV lên để khỏi nhập lại tên hàng.",
  },
  en: {
    order: "Order",
    number: "Invoice number (INV)",
    issuedAt: "Issue date",
    dueAt: "Due date",
    amount: "Invoice amount",
    currency: "Currency",
    rate: "VND per USD",
    rateHint: (rate: string | null) =>
      rate
        ? `Leave blank to take the rate table's rate for the issue date (today: ${rate}). USD invoices only.`
        : "USD invoices only. No rate is on file for today: type one or add it to the rate table.",
    note: "Note",
    submit: "Issue invoice",
    hint: "Revenue follows the invoice amount. An order may carry several invoices, each with its own due date. The INV file can be attached afterwards so nothing has to be retyped.",
  },
} as const;

const fieldClass =
  "border-burgundy/20 focus:border-burgundy/50 w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none";
const labelClass =
  "text-charcoal/55 mb-1.5 block text-xs font-semibold tracking-[0.08em] uppercase";

export function InvoiceForm({
  locale,
  title,
  returnTo,
  orders,
  fixedOrderId,
  defaultCurrency = "USD",
  todayRate,
}: {
  locale: AdminLocale;
  title: string;
  returnTo: string;
  /** Selectable orders; omit when pinned to one order. */
  orders?: readonly EntryFormOption[];
  fixedOrderId?: string;
  defaultCurrency?: Currency;
  /** The rate table's rate for today, shown as a hint. */
  todayRate: string | null;
}) {
  const text = formCopy[locale];
  const today = new Date().toISOString().slice(0, 10);
  const prefix = `inv-${returnTo.replace(/[^a-z0-9]/gi, "-")}`;

  return (
    <section className="border-burgundy/15 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)]">
      <h2 className="text-burgundy font-serif text-2xl">{title}</h2>
      <p className="text-charcoal/55 mt-2 text-sm">{text.hint}</p>
      <form
        action={createInvoiceAction}
        className="mt-5 grid gap-4 md:grid-cols-2"
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="returnTo" value={returnTo} />
        {fixedOrderId ? (
          <input type="hidden" name="orderId" value={fixedOrderId} />
        ) : (
          <div className="md:col-span-2">
            <label className={labelClass} htmlFor={`${prefix}-order`}>
              {text.order}
            </label>
            <select
              id={`${prefix}-order`}
              name="orderId"
              required
              defaultValue=""
              className={fieldClass}
            >
              <option value="" disabled>
                —
              </option>
              {(orders ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor={`${prefix}-number`}>
            {text.number}
          </label>
          <input
            id={`${prefix}-number`}
            type="text"
            name="invoiceNumber"
            required
            maxLength={60}
            className={`${fieldClass} font-mono`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor={`${prefix}-issued`}>
              {text.issuedAt}
            </label>
            <input
              id={`${prefix}-issued`}
              type="date"
              name="issuedAt"
              required
              defaultValue={today}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`${prefix}-due`}>
              {text.dueAt}
            </label>
            <input
              id={`${prefix}-due`}
              type="date"
              name="dueAt"
              required
              defaultValue={today}
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor={`${prefix}-amount`}>
            {text.amount}
          </label>
          <input
            id={`${prefix}-amount`}
            type="text"
            name="amount"
            required
            inputMode="decimal"
            pattern="[0-9]+([.][0-9]+)?"
            className={`${fieldClass} font-mono`}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor={`${prefix}-currency`}>
            {text.currency}
          </label>
          <select
            id={`${prefix}-currency`}
            name="currency"
            required
            defaultValue={defaultCurrency}
            className={fieldClass}
          >
            {supportedCurrencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className={labelClass} htmlFor={`${prefix}-rate`}>
            {text.rate}
          </label>
          <input
            id={`${prefix}-rate`}
            type="text"
            name="fxRateToVnd"
            inputMode="decimal"
            pattern="[0-9]+([.][0-9]+)?"
            placeholder={todayRate ?? "25400"}
            className={`${fieldClass} font-mono`}
          />
          <p className="text-charcoal/45 mt-1 text-xs">
            {text.rateHint(todayRate)}
          </p>
        </div>

        <div className="md:col-span-2">
          <label className={labelClass} htmlFor={`${prefix}-note`}>
            {text.note}
          </label>
          <input
            id={`${prefix}-note`}
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
