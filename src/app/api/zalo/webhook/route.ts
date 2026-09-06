import { NextResponse } from "next/server";

import {
  channelLinkService,
  webhookEventStore,
  zaloChannel,
} from "@/domains/notifications/runtime";
import { getNotificationEnv, inspectZaloEnv } from "@/lib/env/server";
import {
  extractVerificationCode,
  isFreshEvent,
  parseZaloWebhook,
  verifyZaloSignature,
} from "@/lib/zalo/webhook";

/**
 * Zalo Official Account webhook. Its only business purpose today is the
 * identity link: a staff member sends the code the portal gave them, and
 * the sender id Zalo attaches to that message becomes the verified Zalo
 * identity of that portal account. Every delivery must carry a valid
 * signature and a fresh timestamp, and every event id is processed once.
 * Anything else is acknowledged and ignored.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxEventAgeMs = 5 * 60_000;

export async function POST(request: Request) {
  const env = inspectZaloEnv();
  if (!env.configured) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }

  const rawBody = await request.text();
  const parsed = parseZaloWebhook(rawBody);
  if (!parsed.ok) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  const event = parsed.event;

  const valid = verifyZaloSignature({
    appId: env.value.ZALO_APP_ID,
    rawBody,
    timestamp: String(event.timestamp),
    secretKey: env.value.ZALO_OA_SECRET_KEY,
    signatureHeader: request.headers.get("x-zevent-signature"),
  });
  if (!valid || event.app_id !== env.value.ZALO_APP_ID) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  const now = new Date();
  if (!isFreshEvent(event, now, maxEventAgeMs)) {
    return NextResponse.json({ error: "STALE_EVENT" }, { status: 401 });
  }

  const eventId =
    event.message?.msg_id ??
    `${event.event_name}:${event.sender?.id ?? "-"}:${event.timestamp}`;
  const firstTime = await webhookEventStore.recordOnce("zalo", eventId, now);
  if (!firstTime) {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
  }

  if (event.event_name === "user_send_text" && event.sender?.id) {
    const code = extractVerificationCode(event.message?.text);
    if (code) {
      const requestId = globalThis.crypto.randomUUID();
      const outcome = await channelLinkService.completeZaloLink({
        code,
        externalId: event.sender.id,
        requestId,
      });
      // A confirmation back to the sender is a live message, so it follows
      // the delivery policy like every other outbound message.
      const channel = zaloChannel();
      if (channel && getNotificationEnv().NOTIFICATION_DELIVERY === "live") {
        await channel.send({
          externalUserId: event.sender.id,
          text: outcome.ok
            ? "Red Door: đã liên kết Zalo này với tài khoản cổng quản trị của bạn. Nhắc việc sẽ được gửi tại đây."
            : outcome.reason === "LINK_CONFLICT"
              ? "Red Door: Zalo này đã liên kết với một tài khoản khác. Hãy gỡ liên kết cũ trên cổng quản trị trước."
              : "Red Door: mã không hợp lệ hoặc đã hết hạn. Lấy mã mới trên cổng quản trị (Việc cần làm → Liên kết Zalo).",
        });
      }
      return NextResponse.json(
        { ok: true, linked: outcome.ok },
        { status: 200 },
      );
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
