import "server-only";

import { Types } from "mongoose";

import {
  QuoteRequestError,
  type NewQuoteRequestRecord,
  type QuoteRequestDeliveryTerm,
  type QuoteRequestDto,
  type QuoteRequestHistoryEntry,
  type QuoteRequestListFilter,
  type QuoteRequestNotificationState,
  type QuoteRequestStatus,
  type QuoteRequestStore,
  type QuoteRequestType,
} from "@/domains/quote-requests/contracts";
import { getQuoteRequestModel } from "@/domains/quote-requests/models";
import { connectToDatabase } from "@/lib/db/mongoose";
import type { Locale } from "@/lib/i18n/config";

type QuoteRequestDocument = {
  _id: Types.ObjectId;
  requestCode: string;
  contact: {
    fullName: string;
    company?: string;
    email: string;
    phone?: string;
    country: string;
  };
  details: {
    requestType: QuoteRequestType;
    items: { productId?: string; productName: string; quantity?: number }[];
    estimatedQuantity?: number;
    budget?: string;
    deadline?: string;
    deliveryTerms?: QuoteRequestDeliveryTerm;
    destination?: string;
    message: string;
  };
  locale: Locale;
  status: QuoteRequestStatus;
  history: {
    from?: QuoteRequestStatus;
    to: QuoteRequestStatus;
    byUserId?: Types.ObjectId;
    reason?: string;
    at: Date;
  }[];
  notifications?: {
    adminSentAt?: Date;
    customerSentAt?: Date;
    lastError?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

function toDto(document: QuoteRequestDocument): QuoteRequestDto {
  return {
    id: document._id.toHexString(),
    requestCode: document.requestCode,
    contact: {
      fullName: document.contact.fullName,
      company: document.contact.company ?? null,
      email: document.contact.email,
      phone: document.contact.phone ?? null,
      country: document.contact.country,
    },
    details: {
      requestType: document.details.requestType,
      items: document.details.items.map((item) => ({
        productId: item.productId ?? null,
        productName: item.productName,
        quantity: item.quantity ?? null,
      })),
      estimatedQuantity: document.details.estimatedQuantity ?? null,
      budget: document.details.budget ?? null,
      deadline: document.details.deadline ?? null,
      deliveryTerms: document.details.deliveryTerms ?? null,
      destination: document.details.destination ?? null,
      message: document.details.message,
    },
    locale: document.locale,
    status: document.status,
    history: document.history.map((entry) => ({
      from: entry.from ?? null,
      to: entry.to,
      byUserId: entry.byUserId ? entry.byUserId.toHexString() : null,
      reason: entry.reason ?? null,
      at: entry.at,
    })),
    notifications: {
      adminSentAt: document.notifications?.adminSentAt ?? null,
      customerSentAt: document.notifications?.customerSentAt ?? null,
      lastError: document.notifications?.lastError ?? null,
    },
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

function historyDocument(entry: QuoteRequestHistoryEntry) {
  return {
    ...(entry.from ? { from: entry.from } : {}),
    to: entry.to,
    ...(entry.byUserId ? { byUserId: new Types.ObjectId(entry.byUserId) } : {}),
    ...(entry.reason ? { reason: entry.reason } : {}),
    at: entry.at,
  };
}

export class MongoQuoteRequestStore implements QuoteRequestStore {
  async list(filter: QuoteRequestListFilter): Promise<QuoteRequestDto[]> {
    await connectToDatabase();
    const documents = await getQuoteRequestModel()
      .find(filter.status ? { status: filter.status } : {})
      .sort({ createdAt: -1 })
      .limit(500)
      .lean<QuoteRequestDocument[]>()
      .exec();
    return documents.map(toDto);
  }

  async findById(requestId: string): Promise<QuoteRequestDto | null> {
    if (!Types.ObjectId.isValid(requestId)) return null;
    await connectToDatabase();
    const document = await getQuoteRequestModel()
      .findById(requestId)
      .lean<QuoteRequestDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async insert(record: NewQuoteRequestRecord): Promise<QuoteRequestDto> {
    await connectToDatabase();
    try {
      // Optional fields are absent in Mongo rather than stored as null.
      const { contact, details } = record;
      const document = await getQuoteRequestModel().create({
        requestCode: record.requestCode,
        contact: {
          fullName: contact.fullName,
          ...(contact.company ? { company: contact.company } : {}),
          email: contact.email,
          ...(contact.phone ? { phone: contact.phone } : {}),
          country: contact.country,
        },
        details: {
          requestType: details.requestType,
          items: details.items.map((item) => ({
            ...(item.productId ? { productId: item.productId } : {}),
            productName: item.productName,
            ...(item.quantity ? { quantity: item.quantity } : {}),
          })),
          ...(details.estimatedQuantity
            ? { estimatedQuantity: details.estimatedQuantity }
            : {}),
          ...(details.budget ? { budget: details.budget } : {}),
          ...(details.deadline ? { deadline: details.deadline } : {}),
          ...(details.deliveryTerms
            ? { deliveryTerms: details.deliveryTerms }
            : {}),
          ...(details.destination ? { destination: details.destination } : {}),
          message: details.message,
        },
        locale: record.locale,
        status: record.status,
        history: record.history.map(historyDocument),
        notifications: {},
      });
      return toDto(document.toObject() as unknown as QuoteRequestDocument);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new QuoteRequestError(
          "DUPLICATE_REQUEST_CODE",
          "A request with this code already exists.",
        );
      }
      throw error;
    }
  }

  async applyTransition(input: {
    requestId: string;
    expectedRevision: number;
    to: QuoteRequestStatus;
    historyEntry: QuoteRequestHistoryEntry;
    updatedBy: string;
  }): Promise<QuoteRequestDto | null> {
    await connectToDatabase();
    const document = await getQuoteRequestModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.requestId),
          revision: input.expectedRevision,
        },
        {
          $set: {
            status: input.to,
            updatedBy: new Types.ObjectId(input.updatedBy),
          },
          $push: { history: historyDocument(input.historyEntry) },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean<QuoteRequestDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async recordNotification(input: {
    requestId: string;
    notifications: QuoteRequestNotificationState;
  }): Promise<void> {
    await connectToDatabase();
    await getQuoteRequestModel()
      .updateOne(
        { _id: new Types.ObjectId(input.requestId) },
        {
          $set: {
            notifications: {
              ...(input.notifications.adminSentAt
                ? { adminSentAt: input.notifications.adminSentAt }
                : {}),
              ...(input.notifications.customerSentAt
                ? { customerSentAt: input.notifications.customerSentAt }
                : {}),
              ...(input.notifications.lastError
                ? { lastError: input.notifications.lastError }
                : {}),
            },
          },
        },
      )
      .exec();
  }
}
