import type {
  ZaloCredentialDto,
  ZaloCredentialStore,
} from "@/domains/notifications/contracts";
import {
  ZALO_REFRESH_TOKEN_LIFETIME_MS,
  type ZaloRefreshResult,
  type ZaloTokenPair,
} from "@/lib/zalo/oauth";

/**
 * Keeps the Zalo OA access token alive without anyone touching anything.
 *
 * Zalo's access token expires after about 25 hours and the refresh token
 * that renews it is single-use, replaced on every renewal. So the current
 * pair lives in the database: it arrives once through the "Connect Zalo"
 * consent on the settings page, and from then on the platform renews
 * ahead of expiry — on every reminder run, and on demand when a send is
 * rejected for a bad token. Every renewal also issues a refresh token
 * good for another three months, so a platform that keeps running never
 * needs a second consent.
 *
 * Rules the provider enforces:
 * - A renewal is a compare-and-set on the refresh token it spent. Two
 *   workers renewing at once cannot both win; the loser reads the winner's
 *   row. Inside one process, concurrent callers share a single in-flight
 *   renewal.
 * - A failed renewal never discards a token that is still valid; the
 *   failure is recorded for the settings page and the send goes ahead
 *   with the current token until it really expires.
 * - The environment holds only the app id and app secret key. No token.
 */

const defaultRefreshMarginMs = 2 * 60 * 60 * 1000;
/** Warn this long before the refresh token's documented lifetime ends. */
const refreshTokenWarningMs = 10 * 24 * 60 * 60 * 1000;

export type ZaloTokenOutcome =
  { ok: true; accessToken: string } | { ok: false; message: string };

export type ZaloTokenStatus = {
  state: "not_connected" | "ok" | "renewal_failed" | "expired";
  connectedAt: Date | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  /** True when the refresh token is close to the end of its 3-month life. */
  refreshTokenAging: boolean;
  lastRefreshAt: Date | null;
  lastRefreshError: string | null;
  refreshCount: number;
};

export type ZaloTokenProviderDependencies = {
  store: ZaloCredentialStore;
  refresh: (input: {
    appId: string;
    appSecretKey: string;
    refreshToken: string;
  }) => Promise<ZaloRefreshResult>;
  credentials: { appId: string; appSecretKey: string };
  now?: () => Date;
  refreshMarginMs?: number;
  log?: (message: string) => void;
};

export const zaloNotConnectedMessage =
  "Zalo OA is not connected. Open Settings and press Connect Zalo.";

export class ZaloTokenProvider {
  private inflight: Promise<ZaloTokenOutcome> | null = null;

  constructor(private readonly dependencies: ZaloTokenProviderDependencies) {}

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private get margin(): number {
    return this.dependencies.refreshMarginMs ?? defaultRefreshMarginMs;
  }

  /** Valid for long enough that no renewal is needed yet. */
  private fresh(row: ZaloCredentialDto, at: Date): boolean {
    return row.accessTokenExpiresAt.getTime() - at.getTime() > this.margin;
  }

  /** Not yet expired, so still worth sending with even if renewal failed. */
  private stillValid(row: ZaloCredentialDto, at: Date): boolean {
    return row.accessTokenExpiresAt.getTime() > at.getTime();
  }

  /** Stores the pair obtained from the consent flow, replacing any earlier one. */
  async connect(
    pair: ZaloTokenPair,
    connectedByUserId: string | null,
  ): Promise<ZaloCredentialDto> {
    const at = this.now();
    const row = await this.dependencies.store.replace({
      accessToken: pair.accessToken,
      accessTokenExpiresAt: new Date(
        at.getTime() + pair.expiresInSeconds * 1000,
      ),
      refreshToken: pair.refreshToken,
      connectedByUserId,
      at,
    });
    this.dependencies.log?.("[zalo] OA connected");
    return row;
  }

  /**
   * The access token to send with. Renews first when the stored one is
   * within the margin of expiry, or when `rejectedAccessToken` names the
   * token a send was just refused with.
   */
  async getAccessToken(options?: {
    rejectedAccessToken?: string;
  }): Promise<ZaloTokenOutcome> {
    const row = await this.dependencies.store.load();
    if (!row) return { ok: false, message: zaloNotConnectedMessage };
    const at = this.now();
    const rejected = options?.rejectedAccessToken;
    if (this.fresh(row, at) && (!rejected || rejected !== row.accessToken)) {
      return { ok: true, accessToken: row.accessToken };
    }
    if (!this.inflight) {
      this.inflight = this.renew(row).finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
  }

  /** Renews when due and reports; the reminder run calls this first. */
  async ensureFresh(): Promise<ZaloTokenOutcome> {
    return this.getAccessToken();
  }

  private async renew(seen: ZaloCredentialDto): Promise<ZaloTokenOutcome> {
    const { store, refresh, credentials, log } = this.dependencies;
    const result = await refresh({
      appId: credentials.appId,
      appSecretKey: credentials.appSecretKey,
      refreshToken: seen.refreshToken,
    });
    const at = this.now();

    if (result.ok) {
      const saved = await store.saveRefreshed({
        expectedRefreshToken: seen.refreshToken,
        accessToken: result.accessToken,
        accessTokenExpiresAt: new Date(
          at.getTime() + result.expiresInSeconds * 1000,
        ),
        refreshToken: result.refreshToken,
        at,
      });
      if (saved) {
        log?.("[zalo] access token renewed");
        return { ok: true, accessToken: result.accessToken };
      }
      // Another worker spent the same refresh token first and won the
      // compare-and-set; its row is the truth now.
      return this.fallback(seen, at, "renewal raced with another worker");
    }

    await store.recordRefreshFailure({
      expectedRefreshToken: seen.refreshToken,
      message: result.message,
      at,
    });
    log?.(`[zalo] token renewal failed: ${result.message}`);
    return this.fallback(seen, at, result.message);
  }

  private async fallback(
    seen: ZaloCredentialDto,
    at: Date,
    reason: string,
  ): Promise<ZaloTokenOutcome> {
    const latest = (await this.dependencies.store.load()) ?? seen;
    if (this.stillValid(latest, at)) {
      return { ok: true, accessToken: latest.accessToken };
    }
    return {
      ok: false,
      message: `Zalo access token unavailable (${reason}). Reconnect Zalo from Settings.`,
    };
  }

  /** Read-only view for the settings page; never calls Zalo. */
  async status(): Promise<ZaloTokenStatus> {
    const stored = await this.dependencies.store.load();
    const at = this.now();
    if (!stored) {
      return {
        state: "not_connected",
        connectedAt: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        refreshTokenAging: false,
        lastRefreshAt: null,
        lastRefreshError: null,
        refreshCount: 0,
      };
    }
    const refreshTokenExpiresAt = new Date(
      stored.refreshTokenIssuedAt.getTime() + ZALO_REFRESH_TOKEN_LIFETIME_MS,
    );
    const state: ZaloTokenStatus["state"] = !this.stillValid(stored, at)
      ? "expired"
      : stored.lastRefreshError
        ? "renewal_failed"
        : "ok";
    return {
      state,
      connectedAt: stored.connectedAt,
      accessTokenExpiresAt: stored.accessTokenExpiresAt,
      refreshTokenExpiresAt,
      refreshTokenAging:
        refreshTokenExpiresAt.getTime() - at.getTime() < refreshTokenWarningMs,
      lastRefreshAt: stored.lastRefreshAt,
      lastRefreshError: stored.lastRefreshError,
      refreshCount: stored.refreshCount,
    };
  }
}
