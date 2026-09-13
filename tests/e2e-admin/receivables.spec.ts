import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

/**
 * Công nợ walk-through against a running dev server (see
 * playwright.admin.config.ts). Needs the migrated debt book — run
 * `npm run import:receivables -- "assets/Reddoor-congno-2026.xlsx" --apply`
 * first — and the E2E role sessions (global setup).
 *
 * The flow records a payment, checks the balance moved by exactly that amount,
 * cancels it, checks the balance came back, and never leaves a posted entry
 * behind.
 */

/**
 * These specs write into the real debt book, so a failed run must not leave a
 * posted entry behind shifting a customer's balance. The cleanup runs before
 * the first test as well as after the last, so a previous crash cannot poison
 * the baseline this run reads.
 */
function cleanup() {
  execFileSync(
    process.execPath,
    [
      "--env-file-if-exists=.env",
      "--conditions=react-server",
      "--import",
      "tsx",
      "tests/integration/receivables-e2e-cleanup.ts",
    ],
    { stdio: "inherit" },
  );
}

test.beforeAll(cleanup);
test.afterAll(cleanup);

/** `5.033.850` → 5033850, so a screen figure can be compared as a number. */
const asNumber = (text: string) => Number(text.replace(/[^\d-]/g, ""));

/** Marks everything this spec writes, so the cleanup can find it again. */
const MARK = "E2E kiểm thử";

async function openReceivables(page: Page) {
  await page.goto("/vi/admin/receivables", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Công nợ bán sơn", exact: true }),
  ).toBeVisible({ timeout: 90_000 });
  return page.getByRole("tablist", { name: "Sổ công nợ" });
}

/**
 * The summary table, addressed by its caption. Every tab renders a table with
 * a customer-code button in it, so a bare `tbody tr` would be ambiguous.
 */
const summaryTable = (page: Page) =>
  page.locator("table").filter({
    has: page.locator("caption", { hasText: "Bảng tổng hợp công nợ" }),
  });

/** The summary row for one customer code. */
const rowFor = (page: Page, code: string) =>
  summaryTable(page)
    .locator("tbody tr")
    .filter({ has: page.getByRole("button", { name: code, exact: true }) });

test("the storekeeper reads the debt book, records a payment and cancels it", async ({
  page,
}) => {
  await signInAs(page, "WAREHOUSE_MANAGER");
  const tabs = await openReceivables(page);
  await expect(tabs).toBeVisible();

  // ---- Tổng hợp: the migrated figures are on screen.
  const nha = rowFor(page, "Nha");
  await expect(nha).toBeVisible({ timeout: 60_000 });
  const cells = nha.locator("td");
  const opening = asNumber(await cells.nth(4).innerText());
  const increase = asNumber(await cells.nth(5).innerText());
  const decrease = asNumber(await cells.nth(6).innerText());
  const closing = asNumber(await cells.nth(7).innerText());
  expect(opening).toBe(95350);
  expect(increase).toBe(37802000);
  expect(decrease).toBe(32863500);
  expect(closing).toBe(5033850);
  // The identity the whole report rests on, read off the rendered page.
  expect(opening + increase - decrease).toBe(closing);

  // A customer who paid ahead is shown as such, not as an error.
  const quyet = rowFor(page, "QuyetBK");
  await expect(quyet).toContainText("Dư trả trước");
  expect(asNumber(await quyet.locator("td").nth(7).innerText())).toBe(-250);

  // ---- Chi tiết khách: the running balance ends on the summary figure.
  await page.getByRole("button", { name: "Nha", exact: true }).first().click();
  const detail = page
    .locator("section")
    .filter({ hasText: "Chi tiết công nợ" })
    .first();
  await expect(
    detail.getByRole("heading", { name: "Nguyễn Ngọc Nha" }),
  ).toBeVisible({ timeout: 60_000 });
  // The ledger pages at 100 rows; walk to the last page before reading the
  // final running balance.
  const nextPage = detail.getByRole("button", { name: "Trang sau" });
  while ((await nextPage.count()) > 0 && (await nextPage.isEnabled())) {
    await nextPage.click();
    await page.waitForTimeout(400);
  }
  const ledgerRows = detail.locator("table tbody tr");
  const lastBalance = asNumber(
    await ledgerRows.last().locator("td").nth(6).innerText(),
  );
  expect(lastBalance).toBe(closing);
  await detail.getByRole("button", { name: "Đóng" }).click();

  // ---- Ghi nhận thanh toán.
  await page.getByRole("tab", { name: "Thanh toán / Giảm nợ" }).click();
  await page
    .getByRole("button", { name: /Ghi nhận thanh toán \/ giảm nợ/ })
    .click();
  const amount = 12345;
  await page
    .locator("#form-customer-reductions")
    .selectOption({ label: "Nha — Nguyễn Ngọc Nha" });
  await page.locator("#form-amount-reductions").fill(String(amount));
  await page
    .locator("#form-desc-reductions")
    .fill("E2E kiểm thử — sẽ hủy ngay");
  await page.getByRole("button", { name: "Ghi sổ", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Đã ghi sổ", {
    timeout: 60_000,
  });

  // ---- The summary moved by exactly that amount, and only downwards.
  await page.getByRole("tab", { name: "Tổng hợp công nợ" }).click();
  const afterRow = rowFor(page, "Nha");
  await expect(afterRow).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(
      async () => asNumber(await afterRow.locator("td").nth(7).innerText()),
      { timeout: 30_000 },
    )
    .toBe(closing - amount);
  expect(asNumber(await afterRow.locator("td").nth(6).innerText())).toBe(
    decrease + amount,
  );
  expect(asNumber(await afterRow.locator("td").nth(5).innerText())).toBe(
    increase,
  );

  // ---- Hủy: the entry stays in the book but stops counting.
  await page.getByRole("tab", { name: "Thanh toán / Giảm nợ" }).click();
  const entryRow = page
    .locator("table")
    .filter({
      has: page.locator("caption", { hasText: "Bảng thanh toán" }),
    })
    .locator("tbody tr")
    .filter({ hasText: "E2E kiểm thử" })
    .first();
  await expect(entryRow).toBeVisible({ timeout: 60_000 });
  await entryRow.getByRole("button", { name: "Hủy" }).click();
  await page.locator("#cancel-reductions").fill("E2E dọn dẹp");
  await page.getByRole("button", { name: "Xác nhận hủy" }).click();
  await expect(page.getByRole("status")).toContainText("Đã hủy giao dịch", {
    timeout: 60_000,
  });

  await page.getByRole("tab", { name: "Tổng hợp công nợ" }).click();
  const restored = rowFor(page, "Nha");
  await expect(restored).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(
      async () => asNumber(await restored.locator("td").nth(7).innerText()),
      { timeout: 30_000 },
    )
    .toBe(closing);

  // ---- Nhật ký records who did what.
  await page.getByRole("tab", { name: "Nhật ký" }).click();
  await expect(page.locator("tbody")).toContainText("Hủy giao dịch", {
    timeout: 60_000,
  });
  await expect(page.locator("tbody")).toContainText("Ghi giảm công nợ");
});

test("the date window answers 'công nợ đến ngày'", async ({ page }) => {
  await signInAs(page, "WAREHOUSE_MANAGER");
  await openReceivables(page);

  const nha = rowFor(page, "Nha");
  await expect(nha).toBeVisible({ timeout: 60_000 });
  const full = asNumber(await nha.locator("td").nth(7).innerText());

  // Everything in the source book happens on or after 02/01/2026, so a window
  // that ends the day before can only show the opening balance.
  await page.locator("#receivables-to").fill("2026-01-01");
  await expect
    .poll(async () => asNumber(await nha.locator("td").nth(7).innerText()), {
      timeout: 30_000,
    })
    .toBe(95350);
  expect(asNumber(await nha.locator("td").nth(5).innerText())).toBe(0);

  await page.getByRole("button", { name: "Bỏ lọc ngày" }).click();
  await expect
    .poll(async () => asNumber(await nha.locator("td").nth(7).innerText()), {
      timeout: 30_000,
    })
    .toBe(full);
});

test("the export opens as the workbook it replaces", async ({ page }) => {
  await signInAs(page, "WAREHOUSE_MANAGER");
  await openReceivables(page);
  await expect(rowFor(page, "Nha")).toBeVisible({ timeout: 60_000 });

  const download = await Promise.all([
    page.waitForEvent("download", { timeout: 90_000 }),
    page.getByRole("button", { name: "Xuất Excel" }).click(),
  ]).then(([event]) => event);
  expect(download.suggestedFilename()).toBe("TONG-HOP-CONG-NO.xlsx");

  const file = path.join(tmpdir(), `congno-${Date.now()}.xlsx`);
  await download.saveAs(file);
  const book = XLSX.read(readFileSync(file), { type: "buffer" });
  const sheet = book.Sheets.TongHopCongNo!;
  expect(String(sheet.D1?.v)).toContain("BẢNG TỔNG HỢP CÔNG NỢ");
  expect(sheet.H2?.v).toBe("Phát sinh tăng");

  // Find the migrated customer and the total line in the exported file.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
  });
  const nha = rows.find((row) => row?.[3] === "Nha");
  expect(nha?.[6]).toBe(95350);
  expect(nha?.[9]).toBe(5033850);
  const total = rows.find((row) => row?.[2] === "Cộng tổng");
  expect(total).toBeDefined();
  expect(Number(total?.[6]) + Number(total?.[7]) - Number(total?.[8])).toBe(
    Number(total?.[9]),
  );

  // No formula survived into the file, so it cannot recompute differently.
  for (const [address, cell] of Object.entries(sheet)) {
    if (address.startsWith("!")) continue;
    expect((cell as XLSX.CellObject).f).toBeUndefined();
  }
});

test("a role without the grant cannot reach the module or its API", async ({
  page,
}) => {
  await signInAs(page, "FACTORY_ACCOUNTANT");

  // Not in the menu…
  await expect(
    page.getByRole("navigation", { name: /Điều hướng quản trị/ }),
  ).not.toContainText("Công nợ bán sơn");

  // …not reachable by URL…
  await page.goto("/vi/admin/receivables", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Công nợ bán sơn", exact: true }),
  ).toHaveCount(0);

  // …and not readable through the API, which is the one that matters.
  for (const path of [
    "/api/receivables/summary",
    "/api/receivables/entries",
    "/api/receivables/lookups",
    "/api/receivables/export?scope=summary",
  ]) {
    const response = await page.request.get(path);
    expect(response.status(), path).toBe(403);
    expect(await response.text()).not.toContain("5033850");
  }
});

test("multi-line sale, new paint code, and in-place edit", async ({ page }) => {
  await signInAs(page, "WAREHOUSE_MANAGER");
  await page.goto("/vi/admin/receivables?tab=sales", {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("heading", { name: "Công nợ bán sơn", exact: true }),
  ).toBeVisible({ timeout: 90_000 });

  const code = `E2E-SON-${Date.now().toString(36).toUpperCase()}`;

  // ---- open the multi-line form
  await page.getByRole("button", { name: /Ghi phát sinh bán hàng/ }).click();
  await page
    .locator("#sale-customer")
    .selectOption({ label: "Nha — Nguyễn Ngọc Nha" });
  await page.locator("#sale-doc").fill(MARK);

  // line 1: an existing catalogue code fills its own price
  await page.getByLabel("Mã hàng dòng 1").fill("Xang1");
  await page.getByLabel("Số lượng dòng 1").fill("2");
  await expect(page.getByLabel("Đơn giá dòng 1")).toHaveValue("48000");

  // line 2: a brand-new code, added to the catalogue without leaving the form
  await page.getByRole("button", { name: "+ Thêm dòng" }).click();
  await page.getByLabel("Mã hàng dòng 2").fill(code);
  await expect(page.getByText("Mã chưa có trong danh mục")).toBeVisible();
  await page
    .getByRole("button", { name: new RegExp(`Thêm mã .*${code}`) })
    .click();
  await page.locator("#cat-name").fill("Sơn kiểm thử E2E");
  await page.locator("#cat-unit").fill("Kg");
  await page.locator("#cat-price").fill("111000");
  await page.getByRole("button", { name: "Thêm vào danh mục" }).click();
  await expect(page.getByRole("status")).toContainText("vào danh mục sơn", {
    timeout: 60_000,
  });

  // the new code now resolves on the line, price filled from the catalogue
  await expect(
    page.locator("tbody tr").nth(1).getByText("Sơn kiểm thử E2E"),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Đơn giá dòng 2")).toHaveValue("111000");
  await page.getByLabel("Số lượng dòng 2").fill("3");

  const total = asNumber(
    await page.locator("tfoot").first().locator("td").nth(1).innerText(),
  );
  expect(total).toBe(2 * 48000 + 3 * 111000);

  await page.getByRole("button", { name: /^Ghi sổ 2 dòng$/ }).click();
  await expect(page.getByRole("status")).toContainText("Đã ghi sổ 2 dòng", {
    timeout: 60_000,
  });

  // ---- both lines are in the ledger under one document number
  await page.locator("#entries-search-sales").fill(MARK);
  const rows = page
    .locator("table")
    .filter({
      has: page.locator("caption", { hasText: "Sổ chi tiết bán hàng" }),
    })
    .locator("tbody tr");
  await expect(rows).toHaveCount(2, { timeout: 60_000 });

  // ---- edit one line in place: change the quantity, amount recomputes
  const target = rows.filter({ hasText: code }).first();
  await target.getByRole("button", { name: "Sửa" }).click();
  await page.getByLabel("Số lượng").fill("5");
  await page.getByLabel("Lý do sửa").fill("E2E sửa số lượng");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Đã sửa dòng", {
    timeout: 60_000,
  });

  const edited = rows.filter({ hasText: code }).first();
  await expect(edited).toContainText("555.000");

  // ---- the audit log records the correction with its reason
  await page.getByRole("tab", { name: "Nhật ký" }).click();
  await expect(page.locator("tbody")).toContainText("Sửa dòng giao dịch", {
    timeout: 60_000,
  });
  await expect(page.locator("tbody")).toContainText("E2E sửa số lượng");
});
