import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";

import { createOrderAction } from "@/app/[locale]/admin/(portal)/orders/actions";
import { customerCommandService } from "@/domains/customers/runtime";
import { getBusinessUnitModel } from "@/domains/identity/models";
import { supportedCurrencies } from "@/lib/money";
import {
  ContentAccessDeniedError,
  requireListAccess,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongoose";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Đơn hàng",
    title: "Nhận đơn hàng từ khách hàng",
    description:
      "Bước 1 của quy trình: ghi nhận đơn hàng vào sổ. Chọn khách hàng từ danh sách để công nợ và tiền trả trước cộng đúng theo khách. Giá bán là trường nhạy cảm, chỉ Giám đốc và Kế toán công ty đọc lại được.",
    back: "← Sổ đơn hàng",
    codeLabel: "Mã đơn (bỏ trống để hệ thống tự sinh)",
    customerLabel: "Khách hàng",
    customerPick: "— Chọn khách hàng —",
    customerHint: "Chưa có khách? Thêm ở trang Khách hàng rồi quay lại.",
    customersLink: "Mở danh sách khách hàng →",
    noCustomerAccess:
      "Bạn không có quyền xem danh sách khách hàng, nên không tạo được đơn. Nhờ kế toán công ty tạo đơn.",
    unitsLabel: "Đơn vị kinh doanh thực hiện",
    unitsHint:
      "Chọn ít nhất một đơn vị. Bạn chỉ tạo được đơn trong các đơn vị mình được cấp quyền.",
    priceLabel: "Giá bán (tùy chọn)",
    currencyLabel: "Tiền tệ",
    notesLabel: "Ghi chú",
    submit: "Ghi nhận đơn hàng",
    noUnits:
      "Chưa có đơn vị kinh doanh nào trong hệ thống. Chạy `npm run seed -- --with-demo` hoặc tạo đơn vị trước.",
    errorLead: "Không tạo được đơn:",
    errors: {
      FORBIDDEN: "Bạn không có quyền tạo đơn trong các đơn vị đã chọn.",
      DUPLICATE_ORDER_CODE: "Mã đơn này đã tồn tại.",
      CUSTOMER_NOT_FOUND: "Chưa chọn khách hàng hoặc khách hàng không tồn tại.",
      CUSTOMER_ARCHIVED: "Khách hàng này đã lưu trữ, khôi phục trước khi tạo đơn.",
      INVALID_PRICE: "Giá bán không hợp lệ với loại tiền đã chọn.",
      INVALID_INPUT: "Dữ liệu nhập chưa hợp lệ.",
      UNAVAILABLE: "Hệ thống tạm thời không phản hồi.",
    } as Record<string, string>,
  },
  en: {
    eyebrow: "Orders",
    title: "Customer order received",
    description:
      "Step 1 of the process: enter the order into the book. Pick the customer from the list so receivables and advances add up per customer. The selling price is a sensitive field; only the Director and the Company Accountant can read it back.",
    back: "← Order book",
    codeLabel: "Order code (leave empty to auto-generate)",
    customerLabel: "Customer",
    customerPick: "— Pick a customer —",
    customerHint: "Customer missing? Add it on the Customers page and come back.",
    customersLink: "Open the customer list →",
    noCustomerAccess:
      "You cannot read the customer list, so you cannot create an order. Ask the Company Accountant.",
    unitsLabel: "Executing business units",
    unitsHint:
      "Pick at least one. You can only create orders inside units you hold a grant for.",
    priceLabel: "Selling price (optional)",
    currencyLabel: "Currency",
    notesLabel: "Notes",
    submit: "Record the order",
    noUnits:
      "No business units exist yet. Run `npm run seed -- --with-demo` or create units first.",
    errorLead: "The order was not created:",
    errors: {
      FORBIDDEN: "You lack the permission to create orders in these units.",
      DUPLICATE_ORDER_CODE: "This order code already exists.",
      CUSTOMER_NOT_FOUND: "No customer chosen, or the customer does not exist.",
      CUSTOMER_ARCHIVED: "This customer is archived; restore it before creating an order.",
      INVALID_PRICE: "The price is not valid for the chosen currency.",
      INVALID_INPUT: "The submitted data is not valid.",
      UNAVAILABLE: "The system is temporarily unavailable.",
    } as Record<string, string>,
  },
} as const;

type BusinessUnitOption = { id: string; code: string; name: string };

async function listBusinessUnits(): Promise<BusinessUnitOption[]> {
  await connectToDatabase();
  const documents = await getBusinessUnitModel()
    .find({ status: "active" })
    .sort({ code: 1 })
    .limit(100)
    .lean<{ _id: Types.ObjectId; code: string; name: string }[]>()
    .exec();
  return documents.map((unit) => ({
    id: unit._id.toHexString(),
    code: unit.code,
    name: unit.name,
  }));
}

export default async function AdminNewOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ locale: requestedLocale }, { error }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];

  try {
    await requireListAccess("orders.read");
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const [units, coverages] = await Promise.all([
    listBusinessUnits(),
    resolvePermissionCoverages(["orders.create", "customers.read"] as const),
  ]);
  const creatable = coverages["orders.create"];
  const offeredUnits = creatable.global
    ? units
    : units.filter((unit) => creatable.businessUnitIds.includes(unit.id));
  const canPickCustomer = coverages["customers.read"].global;
  const customers = canPickCustomer
    ? await customerCommandService.list({ status: "active" })
    : [];

  const fieldClass =
    "border-burgundy/20 focus:border-burgundy/50 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none";

  return (
    <div className="max-w-2xl">
      <Link
        href={`/${locale}/admin/orders` as Route}
        className="text-charcoal/55 hover:text-burgundy text-sm"
      >
        {text.back}
      </Link>
      <p className="eyebrow mt-6">{text.eyebrow}</p>
      <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em]">
        {text.title}
      </h1>
      <p className="text-charcoal/65 mt-5 text-base leading-7">
        {text.description}
      </p>

      {error ? (
        <p className="border-lacquer/40 bg-lacquer/5 text-lacquer mt-8 rounded-2xl border px-5 py-4 text-sm">
          {text.errorLead} {text.errors[error] ?? text.errors.UNAVAILABLE}
        </p>
      ) : null}

      {offeredUnits.length === 0 ? (
        <p className="border-gold/40 bg-gold/10 text-charcoal/75 mt-8 rounded-2xl border px-5 py-4 text-sm leading-6">
          {text.noUnits}
        </p>
      ) : !canPickCustomer ? (
        <p className="border-gold/40 bg-gold/10 text-charcoal/75 mt-8 rounded-2xl border px-5 py-4 text-sm leading-6">
          {text.noCustomerAccess}
        </p>
      ) : (
        <form action={createOrderAction} className="mt-10 space-y-6">
          <input type="hidden" name="locale" value={locale} />

          <div>
            <label
              htmlFor="order-customer"
              className="text-charcoal/70 mb-2 block text-sm font-semibold"
            >
              {text.customerLabel}
            </label>
            <select
              id="order-customer"
              name="customerId"
              required
              defaultValue=""
              className={fieldClass}
            >
              <option value="" disabled>
                {text.customerPick}
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.code ? `${customer.name} (${customer.code})` : customer.name}
                </option>
              ))}
            </select>
            <p className="text-charcoal/50 mt-2 text-xs">
              {text.customerHint}{" "}
              <Link
                href={`/${locale}/admin/customers` as Route}
                className="text-burgundy font-semibold hover:underline"
              >
                {text.customersLink}
              </Link>
            </p>
          </div>

          <div>
            <label
              htmlFor="order-code"
              className="text-charcoal/70 mb-2 block text-sm font-semibold"
            >
              {text.codeLabel}
            </label>
            <input
              id="order-code"
              name="orderCode"
              maxLength={40}
              placeholder="RD-20260827-XXXX"
              className={`${fieldClass} font-mono uppercase`}
            />
          </div>

          <fieldset>
            <legend className="text-charcoal/70 mb-2 block text-sm font-semibold">
              {text.unitsLabel}
            </legend>
            <p className="text-charcoal/50 mb-3 text-xs">{text.unitsHint}</p>
            <div className="space-y-2">
              {offeredUnits.map((unit) => (
                <label
                  key={unit.id}
                  className="border-burgundy/15 flex items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm"
                >
                  <input
                    type="checkbox"
                    name="businessUnitIds"
                    value={unit.id}
                    className="accent-lacquer h-4 w-4"
                  />
                  <span className="text-charcoal/45 font-mono text-xs">
                    {unit.code}
                  </span>
                  <span className="text-charcoal/80">{unit.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-[1fr_8rem] gap-4">
            <div>
              <label
                htmlFor="order-price"
                className="text-charcoal/70 mb-2 block text-sm font-semibold"
              >
                {text.priceLabel}
              </label>
              <input
                id="order-price"
                name="sellingPriceAmount"
                inputMode="decimal"
                maxLength={40}
                placeholder="1250.00"
                className={`${fieldClass} font-mono`}
              />
            </div>
            <div>
              <label
                htmlFor="order-currency"
                className="text-charcoal/70 mb-2 block text-sm font-semibold"
              >
                {text.currencyLabel}
              </label>
              <select
                id="order-currency"
                name="sellingPriceCurrency"
                defaultValue="USD"
                className={fieldClass}
              >
                {supportedCurrencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="order-notes"
              className="text-charcoal/70 mb-2 block text-sm font-semibold"
            >
              {text.notesLabel}
            </label>
            <textarea
              id="order-notes"
              name="notes"
              rows={3}
              maxLength={4000}
              className={fieldClass}
            />
          </div>

          <button
            type="submit"
            className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-12 items-center rounded-full px-7 text-sm font-semibold shadow-[0_0.75rem_2rem_rgb(61_13_16/0.18)]"
          >
            {text.submit}
          </button>
        </form>
      )}
    </div>
  );
}
