"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { Types } from "mongoose";
import { z } from "zod";

import { getAuditEventModel } from "@/domains/audit/model";
import { ProductCommandStoreError } from "@/domains/products/commands";
import { getProductModel } from "@/domains/products/persistence/models";
import { productCommandService } from "@/domains/products/runtime";
import { ContentWorkflowError } from "@/domains/content/workflow";
import { getLocalizedRouteModel } from "@/domains/content/persistence/models";
import { ContentAccessDeniedError, requireContentPermission } from "@/lib/auth";
import { getCloudinaryEnv } from "@/lib/env/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { getEntityImagesModel } from "@/lib/media/entity-images";
import { locales } from "@/lib/i18n/config";
import { slugify } from "@/lib/utils/slug";

/**
 * Server actions behind the product manager. Same architecture as the
 * newsroom actions: the versioned workflow runs through the command service,
 * photographs ride the entity-images sidecar, and every action re-authorizes
 * on the server.
 */

export type ProductActionState = {
  status: "idle" | "success" | "error";
  message: string;
  productId?: string;
};

function failure(error: unknown): ProductActionState {
  if (error instanceof ContentAccessDeniedError) {
    return { status: "error", message: "FORBIDDEN" };
  }
  if (error instanceof ProductCommandStoreError) {
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

const decimalPattern = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

const translationInputSchema = z.object({
  locale: z.enum(locales),
  title: z.string().trim().min(1).max(300),
  slug: z.string().trim().max(160),
  shortDescription: z.string().trim().max(500),
  /** Plain text; blank lines separate paragraphs. */
  descriptionText: z.string().max(50_000),
  /** One care instruction per line. */
  careText: z.string().max(10_000),
  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(180).optional(),
  noIndex: z.boolean().default(false),
});

const savePayloadSchema = z.object({
  productId: z
    .string()
    .regex(/^[a-f0-9]{24}$/)
    .nullish(),
  sku: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .transform((value) => value.toUpperCase()),
  collectionIds: z.array(z.string().regex(/^[a-f0-9]{24}$/)).max(50),
  materials: z.string().trim().max(1000).default(""),
  colors: z.string().trim().max(1000).default(""),
  finishes: z.string().trim().max(1000).default(""),
  leadTimeDays: z.coerce.number().int().min(0).max(3650).nullish(),
  dimensions: z
    .object({
      length: z.string().trim().regex(decimalPattern).or(z.literal("")),
      width: z.string().trim().regex(decimalPattern).or(z.literal("")),
      height: z.string().trim().regex(decimalPattern).or(z.literal("")),
      unit: z.enum(["mm", "cm"]),
    })
    .nullish(),
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

function listBlock(text: string, blockId: string) {
  const items = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  if (items.length === 0) return [];
  return [{ blockId, type: "list" as const, style: "unordered", items }];
}

function labelList(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,;\n]/)
        .map((label) => label.trim())
        .filter(Boolean),
    ),
  ].slice(0, 50);
}

function toServiceTranslation(
  input: z.output<typeof translationInputSchema>,
  expectedRevision?: number,
) {
  return {
    locale: input.locale,
    slug: slugify(input.slug || input.title),
    title: input.title,
    shortDescription: input.shortDescription || null,
    description: paragraphBlocks(input.descriptionText, `d-${input.locale}`),
    story: [],
    careInstructions: listBlock(input.careText, `care-${input.locale}`),
    seo: {
      ...(input.seoTitle ? { title: input.seoTitle } : {}),
      ...(input.seoDescription ? { description: input.seoDescription } : {}),
      noIndex: input.noIndex,
    },
    ...(expectedRevision !== undefined ? { expectedRevision } : {}),
  };
}

function toVersion(parsed: z.output<typeof savePayloadSchema>) {
  const dimensions =
    parsed.dimensions &&
    (parsed.dimensions.length ||
      parsed.dimensions.width ||
      parsed.dimensions.height)
      ? {
          length: parsed.dimensions.length || null,
          width: parsed.dimensions.width || null,
          height: parsed.dimensions.height || null,
          unit: parsed.dimensions.unit,
        }
      : null;

  return {
    dimensions,
    weight: null,
    materials: labelList(parsed.materials),
    colors: labelList(parsed.colors),
    finishes: labelList(parsed.finishes),
    leadTimeDays: parsed.leadTimeDays ?? null,
    mediaIds: [],
    // The site quotes against a specification; no public price is shown.
    showPrice: false,
    publicPrice: null,
    relatedProductIds: [],
  };
}

export async function saveProductAction(
  input: unknown,
): Promise<ProductActionState> {
  try {
    const parsed = savePayloadSchema.parse(input);

    const sku = parsed.sku.replace(/[^A-Z0-9._-]/g, "-");
    const metadata = {
      internalId: sku,
      sku,
      collectionIds: parsed.collectionIds,
      materialKeys: labelList(parsed.materials)
        .map((label) => slugify(label))
        .filter(Boolean),
      finishKeys: labelList(parsed.finishes)
        .map((label) => slugify(label))
        .filter(Boolean),
      searchTokens: [
        ...new Set(
          parsed.translations.flatMap((translation) =>
            slugify(translation.title).split("-").filter(Boolean),
          ),
        ),
      ].slice(0, 100),
    };
    const version = toVersion(parsed);

    if (!parsed.productId) {
      const context = await requireContentPermission("content.create");
      const created = await productCommandService.createDraft(context, {
        metadata,
        version,
        translations: parsed.translations.map((translation) =>
          toServiceTranslation(translation),
        ),
      });
      revalidatePath("/", "layout");
      return {
        status: "success",
        message: "SAVED",
        productId: created.product.id,
      };
    }

    const context = await requireContentPermission("content.update");
    const aggregate = await productCommandService.read(context, {
      productId: parsed.productId,
    });
    if (!aggregate) return { status: "error", message: "NOT_FOUND" };

    if (!aggregate.draft) {
      const revised = await productCommandService.createRevisionDraft(context, {
        productId: parsed.productId,
        expectedProductRevision: aggregate.product.revision,
        version,
        translations: parsed.translations.map((translation) =>
          toServiceTranslation(translation),
        ),
      });
      revalidatePath("/", "layout");
      return {
        status: "success",
        message: "SAVED",
        productId: revised.product.id,
      };
    }

    const byLocale = new Map(
      aggregate.draft.translations.map((translation) => [
        translation.locale,
        translation,
      ]),
    );
    await productCommandService.updateDraft(context, {
      productId: parsed.productId,
      expectedProductRevision: aggregate.product.revision,
      versionId: aggregate.draft.version.id,
      expectedVersionRevision: aggregate.draft.version.revision,
      metadata,
      version,
      translations: parsed.translations.map((translation) =>
        toServiceTranslation(
          translation,
          byLocale.get(translation.locale)?.revision,
        ),
      ),
    });
    revalidatePath("/", "layout");
    return {
      status: "success",
      message: "SAVED",
      productId: parsed.productId,
    };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ */
/* Publish                                                             */
/* ------------------------------------------------------------------ */

const idPayloadSchema = z.object({
  productId: z.string().regex(/^[a-f0-9]{24}$/),
});

export async function publishProductAction(
  input: unknown,
): Promise<ProductActionState> {
  try {
    const parsed = idPayloadSchema.parse(input);
    const readContext = await requireContentPermission("content.read");
    const aggregate = await productCommandService.read(readContext, {
      productId: parsed.productId,
    });
    if (!aggregate) return { status: "error", message: "NOT_FOUND" };
    if (!aggregate.draft) return { status: "error", message: "NO_DRAFT" };

    let expected = {
      productId: parsed.productId,
      expectedProductRevision: aggregate.product.revision,
      versionId: aggregate.draft.version.id,
      expectedVersionRevision: aggregate.draft.version.revision,
      expectedTranslations: aggregate.draft.translations.map((translation) => ({
        locale: translation.locale,
        expectedRevision: translation.revision,
      })),
    };

    if (
      aggregate.draft.translations.some(
        (translation) => translation.translationStatus === "draft",
      ) ||
      aggregate.draft.version.status === "draft"
    ) {
      const submitContext = await requireContentPermission("content.update");
      const submitted = await productCommandService.submitForReview(
        submitContext,
        expected,
      );
      if (!submitted.draft) return { status: "error", message: "NO_DRAFT" };
      expected = {
        ...expected,
        expectedProductRevision: submitted.product.revision,
        expectedVersionRevision: submitted.draft.version.revision,
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
      path: `/${translation.locale}/products/${translation.slug}`,
    }));
    await productCommandService.publish(publishContext, {
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
/* Photographs                                                         */
/* ------------------------------------------------------------------ */

const imagesPayloadSchema = z.object({
  productId: z.string().regex(/^[a-f0-9]{24}$/),
  images: z
    .array(
      z.object({
        publicId: z.string().min(1).max(500),
        assetVersion: z.coerce.number().int().min(1),
        width: z.coerce.number().int().min(1),
        height: z.coerce.number().int().min(1),
        bytes: z.coerce.number().int().min(1),
        alt: z.string().trim().max(300).optional(),
      }),
    )
    .max(24),
});

/** Replaces the ordered gallery; the first image is the primary photograph. */
export async function saveProductImagesAction(
  input: unknown,
): Promise<ProductActionState> {
  try {
    const context = await requireContentPermission("content.update");
    const parsed = imagesPayloadSchema.parse(input);

    const cloudinaryEnv = getCloudinaryEnv();
    const expectedPrefix = `${cloudinaryEnv.CLOUDINARY_UPLOAD_FOLDER}/products/${parsed.productId}/`;
    if (
      parsed.images.some((image) => !image.publicId.startsWith(expectedPrefix))
    ) {
      return { status: "error", message: "INVALID_INPUT" };
    }

    await connectToDatabase();
    await getEntityImagesModel()
      .findOneAndUpdate(
        {
          entityType: "product",
          entityId: new Types.ObjectId(parsed.productId),
        },
        {
          $set: {
            images: parsed.images.map((image) => ({
              publicId: image.publicId,
              assetVersion: image.assetVersion,
              width: image.width,
              height: image.height,
              bytes: image.bytes,
              ...(image.alt ? { alt: image.alt } : {}),
            })),
            updatedBy: new Types.ObjectId(context.userId),
          },
          $setOnInsert: {
            entityType: "product",
            entityId: new Types.ObjectId(parsed.productId),
            createdBy: new Types.ObjectId(context.userId),
          },
        },
        { upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    revalidateTag("products:public", "max");
    revalidatePath("/", "layout");
    return { status: "success", message: "IMAGES_SAVED" };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ */
/* Delete                                                              */
/* ------------------------------------------------------------------ */

export async function deleteProductAction(
  input: unknown,
): Promise<ProductActionState> {
  try {
    const context = await requireContentPermission("content.archive");
    const parsed = idPayloadSchema.parse(input);
    const productObjectId = new Types.ObjectId(parsed.productId);
    const occurredAt = new Date();

    await connectToDatabase();
    const product = await getProductModel()
      .findOneAndUpdate(
        { _id: productObjectId, deletedAt: { $exists: false } },
        {
          $set: {
            deletedAt: occurredAt,
            updatedBy: new Types.ObjectId(context.userId),
          },
        },
      )
      .select("_id sku")
      .exec();
    if (!product) return { status: "error", message: "NOT_FOUND" };

    await getLocalizedRouteModel()
      .updateMany(
        { entityType: "product", entityId: productObjectId },
        { $set: { active: false } },
      )
      .exec();

    const Images = getEntityImagesModel();
    const imageDoc = await Images.findOne({
      entityType: "product",
      entityId: productObjectId,
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
      entityType: "product",
      entityId: productObjectId,
    }).exec();

    await getAuditEventModel().create([
      {
        actorType: "user",
        actorId: new Types.ObjectId(context.userId),
        action: "product.deleted",
        resourceType: "product",
        resourceId: parsed.productId,
        businessUnitIds: [],
        requestId: context.requestId,
        occurredAt,
      },
    ]);

    revalidateTag("products:public", "max");
    revalidatePath("/", "layout");
    return { status: "success", message: "DELETED" };
  } catch (error) {
    return failure(error);
  }
}
