import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { customerCommandService } from "@/domains/customers/runtime";
import {
  ContentAccessDeniedError,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

import { CustomerForm, customerCopy } from "./customer-form";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Khách hàng",
    title: "Danh sách khách hàng",
    description:
      "Mỗi đơn hàng, hóa đơn và phiếu thu gắn với một khách hàng trong danh sách này, nên công nợ và tiền trả trước cộng được theo khách. Kế toán tự thêm khách mới và sửa thông tin.",
    formTitle: "Thêm khách hàng",
    empty: "Chưa có khách hàng nào.",
    codeColumn: "Mã",
    nameColumn: "Tên",
    countryColumn: "Quốc gia",
    currencyColumn: "Tiền",
    contactColumn: "Liên hệ",
    showArchived: "Xem khách đã lưu trữ",
    showActive: "Xem khách đang hoạt động",
    archivedTitle: "Khách hàng đã lưu trữ",
    errorLead: "Thao tác không thành công:",
  },
  en: {
    eyebrow: "Customers",
    title: "Customer list",
    description:
      "Every order, invoice and receipt points at a customer in this list, so receivables and advances add up per customer. The accountant adds new customers and edits their details.",
    formTitle: "Add a customer",
    empty: "No customers yet.",
    codeColumn: "Code",
    nameColumn: "Name",
    countryColumn: "Country",
    currencyColumn: "Currency",
    contactColumn: "Contact",
    showArchived: "Show archived customers",
    showActive: "Show active customers",
    archivedTitle: "Archived customers",
    errorLead: "The action failed:",
  },
} as const;

export default async function CustomersPage({
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
  const formText = customerCopy[locale];

  try {
    await requirePermission("customers.read");
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const coverages = await resolvePermissionCoverages([
    "customers.create",
    "customers.readSensitive",
  ] as const);
  const canCreate = coverages["customers.create"].global;
  const sensitive = coverages["customers.readSensitive"].global;
  const showArchived = status === "archived";

  const customers = await customerCommandService.list({
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
            <CustomerForm locale={locale} />
          </div>
        </section>
      ) : null}

      <div className="mt-8">
        <Link
          href={
            `/${locale}/admin/customers${showArchived ? "" : "?status=archived"}` as Route
          }
          className="text-burgundy text-sm font-semibold hover:underline"
        >
          {showArchived ? text.showActive : text.showArchived}
        </Link>
      </div>

      <section className="mt-4">
        {customers.length === 0 ? (
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
                  <th scope="col" className="px-5 py-4 font-semibold">{text.countryColumn}</th>
                  <th scope="col" className="px-5 py-4 font-semibold">{text.currencyColumn}</th>
                  {sensitive ? (
                    <th scope="col" className="px-5 py-4 font-semibold">{text.contactColumn}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-burgundy/8 border-b">
                    <td className="text-charcoal/60 px-5 py-4 font-mono text-xs">
                      {customer.code ?? "—"}
                    </td>
                    <th scope="row" className="px-5 py-4 text-left">
                      <Link
                        href={`/${locale}/admin/customers/${customer.id}` as Route}
                        className="text-burgundy font-semibold hover:underline"
                      >
                        {customer.name}
                      </Link>
                    </th>
                    <td className="text-charcoal/70 px-5 py-4">{customer.country ?? "—"}</td>
                    <td className="px-5 py-4 font-mono text-xs">
                      {customer.defaultCurrency ?? "—"}
                    </td>
                    {sensitive ? (
                      <td className="text-charcoal/70 px-5 py-4 text-xs">
                        {[customer.email, customer.phone].filter(Boolean).join(" · ") || "—"}
                      </td>
                    ) : null}
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
