import { execSync } from "node:child_process";

import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";

import { signInAs } from "./helpers";

// "Danh sách nhân sự", agreed with the client on 2026-09-13: Gmail sign-in
// only, a first sign-in waits for the Director, one role per person, the
// Director role is never handed out, rejecting re-queues, locking keeps the
// role. The fixture script creates two pending accounts and the session
// cookies a Google sign-in would have left, so the spec watches both sides:
// the Director's list and what each person sees on their next page load.

type FixtureAccount = { id: string; email: string; token: string };
type Fixture = Record<"a" | "b", FixtureAccount>;

function runFixture(mode: "seed" | "cleanup"): string {
  const output = execSync(
    `npx tsx --env-file-if-exists=.env --conditions=react-server tests/e2e-admin/staff-fixture.ts ${mode}`,
    { encoding: "utf8" },
  );
  return output.trim().split(/\r?\n/).at(-1) ?? "";
}

async function openAs(
  browser: Browser,
  baseURL: string,
  account: FixtureAccount,
): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  await context.addCookies([
    { name: "next-auth.session-token", value: account.token, url: baseURL },
  ]);
  return context.newPage();
}

const menu = (page: Page) =>
  page.getByRole("navigation", { name: /Điều hướng quản trị/ });

async function openTab(page: Page, tab: "pending" | "active" | "suspended") {
  await page.goto(`/vi/admin/staff?tab=${tab}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("heading", { level: 1, name: "Danh sách nhân sự" }),
  ).toBeVisible();
}

const rowOf = (page: Page, email: string): Locator =>
  page.locator("tbody tr", { hasText: email });

async function confirm(row: Locator, label: string, submit: string) {
  await row.locator("summary", { hasText: label }).click();
  await row.getByRole("button", { name: submit }).click();
}

test.describe.serial("staff directory", () => {
  let fixture: Fixture;
  let baseURL: string;

  test.beforeAll(() => {
    fixture = JSON.parse(runFixture("seed")) as Fixture;
  });

  test.afterAll(() => {
    runFixture("cleanup");
  });

  test.beforeEach(({}, testInfo) => {
    baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:3000");
  });

  test("a first Gmail sign-in waits for the Director", async ({ browser }) => {
    const person = await openAs(browser, baseURL, fixture.a);
    await person.goto("/vi/admin", { waitUntil: "domcontentloaded" });
    await expect(
      person.getByRole("heading", {
        name: "Tài khoản đang chờ Giám đốc duyệt",
      }),
    ).toBeVisible();
    await expect(menu(person)).toHaveCount(0);
    // The waiting screen names the Gmail in use and offers a way to switch.
    await expect(person.locator("#admin-main")).toContainText(fixture.a.email);
    await expect(
      person.getByRole("button", { name: "Đăng xuất" }),
    ).toBeVisible();
    await person.context().close();
  });

  test("the Director approves with one role and access follows", async ({
    page,
    browser,
  }) => {
    await signInAs(page, "DIRECTOR");
    await openTab(page, "pending");

    // Internal test accounts (the E2E roles, the retired role preview) are not
    // staff and never appear in the list.
    await expect(page.locator("tbody")).not.toContainText("reddoor.local");

    const row = rowOf(page, fixture.a.email);
    const picker = row.locator('select[name="roleKey"]');
    await expect(picker.locator("option")).toHaveText([
      "Chọn role…",
      "Quản lý nhà máy",
      "Thủ kho / Quản lý kho",
      "Kế toán nhà máy & mua hàng",
      "Kế toán công ty",
      "Biên tập nội dung",
    ]);
    await picker.selectOption("WAREHOUSE_MANAGER");
    await row.getByRole("button", { name: "Duyệt", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Đã duyệt tài khoản.");
    await expect(rowOf(page, fixture.a.email)).toHaveCount(0);

    await openTab(page, "active");
    await expect(
      rowOf(page, fixture.a.email).locator('select[name="roleKey"]'),
    ).toHaveValue("WAREHOUSE_MANAGER");

    const person = await openAs(browser, baseURL, fixture.a);
    await person.goto("/vi/admin", { waitUntil: "domcontentloaded" });
    await expect(
      menu(person).getByRole("link", { name: "Nguyên vật liệu" }),
    ).toBeVisible();
    await expect(
      menu(person).getByRole("link", { name: "Danh sách nhân sự" }),
    ).toHaveCount(0);
    await person.context().close();
  });

  test("a new role applies on the next page load; a stale page is refused", async ({
    page,
    browser,
  }) => {
    await signInAs(page, "DIRECTOR");
    await openTab(page, "active");
    const stale = await page.context().newPage();
    await openTab(stale, "active");

    const row = rowOf(page, fixture.a.email);
    await row
      .locator('select[name="roleKey"]')
      .selectOption("COMPANY_ACCOUNTANT");
    await row.getByRole("button", { name: "Lưu role" }).click();
    await expect(page.getByRole("status")).toContainText("Đã đổi role.");

    // The second tab still carries the account as it was before the change.
    await confirm(rowOf(stale, fixture.a.email), "Khoá", "Xác nhận khoá");
    // Next.js keeps its own `role="alert"` route announcer on every page.
    await expect(
      stale.getByRole("alert").filter({ hasText: "Thao tác không thành công" }),
    ).toContainText("Tài khoản vừa thay đổi ở nơi khác");
    await stale.close();

    const person = await openAs(browser, baseURL, fixture.a);
    await person.goto("/vi/admin", { waitUntil: "domcontentloaded" });
    await expect(
      menu(person).getByRole("link", { name: "Khách hàng", exact: true }),
    ).toBeVisible();
    await expect(
      menu(person).getByRole("link", { name: "Nguyên vật liệu" }),
    ).toHaveCount(0);
    await person.context().close();
  });

  test("locking shuts the door and unlocking gives the same role back", async ({
    page,
    browser,
  }) => {
    await signInAs(page, "DIRECTOR");
    await openTab(page, "active");
    await confirm(rowOf(page, fixture.a.email), "Khoá", "Xác nhận khoá");
    await expect(page.getByRole("status")).toHaveText("Đã khoá tài khoản.");

    const person = await openAs(browser, baseURL, fixture.a);
    await person.goto("/vi/admin", { waitUntil: "domcontentloaded" });
    await expect(
      person.getByRole("heading", { name: "Tài khoản đã bị khoá" }),
    ).toBeVisible();

    await openTab(page, "suspended");
    const locked = rowOf(page, fixture.a.email);
    await expect(locked).toContainText("Kế toán công ty");
    await expect(locked.locator("select")).toHaveCount(0);
    await locked.getByRole("button", { name: "Mở khoá" }).click();
    await expect(page.getByRole("status")).toHaveText("Đã mở khoá tài khoản.");

    await person.goto("/vi/admin", { waitUntil: "domcontentloaded" });
    await expect(
      menu(person).getByRole("link", { name: "Khách hàng", exact: true }),
    ).toBeVisible();
    await person.context().close();
  });

  test("rejecting removes the request and the session with it", async ({
    page,
    browser,
  }) => {
    await signInAs(page, "DIRECTOR");
    await openTab(page, "pending");
    await confirm(rowOf(page, fixture.b.email), "Từ chối", "Xác nhận từ chối");
    await expect(page.getByRole("status")).toContainText("Đã từ chối.");
    await expect(rowOf(page, fixture.b.email)).toHaveCount(0);

    // A later Google sign-in would create a fresh pending account; the old
    // cookie names an account that no longer exists, so it signs in again.
    const person = await openAs(browser, baseURL, fixture.b);
    await person.goto("/vi/admin", { waitUntil: "domcontentloaded" });
    await person.waitForURL(/\/vi\/admin\/sign-in/);
    await person.context().close();
  });

  test("only the Director reaches the list", async ({ page }) => {
    // Outcome messages come from the query string; an inherited object key
    // must fall back to the generic copy instead of breaking the page.
    await signInAs(page, "DIRECTOR");
    await page.goto(
      "/vi/admin/staff?tab=pending&notice=__proto__&error=constructor",
      { waitUntil: "domcontentloaded" },
    );
    await expect(
      page.getByRole("alert").filter({ hasText: "Thao tác không thành công" }),
    ).toContainText("Hệ thống tạm thời không phản hồi.");
    await expect(page.getByRole("status")).toHaveCount(0);

    await signInAs(page, "WAREHOUSE_MANAGER");
    await expect(
      menu(page).getByRole("link", { name: "Danh sách nhân sự" }),
    ).toHaveCount(0);
    await page.goto("/vi/admin/staff", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("404 · Red Door CMS")).toBeVisible();
    await expect(page.locator("tbody")).toHaveCount(0);
  });
});
