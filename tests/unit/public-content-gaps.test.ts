import { describe, expect, it } from "vitest";

import { buildNewsShareLinks } from "@/components/public/pages/news-share-actions";
import { locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  getDemoAboutHistoryPageData,
  getDemoContactRequestQuotePageData,
} from "@/lib/public/demo-page-data";

describe("Phase 1 public content safeguards", () => {
  it("fills About highlights and principles with localized DEMO-safe copy", async () => {
    for (const locale of locales) {
      const dictionary = await getDictionary(locale);
      const page = await getDemoAboutHistoryPageData(locale, dictionary);

      expect(page.highlights).toHaveLength(3);
      expect(page.principles).toHaveLength(3);
      expect(
        page.principles.every((principle) => principle.media === null),
      ).toBe(true);
      expect(page.archiveNote).toBe(dictionary.about.archiveNotice);
    }
  });

  it("provides localized country choices without enabling unsafe uploads or maps", async () => {
    for (const locale of locales) {
      const dictionary = await getDictionary(locale);
      const page = await getDemoContactRequestQuotePageData(locale, dictionary);
      const optionValues = new Set(
        page.countryOptions.map((option) => option.value),
      );

      expect(optionValues).toEqual(
        new Set(["VN", "CN", "JP", "FR", "DE", "OTHER"]),
      );
      expect(page.acceptedAttachmentTypes).toBe(".pdf,.jpg,.jpeg,.png,.webp");
      expect(page.attachmentHelp).toBe(dictionary.contact.attachmentHelp);
      expect(page.map.embedUrl).toBeNull();
      expect(page.map.unavailableDescription).toBe(
        dictionary.contact.mapUnavailable,
      );
    }
  });

  it("encodes the current article URL as one share parameter", () => {
    const articleUrl =
      "https://example.test/vi/news/demo?q=lacquer&next=https://unsafe.test/#section";
    const title = "DEMO story & studio notes";
    const links = buildNewsShareLinks(articleUrl, title);

    expect(new URL(links.facebook).searchParams.get("u")).toBe(articleUrl);
    expect(new URL(links.linkedIn).searchParams.get("url")).toBe(articleUrl);
    expect(new URL(links.email).searchParams.get("subject")).toBe(title);
    expect(new URL(links.email).searchParams.get("body")).toBe(articleUrl);
  });
});
