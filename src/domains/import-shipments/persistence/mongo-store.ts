import "server-only";

import { Types } from "mongoose";

import {
  ImportShipmentCommandError,
  type ImportShipmentDocument,
  type ImportShipmentDocumentKind,
  type ImportShipmentListFilter,
  type ImportShipmentRecordDto,
  type ImportShipmentStore,
  type ImportShipmentWriteFields,
  type NewImportShipmentDocument,
} from "@/domains/import-shipments/contracts";
import { getImportShipmentModel } from "@/domains/import-shipments/persistence/models";
import { connectToDatabase } from "@/lib/db/mongoose";

type StoredDocument = {
  _id: Types.ObjectId;
  kind: ImportShipmentDocumentKind;
  publicId: string;
  assetVersion: number;
  format: string;
  bytes: number;
  label: string;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
};

type ImportShipmentMongoDocument = {
  _id: Types.ObjectId;
  code: string;
  declarationNumber?: string | null;
  declaredOn?: Date | null;
  supplierName: string;
  goodsDescription: string;
  note?: string | null;
  documents?: StoredDocument[];
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

function toDocumentDto(document: StoredDocument): ImportShipmentDocument {
  return {
    id: document._id.toHexString(),
    kind: document.kind,
    publicId: document.publicId,
    assetVersion: document.assetVersion,
    format: document.format,
    bytes: document.bytes,
    label: document.label,
    uploadedBy: document.uploadedBy.toHexString(),
    uploadedAt: document.uploadedAt,
  };
}

function toDto(document: ImportShipmentMongoDocument): ImportShipmentRecordDto {
  return {
    id: document._id.toHexString(),
    code: document.code,
    declarationNumber: document.declarationNumber ?? null,
    declaredOn: document.declaredOn ?? null,
    supplierName: document.supplierName,
    goodsDescription: document.goodsDescription,
    note: document.note ?? null,
    documents: (document.documents ?? []).map(toDocumentDto),
    createdBy: document.createdBy.toHexString(),
    updatedBy: document.updatedBy.toHexString(),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    revision: document.revision,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

function duplicateCode(): ImportShipmentCommandError {
  return new ImportShipmentCommandError(
    "DUPLICATE_CODE",
    "An import shipment with this code already exists.",
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class MongoImportShipmentStore implements ImportShipmentStore {
  /**
   * Every write is conditional on the revision the caller judged: a
   * concurrent change makes it a miss, never a silent overwrite.
   */
  private async conditionalUpdate(
    shipmentId: string,
    expectedRevision: number,
    update: Record<string, unknown>,
    extraFilter: Record<string, unknown> = {},
    runValidators = false,
  ): Promise<ImportShipmentRecordDto | null> {
    if (!Types.ObjectId.isValid(shipmentId)) return null;
    await connectToDatabase();
    try {
      const document = await getImportShipmentModel()
        .findOneAndUpdate(
          {
            _id: new Types.ObjectId(shipmentId),
            revision: expectedRevision,
            ...extraFilter,
          },
          { ...update, $inc: { revision: 1 } },
          { new: true, runValidators },
        )
        .lean<ImportShipmentMongoDocument>()
        .exec();
      return document ? toDto(document) : null;
    } catch (error) {
      if (isDuplicateKeyError(error)) throw duplicateCode();
      throw error;
    }
  }

  async insert(
    record: ImportShipmentWriteFields & { code: string; createdBy: string },
  ): Promise<ImportShipmentRecordDto> {
    await connectToDatabase();

    const actorId = new Types.ObjectId(record.createdBy);
    try {
      const document = await getImportShipmentModel().create({
        code: record.code,
        declarationNumber: record.declarationNumber,
        declaredOn: record.declaredOn,
        supplierName: record.supplierName,
        goodsDescription: record.goodsDescription,
        note: record.note,
        documents: [],
        createdBy: actorId,
        updatedBy: actorId,
      });
      return toDto(document.toObject() as ImportShipmentMongoDocument);
    } catch (error) {
      if (isDuplicateKeyError(error)) throw duplicateCode();
      throw error;
    }
  }

  async findById(shipmentId: string): Promise<ImportShipmentRecordDto | null> {
    if (!Types.ObjectId.isValid(shipmentId)) return null;
    await connectToDatabase();

    const document = await getImportShipmentModel()
      .findById(shipmentId)
      .lean<ImportShipmentMongoDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async list(
    filter: ImportShipmentListFilter,
  ): Promise<ImportShipmentRecordDto[]> {
    await connectToDatabase();

    const search = filter.search?.trim();
    const pattern = search ? new RegExp(escapeRegex(search), "i") : null;
    const documents = await getImportShipmentModel()
      .find(
        pattern
          ? {
              $or: [
                { code: pattern },
                { declarationNumber: pattern },
                { supplierName: pattern },
                { goodsDescription: pattern },
              ],
            }
          : {},
      )
      .sort({ createdAt: -1 })
      .limit(500)
      .lean<ImportShipmentMongoDocument[]>()
      .exec();
    return documents.map(toDto);
  }

  async update(input: {
    shipmentId: string;
    expectedRevision: number;
    fields: ImportShipmentWriteFields & { code: string };
    updatedBy: string;
  }): Promise<ImportShipmentRecordDto | null> {
    return this.conditionalUpdate(
      input.shipmentId,
      input.expectedRevision,
      {
        $set: {
          code: input.fields.code,
          declarationNumber: input.fields.declarationNumber,
          declaredOn: input.fields.declaredOn,
          supplierName: input.fields.supplierName,
          goodsDescription: input.fields.goodsDescription,
          note: input.fields.note,
          updatedBy: new Types.ObjectId(input.updatedBy),
        },
      },
      {},
      true,
    );
  }

  async addDocument(input: {
    shipmentId: string;
    expectedRevision: number;
    document: NewImportShipmentDocument;
    updatedBy: string;
  }): Promise<ImportShipmentRecordDto | null> {
    return this.conditionalUpdate(input.shipmentId, input.expectedRevision, {
      $set: { updatedBy: new Types.ObjectId(input.updatedBy) },
      $push: {
        documents: {
          _id: new Types.ObjectId(),
          kind: input.document.kind,
          publicId: input.document.publicId,
          assetVersion: input.document.assetVersion,
          format: input.document.format,
          bytes: input.document.bytes,
          label: input.document.label,
          uploadedBy: new Types.ObjectId(input.document.uploadedBy),
          uploadedAt: input.document.uploadedAt,
        },
      },
    });
  }

  async removeDocument(input: {
    shipmentId: string;
    expectedRevision: number;
    documentId: string;
    updatedBy: string;
  }): Promise<ImportShipmentRecordDto | null> {
    if (!Types.ObjectId.isValid(input.documentId)) return null;
    const documentId = new Types.ObjectId(input.documentId);
    return this.conditionalUpdate(
      input.shipmentId,
      input.expectedRevision,
      {
        $set: { updatedBy: new Types.ObjectId(input.updatedBy) },
        $pull: { documents: { _id: documentId } },
      },
      { "documents._id": documentId },
    );
  }
}

export const mongoImportShipmentStore = new MongoImportShipmentStore();
