import "server-only";

import type { ChannelSendResult } from "@/domains/notifications/contracts";

/**
 * Zalo Official Account API client — the one place the platform talks to
 * Zalo.
 *
 * Endpoint and shape: `POST https://openapi.zalo.me/v3.0/oa/message/cs`
 * with the OA access token in the `access_token` header and a body of
 * `{ recipient: { user_id }, message: { text } }`; the response carries
 * `error` (0 on success) and `data.message_id`. The official reference at
 * developers.zalo.me renders client-side and could not be fetched on
 * 2026-09-06, so this shape was confirmed against three independent
 * open-source wrappers and community threads (see
 * `docs/AI_ASSISTANT.md`, section Zalo). Re-verify against the official
 * page before the first live send.
 *
 * Only a user who has interacted with the OA can be messaged this way, and
 * the "cs" (customer service) message type is subject to Zalo's messaging
 * window. Group chats are not addressed here: no official group-message
 * endpoint could be verified, so recipients are individual linked users.
 */

export const ZALO_OA_MESSAGE_ENDPOINT =
  "https://openapi.zalo.me/v3.0/oa/message/cs";

type ZaloApiResponse = {
  error?: number;
  message?: string;
  data?: { message_id?: string };
};

/** Error codes that mean the credential, not the request, is wrong. */
const credentialErrorCodes = new Set([-124, -216, -201, -202]);

export type ZaloClientDependencies = {
  accessToken: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export async function sendZaloTextMessage(
  dependencies: ZaloClientDependencies,
  input: { externalUserId: string; text: string },
): Promise<ChannelSendResult> {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    dependencies.timeoutMs ?? 10_000,
  );
  let response: Response;
  try {
    response = await fetchImpl(ZALO_OA_MESSAGE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: dependencies.accessToken,
      },
      body: JSON.stringify({
        recipient: { user_id: input.externalUserId },
        message: { text: input.text.slice(0, 2_000) },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    // The request may or may not have reached Zalo: report UNKNOWN so the
    // outbox retries with backoff instead of claiming delivery either way.
    return {
      ok: false,
      code: controller.signal.aborted ? "UNKNOWN" : "SEND_FAILED",
      message: error instanceof Error ? error.message : "Network error",
      retryable: true,
    };
  }
  clearTimeout(timer);

  let payload: ZaloApiResponse;
  try {
    payload = (await response.json()) as ZaloApiResponse;
  } catch {
    return {
      ok: false,
      code: "UNKNOWN",
      message: `Unreadable response (HTTP ${response.status})`,
      retryable: true,
    };
  }

  if (payload.error === 0) {
    return { ok: true, providerMessageId: payload.data?.message_id ?? null };
  }
  const code = payload.error ?? response.status;
  if (credentialErrorCodes.has(code) || response.status === 401) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message: `Zalo rejected the access token (${code}: ${payload.message ?? ""})`,
      retryable: false,
    };
  }
  if (response.status === 429) {
    return {
      ok: false,
      code: "SEND_FAILED",
      message: "Zalo rate limit",
      retryable: true,
    };
  }
  return {
    ok: false,
    code: "SEND_FAILED",
    message: `Zalo error ${code}: ${payload.message ?? "unknown"}`,
    // Unknown application errors (user blocked the OA, outside the
    // messaging window) do not fix themselves by retrying.
    retryable: false,
  };
}
