import "server-only";

import type { NextResponse } from "next/server";

import type { Locale } from "@/lib/i18n/config";
import { getSiteUrl } from "@/lib/seo/urls";

/**
 * Shared pieces of the "Connect Zalo" consent round trip: the callback
 * address registered on the Zalo app, the cookie that binds the reply to
 * the request that started it, and the settings page to land on after.
 */

export const consentCookieName = "rd_zalo_consent";
const consentCookieMaxAgeSeconds = 10 * 60;

export type ConsentCookie = {
  state: string;
  verifier: string;
  locale: Locale;
};

/** Must match the callback URL registered on the Zalo app. */
export function zaloCallbackUrl(): string {
  return new URL("/api/zalo/oauth/callback", getSiteUrl()).toString();
}

export function settingsUrl(
  locale: Locale,
  zalo: "connected" | "error",
  reason?: string,
): string {
  const url = new URL(`/${locale}/admin/settings`, getSiteUrl());
  url.searchParams.set("zalo", zalo);
  if (reason) url.searchParams.set("reason", reason);
  return url.toString();
}

export function writeConsentCookie(
  response: NextResponse,
  value: ConsentCookie & { secure: boolean },
): void {
  response.cookies.set(consentCookieName, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: value.secure,
    path: "/api/zalo/oauth",
    maxAge: consentCookieMaxAgeSeconds,
  });
}

export function readConsentCookie(
  raw: string | undefined,
): ConsentCookie | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentCookie>;
    if (
      typeof parsed.state === "string" &&
      typeof parsed.verifier === "string" &&
      (parsed.locale === "vi" || parsed.locale === "en")
    ) {
      return {
        state: parsed.state,
        verifier: parsed.verifier,
        locale: parsed.locale,
      };
    }
  } catch {
    // A malformed cookie is treated as absent.
  }
  return null;
}

export function clearConsentCookie(response: NextResponse): void {
  response.cookies.set(consentCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/zalo/oauth",
    maxAge: 0,
  });
}
