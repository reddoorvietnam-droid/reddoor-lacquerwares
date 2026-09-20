import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";

import { createOrderAction } from "@/app/[locale]/admin/(portal)/orders/actions";
import { LineItemsEditor } from "@/app/[locale]/admin/(portal)/orders/line-items-editor";
import { customerCommandService } from "@/domains/customers/runtime";
import { getBusinessUnitModel } from "@/domains/identity/models";
import { readLookups } from "@/domains/materials/service";
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
    title: "Khách hàng đặt hàng",
    description:
      "Bước 1 của quy trình: ghi đơn vào sổ với từng mã hàng, số lượng, đơn vị sản xuất, shipping mark và ngày giao cam kết. Chọn khách hàng từ danh sách để công nợ và tiền trả trước cộng đúng theo khách. Sau khi ghi, đơn được trình Giám đốc xác nhận.",
    back: "← Sổ đơn hàng",
    codeLabel: "Mã đơn (bỏ trống để hệ thống tự sinh)",
    customerLabel: "Khách hàng",
    customerPick: "— Chọn khách hàng —",
    customerHint: "Chưa có khách? Thêm ở trang Khách hàng rồi quay lại.",
    customersLink: "Mở danh sách khách hàng →",
    noCustomers:
      "Chưa có khách hàng nào trong danh sách. Nhờ Kế toán công ty thêm khách trước.",
    unitsLabel: "Đơn vị kinh doanh thực hiện",
    unitsHint:
      "Chọn ít nhất một đơn vị. Bạn chỉ tạo được đơn trong các đơn vị mình được cấp quyền.",
    linesLabel: "Hàng đặt",
    linesHint:
      "Mỗi dòng một mã hàng. Đơn vị sản xuất là cơ sở làm mã hàng đó; gõ để chọn từ danh sách cơ sở của kho.",
    shippingMarkLabel: "Shipping mark",
    deliveryDueLabel: "Ngày giao cam kết",
    targetsLabel: "Chỉ tiêu riêng của đơn (tùy chọn)",
    targetsHint:
      "Ví dụ: tỷ lệ lỗi ≤ 2%, hao hụt ≤ 5%. Chỉ tiêu được quy định theo từng đơn.",
    priceLabel: "Giá bán (tùy chọn)",
    currencyLabel: "Tiền tệ",
    notesLabel: "Ghi chú",
    submit: "Ghi nhận đơn hàng",
    noUnits:
      "Chưa có đơn vị kinh doanh nào trong hệ thống. Chạy `npm run seed -- --with-demo` hoặc tạo đơn vị trước.",
    noAccess:
      "Vị trí của bạn không tạo đơn hàng. Quản lý xưởng hoặc Kế toán công ty là người ghi đơn.",
    errorLead: "Không tạo được đơn:",
    errors: {
      FORBIDDEN: "Bạn không có quyền tạo đơn trong các đơn vị đã chọn.",
      DUPLICATE_ORDER_CODE: "Mã đơn này đã tồn tại.",
      CUSTOMER_NOT_FOUND: "Chưa chọn khách hàng hoặc khách hàng không tồn tại.",
      CUSTOMER_ARCHIVED:
        "Khách hàng này đã lưu trữ, khôi phục trước khi tạo đơn.",
      INVALID_PRICE: "Giá bán không hợp lệ với loại tiền đã chọn.",
      INVALID_INPUT:
        "Dữ liệu nhập chưa hợp lệ. Kiểm tra mã hàng, số lượng (chỉ gõ chữ số) và ngày giao.",
      UNAVAILABLE: "Hệ thống tạm thời không phản hồi.",
    } as Record<string, string>,
  },
  en: {
    eyebrow: "Orders",
    title: "Customer order",
    description:
      "Step 1 of the process: enter the order with each item code, quantity, production site, shipping mark and promised delivery date. Pick the customer from the list so receivables and advances add up per customer. Once recorded, the order is submitted to the Director.",
    back: "← Order book",
    codeLabel: "Order code (leave empty to auto-generate)",
    customerLabel: "Customer",
    customerPick: "— Pick a customer —",
    customerHint:
      "Customer missing? Add it on the Customers page and come back.",
    customersLink: "Open the customer list →",
    noCustomers:
      "No customer exists yet. Ask the Company Accountant to add one first.",
    unitsLabel: "Executing business units",
    unitsHint:
      "Pick at least one. You can only create orders inside units you hold a grant for.",
    linesLabel: "Items ordered",
    linesHint:
      "One line per item code. The production site is the workshop making that item; type to pick from the stock ledger's sites.",
    shippingMarkLabel: "Shipping mark",
    deliveryDueLabel: "Promised delivery date",
    targetsLabel: "Targets for this order (optional)",
    targetsHint:
      "For example: defects ≤ 2%, waste ≤ 5%. Targets are set per order.",
    priceLabel: "Selling price (optional)",
    currencyLabel: "Currency",
    notesLabel: "Notes",
    submit: "Record the order",
    noUnits:
      "No business units exist yet. Run `npm run seed -- --with-demo` or create units first.",
    noAccess:
      "Your position does not create orders. The Factory Manager or the Company Accountant records them.",
    errorLead: "The order was not created:",
    errors: {
      FORBIDDEN: "You lack the permission to create orders in these units.",
      DUPLICATE_ORDER_CODE: "This order code already exists.",
      CUSTOMER_NOT_FOUND: "No customer chosen, or the customer does not exist.",
      CUSTOMER_ARCHIVED:
        "This customer is archived; restore it before creating an order.",
      INVALID_PRICE: "The price is not valid for the chosen currency.",
      INVALID_INPUT:
        "The submitted data is not valid. Check the item codes, quantities (digits only) and the delivery date.",
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

async function facilityNames(): Promise<string[]> {
  try {
    const { facilities } = await readLookups();
    return facilities
      .filter((facility) => facility.active)
      .map((facility) => facility.name)
      .filter((name) => name.length > 0);
  } catch {
    return [];
  }
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
    resolvePermissionCoverages([
      "orders.create",
      "orders.readSellingPrice",
      "customers.read",
    ] as const),
  ]);
  const creatable = coverages["orders.create"];
  const canCreate = creatable.global || creatable.businessUnitIds.length > 0;
  const offeredUnits = creatable.global
    ? units
    : units.filter((unit) => creatable.businessUnitIds.includes(unit.id));
  // Whoever records an order picks the customer by name; the customer file
  // itself (contacts, tax code) stays behind `customers.read`.
  const canOpenCustomers = coverages["customers.read"].global;
  const canEnterPrice = coverages["orders.readSellingPrice"].global;
  const [customers, facilities] = canCreate
    ? await Promise.all([
        customerCommandService.list({ status: "active" }),
        facilityNames(),
      ])
    : [[], []];

  const fieldClass =
    "border-burgundy/20 focus:border-burgundy/50 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none";
  const labelClass = "text-charcoal/70 mb-2 block text-sm font-semibold";

  return (
    <div className="max-w-4xl">
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

      {!canCreate ? (
        <p className="border-gold/40 bg-gold/10 text-charcoal/75 mt-8 rounded-2xl border px-5 py-4 text-sm leading-6">
          {text.noAccess}
        </p>
      ) : offeredUnits.length === 0 ? (
        <p className="border-gold/40 bg-gold/10 text-charcoal/75 mt-8 rounded-2xl border px-5 py-4 text-sm leading-6">
          {text.noUnits}
        </p>
      ) : customers.length === 0 ? (
        <p className="border-gold/40 bg-gold/10 text-charcoal/75 mt-8 rounded-2xl border px-5 py-4 text-sm leading-6">
          {text.noCustomers}
        </p>
      ) : (
        <form action={createOrderAction} className="mt-10 space-y-6">
          <input type="hidden" name="locale" value={locale} />

          <div>
            <label htmlFor="order-customer" className={labelClass}>
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
                  {customer.code
                    ? `${customer.name} (${customer.code})`
                    : customer.name}
                </option>
              ))}
            </select>
            {canOpenCustomers ? (
              <p className="text-charcoal/50 mt-2 text-xs">
                {text.customerHint}{" "}
                <Link
                  href={`/${locale}/admin/customers` as Route}
                  className="text-burgundy font-semibold hover:underline"
                >
                  {text.customersLink}
                </Link>
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="order-code" className={labelClass}>
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
            <legend className={labelClass}>{text.unitsLabel}</legend>
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
                    defaultChecked={offeredUnits.length === 1}
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

          <div>
            <p className={labelClass}>{text.linesLabel}</p>
            <p className="text-charcoal/50 mb-3 text-xs">{text.linesHint}</p>
            <LineItemsEditor
              locale={locale}
              name="lineItemsJson"
              initial={[]}
              facilityNames={facilities}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="order-shipping-mark" className={labelClass}>
                {text.shippingMarkLabel}
              </label>
              <input
                id="order-shipping-mark"
                name="shippingMark"
                maxLength={500}
                className={`${fieldClass} font-mono`}
              />
            </div>
            <div>
              <label htmlFor="order-delivery-due" className={labelClass}>
                {text.deliveryDueLabel}
              </label>
              <input
                id="order-delivery-due"
                type="date"
                name="deliveryDueAt"
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="order-targets" className={labelClass}>
              {text.targetsLabel}
            </label>
            <textarea
              id="order-targets"
              name="targets"
              rows={2}
              maxLength={2000}
              placeholder={text.targetsHint}
              className={fieldClass}
            />
          </div>

          {canEnterPrice ? (
            <div className="grid grid-cols-[1fr_8rem] gap-4">
              <div>
                <label htmlFor="order-price" className={labelClass}>
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
                <label htmlFor="order-currency" className={labelClass}>
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
          ) : null}

          <div>
            <label htmlFor="order-notes" className={labelClass}>
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
