import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteArticleAction } from "@/app/[locale]/admin/(portal)/news/actions";
import { RowDeleteButton } from "@/components/admin/row-delete-button";
import { splitCategoryFromTags } from "@/domains/news/categories";
import { articleCommandService } from "@/domains/news/runtime";
import { ContentAccessDeniedError, requireContentPermission } from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Tin tức",
    title: "Quản lý bài viết",
    description:
      "Soạn bài song ngữ Việt–Anh, gắn danh mục và ảnh đại diện, rồi xuất bản. Bốn ngôn ngữ còn lại tự dùng bản gần nhất.",
    create: "Viết bài mới",
    empty: "Chưa có bài viết nào.",
    colTitle: "Bài viết",
    colCategory: "Danh mục",
    colStatus: "Trạng thái",
    colUpdated: "Cập nhật",
    edit: "Biên tập",
    remove: "Xóa",
    removeConfirm: "Chắc chắn?",
    removing: "Đang xóa…",
    published: "Đã xuất bản",
    draft: "Bản nháp",
    inReview: "Chờ duyệt",
    archived: "Lưu trữ",
    draftPending: "· có nháp mới",
  },
  en: {
    eyebrow: "News",
    title: "Manage articles",
    description:
      "Write Vietnamese–English articles, attach a category and a cover, then publish. The other four locales fall back automatically.",
    create: "New article",
    empty: "No articles yet.",
    colTitle: "Article",
    colCategory: "Category",
    colStatus: "Status",
    colUpdated: "Updated",
    edit: "Edit",
    remove: "Delete",
    removeConfirm: "Sure?",
    removing: "Deleting…",
    published: "Published",
    draft: "Draft",
    inReview: "In review",
    archived: "Archived",
    draftPending: "· new draft",
  },
} as const;

export default async function AdminNewsPage({
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

  const listing = await articleCommandService.list(context, {});

  function statusLabel(status: string): string {
    if (status === "published") return text.published;
    if (status === "inReview") return text.inReview;
    if (status === "archived") return text.archived;
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
          href={`/${locale}/admin/news/new` as Route}
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
                item.article.internalId;
              const { category } = splitCategoryFromTags(
                item.article.tagKeys ?? [],
              );
              const hasNewerDraft =
                item.article.status === "published" &&
                item.draftVersion !== null &&
                (item.publishedVersion === null ||
                  item.draftVersion > item.publishedVersion);

              return (
                <li
                  key={item.article.id}
                  className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-burgundy truncate font-serif text-lg">
                      {title}
                    </p>
                    <p className="text-charcoal/45 font-mono text-xs">
                      {item.article.internalId.toLowerCase()}
                    </p>
                  </div>
                  <span className="text-charcoal/60 w-40 shrink-0 text-sm">
                    {category?.labels[locale] ?? "—"}
                  </span>
                  <span className="w-44 shrink-0 text-sm">
                    <span
                      className={
                        item.article.status === "published"
                          ? "text-gold-ink font-semibold"
                          : "text-charcoal/60"
                      }
                    >
                      {statusLabel(item.article.status)}
                    </span>
                    {hasNewerDraft ? (
                      <span className="text-charcoal/45 ml-1 text-xs">
                        {text.draftPending}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-charcoal/50 w-28 shrink-0 text-xs">
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                    }).format(new Date(item.article.updatedAt))}
                  </span>
                  <Link
                    href={`/${locale}/admin/news/${item.article.id}` as Route}
                    className="border-burgundy/25 text-burgundy hover:border-burgundy/50 inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold"
                  >
                    {text.edit}
                  </Link>
                  <RowDeleteButton
                    label={text.remove}
                    confirmLabel={text.removeConfirm}
                    pendingLabel={text.removing}
                    action={deleteArticleAction.bind(null, {
                      articleId: item.article.id,
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
