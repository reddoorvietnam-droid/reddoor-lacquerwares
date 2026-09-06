import { describe, expect, it } from "vitest";

import { createZaloChannel } from "@/domains/notifications/channels";
import type {
  ChannelSendResult,
  ZaloCredentialDto,
  ZaloCredentialStore,
} from "@/domains/notifications/contracts";
import { ZaloTokenProvider } from "@/domains/notifications/zalo-token";
import {
  buildZaloPermissionUrl,
  createPkcePair,
  exchangeZaloAuthorizationCode,
  refreshZaloAccessToken,
  ZALO_OAUTH_TOKEN_ENDPOINT,
  type ZaloRefreshResult,
} from "@/lib/zalo/oauth";

const hour = 60 * 60 * 1000;
const t0 = new Date("2026-09-06T08:00:00.000Z");

/** In-memory store with the same compare-and-set semantics as Mongo. */
class MemoryStore implements ZaloCredentialStore {
  row: ZaloCredentialDto | null = null;

  async load() {
    return this.row ? { ...this.row } : null;
  }
  async replace(input: {
    accessToken: string;
    accessTokenExpiresAt: Date;
    refreshToken: string;
    connectedByUserId: string | null;
    at: Date;
  }) {
    this.row = {
      accessToken: input.accessToken,
      accessTokenExpiresAt: input.accessTokenExpiresAt,
      refreshToken: input.refreshToken,
      refreshTokenIssuedAt: input.at,
      connectedAt: input.at,
      connectedByUserId: input.connectedByUserId,
      lastRefreshAt: null,
      lastRefreshError: null,
      refreshCount: 0,
    };
    return { ...this.row };
  }
  async saveRefreshed(input: {
    expectedRefreshToken: string;
    accessToken: string;
    accessTokenExpiresAt: Date;
    refreshToken: string;
    at: Date;
  }) {
    if (!this.row || this.row.refreshToken !== input.expectedRefreshToken) {
      return null;
    }
    this.row = {
      ...this.row,
      accessToken: input.accessToken,
      accessTokenExpiresAt: input.accessTokenExpiresAt,
      refreshToken: input.refreshToken,
      refreshTokenIssuedAt: input.at,
      lastRefreshAt: input.at,
      lastRefreshError: null,
      refreshCount: this.row.refreshCount + 1,
    };
    return { ...this.row };
  }
  async recordRefreshFailure(input: {
    expectedRefreshToken: string;
    message: string;
  }) {
    if (this.row && this.row.refreshToken === input.expectedRefreshToken) {
      this.row = { ...this.row, lastRefreshError: input.message };
    }
  }
}

function scriptedRefresh(script: (() => ZaloRefreshResult)[]) {
  const calls: { refreshToken: string }[] = [];
  const refresh = async (input: { refreshToken: string }) => {
    calls.push({ refreshToken: input.refreshToken });
    const next = script.shift();
    if (!next) throw new Error("unexpected refresh call");
    return next();
  };
  return { calls, refresh };
}

const okRefresh =
  (n: number, seconds = 90_000): (() => ZaloRefreshResult) =>
  () => ({
    ok: true,
    accessToken: `access-${n}`,
    refreshToken: `refresh-${n}`,
    expiresInSeconds: seconds,
  });

function provider(
  store: MemoryStore,
  refresh: (input: { refreshToken: string }) => Promise<ZaloRefreshResult>,
  now: () => Date = () => t0,
) {
  return new ZaloTokenProvider({
    store,
    refresh,
    credentials: { appId: "app", appSecretKey: "app-secret" },
    now,
  });
}

/** A provider that has been through the consent flow once. */
async function connected(
  store: MemoryStore,
  refresh: (input: { refreshToken: string }) => Promise<ZaloRefreshResult>,
  now: () => Date = () => t0,
) {
  const tokens = provider(store, refresh, now);
  await tokens.connect(
    {
      accessToken: "access-0",
      refreshToken: "refresh-0",
      expiresInSeconds: 90_000,
    },
    "user-1",
  );
  return tokens;
}

function jsonResponse(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

describe("Zalo OAuth client", () => {
  it("builds the consent URL with PKCE and state", () => {
    const pkce = createPkcePair();
    expect(pkce.verifier).not.toBe(pkce.challenge);
    const url = new URL(
      buildZaloPermissionUrl({
        appId: "app",
        redirectUri: "https://example.com/api/zalo/oauth/callback",
        state: "st",
        codeChallenge: pkce.challenge,
      }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://oauth.zaloapp.com/v4/oa/permission",
    );
    expect(url.searchParams.get("app_id")).toBe("app");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://example.com/api/zalo/oauth/callback",
    );
    expect(url.searchParams.get("code_challenge")).toBe(pkce.challenge);
    expect(url.searchParams.get("state")).toBe("st");
  });

  it("exchanges the authorization code with the verifier and app secret", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      captured = { url: String(url), init: init ?? {} };
      return new Response(
        JSON.stringify({
          access_token: "a1",
          refresh_token: "r1",
          expires_in: "90000",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const result = await exchangeZaloAuthorizationCode(
      {
        appId: "app",
        appSecretKey: "secret",
        code: "code-1",
        codeVerifier: "ver",
      },
      { fetchImpl },
    );
    expect(result).toEqual({
      ok: true,
      accessToken: "a1",
      refreshToken: "r1",
      expiresInSeconds: 90_000,
    });
    expect(captured!.url).toBe(ZALO_OAUTH_TOKEN_ENDPOINT);
    const headers = captured!.init.headers as Record<string, string>;
    expect(headers.secret_key).toBe("secret");
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const body = new URLSearchParams(String(captured!.init.body));
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("code-1");
    expect(body.get("code_verifier")).toBe("ver");
    expect(body.get("app_id")).toBe("app");
  });

  it("renews with grant_type=refresh_token", async () => {
    let body = "";
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      body = String(init?.body);
      return new Response(
        JSON.stringify({ access_token: "a2", refresh_token: "r2" }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const result = await refreshZaloAccessToken(
      { appId: "app", appSecretKey: "secret", refreshToken: "r1" },
      { fetchImpl },
    );
    // expires_in omitted: Zalo's documented default applies.
    expect(result).toEqual({
      ok: true,
      accessToken: "a2",
      refreshToken: "r2",
      expiresInSeconds: 90_000,
    });
    const form = new URLSearchParams(body);
    expect(form.get("grant_type")).toBe("refresh_token");
    expect(form.get("refresh_token")).toBe("r1");
  });

  it("classifies Zalo's HTTP-200 error body as a credential failure and a 5xx as transient", async () => {
    const credential = await refreshZaloAccessToken(
      { appId: "app", appSecretKey: "secret", refreshToken: "r0" },
      {
        fetchImpl: jsonResponse(200, {
          error: -14014,
          error_name: "Invalid refresh token",
          error_description: "refresh token expired",
        }),
      },
    );
    expect(credential).toMatchObject({ ok: false, kind: "credential" });
    expect((credential as { message: string }).message).toContain("-14014");

    const transient = await refreshZaloAccessToken(
      { appId: "app", appSecretKey: "secret", refreshToken: "r0" },
      {
        fetchImpl: (async () =>
          new Response("bad gateway", {
            status: 502,
          })) as unknown as typeof fetch,
      },
    );
    expect(transient).toMatchObject({ ok: false, kind: "transient" });
  });
});

describe("ZaloTokenProvider", () => {
  it("reports not connected until the consent flow has stored a pair", async () => {
    const store = new MemoryStore();
    const { calls, refresh } = scriptedRefresh([]);
    const tokens = provider(store, refresh);

    expect((await tokens.status()).state).toBe("not_connected");
    const outcome = await tokens.getAccessToken();
    expect(outcome.ok).toBe(false);
    expect((outcome as { message: string }).message).toContain("not connected");
    expect(calls).toHaveLength(0);
  });

  it("stores the consent pair and uses it without renewing while fresh", async () => {
    const store = new MemoryStore();
    const { calls, refresh } = scriptedRefresh([]);
    const tokens = await connected(store, refresh);

    expect(await tokens.getAccessToken()).toEqual({
      ok: true,
      accessToken: "access-0",
    });
    expect(store.row).toMatchObject({
      refreshToken: "refresh-0",
      connectedByUserId: "user-1",
      refreshCount: 0,
    });
    expect(store.row!.accessTokenExpiresAt.getTime()).toBe(
      t0.getTime() + 90_000 * 1000,
    );
    expect(calls).toHaveLength(0);
    expect(await tokens.status()).toMatchObject({
      state: "ok",
      connectedAt: t0,
      refreshTokenAging: false,
    });
  });

  it("renews only inside the margin and rotates the refresh token", async () => {
    const store = new MemoryStore();
    const { calls, refresh } = scriptedRefresh([okRefresh(1)]);
    let now = t0;
    const tokens = await connected(store, refresh, () => now);

    now = new Date(t0.getTime() + 20 * hour);
    expect(await tokens.getAccessToken()).toEqual({
      ok: true,
      accessToken: "access-0",
    });
    expect(calls).toHaveLength(0);

    // 23.5h in: less than the 2h margin left, so the run renews.
    now = new Date(t0.getTime() + 23.5 * hour);
    expect(await tokens.ensureFresh()).toEqual({
      ok: true,
      accessToken: "access-1",
    });
    expect(calls).toEqual([{ refreshToken: "refresh-0" }]);
    expect(store.row).toMatchObject({
      refreshToken: "refresh-1",
      refreshCount: 1,
    });
    // The new refresh token is good for another three months from now.
    expect(store.row!.refreshTokenIssuedAt).toEqual(now);
  });

  it("shares one in-flight renewal between concurrent callers", async () => {
    const store = new MemoryStore();
    const { calls, refresh } = scriptedRefresh([okRefresh(1)]);
    let now = t0;
    const tokens = await connected(store, refresh, () => now);
    now = new Date(t0.getTime() + 24 * hour);

    const results = await Promise.all([
      tokens.getAccessToken(),
      tokens.getAccessToken(),
      tokens.getAccessToken(),
    ]);
    expect(results).toEqual([
      { ok: true, accessToken: "access-1" },
      { ok: true, accessToken: "access-1" },
      { ok: true, accessToken: "access-1" },
    ]);
    expect(calls).toHaveLength(1);
  });

  it("keeps a still-valid token when renewal fails, records the error, and gives up only after expiry", async () => {
    const store = new MemoryStore();
    const { refresh } = scriptedRefresh([
      () => ({ ok: false, kind: "transient", message: "Zalo OAuth timeout" }),
      () => ({
        ok: false,
        kind: "credential",
        message: "Zalo OAuth error -14014",
      }),
    ]);
    let now = t0;
    const tokens = await connected(store, refresh, () => now);

    now = new Date(t0.getTime() + 24 * hour);
    expect(await tokens.getAccessToken()).toEqual({
      ok: true,
      accessToken: "access-0",
    });
    expect(await tokens.status()).toMatchObject({
      state: "renewal_failed",
      lastRefreshError: "Zalo OAuth timeout",
      refreshCount: 0,
    });

    now = new Date(t0.getTime() + 26 * hour);
    const failed = await tokens.getAccessToken();
    expect(failed.ok).toBe(false);
    expect((failed as { message: string }).message).toContain("-14014");
    expect((await tokens.status()).state).toBe("expired");
  });

  it("loses a compare-and-set race gracefully and returns the winner's token", async () => {
    const store = new MemoryStore();
    let now = t0;
    const { refresh } = scriptedRefresh([
      () => {
        // Another worker renews between our call and our save.
        store.row = {
          ...store.row!,
          accessToken: "access-other",
          accessTokenExpiresAt: new Date(now.getTime() + 25 * hour),
          refreshToken: "refresh-other",
          refreshCount: 1,
        };
        return okRefresh(1)();
      },
    ]);
    const tokens = await connected(store, refresh, () => now);
    now = new Date(t0.getTime() + 24 * hour);
    expect(await tokens.getAccessToken()).toEqual({
      ok: true,
      accessToken: "access-other",
    });
    expect(store.row!.refreshToken).toBe("refresh-other");
  });

  it("re-connecting replaces the stored pair and resets the counters", async () => {
    const store = new MemoryStore();
    const { refresh } = scriptedRefresh([okRefresh(1)]);
    let now = t0;
    const tokens = await connected(store, refresh, () => now);
    now = new Date(t0.getTime() + 24 * hour);
    await tokens.ensureFresh();
    expect(store.row!.refreshCount).toBe(1);

    await tokens.connect(
      {
        accessToken: "access-new",
        refreshToken: "refresh-new",
        expiresInSeconds: 90_000,
      },
      "user-2",
    );
    expect(store.row).toMatchObject({
      accessToken: "access-new",
      refreshToken: "refresh-new",
      connectedByUserId: "user-2",
      refreshCount: 0,
      lastRefreshError: null,
    });
  });

  it("flags a refresh token near the end of its 3-month life", async () => {
    const store = new MemoryStore();
    const { refresh } = scriptedRefresh([]);
    let now = t0;
    const tokens = await connected(store, refresh, () => now);
    now = new Date(t0.getTime() + 85 * 24 * hour);
    expect((await tokens.status()).refreshTokenAging).toBe(true);
  });
});

describe("createZaloChannel", () => {
  const sent: { accessToken: string }[] = [];
  const senderRejecting = (rejected: Set<string>) =>
    (async (deps: { accessToken: string }): Promise<ChannelSendResult> => {
      sent.push({ accessToken: deps.accessToken });
      if (rejected.has(deps.accessToken)) {
        return {
          ok: false,
          code: "NOT_CONFIGURED",
          message: "Zalo rejected the access token (-216)",
          retryable: false,
        };
      }
      return { ok: true, providerMessageId: "mid" };
    }) as unknown as Parameters<typeof createZaloChannel>[1];

  it("renews once and retries when Zalo rejects the token mid-life", async () => {
    sent.length = 0;
    const store = new MemoryStore();
    const { calls, refresh } = scriptedRefresh([okRefresh(1)]);
    const tokens = await connected(store, refresh);
    const channel = createZaloChannel(
      tokens,
      senderRejecting(new Set(["access-0"])),
    );

    const result = await channel.send({ externalUserId: "u1", text: "hi" });
    expect(result).toEqual({ ok: true, providerMessageId: "mid" });
    expect(sent.map((s) => s.accessToken)).toEqual(["access-0", "access-1"]);
    expect(calls).toHaveLength(1);
  });

  it("leaves the reminder retryable when no fresh token can be obtained", async () => {
    sent.length = 0;
    const store = new MemoryStore();
    const { refresh } = scriptedRefresh([
      () => ({
        ok: false,
        kind: "credential",
        message: "Zalo OAuth error -14014",
      }),
    ]);
    const tokens = await connected(store, refresh);
    const channel = createZaloChannel(
      tokens,
      senderRejecting(new Set(["access-0"])),
    );

    const result = await channel.send({ externalUserId: "u1", text: "hi" });
    expect(result).toMatchObject({
      ok: false,
      code: "NOT_CONFIGURED",
      retryable: true,
    });
    expect(sent).toHaveLength(1);
  });

  it("reports not connected without calling Zalo", async () => {
    sent.length = 0;
    const store = new MemoryStore();
    const { refresh } = scriptedRefresh([]);
    const channel = createZaloChannel(
      provider(store, refresh),
      senderRejecting(new Set()),
    );
    const result = await channel.send({ externalUserId: "u1", text: "hi" });
    expect(result).toMatchObject({
      ok: false,
      code: "NOT_CONFIGURED",
      retryable: true,
    });
    expect(sent).toHaveLength(0);
  });
});
