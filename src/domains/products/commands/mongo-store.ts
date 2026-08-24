import "server-only";

import type { ClientSession } from "mongoose";
import { Types } from "mongoose";

import { getAuditEventModel } from "@/domains/audit/model";
import {
  type ProductAdminAggregateDto,
  type ProductCommandStore,
  ProductCommandStoreError,
  type ProductListDto,
  type ProductStoreAccessScope,
  type ProductVersionBundleDto,
  type CreateProductDraftStoreInput,
  type CreateProductRevisionDraftStoreInput,
  type PublishProductStoreInput,
  type ReturnProductToDraftStoreInput,
  type SubmitProductForReviewStoreInput,
  type UpdateProductDraftStoreInput,
} from "@/domains/products/commands/contracts";
import type { ListProductsInput } from "@/domains/products/commands/schemas";
import {
  getProductModel,
  getProductTranslationModel,
  getProductVersionModel,
} from "@/domains/products/persistence/models";
import {
  mapProduct,
  mapProductTranslation,
  mapProductVersion,
  PRODUCT_PROJECTION,
  PRODUCT_TRANSLATION_PROJECTION,
  PRODUCT_VERSION_PROJECTION,
  type ProductRaw,
  type ProductTranslationRaw,
  type ProductVersionRaw,
} from "@/domains/products/persistence/repository";
import { getLocalizedRouteModel } from "@/domains/content/persistence/models";
import { connectToDatabase } from "@/lib/db/mongoose";

function scopeFilter(scope: ProductStoreAccessScope): Record<string, unknown> {
  if (scope.kind === "all") return {};
  if (scope.kind === "own") return { createdBy: scope.ownerUserId };
  return { _id: { $exists: false } };
}

function escapedRegex(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function mutationError(error: unknown): never {
  if (error instanceof ProductCommandStoreError) throw error;
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === 11000
  ) {
    throw new ProductCommandStoreError(
      "IDENTIFIER_CONFLICT",
      "The SKU, internal identifier, or localized route is already in use.",
    );
  }
  throw new ProductCommandStoreError(
    "PERSISTENCE_FAILURE",
    "The product command could not be persisted.",
  );
}

async function loadBundle(
  versionId: string | Types.ObjectId | null | undefined,
): Promise<ProductVersionBundleDto | null> {
  if (!versionId) return null;
  const Version = getProductVersionModel();
  const Translation = getProductTranslationModel();
  const [version, translations] = await Promise.all([
    Version.findById(versionId, PRODUCT_VERSION_PROJECTION).lean().exec(),
    Translation.find({ versionId }, PRODUCT_TRANSLATION_PROJECTION)
      .sort({ locale: 1 })
      .lean()
      .exec(),
  ]);
  if (!version) return null;
  return {
    version: mapProductVersion(version as unknown as ProductVersionRaw),
    translations: translations.map((translation) =>
      mapProductTranslation(translation as unknown as ProductTranslationRaw),
    ),
  };
}

async function loadAggregate(
  scope: ProductStoreAccessScope,
  productId: string,
): Promise<ProductAdminAggregateDto | null> {
  if (!Types.ObjectId.isValid(productId)) return null;
  const raw = await getProductModel()
    .findOne(
      {
        _id: productId,
        deletedAt: { $exists: false },
        ...scopeFilter(scope),
      },
      PRODUCT_PROJECTION,
    )
    .lean()
    .exec();
  if (!raw) return null;
  const product = mapProduct(raw as unknown as ProductRaw);
  const [draft, published] = await Promise.all([
    loadBundle(product.currentDraftVersionId),
    product.currentPublishedVersionId === product.currentDraftVersionId
      ? Promise.resolve(null)
      : loadBundle(product.currentPublishedVersionId),
  ]);
  return { product, draft, published };
}

function versionFields(
  input: CreateProductDraftStoreInput["version"],
): Record<string, unknown> {
  return {
    ...(input.dimensions ? { dimensions: input.dimensions } : {}),
    ...(input.weight ? { weight: input.weight } : {}),
    materials: input.materials,
    colors: input.colors,
    finishes: input.finishes,
    ...(input.leadTimeDays == null ? {} : { leadTimeDays: input.leadTimeDays }),
    mediaIds: input.mediaIds.map((id) => new Types.ObjectId(id)),
    showPrice: input.showPrice,
    ...(input.publicPrice ? { publicPrice: input.publicPrice } : {}),
    relatedProductIds: input.relatedProductIds.map(
      (id) => new Types.ObjectId(id),
    ),
    ...(input.bomVersionId
      ? { bomVersionId: new Types.ObjectId(input.bomVersionId) }
      : {}),
  };
}

function productFields(
  metadata: CreateProductDraftStoreInput["metadata"],
): Record<string, unknown> {
  return {
    internalId: metadata.internalId,
    sku: metadata.sku,
    ...(metadata.categoryId
      ? { categoryId: new Types.ObjectId(metadata.categoryId) }
      : { $unsetCategory: true }),
    collectionIds: metadata.collectionIds.map((id) => new Types.ObjectId(id)),
    materialKeys: metadata.materialKeys,
    finishKeys: metadata.finishKeys,
    searchTokens: metadata.searchTokens,
  };
}

function cleanProductFields(
  metadata: CreateProductDraftStoreInput["metadata"],
): Record<string, unknown> {
  const fields = productFields(metadata);
  delete fields.$unsetCategory;
  return fields;
}

function translationFields(
  translation: CreateProductDraftStoreInput["translations"][number],
): Record<string, unknown> {
  return {
    locale: translation.locale,
    slug: translation.slug,
    title: translation.title,
    ...(translation.shortDescription
      ? { shortDescription: translation.shortDescription }
      : {}),
    description: translation.description,
    story: translation.story,
    careInstructions: translation.careInstructions,
    seo: translation.seo,
  };
}

async function assertModified(
  result: { modifiedCount: number },
  code: "STALE_REVISION" | "DRAFT_NOT_FOUND",
  message: string,
): Promise<void> {
  if (result.modifiedCount !== 1) {
    throw new ProductCommandStoreError(code, message);
  }
}

async function reserveRoutes(
  input: PublishProductStoreInput,
  session: ClientSession,
): Promise<void> {
  const Route = getLocalizedRouteModel();
  const routeIds = new Map(
    input.routes.map((route) => [route.locale, new Types.ObjectId()]),
  );
  for (const route of input.routes) {
    const collision = await Route.exists({
      locale: route.locale,
      path: route.path,
      active: true,
      $or: [
        { entityType: { $ne: "product" } },
        { entityId: { $ne: new Types.ObjectId(input.productId) } },
      ],
    }).session(session);
    if (collision) {
      throw new ProductCommandStoreError(
        "ROUTE_UNAVAILABLE",
        `The localized route ${route.path} is already reserved.`,
      );
    }
  }
  for (const route of input.routes) {
    const replacementId = routeIds.get(route.locale)!;
    await Route.updateMany(
      {
        entityType: "product",
        entityId: input.productId,
        locale: route.locale,
        active: true,
      },
      {
        $set: {
          active: false,
          redirectToPath: route.path,
          redirectStatus: 308,
          replacedByRouteId: replacementId,
          deactivatedAt: input.occurredAt,
          updatedBy: input.actorId,
        },
        $inc: { revision: 1 },
      },
      { session },
    ).exec();
    await Route.create(
      [
        {
          _id: replacementId,
          locale: route.locale,
          path: route.path,
          entityType: "product",
          entityId: input.productId,
          versionId: input.versionId,
          active: true,
          activatedAt: input.occurredAt,
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
      ],
      { session },
    );
  }
}

async function appendPublishAudit(
  input: PublishProductStoreInput,
  session: ClientSession,
) {
  await new (getAuditEventModel())({
    actorType: "user",
    actorId: input.actorId,
    action: "product.published",
    resourceType: "product",
    resourceId: input.productId,
    businessUnitIds: input.businessUnitIds
      .filter(Types.ObjectId.isValid)
      .map((id) => new Types.ObjectId(id)),
    requestId: input.requestId,
    permissionDecision: {
      permission: "content.publish",
      outcome: "allowed",
      reasonCode: "COMMAND_AUTHORIZED",
      scope: input.permissionScope,
    },
    before: {
      expectedProductRevision: input.expectedProductRevision,
      draftVersionId: input.versionId,
    },
    after: {
      publishedVersionId: input.versionId,
      routes: input.routes,
    },
    occurredAt: input.occurredAt,
  }).save({ session });
}

export class MongoProductCommandStore implements ProductCommandStore {
  readonly publishesAuditAtomically = true;

  async listProducts(
    scope: ProductStoreAccessScope,
    input: ListProductsInput,
  ): Promise<ProductListDto> {
    await connectToDatabase();
    const query: Record<string, unknown> = {
      deletedAt: { $exists: false },
      ...scopeFilter(scope),
      ...(input.status ? { status: input.status } : {}),
      ...(input.query
        ? {
            $or: [
              { sku: escapedRegex(input.query) },
              { internalId: escapedRegex(input.query) },
              { searchTokens: escapedRegex(input.query) },
            ],
          }
        : {}),
    };
    const Product = getProductModel();
    const [rawProducts, total] = await Promise.all([
      Product.find(query, PRODUCT_PROJECTION)
        .sort({ updatedAt: -1, _id: -1 })
        .skip(input.offset)
        .limit(input.limit)
        .lean()
        .exec(),
      Product.countDocuments(query).exec(),
    ]);
    const aggregates = await Promise.all(
      rawProducts.map((raw) =>
        loadAggregate(scope, String((raw as { _id: Types.ObjectId })._id)),
      ),
    );
    return {
      items: aggregates.flatMap((aggregate) =>
        aggregate
          ? [
              {
                product: aggregate.product,
                draftVersion: aggregate.draft?.version.version ?? null,
                publishedVersion: aggregate.published?.version.version ?? null,
                translations: (
                  aggregate.draft?.translations ??
                  aggregate.published?.translations ??
                  []
                ).map((translation) => ({
                  locale: translation.locale,
                  title: translation.title,
                  status: translation.translationStatus,
                })),
              },
            ]
          : [],
      ),
      offset: input.offset,
      limit: input.limit,
      total,
    };
  }

  async readProduct(
    scope: ProductStoreAccessScope,
    productId: string,
  ): Promise<ProductAdminAggregateDto | null> {
    await connectToDatabase();
    return loadAggregate(scope, productId);
  }

  async createDraft(
    input: CreateProductDraftStoreInput,
  ): Promise<ProductAdminAggregateDto> {
    const database = await connectToDatabase();
    let productId: Types.ObjectId | undefined;
    try {
      await database.connection.transaction(async (session) => {
        const Product = getProductModel();
        const Version = getProductVersionModel();
        const Translation = getProductTranslationModel();
        const [product] = await Product.create(
          [
            {
              ...cleanProductFields(input.metadata),
              status: "draft",
              createdBy: input.actorId,
              updatedBy: input.actorId,
            },
          ],
          { session },
        );
        if (!product) throw new Error("Product creation returned no document");
        const createdProductId = product._id;
        productId = createdProductId;
        const [version] = await Version.create(
          [
            {
              productId: createdProductId,
              version: 1,
              status: "draft",
              ...versionFields(input.version),
              createdBy: input.actorId,
              updatedBy: input.actorId,
            },
          ],
          { session },
        );
        if (!version) throw new Error("Version creation returned no document");
        for (const translation of input.translations) {
          await new Translation({
            productId: createdProductId,
            versionId: version._id,
            ...translationFields(translation),
            translationStatus: "draft",
            sourceRevision: 1,
            createdBy: input.actorId,
            updatedBy: input.actorId,
          }).save({ session });
        }
        const updated = await Product.updateOne(
          {
            _id: createdProductId,
            revision: (product as unknown as { revision: number }).revision,
          },
          {
            $set: {
              currentDraftVersionId: version._id,
              updatedBy: input.actorId,
            },
            $inc: { revision: 1 },
          },
          { session },
        ).exec();
        await assertModified(
          updated,
          "STALE_REVISION",
          "The new product changed while its draft was attached.",
        );
      });
    } catch (error) {
      mutationError(error);
    }
    const aggregate = await loadAggregate({ kind: "all" }, String(productId));
    if (!aggregate) mutationError(new Error("Created product was not found"));
    return aggregate;
  }

  async createRevisionDraft(
    scope: ProductStoreAccessScope,
    input: CreateProductRevisionDraftStoreInput,
  ): Promise<ProductAdminAggregateDto> {
    const database = await connectToDatabase();
    try {
      await database.connection.transaction(async (session) => {
        const Product = getProductModel();
        const Version = getProductVersionModel();
        const Translation = getProductTranslationModel();
        const product = await Product.findOne({
          _id: input.productId,
          revision: input.expectedProductRevision,
          currentPublishedVersionId: { $exists: true },
          currentDraftVersionId: { $exists: false },
          deletedAt: { $exists: false },
          ...scopeFilter(scope),
        })
          .session(session)
          .exec();
        if (!product) {
          throw new ProductCommandStoreError(
            "STALE_REVISION",
            "The product cannot accept a new draft at this revision.",
          );
        }
        const latest = await Version.findOne({ productId: input.productId })
          .sort({ version: -1 })
          .select({ version: 1 })
          .session(session)
          .lean()
          .exec();
        const nextVersion = (latest?.version ?? 0) + 1;
        const [version] = await Version.create(
          [
            {
              productId: input.productId,
              version: nextVersion,
              status: "draft",
              ...versionFields(input.version),
              createdBy: input.actorId,
              updatedBy: input.actorId,
            },
          ],
          { session },
        );
        if (!version) throw new Error("Version creation returned no document");
        for (const translation of input.translations) {
          await new Translation({
            productId: input.productId,
            versionId: version._id,
            ...translationFields(translation),
            translationStatus: "draft",
            sourceRevision: nextVersion,
            createdBy: input.actorId,
            updatedBy: input.actorId,
          }).save({ session });
        }
        const updated = await Product.updateOne(
          {
            _id: input.productId,
            revision: input.expectedProductRevision,
            currentDraftVersionId: { $exists: false },
          },
          {
            $set: {
              currentDraftVersionId: version._id,
              updatedBy: input.actorId,
            },
            $inc: { revision: 1 },
          },
          { session },
        ).exec();
        await assertModified(
          updated,
          "STALE_REVISION",
          "The product changed while its new draft was attached.",
        );
      });
    } catch (error) {
      mutationError(error);
    }
    const aggregate = await loadAggregate({ kind: "all" }, input.productId);
    if (!aggregate) mutationError(new Error("Updated product was not found"));
    return aggregate;
  }

  async updateDraft(
    scope: ProductStoreAccessScope,
    input: UpdateProductDraftStoreInput,
  ): Promise<ProductAdminAggregateDto> {
    const database = await connectToDatabase();
    try {
      await database.connection.transaction(async (session) => {
        const Product = getProductModel();
        const Version = getProductVersionModel();
        const Translation = getProductTranslationModel();
        const productSet = cleanProductFields(input.metadata);
        const versionSet = versionFields(input.version);
        const productUpdate: Record<string, unknown> = {
          ...productSet,
          updatedBy: input.actorId,
        };
        const productOperation: Record<string, unknown> = {
          $set: productUpdate,
          $inc: { revision: 1 },
        };
        if (!input.metadata.categoryId) {
          productOperation.$unset = { categoryId: "" };
        }
        const product = await Product.updateOne(
          {
            _id: input.productId,
            revision: input.expectedProductRevision,
            currentDraftVersionId: input.versionId,
            deletedAt: { $exists: false },
            ...scopeFilter(scope),
          },
          productOperation,
          { session },
        ).exec();
        await assertModified(
          product,
          "STALE_REVISION",
          "The product metadata changed before the draft was saved.",
        );
        const versionOperation: Record<string, unknown> = {
          $set: { ...versionSet, updatedBy: input.actorId },
          $inc: { revision: 1 },
        };
        if (!input.version.dimensions) {
          versionOperation.$unset = {
            dimensions: "",
            weight: input.version.weight ? undefined : "",
            leadTimeDays: input.version.leadTimeDays == null ? "" : undefined,
            publicPrice: input.version.publicPrice ? undefined : "",
            bomVersionId: input.version.bomVersionId ? undefined : "",
          };
        }
        const version = await Version.updateOne(
          {
            _id: input.versionId,
            productId: input.productId,
            status: "draft",
            revision: input.expectedVersionRevision,
          },
          versionOperation,
          { session },
        ).exec();
        await assertModified(
          version,
          "DRAFT_NOT_FOUND",
          "The product draft changed before it was saved.",
        );
        for (const translation of input.translations) {
          if (translation.expectedRevision === undefined) {
            await new Translation({
              productId: input.productId,
              versionId: input.versionId,
              ...translationFields(translation),
              translationStatus: "draft",
              sourceRevision: input.expectedVersionRevision + 1,
              createdBy: input.actorId,
              updatedBy: input.actorId,
            }).save({ session });
            continue;
          }
          const translationOperation: Record<string, unknown> = {
            $set: {
              ...translationFields(translation),
              sourceRevision: input.expectedVersionRevision + 1,
              updatedBy: input.actorId,
            },
            $inc: { revision: 1 },
          };
          if (!translation.shortDescription) {
            translationOperation.$unset = { shortDescription: "" };
          }
          const updated = await Translation.updateOne(
            {
              productId: input.productId,
              versionId: input.versionId,
              locale: translation.locale,
              translationStatus: "draft",
              revision: translation.expectedRevision,
            },
            translationOperation,
            { session },
          ).exec();
          await assertModified(
            updated,
            "STALE_REVISION",
            `The ${translation.locale} translation changed before it was saved.`,
          );
        }
      });
    } catch (error) {
      mutationError(error);
    }
    const aggregate = await loadAggregate({ kind: "all" }, input.productId);
    if (!aggregate) mutationError(new Error("Updated product was not found"));
    return aggregate;
  }

  async submitForReview(
    scope: ProductStoreAccessScope,
    input: SubmitProductForReviewStoreInput,
  ): Promise<ProductAdminAggregateDto> {
    return this.#transitionReview(scope, input, "draft", "inReview");
  }

  async returnToDraft(
    input: ReturnProductToDraftStoreInput,
  ): Promise<ProductAdminAggregateDto> {
    return this.#transitionReview({ kind: "all" }, input, "inReview", "draft");
  }

  async publish(
    input: PublishProductStoreInput,
  ): Promise<ProductAdminAggregateDto> {
    const database = await connectToDatabase();
    try {
      await database.connection.transaction(async (session) => {
        const Product = getProductModel();
        const Version = getProductVersionModel();
        const Translation = getProductTranslationModel();
        await reserveRoutes(input, session);
        const version = await Version.updateOne(
          {
            _id: input.versionId,
            productId: input.productId,
            status: "inReview",
            revision: input.expectedVersionRevision,
          },
          {
            $set: {
              status: "published",
              reviewedAt: input.occurredAt,
              reviewedBy: input.actorId,
              publishedAt: input.occurredAt,
              updatedBy: input.actorId,
            },
            $inc: { revision: 1 },
          },
          { session },
        ).exec();
        await assertModified(
          version,
          "STALE_REVISION",
          "The product review changed before publication.",
        );
        for (const expected of input.expectedTranslations) {
          const translation = await Translation.updateOne(
            {
              versionId: input.versionId,
              locale: expected.locale,
              translationStatus: "inReview",
              revision: expected.expectedRevision,
            },
            {
              $set: {
                translationStatus: "published",
                reviewedBy: input.actorId,
                publishedAt: input.occurredAt,
                updatedBy: input.actorId,
              },
              $inc: { revision: 1 },
            },
            { session },
          ).exec();
          await assertModified(
            translation,
            "STALE_REVISION",
            `The ${expected.locale} translation changed before publication.`,
          );
        }
        const product = await Product.updateOne(
          {
            _id: input.productId,
            revision: input.expectedProductRevision,
            currentDraftVersionId: input.versionId,
            deletedAt: { $exists: false },
          },
          {
            $set: {
              status: "published",
              currentPublishedVersionId: input.versionId,
              updatedBy: input.actorId,
            },
            $unset: { currentDraftVersionId: "" },
            $inc: { revision: 1 },
          },
          { session },
        ).exec();
        await assertModified(
          product,
          "STALE_REVISION",
          "The product pointer changed before publication.",
        );
        await appendPublishAudit(input, session);
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 11000
      ) {
        throw new ProductCommandStoreError(
          "ROUTE_UNAVAILABLE",
          "A localized product route was reserved concurrently.",
        );
      }
      mutationError(error);
    }
    const aggregate = await loadAggregate({ kind: "all" }, input.productId);
    if (!aggregate) mutationError(new Error("Published product was not found"));
    return aggregate;
  }

  async #transitionReview(
    scope: ProductStoreAccessScope,
    input: SubmitProductForReviewStoreInput | ReturnProductToDraftStoreInput,
    from: "draft" | "inReview",
    to: "inReview" | "draft",
  ): Promise<ProductAdminAggregateDto> {
    const database = await connectToDatabase();
    try {
      await database.connection.transaction(async (session) => {
        const Product = getProductModel();
        const Version = getProductVersionModel();
        const Translation = getProductTranslationModel();
        const version = await Version.updateOne(
          {
            _id: input.versionId,
            productId: input.productId,
            status: from,
            revision: input.expectedVersionRevision,
          },
          {
            $set: {
              status: to,
              ...(to === "inReview"
                ? { submittedAt: input.occurredAt }
                : { submittedAt: null }),
              updatedBy: input.actorId,
            },
            $inc: { revision: 1 },
          },
          { session },
        ).exec();
        await assertModified(
          version,
          "STALE_REVISION",
          "The product draft changed during the workflow transition.",
        );
        for (const expected of input.expectedTranslations) {
          const translation = await Translation.updateOne(
            {
              versionId: input.versionId,
              locale: expected.locale,
              translationStatus: from,
              revision: expected.expectedRevision,
            },
            {
              $set: {
                translationStatus: to,
                updatedBy: input.actorId,
              },
              $inc: { revision: 1 },
            },
            { session },
          ).exec();
          await assertModified(
            translation,
            "STALE_REVISION",
            `The ${expected.locale} translation changed during review.`,
          );
        }
        const hasPublished = await Product.exists({
          _id: input.productId,
          currentPublishedVersionId: { $exists: true },
        }).session(session);
        const product = await Product.updateOne(
          {
            _id: input.productId,
            revision: input.expectedProductRevision,
            currentDraftVersionId: input.versionId,
            deletedAt: { $exists: false },
            ...scopeFilter(scope),
          },
          {
            $set: {
              status: hasPublished ? "published" : to,
              updatedBy: input.actorId,
            },
            $inc: { revision: 1 },
          },
          { session },
        ).exec();
        await assertModified(
          product,
          "STALE_REVISION",
          "The product pointer changed during review.",
        );
      });
    } catch (error) {
      mutationError(error);
    }
    const aggregate = await loadAggregate({ kind: "all" }, input.productId);
    if (!aggregate)
      mutationError(new Error("Transitioned product was not found"));
    return aggregate;
  }
}
