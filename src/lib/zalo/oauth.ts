import { createHash, randomBytes } from "node:crypto";

/**
 * Zalo OAuth v4 for an Official Account: the one-time consent that yields
 * the first token pair, and the renewal that keeps it alive.
 *
 * Consent: the OA admin is sent to
 * `https://oauth.zaloapp.com/v4/oa/permission?app_id&redirect_uri&code_challenge&state`
 * and comes back to `redirect_uri` with `code` (and `oa_id`). The
 * `redirect_uri` must be registered on the app at developers.zalo.me.
 *
 * Token endpoint: `POST https://oauth.zaloapp.com/v4/oa/access_token` with
 * the app secret key in the `secret_key` header and a form body; either
 * `code` + `code_verifier` + `grant_type=authorization_code`, or
 * `refresh_token` + `grant_type=refresh_token`. A success reply carries
 * `access_token`, a *new* `refresh_token` and `expires_in` (seconds, sent
 * as a string; 90000 = 25 hours). Every refresh token is single-use, so
 * the reply's refresh token must be persisted before anything else. A
 * failure is `error` (negative), `error_name`, `error_description`,
 * usually with HTTP 200.
 *
 * Same caveat as the message client: the official reference could not be
 * fetched on 2026-09-06; this follows Zalo's published samples and
 * open-source wrappers. The first live consent is the verification.
 */

export const ZALO_OAUTH_PERMISSION_ENDPOINT =
  "https://oauth.zaloapp.com/v4/oa/permission";
export const ZALO_OAUTH_TOKEN_ENDPOINT =
  "https://oauth.zaloapp.com/v4/oa/access_token";

/** Zalo's documented lifetime of a refresh token (3 months). */
export const ZALO_REFRESH_TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

/** Used when the reply omits `expires_in`; Zalo's documented default. */
const defaultAccessTokenLifetimeSeconds = 90_000;

export type ZaloTokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
};

export type ZaloRefreshResult =
  | ({ ok: true } & ZaloTokenPair)
  | {
      ok: false;
      /** `credential` = the token, code or secret is rejected; `transient` = network / provider outage. */
      kind: "credential" | "transient";
      message: string;
    };

export type ZaloRefreshDependencies = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/** PKCE pair for the consent redirect (S256). */
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildZaloPermissionUrl(input: {
  appId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(ZALO_OAUTH_PERMISSION_ENDPOINT);
  url.searchParams.set("app_id", input.appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export async function exchangeZaloAuthorizationCode(
  input: {
    appId: string;
    appSecretKey: string;
    code: string;
    codeVerifier: string;
  },
  dependencies: ZaloRefreshDependencies = {},
): Promise<ZaloRefreshResult> {
  return requestTokens(
    input.appSecretKey,
    new URLSearchParams({
      code: input.code,
      app_id: input.appId,
      grant_type: "authorization_code",
      code_verifier: input.codeVerifier,
    }),
    dependencies,
  );
}

export async function refreshZaloAccessToken(
  input: { appId: string; appSecretKey: string; refreshToken: string },
  dependencies: ZaloRefreshDependencies = {},
): Promise<ZaloRefreshResult> {
  return requestTokens(
    input.appSecretKey,
    new URLSearchParams({
      refresh_token: input.refreshToken,
      app_id: input.appId,
      grant_type: "refresh_token",
    }),
    dependencies,
  );
}

type OAuthReply = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: string | number;
  error?: number | string;
  error_name?: string;
  error_reason?: string;
  error_description?: string;
};

async function requestTokens(
  appSecretKey: string,
  body: URLSearchParams,
  dependencies: ZaloRefreshDependencies,
): Promise<ZaloRefreshResult> {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    dependencies.timeoutMs ?? 10_000,
  );

  let response: Response;
  try {
    response = await fetchImpl(ZALO_OAUTH_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        secret_key: appSecretKey,
      },
      body: body.toString(),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    return {
      ok: false,
      kind: "transient",
      message: controller.signal.aborted
        ? "Zalo OAuth timeout"
        : error instanceof Error
          ? error.message
          : "Network error",
    };
  }
  clearTimeout(timer);

  let reply: OAuthReply;
  try {
    reply = (await response.json()) as OAuthReply;
  } catch {
    return {
      ok: false,
      kind: response.status >= 500 ? "transient" : "credential",
      message: `Unreadable OAuth response (HTTP ${response.status})`,
    };
  }

  if (
    typeof reply.access_token === "string" &&
    reply.access_token.length > 0 &&
    typeof reply.refresh_token === "string" &&
    reply.refresh_token.length > 0
  ) {
    const parsed = Number(reply.expires_in);
    return {
      ok: true,
      accessToken: reply.access_token,
      refreshToken: reply.refresh_token,
      expiresInSeconds:
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : defaultAccessTokenLifetimeSeconds,
    };
  }

  const code = reply.error ?? response.status;
  const detail =
    reply.error_description ?? reply.error_reason ?? reply.error_name ?? "";
  return {
    ok: false,
    kind:
      response.status >= 500 || response.status === 429
        ? "transient"
        : "credential",
    message: `Zalo OAuth error ${code}${detail ? `: ${detail}` : ""}`,
  };
}
