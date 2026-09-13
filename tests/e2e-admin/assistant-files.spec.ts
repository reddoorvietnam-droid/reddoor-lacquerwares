import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers";

/**
 * Attachments and stored conversations, end to end through the chat page,
 * against a running dev server with `AI_PROVIDER=mock`.
 *
 * What is asserted is what the server did, never what the scripted provider
 * said: that a file was read on the server (its extracted text comes back as
 * the preview), that the turn was recorded under the person who asked, that
 * the transcript survives a full reload, and that deleting it removes it for
 * good. The wording of the answer is the provider's business.
 *
 * Prerequisites: `npm run seed -- --with-demo`, the E2E role sessions (global
 * setup) and `AI_PROVIDER=mock`. The conversation is deleted by the last step, so the
 * spec leaves nothing behind in the development database.
 */
test.describe.configure({ mode: "serial" });

const QUESTION = "Tệp đính kèm này có mã đơn nào?";
const MARKER = "RD-E2E-TROLY-1";
const FILE_NAME = "e2e-tro-ly.csv";

const csv = Buffer.from(
  ["Mã đơn;Khách hàng;Số tiền", `${MARKER};Khách E2E;1.234,00`].join("\r\n"),
  "utf8",
);

test("a file is read on the server, and the conversation survives a reload", async ({
  page,
}) => {
  await signInAs(page, "DIRECTOR");
  await page.goto("/vi/admin/assistant", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#assistant-input")).toBeVisible();
  // The scripted provider is the only one this spec may talk to.
  await expect(page.getByText("GIẢ LẬP").first()).toBeVisible();

  const composer = page.getByTestId("assistant-composer");
  const history = page.locator("#assistant-history");
  const turns = page.locator('ol[aria-live="polite"] > li');

  // A conversation of its own, whatever the account did before.
  await page.getByRole("button", { name: "Hội thoại mới" }).click();
  await expect(turns).toHaveCount(0);

  await composer.locator('input[name="attachment"]').setInputFiles({
    name: FILE_NAME,
    mimeType: "text/csv",
    buffer: csv,
  });
  await expect(composer.getByText(FILE_NAME)).toBeVisible({ timeout: 60_000 });

  // The chip's preview is the text the server extracted; the original file
  // was never stored, so this is the only evidence the read happened.
  await composer.getByText("Đã đọc được gì").click();
  await expect(composer).toContainText(MARKER);

  await page.locator("#assistant-input").fill(QUESTION);
  await page.getByRole("button", { name: /^Gửi$/ }).click();
  await expect(turns).toHaveCount(2, { timeout: 90_000 });
  // The question keeps its file beside it, and the composer is cleared so
  // the next turn does not silently re-send the same attachment.
  await expect(turns.first()).toContainText(FILE_NAME);
  await expect(composer.getByText(FILE_NAME)).toHaveCount(0);

  // The turn was recorded: the list is server-rendered, so a full reload is
  // what proves it, not the state this page is holding.
  await expect(history.getByText(QUESTION)).toBeVisible({ timeout: 30_000 });
  await page.reload({ waitUntil: "domcontentloaded" });

  const row = page
    .locator("#assistant-history li")
    .filter({ hasText: QUESTION });
  await expect(row).toHaveCount(1);
  // The reload lands back in the same conversation: its id is in the URL and
  // the transcript is rendered on the server. Before that, a reload dropped
  // the transcript and the next question silently opened a new conversation.
  await expect(page).toHaveURL(/[?&]c=[a-f0-9]{24}/);
  await expect(turns).toHaveCount(2);

  await row.locator("button").first().click();
  await expect(turns).toHaveCount(2, { timeout: 30_000 });
  await expect(turns.first()).toContainText(QUESTION);
  await expect(turns.first()).toContainText(FILE_NAME);

  // Two presses: the first arms the delete, exactly like the admin rows.
  await row.getByRole("button", { name: "Xóa" }).click();
  await row.getByRole("button", { name: "Xóa hẳn?" }).click();
  await expect(row).toHaveCount(0, { timeout: 30_000 });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.locator("#assistant-history li").filter({ hasText: QUESTION }),
  ).toHaveCount(0);
});

test("another account cannot open the conversation by its id", async ({
  page,
}) => {
  // Owner-only is a property of the query, not of a permission, so it is
  // worth one assertion of its own: a Director's id is unreadable to anyone
  // else, and the refusal is NOT_FOUND rather than a telling FORBIDDEN.
  await signInAs(page, "DIRECTOR");
  const created = await page.request.post("/api/assistant/chat", {
    data: { message: "Hôm nay tôi cần làm gì?", history: [], locale: "vi" },
  });
  expect(created.status()).toBe(200);
  const { conversationId } = (await created.json()) as {
    conversationId: string | null;
  };
  expect(conversationId).toMatch(/^[a-f0-9]{24}$/);

  await signInAs(page, "COMPANY_ACCOUNTANT");
  const stolen = await page.request.get(
    `/api/assistant/conversations/${conversationId}`,
  );
  expect(stolen.status()).toBe(404);
  const listed = await page.request.get("/api/assistant/conversations");
  expect(listed.status()).toBe(200);
  const { conversations } = (await listed.json()) as {
    conversations: { id: string }[];
  };
  expect(conversations.map((entry) => entry.id)).not.toContain(conversationId);

  // Clean up as the owner.
  await signInAs(page, "DIRECTOR");
  const removed = await page.request.delete(
    `/api/assistant/conversations/${conversationId}`,
  );
  expect(removed.status()).toBe(204);
});
