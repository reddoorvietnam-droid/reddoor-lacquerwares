import "server-only";

import type {
  ChannelSendResult,
  EmailChannel,
  ZaloChannel,
} from "@/domains/notifications/contracts";
import { sendEmail } from "@/lib/email/resend";
import { inspectZaloEnv } from "@/lib/env/server";
import { sendZaloTextMessage } from "@/lib/zalo/oa-client";

/**
 * Channel adapters over the platform's existing senders. They translate
 * each provider's outcome into the outbox's vocabulary (accepted, failed
 * retryable, failed permanently, unknown) and nothing else — recipients,
 * wording and policy are decided by the dispatcher.
 */

export const resendEmailChannel: EmailChannel = {
  async send(input): Promise<ChannelSendResult> {
    let result;
    try {
      result = await sendEmail(
        {
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        },
        { idempotencyKey: input.idempotencyKey },
      );
    } catch (error) {
      // sendEmail catches provider errors itself; a throw here means the
      // request may or may not have gone out.
      return {
        ok: false,
        code: "UNKNOWN",
        message: error instanceof Error ? error.message : "Unknown error",
        retryable: true,
      };
    }
    if (result.sent) return { ok: true, providerMessageId: result.id };
    if (result.reason === "NOT_CONFIGURED") {
      return {
        ok: false,
        code: "NOT_CONFIGURED",
        message: result.detail,
        retryable: false,
      };
    }
    const detail = result.detail.toLowerCase();
    // Sandbox senders may only mail the account owner; a rejected address
    // or an invalid key will not succeed on retry.
    const permanent =
      detail.includes("api key") ||
      detail.includes("unauthorized") ||
      detail.includes("validation") ||
      detail.includes("only send testing emails") ||
      detail.includes("no recipients");
    return {
      ok: false,
      code: "SEND_FAILED",
      message: result.detail,
      retryable: !permanent,
    };
  },
};

export function createZaloChannel(): ZaloChannel | null {
  const env = inspectZaloEnv();
  if (!env.configured) return null;
  const accessToken = env.value.ZALO_OA_ACCESS_TOKEN;
  return {
    send(input) {
      return sendZaloTextMessage({ accessToken }, input);
    },
  };
}
