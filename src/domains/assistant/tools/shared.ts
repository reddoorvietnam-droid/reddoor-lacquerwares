import { z } from "zod";

import type { ToolOutcome } from "@/domains/assistant/tools/types";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { formatMoney, type Money } from "@/lib/money";

/**
 * Helpers every tool shares: a uniform error shape that tells the model
 * (and, through the trace, the reader) whether data was missing, forbidden,
 * or unreachable — three different answers that must never be blurred — and
 * money rendered by the money module rather than by the model.
 */

export const orderCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
  .max(40);

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/);

export function denied(): ToolOutcome {
  return {
    ok: false,
    code: "PERMISSION_DENIED",
    message: "The signed-in user does not hold the permission for this data.",
  };
}

export function notFound(what: string): ToolOutcome {
  return { ok: false, code: "NOT_FOUND", message: `${what} was not found.` };
}

export function unavailable(): ToolOutcome {
  return {
    ok: false,
    code: "UNAVAILABLE",
    message: "The data store did not respond; nothing could be read.",
  };
}

/**
 * Runs a tool body and maps the failure kinds the portal already
 * distinguishes onto the tool error codes. Anything unexpected — a lost
 * database connection, a thrown driver error — is reported as UNAVAILABLE,
 * never as "no data".
 */
export async function guarded(
  body: () => Promise<ToolOutcome>,
): Promise<ToolOutcome> {
  try {
    return await body();
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) return denied();
    if (error instanceof z.ZodError) {
      return { ok: false, code: "INVALID_INPUT", message: "Invalid input." };
    }
    if (
      error instanceof Error &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
    ) {
      return {
        ok: false,
        code: (error as { code: string }).code,
        message: error.message,
      };
    }
    console.error("[assistant] tool failed", error);
    return unavailable();
  }
}

export function moneyView(value: Money, locale: string) {
  return {
    amount: value.amount,
    currency: value.currency,
    display: formatMoney(value, locale === "vi" ? "vi-VN" : "en-US"),
  };
}

export function isoDay(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function adminHref(locale: string, path: string): string {
  return `/${locale}/admin${path}`;
}
