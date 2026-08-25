import { expect, test, type Page } from "@playwright/test";

const publicLocales = ["vi", "en", "fr", "de", "ja", "zh-CN"] as const;

/**
 * The language control is a listbox rather than a native select, because a
 * native option cannot render a flag. Below the desktop breakpoint it lives
 * inside the mobile drawer.
 */
async function revealLocaleTrigger(page: Page) {
  const trigger = page.getByRole("button", { name: /Ngôn ngữ/ });
  const viewport = page.viewportSize();

  if (viewport && viewport.width < 1280) {
    const menuButton = page.locator('header button[aria-haspopup="dialog"]');
    await expect(menuButton).toBeVisible();
    await menuButton.click();
  }

  await expect(trigger).toBeVisible();
  return trigger;
}

async function openLocaleSwitcher(page: Page) {
  const trigger = await revealLocaleTrigger(page);
  await trigger.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  return trigger;
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

  await openLocaleSwitcher(page);
  await page.getByRole("option", { name: "English" }).click();

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

test("drives the language listbox entirely from the keyboard", async ({
  page,
}) => {
  await page.goto("/vi");

  const trigger = await revealLocaleTrigger(page);
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toBeVisible();

  // Escape must close the list and hand focus back to the trigger, otherwise a
  // keyboard user is stranded.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { name: "English" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/en$/);
});

test("names every language in text beside its flag", async ({ page }) => {
  await page.goto("/vi");
  await openLocaleSwitcher(page);

  // A flag identifies a country, not a language, so the name must be present.
  for (const name of [
    "Tiếng Việt",
    "English",
    "Français",
    "Deutsch",
    "日本語",
    "简体中文",
  ]) {
    await expect(page.getByRole("option", { name })).toBeVisible();
  }
});
