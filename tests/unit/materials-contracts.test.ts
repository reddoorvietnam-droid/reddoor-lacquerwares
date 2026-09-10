import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  applyTransactionPatch,
  computeCurrent,
  decideStock,
  emptyTransaction,
  formatQuantity,
  MaterialsError,
  parseCell,
  stockState,
  transactionCompleteness,
  transactionPatchSchema,
  type Lookups,
} from "@/domains/materials/contracts";
import {
  escapeRegex,
  fingerprintOf,
  transactionFilter,
} from "@/domains/materials/service";

const lookups: Lookups = {
  materials: [
    { id: "m-son", code: "Son", name: "Sơn PU", unit: "Kg", active: true },
    { id: "m-old", code: "Cu", name: "Vật tư cũ", unit: "Cái", active: false },
  ],
  facilities: [
    { id: "f-quang", code: "AnhQuang", name: "Anh Quảng", active: true },
    { id: "f-old", code: "Dong", name: "Cơ sở đóng", active: false },
  ],
};
const inbound = () => emptyTransaction("t1", "INBOUND", "2026-03-01", "u1");
const outbound = () => emptyTransaction("t2", "OUTBOUND", "2026-03-01", "u1");

describe("balances", () => {
  it("computes Tồn cuối = Tồn đầu + nhập − xuất", () => {
    expect(
      computeCurrent({
        openingQuantity: "100",
        inboundQuantity: "20",
        outboundQuantity: "30",
        adjustmentQuantity: "0",
      }),
    ).toBe("90");
  });

  it("keeps decimals exact over many movements", () => {
    expect(
      computeCurrent({
        openingQuantity: "0.1",
        inboundQuantity: "0.2",
        outboundQuantity: "0.05",
        adjustmentQuantity: "-0.05",
      }),
    ).toBe("0.2");
  });

  it("classifies stock state", () => {
    expect(stockState("0", null)).toBe("out");
    expect(stockState("-3", null)).toBe("out");
    expect(stockState("5", "5")).toBe("low");
    expect(stockState("6", "5")).toBe("in");
    expect(stockState("6", null)).toBe("in");
  });
});

describe("decideStock", () => {
  it("refuses an issue that overdraws the balance", () => {
    expect(decideStock("10", new Decimal(-11))).toMatchObject({
      allowed: false,
      current: "10",
      requested: "11",
      resulting: "-1",
    });
  });

  it("allows an issue that lands on zero", () => {
    expect(decideStock("10", new Decimal(-10)).allowed).toBe(true);
  });

  it("still lets an already-negative material receive stock", () => {
    expect(decideStock("-5", new Decimal(3))).toMatchObject({
      allowed: true,
      resulting: "-2",
    });
    expect(decideStock("-5", new Decimal(-1)).allowed).toBe(false);
  });

  it("treats a zero delta as allowed even when negative", () => {
    expect(decideStock("-5", new Decimal(0)).allowed).toBe(true);
  });
});

describe("applyTransactionPatch", () => {
  it("resolves codes case-insensitively and snapshots name/unit", () => {
    const row = applyTransactionPatch(
      outbound(),
      { materialCode: " son ", facilityCode: "ANHQUANG", quantity: "2.5" },
      lookups,
    );
    expect(row).toMatchObject({
      materialId: "m-son",
      materialCode: "Son",
      materialName: "Sơn PU",
      unit: "Kg",
      facilityId: "f-quang",
      facilityCode: "AnhQuang",
      facilityName: "Anh Quảng",
      quantity: "2.5",
      amount: null,
    });
  });

  it("keeps the snapshot when unrelated fields change and masters were renamed", () => {
    const saved = applyTransactionPatch(
      inbound(),
      { materialCode: "son", quantity: "1" },
      lookups,
    );
    const renamed: Lookups = {
      ...lookups,
      materials: [{ ...lookups.materials[0]!, name: "Tên mới", unit: "L" }],
    };
    const next = applyTransactionPatch(
      saved,
      { note: "ghi chú", materialCode: "SON" },
      renamed,
    );
    expect(next.materialName).toBe("Sơn PU");
    expect(next.unit).toBe("Kg");
    expect(next.note).toBe("ghi chú");
  });

  it("rejects unknown and inactive codes with a Vietnamese message", () => {
    expect(() =>
      applyTransactionPatch(inbound(), { materialCode: "khong-co" }, lookups),
    ).toThrow(/không có trong danh mục/);
    expect(() =>
      applyTransactionPatch(inbound(), { materialCode: "cu" }, lookups),
    ).toThrow(/ngừng sử dụng/);
    expect(() =>
      applyTransactionPatch(outbound(), { facilityCode: "dong" }, lookups),
    ).toThrow(MaterialsError);
  });

  it("recomputes amount from quantity × unitPrice", () => {
    const row = applyTransactionPatch(
      inbound(),
      { materialCode: "son", quantity: "2.5", unitPrice: "120000" },
      lookups,
    );
    expect(row.amount).toBe("300000");
    expect(
      applyTransactionPatch(row, { unitPrice: null }, lookups).amount,
    ).toBeNull();
    expect(applyTransactionPatch(row, { quantity: "3" }, lookups).amount).toBe(
      "360000",
    );
  });

  it("clears the snapshot when the code is blanked", () => {
    const row = applyTransactionPatch(
      inbound(),
      { materialCode: "son" },
      lookups,
    );
    expect(
      applyTransactionPatch(row, { materialCode: "" }, lookups),
    ).toMatchObject({
      materialId: "",
      materialCode: "",
      unit: "",
    });
  });
});

describe("transactionCompleteness", () => {
  it("names the first missing piece", () => {
    expect(transactionCompleteness(outbound())).toBe("Chưa chọn mã vật tư");
    const withMaterial = applyTransactionPatch(
      outbound(),
      { materialCode: "son" },
      lookups,
    );
    expect(transactionCompleteness(withMaterial)).toBe(
      "Số lượng phải lớn hơn 0",
    );
    const withQuantity = applyTransactionPatch(
      withMaterial,
      { quantity: "1" },
      lookups,
    );
    expect(transactionCompleteness(withQuantity)).toBe(
      "Chưa chọn cơ sở / người nhận",
    );
    expect(
      transactionCompleteness(
        applyTransactionPatch(
          withQuantity,
          { facilityCode: "anhquang" },
          lookups,
        ),
      ),
    ).toBeNull();
    expect(
      transactionCompleteness(
        applyTransactionPatch(
          inbound(),
          { materialCode: "son", quantity: "1" },
          lookups,
        ),
      ),
    ).toBeNull();
  });
});

describe("cell parsing and formatting", () => {
  it("parses Excel-style numbers and dates", () => {
    expect(parseCell("quantity", "3,280")).toBe("3280");
    expect(parseCell("quantity", "0.05")).toBe("0.05");
    expect(parseCell("quantity", "")).toBe("0");
    expect(parseCell("unitPrice", "")).toBeNull();
    expect(() => parseCell("quantity", "0,3")).toThrow(MaterialsError);
    expect(() => parseCell("quantity", "-1")).toThrow();
    expect(parseCell("transactionDate", "5/3/2026")).toBe("2026-03-05");
    expect(() => parseCell("transactionDate", "31/02/2026")).toThrow();
    expect(parseCell("note", "  giữ nguyên ")).toBe("  giữ nguyên ");
  });

  it("formats quantities like the workbook", () => {
    expect(formatQuantity("3280")).toBe("3,280");
    expect(formatQuantity("212898.6")).toBe("212,898.6");
    expect(formatQuantity("-1234.5")).toBe("-1,234.5");
    expect(formatQuantity(null)).toBe("");
  });

  it("refuses server-owned fields on a patch", () => {
    expect(() => transactionPatchSchema.parse({ amount: "1" })).toThrow();
    expect(() => transactionPatchSchema.parse({ quantity: "0" })).toThrow();
    expect(transactionPatchSchema.parse({ quantity: "1.50" })).toEqual({
      quantity: "1.5",
    });
  });
});

describe("service helpers", () => {
  it("fingerprints the business fields, tolerant to case, spaces and decimal form", () => {
    const base = {
      type: "OUTBOUND" as const,
      transactionDate: "2026-03-01",
      materialCode: "Son",
      facilityCode: "AnhQuang",
      quantity: "2.50",
      note: " Ghi chú ",
    };
    const same = {
      ...base,
      materialCode: " SON",
      facilityCode: "anhquang ",
      quantity: "2.5",
      note: "ghi chú",
    };
    expect(fingerprintOf(base)).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprintOf(same)).toBe(fingerprintOf(base));
    expect(fingerprintOf({ ...base, quantity: "3" })).not.toBe(
      fingerprintOf(base),
    );
    expect(fingerprintOf({ ...base, type: "INBOUND" })).not.toBe(
      fingerprintOf(base),
    );
  });

  it("escapes regex metacharacters", () => {
    expect(new RegExp(escapeRegex("a.b*(c)")).test("a.b*(c)")).toBe(true);
    expect(new RegExp(escapeRegex("a.b")).test("axb")).toBe(false);
  });

  it("builds the ledger filter", () => {
    const filter = transactionFilter(
      new URLSearchParams({
        type: "OUTBOUND",
        from: "2026-01-01",
        to: "2026-01-31",
        q: "anh (quang)",
        materialId: "m-son",
      }),
    );
    expect(filter).toMatchObject({
      type: "OUTBOUND",
      status: "POSTED",
      materialId: "m-son",
      transactionDate: {
        $gte: new Date("2026-01-01T00:00:00Z"),
        $lte: new Date("2026-01-31T00:00:00Z"),
      },
    });
    expect(filter.$or).toHaveLength(6);
    expect(filter.$or).toContainEqual({
      note: { $regex: "anh \\(quang\\)", $options: "i" },
    });
    expect(
      transactionFilter(
        new URLSearchParams({ type: "INBOUND", status: "ALL" }),
      ),
    ).toEqual({
      type: "INBOUND",
    });
    expect(
      transactionFilter(
        new URLSearchParams({ type: "INBOUND", status: "CANCELLED" }),
      ).status,
    ).toBe("CANCELLED");
    expect(() =>
      transactionFilter(new URLSearchParams({ type: "ADJUSTMENT" })),
    ).toThrow();
    expect(() => transactionFilter(new URLSearchParams({}))).toThrow();
    expect(() =>
      transactionFilter(
        new URLSearchParams({ type: "INBOUND", from: "01/01/2026" }),
      ),
    ).toThrow();
  });
});
