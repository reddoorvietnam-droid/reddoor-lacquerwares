import { z } from "zod";

import type { AuditRepository } from "@/domains/audit/contracts";
import type { AccessContext } from "@/lib/auth/authorization";
import type { Locale } from "@/lib/i18n/config";

/**
 * Retail shop: standalone items sold from stock at a public retail price,
 * and the guest orders visitors place against them.
 *
 * Deliberately simpler than the catalogue: no versions, no review round, no
 * link to a catalogue product. The retail price is public data — it is not
 * the internal selling price that RBAC rule 1 protects — so it lives here and
 * never touches `products.readSellingPrice`.
 */

export const shopItemStatuses = ["draft", "live", "hidden"] as const;
export type ShopItemStatus = (typeof shopItemStatuses)[number];

export const shopOrderStatuses = [
  "new",
  "confirmed",
  "completed",
  "cancelled",
] as const;
export type ShopOrderStatus = (typeof shopOrderStatuses)[number];

/** Vietnamese pages sell in VND; every other locale sells in USD. */
export const shopCurrencies = ["VND", "USD"] as const;
export type ShopCurrency = (typeof shopCurrencies)[number];

export function shopCurrencyForLocale(locale: Locale): ShopCurrency {
  return locale === "vi" ? "VND" : "USD";
}

/** Shop copy is written in Vietnamese and English only. */
export const shopTextLocales = ["vi", "en"] as const;
export type ShopTextLocale = (typeof shopTextLocales)[number];

export function shopTextLocaleFor(locale: Locale): ShopTextLocale {
  return locale === "vi" ? "vi" : "en";
}

export type ShopItemText = {
  name: string;
  summary: string;
  /** Plain text; blank lines separate paragraphs. */
  description: string;
};

export type ShopItemImage = {
  publicId: string;
  assetVersion: number;
  width: number;
  height: number;
  bytes: number;
  alt: string | null;
};

export type ShopItemDto = {
  id: string;
  slug: string;
  status: ShopItemStatus;
  text: Record<ShopTextLocale, ShopItemText>;
  /** Decimal strings already rounded to the currency scale. */
  priceVnd: string;
  priceUsd: string;
  stockQuantity: number;
  /** Reserved for the category filter that comes later; empty until then. */
  categoryKey: string;
  images: readonly ShopItemImage[];
  sortOrder: number;
  publishedAt: Date | null;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

export type ShopOrderCustomer = {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  note: string | null;
};

export type ShopOrderMoney = {
  amount: string;
  currency: ShopCurrency;
};

export type ShopOrderHistoryEntry = {
  from: ShopOrderStatus | null;
  to: ShopOrderStatus;
  byUserId: string | null;
  reason: string | null;
  at: Date;
};

export type ShopOrderNotificationState = {
  adminSentAt: Date | null;
  customerSentAt: Date | null;
  lastError: string | null;
};

export type ShopOrderDto = {
  id: string;
  orderCode: string;
  itemId: string;
  /** Snapshot of the item as the visitor saw it; the item may change later. */
  itemSlug: string;
  itemName: string;
  quantity: number;
  unitPrice: ShopOrderMoney;
  total: ShopOrderMoney;
  customer: ShopOrderCustomer;
  locale: Locale;
  status: ShopOrderStatus;
  /** True while confirmed stock is held against this order. */
  stockDeducted: boolean;
  history: readonly ShopOrderHistoryEntry[];
  notifications: ShopOrderNotificationState;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

/* ------------------------------------------------------------------ */
/* Input schemas                                                       */
/* ------------------------------------------------------------------ */

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/);

const vndPattern = /^(?:0|[1-9]\d*)$/;
const usdPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

const shopItemTextSchema = z.object({
  name: z.string().trim().max(200),
  summary: z.string().trim().max(500),
  description: z.string().max(20_000),
});

export const shopItemWriteSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  text: z.object({
    vi: shopItemTextSchema.extend({ name: z.string().trim().min(1).max(200) }),
    en: shopItemTextSchema,
  }),
  priceVnd: z.string().trim().regex(vndPattern),
  priceUsd: z.string().trim().regex(usdPattern),
  stockQuantity: z.number().int().min(0).max(1_000_000),
  categoryKey: z.string().trim().max(80).default(""),
  sortOrder: z.number().int().min(-10_000).max(10_000).default(0),
});
export type ShopItemWriteInput = z.infer<typeof shopItemWriteSchema>;

export const shopItemImagesSchema = z
  .array(
    z.object({
      publicId: z.string().min(1).max(500),
      assetVersion: z.number().int().min(1),
      width: z.number().int().min(1),
      height: z.number().int().min(1),
      bytes: z.number().int().min(1),
      alt: z.string().trim().max(300).nullable().default(null),
    }),
  )
  .max(24);
export type ShopItemImagesInput = z.infer<typeof shopItemImagesSchema>;

export const shopOrderCustomerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .min(6)
    .max(30)
    .regex(/^[+\d][\d\s().-]{5,29}$/),
  email: z.email().max(200),
  address: z.string().trim().min(5).max(500),
  note: z.string().trim().max(2_000).optional(),
});

export const placeShopOrderSchema = z.object({
  itemId: objectIdSchema,
  quantity: z.number().int().min(1).max(999),
  locale: z.string().min(2).max(10),
  customer: shopOrderCustomerSchema,
});
export type PlaceShopOrderInput = z.infer<typeof placeShopOrderSchema>;

/* ------------------------------------------------------------------ */
/* Stores                                                              */
/* ------------------------------------------------------------------ */

export type ShopItemListFilter = {
  status?: ShopItemStatus;
};

export interface ShopItemStore {
  list(filter: ShopItemListFilter): Promise<ShopItemDto[]>;
  findById(itemId: string): Promise<ShopItemDto | null>;
  insert(input: {
    data: ShopItemWriteInput;
    actorId: string;
    occurredAt: Date;
  }): Promise<ShopItemDto>;
  /** Conditional on the revision; null means the record moved on. */
  update(input: {
    itemId: string;
    expectedRevision: number;
    data: ShopItemWriteInput;
    actorId: string;
    occurredAt: Date;
  }): Promise<ShopItemDto | null>;
  setStatus(input: {
    itemId: string;
    status: ShopItemStatus;
    actorId: string;
    occurredAt: Date;
  }): Promise<ShopItemDto | null>;
  setImages(input: {
    itemId: string;
    images: ShopItemImagesInput;
    actorId: string;
    occurredAt: Date;
  }): Promise<ShopItemDto | null>;
  softDelete(input: {
    itemId: string;
    actorId: string;
    occurredAt: Date;
  }): Promise<boolean>;
  /**
   * Atomically moves stock by `delta` (negative to deduct). Returns null when
   * the item is missing or a deduction would take stock below zero.
   */
  adjustStock(input: {
    itemId: string;
    delta: number;
    actorId: string | null;
    occurredAt: Date;
  }): Promise<ShopItemDto | null>;
}

export type ShopOrderListFilter = {
  status?: ShopOrderStatus;
};

export type NewShopOrderRecord = Omit<
  ShopOrderDto,
  "id" | "createdAt" | "updatedAt" | "revision"
>;

export interface ShopOrderStore {
  list(filter: ShopOrderListFilter): Promise<ShopOrderDto[]>;
  findById(orderId: string): Promise<ShopOrderDto | null>;
  insert(record: NewShopOrderRecord): Promise<ShopOrderDto>;
  /** Conditional on the revision; null means the record moved on. */
  applyTransition(input: {
    orderId: string;
    expectedRevision: number;
    to: ShopOrderStatus;
    stockDeducted: boolean;
    historyEntry: ShopOrderHistoryEntry;
    updatedBy: string;
  }): Promise<ShopOrderDto | null>;
  recordNotification(input: {
    orderId: string;
    notifications: ShopOrderNotificationState;
  }): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export const shopErrorCodes = [
  "NOT_FOUND",
  "SLUG_UNAVAILABLE",
  "DUPLICATE_ORDER_CODE",
  "REVISION_CONFLICT",
  "STATUS_MISMATCH",
  "ITEM_NOT_LIVE",
  "SOLD_OUT",
  "INSUFFICIENT_STOCK",
  "EMPTY_CONTENT",
  "INVALID_INPUT",
  "PERSISTENCE_FAILURE",
] as const;
export type ShopErrorCode = (typeof shopErrorCodes)[number];

export class ShopError extends Error {
  readonly code: ShopErrorCode;

  constructor(code: ShopErrorCode, message: string) {
    super(message);
    this.name = "ShopError";
    this.code = code;
  }
}

export type ShopPostCommitEvent =
  | { kind: "itemChanged"; itemId: string; slug: string }
  | { kind: "orderPlaced"; orderId: string; itemId: string }
  | { kind: "orderTransitioned"; orderId: string; itemId: string };

export type ShopServiceDependencies = {
  itemStore: ShopItemStore;
  orderStore: ShopOrderStore;
  auditRepository: AuditRepository;
  now?: () => Date;
  /** Runs after a successful write so the public pages can revalidate. */
  postCommit?: (event: ShopPostCommitEvent) => void | Promise<void>;
};

export type { AccessContext };

/** Order codes: SH-YYYYMMDD-XXXX, readable on the phone with a customer. */
export function generateShopOrderCode(now: Date, random = Math.random): string {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let index = 0; index < 4; index += 1) {
    suffix += alphabet[Math.floor(random() * alphabet.length)];
  }
  return `SH-${date}-${suffix}`;
}
