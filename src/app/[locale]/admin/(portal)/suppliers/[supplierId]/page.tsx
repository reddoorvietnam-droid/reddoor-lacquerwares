import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { FinanceEntryRecordDto } from "@/domains/finance/contracts";
import { financeCommandService } from "@/domains/finance/runtime";
import { supplierCommandService } from "@/domains/suppliers/runtime";
import {
  ContentAccessDeniedError,
  requireListAccess,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

import {
  EntryTable,
  formatTotals,
  sumEntriesByCurrency,
} from "../../finance/shared";
import { setSupplierStatusAction } from "../actions";
import { SupplierForm, supplierCopy } from "../supplier-form";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    back: "← Danh sách nhà cung cấp",
    eyebrow: "Nhà cung cấp",
    archived: "Đã lưu trữ",
    detailsTitle: "Thông tin",
    archive: "Lưu trữ nhà cung cấp",
    restore: "Khôi phục",
    costsTitle: "Chi phí đã ghi cho nhà cung cấp này",
    spent: "Tổng đã chi (phiếu còn hiệu lực)",
    errorLead: "Thao tác không thành công:",
  },
  en: {
    back: "← Supplier list",
    eyebrow: "Supplier",
    archived: "Archived",
    detailsTitle: "Details",
    archive: "Archive supplier",
    restore: "Restore",
    costsTitle: "Costs recorded for this supplier",
    spent: "Spent (active entries)",
    errorLead: "The action failed:",
  },
} as const;

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; supplierId: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ locale: requestedLocale, supplierId }, { error, notice }] =
    await Promise.all([params, searchParams]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];
  const formText = supplierCopy[locale];

  if (!/^[a-f0-9]{24}$/.test(supplierId)) notFound();

  try {
    await requirePermission("suppliers.read");
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const supplier = await supplierCommandService.findById(supplierId);
  if (!supplier) notFound();

  const coverages = await resolvePermissionCoverages([
    "suppliers.update",
    "suppliers.archive",
    "expenses.read",
    "expenses.reverse",
  ] as const);
  const holds = (coverage: { global: boolean; businessUnitIds: readonly string[] }) =>
    coverage.global || coverage.businessUnitIds.length > 0;
  const canEdit = holds(coverages["suppliers.update"]);
  const canArchive = holds(coverages["suppliers.archive"]);

  let costs: FinanceEntryRecordDto[] = [];
  if (holds(coverages["expenses.read"])) {
    const { scope } = await requireListAccess("expenses.read");
    costs = await financeCommandService.list({
      scope,
      entryKind: "expense",
      supplierId: supplier.id,
      limit: 200,
    });
  }

  const cardClass =
    "border-burgundy/15 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]";

  return (
    <div>
      <Link
        href={`/${locale}/admin/suppliers` as Route}
        className="text-charcoal/55 hover:text-burgundy text-sm"
      >
        {text.back}
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em]">
            {supplier.name}
          </h1>
          <p className="text-charcoal/60 mt-3 font-mono text-sm">
            {[
              supplier.code,
              supplier.taxCode ? `MST ${supplier.taxCode}` : null,
              supplier.category,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {supplier.status === "archived" ? (
          <p className="text-charcoal/60 bg-charcoal/8 rounded-full px-4 py-2 text-sm font-semibold">
            {text.archived}
          </p>
        ) : null}
      </div>

      {notice && formText.notices[notice] ? (
        <p className="mt-8 max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          {formText.notices[notice]}
        </p>
      ) : null}
      {error ? (
        <p className="border-lacquer/40 bg-lacquer/5 text-lacquer mt-8 max-w-3xl rounded-2xl border px-5 py-4 text-sm">
          {text.errorLead} {formText.errors[error] ?? formText.errors.UNAVAILABLE}
        </p>
      ) : null}

      {holds(coverages["expenses.read"]) ? (
        <section className="mt-8">
          <h2 className="text-burgundy font-serif text-2xl">{text.costsTitle}</h2>
          <p className="text-charcoal/60 mt-2 text-sm">
            {text.spent}:{" "}
            <span className="text-lacquer font-mono font-semibold">
              {formatTotals(sumEntriesByCurrency(costs), locale)}
            </span>
          </p>
          <div className="mt-4">
            <EntryTable
              locale={locale}
              entries={costs}
              returnTo="expenses"
              showKind={false}
              canVoid={() => holds(coverages["expenses.reverse"])}
            />
          </div>
        </section>
      ) : null}

      <section className={`${cardClass} mt-6`}>
        <h2 className="text-burgundy font-serif text-2xl">{text.detailsTitle}</h2>
        {canEdit ? (
          <div className="mt-5">
            <SupplierForm locale={locale} supplier={supplier} />
          </div>
        ) : (
          <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <dt className="text-charcoal/50">{formText.contactName}</dt>
            <dd>{supplier.contactName ?? "—"}</dd>
            <dt className="text-charcoal/50">{formText.phone}</dt>
            <dd>{supplier.phone ?? "—"}</dd>
            <dt className="text-charcoal/50">{formText.address}</dt>
            <dd>{supplier.address ?? "—"}</dd>
          </dl>
        )}
      </section>

      {canArchive ? (
        <form action={setSupplierStatusAction} className="mt-6">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="supplierId" value={supplier.id} />
          <input type="hidden" name="expectedRevision" value={supplier.revision} />
          <input
            type="hidden"
            name="status"
            value={supplier.status === "archived" ? "active" : "archived"}
          />
          <button
            type="submit"
            className="text-lacquer border-lacquer/40 hover:bg-lacquer/5 inline-flex min-h-11 items-center rounded-full border px-6 text-sm font-semibold"
          >
            {supplier.status === "archived" ? text.restore : text.archive}
          </button>
        </form>
      ) : null}
    </div>
  );
}
