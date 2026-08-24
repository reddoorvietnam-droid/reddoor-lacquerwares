"use client";

import { useState, useSyncExternalStore } from "react";

import type { PublicDictionary } from "@/lib/i18n/dictionary";

export interface NewsShareLinks {
  email: string;
  facebook: string;
  linkedIn: string;
}

export function buildNewsShareLinks(
  articleUrl: string,
  articleTitle: string,
): NewsShareLinks {
  const facebookUrl = new URL("https://www.facebook.com/sharer/sharer.php");
  facebookUrl.searchParams.set("u", articleUrl);

  const linkedInUrl = new URL(
    "https://www.linkedin.com/sharing/share-offsite/",
  );
  linkedInUrl.searchParams.set("url", articleUrl);

  const emailParameters = new URLSearchParams({
    subject: articleTitle,
    body: articleUrl,
  });

  return {
    email: `mailto:?${emailParameters.toString()}`,
    facebook: facebookUrl.toString(),
    linkedIn: linkedInUrl.toString(),
  };
}

interface NewsShareActionsProps {
  dictionary: PublicDictionary;
  title: string;
}

type CopyStatus = "idle" | "copied" | "failed";

function subscribeToLocation(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("hashchange", onStoreChange);

  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("hashchange", onStoreChange);
  };
}

function readCurrentUrl() {
  const url = new URL(window.location.href);
  url.hash = "";
  return url.toString();
}

function readServerUrl() {
  return "";
}

export function NewsShareActions({ dictionary, title }: NewsShareActionsProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const currentUrl = useSyncExternalStore(
    subscribeToLocation,
    readCurrentUrl,
    readServerUrl,
  );

  const links = currentUrl ? buildNewsShareLinks(currentUrl, title) : null;

  async function copyLink() {
    if (!currentUrl || !navigator.clipboard?.writeText) {
      setCopyStatus("failed");
      return;
    }

    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  async function shareLink() {
    if (!currentUrl) return;

    if (!navigator.share) {
      await copyLink();
      return;
    }

    try {
      await navigator.share({ title, url: currentUrl });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setCopyStatus("failed");
      }
    }
  }

  const actionClassName =
    "border-burgundy/16 text-burgundy hover:border-lacquer hover:bg-lacquer inline-flex min-h-11 items-center rounded-full border bg-white/55 px-4 py-2.5 text-sm font-semibold transition hover:text-white disabled:cursor-wait disabled:opacity-45";

  return (
    <section
      className="border-burgundy/12 mt-12 border-t pt-8"
      aria-labelledby="article-share-title"
    >
      <h2
        id="article-share-title"
        className="text-burgundy font-serif text-2xl"
      >
        {dictionary.news.share}
      </h2>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!currentUrl}
          onClick={shareLink}
          className={actionClassName}
        >
          {dictionary.news.shareNative}
        </button>
        <button
          type="button"
          disabled={!currentUrl}
          onClick={copyLink}
          className={actionClassName}
        >
          {dictionary.news.copyLink}
        </button>
        {links ? (
          <>
            <a
              href={links.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className={actionClassName}
            >
              {dictionary.news.shareFacebook}
            </a>
            <a
              href={links.linkedIn}
              target="_blank"
              rel="noopener noreferrer"
              className={actionClassName}
            >
              {dictionary.news.shareLinkedIn}
            </a>
            <a href={links.email} className={actionClassName}>
              {dictionary.news.shareEmail}
            </a>
          </>
        ) : null}
      </div>
      {copyStatus !== "idle" ? (
        <p className="text-charcoal/64 mt-4 text-sm" role="status">
          {copyStatus === "copied"
            ? dictionary.news.copySuccess
            : dictionary.news.copyFailed}
        </p>
      ) : null}
    </section>
  );
}
