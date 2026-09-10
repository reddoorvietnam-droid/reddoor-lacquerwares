import { test, expect, type Page } from "@playwright/test";
import Decimal from "decimal.js";
import { signInAs } from "./helpers";
import type {
  Master,
  PaintRow,
} from "../../src/domains/paint-warehouse/contracts";

async function request(page: Page, method: string, body?: unknown, query = "") {
  return page.evaluate(
    async ({ method, body, query }) => {
      const response = await fetch(`/api/paint-warehouse${query}`, {
        method,
        headers: { "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, data: await response.json() };
    },
    { method, body, query },
  );
}

/** Mirrors the page's thousands grouping so derived cells can be asserted. */
function group(value: string): string {
  const [integer, fraction] = value.split(".");
  const grouped = integer!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/** A vật tư with an đơn giá is what makes the derived Thành tiền checkable. */
const pricedMaterial = (
  master: Master,
): master is Master & { unitPrice: string } =>
  master.kind === "material" && master.unitPrice !== null && master.unit !== "";

test("storekeeper adds a dòng in the editor, edits the discounted price, reloads, deletes and exports", async ({
  page,
}) => {
  await signInAs(page, "WAREHOUSE_MANAGER");
  await expect(
    page.getByRole("link", { name: "Bảng xuất kho sơn" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Bảng xuất kho sơn" }).click();
  // The toolbar status is the first role=status; the notice card follows it.
  const status = page.getByRole("status").first();
  await expect(status).toContainText("Đã tải dữ liệu", { timeout: 60000 });
  // The sổ is paged at 200 rows, so one screen never renders the whole ledger.
  expect(await page.getByRole("row").count()).toBeLessThanOrEqual(201);
  await page.screenshot({
    path: "test-results/paint-warehouse-desktop.png",
    fullPage: true,
  });

  const catalogue = (await request(page, "GET", undefined, "?masters=1")).data
    .masters as Master[];
  const material = catalogue.find(pricedMaterial);
  const facility = catalogue.find(
    (master) => master.kind === "facility" && master.name !== "",
  );
  if (!material || !facility)
    throw new Error(
      "Danh mục sơn trống — chạy npm run import:paint trước khi test.",
    );

  const marker = `E2E-PAINT-${Date.now()}`;
  const amount = group(new Decimal("2.5").mul(material.unitPrice).toFixed());
  const filter = page.getByRole("textbox", { name: "Tìm vật tư hoặc cơ sở" });
  const apply = page.getByRole("button", { name: "Lọc", exact: true });
  const row = page.getByRole("row").filter({ hasText: marker });
  try {
    // 1. A new phiếu through the inline editor, with every derived cell read
    //    back from the danh mục before anything is written.
    await page.getByRole("button", { name: "+ Thêm phiếu xuất" }).click();
    const form = page.getByRole("form", { name: "Thêm phiếu xuất" });
    await form.getByLabel("Mã cơ sở SX", { exact: true }).fill(facility.code);
    await form.getByLabel("Mã vật tư", { exact: true }).fill(material.code);
    await expect(
      form.getByRole("textbox", { name: "Tên cơ sở SX" }),
    ).toHaveValue(facility.name);
    await expect(form.getByRole("textbox", { name: "Vật tư" })).toHaveValue(
      material.name,
    );
    await expect(form.getByRole("textbox", { name: "ĐVT" })).toHaveValue(
      material.unit,
    );
    await form
      .getByRole("textbox", { name: "Số lượng", exact: true })
      .fill("2.5");
    await expect(
      form.getByRole("textbox", { name: "Thành tiền", exact: true }),
    ).toHaveValue(amount);
    await form.getByRole("textbox", { name: "Số lượng thực nhận" }).fill("3");
    await form
      .getByRole("textbox", { name: "Đơn giá đã chiết khấu" })
      .fill("120000");
    await expect(
      form.getByRole("textbox", { name: "Thành tiền thực nhận" }),
    ).toHaveValue("360,000");
    await form.getByRole("textbox", { name: "Ghi chú" }).fill(marker);
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/paint-warehouse") &&
        response.request().method() === "POST",
    );
    await form.getByRole("button", { name: "Áp dụng" }).click();
    expect((await created).status()).toBe(200);
    await expect(page.getByText(/^Đã ghi dòng/)).toBeVisible();

    // 2. The written dòng, as the table shows it.
    await filter.fill(marker);
    await apply.click();
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(material.name);
    await expect(row.getByRole("cell").nth(12)).toHaveText("360,000");
    // The chiết khấu column keeps the workbook's "sửa được bằng tay" signal.
    await expect(row.getByRole("cell").nth(11)).toHaveAttribute(
      "title",
      /chiết khấu/,
    );
    let read = await request(page, "GET", undefined, `?q=${marker}`);
    expect(read.data.rows).toHaveLength(1);
    expect(read.data.rows[0]).toMatchObject({
      quantity: "2.5",
      actualQuantity: "3",
      discountedUnitPrice: "120000",
      actualAmount: "360000",
      facilityNameSnapshot: facility.name,
    });

    // 3. Editing the discounted price re-derives Thành tiền thực nhận.
    await row.getByRole("button", { name: /^Sửa dòng / }).click();
    const editor = page.getByRole("form", { name: "Sửa phiếu xuất" });
    await editor
      .getByRole("textbox", { name: "Đơn giá đã chiết khấu" })
      .fill("100000");
    await expect(
      editor.getByRole("textbox", { name: "Thành tiền thực nhận" }),
    ).toHaveValue("300,000");
    const updated = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/paint-warehouse") &&
        response.request().method() === "POST",
    );
    await editor.getByRole("button", { name: "Áp dụng" }).click();
    expect((await updated).status()).toBe(200);
    await expect(page.getByText(/^Đã cập nhật dòng/)).toBeVisible();
    read = await request(page, "GET", undefined, `?q=${marker}`);
    expect(read.data.rows[0].actualAmount).toBe("300000");

    // 4. A reload shows the same booked line (filters are not kept in the URL).
    await page.reload();
    await expect(status).toContainText("Đã tải dữ liệu");
    await filter.fill(marker);
    await apply.click();
    await expect(row).toHaveCount(1);
    await expect(row.getByRole("cell").nth(12)).toHaveText("300,000");

    // 5. Deleting needs the inline confirmation.
    await row.getByRole("button", { name: /^Xóa dòng / }).click();
    const confirm = page.getByRole("region", { name: "Xác nhận xóa dòng" });
    await expect(confirm).toContainText(material.name);
    await confirm
      .getByRole("button", { name: "Xóa dòng", exact: true })
      .click();
    await expect(page.getByText(/^Đã xóa dòng/)).toBeVisible();
    await expect(row).toHaveCount(0);

    // 6. The whole sổ still exports once the bộ lọc is cleared.
    await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
    await expect(status).toContainText("Đã tải dữ liệu");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Xuất Excel" }).click();
    await (await download).saveAs("test-results/paint-warehouse-export.xlsx");
  } finally {
    // Whatever the run left behind carries the marker in its Ghi chú.
    const read = await request(page, "GET", undefined, `?q=${marker}`);
    for (const leftover of (read.data.rows ?? []) as PaintRow[])
      await request(page, "DELETE", {
        id: leftover.id,
        version: leftover.version,
      });
  }
});

test("two sessions cannot lose updates; a stale paste is atomic", async ({
  page,
  context,
}) => {
  await signInAs(page, "WAREHOUSE_MANAGER");
  const id = crypto.randomUUID(),
    secondId = crypto.randomUUID(),
    marker = `E2E-CONFLICT-${Date.now()}`;
  const created = await request(page, "POST", {
    changes: [
      { id, version: 0, patch: { note: marker, exportDate: "2026-09-09" } },
      {
        id: secondId,
        version: 0,
        patch: { note: marker, exportDate: "2026-09-09" },
      },
    ],
  });
  expect(created.status).toBe(200);
  const second = await context.newPage();
  await second.goto("/vi/admin/paint-warehouse");
  try {
    expect(
      (
        await request(second, "POST", {
          changes: [{ id, version: 1, patch: { quantity: "2" } }],
        })
      ).status,
    ).toBe(200);
    const conflict = await request(page, "POST", {
      changes: [
        { id: secondId, version: 1, patch: { quantity: "99" } },
        { id, version: 1, patch: { quantity: "3" } },
      ],
    });
    expect(conflict.status).toBe(409);
    const read = await request(page, "GET", undefined, `?q=${marker}`);
    expect(read.data.rows.find((r: PaintRow) => r.id === id).quantity).toBe(
      "2",
    );
    expect(
      read.data.rows.find((r: PaintRow) => r.id === secondId).quantity,
    ).toBeNull();
    expect(
      (
        await request(page, "POST", {
          changes: [{ id, version: 2, patch: { amount: "999" } }],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(page, "POST", {
          changes: [
            { id, version: 2, patch: { materialCode: "MISSING-E2E-CODE" } },
          ],
        })
      ).status,
    ).toBe(400);
  } finally {
    const read = await request(page, "GET", undefined, `?q=${marker}`);
    for (const row of read.data.rows as PaintRow[])
      await request(page, "DELETE", { id: row.id, version: row.version });
    await second.close();
  }
});

test("content editor is denied page, list, export and mutation", async ({
  page,
}) => {
  await signInAs(page, "CONTENT_CREATOR");
  await expect(
    page.getByRole("link", { name: "Bảng xuất kho sơn" }),
  ).toHaveCount(0);
  for (const query of ["", "?export=1", "?masters=1"])
    expect((await request(page, "GET", undefined, query)).status).toBe(403);
  expect((await request(page, "POST", { changes: [] })).status).toBe(403);
  expect(
    (await request(page, "DELETE", { id: "test", version: 1 })).status,
  ).toBe(403);
});
