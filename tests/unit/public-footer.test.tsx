import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

// Plain anchors: the assertions are about the hrefs the server HTML carries.
vi.mock("next/link", () => ({
  default: (props: ComponentProps<"a">) => <a {...props} />,
}));

// The wordmark's plaque is a statically imported JPEG with a blur
// placeholder, which next/image can only resolve inside a Next build.
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    ...props
  }: {
    src: string | { src: string };
    alt: string;
    [key: string]: unknown;
  }) => {
    const { preload, placeholder, fill, ...rest } = props;
    void preload;
    void placeholder;
    void fill;
    return (
      // eslint-disable-next-line @next/next/no-img-element -- test stand-in
      <img
        src={typeof src === "string" ? src : src.src}
        alt={alt}
        {...(rest as ComponentProps<"img">)}
      />
    );
  },
}));

import { PublicFooter } from "@/components/public/footer";

/**
 * HTML attribute names are case-insensitive; React's server renderer writes
 * `hrefLang` with its JSX casing, which browsers and crawlers read as
 * `hreflang`, so the lookups here ignore case too.
 */
function attributeValues(markup: string, attribute: string): string[] {
  return [...markup.matchAll(new RegExp(`${attribute}="([^"]*)"`, "gi"))].map(
    (match) => match[1] ?? "",
  );
}

describe("PublicFooter language links", () => {
  it("links every locale's home with crawlable anchors", async () => {
    const dictionary = await getDictionary("vi");
    const markup = renderToStaticMarkup(
      <PublicFooter
        locale="vi"
        dictionary={dictionary}
        brandName="RED DOOR VIET NAM"
        brandDescriptor="Lacquerware"
        addressLines={[]}
        contactLinks={[]}
        socialLinks={[]}
      />,
    );

    for (const href of ["/en", "/fr", "/de", "/ja", "/zh-CN"]) {
      expect(markup).toContain(`href="${href}"`);
    }
    expect(markup).toContain(`aria-label="${dictionary.common.language}"`);

    const hreflangs = attributeValues(markup, "hreflang");
    expect(hreflangs).toEqual([...locales]);
    expect(hreflangs).toContain("en");
  });

  it("marks only the active locale as the current page", async () => {
    const dictionary = await getDictionary("vi");
    const markup = renderToStaticMarkup(
      <PublicFooter
        locale="vi"
        dictionary={dictionary}
        brandName="RED DOOR VIET NAM"
      />,
    );

    const anchors = markup.match(/<a\b[^>]*hreflang="[^"]*"[^>]*>/gi) ?? [];
    expect(anchors).toHaveLength(locales.length);

    const current = anchors.filter((anchor) =>
      anchor.includes('aria-current="page"'),
    );
    expect(current).toHaveLength(1);
    expect(current[0]).toContain('href="/vi"');
    expect(current[0]).toMatch(/hreflang="vi"/i);
    expect(current[0]).toContain(' lang="vi"');
  });
});
