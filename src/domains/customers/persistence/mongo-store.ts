import "server-only";

import { Types } from "mongoose";

import {
  CustomerCommandError,
  type CustomerListFilter,
  type CustomerRecordDto,
  type CustomerStatus,
  type CustomerStore,
  type CustomerWriteFields,
} from "@/domains/customers/contracts";
import { getCustomerModel } from "@/domains/customers/persistence/models";
import { connectToDatabase } from "@/lib/db/mongoose";
import type { Currency } from "@/lib/money";

type CustomerDocument = {
  _id: Types.ObjectId;
  code: string | null;
  name: string;
  taxCode?: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  defaultCurrency: Currency | null;
  notes: string | null;
  status: CustomerStatus;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

function toDto(document: CustomerDocument): CustomerRecordDto {
  return {
    id: document._id.toHexString(),
    code: document.code ?? null,
    name: document.name,
    taxCode: document.taxCode ?? null,
    country: document.country ?? null,
    email: document.email ?? null,
    phone: document.phone ?? null,
    address: document.address ?? null,
    defaultCurrency: document.defaultCurrency ?? null,
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

export class MongoCustomerStore implements CustomerStore {
  async insert(
    record: CustomerWriteFields & { createdBy: string },
  ): Promise<CustomerRecordDto> {
    await connectToDatabase();

    const actorId = new Types.ObjectId(record.createdBy);
    try {
      const document = await getCustomerModel().create({
        code: record.code,
        name: record.name,
        taxCode: record.taxCode,
        country: record.country,
        email: record.email,
        phone: record.phone,
        address: record.address,
        defaultCurrency: record.defaultCurrency,
        notes: record.notes,
        status: "active",
        createdBy: actorId,
        updatedBy: actorId,
      });
      return toDto(document.toObject() as CustomerDocument);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new CustomerCommandError(
          "DUPLICATE_CODE",
          "A customer with this code already exists.",
        );
      }
      throw error;
    }
  }

  async findById(customerId: string): Promise<CustomerRecordDto | null> {
    if (!Types.ObjectId.isValid(customerId)) return null;
    await connectToDatabase();

    const document = await getCustomerModel()
      .findById(customerId)
      .lean<CustomerDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async findByIds(
    customerIds: readonly string[],
  ): Promise<ReadonlyMap<string, CustomerRecordDto>> {
    const validIds = customerIds.filter(Types.ObjectId.isValid);
    if (validIds.length === 0) return new Map();
    await connectToDatabase();

    const documents = await getCustomerModel()
      .find({ _id: { $in: validIds.map((id) => new Types.ObjectId(id)) } })
      .lean<CustomerDocument[]>()
      .exec();
    return new Map(
      documents.map((document) => {
        const dto = toDto(document);
        return [dto.id, dto];
      }),
    );
  }

  async list(filter: CustomerListFilter): Promise<CustomerRecordDto[]> {
    await connectToDatabase();

    const documents = await getCustomerModel()
      .find(filter.status ? { status: filter.status } : {})
      .sort({ name: 1 })
      .limit(1_000)
      .lean<CustomerDocument[]>()
      .exec();
    return documents.map(toDto);
  }

  async update(input: {
    customerId: string;
    expectedRevision: number;
    fields: CustomerWriteFields;
    updatedBy: string;
  }): Promise<CustomerRecordDto | null> {
    await connectToDatabase();

    try {
      const document = await getCustomerModel()
        .findOneAndUpdate(
          {
            _id: new Types.ObjectId(input.customerId),
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
        .lean<CustomerDocument>()
        .exec();
      return document ? toDto(document) : null;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new CustomerCommandError(
          "DUPLICATE_CODE",
          "A customer with this code already exists.",
        );
      }
      throw error;
    }
  }

  async setStatus(input: {
    customerId: string;
    expectedRevision: number;
    status: CustomerStatus;
    updatedBy: string;
  }): Promise<CustomerRecordDto | null> {
    await connectToDatabase();

    const document = await getCustomerModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.customerId),
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
      .lean<CustomerDocument>()
      .exec();
    return document ? toDto(document) : null;
  }
}

export const mongoCustomerStore = new MongoCustomerStore();
