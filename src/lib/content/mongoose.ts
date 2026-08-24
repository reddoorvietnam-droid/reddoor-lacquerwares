import "server-only";

import mongoose, {
  type Model,
  Schema,
  type SchemaDefinitionProperty,
  Types,
} from "mongoose";

import {
  seoFieldsSchema,
  structuredBlocksSchema,
  type SeoFields,
  type StructuredBlock,
} from "@/lib/content/contracts";
import {
  sanitizeRichTextHtml,
  sanitizeStructuredBlocksForRender,
} from "@/lib/content/sanitize";

export const rootSchemaOptions = {
  strict: "throw" as const,
  timestamps: true,
  optimisticConcurrency: true,
  minimize: false,
  versionKey: "revision",
};

export const nestedSchemaOptions = {
  _id: false,
  strict: "throw" as const,
  minimize: false,
};

export const actorFields = {
  createdBy: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
} satisfies Record<string, SchemaDefinitionProperty>;

export const seoFieldsMongooseSchema = new Schema(
  {
    title: { type: String, trim: true, maxlength: 70 },
    description: { type: String, trim: true, maxlength: 180 },
    canonicalOverride: { type: String, trim: true, maxlength: 2_048 },
    imageMediaId: { type: Schema.Types.ObjectId, ref: "MediaAsset" },
    noIndex: { type: Boolean, required: true, default: false },
  },
  nestedSchemaOptions,
);

export const structuredBlockMongooseSchema = new Schema(
  {
    blockId: { type: String, required: true, trim: true, maxlength: 80 },
    type: {
      type: String,
      required: true,
      enum: [
        "heading",
        "paragraph",
        "richText",
        "image",
        "quote",
        "list",
        "callToAction",
      ],
    },
    level: { type: Number, enum: [2, 3, 4] },
    text: { type: String, trim: true, maxlength: 20_000 },
    html: {
      type: String,
      maxlength: 50_000,
      set: (value: unknown) =>
        typeof value === "string" ? sanitizeRichTextHtml(value) : value,
    },
    mediaId: { type: Schema.Types.ObjectId, ref: "MediaAsset" },
    alt: { type: String, trim: true, maxlength: 300 },
    caption: { type: String, trim: true, maxlength: 500 },
    attribution: { type: String, trim: true, maxlength: 300 },
    style: { type: String, enum: ["ordered", "unordered"] },
    items: {
      type: [{ type: String, trim: true, maxlength: 1_000 }],
      default: undefined,
    },
    label: { type: String, trim: true, maxlength: 120 },
    href: { type: String, trim: true, maxlength: 2_048 },
  },
  nestedSchemaOptions,
);

function normalizeBlockForValidation(value: unknown): unknown {
  if (value && typeof value === "object" && "toObject" in value) {
    const objectValue = (
      value as { toObject: (options?: object) => Record<string, unknown> }
    ).toObject({ depopulate: true });

    if (objectValue.mediaId instanceof Types.ObjectId) {
      objectValue.mediaId = objectValue.mediaId.toHexString();
    }

    return objectValue;
  }

  return value;
}

export const structuredBlocksMongooseField = {
  type: [structuredBlockMongooseSchema],
  required: true,
  default: [],
  validate: {
    validator: (value: unknown[]) =>
      structuredBlocksSchema.safeParse(value.map(normalizeBlockForValidation))
        .success,
    message: "Structured blocks do not match the supported block contracts",
  },
} satisfies SchemaDefinitionProperty<StructuredBlock[]>;

export function getOrCreateModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (
    (mongoose.models[name] as Model<T> | undefined) ??
    mongoose.model<T>(name, schema)
  );
}

export function objectIdToString(value: Types.ObjectId): string {
  return value.toHexString();
}

export function dateToIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function decimal128ToString(
  value: Types.Decimal128 | null | undefined,
): string | null {
  return value?.toString() ?? null;
}

function normalizePersistedObjectIds(value: unknown): unknown {
  if (value instanceof Types.ObjectId) {
    return value.toHexString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizePersistedObjectIds);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        normalizePersistedObjectIds(nestedValue),
      ]),
    );
  }

  return value;
}

export function persistedBlocksToDto(value: unknown): StructuredBlock[] {
  return sanitizeStructuredBlocksForRender(normalizePersistedObjectIds(value));
}

export function persistedSeoToDto(value: unknown): SeoFields {
  return seoFieldsSchema.parse(normalizePersistedObjectIds(value));
}
