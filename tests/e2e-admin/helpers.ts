import { readFileSync } from "node:fs";

import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { roleSessionFile, type RoleKey } from "./role-session-file";

export type { RoleKey } from "./role-session-file";

/**
 * Signs a page in as one of the six roles. Sign-in is Gmail only, so there is
 * no role button to press: the global setup provisions one internal account
 * per role (`<role>@e2e.reddoor.local`) and leaves the session cookie a Google
 * sign-in would have set. The page then opens the portal overview and waits
 * for the role-filtered sidebar, which only renders for a granted session.
 */
const baseURL = process.env.E2E_ADMIN_BASE_URL ?? "http://localhost:3000";
let sessions: Partial<Record<RoleKey, string>> | null = null;

export function sessionTokenFor(role: RoleKey): string {
  sessions ??= JSON.parse(readFileSync(roleSessionFile, "utf8")) as Partial<
    Record<RoleKey, string>
  >;
  const token = sessions[role];
  if (!token) {
    throw new Error(
      `No E2E session for ${role}: the global setup did not run.`,
    );
  }
  return token;
}

export async function signInAs(page: Page, role: RoleKey): Promise<void> {
  const context = page.context();
  await context.clearCookies();
  await context.addCookies([
    {
      name: "next-auth.session-token",
      value: sessionTokenFor(role),
      url: baseURL,
    },
  ]);
  await page.goto("/vi/admin", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("navigation", {
      name: /Điều hướng quản trị|Administration navigation/,
    }),
  ).toBeVisible({ timeout: 90_000 });
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
