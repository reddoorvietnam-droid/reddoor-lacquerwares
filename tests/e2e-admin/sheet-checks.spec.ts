import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";

import { fixtureOrderCode, signInAs } from "./helpers";

/**
 * End-to-end walk of "Kiểm tra bảng biểu, dư nợ" against a running dev
 * server with `AI_PROVIDER=mock`: upload → column mapping → run → result →
 * export → assistant, through the E2E role sessions. Assertions are about
 * what the server did (rows reconciled against real records, denials on
 * the server, no money for readers without the permission), never about
 * the scripted provider's wording.
 *
 * Prerequisites: `npm run seed -- --with-demo`, the assistant fixture order
 * (`RD-20260906-E2E1`, scratchpad e2e-ai-fixture.ts) and the sheet fixture
 * (invoice INV-E2E-0001 4321.00 USD, receipts 2000.00 USD on 2026-08-15
 * allocated to it and 500.00 USD on 2026-08-20 unallocated; scratchpad
 * e2e-sheet-fixture.ts). Serial: later tests reuse the checks created
 * earlier. Files are named `e2e-*` so the fixture cleanup removes them.
 */
test.describe.configure({ mode: "serial" });

const CUSTOMER = "E2E AI Khách Kế Hoạch";
const UNKNOWN_ORDER = "RD-20260906-ZZZZ";

function workbookBytes(rows: unknown[][]): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const cashSheet = workbookBytes([
  ["CÔNG TY RED DOOR"],
  ["BÁO CÁO TIỀN VỀ THÁNG 8/2026"],
  [],
  ["STT", "Ngày", "Khách hàng", "Số tiền", "Loại tiền", "Ghi chú"],
  [1, "15/08/2026", CUSTOMER, "2,000.00", "USD", "CK E2E15082026"],
  [2, "20/08/2026", CUSTOMER, "500.00", "USD", "ứng trước"],
  [3, "25/08/2026", CUSTOMER, "300.00", "USD", "=1+1"],
  ["Tổng cộng", "", "", "2,800.00", "", ""],
]);

const orderSheet = workbookBytes([
  ["Mã đơn", "Khách hàng", "Trạng thái", "Giá trị"],
  [fixtureOrderCode, CUSTOMER, "Kế hoạch sản xuất", "4,321.00"],
  [UNKNOWN_ORDER, "Khách lạ", "Đang sản xuất", "1,000.00"],
]);

const receivablesCsv = Buffer.from(
  "﻿Khách hàng;Loại tiền;Dư nợ cuối kỳ\r\n" + `${CUSTOMER};USD;2,321.00\r\n`,
  "utf8",
);

const state = { cashId: "", orderId: "", receivablesId: "" };

/**
 * The scripted provider is refused in a production build, so the assistant
 * assertions may run against a second server (a dev server with
 * `AI_PROVIDER=mock`). Cookies are per host, not per port, so the session
 * from the sign-in above is already valid there.
 */
const assistantBase = process.env.E2E_ASSISTANT_BASE_URL ?? "";

type ChatBody = {
  text: string;
  provider: { kind: string; model: string };
  trace: { tool: string; ok: boolean; code: string | null }[];
  proposals: { status: string; items: { title: string }[] }[];
};

async function chatOn(
  page: Page,
  message: string,
): Promise<{ status: number; body: ChatBody }> {
  const response = await page.request.post(
    `${assistantBase}/api/assistant/chat`,
    { data: { message, history: [], locale: "vi" } },
  );
  return {
    status: response.status(),
    body: (await response.json().catch(() => null)) as ChatBody,
  };
}

/**
 * Whether that server answers with the scripted provider. The probe is a
 * greeting that maps to no tool, so it reads no business data.
 */
async function assistantIsScripted(page: Page): Promise<boolean> {
  const probe = await chatOn(page, "xin chào");
  return probe.status === 200 && probe.body?.provider?.kind === "mock";
}

async function uploadViaApi(
  page: Page,
  template: string,
  name: string,
  buffer: Buffer,
) {
  const response = await page.request.post("/api/sheet-checks", {
    headers: { accept: "application/json" },
    multipart: {
      template,
      locale: "vi",
      sheet: "",
      file: { name, mimeType: "application/octet-stream", buffer },
    },
  });
  return {
    status: response.status(),
    body: (await response.json().catch(() => null)) as {
      id?: string;
      error?: string;
    } | null,
  };
}

async function mainText(page: Page): Promise<string> {
  return ((await page.locator("#admin-main").textContent()) ?? "").replace(
    /\s+/g,
    " ",
  );
}

test("unauthenticated callers reach neither the pages nor the upload API", async ({
  page,
  request,
}) => {
  const upload = await request.post("/api/sheet-checks", {
    headers: { accept: "application/json" },
    multipart: {
      template: "generic",
      locale: "vi",
      file: {
        name: "e2e-anon.xlsx",
        mimeType: "application/octet-stream",
        buffer: orderSheet,
      },
    },
  });
  expect(upload.status()).toBe(401);
  await page.goto("/vi/admin/checks", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/vi\/admin\/sign-in/);
});

test("content creator: no menu entry, pages not found, upload refused", async ({
  page,
}) => {
  await signInAs(page, "CONTENT_CREATOR");
  const nav = page.getByRole("navigation", { name: /Điều hướng quản trị/ });
  await expect(
    nav.getByRole("link", { name: "Kiểm tra bảng biểu" }),
  ).toHaveCount(0);
  await page.goto("/vi/admin/checks", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText(/Không tìm thấy trang quản trị|not found/i),
  ).toBeVisible();
  const upload = await uploadViaApi(page, "generic", "e2e-cc.xlsx", orderSheet);
  expect(upload.status).toBe(403);
});

test("company accountant: cash-received report through the full flow", async ({
  page,
}) => {
  await signInAs(page, "COMPANY_ACCOUNTANT");
  const nav = page.getByRole("navigation", { name: /Điều hướng quản trị/ });
  await nav.getByRole("link", { name: "Kiểm tra bảng biểu" }).click();
  await expect(page).toHaveURL(/\/vi\/admin\/checks$/);
  await page.getByRole("link", { name: "Tải bảng mới" }).click();
  await expect(page).toHaveURL(/\/vi\/admin\/checks\/new/);

  // Three templates are offered to a global finance reader.
  await expect(page.locator('input[name="template"]')).toHaveCount(3);
  await page.locator('input[name="template"][value="incomingCash"]').check();
  await page.locator('input[name="file"]').setInputFiles({
    name: "e2e-tien-ve.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: cashSheet,
  });
  await page.getByRole("button", { name: "Đọc bảng" }).click();
  await page.waitForURL(/\/vi\/admin\/checks\/[a-f0-9]{24}$/, {
    timeout: 90_000,
  });
  state.cashId = /\/checks\/([a-f0-9]{24})/.exec(page.url())?.[1] ?? "";
  expect(state.cashId).toBeTruthy();

  // The mapping was proposed from the header row and the title line.
  await expect(
    page.getByRole("heading", { name: "Xác nhận cột" }),
  ).toBeVisible();
  await expect(page.locator('select[name="field.1"]')).toHaveValue("date");
  await expect(page.locator('select[name="field.2"]')).toHaveValue(
    "customerName",
  );
  await expect(page.locator('select[name="field.3"]')).toHaveValue("amount");
  await expect(page.locator('select[name="field.4"]')).toHaveValue("currency");
  await expect(page.locator('input[name="periodFrom"]')).toHaveValue(
    "2026-08-01",
  );
  await expect(page.locator('input[name="periodTo"]')).toHaveValue(
    "2026-08-31",
  );

  await page.getByRole("button", { name: "Chạy kiểm tra" }).click();
  await page.waitForURL(/\/vi\/admin\/checks\/[a-f0-9]{24}\?notice=checked/, {
    timeout: 90_000,
  });
  await page.goto(`/vi/admin/checks/${state.cashId}?filter=all`, {
    waitUntil: "domcontentloaded",
  });
  const text = await mainText(page);
  // Reconciled against the fixture receipts: two matched, one absent.
  expect(text).toContain("Khớp phiếu thu ngày 2026-08-15 2000.00 USD");
  expect(text).toContain("Khớp phiếu thu ngày 2026-08-20 500.00 USD");
  expect(text).toContain("Phiếu thu chưa gắn vào hóa đơn/đơn nào");
  expect(text).toContain(
    `Không có phiếu thu nào của ${CUSTOMER} quanh ngày 2026-08-25 với 300.00 USD`,
  );
  // The totals row of the sheet adds up; USD only, no combined figure.
  expect(text).toContain("Dòng tổng Số tiền (USD) khớp: 2800.00 USD");
  expect(text).toContain("Chưa đối soát với sao kê ngân hàng");

  // Export: BOM, CSV, and the formula-looking note is neutralised.
  const exported = await page.request.get(
    `/api/sheet-checks/${state.cashId}/export?locale=vi`,
  );
  expect(exported.status()).toBe(200);
  expect(exported.headers()["content-type"]).toContain("text/csv");
  const csv = await exported.text();
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain("'=1+1");
  expect(csv).not.toMatch(/(^|[",])=1\+1/);
});

test("company accountant: receivables statement compares balance and advance", async ({
  page,
}) => {
  await signInAs(page, "COMPANY_ACCOUNTANT");
  const upload = await uploadViaApi(
    page,
    "receivables",
    "e2e-cong-no.csv",
    receivablesCsv,
  );
  expect(upload.status).toBe(201);
  state.receivablesId = upload.body?.id ?? "";
  expect(state.receivablesId).toBeTruthy();

  await page.goto(`/vi/admin/checks/${state.receivablesId}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator('select[name="field.0"]')).toHaveValue(
    "customerName",
  );
  await expect(page.locator('select[name="field.2"]')).toHaveValue(
    "outstanding",
  );
  await page.getByRole("button", { name: "Chạy kiểm tra" }).click();
  await page.waitForURL(/\?notice=checked/, { timeout: 90_000 });
  await page.goto(`/vi/admin/checks/${state.receivablesId}?filter=all`, {
    waitUntil: "domcontentloaded",
  });
  const text = await mainText(page);
  // 4321 invoiced − 2000 allocated = 2321 outstanding; 500 unallocated is
  // an advance, so the true balance is 1821: the sheet matched the
  // outstanding figure and the advance is called out.
  expect(text).toContain(
    "Khớp với còn phải thu 2321.00 USD nhưng khách đang trả trước 500.00 USD; dư nợ thực là 1821.00 USD",
  );
});

test("factory accountant: money checks hidden on the server, order list works without money", async ({
  page,
}) => {
  await signInAs(page, "FACTORY_ACCOUNTANT");

  // The company accountant's cash check does not exist for this role.
  await page.goto(`/vi/admin/checks/${state.cashId}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByText(/Không tìm thấy trang quản trị|not found/i),
  ).toBeVisible();
  const exported = await page.request.get(
    `/api/sheet-checks/${state.cashId}/export?locale=vi`,
  );
  expect(exported.status()).toBe(404);
  test.skip(
    !(await assistantIsScripted(page)),
    "the assistant on this server is not the scripted provider",
  );
  const denied = await chatOn(
    page,
    `Kết quả kiểm tra bảng biểu ${state.cashId} thế nào?`,
  );
  expect(denied.status).toBe(200);
  expect(denied.body.provider.kind).toBe("mock");
  expect(denied.body.trace).toEqual([
    expect.objectContaining({
      tool: "get_sheet_check",
      ok: false,
      code: "PERMISSION_DENIED",
    }),
  ]);
  expect(JSON.stringify(denied.body)).not.toContain("2000.00");
  expect(JSON.stringify(denied.body)).not.toContain("e2e-tien-ve");

  // Money templates are refused on upload, whatever the form says.
  const refused = await uploadViaApi(
    page,
    "incomingCash",
    "e2e-fa-cash.xlsx",
    cashSheet,
  );
  expect(refused.status).toBe(403);

  // Only the order-list template is offered, and it runs without money.
  await page.goto("/vi/admin/checks/new", { waitUntil: "domcontentloaded" });
  await expect(page.locator('input[name="template"]')).toHaveCount(1);
  await expect(page.locator('input[name="template"]')).toHaveValue("generic");
  const upload = await uploadViaApi(
    page,
    "generic",
    "e2e-don-hang.xlsx",
    orderSheet,
  );
  expect(upload.status).toBe(201);
  state.orderId = upload.body?.id ?? "";
  await page.goto(`/vi/admin/checks/${state.orderId}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator('select[name="field.0"]')).toHaveValue("orderCode");
  await expect(page.locator('select[name="field.3"]')).toHaveValue("amount");
  // No selling-price toggle for a role without the permission.
  await expect(page.locator('input[name="compareSellingPrice"]')).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Chạy kiểm tra" }).click();
  await page.waitForURL(/\?notice=checked/, { timeout: 90_000 });
  await page.goto(`/vi/admin/checks/${state.orderId}?filter=all`, {
    waitUntil: "domcontentloaded",
  });
  const text = await mainText(page);
  expect(text).toContain(`Đơn ${fixtureOrderCode}:`);
  expect(text).toContain(
    `Không tìm thấy đơn ${UNKNOWN_ORDER} trong phạm vi của bạn`,
  );
  expect(text).toContain("Cột số tiền chỉ được kiểm tra định dạng và cộng dồn");
  expect(text).not.toContain("4.321");
  expect(text).not.toContain("Giá bán");

  const ok = await chatOn(page, `Kết quả kiểm tra bảng biểu ${state.orderId}?`);
  expect(ok.body.trace).toEqual([
    expect.objectContaining({ tool: "get_sheet_check", ok: true }),
  ]);
  expect(ok.body.text).toContain("e2e-don-hang.xlsx");
  expect(JSON.stringify(ok.body)).not.toContain("sellingPrice");
  expect(JSON.stringify(ok.body)).not.toContain("4321");
});

test("director: follow-ups from a check are proposals, nothing is created until approval", async ({
  page,
}) => {
  await signInAs(page, "DIRECTOR");
  test.skip(
    !(await assistantIsScripted(page)),
    "the assistant on this server is not the scripted provider",
  );
  const result = await chatOn(
    page,
    `Đề xuất việc theo dõi cho kiểm tra ${state.cashId}`,
  );
  expect(result.status).toBe(200);
  expect(result.body.trace).toEqual([
    expect.objectContaining({
      tool: "propose_sheet_check_follow_ups",
      ok: true,
    }),
  ]);
  expect(result.body.proposals.length).toBeGreaterThanOrEqual(1);
  expect(result.body.text).toContain("chờ duyệt");
  for (const proposal of result.body.proposals) {
    expect(proposal.status).toBe("proposed");
    for (const item of proposal.items) {
      expect(item.title).toMatch(/^Kiểm tra dòng \d+ «.+»: .+$/);
      expect(item.title).not.toMatch(/\d[\d.,]{3,}/);
    }
  }

  // The proposal waits on the tasks page; no task carries its title yet.
  await page.goto("/vi/admin/tasks?filter=all", {
    waitUntil: "domcontentloaded",
  });
  const text = await mainText(page);
  expect(text).toContain("Đề xuất của trợ lý chờ duyệt");
  expect(text).toContain("e2e-tien-ve.xlsx");
});
