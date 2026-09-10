import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  linkSlip,
  parseSalesWorkbook,
} from "@/domains/sales-slips/import-workbook";
import { confirmProblems, type Masters } from "@/domains/sales-slips/contracts";

/**
 * Runs against the real `assets/08092026.xlsx`. The catalogue is the
 * workbook's own KhoSon here (merged over an empty base), which is exactly
 * what `--apply` produces before slips are linked.
 */
const bytes = readFileSync("assets/08092026.xlsx");
const empty: Masters = { items: [], recipients: [] };
const parsed = parseSalesWorkbook(bytes, empty, "08092026.xlsx");
const bySheet = Object.fromEntries(
  parsed.invoices.map((invoice) => [invoice.sheet, invoice]),
);

describe("workbook classification", () => {
  it("separates template, invoices, masters, shipping labels and legacy sheets", () => {
    expect(parsed.sheets).toHaveLength(21);
    expect(parsed.report.sheetKinds).toEqual({
      template: 1,
      invoice: 8,
      master: 2,
      shippingLabel: 5,
      legacyLedger: 2,
      helper: 2,
      empty: 1,
    });
    const kindOf = (name: string) =>
      parsed.sheets.find((sheet) => sheet.name === name)?.kind;
    expect(kindOf("HOADONMAU")).toBe("template");
    expect(kindOf("HOADONMAU (2)")).toBe("invoice");
    for (const name of [
      "Home",
      "Sheet5 (8)",
      "Sheet5 (7)",
      "Sheet5",
      "Sheet5 (2)",
    ])
      expect(kindOf(name)).toBe("shippingLabel");
    for (const name of ["Xuyen0303", "Xuyen1905"])
      expect(kindOf(name)).toBe("legacyLedger");
    expect(kindOf("KhoSon")).toBe("master");
    expect(parsed.invoices.map((invoice) => invoice.sheet)).not.toContain(
      "HOADONMAU",
    );
  });

  it("reads the masters with VLOOKUP semantics (first duplicate wins)", () => {
    expect(parsed.items.length).toBe(500);
    expect(parsed.report.masterItemDuplicates).toHaveLength(2);
    expect(
      parsed.items.find((item) => item.code.toLowerCase() === "sonpha7505c-pt"),
    ).toMatchObject({
      name: "Sơn pha 7505c-pt",
      unit: "Kg",
      salePrice: "170000",
    });
    expect(parsed.recipients.length).toBeGreaterThan(50);
    expect(parsed.recipients.find((r) => r.code === "Tuan")).toMatchObject({
      name: "Đỗ Mạnh Tuấn",
    });
  });
});

describe("invoice extraction", () => {
  it.each([
    ["C.Thanh (2)", "2026-09-08", "ĐỖ THỊ THANH", 2, "865000"],
    ["C.Quag", "2026-09-07", "ĐỖ VĂN QUẢNG", 1, "40000"],
    ["C.Quag (2)", "2026-09-08", "ĐỖ VĂN QUẢNG", 1, "425000"],
    ["A.Tuấn1", "2026-09-08", "ĐỖ MẠNH TUẤN", 1, "85000"],
    ["A.Tuấn1 (2)", "2026-09-08", "NGÔ HUY SÁNG", 1, "85000"],
    ["A.Mạnh", "2026-09-08", "NGUYỄN VĂN MẠNH", 1, "800000"],
    ["C.vank3", "2026-07-21", "NGUYỄN THỊ VÂN", 5, "3560000"],
  ])(
    "%s reconciles with the workbook total",
    (sheet, date, recipient, lines, total) => {
      const invoice = bySheet[sheet]!;
      expect(invoice.slip.slipDate).toBe(date);
      expect(invoice.slip.recipientName).toBe(recipient);
      expect(invoice.slip.lines).toHaveLength(lines);
      expect(invoice.excelTotal).toBe(total);
      expect(invoice.computedTotal).toBe(total);
      expect(invoice.difference).toBe("0");
      expect(invoice.issues).toEqual([]);
      expect(invoice.valid).toBe(true);
      expect(invoice.slip.status).toBe("CONFIRMED");
      expect(invoice.slip.sourceType).toBe("MIGRATION");
      expect(invoice.slip.internalNumber).toBeNull();
      expect(confirmProblems(invoice.slip)).toEqual([]);
    },
  );

  it("snapshots the line exactly as written (C.Thanh (2))", () => {
    const [first, second] = bySheet["C.Thanh (2)"]!.slip.lines;
    expect(first).toMatchObject({
      itemCode: "sonpha7505C-pt",
      itemName: "Sơn pha 7505c-pt",
      unit: "Kg",
      quantity: "5",
      unitPrice: "170000",
      lineAmount: "850000",
      priceManual: true,
    });
    expect(second).toMatchObject({
      itemCode: "Hopnhuato",
      quantity: "1",
      unitPrice: "15000",
      lineAmount: "15000",
    });
    expect(bySheet["C.Thanh (2)"]!.slip.totalInWords).toBe(
      "Tám trăm sáu mươi lăm nghìn đồng",
    );
    expect(bySheet["C.Quag"]!.slip.lines[0]).toMatchObject({
      quantity: "0.05",
      unitPrice: "800000",
      lineAmount: "40000",
    });
  });

  it("keeps HOADONMAU (2) as a draft for review: unknown codes and #VALUE! totals", () => {
    const invoice = bySheet["HOADONMAU (2)"]!;
    expect(invoice.hidden).toBe(true);
    expect(invoice.valid).toBe(false);
    expect(invoice.slip.status).toBe("DRAFT");
    expect(invoice.unknownItems).toEqual([
      "FYL32A-20",
      "FYL32A5-20",
      "FYG32A5-20",
      "952a1",
      "952B1",
    ]);
    expect(invoice.excelTotal).toBeNull();
    expect(invoice.issues.some((issue) => issue.includes("lỗi Excel"))).toBe(
      true,
    );
    expect(invoice.slip.lines).toHaveLength(8);
    expect(invoice.slip.migrationIssues).toEqual(invoice.issues);
  });

  it("links recipients by name to the facility master when one matches", () => {
    expect(bySheet["A.Tuấn1"]!.slip.recipientCode).toBe("Tuan");
    expect(bySheet["A.Tuấn1 (2)"]!.slip.recipientCode).toBe("");
    const relinked = linkSlip(bySheet["C.Thanh (2)"]!.slip, {
      items: [
        {
          id: "db-1",
          code: "SONPHA7505C-PT",
          name: "x",
          unit: "Kg",
          salePrice: "1",
        },
      ],
      recipients: [{ id: "db-r", code: "T", name: "Đỗ Thị Thanh" }],
    });
    expect(relinked.recipientId).toBe("db-r");
    expect(relinked.lines[0]?.itemId).toBe("db-1");
    expect(relinked.lines[1]?.itemId).toBeNull();
  });

  it("totals and fingerprints the run deterministically", () => {
    expect(parsed.report).toMatchObject({
      invoiceCandidates: 8,
      validInvoices: 7,
      needsReview: 1,
      totalLines: 20,
      unknownItemLines: 5,
      amountMismatches: 0,
      totalMismatches: 0,
      excelTotal: "5860000",
      computedTotal: "7015000",
    });
    const again = parseSalesWorkbook(bytes, empty, "08092026.xlsx");
    expect(again.hash).toBe(parsed.hash);
    expect(again.invoices.map((invoice) => invoice.fingerprint)).toEqual(
      parsed.invoices.map((invoice) => invoice.fingerprint),
    );
    expect(
      new Set(parsed.invoices.map((invoice) => invoice.slip.id)).size,
    ).toBe(8);
  });
});
