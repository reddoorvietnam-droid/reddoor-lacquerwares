import { expect, test, type Page } from "@playwright/test";

const publicLocales = ["vi", "en", "fr", "de", "ja", "zh-CN"] as const;

async function openLocaleSwitcher(page: Page) {
  const languageSwitcher = page.getByRole("combobox", { name: "Ngôn ngữ" });
  const viewport = page.viewportSize();

  if (!viewport || viewport.width >= 1280) {
    await expect(languageSwitcher).toBeVisible();
    return languageSwitcher;
  }

  const menuButton = page.locator('header button[aria-haspopup="dialog"]');
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(languageSwitcher).toBeVisible();
  return languageSwitcher;
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("redirects the root route and renders every supported locale", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/vi$/);

  for (const locale of publicLocales) {
    const response = await page.goto(`/${locale}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
  }
});

test("preserves the current public path and query when switching language", async ({
  page,
}) => {
  await page.goto("/vi/products?sort=name");

  const localeSwitcher = await openLocaleSwitcher(page);
  await localeSwitcher.selectOption("en");

  await expect(page).toHaveURL(/\/en\/products\?sort=name$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Products" }),
  ).toBeVisible();
});

test("moves from a product to its quote request", async ({ page }) => {
  await page.goto("/en/products");

  const productLink = page.locator("main article h2 a").first();
  await expect(productLink).toBeVisible();
  await productLink.click();
  await expect(page).toHaveURL(/\/en\/products\/[a-z0-9-]+$/);

  const quoteLink = page
    .locator('main a[href*="/en/contact#request-quote"]')
    .first();
  await expect(quoteLink).toBeVisible();
  await quoteLink.click();

  await expect(page).toHaveURL(/\/en\/contact#request-quote$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Contact and quote request" }),
  ).toBeVisible();
  await expect(page.locator("#request-quote")).toBeVisible();
});

test("has no unintended horizontal overflow at acceptance widths", async ({
  page,
}) => {
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/en");
    await expect(page.locator("main h1")).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(
      dimensions.scrollWidth,
      `Unexpected horizontal overflow at ${width}px`,
    ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  }
});

test("restores keyboard focus after closing the mobile navigation", async ({
  page,
}) => {
  test.skip(
    (page.viewportSize()?.width ?? 1280) >= 1280,
    "The drawer is only rendered at mobile and tablet breakpoints.",
  );

  await page.goto("/en");
  const menuButton = page.getByRole("button", { name: "Open menu" });
  await menuButton.focus();
  await page.keyboard.press("Enter");

  const menuDialog = page.getByRole("dialog", { name: "Open menu" });
  await expect(menuDialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(menuDialog).not.toBeVisible();
  await expect(menuButton).toBeFocused();
});

test("shows the door intro once per session and provides a skip control", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/en");
  await page.evaluate(() => window.sessionStorage.clear());
  await page.reload();

  const intro = page.getByRole("dialog", {
    name: /Red Door Vietnam/i,
  });
  await expect(intro).toBeVisible();
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(intro).not.toBeVisible();

  await page.reload();
  await expect(intro).not.toBeVisible();
});
