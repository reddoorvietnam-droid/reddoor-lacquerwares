import "server-only";

import { Schema } from "mongoose";

import { importShipmentDocumentKinds } from "@/domains/import-shipments/contracts";
import {
  actorFields,
  getOrCreateModel,
  rootSchemaOptions,
} from "@/lib/content/mongoose";

/**
 * One import shipment and every document of it (collection
 * `importshipments`). No status and no delete: the file is kept.
 */

// Documents are removed by id, so each keeps its own `_id`.
const identifiedSubdocumentOptions = {
  _id: true,
  strict: "throw" as const,
  minimize: false,
};

const importShipmentDocumentSchema = new Schema(
  {
    kind: { type: String, required: true, enum: importShipmentDocumentKinds },
    publicId: { type: String, required: true, trim: true, maxlength: 500 },
    assetVersion: { type: Number, required: true, min: 1 },
    format: { type: String, required: true, trim: true, maxlength: 10 },
    bytes: { type: Number, required: true, min: 1 },
    label: { type: String, required: true, trim: true, maxlength: 200 },
    uploadedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    uploadedAt: { type: Date, required: true },
  },
  identifiedSubdocumentOptions,
);

export const importShipmentSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },
    declarationNumber: {
      type: String,
      trim: true,
      maxlength: 60,
      default: null,
    },
    declaredOn: { type: Date, default: null },
    supplierName: { type: String, required: true, trim: true, maxlength: 240 },
    goodsDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2_000,
    },
    note: { type: String, trim: true, maxlength: 4_000, default: null },
    documents: {
      type: [importShipmentDocumentSchema],
      required: true,
      default: [],
    },
    ...actorFields,
  },
  rootSchemaOptions,
);

importShipmentSchema.index(
  { code: 1 },
  { unique: true, name: "import_shipment_code_unique" },
);
importShipmentSchema.index(
  { createdAt: -1 },
  { name: "import_shipment_listing" },
);

export const getImportShipmentModel = () =>
  getOrCreateModel("ImportShipment", importShipmentSchema);
