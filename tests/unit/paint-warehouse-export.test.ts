import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { exportPaintWorkbook } from "@/domains/paint-warehouse/export-workbook";
import { emptyRow } from "@/domains/paint-warehouse/contracts";
import { readZipParts, assertWellFormedXml } from "./helpers/zip-reader";

describe("paint template export", () => {
  it("preserves headers, merges, widths, dates, decimals and literal formulas", async () => {
    const row = {
      ...emptyRow("a", "2025-02-08", "test"),
      sourceRow: 4,
      materialNameSnapshot: "Sơn tiếng Việt",
      note: '=HYPERLINK("https://invalid.test")',
      quantity: "2.5",
      unitPrice: "120000",
      amount: "300000",
      actualQuantity: "3",
      discountedUnitPrice: "120000",
      actualAmount: "360000",
    };
    const bytes = await exportPaintWorkbook([row]);
    const parts = readZipParts(bytes);
    for (const [name, part] of parts)
      if (name.endsWith(".xml") || name.endsWith(".rels"))
        assertWellFormedXml(new TextDecoder().decode(part), name);
    expect(new TextDecoder().decode(parts.get("xl/workbook.xml"))).toContain(
      "$A$1:$N$4",
    );
    const book = XLSX.read(bytes, {
      type: "array",
      cellDates: true,
      cellStyles: true,
    });
    expect(book.SheetNames).toEqual(["ChiTietxuatkho"]);
    const s = book.Sheets.ChiTietxuatkho!;
    expect(s.A1.v).toBe("SỔ CHI TIẾT XUẤT KHO SƠN\nNĂM 2026");
    expect(s["!merges"]).toContainEqual({
      s: { r: 0, c: 0 },
      e: { r: 0, c: 13 },
    });
    expect(s["!cols"]?.[0]?.width).toBe(15);
    expect(s.A4.v.toISOString().slice(0, 10)).toBe("2025-02-08");
    expect(s.H4.v).toBe(2.5);
    expect(s.M4.v).toBe(360000);
    expect(s.E4.v).toBe("Sơn tiếng Việt");
    expect(s.N4.t).toBe("s");
    expect(s.N4.f).toBeUndefined();
    expect(s.L4.s.fgColor.rgb).toBe("FFFF00");
    expect(s.A5).toBeUndefined();
  });
});
