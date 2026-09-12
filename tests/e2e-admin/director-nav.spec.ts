import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

const menu = (page: Page) =>
  page.getByRole("navigation", { name: /Điều hướng quản trị/ });

/** Opens a role group in the Director's menu and returns its list. */
async function openRole(page: Page, name: string) {
  const heading = menu(page).getByRole("button", { name, exact: true });
  if ((await heading.getAttribute("aria-expanded")) === "false")
    await heading.click();
  await expect(heading).toHaveAttribute("aria-expanded", "true");
  return page.locator(`[id="${await heading.getAttribute("aria-controls")}"]`);
}

// Agreed with the client on 2026-09-11: every role's screens, grouped by
// role, shared entries repeated, the assistant outside every group.
const expectedMenus: Record<string, string[]> = {
  "Giám đốc": ["Giao việc", "Phê duyệt", "Cơ cấu tổ chức", "Yêu cầu báo giá"],
  "Thủ kho / Quản lý kho": [
    "Bảng xuất kho sơn",
    "Nguyên vật liệu",
    "Hóa đơn bán hàng",
    "Công nợ bán sơn",
    "Sổ đơn hàng",
    "Kiểm tra bảng biểu",
  ],
  "Quản lý nhà máy": [
    "Sổ đơn hàng",
    "Quy trình đơn hàng",
    "Kiểm tra bảng biểu",
    "Chi phí đơn hàng",
  ],
  "Kế toán nhà máy & mua hàng": [
    "Sổ đơn hàng",
    "Nhà cung cấp",
    "Kiểm tra bảng biểu",
    "Chi phí đơn hàng",
  ],
  "Kế toán công ty": [
    "Hóa đơn bán hàng",
    "Công nợ bán sơn",
    "Sổ đơn hàng",
    "Khách hàng",
    "Quy trình đơn hàng",
    "Đơn cửa hàng",
    "Thiết lập",
    "Tổng quan tài chính",
    "Hóa đơn (INV)",
    "Tiền khách trả",
    "Công nợ khách hàng",
    "Kiểm tra bảng biểu",
    "Thu – Chi",
    "Chi phí đơn hàng",
    "Tỷ giá USD",
  ],
  "Biên tập nội dung": [
    "Nội dung",
    "Theo dõi tiến độ mẫu",
    "Sản phẩm",
    "Tin tức",
    "Bộ sưu tập",
    "Cửa hàng",
  ],
};

test("the director's menu is laid out by role", async ({ page }) => {
  await signInAs(page, "DIRECTOR");
  const nav = menu(page);

  // The overview and the assistant stay on top, outside every role.
  await expect(
    nav.getByRole("link", { name: "Tổng quan", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Trợ lý AI", exact: true }),
  ).toBeVisible();

  const headings = nav.getByRole("button");
  await expect(headings).toHaveText(Object.keys(expectedMenus));
  // Nothing is open on the overview until a role is picked.
  for (const heading of await headings.all())
    await expect(heading).toHaveAttribute("aria-expanded", "false");

  for (const [role, entries] of Object.entries(expectedMenus)) {
    const group = await openRole(page, role);
    await expect(group.getByRole("link")).toHaveText(entries);
  }
  await expect(nav.getByRole("link", { name: "Trợ lý AI" })).toHaveCount(1);

  // A shared entry lights up only under the role it was picked from.
  const factory = await openRole(page, "Quản lý nhà máy");
  await factory.getByRole("link", { name: "Sổ đơn hàng" }).click();
  await page.waitForURL(/\/vi\/admin\/orders$/);
  await expect(
    factory.getByRole("link", { name: "Sổ đơn hàng" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);

  await page.screenshot({
    path: "test-results/director-nav-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/director-nav-mobile.png" });
});

test("a closed role keeps its choice across pages", async ({ page }) => {
  await signInAs(page, "DIRECTOR");
  const warehouse = await openRole(page, "Thủ kho / Quản lý kho");
  await warehouse.getByRole("link", { name: "Nguyên vật liệu" }).click();
  await page.waitForURL(/\/vi\/admin\/materials/);
  const heading = menu(page).getByRole("button", {
    name: "Thủ kho / Quản lý kho",
  });
  await expect(heading).toHaveAttribute("aria-expanded", "true");

  await heading.click();
  await expect(heading).toHaveAttribute("aria-expanded", "false");
  await expect(warehouse).toBeHidden();
});

test("other roles keep their own flat menu", async ({ page }) => {
  await signInAs(page, "WAREHOUSE_MANAGER");
  const nav = menu(page);
  await expect(nav.getByRole("button")).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: "Nguyên vật liệu" }),
  ).toBeVisible();
  await expect(nav.getByRole("link", { name: "Phê duyệt" })).toHaveCount(0);
});
