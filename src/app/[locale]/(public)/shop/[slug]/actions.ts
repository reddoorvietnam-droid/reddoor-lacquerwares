"use server";

import { headers } from "next/headers";
import { z } from "zod";

import type { ShopOrderSubmitResult } from "@/components/public/pages/shop-order-form";
import { ShopError } from "@/domains/shop/contracts";
import { notifyShopOrderPlaced } from "@/domains/shop/notifications";
import { shopOrderStore, shopService } from "@/domains/shop/runtime";
import { consumeRateLimit } from "@/lib/utils/rate-limit";

/**
 * Guest order placement. No session: the honeypot and the per-address rate
 * limit stand in for authentication, the service enforces stock and status,
 * and the emails go out only after the order is safely stored.
 */

const payloadSchema = z.object({
  itemId: z.string().regex(/^[a-f0-9]{24}$/),
  locale: z.string().min(2).max(10),
  quantity: z.coerce.number().int().min(1).max(999),
  /** Honeypot; humans never fill it. */
  website: z.string().max(200).default(""),
  customer: z.object({
    fullName: z.string().max(200),
    phone: z.string().max(60),
    email: z.string().max(300),
    address: z.string().max(1_000),
    note: z.string().max(3_000).default(""),
  }),
});

const RATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1_000 };

async function clientKey(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "unknown";
  return `shop-order:${ip}`;
}

export async function placeShopOrderAction(
  input: unknown,
): Promise<ShopOrderSubmitResult> {
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return { status: "error", code: "INVALID_INPUT" };

  // A filled honeypot is a bot. Answer as if it worked so it moves on.
  if (parsed.data.website.trim().length > 0) {
    return { status: "success", orderCode: "SH-00000000-XXXX" };
  }

  const limit = consumeRateLimit(await clientKey(), RATE_LIMIT);
  if (!limit.allowed) return { status: "error", code: "RATE_LIMITED" };

  try {
    const order = await shopService.placeOrder({
      itemId: parsed.data.itemId,
      locale: parsed.data.locale,
      quantity: parsed.data.quantity,
      customer: {
        fullName: parsed.data.customer.fullName,
        phone: parsed.data.customer.phone,
        email: parsed.data.customer.email,
        address: parsed.data.customer.address,
        ...(parsed.data.customer.note.trim()
          ? { note: parsed.data.customer.note }
          : {}),
      },
    });

    // Best effort, after the commit: a mail failure is recorded on the
    // order for staff to see, never surfaced to the visitor as a failure.
    await notifyShopOrderPlaced(order, shopOrderStore);

    return { status: "success", orderCode: order.orderCode };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "error", code: "INVALID_INPUT" };
    }
    if (error instanceof ShopError) {
      return { status: "error", code: error.code };
    }
    console.error("[shop] order placement failed", error);
    return { status: "error", code: "UNAVAILABLE" };
  }
}
