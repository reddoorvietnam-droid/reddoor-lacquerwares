import "server-only";

import { Types } from "mongoose";

import {
  ShopError,
  type NewShopOrderRecord,
  type ShopCurrency,
  type ShopItemDto,
  type ShopItemImagesInput,
  type ShopItemListFilter,
  type ShopItemStatus,
  type ShopItemStore,
  type ShopItemWriteInput,
  type ShopOrderDto,
  type ShopOrderHistoryEntry,
  type ShopOrderListFilter,
  type ShopOrderNotificationState,
  type ShopOrderStatus,
  type ShopOrderStore,
} from "@/domains/shop/contracts";
import { getShopItemModel, getShopOrderModel } from "@/domains/shop/models";
import { connectToDatabase } from "@/lib/db/mongoose";
import type { Locale } from "@/lib/i18n/config";

type ShopItemDocument = {
  _id: Types.ObjectId;
  slug: string;
  status: ShopItemStatus;
  text: {
    vi: { name?: string; summary?: string; description?: string };
    en: { name?: string; summary?: string; description?: string };
  };
  priceVnd: Types.Decimal128;
  priceUsd: Types.Decimal128;
  stockQuantity: number;
  categoryKey?: string;
  images: {
    publicId: string;
    assetVersion: number;
    width: number;
    height: number;
    bytes: number;
    alt?: string;
  }[];
  sortOrder: number;
  publishedAt?: Date;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

type ShopOrderDocument = {
  _id: Types.ObjectId;
  orderCode: string;
  itemId: Types.ObjectId;
  itemSlug: string;
  itemName: string;
  quantity: number;
  unitPrice: { amount: Types.Decimal128; currency: ShopCurrency };
  total: { amount: Types.Decimal128; currency: ShopCurrency };
  customer: {
    fullName: string;
    phone: string;
    email: string;
    address: string;
    note?: string;
  };
  locale: Locale;
  status: ShopOrderStatus;
  stockDeducted: boolean;
  history: {
    from?: ShopOrderStatus;
    to: ShopOrderStatus;
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

function text(value: {
  name?: string;
  summary?: string;
  description?: string;
}) {
  return {
    name: value.name ?? "",
    summary: value.summary ?? "",
    description: value.description ?? "",
  };
}

function itemToDto(document: ShopItemDocument): ShopItemDto {
  return {
    id: document._id.toHexString(),
    slug: document.slug,
    status: document.status,
    text: { vi: text(document.text.vi), en: text(document.text.en) },
    priceVnd: document.priceVnd.toString(),
    priceUsd: document.priceUsd.toString(),
    stockQuantity: document.stockQuantity,
    categoryKey: document.categoryKey ?? "",
    images: document.images.map((image) => ({
      publicId: image.publicId,
      assetVersion: image.assetVersion,
      width: image.width,
      height: image.height,
      bytes: image.bytes,
      alt: image.alt ?? null,
    })),
    sortOrder: document.sortOrder,
    publishedAt: document.publishedAt ?? null,
    createdBy: document.createdBy.toHexString(),
    updatedBy: document.updatedBy.toHexString(),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    revision: document.revision,
  };
}

function orderToDto(document: ShopOrderDocument): ShopOrderDto {
  return {
    id: document._id.toHexString(),
    orderCode: document.orderCode,
    itemId: document.itemId.toHexString(),
    itemSlug: document.itemSlug,
    itemName: document.itemName,
    quantity: document.quantity,
    unitPrice: {
      amount: document.unitPrice.amount.toString(),
      currency: document.unitPrice.currency,
    },
    total: {
      amount: document.total.amount.toString(),
      currency: document.total.currency,
    },
    customer: {
      fullName: document.customer.fullName,
      phone: document.customer.phone,
      email: document.customer.email,
      address: document.customer.address,
      note: document.customer.note ?? null,
    },
    locale: document.locale,
    status: document.status,
    stockDeducted: document.stockDeducted,
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

function itemFields(data: ShopItemWriteInput) {
  return {
    slug: data.slug,
    text: {
      vi: {
        name: data.text.vi.name,
        summary: data.text.vi.summary,
        description: data.text.vi.description,
      },
      en: {
        name: data.text.en.name,
        summary: data.text.en.summary,
        description: data.text.en.description,
      },
    },
    priceVnd: Types.Decimal128.fromString(data.priceVnd),
    priceUsd: Types.Decimal128.fromString(data.priceUsd),
    stockQuantity: data.stockQuantity,
    categoryKey: data.categoryKey,
    sortOrder: data.sortOrder,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

function historyDocument(entry: ShopOrderHistoryEntry) {
  return {
    ...(entry.from ? { from: entry.from } : {}),
    to: entry.to,
    ...(entry.byUserId ? { byUserId: new Types.ObjectId(entry.byUserId) } : {}),
    ...(entry.reason ? { reason: entry.reason } : {}),
    at: entry.at,
  };
}

const notDeleted = { deletedAt: { $exists: false } };

export class MongoShopItemStore implements ShopItemStore {
  async list(filter: ShopItemListFilter): Promise<ShopItemDto[]> {
    await connectToDatabase();
    const documents = await getShopItemModel()
      .find({
        ...notDeleted,
        ...(filter.status ? { status: filter.status } : {}),
      })
      .sort({ sortOrder: 1, updatedAt: -1 })
      .limit(500)
      .lean<ShopItemDocument[]>()
      .exec();
    return documents.map(itemToDto);
  }

  async findById(itemId: string): Promise<ShopItemDto | null> {
    if (!Types.ObjectId.isValid(itemId)) return null;
    await connectToDatabase();
    const document = await getShopItemModel()
      .findOne({ _id: new Types.ObjectId(itemId), ...notDeleted })
      .lean<ShopItemDocument>()
      .exec();
    return document ? itemToDto(document) : null;
  }

  async insert(input: {
    data: ShopItemWriteInput;
    actorId: string;
    occurredAt: Date;
  }): Promise<ShopItemDto> {
    await connectToDatabase();
    const actorId = new Types.ObjectId(input.actorId);
    try {
      const document = await getShopItemModel().create({
        ...itemFields(input.data),
        status: "draft",
        images: [],
        createdBy: actorId,
        updatedBy: actorId,
      });
      return itemToDto(document.toObject() as unknown as ShopItemDocument);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ShopError("SLUG_UNAVAILABLE", "That slug is already in use.");
      }
      throw error;
    }
  }

  async update(input: {
    itemId: string;
    expectedRevision: number;
    data: ShopItemWriteInput;
    actorId: string;
    occurredAt: Date;
  }): Promise<ShopItemDto | null> {
    await connectToDatabase();
    try {
      const document = await getShopItemModel()
        .findOneAndUpdate(
          {
            _id: new Types.ObjectId(input.itemId),
            revision: input.expectedRevision,
            ...notDeleted,
          },
          {
            $set: {
              ...itemFields(input.data),
              updatedBy: new Types.ObjectId(input.actorId),
            },
            $inc: { revision: 1 },
          },
          { new: true, runValidators: true },
        )
        .lean<ShopItemDocument>()
        .exec();
      return document ? itemToDto(document) : null;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ShopError("SLUG_UNAVAILABLE", "That slug is already in use.");
      }
      throw error;
    }
  }

  async setStatus(input: {
    itemId: string;
    status: ShopItemStatus;
    actorId: string;
    occurredAt: Date;
  }): Promise<ShopItemDto | null> {
    await connectToDatabase();
    const document = await getShopItemModel()
      .findOneAndUpdate(
        { _id: new Types.ObjectId(input.itemId), ...notDeleted },
        {
          $set: {
            status: input.status,
            updatedBy: new Types.ObjectId(input.actorId),
            ...(input.status === "live"
              ? { publishedAt: input.occurredAt }
              : {}),
          },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean<ShopItemDocument>()
      .exec();
    return document ? itemToDto(document) : null;
  }

  async setImages(input: {
    itemId: string;
    images: ShopItemImagesInput;
    actorId: string;
    occurredAt: Date;
  }): Promise<ShopItemDto | null> {
    await connectToDatabase();
    const document = await getShopItemModel()
      .findOneAndUpdate(
        { _id: new Types.ObjectId(input.itemId), ...notDeleted },
        {
          $set: {
            images: input.images.map((image) => ({
              publicId: image.publicId,
              assetVersion: image.assetVersion,
              width: image.width,
              height: image.height,
              bytes: image.bytes,
              ...(image.alt ? { alt: image.alt } : {}),
            })),
            updatedBy: new Types.ObjectId(input.actorId),
          },
          $inc: { revision: 1 },
        },
        { new: true, runValidators: true },
      )
      .lean<ShopItemDocument>()
      .exec();
    return document ? itemToDto(document) : null;
  }

  async softDelete(input: {
    itemId: string;
    actorId: string;
    occurredAt: Date;
  }): Promise<boolean> {
    await connectToDatabase();
    const result = await getShopItemModel()
      .updateOne(
        { _id: new Types.ObjectId(input.itemId), ...notDeleted },
        {
          $set: {
            deletedAt: input.occurredAt,
            status: "hidden",
            updatedBy: new Types.ObjectId(input.actorId),
          },
          $inc: { revision: 1 },
        },
      )
      .exec();
    return result.modifiedCount === 1;
  }

  async adjustStock(input: {
    itemId: string;
    delta: number;
    actorId: string | null;
    occurredAt: Date;
  }): Promise<ShopItemDto | null> {
    await connectToDatabase();
    // The floor check lives in the filter, so two confirmations racing for
    // the last units cannot both succeed.
    const document = await getShopItemModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.itemId),
          ...notDeleted,
          ...(input.delta < 0 ? { stockQuantity: { $gte: -input.delta } } : {}),
        },
        {
          $inc: { stockQuantity: input.delta, revision: 1 },
          ...(input.actorId
            ? { $set: { updatedBy: new Types.ObjectId(input.actorId) } }
            : {}),
        },
        { new: true },
      )
      .lean<ShopItemDocument>()
      .exec();
    return document ? itemToDto(document) : null;
  }
}

export class MongoShopOrderStore implements ShopOrderStore {
  async list(filter: ShopOrderListFilter): Promise<ShopOrderDto[]> {
    await connectToDatabase();
    const documents = await getShopOrderModel()
      .find(filter.status ? { status: filter.status } : {})
      .sort({ createdAt: -1 })
      .limit(500)
      .lean<ShopOrderDocument[]>()
      .exec();
    return documents.map(orderToDto);
  }

  async findById(orderId: string): Promise<ShopOrderDto | null> {
    if (!Types.ObjectId.isValid(orderId)) return null;
    await connectToDatabase();
    const document = await getShopOrderModel()
      .findById(orderId)
      .lean<ShopOrderDocument>()
      .exec();
    return document ? orderToDto(document) : null;
  }

  async insert(record: NewShopOrderRecord): Promise<ShopOrderDto> {
    await connectToDatabase();
    try {
      const document = await getShopOrderModel().create({
        orderCode: record.orderCode,
        itemId: new Types.ObjectId(record.itemId),
        itemSlug: record.itemSlug,
        itemName: record.itemName,
        quantity: record.quantity,
        unitPrice: {
          amount: Types.Decimal128.fromString(record.unitPrice.amount),
          currency: record.unitPrice.currency,
        },
        total: {
          amount: Types.Decimal128.fromString(record.total.amount),
          currency: record.total.currency,
        },
        customer: {
          fullName: record.customer.fullName,
          phone: record.customer.phone,
          email: record.customer.email,
          address: record.customer.address,
          ...(record.customer.note ? { note: record.customer.note } : {}),
        },
        locale: record.locale,
        status: record.status,
        stockDeducted: record.stockDeducted,
        history: record.history.map(historyDocument),
        notifications: {},
      });
      return orderToDto(document.toObject() as unknown as ShopOrderDocument);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ShopError(
          "DUPLICATE_ORDER_CODE",
          "An order with this code already exists.",
        );
      }
      throw error;
    }
  }

  async applyTransition(input: {
    orderId: string;
    expectedRevision: number;
    to: ShopOrderStatus;
    stockDeducted: boolean;
    historyEntry: ShopOrderHistoryEntry;
    updatedBy: string;
  }): Promise<ShopOrderDto | null> {
    await connectToDatabase();
    const document = await getShopOrderModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.orderId),
          revision: input.expectedRevision,
        },
        {
          $set: {
            status: input.to,
            stockDeducted: input.stockDeducted,
            updatedBy: new Types.ObjectId(input.updatedBy),
          },
          $push: { history: historyDocument(input.historyEntry) },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean<ShopOrderDocument>()
      .exec();
    return document ? orderToDto(document) : null;
  }

  async recordNotification(input: {
    orderId: string;
    notifications: ShopOrderNotificationState;
  }): Promise<void> {
    await connectToDatabase();
    await getShopOrderModel()
      .updateOne(
        { _id: new Types.ObjectId(input.orderId) },
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
