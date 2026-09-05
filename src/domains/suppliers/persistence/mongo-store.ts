import "server-only";

import { Types } from "mongoose";

import {
  SupplierCommandError,
  type SupplierListFilter,
  type SupplierRecordDto,
  type SupplierStatus,
  type SupplierStore,
  type SupplierWriteFields,
} from "@/domains/suppliers/contracts";
import { getSupplierModel } from "@/domains/suppliers/persistence/models";
import { connectToDatabase } from "@/lib/db/mongoose";

type SupplierDocument = {
  _id: Types.ObjectId;
  code: string | null;
  name: string;
  taxCode?: string | null;
  category: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: SupplierStatus;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

function toDto(document: SupplierDocument): SupplierRecordDto {
  return {
    id: document._id.toHexString(),
    code: document.code ?? null,
    name: document.name,
    taxCode: document.taxCode ?? null,
    category: document.category ?? null,
    contactName: document.contactName ?? null,
    email: document.email ?? null,
    phone: document.phone ?? null,
    address: document.address ?? null,
    notes: document.notes ?? null,
    status: document.status,
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

export class MongoSupplierStore implements SupplierStore {
  async insert(
    record: SupplierWriteFields & { createdBy: string },
  ): Promise<SupplierRecordDto> {
    await connectToDatabase();

    const actorId = new Types.ObjectId(record.createdBy);
    try {
      const document = await getSupplierModel().create({
        code: record.code,
        name: record.name,
        taxCode: record.taxCode,
        category: record.category,
        contactName: record.contactName,
        email: record.email,
        phone: record.phone,
        address: record.address,
        notes: record.notes,
        status: "active",
        createdBy: actorId,
        updatedBy: actorId,
      });
      return toDto(document.toObject() as SupplierDocument);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new SupplierCommandError(
          "DUPLICATE_CODE",
          "A supplier with this code already exists.",
        );
      }
      throw error;
    }
  }

  async findById(supplierId: string): Promise<SupplierRecordDto | null> {
    if (!Types.ObjectId.isValid(supplierId)) return null;
    await connectToDatabase();

    const document = await getSupplierModel()
      .findById(supplierId)
      .lean<SupplierDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async list(filter: SupplierListFilter): Promise<SupplierRecordDto[]> {
    await connectToDatabase();

    const documents = await getSupplierModel()
      .find(filter.status ? { status: filter.status } : {})
      .sort({ name: 1 })
      .limit(1_000)
      .lean<SupplierDocument[]>()
      .exec();
    return documents.map(toDto);
  }

  async update(input: {
    supplierId: string;
    expectedRevision: number;
    fields: SupplierWriteFields;
    updatedBy: string;
  }): Promise<SupplierRecordDto | null> {
    await connectToDatabase();

    try {
      const document = await getSupplierModel()
        .findOneAndUpdate(
          {
            _id: new Types.ObjectId(input.supplierId),
            revision: input.expectedRevision,
          },
          {
            $set: {
              ...input.fields,
              updatedBy: new Types.ObjectId(input.updatedBy),
            },
            $inc: { revision: 1 },
          },
          { new: true, runValidators: true },
        )
        .lean<SupplierDocument>()
        .exec();
      return document ? toDto(document) : null;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new SupplierCommandError(
          "DUPLICATE_CODE",
          "A supplier with this code already exists.",
        );
      }
      throw error;
    }
  }

  async setStatus(input: {
    supplierId: string;
    expectedRevision: number;
    status: SupplierStatus;
    updatedBy: string;
  }): Promise<SupplierRecordDto | null> {
    await connectToDatabase();

    const document = await getSupplierModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.supplierId),
          revision: input.expectedRevision,
        },
        {
          $set: {
            status: input.status,
            updatedBy: new Types.ObjectId(input.updatedBy),
          },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean<SupplierDocument>()
      .exec();
    return document ? toDto(document) : null;
  }
}

export const mongoSupplierStore = new MongoSupplierStore();
