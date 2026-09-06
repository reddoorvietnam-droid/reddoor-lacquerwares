import { expect, type Page, type APIRequestContext } from "@playwright/test";

/**
 * Dev-preview sign-in: the sign-in page lists one button per role with the
 * account username in a `span.font-mono`. Clicking before hydration is a
 * known hazard, so the click is retried until the button disables (sign-in
 * in flight) and the portal URL appears.
 */
export const roleUsernames = {
  DIRECTOR: "admin",
  COMPANY_ACCOUNTANT: "company_accountant",
  FACTORY_ACCOUNTANT: "factory_accountant",
  FACTORY_MANAGER: "factory_manager",
  WAREHOUSE_MANAGER: "warehouse_manager",
  CONTENT_CREATOR: "content_creator",
} as const;

export type RoleKey = keyof typeof roleUsernames;

export async function signInAs(page: Page, role: RoleKey): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/vi/admin/sign-in", { waitUntil: "domcontentloaded" });
  const button = page
    .locator("button", {
      has: page.locator("span.font-mono", {
        hasText: new RegExp(`^${roleUsernames[role]}$`),
      }),
    })
    .first();
  await expect(button).toBeVisible();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await button.click();
    await page.waitForTimeout(700);
    if (await button.isDisabled().catch(() => true)) break;
  }
  // The sign-in page also lives under /vi/admin, so wait for the portal
  // overview itself (no `/sign-in` segment) and for the role-filtered
  // sidebar, which only renders for a signed-in, granted session.
  await page.waitForURL(
    (url) => /\/vi\/admin\/?(?:\?.*)?$/.test(url.pathname + url.search),
    {
      timeout: 60_000,
    },
  );
  await expect(
    page.getByRole("navigation", {
      name: /Điều hướng quản trị|Administration navigation/,
    }),
  ).toBeVisible();
}

export const fixtureOrderCode =
  process.env.E2E_AI_ORDER_CODE ?? "RD-20260906-E2E1";

export async function chat(
  request: APIRequestContext,
  message: string,
  history: { role: "user" | "assistant"; text: string }[] = [],
) {
  const response = await request.post("/api/assistant/chat", {
    data: { message, history, locale: "vi" },
  });
  return {
    status: response.status(),
    body: await response.json().catch(() => null),
  };
}

/** Sends a chat message through the UI and waits for the assistant turn. */
export async function ask(page: Page, message: string): Promise<string> {
  const before = await page.locator('ol[aria-live="polite"] > li').count();
  await page.locator("#assistant-input").fill(message);
  await page.getByRole("button", { name: /^(Gửi|Send)$/ }).click();
  const turns = page.locator('ol[aria-live="polite"] > li');
  await expect(turns).toHaveCount(before + 2, { timeout: 90_000 });
  return (await turns.nth(before + 1).innerText()).replace(/\s+/g, " ").trim();
}
