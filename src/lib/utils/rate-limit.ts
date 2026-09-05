/**
 * Fixed-window rate limiter kept in process memory.
 *
 * Enough for a guest order form on a single instance: it stops a script from
 * flooding the inbox, and it needs no extra infrastructure. It is not shared
 * across instances and resets on restart — acceptable for the shop form,
 * where the honeypot and validation catch the rest.
 */

type Window = { count: number; resetAt: number };

const store =
  (
    globalThis as typeof globalThis & {
      __reddoorRateLimit?: Map<string, Window>;
    }
  ).__reddoorRateLimit ?? new Map<string, Window>();

(
  globalThis as typeof globalThis & { __reddoorRateLimit?: Map<string, Window> }
).__reddoorRateLimit = store;

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterMs: number };

export function consumeRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
  now: number = Date.now(),
): RateLimitResult {
  // Opportunistic sweep so the map cannot grow without bound.
  if (store.size > 5_000) {
    for (const [entryKey, window] of store) {
      if (window.resetAt <= now) store.delete(entryKey);
    }
  }

  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.limit - 1 };
  }

  if (current.count >= options.limit) {
    return { allowed: false, retryAfterMs: current.resetAt - now };
  }

  current.count += 1;
  return { allowed: true, remaining: options.limit - current.count };
}
