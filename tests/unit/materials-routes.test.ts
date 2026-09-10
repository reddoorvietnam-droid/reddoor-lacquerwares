import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { MaterialsError } from "@/domains/materials/contracts";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  capabilities: vi.fn(),
  readMasters: vi.fn(),
  saveMasters: vi.fn(),
  readSummary: vi.fn(),
  listTransactions: vi.fn(),
  saveTransactions: vi.fn(),
  cancelTransaction: vi.fn(),
  readMaterialDetail: vi.fn(),
  readWarehouseHistory: vi.fn(),
}));
vi.mock("@/domains/materials/access", () => ({
  requireMaterialsAccess: mocks.access,
  materialsCapabilities: mocks.capabilities,
}));
vi.mock("@/domains/materials/service", () => ({
  readMasters: mocks.readMasters,
  saveMasters: mocks.saveMasters,
  readSummary: mocks.readSummary,
  listTransactions: mocks.listTransactions,
  saveTransactions: mocks.saveTransactions,
  cancelTransaction: mocks.cancelTransaction,
  readMaterialDetail: mocks.readMaterialDetail,
  readWarehouseHistory: mocks.readWarehouseHistory,
}));
import * as masters from "@/app/api/materials/masters/route";
import * as summary from "@/app/api/materials/summary/route";
import * as transactions from "@/app/api/materials/transactions/route";
import * as detail from "@/app/api/materials/detail/route";
import * as history from "@/app/api/materials/history/route";

const storekeeper = { userId: "user-1", actorType: "user" };
const sameOrigin = { origin: "http://localhost", host: "localhost" };
const allCapabilities = {
  read: true,
  manageCatalog: true,
  receive: true,
  issue: true,
  cancel: true,
  export: true,
  import: true,
};
const get = (path: string) =>
  new Request(`http://localhost/api/materials/${path}`);
const write = (
  path: string,
  method: "POST" | "DELETE",
  body: unknown,
  headers: Record<string, string> = sameOrigin,
) =>
  new Request(`http://localhost/api/materials/${path}`, {
    method,
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const noServiceCalls = () => {
  for (const fn of [
    mocks.readMasters,
    mocks.saveMasters,
    mocks.readSummary,
    mocks.listTransactions,
    mocks.saveTransactions,
    mocks.cancelTransaction,
    mocks.readMaterialDetail,
    mocks.readWarehouseHistory,
  ])
    expect(fn).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("guards run before any data is touched", () => {
  const denied = () =>
    mocks.access.mockRejectedValue(
      new ContentAccessDeniedError("PERMISSION_DENIED"),
    );

  it("denies every read with 403 and no-store headers", async () => {
    denied();
    for (const response of await Promise.all([
      masters.GET(),
      summary.GET(get("summary?q=son")),
      transactions.GET(get("transactions?type=INBOUND")),
      detail.GET(get("detail?id=m-son")),
      history.GET(get("history?limit=1")),
    ])) {
      expect(response.status).toBe(403);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("vary")).toBe("Cookie");
    }
    noServiceCalls();
  });

  it("denies every write before reading the body", async () => {
    denied();
    const responses = await Promise.all([
      masters.POST(write("masters", "POST", "private")),
      transactions.POST(write("transactions", "POST", "private")),
      transactions.DELETE(write("transactions", "DELETE", "private")),
    ]);
    for (const response of responses) expect(response.status).toBe(403);
    noServiceCalls();
    expect(mocks.capabilities).not.toHaveBeenCalled();
  });

  it("maps an anonymous caller to 401", async () => {
    mocks.access.mockRejectedValue(
      new ContentAccessDeniedError("UNAUTHENTICATED"),
    );
    expect((await masters.GET()).status).toBe(401);
    expect((await history.GET(get("history"))).status).toBe(401);
    expect(mocks.readWarehouseHistory).not.toHaveBeenCalled();
  });

  it("asks for the action each route needs", async () => {
    mocks.access.mockResolvedValue(storekeeper);
    mocks.capabilities.mockResolvedValue(allCapabilities);
    mocks.readMasters.mockResolvedValue({ materials: [], facilities: [] });
    mocks.saveMasters.mockResolvedValue({ kind: "material", rows: [] });
    mocks.cancelTransaction.mockResolvedValue({ id: "t1" });
    await masters.GET();
    expect(mocks.access).toHaveBeenLastCalledWith("read");
    await masters.POST(
      write("masters", "POST", { kind: "material", changes: [] }),
    );
    expect(mocks.access).toHaveBeenLastCalledWith("manageCatalog");
    await transactions.DELETE(
      write("transactions", "DELETE", { id: "t1", version: 1 }),
    );
    expect(mocks.access).toHaveBeenLastCalledWith("cancel");
    mocks.readWarehouseHistory.mockResolvedValue({ entries: [] });
    await history.GET(get("history"));
    expect(mocks.access).toHaveBeenLastCalledWith("read");
  });
});

describe("same-origin is enforced on every mutation", () => {
  it.each([
    ["https://evil.example", "localhost"],
    ["", "localhost"],
  ])("rejects origin %s against host %s", async (origin, host) => {
    mocks.access.mockResolvedValue(storekeeper);
    const headers = origin ? { origin, host } : { host };
    const responses = await Promise.all([
      masters.POST(write("masters", "POST", {}, headers)),
      transactions.POST(write("transactions", "POST", {}, headers)),
      transactions.DELETE(write("transactions", "DELETE", {}, headers)),
    ]);
    for (const response of responses) expect(response.status).toBe(403);
    noServiceCalls();
  });

  it("rejects a body that is not JSON", async () => {
    mocks.access.mockResolvedValue(storekeeper);
    const response = await transactions.POST(
      write("transactions", "POST", "not json"),
    );
    expect(response.status).toBe(400);
    noServiceCalls();
  });
});

describe("masters", () => {
  it("returns masters together with the caller's capabilities", async () => {
    mocks.access.mockResolvedValue(storekeeper);
    mocks.readMasters.mockResolvedValue({
      materials: [{ id: "m1" }],
      facilities: [],
    });
    mocks.capabilities.mockResolvedValue({ ...allCapabilities, import: false });
    const response = await masters.GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      materials: [{ id: "m1" }],
      facilities: [],
      capabilities: { ...allCapabilities, import: false },
    });
  });

  it("saves with the server-resolved actor and passes a duplicate code as 409", async () => {
    mocks.access.mockResolvedValue(storekeeper);
    mocks.saveMasters.mockResolvedValue({
      kind: "facility",
      rows: [{ id: "f1" }],
    });
    const body = {
      kind: "facility",
      changes: [{ id: "f1", version: 0, patch: { code: "A" } }],
    };
    const response = await masters.POST(write("masters", "POST", body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      kind: "facility",
      rows: [{ id: "f1" }],
    });
    expect(mocks.saveMasters).toHaveBeenCalledWith(body, "user-1");

    mocks.saveMasters.mockRejectedValue(
      new MaterialsError('Mã "A" đã tồn tại.', 409),
    );
    const conflict = await masters.POST(write("masters", "POST", body));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({
      message: 'Mã "A" đã tồn tại.',
      details: null,
    });
  });
});

describe("summary and ledger reads", () => {
  it("passes the query string through to the service", async () => {
    mocks.access.mockResolvedValue(storekeeper);
    mocks.readSummary.mockResolvedValue({
      rows: [],
      kpis: {},
      generatedAt: "x",
    });
    mocks.listTransactions.mockResolvedValue({
      rows: [],
      total: 0,
      nextOffset: null,
    });
    await summary.GET(get("summary?q=son&state=low&includeInactive=1"));
    expect(mocks.readSummary.mock.calls[0]?.[0]?.get("state")).toBe("low");
    await transactions.GET(get("transactions?type=OUTBOUND&offset=200"));
    expect(mocks.listTransactions.mock.calls[0]?.[0]?.get("offset")).toBe(
      "200",
    );
  });
});

describe("saving transactions", () => {
  const batch = {
    changes: [
      { id: "t1", version: 0, type: "OUTBOUND", patch: { quantity: "1" } },
    ],
  };

  it("hands the receive/issue capabilities to the service", async () => {
    mocks.access.mockResolvedValue(storekeeper);
    mocks.capabilities.mockResolvedValue({
      ...allCapabilities,
      receive: false,
    });
    mocks.saveTransactions.mockResolvedValue({
      rows: [{ id: "t1" }],
      batchId: "b1",
    });
    const response = await transactions.POST(
      write("transactions", "POST", batch),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      rows: [{ id: "t1" }],
      batchId: "b1",
    });
    expect(mocks.saveTransactions).toHaveBeenCalledWith(batch, "user-1", {
      receive: false,
      issue: true,
    });
  });

  it("maps a type the caller may not write to 403", async () => {
    mocks.access.mockResolvedValue(storekeeper);
    mocks.capabilities.mockResolvedValue({ ...allCapabilities, issue: false });
    mocks.saveTransactions.mockRejectedValue(
      new ContentAccessDeniedError("PERMISSION_DENIED"),
    );
    const response = await transactions.POST(
      write("transactions", "POST", batch),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("PERMISSION_DENIED");
  });

  it("returns the stock conflict with its details for the grid", async () => {
    mocks.access.mockResolvedValue(storekeeper);
    mocks.capabilities.mockResolvedValue(allCapabilities);
    mocks.saveTransactions.mockRejectedValue(
      new MaterialsError("Số lượng xuất vượt quá tồn kho hiện tại.", 409, {
        materialId: "m1",
        current: "10",
        requested: "11",
        resulting: "-1",
      }),
    );
    const response = await transactions.POST(
      write("transactions", "POST", batch),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      message: "Số lượng xuất vượt quá tồn kho hiện tại.",
      details: {
        materialId: "m1",
        current: "10",
        requested: "11",
        resulting: "-1",
      },
    });
  });

  it("maps a Mongo duplicate key to 409", async () => {
    mocks.access.mockResolvedValue(storekeeper);
    mocks.capabilities.mockResolvedValue(allCapabilities);
    mocks.saveTransactions.mockRejectedValue(
      Object.assign(new Error("E11000"), { code: 11000 }),
    );
    expect(
      (await transactions.POST(write("transactions", "POST", batch))).status,
    ).toBe(409);
  });
});

describe("cancelling", () => {
  it("returns the cancelled row", async () => {
    mocks.access.mockResolvedValue(storekeeper);
    mocks.cancelTransaction.mockResolvedValue({
      id: "t1",
      status: "CANCELLED",
    });
    const body = { id: "t1", version: 2, reason: "Nhập nhầm" };
    const response = await transactions.DELETE(
      write("transactions", "DELETE", body),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      row: { id: "t1", status: "CANCELLED" },
    });
    expect(mocks.cancelTransaction).toHaveBeenCalledWith(body, "user-1");
  });

  it("passes a stale version through as 409", async () => {
    mocks.access.mockResolvedValue(storekeeper);
    mocks.cancelTransaction.mockRejectedValue(
      new MaterialsError("Xung đột.", 409),
    );
    const response = await transactions.DELETE(
      write("transactions", "DELETE", { id: "t1", version: 1 }),
    );
    expect(response.status).toBe(409);
  });
});

describe("material detail", () => {
  it("validates id and offset before calling the service", async () => {
    mocks.access.mockResolvedValue(storekeeper);
    expect((await detail.GET(get("detail"))).status).toBe(400);
    expect((await detail.GET(get("detail?id=bad%20id"))).status).toBe(400);
    expect((await detail.GET(get("detail?id=m1&offset=-1"))).status).toBe(400);
    expect(mocks.readMaterialDetail).not.toHaveBeenCalled();
    mocks.readMaterialDetail.mockResolvedValue({ material: { id: "m1" } });
    const response = await detail.GET(get("detail?id=m1&offset=200"));
    expect(response.status).toBe(200);
    expect(mocks.readMaterialDetail).toHaveBeenCalledWith("m1", 200);
  });

  it("passes a missing material through as 404", async () => {
    mocks.access.mockResolvedValue(storekeeper);
    mocks.readMaterialDetail.mockRejectedValue(
      new MaterialsError("Không tìm thấy vật tư.", 404),
    );
    expect((await detail.GET(get("detail?id=m1"))).status).toBe(404);
  });
});

describe("warehouse history", () => {
  const page = {
    entries: [{ id: "a1", action: "materials.transaction.create" }],
    total: 1,
    nextOffset: null,
    transactions: 12,
    lastActivity: {
      occurredAt: "2026-09-09T01:00:00.000Z",
      actorName: "Thủ kho",
      action: "materials.transaction.create",
    },
  };

  it("defaults offset/limit and passes explicit values through", async () => {
    mocks.access.mockResolvedValue(storekeeper);
    mocks.readWarehouseHistory.mockResolvedValue(page);
    const response = await history.GET(get("history"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(page);
    expect(mocks.readWarehouseHistory).toHaveBeenCalledWith({
      offset: 0,
      limit: 50,
    });
    await history.GET(get("history?offset=100&limit=1"));
    expect(mocks.readWarehouseHistory).toHaveBeenLastCalledWith({
      offset: 100,
      limit: 1,
    });
  });

  it("rejects an invalid offset or limit before calling the service", async () => {
    mocks.access.mockResolvedValue(storekeeper);
    for (const query of [
      "history?offset=-1",
      "history?limit=0",
      "history?limit=201",
      "history?offset=abc",
    ])
      expect((await history.GET(get(query))).status).toBe(400);
    expect(mocks.readWarehouseHistory).not.toHaveBeenCalled();
  });

  it("maps 401/403 from the guard", async () => {
    mocks.access.mockRejectedValue(
      new ContentAccessDeniedError("PERMISSION_DENIED"),
    );
    const denied = await history.GET(get("history"));
    expect(denied.status).toBe(403);
    expect((await denied.json()).code).toBe("PERMISSION_DENIED");
    mocks.access.mockRejectedValue(
      new ContentAccessDeniedError("UNAUTHENTICATED"),
    );
    expect((await history.GET(get("history"))).status).toBe(401);
    expect(mocks.readWarehouseHistory).not.toHaveBeenCalled();
  });
});

describe("unexpected failures never leak internals", () => {
  it("hides the message of an unknown error", async () => {
    mocks.access.mockResolvedValue(storekeeper);
    mocks.readSummary.mockRejectedValue(
      new Error("mongodb+srv://user:pw@host"),
    );
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await summary.GET(get("summary"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("mongodb+srv");
    expect(errors).toHaveBeenCalled();
  });
});
