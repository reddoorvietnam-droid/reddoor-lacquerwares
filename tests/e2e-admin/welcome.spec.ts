import { expect, test } from "@playwright/test";

import { signInAs, type RoleKey } from "./helpers";

// Agreed on 2026-09-13: sign-in is Gmail only (the one-click role preview is
// gone) and every role lands on its own welcome page.

const welcomes: Record<
  RoleKey,
  { label: string; tagline: RegExp; opens: string; never: string }
> = {
  DIRECTOR: {
    label: "Giám đốc",
    tagline: /Duyệt người mới, giao việc/,
    opens: "Danh sách nhân sự",
    never: "Nguyên vật liệu",
  },
  WAREHOUSE_MANAGER: {
    label: "Thủ kho / Quản lý kho",
    tagline: /Kho sơn, nguyên vật liệu/,
    opens: "Nguyên vật liệu",
    never: "Danh sách nhân sự",
  },
  FACTORY_MANAGER: {
    label: "Quản lý nhà máy",
    tagline: /từng bước sản xuất/,
    opens: "Sổ đơn hàng",
    never: "Khách hàng",
  },
  FACTORY_ACCOUNTANT: {
    label: "Kế toán nhà máy & mua hàng",
    tagline: /Chi phí đơn hàng, nhà cung cấp/,
    opens: "Nhà cung cấp",
    never: "Tiền khách trả",
  },
  COMPANY_ACCOUNTANT: {
    label: "Kế toán công ty",
    tagline: /bức tranh tài chính/,
    opens: "Tiền khách trả",
    never: "Danh sách nhân sự",
  },
  CONTENT_CREATOR: {
    label: "Biên tập nội dung",
    tagline: /câu chuyện sơn mài/,
    opens: "Tin tức",
    never: "Sổ đơn hàng",
  },
};

const startsWith = (label: string) =>
  new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

for (const [role, expected] of Object.entries(welcomes) as [
  RoleKey,
  (typeof welcomes)[RoleKey],
][]) {
  test(`${role} is welcomed into their own work`, async ({ page }) => {
    await signInAs(page, role);
    const main = page.locator("#admin-main");
    const hero = main.locator(`section[data-role="${role}"]`);

    await expect(hero.locator(".eyebrow")).toHaveText(
      /^Chào buổi (sáng|trưa|chiều|tối)$/,
    );
    await expect(hero.getByRole("heading", { level: 1 })).toHaveText(
      `${expected.label} (E2E)`,
    );
    await expect(hero).toContainText(expected.label);
    await expect(hero).toContainText(expected.tagline);

    const shortcuts = main.getByRole("list").getByRole("link");
    await expect(
      shortcuts.filter({ hasText: startsWith(expected.never) }),
    ).toHaveCount(0);
    const shortcut = main.getByRole("link", {
      name: startsWith(expected.opens),
    });
    await expect(shortcut).toBeVisible();

    // The header names the person and offers a way out.
    await expect(page.getByRole("banner")).toContainText(
      `${expected.label} (E2E)`,
    );
    await expect(page.getByRole("button", { name: "Đăng xuất" })).toBeVisible();

    const href = await shortcut.getAttribute("href");
    await shortcut.click();
    await page.waitForURL((url) => url.pathname === href, { timeout: 90_000 });
  });
}

test("the welcome page fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, "COMPANY_ACCOUNTANT");
  await expect(page.locator("#admin-main h1")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

test("sign-in offers Google only, and signing out ends the session", async ({
  page,
}) => {
  await signInAs(page, "WAREHOUSE_MANAGER");

  // Someone already signed in is sent straight back to their work.
  await page.goto("/vi/admin/sign-in", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/vi\/admin$/);

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.waitForURL(/\/vi\/admin\/sign-in/, { timeout: 90_000 });
  await expect(
    page.getByRole("button", { name: "Tiếp tục với Google" }),
  ).toBeVisible();
  await expect(page.getByText("Vào thẳng theo vai trò")).toHaveCount(0);
  await expect(page.locator("span.font-mono")).toHaveCount(0);

  await page.goto("/vi/admin", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/vi\/admin\/sign-in/);
});

test("a failed Google round trip explains itself on the sign-in card", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/vi/admin/sign-in?error=AccessDenied", {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "Google" }),
  ).toContainText("Gmail đã xác minh");

  // A sign-in that failed on the server says so, instead of blaming the Gmail.
  await page.goto("/vi/admin/sign-in?error=Unavailable", {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "Máy chủ" }),
  ).toContainText("Máy chủ chưa xử lý được lượt đăng nhập này");
});
