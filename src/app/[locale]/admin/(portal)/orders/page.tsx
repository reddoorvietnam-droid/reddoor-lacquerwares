import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { orderCommandService } from "@/domains/orders/runtime";
import {
  orderStageDefinitions,
  isTerminalStage,
} from "@/domains/orders/workflow";
import {
  ContentAccessDeniedError,
  requireListAccess,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Đơn hàng",
    title: "Sổ đơn hàng",
    description:
      "Mỗi đơn hàng chạy qua mười lăm bước đã chốt. Danh sách dưới đây chỉ hiển thị các đơn thuộc phạm vi đơn vị bạn được cấp quyền; giá bán chỉ hiện với người giữ quyền đọc giá bán.",
    create: "Tạo đơn hàng",
    empty: "Chưa có đơn hàng nào trong phạm vi của bạn.",
    codeColumn: "Mã đơn",
    customerColumn: "Khách hàng",
    stageColumn: "Bước hiện tại",
    priceColumn: "Giá bán",
    updatedColumn: "Cập nhật",
    terminal: "Kết thúc",
    priceHidden: "Không có quyền xem",
    errorLead: "Thao tác không thành công:",
  },
  en: {
    eyebrow: "Orders",
    title: "Order book",
    description:
      "Every order runs the confirmed fifteen steps. The list shows only orders inside your granted business units; the selling price appears only to holders of the selling-price read permission.",
    create: "Create order",
    empty: "No orders inside your scope yet.",
    codeColumn: "Code",
    customerColumn: "Customer",
    stageColumn: "Current stage",
    priceColumn: "Selling price",
    updatedColumn: "Updated",
    terminal: "Terminal",
    priceHidden: "Not permitted",
    errorLead: "The action failed:",
  },
} as const;

export default async function AdminOrdersPage({
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

  let scope;
  try {
    ({ scope } = await requireListAccess("orders.read"));
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  // Price visibility is conservative on the list: only a global grant shows
  // the column, matching the rule that price belongs to the Director and the
  // Company Accountant. Per-record refinement happens on the detail page.
  const coverages = await resolvePermissionCoverages([
    "orders.readSellingPrice",
  ] as const);
  const priceVisible = coverages["orders.readSellingPrice"].global;

  const filter =
    scope.kind === "all"
      ? ({ kind: "all" } as const)
      : scope.kind === "businessUnits"
        ? ({
            kind: "businessUnits",
            businessUnitIds: scope.businessUnitIds,
          } as const)
        : ({ kind: "own", userId: scope.userId } as const);

  const orders = await orderCommandService.list(filter, priceVisible);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em] md:text-6xl">
            {text.title}
          </h1>
          <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
            {text.description}
          </p>
        </div>
        <Link
          href={`/${locale}/admin/orders/new` as Route}
          className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-12 items-center rounded-full px-7 text-sm font-semibold shadow-[0_0.75rem_2rem_rgb(61_13_16/0.18)]"
        >
          {text.create}
        </Link>
      </div>

      {error ? (
        <p className="border-lacquer/40 bg-lacquer/5 text-lacquer mt-8 max-w-3xl rounded-2xl border px-5 py-4 text-sm">
          {text.errorLead} <span className="font-mono">{error}</span>
        </p>
      ) : null}

      <section className="mt-10">
        {orders.length === 0 ? (
          <p className="border-burgundy/15 text-charcoal/60 max-w-3xl rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
            {text.empty}
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
                    {text.customerColumn}
                  </th>
                  <th scope="col" className="px-5 py-4 font-semibold">
                    {text.stageColumn}
                  </th>
                  {priceVisible ? (
                    <th scope="col" className="px-5 py-4 font-semibold">
                      {text.priceColumn}
                    </th>
                  ) : null}
                  <th scope="col" className="px-5 py-4 font-semibold">
                    {text.updatedColumn}
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const definition = orderStageDefinitions[order.stage];
                  return (
                    <tr key={order.id} className="border-burgundy/8 border-b">
                      <th scope="row" className="px-5 py-4 text-left">
                        <Link
                          href={`/${locale}/admin/orders/${order.id}` as Route}
                          className="text-burgundy font-mono text-sm font-semibold hover:underline"
                        >
                          {order.orderCode}
                        </Link>
                      </th>
                      <td className="text-charcoal/75 px-5 py-4">
                        {order.customerName}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={
                            isTerminalStage(order.stage)
                              ? "text-charcoal/50"
                              : "text-gold-ink font-semibold"
                          }
                        >
                          {definition.step !== null
                            ? `${definition.step} · `
                            : ""}
                          {definition.labels[locale]}
                        </span>
                      </td>
                      {priceVisible ? (
                        <td className="text-charcoal/75 px-5 py-4 font-mono text-xs">
                          {order.sellingPrice
                            ? formatMoney(order.sellingPrice, locale)
                            : "—"}
                        </td>
                      ) : null}
                      <td className="text-charcoal/50 px-5 py-4 text-xs">
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(order.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
