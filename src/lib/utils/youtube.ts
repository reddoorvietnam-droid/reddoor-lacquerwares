/**
 * Extracts the video id from any of YouTube's link shapes (watch, youtu.be,
 * shorts, embed). Returns null for anything else — an unrecognized link must
 * not become a broken player.
 */
export function extractYouTubeId(href: string): string | null {
  try {
    const url = new URL(href);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return id && /^[\w-]{6,20}$/.test(id) ? id : null;
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      const fromQuery = url.searchParams.get("v");
      if (fromQuery && /^[\w-]{6,20}$/.test(fromQuery)) return fromQuery;
      const match = url.pathname.match(/^\/(?:embed|shorts|v)\/([\w-]{6,20})/);
      return match?.[1] ?? null;
    }

    return null;
  } catch {
    return null;
  }
}
