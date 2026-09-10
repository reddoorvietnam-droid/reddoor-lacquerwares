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
import type { Master, PaintRow } from "@/domains/paint-warehouse/contracts";
import type {
  Capabilities,
  PaintChange,
} from "@/components/admin/paint-warehouse/shared";
import { PaintWarehouse } from "@/components/admin/paint-warehouse/paint-warehouse";

const masters: Master[] = [
  {
    kind: "material",
    code: "SON1",
    name: "Sơn",
    unit: "Kg",
    unitPrice: "120000",
  },
  {
    kind: "material",
    code: "SON2",
    name: "Sơn mới",
    unit: "L",
    unitPrice: "200000",
  },
  {
    kind: "facility",
    code: "CS1",
    name: "Nội bộ",
    unit: "",
    unitPrice: null,
  },
];

const stamp = {
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  createdBy: "seed",
  updatedBy: "seed",
};
const ledgerRow: PaintRow = {
  id: "r1",
  version: 1,
  sourceRow: null,
  exportDate: "2026-09-09",
  facilityCode: "CS1",
  facilityNameSnapshot: "Nội bộ",
  materialCode: "SON1",
  materialNameSnapshot: "Sơn",
  description: "xuất kho",
  unit: "Kg",
  quantity: "2.5",
  unitPrice: "120000",
  amount: "300000",
  actualQuantity: "3",
  discountedUnitPrice: "120000",
  actualAmount: "360000",
  actualQuantityManual: true,
  discountedPriceManual: false,
  note: "ghi chú",
  ...stamp,
};
/** The row action labels quote the line the way the table shows it. */
const rowLabel = "09/09/2026 · Sơn · Nội bộ · 2.5 Kg";

const readOnly: Capabilities = {
  read: true,
  create: false,
  update: false,
  delete: false,
  export: false,
  import: false,
};

type Call = { url: string; method: string; body: unknown };
let calls: Call[] = [];

function mockFetch(capabilities: Capabilities, rows: PaintRow[] = [ledgerRow]) {
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
      if (url.includes("masters=1")) return respond({ masters, capabilities });
      if (method === "GET")
        return respond({ rows, total: rows.length, nextOffset: null });
      if (method === "DELETE") return respond({ deleted: true });
      const { changes } = body as { changes: PaintChange[] };
      return respond({
        rows: changes.map((change) => ({
          ...ledgerRow,
          id: change.id,
          version: change.version + 1,
        })),
      });
    }),
  );
}

const posts = () => calls.filter((call) => call.method === "POST");
const deletes = () => calls.filter((call) => call.method === "DELETE");

describe("bảng xuất kho sơn page", () => {
  beforeEach(() => {
    calls = [];
    // openEditor scrolls its anchor into view; jsdom has no such method.
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the toolbar and the sổ, hiding the write buttons without capabilities", async () => {
    mockFetch(readOnly);
    render(<PaintWarehouse />);
    await screen.findByRole("heading", { name: "Bảng xuất kho sơn" });
    await screen.findByText("Sơn");
    expect(screen.getByLabelText("Tìm vật tư hoặc cơ sở")).toBeTruthy();
    expect(
      screen.getByRole("columnheader", { name: "Đơn giá đã chiết khấu" }),
    ).toBeTruthy();
    // Derived money is grouped the way the workbook shows it.
    expect(screen.getByText("360,000")).toBeTruthy();
    for (const name of [
      "+ Thêm phiếu xuất",
      "Dán từ Excel",
      "Nhập Excel",
      "Xuất Excel",
    ])
      expect(screen.queryByRole("button", { name })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Thao tác" })).toBeNull();
  });

  it("opens the editor from “+ Thêm phiếu xuất” and posts nothing until Áp dụng has a valid dòng", async () => {
    mockFetch({ ...readOnly, create: true });
    render(<PaintWarehouse />);
    const add = await screen.findByRole("button", {
      name: "+ Thêm phiếu xuất",
    });
    await waitFor(() => expect(add).toHaveProperty("disabled", false));
    fireEvent.click(add);
    const form = screen.getByRole("form", { name: "Thêm phiếu xuất" });
    expect(posts()).toEqual([]);

    // An empty phiếu is refused on the client; nothing reaches the sổ.
    fireEvent.click(within(form).getByRole("button", { name: "Áp dụng" }));
    await within(form).findByText("Chưa chọn mã vật tư.");
    expect(posts()).toEqual([]);

    fireEvent.change(within(form).getByLabelText("Mã cơ sở SX"), {
      target: { value: "cs1" },
    });
    fireEvent.change(within(form).getByLabelText("Mã vật tư"), {
      target: { value: "son1" },
    });
    await waitFor(() =>
      expect(within(form).getByLabelText("Vật tư")).toHaveProperty(
        "value",
        "Sơn",
      ),
    );
    expect(within(form).getByLabelText("Tên cơ sở SX")).toHaveProperty(
      "value",
      "Nội bộ",
    );
    expect(within(form).getByLabelText("ĐVT")).toHaveProperty("value", "Kg");
    expect(within(form).getByLabelText("Đơn giá")).toHaveProperty(
      "value",
      "120,000",
    );
    fireEvent.change(within(form).getByLabelText("Số lượng"), {
      target: { value: "2.5" },
    });
    await waitFor(() =>
      expect(within(form).getByLabelText("Thành tiền")).toHaveProperty(
        "value",
        "300,000",
      ),
    );
    expect(within(form).getByLabelText("Thành tiền thực nhận")).toHaveProperty(
      "value",
      "300,000",
    );
    expect(posts()).toEqual([]);

    fireEvent.click(within(form).getByRole("button", { name: "Áp dụng" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    const { changes } = posts()[0]!.body as { changes: PaintChange[] };
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      version: 0,
      patch: {
        facilityCode: "CS1",
        materialCode: "SON1",
        quantity: "2.5",
        description: "xuất kho",
      },
    });
    await screen.findByText(/^Đã ghi dòng/);
    expect(screen.queryByRole("form", { name: "Thêm phiếu xuất" })).toBeNull();
  });

  it("derives tên cơ sở, vật tư and thành tiền from the danh mục, keeping a hand-set đơn giá", async () => {
    mockFetch({ ...readOnly, update: true });
    render(<PaintWarehouse />);
    fireEvent.click(
      await screen.findByRole("button", { name: `Sửa dòng ${rowLabel}` }),
    );
    const form = screen.getByRole("form", { name: "Sửa phiếu xuất" });
    expect(within(form).getByLabelText("Thành tiền thực nhận")).toHaveProperty(
      "value",
      "360,000",
    );

    fireEvent.change(within(form).getByLabelText("Đơn giá đã chiết khấu"), {
      target: { value: "100000" },
    });
    await waitFor(() =>
      expect(
        within(form).getByLabelText("Thành tiền thực nhận"),
      ).toHaveProperty("value", "300,000"),
    );

    // A catalogue *name* resolves to its code, and the new đơn giá follows.
    fireEvent.change(within(form).getByLabelText("Mã vật tư"), {
      target: { value: "sơn mới" },
    });
    await waitFor(() =>
      expect(within(form).getByLabelText("Vật tư")).toHaveProperty(
        "value",
        "Sơn mới",
      ),
    );
    expect(within(form).getByLabelText("ĐVT")).toHaveProperty("value", "L");
    expect(within(form).getByLabelText("Đơn giá")).toHaveProperty(
      "value",
      "200,000",
    );
    expect(within(form).getByLabelText("Thành tiền")).toHaveProperty(
      "value",
      "500,000",
    );
    // The manual chiết khấu sticks: 3 × 100,000, not 3 × 200,000.
    expect(within(form).getByLabelText("Thành tiền thực nhận")).toHaveProperty(
      "value",
      "300,000",
    );

    fireEvent.click(within(form).getByRole("button", { name: "Áp dụng" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    const { changes } = posts()[0]!.body as { changes: PaintChange[] };
    expect(changes[0]).toMatchObject({
      id: "r1",
      version: 1,
      patch: {
        materialCode: "SON2",
        actualQuantity: "3",
        discountedUnitPrice: "100000",
      },
    });
    await screen.findByText(/^Đã cập nhật dòng/);
  });

  it("asks before deleting a dòng and only sends DELETE once confirmed", async () => {
    mockFetch({ ...readOnly, delete: true });
    render(<PaintWarehouse />);
    fireEvent.click(
      await screen.findByRole("button", { name: `Xóa dòng ${rowLabel}` }),
    );
    expect(deletes()).toEqual([]);
    const panel = screen.getByRole("region", { name: "Xác nhận xóa dòng" });
    expect(panel.textContent).toContain(rowLabel);
    fireEvent.click(within(panel).getByRole("button", { name: "Xóa dòng" }));
    await waitFor(() =>
      expect(deletes().map((call) => call.body)).toEqual([
        { id: "r1", version: 1 },
      ]),
    );
    await screen.findByText(/^Đã xóa dòng/);
  });
});
