import { describe, expect, it } from "vitest";

import { buildNewsShareLinks } from "@/components/public/pages/news-share-actions";
import { locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  getDemoAboutHistoryPageData,
  getDemoContactRequestQuotePageData,
} from "@/lib/public/demo-page-data";

describe("Phase 1 public content safeguards", () => {
  it("fills About media features and principles with localized copy", async () => {
    for (const locale of locales) {
      const dictionary = await getDictionary(locale);
      const page = await getDemoAboutHistoryPageData(locale, dictionary);

      expect(page.mediaFeatures).toHaveLength(2);
      expect(page.principles).toHaveLength(3);
      expect(
        page.principles.every((principle) => principle.media !== null),
      ).toBe(true);
      expect(page.principles.map((principle) => principle.title)).toEqual([
        dictionary.about.pillarCraftTitle,
        dictionary.about.pillarMaterialTitle,
        dictionary.about.pillarStandardTitle,
      ]);
      // The timeline stands on published milestones alone; no advisory note.
      expect(page.archiveNote).toBeNull();
    }
  });

  it("provides localized country choices and a click-to-load, locale-matched map", async () => {
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
      // The map is now a verified place rather than a missing one, so the
      // assertion moved from "there is none" to "it is the safe kind":
      // keyless embed, no tracking parameters carried over from the pasted
      // browser URL, and labelled in the visitor's own language.
      const embedUrl = page.map.embedUrl;
      expect(embedUrl).not.toBeNull();
      const embed = new URL(embedUrl ?? "");
      expect(embed.host).toBe("maps.google.com");
      expect(embed.searchParams.get("output")).toBe("embed");
      expect(embed.searchParams.get("hl")).toBe(locale);
      expect(embed.searchParams.has("entry")).toBe(false);
      expect(embed.searchParams.has("g_ep")).toBe(false);

      // The outward link opens the company's own listing, and only over https.
      const placeUrl = page.map.placeUrl;
      expect(placeUrl).not.toBeNull();
      expect(new URL(placeUrl ?? "").protocol).toBe("https:");
      expect(page.map.placeLinkLabel).toBe(dictionary.contact.openInMaps);

      // The frame is still never loaded until the visitor asks for it, so the
      // unavailable message must stay wired up.
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
