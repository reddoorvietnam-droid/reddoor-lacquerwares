import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { supplierCommandService } from "@/domains/suppliers/runtime";
import {
  ContentAccessDeniedError,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

import { SupplierForm, supplierCopy } from "./supplier-form";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Nhà cung cấp",
    title: "Danh sách nhà cung cấp",
    description:
      "Kế toán nhà máy chọn nhà cung cấp từ danh sách này khi ghi chi phí mua hàng, nên chi phí cộng được theo từng nhà cung cấp. Thêm mới và sửa ngay tại đây.",
    formTitle: "Thêm nhà cung cấp",
    empty: "Chưa có nhà cung cấp nào.",
    codeColumn: "Mã",
    nameColumn: "Tên",
    categoryColumn: "Cung cấp",
    contactColumn: "Liên hệ",
    showArchived: "Xem nhà cung cấp đã lưu trữ",
    showActive: "Xem nhà cung cấp đang hoạt động",
    archivedTitle: "Nhà cung cấp đã lưu trữ",
    errorLead: "Thao tác không thành công:",
  },
  en: {
    eyebrow: "Suppliers",
    title: "Supplier list",
    description:
      "The factory accountant picks a supplier from this list when recording a purchase cost, so costs add up per supplier. Add and edit suppliers right here.",
    formTitle: "Add a supplier",
    empty: "No suppliers yet.",
    codeColumn: "Code",
    nameColumn: "Name",
    categoryColumn: "Supplies",
    contactColumn: "Contact",
    showArchived: "Show archived suppliers",
    showActive: "Show active suppliers",
    archivedTitle: "Archived suppliers",
    errorLead: "The action failed:",
  },
} as const;

export default async function SuppliersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const [{ locale: requestedLocale }, { error, status }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];
  const formText = supplierCopy[locale];

  try {
    await requirePermission("suppliers.read");
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const coverages = await resolvePermissionCoverages(["suppliers.create"] as const);
  const canCreate =
    coverages["suppliers.create"].global ||
    coverages["suppliers.create"].businessUnitIds.length > 0;
  const showArchived = status === "archived";

  const suppliers = await supplierCommandService.list({
    status: showArchived ? "archived" : "active",
  });

  return (
    <div>
      <p className="eyebrow">{text.eyebrow}</p>
      <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em] md:text-6xl">
        {showArchived ? text.archivedTitle : text.title}
      </h1>
      <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
        {text.description}
      </p>

      {error ? (
        <p className="border-lacquer/40 bg-lacquer/5 text-lacquer mt-8 max-w-3xl rounded-2xl border px-5 py-4 text-sm">
          {text.errorLead} {formText.errors[error] ?? formText.errors.UNAVAILABLE}
        </p>
      ) : null}

      {canCreate && !showArchived ? (
        <section className="border-burgundy/15 mt-8 max-w-4xl rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)]">
          <h2 className="text-burgundy font-serif text-2xl">{text.formTitle}</h2>
          <div className="mt-5">
            <SupplierForm locale={locale} />
          </div>
        </section>
      ) : null}

      <div className="mt-8">
        <Link
          href={
            `/${locale}/admin/suppliers${showArchived ? "" : "?status=archived"}` as Route
          }
          className="text-burgundy text-sm font-semibold hover:underline"
        >
          {showArchived ? text.showActive : text.showArchived}
        </Link>
      </div>

      <section className="mt-4">
        {suppliers.length === 0 ? (
          <p className="border-burgundy/15 text-charcoal/60 max-w-3xl rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
            {text.empty}
          </p>
        ) : (
          <div className="border-burgundy/15 overflow-x-auto rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]">
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <caption className="sr-only">{text.title}</caption>
              <thead>
                <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
                  <th scope="col" className="px-5 py-4 font-semibold">{text.codeColumn}</th>
                  <th scope="col" className="px-5 py-4 font-semibold">{text.nameColumn}</th>
                  <th scope="col" className="px-5 py-4 font-semibold">{text.categoryColumn}</th>
                  <th scope="col" className="px-5 py-4 font-semibold">{text.contactColumn}</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-burgundy/8 border-b">
                    <td className="text-charcoal/60 px-5 py-4 font-mono text-xs">
                      {supplier.code ?? "—"}
                    </td>
                    <th scope="row" className="px-5 py-4 text-left">
                      <Link
                        href={`/${locale}/admin/suppliers/${supplier.id}` as Route}
                        className="text-burgundy font-semibold hover:underline"
                      >
                        {supplier.name}
                      </Link>
                    </th>
                    <td className="text-charcoal/70 px-5 py-4">{supplier.category ?? "—"}</td>
                    <td className="text-charcoal/70 px-5 py-4 text-xs">
                      {[supplier.contactName, supplier.phone].filter(Boolean).join(" · ") || "—"}
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
