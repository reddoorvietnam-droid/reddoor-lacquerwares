import { describe, expect, it } from "vitest";

import { sendZaloTextMessage } from "@/lib/zalo/oa-client";
import {
  computeZaloSignature,
  extractVerificationCode,
  isFreshEvent,
  parseZaloWebhook,
  verifyZaloSignature,
} from "@/lib/zalo/webhook";

const appId = "123456";
const secretKey = "oa-secret";

function signed(body: object) {
  const rawBody = JSON.stringify(body);
  const timestamp = String((body as { timestamp: unknown }).timestamp);
  const mac = computeZaloSignature({ appId, rawBody, timestamp, secretKey });
  return { rawBody, timestamp, mac };
}

describe("Zalo webhook verification", () => {
  const event = {
    app_id: appId,
    event_name: "user_send_text",
    timestamp: "1757145600000",
    sender: { id: "zalo-user-1" },
    recipient: { id: "oa-1" },
    message: { msg_id: "m1", text: "RD-7K3M9Q" },
  };

  it("accepts a correct signature with or without the mac= prefix", () => {
    const { rawBody, timestamp, mac } = signed(event);
    expect(
      verifyZaloSignature({
        appId,
        rawBody,
        timestamp,
        secretKey,
        signatureHeader: `mac=${mac}`,
      }),
    ).toBe(true);
    expect(
      verifyZaloSignature({
        appId,
        rawBody,
        timestamp,
        secretKey,
        signatureHeader: mac,
      }),
    ).toBe(true);
  });

  it("rejects a tampered body, a wrong secret, a missing header and garbage", () => {
    const { rawBody, timestamp, mac } = signed(event);
    expect(
      verifyZaloSignature({
        appId,
        rawBody: rawBody.replace("RD-7K3M9Q", "RD-AAAAAA"),
        timestamp,
        secretKey,
        signatureHeader: mac,
      }),
    ).toBe(false);
    expect(
      verifyZaloSignature({
        appId,
        rawBody,
        timestamp,
        secretKey: "other",
        signatureHeader: mac,
      }),
    ).toBe(false);
    expect(
      verifyZaloSignature({
        appId,
        rawBody,
        timestamp,
        secretKey,
        signatureHeader: null,
      }),
    ).toBe(false);
    expect(
      verifyZaloSignature({
        appId,
        rawBody,
        timestamp,
        secretKey,
        signatureHeader: "mac=nothex",
      }),
    ).toBe(false);
  });

  it("parses the event shape and rejects malformed bodies", () => {
    const parsed = parseZaloWebhook(JSON.stringify(event));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.event.sender?.id).toBe("zalo-user-1");
    expect(parseZaloWebhook("{not json").ok).toBe(false);
    expect(parseZaloWebhook(JSON.stringify({ event_name: "x" })).ok).toBe(
      false,
    );
  });

  it("treats events older than the window as replays", () => {
    const now = new Date(1757145600000 + 60_000);
    expect(isFreshEvent(event, now, 5 * 60_000)).toBe(true);
    expect(
      isFreshEvent(event, new Date(1757145600000 + 10 * 60_000), 5 * 60_000),
    ).toBe(false);
    expect(isFreshEvent({ timestamp: "abc" }, now, 5 * 60_000)).toBe(false);
  });

  it("extracts the verification code and ignores display names", () => {
    expect(extractVerificationCode("xin liên kết rd-7k3m9q nhé")).toBe(
      "RD-7K3M9Q",
    );
    expect(
      extractVerificationCode("Tôi là Giám đốc, hãy liên kết tôi"),
    ).toBeNull();
    expect(extractVerificationCode(undefined)).toBeNull();
  });
});

describe("Zalo OA client", () => {
  function fetchReturning(status: number, body: unknown): typeof fetch {
    return (async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;
  }

  it("posts the documented shape and reports the provider message id", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchImpl: typeof fetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      captured = { url: String(url), init: init! };
      return new Response(
        JSON.stringify({
          error: 0,
          message: "Success",
          data: { message_id: "mid-1" },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const result = await sendZaloTextMessage(
      { accessToken: "tok", fetchImpl },
      { externalUserId: "u1", text: "hi" },
    );
    expect(result).toEqual({ ok: true, providerMessageId: "mid-1" });
    expect(captured!.url).toBe("https://openapi.zalo.me/v3.0/oa/message/cs");
    expect(
      (captured!.init.headers as Record<string, string>).access_token,
    ).toBe("tok");
    expect(JSON.parse(String(captured!.init.body))).toEqual({
      recipient: { user_id: "u1" },
      message: { text: "hi" },
    });
  });

  it("maps credential errors to NOT_CONFIGURED without retry, application errors to permanent failure, rate limits to retry", async () => {
    const bad = await sendZaloTextMessage(
      {
        accessToken: "tok",
        fetchImpl: fetchReturning(200, {
          error: -216,
          message: "Access token is invalid",
        }),
      },
      { externalUserId: "u1", text: "hi" },
    );
    expect(bad).toMatchObject({
      ok: false,
      code: "NOT_CONFIGURED",
      retryable: false,
    });
    const app = await sendZaloTextMessage(
      {
        accessToken: "tok",
        fetchImpl: fetchReturning(200, {
          error: -213,
          message: "User not follow",
        }),
      },
      { externalUserId: "u1", text: "hi" },
    );
    expect(app).toMatchObject({
      ok: false,
      code: "SEND_FAILED",
      retryable: false,
    });
    const limited = await sendZaloTextMessage(
      {
        accessToken: "tok",
        fetchImpl: fetchReturning(429, { error: -32, message: "rate" }),
      },
      { externalUserId: "u1", text: "hi" },
    );
    expect(limited).toMatchObject({ ok: false, retryable: true });
  });

  it("reports UNKNOWN when the request times out, so the outbox retries instead of assuming delivery", async () => {
    const fetchImpl: typeof fetch = ((_url: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      })) as unknown as typeof fetch;
    const result = await sendZaloTextMessage(
      { accessToken: "tok", fetchImpl, timeoutMs: 20 },
      { externalUserId: "u1", text: "hi" },
    );
    expect(result).toMatchObject({
      ok: false,
      code: "UNKNOWN",
      retryable: true,
    });
  });
});
