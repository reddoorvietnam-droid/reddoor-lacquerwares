import "server-only";

import type {
  ChannelSendResult,
  EmailChannel,
  ZaloChannel,
} from "@/domains/notifications/contracts";
import type { ZaloTokenProvider } from "@/domains/notifications/zalo-token";
import { sendEmail } from "@/lib/email/resend";
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

/**
 * The Zalo channel over a self-renewing token. Each send takes the current
 * token from the provider (renewed ahead of expiry); a send Zalo refuses
 * for a bad token forces one renewal and is retried once, so a token that
 * expired between runs costs one round trip, not a failed reminder.
 */
export function createZaloChannel(
  tokens: ZaloTokenProvider,
  sender: typeof sendZaloTextMessage = sendZaloTextMessage,
): ZaloChannel {
  return {
    async send(input): Promise<ChannelSendResult> {
      const first = await tokens.getAccessToken();
      if (!first.ok) {
        return {
          ok: false,
          code: "NOT_CONFIGURED",
          message: first.message,
          retryable: true,
        };
      }
      const result = await sender({ accessToken: first.accessToken }, input);
      if (result.ok || result.code !== "NOT_CONFIGURED") return result;

      const renewed = await tokens.getAccessToken({
        rejectedAccessToken: first.accessToken,
      });
      if (!renewed.ok || renewed.accessToken === first.accessToken) {
        // Zalo rejected the token and no fresh one could be obtained:
        // the reminder waits for the next run rather than failing for good.
        return { ...result, retryable: true };
      }
      return sender({ accessToken: renewed.accessToken }, input);
    },
  };
}
