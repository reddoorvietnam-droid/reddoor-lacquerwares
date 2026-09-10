import { describe, it, expect } from "vitest";
import {
  applyPatch,
  emptyRow,
  multiply,
  parseCell,
  patchSchema,
  type Master,
} from "@/domains/paint-warehouse/contracts";
import { getRoleDefinitionSeed } from "@/domains/identity/role-definitions";
import layout from "@/domains/paint-warehouse/layout.json";
const masters: Master[] = [
  {
    kind: "material",
    code: "paint",
    name: "Sơn",
    unit: "Kg",
    unitPrice: "120000",
  },
  {
    kind: "material",
    code: "other",
    name: "Sơn mới",
    unit: "L",
    unitPrice: "200000",
  },
  {
    kind: "facility",
    code: "noibo",
    name: "Nội bộ",
    unit: "",
    unitPrice: null,
  },
];
const row = () => emptyRow("test", "2026-09-09", "actor");
describe("paint warehouse business rules", () => {
  it.each([
    ["1", "200000", "200000"],
    ["2.5", "120000", "300000"],
    ["3", "120000", "360000"],
    ["0.1", "0.2", "0.02"],
  ])("multiplies %s × %s exactly", (a, b, expected) =>
    expect(multiply(a, b)).toBe(expected),
  );
  it("resolves Excel case-insensitive lookups and default K/L", () => {
    const saved = applyPatch(
      row(),
      { facilityCode: "NOIBO", materialCode: "PAINT", quantity: "2.5" },
      masters,
    );
    expect(saved).toMatchObject({
      facilityNameSnapshot: "Nội bộ",
      materialNameSnapshot: "Sơn",
      unit: "Kg",
      unitPrice: "120000",
      actualQuantity: "2.5",
      discountedUnitPrice: "120000",
      amount: "300000",
      actualAmount: "300000",
    });
  });
  it("preserves manual K and L across subsequent H and D changes", () => {
    const initial = applyPatch(
      row(),
      { materialCode: "paint", quantity: "0.3" },
      masters,
    );
    const manual = applyPatch(
      initial,
      { actualQuantity: "1", discountedUnitPrice: "90000" },
      masters,
    );
    expect(
      applyPatch(manual, { quantity: "3", materialCode: "other" }, masters),
    ).toMatchObject({
      actualQuantity: "1",
      discountedUnitPrice: "90000",
      actualAmount: "90000",
      unitPrice: "200000",
      amount: "600000",
    });
    expect(
      applyPatch(
        manual,
        { actualQuantity: null, discountedUnitPrice: null },
        masters,
      ),
    ).toMatchObject({
      actualQuantity: "0.3",
      discountedUnitPrice: "120000",
      actualQuantityManual: false,
      discountedPriceManual: false,
    });
  });
  it("keeps price snapshots when unrelated cells change", () => {
    const old = applyPatch(
      row(),
      { materialCode: "paint", quantity: "1" },
      masters,
    );
    const changed = masters.map((m) => ({ ...m, unitPrice: "999999" }));
    expect(applyPatch(old, { note: "giữ lịch sử" }, changed).unitPrice).toBe(
      "120000",
    );
  });
  it("rejects unknown codes, invalid dates, negative prices and client amounts", () => {
    expect(() =>
      applyPatch(row(), { materialCode: "missing" }, masters),
    ).toThrow();
    expect(() => parseCell("exportDate", "31/02/2026")).toThrow();
    expect(() => parseCell("discountedUnitPrice", "-1")).toThrow();
    expect(() => patchSchema.parse({ amount: "1" })).toThrow();
    expect(() => parseCell("quantity", "0,3")).toThrow();
    expect(parseCell("quantity", "0.05")).toBe("0.05");
    expect(parseCell("discountedUnitPrice", "120,000")).toBe("120000");
  });
  it("gives the storekeeper and director explicit ledger permissions only", () => {
    for (const role of ["WAREHOUSE_MANAGER", "DIRECTOR"] as const)
      for (const action of [
        "read",
        "create",
        "update",
        "delete",
        "export",
        "import",
      ])
        expect(getRoleDefinitionSeed(role)?.permissions).toContainEqual({
          permission: `paintWarehouse.${action}`,
          scope: "all",
        });
    expect(
      getRoleDefinitionSeed("CONTENT_CREATOR")?.permissions.some((p) =>
        p.permission.startsWith("paintWarehouse."),
      ),
    ).toBe(false);
  });
});

/**
 * The exported .xlsx paints itself from `layout.json`; the web table no longer
 * reads it. Excel indexes theme colours as 0=lt1, 1=dk1, 2=lt2, 3=dk2 while the
 * theme part lists them dk1, lt1, dk2, lt2 — reading them in file order once
 * turned the whole exported sheet white on white.
 */
describe("layout keeps the exported workbook's own colours", () => {
  const styles = layout.styles as Record<
    string,
    { css: Record<string, string | number>; format: string }
  >;
  const css = (id: number | undefined) => styles[String(id)]?.css ?? {};
  const hex = (id: number | undefined, key: "color" | "backgroundColor") =>
    String(css(id)[key] ?? "").toUpperCase();
  const size = (id: number | undefined) => Number(css(id).fontSize ?? 0);
  const header = layout.rows["3"]!.styles;
  const data = layout.defaultRow.styles;

  it("prints black text on the sheet, never white on white", () => {
    for (const id of [...header, ...data])
      expect(hex(id, "color")).toBe("#000000");
  });
  it("keeps the blue header band and white body cells", () => {
    for (const id of header) expect(hex(id, "backgroundColor")).toBe("#8EB4E3");
    for (const column of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13])
      expect(hex(data[column], "backgroundColor")).toBe("#FFFFFF");
  });
  it("keeps the yellow discounted-price column and the smaller note font", () => {
    expect(hex(data[11], "backgroundColor")).toBe("#FFFF00");
    expect(size(data[13])).toBeLessThan(size(data[0]));
  });
  it("keeps the source column widths", () => {
    expect(layout.widths.map((width) => Math.round(width * 100) / 100)).toEqual(
      [
        15, 24.44, 25.66, 25.66, 30.55, 11, 8, 7.44, 16, 14.44, 10.33, 14.44,
        14.44, 14.33,
      ],
    );
  });
});
