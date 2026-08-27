import { notFound } from "next/navigation";

import {
  NewsEditor,
  type EditorTranslation,
} from "@/components/admin/news-editor";
import {
  newsCategories,
  splitCategoryFromTags,
} from "@/domains/news/categories";
import { articleCommandService } from "@/domains/news/runtime";
import type { ArticleTranslationDto } from "@/domains/news/persistence/dto";
import { ContentAccessDeniedError, requireContentPermission } from "@/lib/auth";
import { blocksToEditorText } from "@/lib/content/editor-text";
import { findImagesForEntities } from "@/lib/media/entity-images";
import { CloudinaryMediaStorage } from "@/lib/media/cloudinary-storage";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

function toEditorTranslation(
  translation: ArticleTranslationDto,
): EditorTranslation {
  return {
    title: translation.title,
    slug: translation.slug,
    summary: translation.summary,
    bodyText: blocksToEditorText(translation.body),
    seoTitle: translation.seo.title ?? "",
    seoDescription: translation.seo.description ?? "",
    noIndex: translation.seo.noIndex,
  };
}

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ locale: string; articleId: string }>;
}) {
  const { locale: requestedLocale, articleId } = await params;
  if (!isLocale(requestedLocale)) notFound();
  if (!/^[a-f0-9]{24}$/.test(articleId)) notFound();
  const locale = resolveAdminLocale(requestedLocale);

  let context;
  try {
    context = await requireContentPermission("content.read");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }

  const aggregate = await articleCommandService.read(context, { articleId });
  if (!aggregate) notFound();

  // The editor works on the draft when one exists, else on what is published.
  const bundle = aggregate.draft ?? aggregate.published;
  const translations: Partial<Record<"vi" | "en", EditorTranslation>> = {};
  for (const translation of bundle?.translations ?? []) {
    if (translation.locale === "vi" || translation.locale === "en") {
      translations[translation.locale] = toEditorTranslation(translation);
    }
  }

  const { category, tags } = splitCategoryFromTags(
    aggregate.article.tagKeys ?? [],
  );

  const imagesByEntity = await findImagesForEntities("article", [articleId]);
  const cover = imagesByEntity.get(articleId)?.[0] ?? null;
  let coverUrl: string | null = null;
  if (cover) {
    try {
      coverUrl = CloudinaryMediaStorage.fromEnvironment().buildImageUrl(
        cover.publicId,
        cover.assetVersion,
        640,
      );
    } catch {
      coverUrl = null;
    }
  }

  return (
    <NewsEditor
      locale={locale}
      categories={newsCategories.map((entry) => ({
        slug: entry.slug,
        label: entry.labels[locale],
      }))}
      initial={{
        articleId,
        status: aggregate.article.status,
        hasDraft: aggregate.draft !== null,
        categorySlug: category?.slug ?? null,
        tags: tags.join(", "),
        authorLabel: aggregate.article.authorLabel ?? "",
        coverUrl,
        translations,
      }}
    />
  );
}
