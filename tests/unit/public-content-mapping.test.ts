import { describe, expect, it } from "vitest";

import { BRAND_COPY, BRAND_DISPLAY_NAME } from "@/domains/content/brand-copy";
import { demoContentRepository } from "@/domains/content/demo-repository";
import { locales } from "@/lib/i18n/config";
import { toPublicSocialLinks } from "@/lib/public/published-mapping";

describe("published social links", () => {
  it("keeps every profile platform, X and TikTok included", () => {
    const links = toPublicSocialLinks([
      {
        platform: "youtube",
        label: "YouTube",
        url: "https://www.youtube.com/@REDDOOR-VN",
      },
      { platform: "x", label: "X", url: "https://x.com/reddoor" },
      {
        platform: "tiktok",
        label: "TikTok",
        url: "https://www.tiktok.com/@reddoor",
      },
    ]);

    expect(links.map((link) => link.platform)).toEqual([
      "youtube",
      "x",
      "tiktok",
    ]);
    expect(links[0]).toEqual({
      id: "social-youtube-0",
      platform: "youtube",
      label: "YouTube",
      href: "https://www.youtube.com/@REDDOOR-VN",
      isDemo: false,
    });
  });

  it("normalises the platform spelling the admin typed", () => {
    const links = toPublicSocialLinks([
      { platform: "  X ", label: "X", url: "https://x.com/reddoor" },
    ]);

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ id: "social-x-0", platform: "x" });
  });

  it("drops chat links and anything that is not an https URL", () => {
    const links = toPublicSocialLinks([
      {
        platform: "whatsapp",
        label: "WhatsApp",
        url: "https://wa.me/84903498889",
      },
      {
        platform: "facebook",
        label: "Facebook",
        url: "http://facebook.com/reddoor",
      },
      { platform: "instagram", label: "Instagram", url: "javascript:alert(1)" },
      { platform: "linkedin", label: "LinkedIn", url: "not a url" },
      {
        platform: "pinterest",
        label: "Pinterest",
        url: " https://www.pinterest.com/reddoor/ ",
      },
    ]);

    expect(links.map((link) => link.href)).toEqual([
      "https://www.pinterest.com/reddoor/",
    ]);
    // The id keeps the position in the published list, not in the output.
    expect(links[0]?.id).toBe("social-pinterest-4");
  });

  it("returns nothing for an unpublished settings document", () => {
    expect(toPublicSocialLinks([])).toEqual([]);
  });
});

describe("brand copy", () => {
  it("gives every locale its own eyebrow and tagline, shared with the demo snapshot", async () => {
    for (const locale of locales) {
      const copy = BRAND_COPY[locale];
      expect(copy.eyebrow.trim().length).toBeGreaterThan(0);
      expect(copy.tagline.trim().length).toBeGreaterThan(0);

      const company = await demoContentRepository.getCompany(locale);
      expect(company.eyebrow).toBe(copy.eyebrow);
      expect(company.tagline).toBe(copy.tagline);
    }

    // The Vietnamese line must not leak onto the other five markets.
    expect(BRAND_COPY.vi.eyebrow).toBe("Nghệ thuật sơn mài Việt Nam");
    expect(BRAND_COPY.en.eyebrow).toBe("Handcrafted lacquer · Hanoi");
    expect(BRAND_COPY.en.tagline).toBe("Vietnamese handcrafted lacquer");
    for (const locale of locales.filter((candidate) => candidate !== "vi")) {
      expect(BRAND_COPY[locale].eyebrow).not.toContain("sơn mài");
      expect(BRAND_COPY[locale].tagline).not.toContain("sơn mài");
    }
    expect(BRAND_DISPLAY_NAME).toBe("RED DOOR VIET NAM");
  });
});
