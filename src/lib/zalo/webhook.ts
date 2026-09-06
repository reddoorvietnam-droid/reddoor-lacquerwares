import { createHash, timingSafeEqual } from "node:crypto";

import { z } from "zod";

/**
 * Zalo Official Account webhook verification and parsing.
 *
 * Zalo signs each delivery with the header `X-ZEvent-Signature`, whose
 * value is `mac=<sha256 hex>` where the digest is computed over
 * `appId + rawBody + timestamp + OAsecretKey` (fields concatenated as
 * strings, `timestamp` being the one inside the body). This is the
 * formula Zalo's own community answers give; the official page could not
 * be fetched (client-rendered) on 2026-09-06 — re-verify on first live
 * traffic. A signature mismatch is a hard reject, and events older than
 * `maxAgeMs` are rejected as replays even when the signature is valid.
 */

export const zaloWebhookEventSchema = z.object({
  app_id: z.string().min(1),
  event_name: z.string().min(1),
  timestamp: z.union([z.string(), z.number()]),
  sender: z.object({ id: z.string().min(1) }).optional(),
  recipient: z.object({ id: z.string().min(1) }).optional(),
  message: z
    .object({
      msg_id: z.string().optional(),
      text: z.string().optional(),
    })
    .optional(),
});

export type ZaloWebhookEvent = z.infer<typeof zaloWebhookEventSchema>;

export function computeZaloSignature(input: {
  appId: string;
  rawBody: string;
  timestamp: string;
  secretKey: string;
}): string {
  return createHash("sha256")
    .update(
      `${input.appId}${input.rawBody}${input.timestamp}${input.secretKey}`,
    )
    .digest("hex");
}

export function verifyZaloSignature(input: {
  appId: string;
  rawBody: string;
  timestamp: string;
  secretKey: string;
  signatureHeader: string | null;
}): boolean {
  if (!input.signatureHeader) return false;
  const presented = input.signatureHeader
    .replace(/^mac=/i, "")
    .trim()
    .toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(presented)) return false;
  const expected = computeZaloSignature(input);
  return timingSafeEqual(
    Buffer.from(presented, "hex"),
    Buffer.from(expected, "hex"),
  );
}

export function parseZaloWebhook(
  rawBody: string,
): { ok: true; event: ZaloWebhookEvent } | { ok: false } {
  try {
    const parsed = zaloWebhookEventSchema.safeParse(JSON.parse(rawBody));
    return parsed.success ? { ok: true, event: parsed.data } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export function isFreshEvent(
  event: Pick<ZaloWebhookEvent, "timestamp">,
  now: Date,
  maxAgeMs: number,
): boolean {
  const value = Number(event.timestamp);
  if (!Number.isFinite(value)) return false;
  // Zalo timestamps are milliseconds; tolerate seconds just in case.
  const millis = value < 1e12 ? value * 1000 : value;
  return Math.abs(now.getTime() - millis) <= maxAgeMs;
}

/** The staff verification code as it appears in a message, e.g. `RD-7K3M9Q`. */
export const verificationCodePattern = /\bRD-[A-Z2-9]{6}\b/;

export function extractVerificationCode(
  text: string | undefined,
): string | null {
  if (!text) return null;
  return verificationCodePattern.exec(text.toUpperCase())?.[0] ?? null;
}
