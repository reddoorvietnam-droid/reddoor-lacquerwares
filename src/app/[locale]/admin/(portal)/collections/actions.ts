"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { Types } from "mongoose";
import { z } from "zod";

import { getCollectionCatalogueModel } from "@/domains/collections/catalogue";
import { CollectionCommandStoreError } from "@/domains/collections/commands";
import { collectionCommandService } from "@/domains/collections/runtime";
import { ContentWorkflowError } from "@/domains/content/workflow";
import { ContentAccessDeniedError, requireContentPermission } from "@/lib/auth";
import { getCloudinaryEnv } from "@/lib/env/server";
import { locales, type Locale } from "@/lib/i18n/config";
import { slugify } from "@/lib/utils/slug";

/**
 * Server actions behind the collections manager.
 *
 * Every action re-authorizes on the server through the same permission guard
 * the rest of the portal uses — the page having rendered proves nothing. The
 * editorial lifecycle (draft → review → publish) runs through the versioned
 * command service; only the catalogue attachment writes directly, because a
 * PDF swap is an asset operation, not an editorial revision (see the note on
 * the catalogue model).
 */

export type CollectionActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function failure(error: unknown): CollectionActionState {
  if (error instanceof ContentAccessDeniedError) {
    return { status: "error", message: "FORBIDDEN" };
  }
  if (error instanceof CollectionCommandStoreError) {
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

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

const createSchema = z.object({
  title: z.string().min(1).max(300),
  year: z.coerce.number().int().min(1000).max(9999).optional(),
  summary: z.string().max(1000).optional(),
});

export async function createCollectionAction(
  _previous: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  try {
    const context = await requireContentPermission("content.create");
    const parsed = createSchema.parse({
      title: text(formData, "title"),
      year: text(formData, "year") || undefined,
      summary: text(formData, "summary") || undefined,
    });

    const slug = slugify(parsed.title);
    if (!SLUG_PATTERN.test(slug)) {
      return { status: "error", message: "INVALID_INPUT" };
    }

    // The landing body is required by the schema; a collection whose story
    // is the catalogue itself starts from its summary or its name.
    const landingHtml = `<p>${escapeHtml(parsed.summary ?? parsed.title)}</p>`;

    await collectionCommandService.createDraft(context, {
      metadata: { code: slug, year: parsed.year ?? null, displayOrder: 0 },
      translations: [
        {
          locale: "vi" satisfies Locale,
          slug,
          title: parsed.title,
          summary: parsed.summary ?? null,
          landingHtml,
        },
      ],
    });

    revalidatePath("/", "layout");
    return { status: "success", message: "CREATED" };
  } catch (error) {
    return failure(error);
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/* ------------------------------------------------------------------ */
/* Attach catalogue                                                    */
/* ------------------------------------------------------------------ */

const attachSchema = z.object({
  collectionId: z.string().regex(/^[a-f0-9]{24}$/),
  locale: z.enum(locales),
  publicId: z.string().min(1).max(500),
  assetVersion: z.coerce.number().int().min(1),
  pageCount: z.coerce.number().int().min(1).max(500),
  pageWidth: z.coerce.number().min(1),
  pageHeight: z.coerce.number().min(1),
  bytes: z.coerce.number().int().min(1),
});

export async function attachCatalogueAction(
  input: unknown,
): Promise<CollectionActionState> {
  try {
    const context = await requireContentPermission("content.update");
    const parsed = attachSchema.parse(input);

    // The browser reports the upload result, so trust nothing it says beyond
    // pointing at an asset inside this collection's own signed folder. A
    // public id aimed anywhere else is rejected outright.
    const cloudinaryEnv = getCloudinaryEnv();
    const expectedPrefix = `${cloudinaryEnv.CLOUDINARY_UPLOAD_FOLDER}/collections/${parsed.collectionId}/`;
    if (!parsed.publicId.startsWith(expectedPrefix)) {
      return { status: "error", message: "INVALID_INPUT" };
    }
    if (parsed.bytes > cloudinaryEnv.MAX_PDF_UPLOAD_MB * 1024 * 1024) {
      return { status: "error", message: "INVALID_INPUT" };
    }

    await getCollectionCatalogueModel()
      .findOneAndUpdate(
        {
          collectionId: new Types.ObjectId(parsed.collectionId),
          locale: parsed.locale,
        },
        {
          $set: {
            publicId: parsed.publicId,
            assetVersion: parsed.assetVersion,
            pageCount: parsed.pageCount,
            pageWidth: parsed.pageWidth,
            pageHeight: parsed.pageHeight,
            bytes: parsed.bytes,
            updatedBy: new Types.ObjectId(context.userId),
          },
          $setOnInsert: {
            collectionId: new Types.ObjectId(parsed.collectionId),
            locale: parsed.locale,
            createdBy: new Types.ObjectId(context.userId),
          },
        },
        { upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    revalidateTag("collections:public", "max");
    revalidatePath("/", "layout");
    return { status: "success", message: "CATALOGUE_ATTACHED" };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ */
/* Publish                                                             */
/* ------------------------------------------------------------------ */

const publishSchema = z.object({
  collectionId: z.string().regex(/^[a-f0-9]{24}$/),
});

export async function publishCollectionAction(
  _previous: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  try {
    const readContext = await requireContentPermission("content.read");
    const parsed = publishSchema.parse({
      collectionId: text(formData, "collectionId"),
    });

    const aggregate = await collectionCommandService.read(readContext, {
      collectionId: parsed.collectionId,
    });
    if (!aggregate) {
      return { status: "error", message: "NOT_FOUND" };
    }

    const expected = {
      collectionId: parsed.collectionId,
      expectedCollectionRevision: aggregate.collection.revision,
      expectedTranslations: aggregate.draftTranslations.map((translation) => ({
        translationId: translation.id,
        locale: translation.locale,
        expectedRevision: translation.revision,
      })),
    };

    // The workflow admits no draft → published shortcut, so the publish
    // gesture walks draft translations through review first. Both steps
    // re-authorize individually; an actor with update-but-not-publish rights
    // fails on the second step and the collection simply sits in review.
    if (
      aggregate.draftTranslations.some(
        (translation) => translation.translationStatus === "draft",
      )
    ) {
      const submitContext = await requireContentPermission("content.update");
      const submitted = await collectionCommandService.submitForReview(
        submitContext,
        expected,
      );
      expected.expectedCollectionRevision = submitted.collection.revision;
      expected.expectedTranslations = submitted.draftTranslations.map(
        (translation) => ({
          translationId: translation.id,
          locale: translation.locale,
          expectedRevision: translation.revision,
        }),
      );
    }

    // Routes come from the aggregate already in hand: every access context is
    // bound to exactly the permission it was minted for, so a publish-bound
    // context must never be lent to a read.
    const publishContext = await requireContentPermission("content.publish");
    const routes = aggregate.draftTranslations.map((translation) => ({
      locale: translation.locale,
      path: `/${translation.locale}/collections/${translation.slug}`,
    }));

    await collectionCommandService.publish(publishContext, {
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
/* Delete                                                              */
/* ------------------------------------------------------------------ */

/**
 * Retiring a collection is a soft delete plus cleanup, not a document purge:
 * the versioned editorial records stay for the audit trail, `deletedAt`
 * removes them from every query the portal and the public site make, the
 * localized routes are released for reuse, and the catalogue assets are
 * destroyed at the provider so retired PDFs stop being servable.
 */
export async function deleteCollectionAction(
  _previous: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  try {
    const context = await requireContentPermission("content.archive");
    const parsed = publishSchema.parse({
      collectionId: text(formData, "collectionId"),
    });
    const collectionObjectId = new Types.ObjectId(parsed.collectionId);
    const occurredAt = new Date();

    const { getCollectionModel } =
      await import("@/domains/collections/persistence/models");
    const collection = await getCollectionModel()
      .findOneAndUpdate(
        { _id: collectionObjectId, deletedAt: { $exists: false } },
        {
          $set: {
            deletedAt: occurredAt,
            updatedBy: new Types.ObjectId(context.userId),
          },
        },
      )
      .select("_id code")
      .exec();
    if (!collection) {
      return { status: "error", message: "NOT_FOUND" };
    }

    // Release the public routes so a future collection may claim the slug.
    const { getLocalizedRouteModel } =
      await import("@/domains/content/persistence/models");
    await getLocalizedRouteModel()
      .updateMany(
        { entityType: "collection", entityId: collectionObjectId },
        { $set: { active: false } },
      )
      .exec();

    // Destroy the stored PDFs, best-effort: a provider hiccup must not leave
    // the collection half-deleted, and an orphaned asset is traceable via its
    // requestedBy context tag.
    const Catalogue = getCollectionCatalogueModel();
    const catalogues = await Catalogue.find({
      collectionId: collectionObjectId,
    })
      .select("publicId")
      .exec();
    try {
      const { CloudinaryMediaStorage } =
        await import("@/lib/media/cloudinary-storage");
      const storage = CloudinaryMediaStorage.fromEnvironment();
      for (const catalogue of catalogues) {
        await storage.destroyAsset(catalogue.publicId, "image").catch(() => {});
      }
    } catch {
      // Storage unconfigured — nothing to destroy.
    }
    await Catalogue.deleteMany({ collectionId: collectionObjectId }).exec();

    const { mongoAuditRepository } =
      await import("@/domains/audit/mongo-repository");
    await mongoAuditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "collection.deleted",
      resourceType: "collection",
      resourceId: parsed.collectionId,
      requestId: context.requestId,
      metadata: { code: collection.code, catalogues: catalogues.length },
      occurredAt,
    });

    revalidateTag("collections:public", "max");
    revalidatePath("/", "layout");
    return { status: "success", message: "DELETED" };
  } catch (error) {
    return failure(error);
  }
}
