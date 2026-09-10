import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

/**
 * Nguyên vật liệu walk-through against a running dev server (see
 * playwright.admin.config.ts). Needs the migrated catalogue (Quang, CNdenbong)
 * and the dev-preview accounts. Creates one `E2E-UI-*` material and removes
 * it again through tests/integration/materials-e2e-cleanup.ts.
 */

const code = `E2E-UI-${Date.now().toString(36).toUpperCase()}`;

function cleanup() {
  execFileSync(
    process.execPath,
    [
      "--env-file-if-exists=.env",
      "--conditions=react-server",
      "--import",
      "tsx",
      "tests/integration/materials-e2e-cleanup.ts",
    ],
    { stdio: "inherit" },
  );
}

test.afterAll(cleanup);

async function openMaterials(page: Page) {
  await page.goto("/vi/admin/materials", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Nguyên vật liệu" }),
  ).toBeVisible({ timeout: 90_000 });
  return page.getByRole("tablist", { name: "Sổ kho" });
}

test("storekeeper receives, issues, is stopped at zero stock, cancels and exports", async ({
  page,
}) => {
  await signInAs(page, "WAREHOUSE_MANAGER");
  const origin = new URL(page.url()).origin;
  const created = await page.request.post("/api/materials/masters", {
    headers: { origin },
    data: {
      kind: "material",
      changes: [
        {
          id: crypto.randomUUID(),
          version: 0,
          patch: {
            code,
            name: "Vật tư kiểm thử UI",
            unit: "Cái",
            openingQuantity: "10",
          },
        },
      ],
    },
  });
  expect(created.status()).toBe(200);
  const materialId = (await created.json()).rows[0].id as string;

  const tabs = await openMaterials(page);
  for (const name of ["Tổng kho", "Nhập kho", "Xuất kho", "Danh mục NVL"])
    await expect(tabs.getByRole("tab", { name })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nhập Excel" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xuất Excel" }).first(),
  ).toBeVisible();

  const summary = page.getByRole("table", { name: "Kho nguyên vật liệu 2026" });
  await expect(summary).toContainText("CNdenbong", { timeout: 60_000 });
  await expect(summary).toContainText("67,274.6");

  // Nhập kho: Thêm phiếu nhập → form → Áp dụng writes at once.
  await tabs.getByRole("tab", { name: "Nhập kho" }).click();
  const inboundPanel = page.getByRole("tabpanel");
  await inboundPanel.getByRole("button", { name: "Thêm phiếu nhập" }).click();
  const inboundForm = page.getByRole("form", { name: "Thêm phiếu nhập" });
  await inboundForm.getByLabel("Mã vật tư").fill(code.toLowerCase());
  await expect(inboundForm).toContainText("Vật tư kiểm thử UI · ĐVT: Cái");
  await inboundForm.getByLabel("Số lượng", { exact: true }).fill("5");
  await inboundForm.getByRole("button", { name: "Áp dụng" }).click();
  await expect(page.getByRole("status").first()).toContainText(
    "Đã ghi phiếu nhập 5 Cái Vật tư kiểm thử UI",
    { timeout: 45_000 },
  );
  await expect(inboundForm).toHaveCount(0);
  await expect(inboundPanel.getByRole("table")).toContainText(
    "Vật tư kiểm thử UI",
  );

  // Xuất kho: 20 > 15 is refused on the client, 4 saves.
  await tabs.getByRole("tab", { name: "Xuất kho" }).click();
  const outboundPanel = page.getByRole("tabpanel");
  await outboundPanel.getByRole("button", { name: "Thêm phiếu xuất" }).click();
  const outboundForm = page.getByRole("form", { name: "Thêm phiếu xuất" });
  await outboundForm.getByLabel("Cơ sở / người nhận").fill("Quang");
  await outboundForm.getByLabel("Mã vật tư").fill(code);
  await expect(outboundForm).toContainText("Tồn hiện tại: 15 Cái");
  await outboundForm.getByLabel("Số lượng xuất").fill("20");
  await expect(outboundForm.getByRole("alert")).toContainText(
    "Số lượng xuất vượt quá tồn kho hiện tại. Tồn hiện tại: 15 Cái",
  );
  await expect(
    outboundForm.getByRole("button", { name: "Áp dụng" }),
  ).toBeDisabled();
  await outboundForm.getByLabel("Số lượng xuất").fill("4");
  await expect(outboundForm.getByRole("alert")).toHaveCount(0);
  await outboundForm.getByRole("button", { name: "Áp dụng" }).click();
  await expect(page.getByRole("status").first()).toContainText(
    "Đã ghi phiếu xuất 4 Cái Vật tư kiểm thử UI",
    { timeout: 45_000 },
  );
  await expect(outboundPanel.getByRole("table")).toContainText("Anh Quảng");

  const detail = await (
    await page.request.get(`/api/materials/detail?id=${materialId}`)
  ).json();
  expect(detail.balance.currentQuantity).toBe("11");
  expect(detail.timeline[0].balanceAfter).toBe("11");

  // Server refuses an over-issue even when the client cache is bypassed.
  const overrun = await page.request.post("/api/materials/transactions", {
    headers: { origin },
    data: {
      changes: [
        {
          id: crypto.randomUUID(),
          version: 0,
          type: "OUTBOUND",
          patch: {
            transactionDate: "2026-09-09",
            facilityCode: "quang",
            materialCode: code,
            quantity: "12",
          },
        },
      ],
    },
  });
  expect(overrun.status()).toBe(409);

  // Cancel the issue through the inline panel: balance back to 15, audit recorded.
  await outboundPanel
    .getByRole("button", { name: new RegExp(`^Hủy phiếu ${code} `) })
    .first()
    .click();
  const cancelPanel = page.getByRole("region", {
    name: "Xác nhận hủy phiếu xuất",
  });
  await expect(
    cancelPanel.getByRole("button", { name: "Hủy dòng này" }),
  ).toBeDisabled();
  await cancelPanel.getByLabel("Lý do hủy").fill("kiểm thử");
  await cancelPanel.getByRole("button", { name: "Hủy dòng này" }).click();
  await expect(page.getByRole("status").first()).toContainText(
    "Đã hủy phiếu xuất",
    { timeout: 45_000 },
  );
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get(`/api/materials/detail?id=${materialId}`)
          ).json()
        ).balance.currentQuantity,
      { timeout: 30_000 },
    )
    .toBe("15");

  // Material card from Tổng kho.
  await tabs.getByRole("tab", { name: "Tổng kho" }).click();
  await page.getByRole("tabpanel").getByLabel("Tìm vật tư").fill(code);
  await expect(summary).toContainText(code);
  await summary.getByRole("button", { name: code, exact: true }).click();
  const card = page.getByRole("region", { name: `Vật tư ${code}` });
  await expect(card).toContainText(`${code} · Vật tư kiểm thử UI`);
  await expect(card).toContainText("Tồn sau: 15");
  await expect(card).toContainText("Lịch sử thay đổi");
  await expect(card).toContainText("đã hủy phiếu xuất");
  await card.getByRole("button", { name: "Đóng" }).click();
  await expect(card).toHaveCount(0);

  // Export opens as a real workbook.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Xuất Excel" }).first().click(),
  ]);
  const file = path.join(tmpdir(), download.suggestedFilename());
  await download.saveAs(file);
  const book = XLSX.read(readFileSync(file), { cellDates: true });
  expect(book.SheetNames).toContain("Tong kho NVL");
  const sheet = book.Sheets["Tong kho NVL"]!;
  expect(sheet.C1?.v).toBe("KHO NGUYÊN VẬT LIỆU 2026");
  expect(sheet["!merges"]).toContainEqual({
    s: { r: 0, c: 2 },
    e: { r: 0, c: 10 },
  });
});

test("other roles see no menu, get not-found and 403", async ({ page }) => {
  for (const role of ["CONTENT_CREATOR", "COMPANY_ACCOUNTANT"] as const) {
    await signInAs(page, role);
    const nav = page.getByRole("navigation", {
      name: /Điều hướng quản trị|Administration navigation/,
    });
    await expect(
      nav.getByRole("link", { name: "Nguyên vật liệu" }),
    ).toHaveCount(0);
    await page.goto("/vi/admin/materials", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("tablist", { name: "Sổ kho" })).toHaveCount(0);
    expect((await page.request.get("/api/materials/summary")).status()).toBe(
      403,
    );
    const origin = new URL(page.url()).origin;
    expect(
      (
        await page.request.post("/api/materials/transactions", {
          headers: { origin },
          data: { changes: [] },
        })
      ).status(),
    ).toBe(403);
  }
  await signInAs(page, "DIRECTOR");
  await expect(
    page
      .getByRole("navigation", { name: /Điều hướng quản trị/ })
      .getByRole("link", { name: "Nguyên vật liệu" }),
  ).toBeVisible();
  expect((await page.request.get("/api/materials/summary")).status()).toBe(200);
});
