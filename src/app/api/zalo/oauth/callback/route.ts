import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { zaloTokenProvider } from "@/domains/notifications/runtime";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";
import { inspectZaloEnv } from "@/lib/env/server";
import { exchangeZaloAuthorizationCode } from "@/lib/zalo/oauth";
import {
  clearConsentCookie,
  consentCookieName,
  readConsentCookie,
  settingsUrl,
} from "@/lib/zalo/oauth-consent";

/**
 * Step two of "Connect Zalo": Zalo sends the OA admin back here with an
 * authorization code. The reply must carry the state issued at the start
 * (bound by the consent cookie), the same signed-in Director must still
 * hold the permission, and only then is the code exchanged and the token
 * pair stored. From here on the platform renews the pair by itself.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieHeader = request.headers.get("cookie") ?? "";
  const rawCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${consentCookieName}=`))
    ?.slice(consentCookieName.length + 1);
  const consent = readConsentCookie(
    rawCookie ? decodeURIComponent(rawCookie) : undefined,
  );
  const locale = consent?.locale ?? "vi";

  const finish = (zalo: "connected" | "error", reason?: string) => {
    const response = NextResponse.redirect(settingsUrl(locale, zalo, reason));
    clearConsentCookie(response);
    return response;
  };

  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!consent || !state || !sameString(state, consent.state)) {
    return finish("error", "STATE_MISMATCH");
  }
  if (!code) {
    return finish("error", "DENIED");
  }

  const env = inspectZaloEnv();
  const tokens = zaloTokenProvider();
  if (!env.configured || !tokens) {
    return finish("error", "NOT_CONFIGURED");
  }

  const requestId = globalThis.crypto.randomUUID();
  let access;
  try {
    access = await requirePermission("settings.manageSystem", { requestId });
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) {
      return finish("error", "FORBIDDEN");
    }
    throw error;
  }

  const exchanged = await exchangeZaloAuthorizationCode({
    appId: env.value.ZALO_APP_ID,
    appSecretKey: env.value.ZALO_APP_SECRET_KEY,
    code,
    codeVerifier: consent.verifier,
  });
  if (!exchanged.ok) {
    console.error("[zalo] consent exchange failed", exchanged.message);
    return finish(
      "error",
      exchanged.kind === "transient" ? "UNAVAILABLE" : "EXCHANGE_FAILED",
    );
  }

  const now = new Date();
  await tokens.connect(exchanged, access.userId);
  await mongoAuditRepository.append({
    actor: { type: "user", userId: access.userId },
    action: "notifications.zaloOaConnected",
    resourceType: "zaloCredential",
    resourceId: "oa",
    requestId,
    metadata: { oaId: url.searchParams.get("oa_id") ?? null },
    occurredAt: now,
  });
  return finish("connected");
}
