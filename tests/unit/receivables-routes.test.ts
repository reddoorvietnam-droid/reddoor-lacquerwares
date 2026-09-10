import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReceivablesError } from "@/domains/receivables/contracts";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";

/**
 * Every `/api/receivables/*` endpoint has to enforce its own permission on the
 * server. Hiding a menu item is not access control: these tests call the route
 * handlers directly, the way a curl against the URL would.
 */

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  capabilities: vi.fn(),
  canReadAmounts: vi.fn(),
  readSummary: vi.fn(),
  readLookups: vi.fn(),
  listEntries: vi.fn(),
  recordSale: vi.fn(),
  recordSaleBatch: vi.fn(),
  updateEntry: vi.fn(),
  saveCatalogueItem: vi.fn(),
  recordReduction: vi.fn(),
  postEntry: vi.fn(),
  cancelEntry: vi.fn(),
  setOpeningBalance: vi.fn(),
  saveCustomer: vi.fn(),
  readCustomerDetail: vi.fn(),
  readHistory: vi.fn(),
  buildExportInput: vi.fn(),
  buildWorkbook: vi.fn(),
  findById: vi.fn(),
}));

vi.mock("@/domains/receivables/access", () => ({
  requireReceivablesAccess: mocks.access,
  receivablesCapabilities: mocks.capabilities,
  canReadAmounts: mocks.canReadAmounts,
  canSeeReceivables: vi.fn(),
}));
vi.mock("@/domains/receivables/service", () => ({
  readSummary: mocks.readSummary,
  readLookups: mocks.readLookups,
  listEntries: mocks.listEntries,
  recordSale: mocks.recordSale,
  recordSaleBatch: mocks.recordSaleBatch,
  updateEntry: mocks.updateEntry,
  saveCatalogueItem: mocks.saveCatalogueItem,
  recordReduction: mocks.recordReduction,
  postEntry: mocks.postEntry,
  cancelEntry: mocks.cancelEntry,
  setOpeningBalance: mocks.setOpeningBalance,
  saveCustomer: mocks.saveCustomer,
  readCustomerDetail: mocks.readCustomerDetail,
  readHistory: mocks.readHistory,
  buildExportInput: mocks.buildExportInput,
}));
vi.mock("@/domains/receivables/export-workbook", () => ({
  buildWorkbook: mocks.buildWorkbook,
  exportFileNames: {
    all: "CONG-NO-2026.xlsx",
    summary: "TONG-HOP-CONG-NO.xlsx",
  },
  statementFileName: (code: string) => `CONG-NO-${code}.xlsx`,
}));
vi.mock("@/domains/identity/models", () => ({
  getUserModel: () => ({
    findById: mocks.findById,
  }),
}));

import * as summary from "@/app/api/receivables/summary/route";
import * as lookups from "@/app/api/receivables/lookups/route";
import * as entries from "@/app/api/receivables/entries/route";
import * as post from "@/app/api/receivables/entries/post/route";
import * as cancel from "@/app/api/receivables/entries/cancel/route";
import * as opening from "@/app/api/receivables/opening-balance/route";
import * as customers from "@/app/api/receivables/customers/route";
import * as customerDetail from "@/app/api/receivables/customers/[customerId]/route";
import * as history from "@/app/api/receivables/history/route";
import * as catalogue from "@/app/api/receivables/catalogue/route";
import * as exportRoute from "@/app/api/receivables/export/route";

const actor = { userId: "user-1", actorType: "user" };
const sameOrigin = { origin: "http://localhost", host: "localhost" };
const get = (path: string) =>
  new Request(`http://localhost/api/receivables/${path}`);
const write = (
  path: string,
  body: unknown,
  headers: Record<string, string> = sameOrigin,
) =>
  new Request(`http://localhost/api/receivables/${path}`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const serviceCalls = () => [
  mocks.readSummary,
  mocks.readLookups,
  mocks.listEntries,
  mocks.recordSale,
  mocks.recordReduction,
  mocks.postEntry,
  mocks.cancelEntry,
  mocks.setOpeningBalance,
  mocks.saveCustomer,
  mocks.readCustomerDetail,
  mocks.readHistory,
  mocks.buildExportInput,
  mocks.recordSaleBatch,
  mocks.updateEntry,
  mocks.saveCatalogueItem,
];
const noServiceCalls = () => {
  for (const fn of serviceCalls()) expect(fn).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("guards run before any data is touched", () => {
  const denied = () =>
    mocks.access.mockRejectedValue(
      new ContentAccessDeniedError("PERMISSION_DENIED"),
    );

  it.each([
    ["summary", () => summary.GET(get("summary"))],
    ["lookups", () => lookups.GET()],
    ["entries", () => entries.GET(get("entries"))],
    ["history", () => history.GET(get("history"))],
    ["customers", () => customers.GET()],
    [
      "customer detail",
      () =>
        customerDetail.GET(get("customers/abc"), {
          params: Promise.resolve({ customerId: "abc" }),
        }),
    ],
    ["export", () => exportRoute.GET(get("export"))],
  ])("%s refuses a reader without the permission", async (_name, call) => {
    denied();
    const response = await call();
    expect(response.status).toBe(403);
    noServiceCalls();
  });

  it.each([
    [
      "record an entry",
      () => entries.POST(write("entries", { kind: "reduction", amount: "1" })),
    ],
    ["post a draft", () => post.POST(write("entries/post", { id: "e1" }))],
    ["cancel", () => cancel.POST(write("entries/cancel", { id: "e1" }))],
    [
      "restate the opening balance",
      () => opening.POST(write("opening-balance", { customerId: "c1" })),
    ],
    [
      "save a customer",
      () => customers.POST(write("customers", { patch: {} })),
    ],
  ])("%s refuses a reader without the permission", async (_name, call) => {
    denied();
    const response = await call();
    expect(response.status).toBe(403);
    noServiceCalls();
  });

  it("answers 401, not 403, when nobody is signed in", async () => {
    mocks.access.mockRejectedValue(
      new ContentAccessDeniedError("UNAUTHENTICATED"),
    );
    expect((await summary.GET(get("summary"))).status).toBe(401);
  });
});

describe("each write asks for its own permission", () => {
  beforeEach(() => {
    mocks.access.mockResolvedValue(actor);
  });

  it("a sale needs recordSale, a reduction needs recordReduction", async () => {
    mocks.recordSale.mockResolvedValue({ id: "e1" });
    await entries.POST(
      write("entries", { kind: "sale", customerId: "c1", quantity: "1" }),
    );
    expect(mocks.access).toHaveBeenCalledWith("recordSale");
    // The discriminator never reaches the service.
    expect(mocks.recordSale.mock.calls[0]?.[0]).not.toHaveProperty("kind");

    vi.resetAllMocks();
    mocks.access.mockResolvedValue(actor);
    mocks.recordReduction.mockResolvedValue({ id: "e2" });
    await entries.POST(write("entries", { kind: "reduction", amount: "1" }));
    expect(mocks.access).toHaveBeenCalledWith("recordReduction");
  });

  it("a multi-item sale needs recordSale", async () => {
    mocks.recordSaleBatch.mockResolvedValue([{ id: "e1" }]);
    await entries.POST(
      write("entries", { kind: "saleBatch", customerId: "c1", lines: [] }),
    );
    expect(mocks.access).toHaveBeenCalledWith("recordSale");
    // The discriminator never reaches the service.
    expect(mocks.recordSaleBatch.mock.calls[0]?.[0]).not.toHaveProperty("kind");
  });

  it("editing a line needs its own permission, not recordSale", async () => {
    // A role could be allowed to write the book without rewriting it.
    mocks.updateEntry.mockResolvedValue({ id: "e1" });
    await entries.PATCH(
      write("entries", { id: "e1", version: 1, patch: { amount: "1" } }),
    );
    expect(mocks.access).toHaveBeenCalledWith("updateEntry");
    expect(mocks.access).not.toHaveBeenCalledWith("recordSale");
  });

  it("adding a paint code needs manageCatalog", async () => {
    mocks.saveCatalogueItem.mockResolvedValue({ code: "X" });
    await catalogue.POST(write("catalogue", { code: "X", name: "", unit: "" }));
    expect(mocks.access).toHaveBeenCalledWith("manageCatalog");
  });

  it("cancelling needs cancelEntry", async () => {
    mocks.cancelEntry.mockResolvedValue({ id: "e1" });
    await cancel.POST(
      write("entries/cancel", { id: "e1", version: 1, reason: "nhầm" }),
    );
    expect(mocks.access).toHaveBeenCalledWith("cancelEntry");
  });

  it("the opening balance needs updateOpeningBalance", async () => {
    mocks.setOpeningBalance.mockResolvedValue({ id: "e1" });
    await opening.POST(
      write("opening-balance", { customerId: "c1", amount: "1", reason: "r" }),
    );
    expect(mocks.access).toHaveBeenCalledWith("updateOpeningBalance");
  });

  it("the customer master needs manageCustomer", async () => {
    mocks.saveCustomer.mockResolvedValue({ id: "c1" });
    await customers.POST(write("customers", { patch: { code: "X" } }));
    expect(mocks.access).toHaveBeenCalledWith("manageCustomer");
  });

  it("reading never asks for a write permission", async () => {
    mocks.readSummary.mockResolvedValue({ rows: [] });
    await summary.GET(get("summary"));
    expect(mocks.access).toHaveBeenCalledWith("read");
    expect(mocks.access).toHaveBeenCalledTimes(1);
  });
});

describe("mutating requests reject a foreign origin", () => {
  beforeEach(() => {
    mocks.access.mockResolvedValue(actor);
  });

  it.each([
    [
      "entries",
      () =>
        entries.POST(
          write(
            "entries",
            { amount: "1" },
            { origin: "https://evil.test", host: "localhost" },
          ),
        ),
    ],
    [
      "cancel",
      () =>
        cancel.POST(
          write(
            "entries/cancel",
            { id: "e" },
            { origin: "https://evil.test", host: "localhost" },
          ),
        ),
    ],
    [
      "opening balance",
      () =>
        opening.POST(
          write(
            "opening-balance",
            { customerId: "c" },
            { origin: "https://evil.test", host: "localhost" },
          ),
        ),
    ],
  ])("%s", async (_name, call) => {
    const response = await call();
    expect(response.status).toBe(403);
    noServiceCalls();
  });

  it("rejects a request with no origin header at all", async () => {
    const response = await entries.POST(
      new Request("http://localhost/api/receivables/entries", {
        method: "POST",
        headers: { host: "localhost" },
        body: JSON.stringify({ amount: "1" }),
      }),
    );
    expect(response.status).toBe(403);
    noServiceCalls();
  });
});

describe("responses", () => {
  beforeEach(() => {
    mocks.access.mockResolvedValue(actor);
  });

  it("are private and never cached", async () => {
    mocks.readSummary.mockResolvedValue({ rows: [] });
    const response = await summary.GET(get("summary"));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
  });

  it("turn a duplicate key into a 409 that names the risk", async () => {
    mocks.recordReduction.mockRejectedValue({ code: 11000 });
    const response = await entries.POST(write("entries", { amount: "1" }));
    expect(response.status).toBe(409);
    expect((await response.json()).message).toContain("đã được ghi sổ");
  });

  it("pass a business error through with its own status", async () => {
    mocks.recordReduction.mockRejectedValue(
      new ReceivablesError("Không ghi sổ cho ngày trong tương lai.", 400),
    );
    const response = await entries.POST(write("entries", { amount: "1" }));
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("tương lai");
  });

  it("never leak an internal error message", async () => {
    mocks.readSummary.mockRejectedValue(
      new Error("mongodb://user:secret@cluster/db timed out"),
    );
    const response = await summary.GET(get("summary"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.message).not.toContain("mongodb");
    expect(body.message).not.toContain("secret");
  });
});

describe("the batch idempotency guard", () => {
  beforeEach(() => {
    mocks.access.mockResolvedValue(actor);
  });

  it("returns only the lines of the batch that was asked for", async () => {
    // Regression: `strictQuery` silently drops a condition on a path the
    // loaded model does not know, which turned the batch lookup into "every
    // entry in the book" and handed the whole ledger back as one purchase.
    // The service re-checks the batchId in memory, so a widened query cannot
    // produce a wrong answer.
    mocks.recordSaleBatch.mockResolvedValue([
      { id: "e1", batchId: "batch-1", customerCode: "Nha", amount: "45000" },
      { id: "e2", batchId: "batch-1", customerCode: "Nha", amount: "12000" },
    ]);
    const response = await entries.POST(
      write("entries", {
        kind: "saleBatch",
        customerId: "c1",
        entryDate: "2026-09-10",
        idempotencyKey: "batch-1",
        lines: [],
      }),
    );
    const body = await response.json();
    expect(body.entries).toHaveLength(2);
    expect(
      body.entries.every((e: { batchId: string }) => e.batchId === "batch-1"),
    ).toBe(true);
  });
});

describe("export", () => {
  beforeEach(() => {
    mocks.access.mockResolvedValue(actor);
    mocks.findById.mockReturnValue({
      select: () => ({
        lean: () => ({ exec: async () => ({ displayName: "Thủ kho" }) }),
      }),
    });
  });

  it("streams the workbook with the scope's filename", async () => {
    mocks.buildExportInput.mockResolvedValue({ scope: "summary", summary: [] });
    mocks.buildWorkbook.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const response = await exportRoute.GET(get("export?scope=summary"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      "TONG-HOP-CONG-NO.xlsx",
    );
    expect(mocks.access).toHaveBeenCalledWith("export");
  });

  it("is refused when the reader may not see money, even holding export", async () => {
    // `buildExportInput` re-checks `readAmount`; holding `export` alone is not
    // enough to carry a single figure out of the building.
    mocks.buildExportInput.mockRejectedValue(
      new ContentAccessDeniedError("PERMISSION_DENIED"),
    );
    const response = await exportRoute.GET(get("export?scope=summary"));
    expect(response.status).toBe(403);
    expect(mocks.buildWorkbook).not.toHaveBeenCalled();
  });
});
