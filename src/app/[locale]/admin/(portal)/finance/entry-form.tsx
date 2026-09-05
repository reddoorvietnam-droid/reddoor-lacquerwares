import type { FinanceEntryCategory } from "@/domains/finance/contracts";
import { financePaymentMethods } from "@/domains/finance/contracts";
import type { AdminLocale } from "@/lib/i18n/admin";
import { supportedCurrencies, type Currency } from "@/lib/money";

import { recordFinanceEntryAction } from "./actions";
import { categoryLabels, methodLabels } from "./shared";

const formCopy = {
  vi: {
    target: "Gắn vào",
    noTarget: "— Chưa gắn (khách trả trước / trả gộp) —",
    customer: "Khách hàng",
    customerHint: "Bỏ trống nếu đã chọn hóa đơn hoặc đơn ở trên.",
    pickCustomer: "— Chọn khách hàng —",
    supplier: "Nhà cung cấp",
    noSupplier: "— Không có trong danh sách —",
    order: "Đơn hàng",
    noOrder: "— Không gắn đơn hàng —",
    category: "Hạng mục",
    counterparty: "Đối tác / diễn giải",
    counterpartyHint: "Bắt buộc nếu không chọn nhà cung cấp.",
    amount: "Số tiền",
    currency: "Tiền tệ",
    method: "Hình thức",
    date: "Ngày",
    note: "Ghi chú",
    submit: "Ghi phiếu",
  },
  en: {
    target: "Apply to",
    noTarget: "— Not applied yet (advance / lump sum) —",
    customer: "Customer",
    customerHint: "Leave blank if an invoice or order is chosen above.",
    pickCustomer: "— Pick a customer —",
    supplier: "Supplier",
    noSupplier: "— Not in the list —",
    order: "Order",
    noOrder: "— No linked order —",
    category: "Category",
    counterparty: "Counterparty / description",
    counterpartyHint: "Required when no supplier is chosen.",
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

export type EntryFormOption = { value: string; label: string };

/**
 * One form for every kind of ledger entry. The page decides which pickers
 * appear: a customer payment offers an invoice / order to apply to and the
 * customer list; a cost offers the supplier list and the order; a refund is
 * pinned to its customer through hidden fields.
 */
export function FinanceEntryForm({
  locale,
  title,
  returnTo,
  categories,
  targets,
  customers,
  suppliers,
  orders,
  orderRequired = false,
  hidden = {},
  showCounterparty = false,
  counterpartyRequired = false,
  defaultCurrency = "VND",
  defaultAmount = "",
  submitLabel,
  idPrefix,
}: {
  locale: AdminLocale;
  title: string;
  returnTo: string;
  categories: readonly FinanceEntryCategory[];
  /** Allocation targets (`invoice:<id>` / `order:<id>`) for a customer payment. */
  targets?: readonly EntryFormOption[];
  /** Customer picker for a customer payment. */
  customers?: readonly EntryFormOption[];
  /** Supplier picker for a cost. */
  suppliers?: readonly EntryFormOption[];
  /** Order picker for a cost. */
  orders?: readonly EntryFormOption[];
  orderRequired?: boolean;
  /** Pinned values the page already knows. */
  hidden?: { customerId?: string; orderId?: string; allocateTo?: string };
  showCounterparty?: boolean;
  counterpartyRequired?: boolean;
  defaultCurrency?: Currency;
  defaultAmount?: string;
  submitLabel?: string;
  idPrefix?: string;
}) {
  const text = formCopy[locale];
  const today = new Date().toISOString().slice(0, 10);
  const prefix = idPrefix ?? returnTo.replace(/[^a-z0-9]/gi, "-");

  return (
    <section className="border-burgundy/15 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)]">
      <h2 className="text-burgundy font-serif text-2xl">{title}</h2>
      <form
        action={recordFinanceEntryAction}
        className="mt-5 grid gap-4 md:grid-cols-2"
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="returnTo" value={returnTo} />
        {hidden.customerId ? (
          <input type="hidden" name="customerId" value={hidden.customerId} />
        ) : null}
        {hidden.orderId ? (
          <input type="hidden" name="orderId" value={hidden.orderId} />
        ) : null}
        {hidden.allocateTo ? (
          <input type="hidden" name="allocateTo" value={hidden.allocateTo} />
        ) : null}

        {targets ? (
          <div className="md:col-span-2">
            <label className={labelClass} htmlFor={`${prefix}-target`}>
              {text.target}
            </label>
            <select
              id={`${prefix}-target`}
              name="allocateTo"
              defaultValue=""
              className={fieldClass}
            >
              <option value="">{text.noTarget}</option>
              {targets.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {customers ? (
          <div className="md:col-span-2">
            <label className={labelClass} htmlFor={`${prefix}-customer`}>
              {text.customer}
            </label>
            <select
              id={`${prefix}-customer`}
              name="customerId"
              defaultValue=""
              className={fieldClass}
            >
              <option value="">{text.pickCustomer}</option>
              {customers.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {targets ? (
              <p className="text-charcoal/45 mt-1 text-xs">
                {text.customerHint}
              </p>
            ) : null}
          </div>
        ) : null}

        {orders ? (
          <div className="md:col-span-2">
            <label className={labelClass} htmlFor={`${prefix}-order`}>
              {text.order}
            </label>
            <select
              id={`${prefix}-order`}
              name="orderId"
              required={orderRequired}
              defaultValue=""
              className={fieldClass}
            >
              <option value="" disabled={orderRequired}>
                {orderRequired ? "—" : text.noOrder}
              </option>
              {orders.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {categories.length > 1 ? (
          <div>
            <label className={labelClass} htmlFor={`${prefix}-category`}>
              {text.category}
            </label>
            <select
              id={`${prefix}-category`}
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
        ) : (
          <input type="hidden" name="category" value={categories[0]} />
        )}

        {suppliers ? (
          <div>
            <label className={labelClass} htmlFor={`${prefix}-supplier`}>
              {text.supplier}
            </label>
            <select
              id={`${prefix}-supplier`}
              name="supplierId"
              defaultValue=""
              className={fieldClass}
            >
              <option value="">{text.noSupplier}</option>
              {suppliers.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {showCounterparty ? (
          <div className={suppliers ? "md:col-span-2" : ""}>
            <label className={labelClass} htmlFor={`${prefix}-counterparty`}>
              {text.counterparty}
            </label>
            <input
              id={`${prefix}-counterparty`}
              type="text"
              name="counterparty"
              maxLength={240}
              required={counterpartyRequired}
              placeholder={suppliers ? text.counterpartyHint : undefined}
              className={fieldClass}
            />
          </div>
        ) : null}

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
            placeholder="1500000"
            defaultValue={defaultAmount}
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

        <div>
          <label className={labelClass} htmlFor={`${prefix}-method`}>
            {text.method}
          </label>
          <select
            id={`${prefix}-method`}
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
          <label className={labelClass} htmlFor={`${prefix}-date`}>
            {text.date}
          </label>
          <input
            id={`${prefix}-date`}
            type="date"
            name="occurredAt"
            required
            defaultValue={today}
            className={fieldClass}
          />
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
            {submitLabel ?? text.submit}
          </button>
        </div>
      </form>
    </section>
  );
}
