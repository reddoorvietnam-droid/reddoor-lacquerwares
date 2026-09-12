import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers";

/**
 * Phone-sized checks (Pixel 5 project): the task list and the assistant
 * must be usable without horizontal scrolling, and a reminder-style deep
 * link must land on the right task after sign-in.
 */

async function noHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test("assigned-work page and assistant fit a phone and a deep link opens the task", async ({
  page,
}) => {
  // Deep link first: unauthenticated visit is redirected to sign-in.
  await page.goto("/vi/admin/my-tasks?status=all", {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(/\/vi\/admin\/sign-in/);

  await signInAs(page, "WAREHOUSE_MANAGER");
  await page.goto("/vi/admin/my-tasks?status=all", {
    waitUntil: "domcontentloaded",
  });
  const first = page.locator("li[id^='task-']").first();
  await expect(first).toBeVisible();
  await noHorizontalOverflow(page);

  const taskId = (await first.getAttribute("id"))!.replace("task-", "");
  await page.goto(`/vi/admin/my-tasks?task=${taskId}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(`#task-${taskId}`)).toHaveClass(/ring-gold/);

  await page.goto("/vi/admin/assistant", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#assistant-input")).toBeVisible();
  await noHorizontalOverflow(page);
});
