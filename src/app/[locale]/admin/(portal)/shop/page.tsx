import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteShopItemAction } from "@/app/[locale]/admin/(portal)/shop/actions";
import { RowDeleteButton } from "@/components/admin/row-delete-button";
import { shopService } from "@/domains/shop/runtime";
import {
  ContentAccessDeniedError,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Cửa hàng",
    title: "Mặt hàng đang bán",
    description:
      "Tạo mặt hàng với giá VND và USD, nhập tồn kho, tải ảnh rồi đưa lên bán. Trang tiếng Việt hiện giá VND, các ngôn ngữ khác hiện giá USD.",
    create: "Mặt hàng mới",
    empty: "Chưa có mặt hàng nào.",
    colStock: "Tồn",
    live: "Đang bán",
    draft: "Nháp",
    hidden: "Đã ẩn",
    edit: "Biên tập",
    remove: "Xóa",
    removeConfirm: "Chắc chắn?",
    removing: "Đang xóa…",
  },
  en: {
    eyebrow: "Shop",
    title: "Items for sale",
    description:
      "Create an item with a VND and a USD price, enter the stock, upload photos, then put it on sale. Vietnamese pages show VND; every other locale shows USD.",
    create: "New item",
    empty: "No items yet.",
    colStock: "Stock",
    live: "On sale",
    draft: "Draft",
    hidden: "Hidden",
    edit: "Edit",
    remove: "Delete",
    removeConfirm: "Sure?",
    removing: "Deleting…",
  },
} as const;

export default async function AdminShopPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: requestedLocale } = await params;
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];

  let context;
  try {
    context = await requirePermission("shop.read");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }

  const [items, coverage] = await Promise.all([
    shopService.listItems(context),
    resolvePermissionCoverages(["shop.manage"]),
  ]);
  const canManage = coverage["shop.manage"].global;

  function statusLabel(status: string): string {
    if (status === "live") return text.live;
    if (status === "hidden") return text.hidden;
    return text.draft;
  }

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
        {canManage ? (
          <Link
            href={`/${locale}/admin/shop/new` as Route}
            className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-12 items-center rounded-full px-7 text-sm font-semibold shadow-[0_0.75rem_2rem_rgb(61_13_16/0.18)]"
          >
            {text.create}
          </Link>
        ) : null}
      </div>

      <section className="mt-10">
        {items.length === 0 ? (
          <p className="border-burgundy/15 text-charcoal/60 max-w-3xl rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
            {text.empty}
          </p>
        ) : (
          <ul className="border-burgundy/15 divide-burgundy/10 divide-y overflow-hidden rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-burgundy truncate font-serif text-lg">
                    {item.text.vi.name || item.slug}
                  </p>
                  <p className="text-charcoal/45 font-mono text-xs">
                    {item.slug}
                  </p>
                </div>
                <span className="text-charcoal/70 w-48 shrink-0 text-sm tabular-nums">
                  {formatMoney({ amount: item.priceVnd, currency: "VND" }, "vi-VN")}
                  <span className="text-charcoal/45"> · </span>
                  {formatMoney({ amount: item.priceUsd, currency: "USD" }, "en-US")}
                </span>
                <span className="text-charcoal/60 w-20 shrink-0 text-sm tabular-nums">
                  {text.colStock}: {item.stockQuantity}
                </span>
                <span
                  className={`w-24 shrink-0 text-sm ${
                    item.status === "live"
                      ? "text-gold-ink font-semibold"
                      : "text-charcoal/60"
                  }`}
                >
                  {statusLabel(item.status)}
                </span>
                {canManage ? (
                  <>
                    <Link
                      href={`/${locale}/admin/shop/${item.id}` as Route}
                      className="border-burgundy/25 text-burgundy hover:border-burgundy/50 inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold"
                    >
                      {text.edit}
                    </Link>
                    <RowDeleteButton
                      label={text.remove}
                      confirmLabel={text.removeConfirm}
                      pendingLabel={text.removing}
                      action={deleteShopItemAction.bind(null, {
                        itemId: item.id,
                      })}
                    />
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
