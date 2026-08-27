import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteProductAction } from "@/app/[locale]/admin/(portal)/products/actions";
import { RowDeleteButton } from "@/components/admin/row-delete-button";
import { productCommandService } from "@/domains/products/runtime";
import { ContentAccessDeniedError, requireContentPermission } from "@/lib/auth";
import { findImagesForEntities } from "@/lib/media/entity-images";
import { CloudinaryMediaStorage } from "@/lib/media/cloudinary-storage";
import Image from "next/image";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Sản phẩm",
    title: "Quản lý sản phẩm",
    description:
      "Tạo sản phẩm song ngữ Việt–Anh, tải ảnh, gắn bộ sưu tập và xuất bản ra catalogue trực tuyến.",
    create: "Thêm sản phẩm",
    empty: "Chưa có sản phẩm nào.",
    edit: "Biên tập",
    remove: "Xóa",
    removeConfirm: "Chắc chắn?",
    removing: "Đang xóa…",
    published: "Đã xuất bản",
    draft: "Bản nháp",
    inReview: "Chờ duyệt",
    archived: "Lưu trữ",
    discontinued: "Ngừng bán",
    draftPending: "· có nháp mới",
  },
  en: {
    eyebrow: "Products",
    title: "Manage products",
    description:
      "Create Vietnamese–English products, upload photographs, attach collections, and publish to the online catalogue.",
    create: "Add product",
    empty: "No products yet.",
    edit: "Edit",
    remove: "Delete",
    removeConfirm: "Sure?",
    removing: "Deleting…",
    published: "Published",
    draft: "Draft",
    inReview: "In review",
    archived: "Archived",
    discontinued: "Discontinued",
    draftPending: "· new draft",
  },
} as const;

export default async function AdminProductsPage({
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
    context = await requireContentPermission("content.read");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }

  const listing = await productCommandService.list(context, {});
  const imagesByEntity = await findImagesForEntities(
    "product",
    listing.items.map((item) => item.product.id),
  );
  let storage: CloudinaryMediaStorage | null = null;
  try {
    storage = CloudinaryMediaStorage.fromEnvironment();
  } catch {
    storage = null;
  }

  function statusLabel(status: string): string {
    if (status === "published") return text.published;
    if (status === "inReview") return text.inReview;
    if (status === "archived") return text.archived;
    if (status === "discontinued") return text.discontinued;
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
        <Link
          href={`/${locale}/admin/products/new` as Route}
          className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-12 items-center rounded-full px-7 text-sm font-semibold shadow-[0_0.75rem_2rem_rgb(61_13_16/0.18)]"
        >
          {text.create}
        </Link>
      </div>

      <section className="mt-10">
        {listing.items.length === 0 ? (
          <p className="border-burgundy/15 text-charcoal/60 max-w-3xl rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
            {text.empty}
          </p>
        ) : (
          <ul className="border-burgundy/15 divide-burgundy/10 divide-y overflow-hidden rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]">
            {listing.items.map((item) => {
              const title =
                item.translations.find(({ locale: l }) => l === "vi")?.title ??
                item.translations[0]?.title ??
                item.product.sku;
              const primary = imagesByEntity.get(item.product.id)?.[0];
              const thumbUrl =
                primary && storage
                  ? storage.buildImageUrl(
                      primary.publicId,
                      primary.assetVersion,
                      160,
                    )
                  : null;
              const hasNewerDraft =
                item.product.status === "published" &&
                item.draftVersion !== null &&
                (item.publishedVersion === null ||
                  item.draftVersion > item.publishedVersion);

              return (
                <li
                  key={item.product.id}
                  className="flex items-center gap-5 px-5 py-4"
                >
                  <div className="bg-ivory border-burgundy/10 relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border">
                    {thumbUrl ? (
                      <Image
                        src={thumbUrl}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="text-burgundy/30 absolute inset-0 grid place-items-center font-serif text-lg"
                      >
                        ◈
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-burgundy truncate font-serif text-lg">
                      {title}
                    </p>
                    <p className="text-charcoal/45 font-mono text-xs">
                      {item.product.sku}
                    </p>
                  </div>
                  <span className="w-44 shrink-0 text-sm">
                    <span
                      className={
                        item.product.status === "published"
                          ? "text-gold-ink font-semibold"
                          : "text-charcoal/60"
                      }
                    >
                      {statusLabel(item.product.status)}
                    </span>
                    {hasNewerDraft ? (
                      <span className="text-charcoal/45 ml-1 text-xs">
                        {text.draftPending}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-charcoal/50 hidden w-28 shrink-0 text-xs sm:block">
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                    }).format(new Date(item.product.updatedAt))}
                  </span>
                  <Link
                    href={
                      `/${locale}/admin/products/${item.product.id}` as Route
                    }
                    className="border-burgundy/25 text-burgundy hover:border-burgundy/50 inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold"
                  >
                    {text.edit}
                  </Link>
                  <RowDeleteButton
                    label={text.remove}
                    confirmLabel={text.removeConfirm}
                    pendingLabel={text.removing}
                    action={deleteProductAction.bind(null, {
                      productId: item.product.id,
                    })}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
