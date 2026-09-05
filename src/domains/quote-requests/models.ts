import "server-only";

import { type InferSchemaType, Schema } from "mongoose";

import {
  quoteRequestDeliveryTerms,
  quoteRequestStatuses,
  quoteRequestTypes,
} from "@/domains/quote-requests/contracts";
import {
  getOrCreateModel,
  nestedSchemaOptions,
  rootSchemaOptions,
} from "@/lib/content/mongoose";
import { locales } from "@/lib/i18n/config";

const contactSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    company: { type: String, trim: true, maxlength: 200 },
    email: { type: String, required: true, trim: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 30 },
    country: { type: String, required: true, trim: true, maxlength: 120 },
  },
  nestedSchemaOptions,
);

const itemSchema = new Schema(
  {
    // Catalogue ids are stored as plain strings: the demo catalogue uses
    // slugs where MongoDB uses ObjectIds, and the request is only a snapshot.
    productId: { type: String, trim: true, maxlength: 120 },
    productName: { type: String, required: true, trim: true, maxlength: 200 },
    quantity: { type: Number, min: 1 },
  },
  nestedSchemaOptions,
);

const detailsSchema = new Schema(
  {
    requestType: { type: String, required: true, enum: quoteRequestTypes },
    items: { type: [itemSchema], required: true, default: [] },
    estimatedQuantity: { type: Number, min: 1 },
    budget: { type: String, trim: true, maxlength: 120 },
    deadline: { type: String, trim: true, maxlength: 10 },
    deliveryTerms: { type: String, enum: quoteRequestDeliveryTerms },
    destination: { type: String, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 5_000 },
  },
  nestedSchemaOptions,
);

const historySchema = new Schema(
  {
    from: { type: String, enum: quoteRequestStatuses },
    to: { type: String, required: true, enum: quoteRequestStatuses },
    byUserId: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String, trim: true, maxlength: 1_000 },
    at: { type: Date, required: true },
  },
  nestedSchemaOptions,
);

const notificationSchema = new Schema(
  {
    adminSentAt: { type: Date },
    customerSentAt: { type: Date },
    lastError: { type: String, trim: true, maxlength: 1_000 },
  },
  nestedSchemaOptions,
);

export const quoteRequestSchema = new Schema(
  {
    requestCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },
    contact: { type: contactSchema, required: true },
    details: { type: detailsSchema, required: true },
    locale: { type: String, required: true, enum: locales },
    status: { type: String, required: true, enum: quoteRequestStatuses },
    history: { type: [historySchema], required: true, default: [] },
    notifications: {
      type: notificationSchema,
      required: true,
      default: () => ({}),
    },
    // Visitors have no account; staff transitions record who moved it.
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  rootSchemaOptions,
);

quoteRequestSchema.index(
  { requestCode: 1 },
  { unique: true, name: "quote_request_code_unique" },
);
quoteRequestSchema.index(
  { status: 1, createdAt: -1 },
  { name: "quote_request_status_created" },
);

export type QuoteRequestRecord = InferSchemaType<typeof quoteRequestSchema>;

export const getQuoteRequestModel = () =>
  getOrCreateModel<QuoteRequestRecord>("QuoteRequest", quoteRequestSchema);
