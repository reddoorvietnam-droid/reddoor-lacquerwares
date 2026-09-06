import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";
import { inspectZaloEnv } from "@/lib/env/server";
import { isLocale } from "@/lib/i18n/config";
import { getSiteUrl } from "@/lib/seo/urls";
import { buildZaloPermissionUrl, createPkcePair } from "@/lib/zalo/oauth";
import {
  settingsUrl,
  writeConsentCookie,
  zaloCallbackUrl,
} from "@/lib/zalo/oauth-consent";

/**
 * Step one of "Connect Zalo": a Director presses the button on the
 * settings page and is sent to Zalo's consent screen. The state and the
 * PKCE verifier travel in a short-lived HttpOnly cookie that only the
 * callback route reads, so the reply can be tied to this very request.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("locale") ?? "vi";
  const locale = isLocale(requested) ? requested : "vi";

  const env = inspectZaloEnv();
  if (!env.configured) {
    return NextResponse.redirect(
      settingsUrl(locale, "error", "NOT_CONFIGURED"),
    );
  }

  try {
    await requirePermission("settings.manageSystem", {
      requestId: globalThis.crypto.randomUUID(),
    });
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) {
      return NextResponse.redirect(settingsUrl(locale, "error", "FORBIDDEN"));
    }
    throw error;
  }

  const state = randomBytes(24).toString("base64url");
  const pkce = createPkcePair();
  const response = NextResponse.redirect(
    buildZaloPermissionUrl({
      appId: env.value.ZALO_APP_ID,
      redirectUri: zaloCallbackUrl(),
      state,
      codeChallenge: pkce.challenge,
    }),
  );
  writeConsentCookie(response, {
    state,
    verifier: pkce.verifier,
    locale,
    secure: getSiteUrl().protocol === "https:",
  });
  return response;
}
