import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers";

/**
 * Handing work out and receiving it (built 2026-09-12).
 *
 * The Director assigns a task with a deadline on "Giao việc", the
 * storekeeper reads it on "Công việc được giao", asks for more time with a
 * reason, the Director answers from the queue, and the storekeeper marks it
 * done. The fixture task carries a timestamped title and is left finished,
 * so a rerun never collides with the last one.
 *
 * Needs a running server and the E2E role sessions; a dev server compiles
 * each server action on first use, hence the generous navigation timeouts.
 */
const title = `E2E giao việc ${Date.now()}`;
const day = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

test("director assigns, storekeeper asks for more time, director approves", async ({
  page,
}) => {
  await signInAs(page, "DIRECTOR");
  await page.goto("/vi/admin/tasks", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Giao việc", level: 1 }),
  ).toBeVisible();

  // Hand the work over with a deadline.
  await page.locator("#task-title").fill(title);
  await page.locator("#task-due").fill(day(3));
  const storekeeperOption = page
    .locator("#task-assignee option", { hasText: "WAREHOUSE_MANAGER" })
    .first();
  await page
    .locator("#task-assignee")
    .selectOption((await storekeeperOption.getAttribute("value"))!);
  await page.locator("#task-note").fill("Kiểm tra giúp lô sơn mới về.");
  await page.getByRole("button", { name: "Lưu việc" }).click();
  await expect(page).toHaveURL(/notice=created/, { timeout: 90_000 });

  // The storekeeper reads it on their own screen and asks for more time.
  await signInAs(page, "WAREHOUSE_MANAGER");
  await page.goto("/vi/admin/my-tasks", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Công việc được giao", level: 1 }),
  ).toBeVisible();
  const card = page.locator("li[id^='task-']", { hasText: title }).first();
  await expect(card).toBeVisible();
  await expect(card).toContainText("Kiểm tra giúp lô sơn mới về.");

  await card.getByText("Xin gia hạn").click();
  await card.locator('input[name="requestedDueDate"]').fill(day(10));
  await card.locator('input[name="reason"]').fill("Chờ sơn về kho");
  await card.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(page).toHaveURL(/notice=extensionRequested/, {
    timeout: 90_000,
  });
  await expect(
    page.locator("li[id^='task-']", { hasText: title }),
  ).toContainText("Đang chờ Giám đốc duyệt");

  // The assignment raised its own message at once: the outbox carries a
  // `taskAssigned` row (skipped while delivery is off, which is the point —
  // the evidence is recorded either way).
  await signInAs(page, "DIRECTOR");
  await page.goto("/vi/admin/tasks", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("taskAssigned").first()).toBeVisible();

  // The Director answers from the queue.
  await signInAs(page, "DIRECTOR");
  await page.goto("/vi/admin/tasks", { waitUntil: "domcontentloaded" });
  const queue = page.locator("#extensions");
  const request = queue.locator("li", { hasText: title }).first();
  await expect(request).toContainText("Chờ sơn về kho");
  await request.getByRole("button", { name: "Duyệt gia hạn" }).click();
  await expect(page).toHaveURL(/notice=extensionApproved/, { timeout: 90_000 });
  await expect(
    page.locator("#extensions").locator("li", { hasText: title }),
  ).toHaveCount(0);

  // The storekeeper sees the answer and the new deadline, then finishes.
  await signInAs(page, "WAREHOUSE_MANAGER");
  await page.goto("/vi/admin/my-tasks", { waitUntil: "domcontentloaded" });
  const answered = page.locator("li[id^='task-']", { hasText: title }).first();
  await expect(answered).toContainText("Giám đốc đã duyệt gia hạn tới");
  await expect(answered).toContainText(day(10));
  await answered.getByRole("button", { name: "Xong" }).click();
  await expect(page).toHaveURL(/notice=done/, { timeout: 90_000 });
  await page.goto("/vi/admin/my-tasks?status=done", {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.locator("li[id^='task-']", { hasText: title }),
  ).toContainText("Xong lúc");
});

test("the storekeeper cannot open the assigning screen", async ({ page }) => {
  await signInAs(page, "WAREHOUSE_MANAGER");
  await page.goto("/vi/admin/tasks", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText(/Không tìm thấy trang quản trị|not found/i),
  ).toBeVisible();

  // The menu is read from a page that exists for this role.
  await page.goto("/vi/admin", { waitUntil: "domcontentloaded" });
  const nav = page.getByRole("navigation", { name: /Điều hướng quản trị/ });
  await expect(
    nav.getByRole("link", { name: "Công việc được giao" }),
  ).toBeVisible();
  await expect(nav.getByRole("link", { name: "Giao việc" })).toHaveCount(0);
});

test("the content creator now receives assigned work too", async ({ page }) => {
  await signInAs(page, "CONTENT_CREATOR");
  await page.goto("/vi/admin/my-tasks", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Công việc được giao", level: 1 }),
  ).toBeVisible();
});
