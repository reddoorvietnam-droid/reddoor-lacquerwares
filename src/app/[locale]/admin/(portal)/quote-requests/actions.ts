"use server";

import { z } from "zod";

import {
  objectIdSchema,
  QuoteRequestError,
  quoteRequestStatuses,
} from "@/domains/quote-requests/contracts";
import { quoteRequestService } from "@/domains/quote-requests/runtime";
import { permissionForQuoteRequestTransition } from "@/domains/quote-requests/service";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";

/**
 * Server action behind the quote-request desk. It re-authorizes on the
 * server with the permission the target status needs; the service enforces
 * the workflow and the store the concurrency check.
 */

export type QuoteRequestActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const transitionPayloadSchema = z.object({
  requestId: objectIdSchema,
  expectedRevision: z.number().int().min(0),
  to: z.enum(quoteRequestStatuses),
  reason: z.string().trim().max(1_000).optional(),
});

export async function transitionQuoteRequestAction(
  input: unknown,
): Promise<QuoteRequestActionState> {
  try {
    const parsed = transitionPayloadSchema.parse(input);
    const context = await requirePermission(
      permissionForQuoteRequestTransition(parsed.to),
    );
    const request = await quoteRequestService.transition(context, {
      requestId: parsed.requestId,
      expectedRevision: parsed.expectedRevision,
      to: parsed.to,
      reason: parsed.reason ?? null,
    });
    return { status: "success", message: request.status.toUpperCase() };
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) {
      return { status: "error", message: "FORBIDDEN" };
    }
    if (error instanceof QuoteRequestError) {
      return { status: "error", message: error.code };
    }
    if (error instanceof z.ZodError) {
      return { status: "error", message: "INVALID_INPUT" };
    }
    console.error("[quote-requests] action failed", error);
    return { status: "error", message: "UNAVAILABLE" };
  }
}
