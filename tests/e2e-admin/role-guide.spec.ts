import { expect, test, type Page } from "@playwright/test";

import { signInAs, type RoleKey } from "./helpers";

const menu = (page: Page) =>
  page.getByRole("navigation", { name: /Điều hướng quản trị/ });

const roles: { role: RoleKey; label: string }[] = [
  { role: "DIRECTOR", label: "Giám đốc" },
  { role: "WAREHOUSE_MANAGER", label: "Thủ kho / Quản lý kho" },
  { role: "FACTORY_MANAGER", label: "Quản lý nhà máy" },
  { role: "FACTORY_ACCOUNTANT", label: "Kế toán nhà máy & mua hàng" },
  { role: "COMPANY_ACCOUNTANT", label: "Kế toán công ty" },
  { role: "CONTENT_CREATOR", label: "Biên tập nội dung" },
];

// Agreed 2026-09-14: every role opens its menu with its own guide, and the
// guide explains that role's menu entries only.
for (const { role, label } of roles) {
  test(`${role} reads their own guide first in the menu`, async ({ page }) => {
    await signInAs(page, role);
    const first = menu(page).getByRole("link").first();
    await expect(first).toHaveText("Hướng dẫn sử dụng website");

    await first.click();
    await page.waitForURL(/\/vi\/admin\/guide$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Hướng dẫn sử dụng website",
      }),
    ).toBeVisible();
    await expect(page.locator(`[data-role="${role}"]`)).toBeVisible();
    await expect(
      page.locator("#vai-tro").getByText(label, { exact: true }),
    ).toBeVisible();

    // One folded section per menu entry other than the guide itself. The
    // Director's other role groups stay closed on this page, so the visible
    // links are exactly the entries the Director's guide covers, minus
    // the Director's own desk, which sits in its closed group.
    const sections = page.locator('details[id^="muc-"]');
    const links = await menu(page).getByRole("link").count();
    if (role === "DIRECTOR") {
      await expect(sections).toHaveCount(links - 1 + 5);
      await expect(page.locator("#muc-orders")).toHaveCount(0);
    } else {
      await expect(sections).toHaveCount(links - 1);
    }

    // A contents link opens the fold it points at.
    const target = sections.last();
    const id = await target.getAttribute("id");
    await expect(target).not.toHaveAttribute("open", "");
    // The contents sit beside the guide on wide screens and above it on
    // narrow ones; only one of the two copies is ever shown.
    await page
      .locator(`nav[aria-label="Mục lục"] a[href="#${id}"]:visible`)
      .click();
    await expect(target).toHaveAttribute("open", "");

    await page.screenshot({
      path: `test-results/role-guide-${role}.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
