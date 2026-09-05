import "server-only";

import { Types } from "mongoose";

import type { FxRateRecordDto, FxRateStore } from "@/domains/finance/contracts";
import { getFxRateModel } from "@/domains/finance/persistence/models";
import { connectToDatabase } from "@/lib/db/mongoose";

type FxRateDocument = {
  _id: Types.ObjectId;
  date: Date;
  from: "USD";
  to: "VND";
  rate: string;
  source?: string | null;
  updatedBy: Types.ObjectId;
  updatedAt: Date;
};

function toDto(document: FxRateDocument): FxRateRecordDto {
  return {
    id: document._id.toHexString(),
    date: document.date,
    from: "USD",
    to: "VND",
    rate: document.rate,
    source: document.source ?? null,
    updatedBy: document.updatedBy.toHexString(),
    updatedAt: document.updatedAt,
  };
}

export class MongoFxRateStore implements FxRateStore {
  async upsert(input: {
    date: Date;
    rate: string;
    source: string | null;
    actorId: string;
  }): Promise<FxRateRecordDto> {
    await connectToDatabase();

    const document = await getFxRateModel()
      .findOneAndUpdate(
        { from: "USD", to: "VND", date: input.date },
        {
          $set: {
            rate: input.rate,
            source: input.source,
            updatedBy: new Types.ObjectId(input.actorId),
          },
          $setOnInsert: { from: "USD", to: "VND", date: input.date },
        },
        { new: true, upsert: true, runValidators: true },
      )
      .lean<FxRateDocument>()
      .exec();
    if (!document) {
      throw new Error("The exchange rate could not be stored.");
    }
    return toDto(document);
  }

  async findLatestOnOrBefore(date: Date): Promise<FxRateRecordDto | null> {
    await connectToDatabase();

    const document = await getFxRateModel()
      .findOne({ from: "USD", to: "VND", date: { $lte: date } })
      .sort({ date: -1 })
      .lean<FxRateDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async list(limit: number): Promise<FxRateRecordDto[]> {
    await connectToDatabase();

    const documents = await getFxRateModel()
      .find({ from: "USD", to: "VND" })
      .sort({ date: -1 })
      .limit(limit)
      .lean<FxRateDocument[]>()
      .exec();
    return documents.map(toDto);
  }
}

export const mongoFxRateStore = new MongoFxRateStore();
