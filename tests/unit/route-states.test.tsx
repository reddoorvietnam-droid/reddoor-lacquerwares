import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/vi" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

import LocaleError from "@/app/[locale]/error";
import LocaleNotFound from "@/app/[locale]/not-found";

describe("localized route states", () => {
  beforeEach(() => {
    navigation.pathname = "/vi";
  });

  it("renders a localized 404 and returns to the active locale home", () => {
    navigation.pathname = "/fr/products/introuvable";

    const markup = renderToStaticMarkup(<LocaleNotFound />);

    expect(markup).toContain("Cette porte ne s’ouvre pas");
    expect(markup).toContain('href="/fr"');
    expect(markup).toContain('aria-labelledby="not-found-title"');
  });

  it("renders safe localized recovery copy and an accessible alert", () => {
    navigation.pathname = "/de/news";

    const markup = renderToStaticMarkup(
      <LocaleError
        error={new Error("private failure detail")}
        retry={vi.fn()}
      />,
    );

    expect(markup).toContain("Diese Seite kann derzeit nicht angezeigt werden");
    expect(markup).toContain("Erneut versuchen");
    expect(markup).not.toContain("private failure detail");
    expect(markup).toContain('role="alert"');
  });
});
