import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDate } from "@/app/[locale]/admin/(portal)/finance/shared";
import { createImportShipmentAction } from "@/app/[locale]/admin/(portal)/import-shipments/actions";
import {
  buttonClass,
  cardClass,
  fieldClass,
  headingClass,
  labelClass,
  warnBadgeClass,
} from "@/app/[locale]/admin/(portal)/orders/[orderId]/sections/styles";
import { hasImportDeclaration } from "@/domains/import-shipments/contracts";
import { importShipmentCommandService } from "@/domains/import-shipments/runtime";
import {
  ContentAccessDeniedError,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Chứng từ nhập khẩu",
    title: "Hàng nhập khẩu",
    description:
      "Tờ khai vẫn khai trên phần mềm hải quan. Ở đây lưu đủ chứng từ của từng lô hàng nhập: tờ khai, Invoice, Packing List, B/L, C/O, hợp đồng và chứng từ thanh toán.",
    formTitle: "Thêm lô hàng nhập",
    code: "Mã lô hàng",
    codeHint: "Để trống để máy tự tạo mã dạng NK-năm tháng ngày-4 ký tự.",
    declarationNumber: "Số tờ khai",
    declaredOn: "Ngày tờ khai",
    supplierName: "Nhà cung cấp nước ngoài",
    goodsDescription: "Hàng hóa",
    note: "Ghi chú",
    create: "Thêm lô hàng",
    search: "Tìm",
    searchPlaceholder: "Mã lô hàng, số tờ khai, nhà cung cấp, hàng hóa",
    clearSearch: "Xóa tìm kiếm",
    codeColumn: "Mã lô hàng",
    declarationColumn: "Số tờ khai",
    declaredColumn: "Ngày tờ khai",
    supplierColumn: "Nhà cung cấp",
    documentsColumn: "Chứng từ",
    files: (count: number) => `${count} tệp`,
    missingDeclaration: "Thiếu tờ khai",
    empty: "Chưa có lô hàng nhập nào.",
    searchEmpty: "Không có lô hàng nào khớp với tìm kiếm.",
    errorLead: "Thao tác không thành công:",
    errors: {
      FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
      NOT_FOUND: "Không tìm thấy lô hàng.",
      DUPLICATE_CODE: "Mã lô hàng này đã có.",
      INVALID_INPUT:
        "Dữ liệu nhập chưa hợp lệ (mã lô hàng chỉ gồm chữ, số và dấu gạch; phải có nhà cung cấp và hàng hóa).",
      UNAVAILABLE: "Hệ thống tạm thời không phản hồi.",
    } as Record<string, string>,
  },
  en: {
    eyebrow: "Import documents",
    title: "Imports",
    description:
      "Declarations are still filed in the customs software. Every document of each import is kept here: declaration, invoice, packing list, B/L, C/O, contract and payment documents.",
    formTitle: "Add an import shipment",
    code: "Shipment code",
    codeHint: "Leave blank to allocate a code like NK-YYYYMMDD-XXXX.",
    declarationNumber: "Declaration number",
    declaredOn: "Declaration date",
    supplierName: "Foreign supplier",
    goodsDescription: "Goods",
    note: "Note",
    create: "Add shipment",
    search: "Search",
    searchPlaceholder: "Shipment code, declaration, supplier, goods",
    clearSearch: "Clear search",
    codeColumn: "Shipment code",
    declarationColumn: "Declaration",
    declaredColumn: "Declared on",
    supplierColumn: "Supplier",
    documentsColumn: "Documents",
    files: (count: number) => `${count} ${count === 1 ? "file" : "files"}`,
    missingDeclaration: "No declaration",
    empty: "No import shipments yet.",
    searchEmpty: "No shipment matches the search.",
    errorLead: "The action failed:",
    errors: {
      FORBIDDEN: "You are not permitted to perform this action.",
      NOT_FOUND: "The shipment was not found.",
      DUPLICATE_CODE: "This shipment code already exists.",
      INVALID_INPUT:
        "The submitted data is not valid (the code takes letters, digits and dashes; supplier and goods are required).",
      UNAVAILABLE: "The system is temporarily unavailable.",
    } as Record<string, string>,
  },
} as const;

export default async function ImportShipmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; q?: string }>;
}) {
  const [{ locale: requestedLocale }, { error, q }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];

  let context;
  try {
    context = await requirePermission("importShipments.read");
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const coverages = await resolvePermissionCoverages([
    "importShipments.manage",
  ] as const);
  const canManage =
    coverages["importShipments.manage"].global ||
    coverages["importShipments.manage"].businessUnitIds.length > 0;

  const search = (q ?? "").trim().slice(0, 120);
  const shipments = await importShipmentCommandService.list(context, {
    search,
  });

  return (
    <div>
      <p className="eyebrow">{text.eyebrow}</p>
      <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em] md:text-6xl">
        {text.title}
      </h1>
      <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
        {text.description}
      </p>

      {error ? (
        <p className="border-lacquer/40 bg-lacquer/5 text-lacquer mt-8 max-w-3xl rounded-2xl border px-5 py-4 text-sm">
          {text.errorLead} {text.errors[error] ?? text.errors.UNAVAILABLE}
        </p>
      ) : null}

      {canManage ? (
        <section className={`${cardClass} mt-8 max-w-4xl`}>
          <h2 className={headingClass}>{text.formTitle}</h2>
          <form action={createImportShipmentAction} className="mt-5 grid gap-4">
            <input type="hidden" name="locale" value={locale} />
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="shipment-code" className={labelClass}>
                  {text.code}
                </label>
                <input
                  id="shipment-code"
                  name="code"
                  maxLength={40}
                  className={`${fieldClass} font-mono uppercase`}
                />
              </div>
              <div>
                <label htmlFor="shipment-declaration" className={labelClass}>
                  {text.declarationNumber}
                </label>
                <input
                  id="shipment-declaration"
                  name="declarationNumber"
                  maxLength={60}
                  className={`${fieldClass} font-mono`}
                />
              </div>
              <div>
                <label htmlFor="shipment-declared-on" className={labelClass}>
                  {text.declaredOn}
                </label>
                <input
                  id="shipment-declared-on"
                  type="date"
                  name="declaredOn"
                  className={fieldClass}
                />
              </div>
            </div>
            <p className="text-charcoal/50 -mt-2 text-xs">{text.codeHint}</p>
            <div>
              <label htmlFor="shipment-supplier" className={labelClass}>
                {text.supplierName}
              </label>
              <input
                id="shipment-supplier"
                name="supplierName"
                required
                maxLength={240}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="shipment-goods" className={labelClass}>
                {text.goodsDescription}
              </label>
              <textarea
                id="shipment-goods"
                name="goodsDescription"
                required
                rows={2}
                maxLength={2000}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="shipment-note" className={labelClass}>
                {text.note}
              </label>
              <textarea
                id="shipment-note"
                name="note"
                rows={2}
                maxLength={4000}
                className={fieldClass}
              />
            </div>
            <div>
              <button type="submit" className={buttonClass}>
                {text.create}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <form
        method="get"
        className="mt-8 flex max-w-3xl flex-wrap items-end gap-3"
      >
        <div className="min-w-60 flex-1">
          <label htmlFor="shipment-search" className={labelClass}>
            {text.search}
          </label>
          <input
            id="shipment-search"
            type="search"
            name="q"
            defaultValue={search}
            maxLength={120}
            placeholder={text.searchPlaceholder}
            className={fieldClass}
          />
        </div>
        <button
          type="submit"
          className="border-burgundy/30 text-burgundy hover:bg-ivory/70 inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold"
        >
          {text.search}
        </button>
        {search ? (
          <Link
            href={`/${locale}/admin/import-shipments` as Route}
            className="text-burgundy text-sm font-semibold hover:underline"
          >
            {text.clearSearch}
          </Link>
        ) : null}
      </form>

      <section className="mt-4">
        {shipments.length === 0 ? (
          <p className="border-burgundy/15 text-charcoal/60 max-w-3xl rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
            {search ? text.searchEmpty : text.empty}
          </p>
        ) : (
          <div className="border-burgundy/15 overflow-x-auto rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]">
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <caption className="sr-only">{text.title}</caption>
              <thead>
                <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
                  <th scope="col" className="px-5 py-4 font-semibold">
                    {text.codeColumn}
                  </th>
                  <th scope="col" className="px-5 py-4 font-semibold">
                    {text.declarationColumn}
                  </th>
                  <th scope="col" className="px-5 py-4 font-semibold">
                    {text.declaredColumn}
                  </th>
                  <th scope="col" className="px-5 py-4 font-semibold">
                    {text.supplierColumn}
                  </th>
                  <th scope="col" className="px-5 py-4 font-semibold">
                    {text.documentsColumn}
                  </th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((shipment) => (
                  <tr key={shipment.id} className="border-burgundy/8 border-b">
                    <th scope="row" className="px-5 py-4 text-left">
                      <Link
                        href={
                          `/${locale}/admin/import-shipments/${shipment.id}` as Route
                        }
                        className="text-burgundy font-mono text-sm font-semibold hover:underline"
                      >
                        {shipment.code}
                      </Link>
                    </th>
                    <td className="text-charcoal/75 px-5 py-4 font-mono text-xs">
                      {shipment.declarationNumber ?? "—"}
                    </td>
                    <td className="text-charcoal/75 px-5 py-4 text-xs">
                      {shipment.declaredOn
                        ? formatDate(shipment.declaredOn, locale)
                        : "—"}
                    </td>
                    <td className="text-charcoal/75 px-5 py-4">
                      {shipment.supplierName}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-charcoal/70 text-xs">
                        {text.files(shipment.documents.length)}
                      </span>
                      {hasImportDeclaration(shipment) ? null : (
                        <span className={`${warnBadgeClass} ml-2`}>
                          {text.missingDeclaration}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
