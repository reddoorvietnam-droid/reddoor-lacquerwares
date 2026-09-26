/**
 * Push every URL in the public sitemap to IndexNow in one batch.
 *
 * Run it once right after a production deploy that serves the real origin,
 * and again after any large change to the URL set (a new locale, a mass
 * rename). Day-to-day changes need no script: publishing an article, a
 * product, a collection or a shop item submits its own URLs from the
 * post-commit hooks in src/domains/{news,products,collections,shop}/runtime.ts.
 *
 *   npm run seo:indexnow
 *   npm run seo:indexnow -- --site-url https://reddoor.vn
 *   npm run seo:indexnow -- --sitemap-url https://reddoor.vn/sitemap.xml
 *
 * The origin comes from NEXT_PUBLIC_SITE_URL in .env unless --site-url says
 * otherwise. A loopback origin is refused: IndexNow would answer 422 for
 * localhost URLs, and nobody can verify a key file on your laptop.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  indexNowKey,
  indexNowKeyFilePath,
  submitToIndexNow,
} from "@/lib/seo/indexnow";
import { isLoopbackHostname } from "@/lib/seo/site-url-guard";
import { getSiteUrl } from "@/lib/seo/urls";

function fail(message: string): never {
  console.error(`[indexnow] ${message}`);
  process.exit(1);
}

function optionValue(
  argv: readonly string[],
  name: string,
): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${name} needs a value.`);
  return value;
}

const xmlEntities: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodeXml(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => {
    return xmlEntities[entity] ?? entity;
  });
}

/** Every `<loc>` of the document; `<image:loc>` and friends do not match. */
function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) =>
    decodeXml(match[1] ?? ""),
  );
}

async function fetchXml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: "application/xml, text/xml" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    fail(`${url} answered ${response.status}; is the deploy live?`);
  }
  return response.text();
}

/** URLs of every page, following a sitemap index when the site has one. */
async function sitemapUrls(sitemapUrl: string): Promise<string[]> {
  const xml = await fetchXml(sitemapUrl);
  if (!/<sitemapindex[\s>]/.test(xml)) return extractLocs(xml);

  const pages: string[] = [];
  for (const child of extractLocs(xml)) {
    pages.push(...extractLocs(await fetchXml(child)));
  }
  return pages;
}

async function assertKeyFileCommitted(key: string): Promise<void> {
  const keyFile = path.resolve(
    process.cwd(),
    "public",
    indexNowKeyFilePath(key).slice(1),
  );
  let body: string;
  try {
    body = await readFile(keyFile, "utf8");
  } catch {
    fail(
      `${keyFile} is missing. The key file must be committed at the site ` +
        `root with the key as its only content; INDEXNOW_KEY currently ` +
        `resolves to "${key}".`,
    );
  }
  if (body.trim() !== key) {
    fail(
      `${keyFile} does not contain the key "${key}" that INDEXNOW_KEY (or ` +
        "the code default) names. Fix the file or the variable so they match.",
    );
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  const siteUrlOverride = optionValue(argv, "--site-url");
  if (siteUrlOverride) process.env.NEXT_PUBLIC_SITE_URL = siteUrlOverride;

  const key = indexNowKey();
  await assertKeyFileCommitted(key);

  const siteUrl = getSiteUrl();
  if (isLoopbackHostname(siteUrl.hostname)) {
    fail(
      `the site URL resolves to ${siteUrl.origin}, a loopback address. ` +
        "Search engines cannot reach it and IndexNow rejects it. Set " +
        "NEXT_PUBLIC_SITE_URL to the public https origin (https://reddoor.vn) " +
        "or pass --site-url https://reddoor.vn.",
    );
  }

  const sitemapUrl =
    optionValue(argv, "--sitemap-url") ??
    new URL("/sitemap.xml", siteUrl).toString();

  const locs = await sitemapUrls(sitemapUrl);
  if (locs.length === 0) fail(`${sitemapUrl} lists no <loc> entries.`);

  const paths: string[] = [];
  let foreignHosts = 0;
  for (const loc of locs) {
    const url = new URL(loc);
    if (url.host !== siteUrl.host) foreignHosts += 1;
    paths.push(url.pathname);
  }
  if (foreignHosts > 0) {
    console.warn(
      `[indexnow] ${foreignHosts} of ${locs.length} sitemap URLs point at ` +
        `another host than ${siteUrl.host}; their paths are submitted on ` +
        `${siteUrl.host}. Check NEXT_PUBLIC_SITE_URL on the deployment.`,
    );
  }

  console.log(
    `[indexnow] ${locs.length} URL(s) in ${sitemapUrl}; submitting on ` +
      `${siteUrl.host} with key ${key}.`,
  );

  const outcome = await submitToIndexNow(paths);
  switch (outcome.kind) {
    case "submitted":
      console.log(
        `[indexnow] accepted ${outcome.urls} URL(s) for ${siteUrl.host}.`,
      );
      return;
    case "rejected":
      fail(`IndexNow answered ${outcome.status}; nothing was accepted.`);
      break;
    case "skipped":
      fail(`nothing was submitted (${outcome.reason}); see the warning above.`);
      break;
    case "failed":
      fail(`the submission failed: ${outcome.error}`);
      break;
  }
}

main().catch((error) => {
  console.error("[indexnow] unexpected failure", error);
  process.exit(1);
});
