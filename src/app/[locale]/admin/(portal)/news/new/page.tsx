import { notFound } from "next/navigation";

import { NewsEditor } from "@/components/admin/news-editor";
import { newsCategories } from "@/domains/news/categories";
import { ContentAccessDeniedError, requireContentPermission } from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

export default async function NewArticlePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: requestedLocale } = await params;
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);

  try {
    await requireContentPermission("content.read");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }

  return (
    <NewsEditor
      locale={locale}
      categories={newsCategories.map((entry) => ({
        slug: entry.slug,
        label: entry.labels[locale],
      }))}
      initial={{
        articleId: null,
        status: "draft",
        hasDraft: false,
        categorySlug: null,
        tags: "",
        authorLabel: "",
        coverUrl: null,
        blocks: [],
        translations: {},
      }}
    />
  );
}
