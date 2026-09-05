import type { CustomerRecordDto } from "@/domains/customers/contracts";
import type { AdminLocale } from "@/lib/i18n/admin";
import { supportedCurrencies } from "@/lib/money";

import { createCustomerAction, updateCustomerAction } from "./actions";

export const customerCopy = {
  vi: {
    code: "Mã khách hàng",
    codeHint: "Mã trên sổ kế toán, để trống nếu chưa có.",
    name: "Tên khách hàng",
    taxCode: "Mã số thuế",
    country: "Quốc gia",
    email: "Email",
    phone: "Điện thoại",
    address: "Địa chỉ",
    defaultCurrency: "Loại tiền thường dùng",
    noCurrency: "— Chưa xác định —",
    notes: "Ghi chú",
    create: "Thêm khách hàng",
    save: "Lưu thay đổi",
    notices: {
      created: "Đã thêm khách hàng.",
      saved: "Đã lưu.",
      archived: "Đã lưu trữ khách hàng. Khách này không còn hiện trong danh sách chọn.",
      restored: "Đã khôi phục khách hàng.",
    } as Record<string, string>,
    errors: {
      FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
      NOT_FOUND: "Không tìm thấy khách hàng.",
      DUPLICATE_CODE: "Mã khách hàng này đã tồn tại.",
      REVISION_CONFLICT:
        "Hồ sơ đã thay đổi trong lúc bạn thao tác. Trang đã tải lại, kiểm tra rồi thử lại.",
      INVALID_INPUT: "Dữ liệu nhập chưa hợp lệ (kiểm tra email, mã).",
      UNAVAILABLE: "Hệ thống tạm thời không phản hồi.",
    } as Record<string, string>,
  },
  en: {
    code: "Customer code",
    codeHint: "The reference on the books; leave blank if none.",
    name: "Customer name",
    taxCode: "Tax code",
    country: "Country",
    email: "Email",
    phone: "Phone",
    address: "Address",
    defaultCurrency: "Usual currency",
    noCurrency: "— Not set —",
    notes: "Notes",
    create: "Add customer",
    save: "Save changes",
    notices: {
      created: "Customer added.",
      saved: "Saved.",
      archived: "Customer archived. It no longer appears in the pickers.",
      restored: "Customer restored.",
    } as Record<string, string>,
    errors: {
      FORBIDDEN: "You are not permitted to perform this action.",
      NOT_FOUND: "The customer was not found.",
      DUPLICATE_CODE: "This customer code already exists.",
      REVISION_CONFLICT:
        "The record changed while you were acting. The page has reloaded — review and retry.",
      INVALID_INPUT: "The submitted data is not valid (check the email and code).",
      UNAVAILABLE: "The system is temporarily unavailable.",
    } as Record<string, string>,
  },
} as const;

const fieldClass =
  "border-burgundy/20 focus:border-burgundy/50 w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none";
const labelClass =
  "text-charcoal/55 mb-1.5 block text-xs font-semibold tracking-[0.08em] uppercase";

export function CustomerForm({
  locale,
  customer,
}: {
  locale: AdminLocale;
  /** Editing when given; creating otherwise. */
  customer?: CustomerRecordDto;
}) {
  const text = customerCopy[locale];
  const prefix = customer ? `customer-${customer.id}` : "customer-new";

  return (
    <form
      action={customer ? updateCustomerAction : createCustomerAction}
      className="grid gap-4 md:grid-cols-2"
    >
      <input type="hidden" name="locale" value={locale} />
      {customer ? (
        <>
          <input type="hidden" name="customerId" value={customer.id} />
          <input type="hidden" name="expectedRevision" value={customer.revision} />
        </>
      ) : null}

      <div>
        <label className={labelClass} htmlFor={`${prefix}-name`}>
          {text.name}
        </label>
        <input
          id={`${prefix}-name`}
          type="text"
          name="name"
          required
          maxLength={240}
          defaultValue={customer?.name ?? ""}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor={`${prefix}-code`}>
          {text.code}
        </label>
        <input
          id={`${prefix}-code`}
          type="text"
          name="code"
          maxLength={80}
          defaultValue={customer?.code ?? ""}
          className={`${fieldClass} font-mono uppercase`}
        />
        <p className="text-charcoal/45 mt-1 text-xs">{text.codeHint}</p>
      </div>

      <div>
        <label className={labelClass} htmlFor={`${prefix}-tax`}>
          {text.taxCode}
        </label>
        <input
          id={`${prefix}-tax`}
          type="text"
          name="taxCode"
          maxLength={40}
          defaultValue={customer?.taxCode ?? ""}
          className={`${fieldClass} font-mono`}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor={`${prefix}-country`}>
          {text.country}
        </label>
        <input
          id={`${prefix}-country`}
          type="text"
          name="country"
          maxLength={120}
          defaultValue={customer?.country ?? ""}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor={`${prefix}-email`}>
          {text.email}
        </label>
        <input
          id={`${prefix}-email`}
          type="email"
          name="email"
          maxLength={320}
          defaultValue={customer?.email ?? ""}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor={`${prefix}-phone`}>
          {text.phone}
        </label>
        <input
          id={`${prefix}-phone`}
          type="text"
          name="phone"
          maxLength={80}
          defaultValue={customer?.phone ?? ""}
          className={fieldClass}
        />
      </div>

      <div className="md:col-span-2">
        <label className={labelClass} htmlFor={`${prefix}-address`}>
          {text.address}
        </label>
        <input
          id={`${prefix}-address`}
          type="text"
          name="address"
          maxLength={1000}
          defaultValue={customer?.address ?? ""}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor={`${prefix}-currency`}>
          {text.defaultCurrency}
        </label>
        <select
          id={`${prefix}-currency`}
          name="defaultCurrency"
          defaultValue={customer?.defaultCurrency ?? ""}
          className={fieldClass}
        >
          <option value="">{text.noCurrency}</option>
          {supportedCurrencies.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
      </div>

      <div className="md:col-span-2">
        <label className={labelClass} htmlFor={`${prefix}-notes`}>
          {text.notes}
        </label>
        <textarea
          id={`${prefix}-notes`}
          name="notes"
          rows={2}
          maxLength={4000}
          defaultValue={customer?.notes ?? ""}
          className={fieldClass}
        />
      </div>

      <div className="md:col-span-2">
        <button
          type="submit"
          className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-11 items-center rounded-full px-7 text-sm font-semibold shadow-[0_0.75rem_2rem_rgb(61_13_16/0.18)]"
        >
          {customer ? text.save : text.create}
        </button>
      </div>
    </form>
  );
}
