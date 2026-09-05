"use server";

import { z } from "zod";

import {
  objectIdSchema,
  ShopError,
  shopItemImagesSchema,
  shopItemStatuses,
  shopItemWriteSchema,
  shopOrderStatuses,
} from "@/domains/shop/contracts";
import { shopService } from "@/domains/shop/runtime";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";

/**
 * Server actions behind the shop manager and the shop order desk. Every
 * action re-authorizes on the server; the service enforces the business
 * rules and the store the concurrency check.
 */

export type ShopActionState = {
  status: "idle" | "success" | "error";
  message: string;
  itemId?: string;
};

function failure(error: unknown): ShopActionState {
  if (error instanceof ContentAccessDeniedError) {
    return { status: "error", message: "FORBIDDEN" };
  }
  if (error instanceof ShopError) {
    return { status: "error", message: error.code };
  }
  if (error instanceof z.ZodError) {
    return { status: "error", message: "INVALID_INPUT" };
  }
  console.error("[shop] action failed", error);
  return { status: "error", message: "UNAVAILABLE" };
}

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

const saveItemPayloadSchema = z.object({
  itemId: objectIdSchema.nullish(),
  expectedRevision: z.number().int().min(0).nullish(),
  data: shopItemWriteSchema,
});

export async function saveShopItemAction(
  input: unknown,
): Promise<ShopActionState> {
  try {
    const parsed = saveItemPayloadSchema.parse(input);
    const context = await requirePermission("shop.manage");

    if (!parsed.itemId) {
      const created = await shopService.createItem(context, parsed.data);
      return { status: "success", message: "SAVED", itemId: created.id };
    }

    if (parsed.expectedRevision === null || parsed.expectedRevision === undefined) {
      return { status: "error", message: "INVALID_INPUT" };
    }
    const updated = await shopService.updateItem(context, {
      itemId: parsed.itemId,
      expectedRevision: parsed.expectedRevision,
      data: parsed.data,
    });
    return { status: "success", message: "SAVED", itemId: updated.id };
  } catch (error) {
    return failure(error);
  }
}

const statusPayloadSchema = z.object({
  itemId: objectIdSchema,
  status: z.enum(shopItemStatuses),
});

export async function setShopItemStatusAction(
  input: unknown,
): Promise<ShopActionState> {
  try {
    const parsed = statusPayloadSchema.parse(input);
    const context = await requirePermission(
      parsed.status === "live" ? "shop.publish" : "shop.manage",
    );
    const item = await shopService.setItemStatus(context, parsed);
    return { status: "success", message: item.status.toUpperCase(), itemId: item.id };
  } catch (error) {
    return failure(error);
  }
}

const imagesPayloadSchema = z.object({
  itemId: objectIdSchema,
  images: shopItemImagesSchema,
});

/** Replaces the ordered gallery; the first image is the primary photograph. */
export async function saveShopItemImagesAction(
  input: unknown,
): Promise<ShopActionState> {
  try {
    const parsed = imagesPayloadSchema.parse(input);
    const context = await requirePermission("shop.manage");
    const item = await shopService.setItemImages(context, parsed);
    return { status: "success", message: "SAVED", itemId: item.id };
  } catch (error) {
    return failure(error);
  }
}

const idPayloadSchema = z.object({ itemId: objectIdSchema });

export async function deleteShopItemAction(
  input: unknown,
): Promise<ShopActionState> {
  try {
    const parsed = idPayloadSchema.parse(input);
    const context = await requirePermission("shop.manage");
    await shopService.deleteItem(context, parsed.itemId);
    return { status: "success", message: "DELETED" };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

const transitionPayloadSchema = z.object({
  orderId: objectIdSchema,
  expectedRevision: z.number().int().min(0),
  to: z.enum(shopOrderStatuses),
  reason: z.string().trim().max(1_000).optional(),
});

export async function transitionShopOrderAction(
  input: unknown,
): Promise<ShopActionState> {
  try {
    const parsed = transitionPayloadSchema.parse(input);
    const context = await requirePermission("shopOrders.manage");
    const order = await shopService.transitionOrder(context, {
      orderId: parsed.orderId,
      expectedRevision: parsed.expectedRevision,
      to: parsed.to,
      reason: parsed.reason ?? null,
    });
    return { status: "success", message: order.status.toUpperCase() };
  } catch (error) {
    return failure(error);
  }
}
