// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Capabilities,
  Facility,
  Material,
  MaterialTransaction,
  SummaryRow,
  TransactionChange,
} from "@/domains/materials/contracts";

const navigation = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => navigation.params,
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => "/vi/admin/materials",
}));

import { MaterialsWorkspace } from "@/components/admin/materials/materials-workspace";

const stamp = {
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdBy: "seed",
  updatedBy: "seed",
};
const material: Material = {
  id: "m1",
  version: 1,
  code: "M1",
  name: "Sơn PU",
  unit: "Kg",
  openingQuantity: "5",
  minimumStock: null,
  note: "",
  active: true,
  sortOrder: 1,
  hasTransactions: false,
  ...stamp,
};
const facility: Facility = {
  id: "f1",
  version: 1,
  code: "AnhQuang",
  name: "Anh Quảng",
  type: "Loại 1",
  phone: "",
  note: "",
  active: true,
  sortOrder: 1,
  hasTransactions: false,
  ...stamp,
};
const summaryRow: SummaryRow = {
  materialId: "m1",
  stt: 1,
  code: "M1",
  name: "Sơn PU",
  unit: "Kg",
  openingQuantity: "5",
  inboundQuantity: "0",
  outboundQuantity: "0",
  adjustmentQuantity: "0",
  currentQuantity: "5",
  minimumStock: null,
  note: "",
  active: true,
  state: "in",
};
const postedLine: MaterialTransaction = {
  id: "t1",
  version: 2,
  type: "INBOUND",
  status: "POSTED",
  transactionDate: "2026-09-01",
  materialId: "m1",
  materialCode: "M1",
  materialName: "Sơn PU",
  unit: "Kg",
  quantity: "3",
  unitPrice: null,
  amount: null,
  facilityId: null,
  facilityCode: "",
  facilityName: "",
  description: "nhập kho",
  note: "",
  batchId: null,
  migrationSource: null,
  sourceRow: null,
  cancelledAt: null,
  cancelledBy: null,
  cancelReason: null,
  ...stamp,
};
const noCapabilities: Capabilities = {
  read: true,
  manageCatalog: false,
  receive: false,
  issue: false,
  cancel: false,
  export: false,
  import: false,
};

type Call = { url: string; method: string; body: unknown };
let calls: Call[] = [];

function mockFetch(
  capabilities: Capabilities,
  lines: MaterialTransaction[] = [],
) {
  const respond = (data: unknown, status = 200) =>
    ({
      ok: status < 400,
      status,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => data,
      blob: async () => new Blob(),
    }) as unknown as Response;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body =
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as unknown)
          : null;
      calls.push({ url, method, body });
      if (url.startsWith("/api/materials/masters"))
        return respond({
          materials: [material],
          facilities: [facility],
          capabilities,
        });
      if (url.startsWith("/api/materials/summary"))
        return respond({
          rows: [summaryRow],
          kpis: { materials: 1, inStock: 1, lowStock: 0, outOfStock: 0 },
          generatedAt: "2026-09-09T00:00:00.000Z",
        });
      if (url.startsWith("/api/materials/history"))
        return respond({
          entries: [],
          total: 0,
          nextOffset: null,
          transactions: lines.length,
          lastActivity: null,
        });
      if (url.startsWith("/api/materials/transactions")) {
        if (method === "GET")
          return respond({
            rows: lines,
            total: lines.length,
            nextOffset: null,
          });
        if (method === "DELETE")
          return respond({ row: { ...postedLine, status: "CANCELLED" } });
        const { changes } = body as { changes: TransactionChange[] };
        return respond({
          rows: changes.map((change) => ({
            ...postedLine,
            id: change.id,
            version: change.version + 1,
            type: change.type,
            quantity: change.patch.quantity ?? "0",
            transactionDate: change.patch.transactionDate ?? "2026-09-09",
          })),
          batchId: "batch",
        });
      }
      return respond({ message: "not found" }, 404);
    }),
  );
}

const posts = () =>
  calls.filter(
    (call) =>
      call.method === "POST" &&
      call.url.startsWith("/api/materials/transactions"),
  );

/** Only the active tab's panel is accessible; the others carry `hidden`. */
const panel = () => within(screen.getByRole("tabpanel"));

describe("materials workspace", () => {
  beforeEach(() => {
    calls = [];
    navigation.params = new URLSearchParams();
    navigation.replace.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the header and tabs and hides Excel buttons without capabilities", async () => {
    mockFetch(noCapabilities);
    render(<MaterialsWorkspace />);
    await screen.findByRole("heading", { name: "Nguyên vật liệu" });
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Tổng kho",
      "Nhập kho",
      "Xuất kho",
      "Danh mục NVL",
    ]);
    await screen.findByText(/1 vật tư đang theo dõi/);
    expect(screen.queryByRole("button", { name: "Nhập Excel" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xuất Excel" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Dán từ Excel" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Thêm phiếu nhập" }),
    ).toBeNull();
    expect(panel().getByText("Sơn PU")).toBeTruthy();
  });

  it("opens the inbound editor and only posts once Áp dụng has a valid row", async () => {
    mockFetch({ ...noCapabilities, receive: true });
    navigation.params = new URLSearchParams("tab=inbound");
    render(<MaterialsWorkspace />);
    const add = await screen.findByRole("button", { name: "Thêm phiếu nhập" });
    await waitFor(() => expect(add).not.toHaveProperty("disabled", true));
    fireEvent.click(add);
    const form = screen.getByRole("form", { name: "Thêm phiếu nhập" });
    expect(posts()).toEqual([]);

    // Empty form: rejected on the client, nothing sent.
    fireEvent.click(within(form).getByRole("button", { name: "Áp dụng" }));
    await within(form).findByText("Chưa chọn mã vật tư");
    expect(posts()).toEqual([]);

    fireEvent.change(within(form).getByLabelText("Mã vật tư"), {
      target: { value: "m1" },
    });
    await within(form).findByText(/Sơn PU · ĐVT: Kg/);
    fireEvent.change(within(form).getByLabelText("Số lượng"), {
      target: { value: "5" },
    });
    expect(posts()).toEqual([]);
    fireEvent.click(within(form).getByRole("button", { name: "Áp dụng" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    const body = posts()[0]!.body as { changes: TransactionChange[] };
    expect(body.changes).toHaveLength(1);
    expect(body.changes[0]).toMatchObject({
      version: 0,
      type: "INBOUND",
      patch: { materialCode: "M1", quantity: "5", description: "nhập kho" },
    });
    await screen.findByText(/Đã ghi phiếu nhập 5 Kg Sơn PU/);
    expect(screen.queryByRole("form", { name: "Thêm phiếu nhập" })).toBeNull();
  });

  it("shows the stock overrun inline and disables Áp dụng when xuất exceeds the balance", async () => {
    mockFetch({ ...noCapabilities, issue: true });
    navigation.params = new URLSearchParams("tab=outbound");
    render(<MaterialsWorkspace />);
    const add = await screen.findByRole("button", { name: "Thêm phiếu xuất" });
    await screen.findByText(/1 vật tư đang theo dõi/);
    fireEvent.click(add);
    const form = screen.getByRole("form", { name: "Thêm phiếu xuất" });
    fireEvent.change(within(form).getByLabelText("Cơ sở / người nhận"), {
      target: { value: "anhquang" },
    });
    await within(form).findByText("Anh Quảng");
    fireEvent.change(within(form).getByLabelText("Mã vật tư"), {
      target: { value: "M1" },
    });
    await within(form).findByText("Tồn hiện tại: 5 Kg");
    fireEvent.change(within(form).getByLabelText("Số lượng xuất"), {
      target: { value: "10" },
    });
    const alert = await within(form).findByRole("alert");
    expect(alert.textContent).toContain(
      "Số lượng xuất vượt quá tồn kho hiện tại",
    );
    expect(alert.textContent).toContain("Tồn hiện tại: 5 Kg");
    expect(alert.textContent).toContain("Yêu cầu xuất: 10 Kg");
    const apply = within(form).getByRole("button", { name: "Áp dụng" });
    expect(apply).toHaveProperty("disabled", true);
    fireEvent.click(apply);
    expect(posts()).toEqual([]);

    // Within stock the alert goes away and the line is written.
    fireEvent.change(within(form).getByLabelText("Số lượng xuất"), {
      target: { value: "4" },
    });
    await waitFor(() => expect(within(form).queryByRole("alert")).toBeNull());
    expect(apply).toHaveProperty("disabled", false);
    fireEvent.click(apply);
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(
      (posts()[0]!.body as { changes: TransactionChange[] }).changes[0],
    ).toMatchObject({
      type: "OUTBOUND",
      patch: { facilityCode: "AnhQuang", materialCode: "M1", quantity: "4" },
    });
  });

  it("asks for a reason before cancelling a line", async () => {
    mockFetch({ ...noCapabilities, cancel: true }, [postedLine]);
    navigation.params = new URLSearchParams("tab=inbound");
    render(<MaterialsWorkspace />);
    const cancel = await screen.findByRole("button", {
      name: "Hủy phiếu M1 ngày 01/09/2026",
    });
    fireEvent.click(cancel);
    const dialog = screen.getByRole("region", {
      name: "Xác nhận hủy phiếu nhập",
    });
    const confirm = within(dialog).getByRole("button", {
      name: "Hủy dòng này",
    });
    expect(confirm).toHaveProperty("disabled", true);
    fireEvent.change(within(dialog).getByLabelText("Lý do hủy"), {
      target: { value: "ghi nhầm" },
    });
    expect(confirm).toHaveProperty("disabled", false);
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(
        calls
          .filter((call) => call.method === "DELETE")
          .map((call) => call.body),
      ).toEqual([{ id: "t1", version: 2, reason: "ghi nhầm" }]),
    );
    await screen.findByText(/Đã hủy phiếu nhập Sơn PU/);
  });
});
