import "server-only";

import { Resend } from "resend";

import { inspectEmailEnv } from "@/lib/env/server";

/**
 * The one place the platform sends email. Missing configuration is a soft
 * state, not an error: the caller learns the message was skipped and carries
 * on, so a form submission never fails because `RESEND_API_KEY` is absent.
 */

export type EmailMessage = {
  to: readonly string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type EmailSendResult =
  | { sent: true; id: string | null }
  | { sent: false; reason: "NOT_CONFIGURED" | "SEND_FAILED"; detail: string };

export function isEmailConfigured(): boolean {
  return inspectEmailEnv().configured;
}

/** Addresses listed in `ORDER_NOTIFICATION_EMAILS`, comma or semicolon separated. */
export function getOrderNotificationRecipients(): string[] {
  const env = inspectEmailEnv();
  if (!env.configured) return [];
  return [
    ...new Set(
      env.value.ORDER_NOTIFICATION_EMAILS.split(/[,;\s]+/)
        .map((address) => address.trim())
        .filter((address) => address.includes("@")),
    ),
  ];
}

export type EmailSendOptions = {
  /**
   * Forwarded to Resend as its idempotency key, so a retry after a client
   * timeout cannot deliver the same reminder twice. Scope it to the
   * business message (an outbox row), never to the attempt.
   */
  idempotencyKey?: string;
};

export async function sendEmail(
  message: EmailMessage,
  options: EmailSendOptions = {},
): Promise<EmailSendResult> {
  const env = inspectEmailEnv();
  if (!env.configured) {
    console.info("[email] skipped, not configured", {
      missing: env.invalidKeys,
      subject: message.subject,
    });
    return {
      sent: false,
      reason: "NOT_CONFIGURED",
      detail: `Missing ${env.invalidKeys.join(", ")}`,
    };
  }
  if (message.to.length === 0) {
    return { sent: false, reason: "SEND_FAILED", detail: "No recipients." };
  }

  try {
    const resend = new Resend(env.value.RESEND_API_KEY);
    const response = await resend.emails.send(
      {
        from: env.value.EMAIL_FROM,
        to: [...message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      },
      options.idempotencyKey
        ? { idempotencyKey: options.idempotencyKey }
        : undefined,
    );
    if (response.error) {
      console.error("[email] send failed", response.error);
      return {
        sent: false,
        reason: "SEND_FAILED",
        detail: response.error.message,
      };
    }
    return { sent: true, id: response.data?.id ?? null };
  } catch (error) {
    console.error("[email] send threw", error);
    return {
      sent: false,
      reason: "SEND_FAILED",
      detail: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
