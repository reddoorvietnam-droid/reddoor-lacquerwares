"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { Types } from "mongoose";
import { z } from "zod";

import { getAuditEventModel } from "@/domains/audit/model";
import { categoryTag, findNewsCategory } from "@/domains/news/categories";
import { ArticleCommandStoreError } from "@/domains/news/commands";
import { getArticleModel } from "@/domains/news/persistence/models";
import { articleCommandService } from "@/domains/news/runtime";
import { ContentWorkflowError } from "@/domains/content/workflow";
import { getLocalizedRouteModel } from "@/domains/content/persistence/models";
import { ContentAccessDeniedError, requireContentPermission } from "@/lib/auth";
import { getCloudinaryEnv } from "@/lib/env/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { getEntityImagesModel } from "@/lib/media/entity-images";
import { locales } from "@/lib/i18n/config";
import { slugify } from "@/lib/utils/slug";

/**
 * Server actions behind the newsroom manager.
 *
 * The versioned workflow (draft → review → publish) runs through
 * `ArticleCommandService`; the editor's plain fields are translated into the
 * service's exact input shapes here, on the server, after re-authorization.
 * Cover photographs ride the entity-images sidecar for the same reason the
 * collection catalogue does: an asset swap is not an editorial revision.
 */

export type NewsActionState = {
  status: "idle" | "success" | "error";
  message: string;
  articleId?: string;
};

function failure(error: unknown): NewsActionState {
  if (error instanceof ContentAccessDeniedError) {
    return { status: "error", message: "FORBIDDEN" };
  }
  if (error instanceof ArticleCommandStoreError) {
    return { status: "error", message: error.code };
  }
  if (error instanceof ContentWorkflowError) {
    return { status: "error", message: error.code };
  }
  if (error instanceof z.ZodError) {
    return { status: "error", message: "INVALID_INPUT" };
  }
  return { status: "error", message: "UNAVAILABLE" };
}

/* ------------------------------------------------------------------ */
/* Editor payload                                                      */
/* ------------------------------------------------------------------ */

const translationInputSchema = z.object({
  locale: z.enum(locales),
  title: z.string().trim().min(1).max(300),
  slug: z.string().trim().max(160),
  summary: z.string().trim().min(1).max(1000),
  /** Plain text; blank lines separate paragraphs. */
  bodyText: z.string().max(50_000),
  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(180).optional(),
  noIndex: z.boolean().default(false),
});

const savePayloadSchema = z.object({
  articleId: z
    .string()
    .regex(/^[a-f0-9]{24}$/)
    .nullish(),
  categorySlug: z.string().trim().max(80).nullish(),
  tags: z.string().trim().max(1000).default(""),
  authorLabel: z.string().trim().max(200).nullish(),
  translations: z.array(translationInputSchema).min(1).max(locales.length),
});

function paragraphBlocks(text: string, prefix: string) {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim().replace(/\s*\r?\n\s*/g, " "))
    .filter(Boolean)
    .map((paragraph, index) => ({
      blockId: `${prefix}-${index + 1}`,
      type: "paragraph" as const,
      text: paragraph,
    }));
}

function parseTags(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,;\n]/)
        .map((tag) => slugify(tag))
        .filter(Boolean),
    ),
  ].slice(0, 40);
}

function toServiceTranslation(
  input: z.output<typeof translationInputSchema>,
  expectedRevision?: number,
) {
  const slug = slugify(input.slug || input.title);
  return {
    locale: input.locale,
    slug,
    title: input.title,
    summary: input.summary,
    body: paragraphBlocks(input.bodyText, `p-${input.locale}`),
    seo: {
      ...(input.seoTitle ? { title: input.seoTitle } : {}),
      ...(input.seoDescription ? { description: input.seoDescription } : {}),
      noIndex: input.noIndex,
    },
    ...(expectedRevision !== undefined ? { expectedRevision } : {}),
  };
}

export async function saveArticleAction(
  input: unknown,
): Promise<NewsActionState> {
  try {
    const parsed = savePayloadSchema.parse(input);

    const tagKeys = parseTags(parsed.tags);
    if (parsed.categorySlug && findNewsCategory(parsed.categorySlug)) {
      tagKeys.unshift(categoryTag(parsed.categorySlug));
    }

    const primary =
      parsed.translations.find(({ locale }) => locale === "vi") ??
      parsed.translations[0];
    if (!primary) return { status: "error", message: "INVALID_INPUT" };

    const metadata = {
      internalId: slugify(primary.slug || primary.title)
        .toUpperCase()
        .replaceAll("-", "_")
        .slice(0, 80),
      tagKeys,
      authorLabel: parsed.authorLabel || null,
    };
    const revision = { sourceLocale: primary.locale, sourceBlocks: [] };

    if (!parsed.articleId) {
      const context = await requireContentPermission("content.create");
      const created = await articleCommandService.createDraft(context, {
        metadata,
        revision,
        translations: parsed.translations.map((translation) =>
          toServiceTranslation(translation),
        ),
      });
      revalidatePath("/", "layout");
      return {
        status: "success",
        message: "SAVED",
        articleId: created.article.id,
      };
    }

    const context = await requireContentPermission("content.update");
    const aggregate = await articleCommandService.read(context, {
      articleId: parsed.articleId,
    });
    if (!aggregate) return { status: "error", message: "NOT_FOUND" };

    // A published article without an open draft gets a fresh revision first;
    // editing never mutates what the public is currently reading.
    if (!aggregate.draft) {
      const revised = await articleCommandService.createRevisionDraft(context, {
        articleId: parsed.articleId,
        expectedArticleRevision: aggregate.article.revision,
        revision,
        translations: parsed.translations.map((translation) =>
          toServiceTranslation(translation),
        ),
      });
      revalidatePath("/", "layout");
      return {
        status: "success",
        message: "SAVED",
        articleId: revised.article.id,
      };
    }

    const byLocale = new Map(
      aggregate.draft.translations.map((translation) => [
        translation.locale,
        translation,
      ]),
    );
    await articleCommandService.updateDraft(context, {
      articleId: parsed.articleId,
      expectedArticleRevision: aggregate.article.revision,
      revisionId: aggregate.draft.revision.id,
      expectedRevision: aggregate.draft.revision.revision,
      metadata,
      revision: {
        ...revision,
        coverMediaId: null,
      },
      translations: parsed.translations.map((translation) =>
        toServiceTranslation(
          translation,
          byLocale.get(translation.locale)?.revision,
        ),
      ),
    });
    revalidatePath("/", "layout");
    return { status: "success", message: "SAVED", articleId: parsed.articleId };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ */
/* Publish                                                             */
/* ------------------------------------------------------------------ */

const idPayloadSchema = z.object({
  articleId: z.string().regex(/^[a-f0-9]{24}$/),
});

export async function publishArticleAction(
  input: unknown,
): Promise<NewsActionState> {
  try {
    const parsed = idPayloadSchema.parse(input);
    const readContext = await requireContentPermission("content.read");
    const aggregate = await articleCommandService.read(readContext, {
      articleId: parsed.articleId,
    });
    if (!aggregate) return { status: "error", message: "NOT_FOUND" };
    if (!aggregate.draft) return { status: "error", message: "NO_DRAFT" };

    let expected = {
      articleId: parsed.articleId,
      expectedArticleRevision: aggregate.article.revision,
      revisionId: aggregate.draft.revision.id,
      expectedRevision: aggregate.draft.revision.revision,
      expectedTranslations: aggregate.draft.translations.map((translation) => ({
        locale: translation.locale,
        expectedRevision: translation.revision,
      })),
    };

    if (
      aggregate.draft.translations.some(
        (translation) => translation.translationStatus === "draft",
      ) ||
      aggregate.draft.revision.status === "draft"
    ) {
      const submitContext = await requireContentPermission("content.update");
      const submitted = await articleCommandService.submitForReview(
        submitContext,
        expected,
      );
      if (!submitted.draft) return { status: "error", message: "NO_DRAFT" };
      expected = {
        ...expected,
        expectedArticleRevision: submitted.article.revision,
        expectedRevision: submitted.draft.revision.revision,
        expectedTranslations: submitted.draft.translations.map(
          (translation) => ({
            locale: translation.locale,
            expectedRevision: translation.revision,
          }),
        ),
      };
    }

    const publishContext = await requireContentPermission("content.publish");
    const routes = aggregate.draft.translations.map((translation) => ({
      locale: translation.locale,
      path: `/${translation.locale}/news/${translation.slug}`,
    }));
    await articleCommandService.publish(publishContext, {
      ...expected,
      routes,
    });

    revalidatePath("/", "layout");
    return { status: "success", message: "PUBLISHED" };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ */
/* Cover photograph                                                    */
/* ------------------------------------------------------------------ */

const coverPayloadSchema = z.object({
  articleId: z.string().regex(/^[a-f0-9]{24}$/),
  publicId: z.string().min(1).max(500),
  assetVersion: z.coerce.number().int().min(1),
  width: z.coerce.number().int().min(1),
  height: z.coerce.number().int().min(1),
  bytes: z.coerce.number().int().min(1),
  alt: z.string().trim().max(300).optional(),
});

export async function attachArticleCoverAction(
  input: unknown,
): Promise<NewsActionState> {
  try {
    const context = await requireContentPermission("content.update");
    const parsed = coverPayloadSchema.parse(input);

    const cloudinaryEnv = getCloudinaryEnv();
    const expectedPrefix = `${cloudinaryEnv.CLOUDINARY_UPLOAD_FOLDER}/articles/${parsed.articleId}/`;
    if (!parsed.publicId.startsWith(expectedPrefix)) {
      return { status: "error", message: "INVALID_INPUT" };
    }

    await connectToDatabase();
    await getEntityImagesModel()
      .findOneAndUpdate(
        {
          entityType: "article",
          entityId: new Types.ObjectId(parsed.articleId),
        },
        {
          $set: {
            images: [
              {
                publicId: parsed.publicId,
                assetVersion: parsed.assetVersion,
                width: parsed.width,
                height: parsed.height,
                bytes: parsed.bytes,
                ...(parsed.alt ? { alt: parsed.alt } : {}),
              },
            ],
            updatedBy: new Types.ObjectId(context.userId),
          },
          $setOnInsert: {
            entityType: "article",
            entityId: new Types.ObjectId(parsed.articleId),
            createdBy: new Types.ObjectId(context.userId),
          },
        },
        { upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    revalidateTag("articles:public", "max");
    revalidatePath("/", "layout");
    return { status: "success", message: "COVER_ATTACHED" };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ */
/* Delete                                                              */
/* ------------------------------------------------------------------ */

/** Soft delete plus cleanup, mirroring the collections manager. */
export async function deleteArticleAction(
  input: unknown,
): Promise<NewsActionState> {
  try {
    const context = await requireContentPermission("content.archive");
    const parsed = idPayloadSchema.parse(input);
    const articleObjectId = new Types.ObjectId(parsed.articleId);
    const occurredAt = new Date();

    await connectToDatabase();
    const article = await getArticleModel()
      .findOneAndUpdate(
        { _id: articleObjectId, deletedAt: { $exists: false } },
        {
          $set: {
            deletedAt: occurredAt,
            updatedBy: new Types.ObjectId(context.userId),
          },
        },
      )
      .select("_id internalId")
      .exec();
    if (!article) return { status: "error", message: "NOT_FOUND" };

    await getLocalizedRouteModel()
      .updateMany(
        { entityType: "article", entityId: articleObjectId },
        { $set: { active: false } },
      )
      .exec();

    const Images = getEntityImagesModel();
    const imageDoc = await Images.findOne({
      entityType: "article",
      entityId: articleObjectId,
    })
      .select("images")
      .exec();
    if (imageDoc && imageDoc.images.length > 0) {
      try {
        const { CloudinaryMediaStorage } =
          await import("@/lib/media/cloudinary-storage");
        const storage = CloudinaryMediaStorage.fromEnvironment();
        for (const image of imageDoc.images) {
          await storage.destroyAsset(image.publicId, "image").catch(() => {});
        }
      } catch {
        // Storage unconfigured — nothing to destroy.
      }
    }
    await Images.deleteMany({
      entityType: "article",
      entityId: articleObjectId,
    }).exec();

    await getAuditEventModel().create([
      {
        actorType: "user",
        actorId: new Types.ObjectId(context.userId),
        action: "article.deleted",
        resourceType: "article",
        resourceId: parsed.articleId,
        businessUnitIds: [],
        requestId: context.requestId,
        occurredAt,
      },
    ]);

    revalidateTag("articles:public", "max");
    revalidatePath("/", "layout");
    return { status: "success", message: "DELETED" };
  } catch (error) {
    return failure(error);
  }
}
