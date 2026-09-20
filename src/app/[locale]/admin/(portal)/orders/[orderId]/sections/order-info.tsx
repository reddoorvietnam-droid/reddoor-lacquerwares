import {
  dateInputValue,
  formatDate,
} from "@/app/[locale]/admin/(portal)/finance/shared";
import {
  saveLineItemsAction,
  saveOrderDetailsAction,
} from "@/app/[locale]/admin/(portal)/orders/actions";
import { LineItemsEditor } from "@/app/[locale]/admin/(portal)/orders/line-items-editor";
import type { OrderReadDto } from "@/domains/orders/contracts";

import {
  buttonClass,
  cardClass,
  fieldClass,
  headingClass,
  labelClass,
  subheadingClass,
} from "./styles";

/**
 * Step 01 on file: what was ordered (item code, quantity, production site),
 * the shipping mark, the promised delivery date and the order's own targets.
 */

const copy = {
  vi: {
    title: "Hàng đặt",
    noLines: "Chưa ghi mã hàng nào cho đơn này.",
    code: "Mã hàng",
    description: "Mô tả",
    quantity: "Số lượng",
    unit: "ĐVT",
    facility: "Đơn vị sản xuất",
    note: "Ghi chú",
    total: "Tổng",
    editLines: "Sửa hàng đặt",
    saveLines: "Lưu hàng đặt",
    detailsTitle: "Shipping mark, ngày giao, chỉ tiêu",
    shippingMark: "Shipping mark",
    deliveryDue: "Ngày giao cam kết",
    targets: "Chỉ tiêu riêng của đơn",
    notes: "Ghi chú đơn",
    notSet: "Chưa ghi",
    saveDetails: "Lưu",
  },
  en: {
    title: "Items ordered",
    noLines: "No item recorded for this order yet.",
    code: "Code",
    description: "Description",
    quantity: "Quantity",
    unit: "Unit",
    facility: "Production site",
    note: "Note",
    total: "Total",
    editLines: "Edit items",
    saveLines: "Save items",
    detailsTitle: "Shipping mark, delivery, targets",
    shippingMark: "Shipping mark",
    deliveryDue: "Promised delivery date",
    targets: "Targets for this order",
    notes: "Order notes",
    notSet: "Not set",
    saveDetails: "Save",
  },
} as const;

export function OrderInfoSection({
  locale,
  order,
  canEdit,
  facilityNames,
}: {
  locale: "vi" | "en";
  order: OrderReadDto;
  canEdit: boolean;
  facilityNames: readonly string[];
}) {
  const text = copy[locale];
  const total = order.lineItems.reduce(
    (sum, line) => sum + Number(line.quantity),
    0,
  );

  return (
    <section className={cardClass}>
      <h2 className={headingClass}>{text.title}</h2>
      {order.lineItems.length === 0 ? (
        <p className="text-charcoal/55 mt-3 text-sm">{text.noLines}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
                <th className="px-3 py-2 font-semibold">{text.code}</th>
                <th className="px-3 py-2 font-semibold">{text.description}</th>
                <th className="px-3 py-2 text-right font-semibold">
                  {text.quantity}
                </th>
                <th className="px-3 py-2 font-semibold">{text.unit}</th>
                <th className="px-3 py-2 font-semibold">{text.facility}</th>
                <th className="px-3 py-2 font-semibold">{text.note}</th>
              </tr>
            </thead>
            <tbody>
              {order.lineItems.map((line) => (
                <tr key={line.id} className="border-burgundy/8 border-b">
                  <td className="px-3 py-2 font-mono text-xs font-semibold">
                    {line.productCode}
                  </td>
                  <td className="px-3 py-2">{line.description || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {line.quantity}
                  </td>
                  <td className="px-3 py-2 text-xs">{line.unit}</td>
                  <td className="px-3 py-2">{line.facilityName ?? "—"}</td>
                  <td className="text-charcoal/60 px-3 py-2 text-xs">
                    {line.note ?? ""}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="text-charcoal/60 px-3 py-2 text-xs" colSpan={2}>
                  {text.total}
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold">
                  {total}
                </td>
                <td colSpan={3}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {canEdit ? (
        <form
          action={saveLineItemsAction}
          className="border-burgundy/10 mt-5 border-t pt-5"
        >
          <p className="text-charcoal/60 mb-3 text-sm font-semibold">
            {text.editLines}
          </p>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="expectedRevision" value={order.revision} />
          <LineItemsEditor
            locale={locale}
            name="lineItemsJson"
            initial={order.lineItems.map((line) => ({
              productCode: line.productCode,
              description: line.description,
              quantity: line.quantity,
              unit: line.unit,
              facilityName: line.facilityName ?? "",
              note: line.note ?? "",
            }))}
            facilityNames={facilityNames}
          />
          <button type="submit" className={`${buttonClass} mt-4`}>
            {text.saveLines}
          </button>
        </form>
      ) : null}

      <h3 className={subheadingClass}>{text.detailsTitle}</h3>
      {canEdit ? (
        <form action={saveOrderDetailsAction} className="mt-3 grid gap-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="expectedRevision" value={order.revision} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="details-shipping-mark" className={labelClass}>
                {text.shippingMark}
              </label>
              <input
                id="details-shipping-mark"
                name="shippingMark"
                maxLength={500}
                defaultValue={order.shippingMark ?? ""}
                className={`${fieldClass} font-mono`}
              />
            </div>
            <div>
              <label htmlFor="details-delivery-due" className={labelClass}>
                {text.deliveryDue}
              </label>
              <input
                id="details-delivery-due"
                type="date"
                name="deliveryDueAt"
                defaultValue={dateInputValue(order.deliveryDueAt)}
                className={fieldClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="details-targets" className={labelClass}>
              {text.targets}
            </label>
            <textarea
              id="details-targets"
              name="targets"
              rows={2}
              maxLength={2000}
              defaultValue={order.targets ?? ""}
              className={fieldClass}
            />
          </div>
          <div>
            <button type="submit" className={buttonClass}>
              {text.saveDetails}
            </button>
          </div>
        </form>
      ) : (
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <dt className="text-charcoal/50">{text.shippingMark}</dt>
          <dd className="font-mono sm:col-span-2">
            {order.shippingMark ?? text.notSet}
          </dd>
          <dt className="text-charcoal/50">{text.deliveryDue}</dt>
          <dd className="sm:col-span-2">
            {order.deliveryDueAt
              ? formatDate(order.deliveryDueAt, locale)
              : text.notSet}
          </dd>
          <dt className="text-charcoal/50">{text.targets}</dt>
          <dd className="whitespace-pre-line sm:col-span-2">
            {order.targets ?? text.notSet}
          </dd>
        </dl>
      )}
      {order.notes ? (
        <p className="text-charcoal/60 mt-4 text-sm whitespace-pre-line">
          <span className="text-charcoal/50 text-xs">{text.notes}: </span>
          {order.notes}
        </p>
      ) : null}
    </section>
  );
}
