import { dateInputValue } from "@/app/[locale]/admin/(portal)/finance/shared";
import type {
  FacilityContractRecordDto,
  FacilityLookupEntry,
} from "@/domains/facility-contracts/contracts";

import { ContractLinesEditor } from "./contract-lines-editor";
import {
  buttonClass,
  fieldClass,
  labelClass,
  type AdminLocale,
} from "./shared";

/**
 * The fields of a site contract: used inline on the list to create a draft
 * and on the contract page to edit one. Server-rendered; only the line table
 * is a client component.
 */

export const contractFormCopy = {
  vi: {
    code: "Mã hợp đồng",
    codeHint: "Để trống để hệ thống tự đặt mã HDCS-…",
    facility: "Cơ sở sản xuất",
    chooseFacility: "— Chọn cơ sở —",
    order: "Đơn hàng",
    noOrder: "— Không gắn đơn hàng —",
    startDate: "Ngày bắt đầu làm hàng",
    deliveryDate: "Ngày giao hàng",
    note: "Ghi chú",
    lines: "Hàng hóa và đơn giá",
    linesHint:
      "Đơn giá tính bằng VND, số nguyên. Để trống số lượng nếu hợp đồng chưa chốt số lượng.",
    create: "Tạo hợp đồng",
    save: "Lưu hợp đồng",
  },
  en: {
    code: "Contract code",
    codeHint: "Leave blank for an automatic HDCS-… code",
    facility: "Production site",
    chooseFacility: "— Choose a site —",
    order: "Order",
    noOrder: "— No order —",
    startDate: "Start date",
    deliveryDate: "Delivery date",
    note: "Note",
    lines: "Goods and unit prices",
    linesHint:
      "Unit prices in whole VND. Leave the quantity blank when the contract does not fix it.",
    create: "Create contract",
    save: "Save contract",
  },
} as const;

export type OrderOption = {
  id: string;
  orderCode: string;
  customerName: string;
};

export function ContractForm({
  locale,
  action,
  facilities,
  orders,
  contract,
}: {
  locale: AdminLocale;
  action: (formData: FormData) => Promise<void>;
  facilities: readonly FacilityLookupEntry[];
  /** Open orders the reader may link; empty hides nothing but the choices. */
  orders: readonly OrderOption[];
  /** The draft being edited; absent when creating. */
  contract?: FacilityContractRecordDto;
}) {
  const text = contractFormCopy[locale];
  const currentFacilityMissing =
    contract && !facilities.some(({ id }) => id === contract.facilityId);
  const currentOrderMissing =
    contract?.orderId && !orders.some(({ id }) => id === contract.orderId);

  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      {contract ? (
        <>
          <input type="hidden" name="contractId" value={contract.id} />
          <input
            type="hidden"
            name="expectedRevision"
            value={contract.revision}
          />
        </>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {contract ? null : (
          <div>
            <label htmlFor="contract-code" className={labelClass}>
              {text.code}
            </label>
            <input
              id="contract-code"
              name="code"
              maxLength={40}
              placeholder={text.codeHint}
              className={`${fieldClass} font-mono`}
            />
          </div>
        )}
        <div>
          <label htmlFor="contract-facility" className={labelClass}>
            {text.facility}
          </label>
          <select
            id="contract-facility"
            name="facilityId"
            required
            defaultValue={contract?.facilityId ?? ""}
            className={fieldClass}
          >
            <option value="">{text.chooseFacility}</option>
            {currentFacilityMissing ? (
              <option value={contract.facilityId}>
                {contract.facilityName}
              </option>
            ) : null}
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.name} ({facility.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="contract-order" className={labelClass}>
            {text.order}
          </label>
          <select
            id="contract-order"
            name="orderId"
            defaultValue={contract?.orderId ?? ""}
            className={fieldClass}
          >
            <option value="">{text.noOrder}</option>
            {currentOrderMissing ? (
              <option value={contract.orderId ?? ""}>
                {contract.orderCode}
              </option>
            ) : null}
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.orderCode} · {order.customerName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="contract-start" className={labelClass}>
            {text.startDate}
          </label>
          <input
            id="contract-start"
            type="date"
            name="startDate"
            required
            defaultValue={contract ? dateInputValue(contract.startDate) : ""}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="contract-delivery" className={labelClass}>
            {text.deliveryDate}
          </label>
          <input
            id="contract-delivery"
            type="date"
            name="deliveryDate"
            required
            defaultValue={contract ? dateInputValue(contract.deliveryDate) : ""}
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <p className="text-charcoal/80 text-sm font-semibold">{text.lines}</p>
        <p className="text-charcoal/55 mt-1 mb-3 text-xs">{text.linesHint}</p>
        <ContractLinesEditor
          locale={locale}
          name="linesJson"
          initial={(contract?.lines ?? []).map((line) => ({
            productCode: line.productCode,
            description: line.description,
            quantity: line.quantity ?? "",
            unit: line.unit,
            unitPrice: line.unitPrice,
          }))}
        />
      </div>

      <div>
        <label htmlFor="contract-note" className={labelClass}>
          {text.note}
        </label>
        <textarea
          id="contract-note"
          name="note"
          rows={2}
          maxLength={2_000}
          defaultValue={contract?.note ?? ""}
          className={fieldClass}
        />
      </div>

      <div>
        <button type="submit" className={buttonClass}>
          {contract ? text.save : text.create}
        </button>
      </div>
    </form>
  );
}
