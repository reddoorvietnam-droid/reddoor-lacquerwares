import "server-only";

import { isLoopbackHostname } from "@/lib/seo/site-url-guard";
import { absoluteUrl, getSiteUrl } from "@/lib/seo/urls";

/**
 * IndexNow: tell Bing, Yandex, Naver, Seznam and Yep about a public URL the
 * moment it changes, instead of waiting for a recrawl of a site with almost
 * no inbound links. One submission fans out to every participating engine;
 * Google does not take part.
 *
 * Protocol (https://www.indexnow.org/documentation): the site proves it owns
 * the host with a text file at `https://<host>/<key>.txt` whose body is the
 * key, then POSTs `{ host, key, keyLocation, urlList }` (at most 10,000 URLs)
 * to the shared endpoint. 200 and 202 mean accepted; 403 is a key the engine
 * could not verify, 422 a URL that is not on `host`, 429 a rate limit.
 *
 * The key file lives at the host root (`public/<key>.txt`) because a key file
 * only authorizes URLs beneath its own directory. `INDEXNOW_KEY` may override
 * the committed key, but then the committed file must be replaced as well:
 * before the first submission of a process this module fetches its own key
 * file and refuses to submit when the body is not exactly the key, so a
 * rotated variable can never turn into silent 403s.
 */

export const INDEXNOW_KEY_DEFAULT = "37bf5f5ad05844f99d4fab467b506df7";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

const URLS_PER_REQUEST = 10_000;
const REQUEST_TIMEOUT_MS = 10_000;

export function indexNowKey(): string {
  return process.env.INDEXNOW_KEY?.trim() || INDEXNOW_KEY_DEFAULT;
}

/** Root-relative path of the key file, the same on every host of the deployment. */
export function indexNowKeyFilePath(key = indexNowKey()): string {
  return `/${key}.txt`;
}

export type IndexNowOutcome =
  | {
      kind: "skipped";
      reason:
        | "no-paths"
        | "loopback-origin"
        | "no-valid-urls"
        | "key-file-unverified";
    }
  | { kind: "submitted"; urls: number }
  | { kind: "rejected"; urls: number; status: number }
  | { kind: "failed"; urls: number; error: string };

/** Key locations this process has already seen serving the right key. */
const verifiedKeyLocations = new Set<string>();

/** Forgets earlier key-file checks; for tests that change the origin or key. */
export function resetIndexNowKeyVerification(): void {
  verifiedKeyLocations.clear();
}

function describeStatus(status: number): string {
  switch (status) {
    case 400:
      return "the request body was malformed.";
    case 403:
      return "the engine could not verify the key file at keyLocation.";
    case 422:
      return "a URL is not on the submitted host, or the key is malformed.";
    case 429:
      return "rate limited; nothing is lost, the next change submits again.";
    default:
      return "unexpected response.";
  }
}

async function keyFileServesKey(
  keyLocation: string,
  key: string,
): Promise<boolean> {
  if (verifiedKeyLocations.has(keyLocation)) return true;

  try {
    const response = await fetch(keyLocation, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = response.status === 200 ? (await response.text()).trim() : "";
    if (response.status === 200 && body === key) {
      verifiedKeyLocations.add(keyLocation);
      return true;
    }
    console.warn(
      `[indexnow] ${keyLocation} answered ${response.status}` +
        (response.status === 200 ? " with a body that is not the key" : "") +
        "; skipping the submission. public/<key>.txt must contain exactly " +
        "the key that INDEXNOW_KEY (or the code default) names.",
    );
    return false;
  } catch (error) {
    console.warn("[indexnow] could not fetch the key file", {
      keyLocation,
      error,
    });
    return false;
  }
}

function uniqueAbsoluteUrls(paths: readonly string[], siteUrl: URL): string[] {
  const urls = new Set<string>();
  for (const path of paths) {
    try {
      urls.add(absoluteUrl(path, siteUrl));
    } catch (error) {
      console.warn("[indexnow] skipping a path that is not a public route", {
        path,
        error,
      });
    }
  }
  return [...urls];
}

/**
 * Submits the given site-relative paths (`/vi/news/slug`, `/en/shop`, ...) as
 * absolute URLs on the public origin. Never throws: a search-engine hiccup is
 * a warning in the log, not a failed publish. Does nothing when there is
 * nothing to submit or the origin is a loopback address, because a submission
 * for `localhost` is rejected with 422 and would only make noise.
 */
export async function submitToIndexNow(
  paths: readonly string[],
): Promise<IndexNowOutcome> {
  let urlCount = 0;
  try {
    if (paths.length === 0) return { kind: "skipped", reason: "no-paths" };

    const siteUrl = getSiteUrl();
    if (isLoopbackHostname(siteUrl.hostname)) {
      return { kind: "skipped", reason: "loopback-origin" };
    }

    const urlList = uniqueAbsoluteUrls(paths, siteUrl);
    urlCount = urlList.length;
    if (urlList.length === 0) {
      return { kind: "skipped", reason: "no-valid-urls" };
    }

    const key = indexNowKey();
    const keyLocation = absoluteUrl(indexNowKeyFilePath(key), siteUrl);
    if (!(await keyFileServesKey(keyLocation, key))) {
      return { kind: "skipped", reason: "key-file-unverified" };
    }

    for (let start = 0; start < urlList.length; start += URLS_PER_REQUEST) {
      const batch = urlList.slice(start, start + URLS_PER_REQUEST);
      const response = await fetch(INDEXNOW_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: siteUrl.host,
          key,
          keyLocation,
          urlList: batch,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.status !== 200 && response.status !== 202) {
        console.warn(
          `[indexnow] ${INDEXNOW_ENDPOINT} answered ${response.status} for ` +
            `${batch.length} URL(s) on ${siteUrl.host}: ` +
            describeStatus(response.status),
        );
        return {
          kind: "rejected",
          urls: batch.length,
          status: response.status,
        };
      }
    }

    return { kind: "submitted", urls: urlList.length };
  } catch (error) {
    console.warn("[indexnow] submission failed", error);
    return {
      kind: "failed",
      urls: urlCount,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Defers a submission until the response has gone out, through Next's
 * `after` handed in by the caller (this module stays free of `next/server`
 * so scripts and tests can import it). The editor's request never waits on a
 * search-engine round trip, and nothing the submission does can surface as a
 * publish failure. Outside a request scope, where `after` throws, the
 * submission simply runs right away.
 */
export function scheduleIndexNowSubmission(
  paths: readonly string[],
  schedule: (task: () => Promise<void>) => void,
): void {
  const task = async (): Promise<void> => {
    try {
      await submitToIndexNow(paths);
    } catch (error) {
      console.error("[indexnow] deferred submission failed", error);
    }
  };

  try {
    schedule(task);
  } catch (error) {
    console.warn("[indexnow] could not defer the submission; running it now", {
      error,
    });
    void task();
  }
}
