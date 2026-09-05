import type { SupplierRecordDto } from "@/domains/suppliers/contracts";
import type { AdminLocale } from "@/lib/i18n/admin";

import { createSupplierAction, updateSupplierAction } from "./actions";

export const supplierCopy = {
  vi: {
    code: "Mã nhà cung cấp",
    name: "Tên nhà cung cấp",
    taxCode: "Mã số thuế",
    category: "Cung cấp gì (vật tư, gia công, vận chuyển…)",
    contactName: "Người liên hệ",
    email: "Email",
    phone: "Điện thoại",
    address: "Địa chỉ",
    notes: "Ghi chú",
    create: "Thêm nhà cung cấp",
    save: "Lưu thay đổi",
    notices: {
      created: "Đã thêm nhà cung cấp.",
      saved: "Đã lưu.",
      archived: "Đã lưu trữ nhà cung cấp.",
      restored: "Đã khôi phục nhà cung cấp.",
    } as Record<string, string>,
    errors: {
      FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
      NOT_FOUND: "Không tìm thấy nhà cung cấp.",
      DUPLICATE_CODE: "Mã nhà cung cấp này đã tồn tại.",
      REVISION_CONFLICT:
        "Hồ sơ đã thay đổi trong lúc bạn thao tác. Trang đã tải lại, kiểm tra rồi thử lại.",
      INVALID_INPUT: "Dữ liệu nhập chưa hợp lệ (kiểm tra email, mã).",
      UNAVAILABLE: "Hệ thống tạm thời không phản hồi.",
    } as Record<string, string>,
  },
  en: {
    code: "Supplier code",
    name: "Supplier name",
    taxCode: "Tax code",
    category: "What they supply (materials, outsourcing, shipping…)",
    contactName: "Contact",
    email: "Email",
    phone: "Phone",
    address: "Address",
    notes: "Notes",
    create: "Add supplier",
    save: "Save changes",
    notices: {
      created: "Supplier added.",
      saved: "Saved.",
      archived: "Supplier archived.",
      restored: "Supplier restored.",
    } as Record<string, string>,
    errors: {
      FORBIDDEN: "You are not permitted to perform this action.",
      NOT_FOUND: "The supplier was not found.",
      DUPLICATE_CODE: "This supplier code already exists.",
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

export function SupplierForm({
  locale,
  supplier,
}: {
  locale: AdminLocale;
  supplier?: SupplierRecordDto;
}) {
  const text = supplierCopy[locale];
  const prefix = supplier ? `supplier-${supplier.id}` : "supplier-new";

  return (
    <form
      action={supplier ? updateSupplierAction : createSupplierAction}
      className="grid gap-4 md:grid-cols-2"
    >
      <input type="hidden" name="locale" value={locale} />
      {supplier ? (
        <>
          <input type="hidden" name="supplierId" value={supplier.id} />
          <input type="hidden" name="expectedRevision" value={supplier.revision} />
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
          defaultValue={supplier?.name ?? ""}
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
          defaultValue={supplier?.code ?? ""}
          className={`${fieldClass} font-mono uppercase`}
        />
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
          defaultValue={supplier?.taxCode ?? ""}
          className={`${fieldClass} font-mono`}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor={`${prefix}-category`}>
          {text.category}
        </label>
        <input
          id={`${prefix}-category`}
          type="text"
          name="category"
          maxLength={120}
          defaultValue={supplier?.category ?? ""}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor={`${prefix}-contact`}>
          {text.contactName}
        </label>
        <input
          id={`${prefix}-contact`}
          type="text"
          name="contactName"
          maxLength={160}
          defaultValue={supplier?.contactName ?? ""}
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
          defaultValue={supplier?.phone ?? ""}
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
          defaultValue={supplier?.email ?? ""}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor={`${prefix}-address`}>
          {text.address}
        </label>
        <input
          id={`${prefix}-address`}
          type="text"
          name="address"
          maxLength={1000}
          defaultValue={supplier?.address ?? ""}
          className={fieldClass}
        />
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
          defaultValue={supplier?.notes ?? ""}
          className={fieldClass}
        />
      </div>

      <div className="md:col-span-2">
        <button
          type="submit"
          className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-11 items-center rounded-full px-7 text-sm font-semibold shadow-[0_0.75rem_2rem_rgb(61_13_16/0.18)]"
        >
          {supplier ? text.save : text.create}
        </button>
      </div>
    </form>
  );
}
