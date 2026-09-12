import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";
import { fixtureMarker, fixtureWeeks } from "./sample-progress-fixtures";

const [reportWeek, nextWeek, importWeek] = fixtureWeeks;
const reportDate = reportWeek;
const sampleName = `${fixtureMarker} A`;
const sampleDetail = "2 bộ lót cốc\n1 khay 40x25 cm";

function cleanup() {
  execFileSync(
    process.execPath,
    [
      "--env-file-if-exists=.env",
      // The database modules import "server-only", which only resolves under
      // the react-server condition; without it the cleanup cannot even load.
      "--conditions=react-server",
      "--import",
      "tsx",
      "tests/e2e-admin/sample-progress-cleanup.ts",
    ],
    { stdio: "inherit" },
  );
}

test.beforeAll(cleanup);
test.afterAll(cleanup);

async function openManager(page: Page) {
  // The Director's menu is laid out by role, with the report under the
  // content editor's group; the content creator's own menu is flat.
  const group = page
    .getByRole("navigation", { name: /Điều hướng quản trị/ })
    .getByRole("button", { name: "Biên tập nội dung" });
  if (
    (await group.count()) > 0 &&
    (await group.getAttribute("aria-expanded")) === "false"
  )
    await group.click();
  await page.getByRole("link", { name: "Theo dõi tiến độ mẫu" }).click();
  await expect(
    page.getByRole("heading", { name: "Theo dõi tiến độ mẫu" }),
  ).toBeVisible();
}

async function fillSample(
  page: Page,
  values: { name: string; detail?: string; workshop?: string; note?: string },
) {
  await page.getByLabel("Mẫu đơn hàng").fill(values.name);
  if (values.detail)
    await page
      .getByLabel("Số lượng mẫu & chi tiết sản phẩm")
      .fill(values.detail);
  if (values.workshop) await page.getByLabel("Nơi làm").fill(values.workshop);
  if (values.note)
    await page
      .getByLabel("Chi tiết tiến độ / ghi chú nhật ký")
      .fill(values.note);
  await page.getByRole("button", { name: "Áp dụng vào bảng" }).click();
}

test("content creator builds, revises and inherits the weekly report", async ({
  page,
}) => {
  test.slow();
  await signInAs(page, "CONTENT_CREATOR");
  await openManager(page);

  // A brand-new week, created by picking a date rather than by a cron job.
  await page.getByLabel("Mở hoặc tạo tuần khác").fill(reportDate);
  await expect(page.getByRole("status")).toContainText("06/01/2098");

  await page.getByRole("button", { name: "Thêm mẫu" }).click();
  await fillSample(page, {
    name: sampleName,
    detail: sampleDetail,
    workshop: "Công ty",
    note: "Đang dán bạc",
  });

  // A date column may hold wording rather than a date.
  await expect(page.getByRole("cell", { name: "Đang dán bạc" })).toBeVisible();

  // Saving is blocked until the change note is written.
  await expect(
    page.getByRole("button", { name: "Lưu báo cáo" }),
  ).toBeDisabled();
  await page
    .getByLabel("Nội dung cập nhật lần này")
    .fill("Tạo báo cáo tuần đầu tiên");
  await page.getByRole("button", { name: "Lưu báo cáo" }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu 1 mẫu");
  await expect(page.getByRole("status")).toContainText("phiên bản 1");

  // A saved row shows who last touched it.
  await expect(
    page.getByRole("cell", { name: /Biên tập/ }).first(),
  ).toBeVisible();

  await page.reload();
  await openManagerAfterReload(page);
  await page.getByRole("button", { name: `Sửa mẫu 1` }).click();
  await page.getByLabel("Trạng thái tổng thể").selectOption("finishing");
  await page
    .getByLabel("Chi tiết tiến độ / ghi chú nhật ký")
    .fill("Đã mờ hậu xong");
  await page.getByRole("button", { name: "Áp dụng vào bảng" }).click();
  await page
    .getByLabel("Nội dung cập nhật lần này")
    .fill("Cập nhật sang hoàn thiện");
  await page.getByRole("button", { name: "Lưu báo cáo" }).click();
  await expect(page.getByRole("status")).toContainText("phiên bản 2");

  // Two editors racing on the same week: only the first save can win.
  const stale = await page.request.post("/api/sample-progress", {
    headers: { origin: new URL(page.url()).origin },
    data: {
      week: reportWeek,
      reportDate,
      changeNote: "Ghi đè từ phiên khác",
      expectedRevision: 1,
      rows: [],
    },
  });
  expect(stale.status()).toBe(409);

  // The old revision stays readable and read-only.
  await page.getByRole("button", { name: "Lịch sử chỉnh sửa" }).click();
  await page.getByRole("button", { name: "Xem phiên bản 1" }).click();
  await expect(page.getByRole("cell", { name: "Đang dán bạc" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sửa mẫu 1" })).toHaveCount(0);
  await page.getByRole("button", { name: "Mở phiên bản mới nhất" }).click();
  await expect(
    page.getByRole("cell", { name: "Đã mờ hậu xong" }),
  ).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất Excel" }).click();
  expect((await download).suggestedFilename()).toBe(
    "Bao-cao-tien-do-mau-Red-Door-2098-W02-v2.xlsx",
  );

  // Inheriting asks first and names both weeks.
  await page.getByRole("button", { name: "Kế thừa sang tuần mới" }).click();
  const confirm = page.getByLabel("Xác nhận kế thừa tuần mới");
  await expect(confirm).toContainText("06/01/2098");
  await expect(confirm).toContainText("13/01/2098");
  await page.getByRole("button", { name: "Xác nhận kế thừa" }).click();
  await expect(page.getByRole("status")).toContainText("Đã kế thừa 1 mẫu");
  await expect(
    page.getByRole("cell", { name: "Đã mờ hậu xong" }),
  ).toBeVisible();

  // A second inherit must not overwrite the week already in progress.
  const duplicate = await page.request.post(
    "/api/sample-progress?action=inherit",
    {
      headers: { origin: new URL(page.url()).origin },
      data: { week: reportWeek },
    },
  );
  expect(duplicate.status()).toBe(409);

  await page.screenshot({
    path: "test-results/sample-progress-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/sample-progress-mobile.png",
    fullPage: true,
  });
});

async function openManagerAfterReload(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Theo dõi tiến độ mẫu" }),
  ).toBeVisible();
  await page
    .getByLabel("Báo cáo đã lưu")
    .selectOption(reportWeek)
    .catch(() => undefined);
}

test("director reads, exports and maintains the report", async ({ page }) => {
  test.slow();
  await signInAs(page, "DIRECTOR");
  await openManager(page);
  await page.getByLabel("Báo cáo đã lưu").selectOption(nextWeek);
  await expect(
    page.getByRole("cell", { name: "Đã mờ hậu xong" }),
  ).toBeVisible();

  // Reading and exporting work as before.
  await expect(page.getByRole("button", { name: "In báo cáo" })).toBeEnabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất Excel" }).click();
  expect((await download).suggestedFilename()).toContain("2098-W03-v1.xlsx");

  // The Director edits too (confirmed 2026-09-11): the editor's controls.
  for (const name of [
    "Thêm mẫu",
    "Nhập Excel",
    "Kế thừa sang tuần mới",
    "Bỏ mẫu 1",
    "Xóa báo cáo tuần này",
  ])
    await expect(page.getByRole("button", { name })).toBeVisible();

  await page.getByRole("button", { name: "Sửa mẫu 1" }).click();
  await page
    .getByLabel("Chi tiết tiến độ / ghi chú nhật ký")
    .fill("Giám đốc đã duyệt màu");
  await page.getByRole("button", { name: "Áp dụng vào bảng" }).click();
  await page
    .getByLabel("Nội dung cập nhật lần này")
    .fill("Giám đốc cập nhật ghi chú");
  await page.getByRole("button", { name: "Lưu báo cáo" }).click();
  await expect(page.getByRole("status")).toContainText("phiên bản 2");
  await expect(
    page.getByRole("cell", { name: "Giám đốc đã duyệt màu" }),
  ).toBeVisible();
});

for (const role of [
  "FACTORY_MANAGER",
  "WAREHOUSE_MANAGER",
  "FACTORY_ACCOUNTANT",
  "COMPANY_ACCOUNTANT",
] as const) {
  test(`${role} cannot see or reach sample reports`, async ({ page }) => {
    await signInAs(page, role);
    await expect(
      page.getByRole("link", { name: "Theo dõi tiến độ mẫu" }),
    ).toHaveCount(0);

    for (const query of [
      "",
      `?week=${reportWeek}`,
      `?week=${reportWeek}&history=1`,
      `?week=${reportWeek}&export=1`,
    ]) {
      const response = await page.request.get(`/api/sample-progress${query}`);
      expect(response.status()).toBe(403);
      // A denial must not leak report data through the body either.
      expect(await response.text()).not.toContain(fixtureMarker);
    }
    const origin = new URL(page.url()).origin;
    for (const query of ["", "?action=import", "?action=inherit"]) {
      const response = await page.request.post(`/api/sample-progress${query}`, {
        headers: { origin },
        data: {},
      });
      expect(response.status()).toBe(403);
    }

    await page.goto("/vi/admin/sample-progress");
    await expect(
      page.getByRole("heading", { name: "Theo dõi tiến độ mẫu" }),
    ).toHaveCount(0);
  });
}

test("signed-out visitors are refused", async ({ page }) => {
  await page.context().clearCookies();
  const response = await page.request.get("/api/sample-progress");
  expect([401, 403]).toContain(response.status());
});

const workbook = process.env.SAMPLE_PROGRESS_WORKBOOK;

/**
 * Re-points the supplied workbook at a fixture week and marks every sample, so
 * the browser import path is exercised end to end without writing a revision
 * into a week that holds real data.
 */
function fixtureWorkbook(source: string): string {
  const book = XLSX.read(readFileSync(source), {
    type: "buffer",
    cellNF: true,
  });
  const sheet = book.Sheets[book.SheetNames[0]!]!;
  const range = XLSX.utils.decode_range(sheet["!ref"]!);
  let headerRow = -1;
  for (let r = range.s.r; r <= range.e.r && headerRow < 0; r++)
    for (let c = range.s.c; c <= range.e.c; c++)
      if (
        String(sheet[XLSX.utils.encode_cell({ r, c })]?.v ?? "").trim() ===
        "STT"
      ) {
        headerRow = r;
        break;
      }
  if (headerRow < 0) throw new Error("Could not find the STT header.");

  // The report date sits above the table; make it the fixture week.
  sheet[XLSX.utils.encode_cell({ r: headerRow - 12, c: 1 })] = {
    t: "s",
    v: "20/01/2098",
  };
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const address = XLSX.utils.encode_cell({ r, c: 2 });
    const cell = sheet[address];
    if (!cell || !String(cell.v ?? "").trim()) continue;
    sheet[address] = { t: "s", v: `${fixtureMarker} ${String(cell.v)}` };
  }
  const target = path.join(
    tmpdir(),
    `sample-progress-fixture-${Date.now()}.xlsx`,
  );
  writeFileSync(target, XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
  return target;
}

test("cancels a wrongly imported file without saving anything", async ({
  page,
}) => {
  test.skip(!workbook, "Set SAMPLE_PROGRESS_WORKBOOK to the Red Door file.");
  test.skip(!workbook || !existsSync(workbook), "Workbook file not found.");
  test.slow();
  const file = fixtureWorkbook(workbook!);

  await signInAs(page, "CONTENT_CREATOR");
  await openManager(page);
  await page.getByLabel("File tiến độ mẫu").setInputFiles(file);
  await expect(page.getByRole("status")).toContainText("Đã đọc 24 mẫu");

  const banner = page.locator(
    'section[aria-label="Dữ liệu đọc từ file Excel"]',
  );
  await expect(banner).toContainText("chưa lưu vào hệ thống");
  await expect(banner).toContainText(path.basename(file));
  await expect(
    page.getByRole("cell", { name: "Chờ gửi", exact: true }),
  ).toBeVisible();

  await banner.getByRole("button", { name: "Hủy nhập file" }).click();
  await page
    .locator('section[aria-label="Xác nhận hủy nhập file"]')
    .getByRole("button", { name: "Hủy nhập file" })
    .click();

  await expect(page.getByRole("status")).toContainText("Đã hủy nhập file");
  await expect(banner).toHaveCount(0);
  // The rows the file brought in are gone from the screen...
  await expect(
    page.getByRole("cell", { name: "Chờ gửi", exact: true }),
  ).toHaveCount(0);
  // ...and nothing ever reached the database.
  const stored = await page.request.get(
    `/api/sample-progress?week=${importWeek}`,
  );
  expect(stored.status()).toBe(404);
  rmSync(file, { force: true });
});

test("imports the supplied workbook as a preview before saving", async ({
  page,
}) => {
  test.skip(!workbook, "Set SAMPLE_PROGRESS_WORKBOOK to the Red Door file.");
  test.skip(!workbook || !existsSync(workbook), "Workbook file not found.");
  test.slow();
  const file = fixtureWorkbook(workbook!);

  await signInAs(page, "CONTENT_CREATOR");
  await openManager(page);
  await page.getByLabel("File tiến độ mẫu").setInputFiles(file);

  // The file is only a preview until the editor confirms it.
  await expect(page.getByRole("status")).toContainText("Đã đọc 24 mẫu");
  await expect(
    page.locator('section[aria-label="Dữ liệu đọc từ file Excel"]'),
  ).toContainText("Đã đọc 24 mẫu · 0 lỗi");
  await expect(page.getByText("Tổng số mẫu").first()).toBeVisible();
  // The workbook keeps this wording in a date column rather than a date.
  await expect(
    page.getByRole("cell", { name: "Chờ gửi", exact: true }),
  ).toBeVisible();

  const stored = await page.request.get(
    `/api/sample-progress?week=${importWeek}`,
  );
  expect(stored.status()).toBe(404);

  await page
    .getByLabel("Nội dung cập nhật lần này")
    .fill("Nhập dữ liệu ban đầu từ Excel");
  await page.getByRole("button", { name: "Lưu báo cáo" }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu 24 mẫu");

  const saved = await page.request.get(
    `/api/sample-progress?week=${importWeek}`,
  );
  expect(saved.status()).toBe(200);
  const body = (await saved.json()) as { report: { rows: unknown[] } };
  expect(body.report.rows).toHaveLength(24);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất Excel" }).click();
  expect((await download).suggestedFilename()).toContain("2098-W04-v1.xlsx");
  rmSync(file, { force: true });
});

test("deletes a whole week saved from the wrong file", async ({ page }) => {
  test.skip(!workbook, "Runs on the week the import test saved.");
  test.slow();
  await signInAs(page, "CONTENT_CREATOR");
  await openManager(page);
  await page.getByLabel("Báo cáo đã lưu").selectOption(importWeek);
  await expect(
    page.getByRole("cell", { name: "Chờ gửi", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Xóa báo cáo tuần này" }).click();
  const panel = page.locator('section[aria-label="Xác nhận xóa báo cáo tuần"]');
  await expect(panel).toContainText("20/01/2098");
  await expect(panel).toContainText("24 mẫu");

  // A reason is required, not just a second click.
  const confirmButton = panel.getByRole("button", {
    name: "Xóa báo cáo tuần này",
  });
  await expect(confirmButton).toBeDisabled();
  await page.getByLabel("Lý do xóa báo cáo").fill("Nhập nhầm file tuần khác");
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  await expect(page.getByRole("status")).toContainText("Đã xóa báo cáo tuần");
  await expect(page.getByRole("status")).toContainText("24 mẫu");

  // The whole week is gone: not one row, every revision of it.
  const stored = await page.request.get(
    `/api/sample-progress?week=${importWeek}`,
  );
  expect(stored.status()).toBe(404);
  await expect(
    page.getByRole("cell", { name: "Chờ gửi", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Báo cáo đã lưu")).not.toContainText(
    "20/01/2098",
  );
});
