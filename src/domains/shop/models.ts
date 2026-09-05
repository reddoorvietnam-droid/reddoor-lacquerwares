import "server-only";

import { type InferSchemaType, Schema, Types } from "mongoose";

import {
  shopCurrencies,
  shopItemStatuses,
  shopOrderStatuses,
} from "@/domains/shop/contracts";
import {
  actorFields,
  getOrCreateModel,
  nestedSchemaOptions,
  rootSchemaOptions,
} from "@/lib/content/mongoose";
import { locales } from "@/lib/i18n/config";

const nonNegativeDecimalValidator = {
  validator: (value: Types.Decimal128 | null | undefined) =>
    value === null ||
    value === undefined ||
    /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value.toString()),
  message: "Decimal value must be non-negative",
};

const shopItemTextSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 200, default: "" },
    summary: { type: String, trim: true, maxlength: 500, default: "" },
    description: { type: String, maxlength: 20_000, default: "" },
  },
  nestedSchemaOptions,
);

const shopItemImageSchema = new Schema(
  {
    publicId: { type: String, required: true, trim: true, maxlength: 500 },
    assetVersion: { type: Number, required: true, min: 1 },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    bytes: { type: Number, required: true, min: 1 },
    alt: { type: String, trim: true, maxlength: 300 },
  },
  nestedSchemaOptions,
);

export const shopItemSchema = new Schema(
  {
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    status: { type: String, required: true, enum: shopItemStatuses },
    text: {
      type: new Schema(
        {
          vi: { type: shopItemTextSchema, required: true },
          en: { type: shopItemTextSchema, required: true },
        },
        nestedSchemaOptions,
      ),
      required: true,
    },
    priceVnd: {
      type: Schema.Types.Decimal128,
      required: true,
      validate: nonNegativeDecimalValidator,
    },
    priceUsd: {
      type: Schema.Types.Decimal128,
      required: true,
      validate: nonNegativeDecimalValidator,
    },
    stockQuantity: { type: Number, required: true, min: 0, default: 0 },
    categoryKey: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 80,
      default: "",
    },
    images: { type: [shopItemImageSchema], required: true, default: [] },
    sortOrder: { type: Number, required: true, default: 0 },
    publishedAt: { type: Date },
    deletedAt: { type: Date },
    ...actorFields,
  },
  rootSchemaOptions,
);

// One live slug at a time; a soft-deleted item frees its slug for reuse.
shopItemSchema.index(
  { slug: 1 },
  {
    unique: true,
    name: "shop_item_slug_unique",
    partialFilterExpression: { deletedAt: { $exists: false } },
  },
);
shopItemSchema.index(
  { status: 1, sortOrder: 1, updatedAt: -1 },
  { name: "shop_item_status_order" },
);

const shopOrderMoneySchema = new Schema(
  {
    amount: {
      type: Schema.Types.Decimal128,
      required: true,
      validate: nonNegativeDecimalValidator,
    },
    currency: { type: String, required: true, enum: shopCurrencies },
  },
  nestedSchemaOptions,
);

const shopOrderCustomerSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    email: { type: String, required: true, trim: true, maxlength: 200 },
    address: { type: String, required: true, trim: true, maxlength: 500 },
    note: { type: String, trim: true, maxlength: 2_000 },
  },
  nestedSchemaOptions,
);

const shopOrderHistorySchema = new Schema(
  {
    from: { type: String, enum: shopOrderStatuses },
    to: { type: String, required: true, enum: shopOrderStatuses },
    byUserId: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String, trim: true, maxlength: 1_000 },
    at: { type: Date, required: true },
  },
  nestedSchemaOptions,
);

const shopOrderNotificationSchema = new Schema(
  {
    adminSentAt: { type: Date },
    customerSentAt: { type: Date },
    lastError: { type: String, trim: true, maxlength: 1_000 },
  },
  nestedSchemaOptions,
);

export const shopOrderSchema = new Schema(
  {
    orderCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },
    itemId: { type: Schema.Types.ObjectId, required: true, ref: "ShopItem" },
    itemSlug: { type: String, required: true, trim: true, maxlength: 120 },
    itemName: { type: String, required: true, trim: true, maxlength: 200 },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: shopOrderMoneySchema, required: true },
    total: { type: shopOrderMoneySchema, required: true },
    customer: { type: shopOrderCustomerSchema, required: true },
    locale: { type: String, required: true, enum: locales },
    status: { type: String, required: true, enum: shopOrderStatuses },
    stockDeducted: { type: Boolean, required: true, default: false },
    history: { type: [shopOrderHistorySchema], required: true, default: [] },
    notifications: {
      type: shopOrderNotificationSchema,
      required: true,
      default: () => ({}),
    },
    // Guest orders have no actor; staff transitions record who moved them.
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  rootSchemaOptions,
);

shopOrderSchema.index(
  { orderCode: 1 },
  { unique: true, name: "shop_order_code_unique" },
);
shopOrderSchema.index(
  { status: 1, createdAt: -1 },
  { name: "shop_order_status_created" },
);

export type ShopItemRecord = InferSchemaType<typeof shopItemSchema>;
export type ShopOrderRecord = InferSchemaType<typeof shopOrderSchema>;

export const getShopItemModel = () =>
  getOrCreateModel<ShopItemRecord>("ShopItem", shopItemSchema);

export const getShopOrderModel = () =>
  getOrCreateModel<ShopOrderRecord>("ShopOrder", shopOrderSchema);
