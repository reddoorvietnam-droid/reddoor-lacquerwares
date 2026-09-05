"use server";

import { headers } from "next/headers";
import { z } from "zod";

import type { QuoteRequestSubmitResult } from "@/components/public/pages/quote-request-form";
import { QuoteRequestError } from "@/domains/quote-requests/contracts";
import { notifyQuoteRequestSubmitted } from "@/domains/quote-requests/notifications";
import {
  quoteRequestService,
  quoteRequestStore,
} from "@/domains/quote-requests/runtime";
import { consumeRateLimit } from "@/lib/utils/rate-limit";

/**
 * Quote request submission. No session: the honeypot and the per-address
 * rate limit stand in for authentication, the service validates the
 * business shape, and the emails go out only after the request is stored.
 */

const optional = (max: number) => z.string().max(max).default("");

const payloadSchema = z.object({
  locale: z.string().min(2).max(10),
  /** Honeypot; humans never fill it. */
  website: z.string().max(200).default(""),
  contact: z.object({
    fullName: z.string().max(300),
    company: optional(300),
    email: z.string().max(300),
    phone: optional(60),
    country: z.string().max(300),
  }),
  details: z.object({
    requestType: z.string().max(40),
    items: z
      .array(
        z.object({
          productId: z.string().max(200).nullable(),
          productName: z.string().max(300),
          quantity: z.number().int().nullable(),
        }),
      )
      .max(50)
      .default([]),
    estimatedQuantity: z.number().int().nullable().default(null),
    budget: optional(300),
    deadline: optional(20),
    deliveryTerms: optional(20),
    destination: optional(300),
    message: z.string().max(10_000),
  }),
});

const RATE_LIMIT = { limit: 4, windowMs: 10 * 60 * 1_000 };

async function clientKey(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "unknown";
  return `quote-request:${ip}`;
}

const blankToNull = (value: string) => (value.trim() ? value.trim() : null);

export async function submitQuoteRequestAction(
  input: unknown,
): Promise<QuoteRequestSubmitResult> {
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return { status: "error", code: "INVALID_INPUT" };

  // A filled honeypot is a bot. Answer as if it worked so it moves on.
  if (parsed.data.website.trim().length > 0) {
    return { status: "success", requestCode: "RQ-00000000-XXXX" };
  }

  const limit = consumeRateLimit(await clientKey(), RATE_LIMIT);
  if (!limit.allowed) return { status: "error", code: "RATE_LIMITED" };

  const { contact, details } = parsed.data;
  try {
    const request = await quoteRequestService.submit({
      locale: parsed.data.locale,
      contact: {
        fullName: contact.fullName,
        company: blankToNull(contact.company),
        email: contact.email,
        phone: blankToNull(contact.phone),
        country: contact.country,
      },
      details: {
        requestType: details.requestType,
        items: details.items,
        estimatedQuantity: details.estimatedQuantity,
        budget: blankToNull(details.budget),
        deadline: blankToNull(details.deadline),
        deliveryTerms: blankToNull(details.deliveryTerms),
        destination: blankToNull(details.destination),
        message: details.message,
      },
    });

    // Best effort, after the commit: a mail failure is recorded on the
    // request for staff to see, never surfaced to the visitor as a failure.
    await notifyQuoteRequestSubmitted(request, quoteRequestStore);

    return { status: "success", requestCode: request.requestCode };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "error", code: "INVALID_INPUT" };
    }
    if (error instanceof QuoteRequestError) {
      return { status: "error", code: error.code };
    }
    console.error("[quote-requests] submission failed", error);
    return { status: "error", code: "UNAVAILABLE" };
  }
}
