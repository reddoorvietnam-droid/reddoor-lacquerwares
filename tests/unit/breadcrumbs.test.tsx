import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Breadcrumbs } from "@/components/public/pages/shared";

const items = [
  { href: "/en", label: "Home" },
  { href: "/en/shop", label: "Shop" },
  { href: "/en/shop/red-lacquer-tray", label: "Red lacquer tray" },
] as const;

describe("Breadcrumbs", () => {
  it("links every ancestor and marks the leaf as the current page", () => {
    const markup = renderToStaticMarkup(
      <Breadcrumbs items={items} label="Breadcrumb" />,
    );

    expect(markup).toContain('<nav aria-label="Breadcrumb"');
    expect(markup).toContain("<ol");

    const anchors = markup.match(/<a\b[^>]*href="([^"]*)"[^>]*>/g) ?? [];
    expect(anchors).toHaveLength(2);
    expect(anchors[0]).toContain('href="/en"');
    expect(anchors[1]).toContain('href="/en/shop"');
    expect(markup).not.toContain('href="/en/shop/red-lacquer-tray"');

    const current = markup.match(
      /<span aria-current="page"[^>]*>[^<]*<\/span>/g,
    );
    expect(current).toHaveLength(1);
    expect(current?.[0]).toContain("Red lacquer tray");
  });

  it("renders the labels in order", () => {
    const markup = renderToStaticMarkup(
      <Breadcrumbs items={items} label="Fil d'Ariane" />,
    );

    const home = markup.indexOf("Home");
    const shop = markup.indexOf("Shop");
    const leaf = markup.indexOf("Red lacquer tray");
    expect(home).toBeGreaterThan(-1);
    expect(shop).toBeGreaterThan(home);
    expect(leaf).toBeGreaterThan(shop);
  });
});
