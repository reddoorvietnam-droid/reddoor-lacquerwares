import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import {
  applyDraft,
  emptySlip,
  SalesSlipError,
  type Masters,
  type SalesSlipAction,
} from "@/domains/sales-slips/contracts";

const mocks = vi.hoisted(() => ({
  require: vi.fn(),
  has: vi.fn(),
  capabilities: vi.fn(),
  readMasters: vi.fn(),
  listSlips: vi.fn(),
  listCreators: vi.fn(),
  readSlip: vi.fn(),
  createSlip: vi.fn(),
  updateSlip: vi.fn(),
  transitionSlip: vi.fn(),
  readHistory: vi.fn(),
  recordExport: vi.fn(),
  peopleNames: vi.fn(),
}));
vi.mock("@/domains/sales-slips/access", () => ({
  requireSalesSlipAccess: mocks.require,
  hasSalesSlipAccess: mocks.has,
  salesSlipCapabilities: mocks.capabilities,
}));
vi.mock("@/domains/sales-slips/service", () => ({
  readMasters: mocks.readMasters,
  listSlips: mocks.listSlips,
  listCreators: mocks.listCreators,
  readSlip: mocks.readSlip,
  createSlip: mocks.createSlip,
  updateSlip: mocks.updateSlip,
  transitionSlip: mocks.transitionSlip,
  readHistory: mocks.readHistory,
  recordExport: mocks.recordExport,
  peopleNames: mocks.peopleNames,
}));
import * as list from "@/app/api/sales-slips/route";
import * as detail from "@/app/api/sales-slips/[slipId]/route";
import * as transition from "@/app/api/sales-slips/[slipId]/transition/route";
import * as history from "@/app/api/sales-slips/[slipId]/history/route";

const accountant = { userId: "6a96a69508dbd4f1d6211377", actorType: "user" };
const sameOrigin = { origin: "http://localhost", host: "localhost" };
const context = { params: Promise.resolve({ slipId: "slip-1" }) };
const get = (path = "") =>
  new Request(`http://localhost/api/sales-slips${path}`);
const write = (
  path: string,
  method: string,
  body: unknown,
  headers: Record<string, string> = sameOrigin,
) =>
  new Request(`http://localhost/api/sales-slips${path}`, {
    method,
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const masters: Masters = {
  items: [
    {
      id: "i1",
      code: "sonpha7505C-pt",
      name: "Sơn pha 7505c-pt",
      unit: "Kg",
      salePrice: "170000",
    },
  ],
  recipients: [],
};
const pricedSlip = () =>
  applyDraft(
    emptySlip("slip-1", "2026-09-08", accountant.userId),
    {
      slipDate: "2026-09-08",
      recipientCode: "",
      recipientName: "ĐỖ THỊ THANH",
      recipientUnit: "",
      content: "",
      note: "",
      lines: [{ id: "l1", itemCode: "sonpha7505C-pt", quantity: "5" }],
    },
    masters,
    { canEditPrice: false },
  );
/** `has` answers per action so a test can grant read without readPrice. */
const grant = (granted: SalesSlipAction[]) => {
  mocks.require.mockImplementation(async (action: SalesSlipAction) => {
    if (granted.includes(action)) return accountant;
    throw new ContentAccessDeniedError("PERMISSION_DENIED");
  });
  mocks.has.mockImplementation(async (action: SalesSlipAction) =>
    granted.includes(action),
  );
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.peopleNames.mockResolvedValue({});
});

describe("guards run before any data is touched", () => {
  it("denies reads with 403 and no-store headers", async () => {
    grant([]);
    for (const response of await Promise.all([
      list.GET(get()),
      detail.GET(get("/slip-1"), context),
      history.GET(get("/slip-1/history"), context),
    ])) {
      expect(response.status).toBe(403);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(mocks.listSlips).not.toHaveBeenCalled();
    expect(mocks.readSlip).not.toHaveBeenCalled();
  });

  it("denies writes before reading the body and maps anonymous callers to 401", async () => {
    grant([]);
    expect((await list.POST(write("", "POST", "private"))).status).toBe(403);
    expect(
      (await detail.PATCH(write("/slip-1", "PATCH", "private"), context))
        .status,
    ).toBe(403);
    expect(mocks.createSlip).not.toHaveBeenCalled();
    expect(mocks.updateSlip).not.toHaveBeenCalled();
    mocks.require.mockRejectedValue(
      new ContentAccessDeniedError("UNAUTHENTICATED"),
    );
    expect((await list.GET(get())).status).toBe(401);
  });

  it("refuses a cross-origin write even for a permitted user", async () => {
    grant(["read", "create", "update"]);
    const response = await list.POST(
      write(
        "",
        "POST",
        { id: "x", draft: {} },
        { origin: "http://evil.test", host: "localhost" },
      ),
    );
    expect(response.status).toBe(403);
    expect(mocks.createSlip).not.toHaveBeenCalled();
  });
});

describe("money never reaches a reader without readPrice", () => {
  it("redacts the created slip, the detail and the list", async () => {
    grant(["read", "create", "update"]);
    mocks.createSlip.mockResolvedValue(pricedSlip());
    mocks.readSlip.mockResolvedValue({ slip: pricedSlip(), people: {} });
    mocks.capabilities.mockResolvedValue({});
    mocks.listSlips.mockImplementation(
      async (_params: URLSearchParams, canReadPrice: boolean) => ({
        slips: [],
        total: 0,
        nextOffset: null,
        people: {},
        canReadPrice,
      }),
    );
    const created = (await (
      await list.POST(write("", "POST", { id: "slip-1", draft: {} }))
    ).json()) as {
      slip: {
        subtotal: string | null;
        pricesRedacted?: boolean;
        lines: { unitPrice: string | null }[];
      };
    };
    expect(created.slip.pricesRedacted).toBe(true);
    expect(created.slip.subtotal).toBeNull();
    expect(created.slip.lines[0]?.unitPrice).toBeNull();
    expect(mocks.createSlip).toHaveBeenCalledWith(
      expect.anything(),
      accountant.userId,
      { canEditPrice: false },
    );
    const shown = (await (
      await detail.GET(get("/slip-1"), context)
    ).json()) as { slip: { pricesRedacted?: boolean } };
    expect(shown.slip.pricesRedacted).toBe(true);
    const listed = (await (await list.GET(get("?q=7505"))).json()) as {
      canReadPrice: boolean;
    };
    expect(listed.canReadPrice).toBe(false);
    expect(mocks.readHistory).not.toHaveBeenCalled();
    mocks.readMasters.mockResolvedValue(masters);
    mocks.capabilities.mockResolvedValue({ readPrice: false });
    const catalogue = (await (await list.GET(get("?masters=1"))).json()) as {
      items: { code: string; salePrice: string | null }[];
    };
    expect(catalogue.items[0]?.code).toBe("sonpha7505C-pt");
    expect(catalogue.items[0]?.salePrice).toBeNull();
    mocks.capabilities.mockResolvedValue({ readPrice: true });
    const priced = (await (await list.GET(get("?masters=1"))).json()) as {
      items: { salePrice: string | null }[];
    };
    expect(priced.items[0]?.salePrice).toBe("170000");
  });

  it("keeps money for a readPrice holder and passes editPrice to the service", async () => {
    grant(["read", "create", "update", "readPrice", "editPrice"]);
    mocks.updateSlip.mockResolvedValue(pricedSlip());
    const response = await detail.PATCH(
      write("/slip-1", "PATCH", { version: 1, draft: {} }),
      context,
    );
    const body = (await response.json()) as {
      slip: { subtotal: string | null; pricesRedacted?: boolean };
    };
    expect(response.status).toBe(200);
    expect(body.slip.subtotal).toBe("850000");
    expect(body.slip.pricesRedacted).toBeUndefined();
    expect(mocks.updateSlip).toHaveBeenCalledWith(
      "slip-1",
      { version: 1, draft: {} },
      accountant.userId,
      {
        canEditPrice: true,
      },
    );
  });

  it("surfaces the service's 403 when a price is sent without editPrice", async () => {
    grant(["read", "update", "readPrice"]);
    mocks.updateSlip.mockRejectedValue(
      new SalesSlipError("Bạn không có quyền sửa đơn giá.", 403),
    );
    const response = await detail.PATCH(
      write("/slip-1", "PATCH", {
        version: 1,
        draft: {
          lines: [{ id: "l1", itemCode: "x", quantity: "1", unitPrice: "1" }],
        },
      }),
      context,
    );
    expect(response.status).toBe(403);
    expect(((await response.json()) as { message: string }).message).toMatch(
      /không có quyền sửa đơn giá/,
    );
  });
});

describe("status transitions ask for the right permission", () => {
  it("confirm and reopen need confirm; cancel needs cancel", async () => {
    grant(["read", "confirm"]);
    mocks.transitionSlip.mockResolvedValue({
      ...pricedSlip(),
      status: "CONFIRMED",
    });
    const confirmed = await transition.POST(
      write("/slip-1/transition", "POST", { action: "confirm", version: 1 }),
      context,
    );
    expect(confirmed.status).toBe(200);
    expect(mocks.transitionSlip).toHaveBeenCalledWith(
      "slip-1",
      { action: "confirm", version: 1 },
      accountant.userId,
    );
    const cancelled = await transition.POST(
      write("/slip-1/transition", "POST", {
        action: "cancel",
        version: 1,
        reason: "nhầm",
      }),
      context,
    );
    expect(cancelled.status).toBe(403);
    expect(mocks.transitionSlip).toHaveBeenCalledTimes(1);
  });

  it("returns the confirm problems as details", async () => {
    grant(["read", "confirm", "readPrice"]);
    mocks.transitionSlip.mockRejectedValue(
      new SalesSlipError("Chưa thể xác nhận phiếu.", 400, [
        "Dòng 1: số lượng phải lớn hơn 0.",
      ]),
    );
    const response = await transition.POST(
      write("/slip-1/transition", "POST", { action: "confirm", version: 1 }),
      context,
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { details: string[] }).details).toEqual([
      "Dòng 1: số lượng phải lớn hơn 0.",
    ]);
  });

  it("rejects an unknown action at the schema before any permission beyond read", async () => {
    grant(["read"]);
    const response = await transition.POST(
      write("/slip-1/transition", "POST", { action: "delete", version: 1 }),
      context,
    );
    expect(response.status).toBe(400);
    expect(mocks.transitionSlip).not.toHaveBeenCalled();
  });
});
