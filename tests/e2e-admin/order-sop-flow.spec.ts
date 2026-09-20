import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

import { signInAs } from "./helpers";

/**
 * Files a customer label spec on the order straight in the database: the
 * real upload needs Cloudinary, and the guard under test is the step-7 exit.
 */
function fileCustomerLabelSpec(code: string) {
  execFileSync(
    "npx",
    [
      "tsx",
      "--env-file-if-exists=.env",
      "--conditions=react-server",
      "tests/e2e-admin/order-sop-fixture.ts",
      code,
    ],
    { stdio: "inherit", shell: process.platform === "win32" },
  );
}

/**
 * One order walks the production procedure (SOP-SX-001) from the customer's
 * order to the export-document step, each position doing its own part, and
 * every output guard refuses the move until the output is on file. Stops at
 * step 8 because filing the INV and PKL needs a real Cloudinary upload.
 *
 * Creates one order with the `E2E-SOP-` prefix in the configured database;
 * `npm run test:e2e:admin:cleanup:sop` removes it.
 */

const orderCode = `E2E-SOP-${Date.now().toString(36).toUpperCase()}`;

async function expectNotice(page: Page, notice: string) {
  await page.waitForURL(new RegExp(`notice=${notice}$`), { timeout: 90_000 });
}

async function expectError(page: Page, message: string) {
  await page.waitForURL(/error=/, { timeout: 90_000 });
  await expect(page.getByText(message)).toBeVisible();
}

async function move(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
}

async function currentStage(page: Page, label: string) {
  await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
}

test.describe.configure({ mode: "serial" });

let orderPath = "";

test("the Factory Manager records the order with its lines and submits it", async ({
  page,
}) => {
  await signInAs(page, "FACTORY_MANAGER");
  await page.goto("/vi/admin/orders/new");
  await expect(
    page.getByRole("heading", { level: 1, name: "Khách hàng đặt hàng" }),
  ).toBeVisible();
  // The Factory Manager never sees the selling price, so the form has no
  // price field at all.
  await expect(page.locator("#order-price")).toHaveCount(0);

  await page.locator("#order-customer").selectOption({ index: 1 });
  await page.locator("#order-code").fill(orderCode);
  const unit = page.locator('input[name="businessUnitIds"]').first();
  if (!(await unit.isChecked())) await unit.check();

  const line = page.locator("table tbody tr").first();
  await line.locator("input").nth(0).fill("RD-BOWL-01");
  await line.locator("input").nth(1).fill("Bát sơn mài đỏ");
  await line.locator("input").nth(2).fill("120");
  await line.locator("input").nth(4).fill("Cơ sở E2E");
  await page.locator("#order-shipping-mark").fill("E2E / PO 1");
  await page.locator("#order-delivery-due").fill("2026-12-31");
  await page.getByRole("button", { name: "Ghi nhận đơn hàng" }).click();

  await page.waitForURL(/\/vi\/admin\/orders\/[a-f0-9]{24}\?notice=created$/, {
    timeout: 90_000,
  });
  orderPath = new URL(page.url()).pathname;
  await currentStage(page, "1 · Khách hàng đặt hàng");
  await expect(page.getByText("RD-BOWL-01")).toBeVisible();
  // The Factory Manager edits the order, so the shipping mark sits in the
  // edit form rather than as read-only text.
  await expect(page.locator("#details-shipping-mark")).toHaveValue(
    "E2E / PO 1",
  );
  await expect(page.getByText(/Hạn giao/)).toBeVisible();

  await move(page, "Giám đốc xác nhận đơn hàng");
  await expectNotice(page, "moved");
  await page.getByRole("button", { name: "Trình Giám đốc phê duyệt" }).click();
  await expectNotice(page, "approvalRequested");
});

test("the Director confirms the order and hands it to sample confirmation", async ({
  page,
}) => {
  await signInAs(page, "DIRECTOR");
  await page.goto("/vi/admin/approvals");
  const card = page.locator("li", { hasText: orderCode }).first();
  await card.getByRole("button", { name: "Phê duyệt" }).click();
  await page.waitForURL(/notice=decided/, { timeout: 90_000 });

  await page.goto(orderPath);
  await expect(
    page.getByText("Đã được phê duyệt và còn hiệu lực."),
  ).toBeVisible();
  await move(page, "Xác nhận mẫu & kỹ thuật");
  await expectNotice(page, "moved");
  await currentStage(page, "2 · Xác nhận mẫu & kỹ thuật");
});

test("the Factory Manager confirms the sample and cannot leave planning without a plan", async ({
  page,
}) => {
  await signInAs(page, "FACTORY_MANAGER");
  await page.goto(orderPath);
  await move(page, "Lập kế hoạch sản xuất");
  await expectNotice(page, "moved");
  await currentStage(page, "3 · Lập kế hoạch sản xuất");
  await expect(page.getByText(/chưa lưu kế hoạch sản xuất/)).toBeVisible();

  await move(page, "Kho cấp vật tư");
  await expectError(page, "Phải lưu kế hoạch sản xuất trước khi rời bước 3.");

  await page.locator("#plan-woodworkDue").fill("2026-10-10");
  await page.locator("#plan-finishingDue").fill("2026-11-20");
  await page.locator("#plan-assignment").fill("Cơ sở E2E làm mộc và sơn");
  await page.getByRole("button", { name: "Lưu kế hoạch" }).click();
  await expectNotice(page, "planSaved");

  await move(page, "Kho cấp vật tư");
  await expectNotice(page, "moved");
  await currentStage(page, "4 · Kho cấp vật tư");
});

test("the Storekeeper issues material and production starts at woodwork", async ({
  page,
}) => {
  await signInAs(page, "WAREHOUSE_MANAGER");
  await page.goto(orderPath);
  await expect(
    page.getByText("Bạn không có quyền xem giá bán của đơn này."),
  ).toBeVisible();
  await move(page, "Sản xuất");
  await expectNotice(page, "moved");
  await currentStage(page, "5 · Sản xuất");
});

test("the Factory Manager runs the three workshop stages and the finishing inspection", async ({
  page,
}) => {
  await signInAs(page, "FACTORY_MANAGER");
  await page.goto(orderPath);

  // Lacquer waits for the raw-body inspection.
  await move(page, "Chuyển sang: Sơn");
  await expectError(page, "Kiểm mộc phải đạt thì mới chuyển sang Sơn.");

  await page.locator("#qc-defects").fill("2");
  await page.locator("#qc-note").fill("Hai bát nứt cốt, đã loại");
  await page.getByRole("button", { name: "Ghi kết quả" }).click();
  await expectNotice(page, "qcChecked");
  await expect(page.getByText("Kiểm mộc: Đạt")).toBeVisible();

  await move(page, "Chuyển sang: Sơn");
  await expectNotice(page, "productionStageSet");
  // Quality control waits for the finishing stage.
  await move(page, "Kiểm tra chất lượng (QC)");
  await expectError(
    page,
    "Đơn phải ở công đoạn Hoàn thiện mới sang kiểm tra chất lượng.",
  );
  await move(page, "Chuyển sang: Hoàn thiện");
  await expectNotice(page, "productionStageSet");
  await move(page, "Kiểm tra chất lượng (QC)");
  await expectNotice(page, "moved");
  await currentStage(page, "6 · Kiểm tra chất lượng (QC)");

  // Packing waits for the finishing inspection.
  await move(page, "Đóng gói & nhập thành phẩm");
  await expectError(
    page,
    "Chưa ghi kiểm hoàn thiện đạt thì không được đóng gói.",
  );
  await page.locator("#qc-defects").fill("0");
  await page.getByRole("button", { name: "Ghi kết quả" }).click();
  await expectNotice(page, "qcChecked");
  await expect(page.getByText("Kiểm hoàn thiện: Đạt")).toBeVisible();
  await expect(page.getByText(/Tỷ lệ lỗi: 1\.7%/)).toBeVisible();

  await move(page, "Đóng gói & nhập thành phẩm");
  await expectNotice(page, "moved");
  await currentStage(page, "7 · Đóng gói & nhập thành phẩm");
});

test("packing needs the Storekeeper's slip, the Factory Manager's packing inspection and a settled label template", async ({
  page,
}) => {
  await signInAs(page, "WAREHOUSE_MANAGER");
  await page.goto(orderPath);
  await move(page, "Lập chứng từ xuất hàng");
  await expectError(
    page,
    "Cần phiếu đóng gói của Thủ kho và kiểm đóng gói đạt trước khi rời bước 7.",
  );

  await page.locator("#packing-date").fill("2026-11-25");
  await page.locator("#packing-cartons").fill("40");
  await page.locator("#packing-pallets").fill("2");
  await page.getByRole("button", { name: "Lưu phiếu đóng gói" }).click();
  await expectNotice(page, "packingSaved");

  await signInAs(page, "FACTORY_MANAGER");
  await page.goto(orderPath);
  await page.getByRole("button", { name: "Ghi kết quả" }).click();
  await expectNotice(page, "qcChecked");
  await expect(page.getByText("Kiểm đóng gói: Đạt")).toBeVisible();

  // Slip and inspection are in, but no label template is on file yet.
  await signInAs(page, "WAREHOUSE_MANAGER");
  await page.goto(orderPath);
  await expect(
    page.getByText("Chưa có mẫu tem", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/chưa có mẫu tem của khách hoặc mẫu tem công ty/),
  ).toBeVisible();
  await move(page, "Lập chứng từ xuất hàng");
  await expectError(
    page,
    "Cần mẫu tem, shipping mark của khách, hoặc mẫu công ty đã được Giám đốc duyệt, trước khi rời bước 7.",
  );

  fileCustomerLabelSpec(orderCode);
  await page.goto(orderPath);
  await expect(
    page.getByText("Theo mẫu của khách", { exact: true }),
  ).toBeVisible();
  await move(page, "Lập chứng từ xuất hàng");
  await expectNotice(page, "moved");
  await currentStage(page, "8 · Lập chứng từ xuất hàng");
});

test("the Factory Accountant reads the price and the document checklist but never the customer's money", async ({
  page,
}) => {
  await signInAs(page, "FACTORY_ACCOUNTANT");
  await page.goto(orderPath);
  // Price card readable (no price entered on this order), money card absent.
  await expect(page.getByText("Chưa nhập giá bán.")).toBeVisible();
  await expect(page.getByText("Tiền của đơn")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Hóa đơn (INV)" }),
  ).toBeVisible();
  await expect(page.getByText(/chưa tải INV và PKL/)).toBeVisible();
  await expect(page.getByText("Invoice (INV)", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Packing List (PKL)", { exact: true }),
  ).toBeVisible();

  await move(page, "Thủ tục xuất nhập khẩu");
  await expectError(page, "Phải tải INV và PKL lên trước khi rời bước 8.");

  await page.goto("/vi/admin/finance/invoices");
  await expect(
    page.getByRole("heading", { level: 1, name: "Hóa đơn (INV)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Còn thiếu" }),
  ).toHaveCount(0);

  // The stale "not implemented" note is gone from the process reference.
  await page.goto("/vi/admin/operations");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Mười một bước của một đơn hàng",
    }),
  ).toBeVisible();
  await expect(page.getByText(/chưa hoạt động/)).toHaveCount(0);
  await expect(
    page.locator("text=Xác nhận mẫu & kỹ thuật").first(),
  ).toBeVisible();
});

test("the order book shows the delivery date and the current SOP step", async ({
  page,
}) => {
  await signInAs(page, "COMPANY_ACCOUNTANT");
  await page.goto("/vi/admin/orders");
  const row = page.locator("tr", { hasText: orderCode }).first();
  await expect(row).toContainText("8 · Lập chứng từ xuất hàng");
  await expect(row).toContainText("2026");
});
