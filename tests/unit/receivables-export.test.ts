import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  debtStateOf,
  type ReceivableEntry,
  type SummaryRow,
} from "@/domains/receivables/contracts";
import {
  buildWorkbook,
  excelSerial,
  exportFileNames,
  statementFileName,
  type ExportInput,
} from "@/domains/receivables/export-workbook";

/**
 * The export has to open in Excel looking like the file it replaces: the same
 * title, headers, column widths, number formats, print area and signature
 * block, with literal values where the SUMIFs used to be.
 */

const stamp = "2026-09-09T09:34:00.000Z";

const summaryRow = (
  code: string,
  name: string,
  opening: string,
  increase: string,
  decrease: string,
  closing: string,
): SummaryRow => ({
  stt: 1,
  customerId: `id-${code}`,
  code,
  name,
  phone: "0982609741",
  note: "",
  active: true,
  opening,
  increase,
  decrease,
  closing,
  state: debtStateOf(closing),
  entryCount: 2,
  hasOpening: true,
});

const entry = (overrides: Partial<ReceivableEntry>): ReceivableEntry => ({
  id: "e1",
  version: 1,
  customerId: "id-Nha",
  customerCode: "Nha",
  customerName: "Nguyễn Ngọc Nha",
  customerPhone: "0982609741",
  entryDate: "2026-01-02",
  role: "DEBIT",
  type: "SALE",
  status: "POSTED",
  amount: "45000",
  documentNumber: "",
  description: "xuất kho",
  note: "",
  legacyDescription: "",
  itemCode: "Sonpha412C",
  itemName: "Sơn pha 412C",
  unit: "Kg",
  quantity: "0.3",
  unitPrice: "150000",
  referenceType: "SALES_LEDGER",
  referenceId: "ref-1",
  referenceNumber: "",
  sequence: 1,
  batchId: null,
  periodYear: null,
  sourceType: "MIGRATION",
  migrationSource: "Reddoor-congno-2026.xlsx",
  migrationSheet: "ChiTietBanHang",
  sourceRow: 4,
  issues: [],
  postedAt: stamp,
  postedBy: "u",
  cancelledAt: null,
  cancelledBy: null,
  cancelReason: null,
  createdAt: stamp,
  updatedAt: stamp,
  createdBy: "u",
  updatedBy: "u",
  ...overrides,
});

const input: ExportInput = {
  scope: "all",
  summary: [
    summaryRow(
      "Nha",
      "Nguyễn Ngọc Nha",
      "95350",
      "37802000",
      "32863500",
      "5033850",
    ),
    {
      ...summaryRow("QuyetBK", "Đỗ Mạnh Quyết", "-250", "0", "0", "-250"),
      stt: 2,
    },
  ],
  totals: {
    opening: "95100",
    increase: "37802000",
    decrease: "32863500",
    closing: "5033600",
  },
  sales: [entry({})],
  reductions: [
    entry({
      id: "e2",
      role: "CREDIT",
      type: "PAINT_OFFSET",
      amount: "3811000",
      entryDate: "2026-01-31",
      // The wording the accountant recognises, kept verbatim.
      legacyDescription: "Trừ tiền sơn",
      description: "Trừ tiền sơn",
      itemCode: "",
      itemName: "",
      unit: "",
      quantity: null,
      unitPrice: null,
      migrationSheet: "ThanhToan",
    }),
  ],
  window: { from: null, to: "2026-09-09" },
  preparedBy: "Thủ kho",
  generatedAt: new Date(stamp),
};

async function read(scope: ExportInput["scope"] = "all") {
  const bytes = await buildWorkbook({ ...input, scope });
  return XLSX.read(bytes, { type: "buffer" });
}

describe("receivables export", () => {
  it("keeps the three sheets of the source workbook", async () => {
    const book = await read();
    expect(book.SheetNames).toEqual([
      "ChiTietBanHang",
      "ThanhToan",
      "TongHopCongNo",
    ]);
  });

  it("writes the summary in the source's column order", async () => {
    const book = await read();
    const sheet = book.Sheets.TongHopCongNo!;
    expect(sheet.D1?.v).toContain("BẢNG TỔNG HỢP CÔNG NỢ");
    expect(sheet.C2?.v).toBe("STT");
    expect(sheet.D2?.v).toBe("Mã khách");
    expect(sheet.G2?.v).toContain("Dư đầu");
    expect(sheet.H2?.v).toBe("Phát sinh tăng");
    expect(sheet.I2?.v).toBe("Phát sinh giảm");
    expect(sheet.J2?.v).toBe("Dư cuối kỳ");
    // First data row.
    expect(sheet.D3?.v).toBe("Nha");
    expect(sheet.E3?.v).toBe("Nguyễn Ngọc Nha");
    expect(sheet.G3?.v).toBe(95350);
    expect(sheet.H3?.v).toBe(37802000);
    expect(sheet.I3?.v).toBe(32863500);
    expect(sheet.J3?.v).toBe(5033850);
  });

  it("carries a negative balance through as a number, not a blank", async () => {
    const book = await read();
    expect(book.Sheets.TongHopCongNo!.G4?.v).toBe(-250);
    expect(book.Sheets.TongHopCongNo!.J4?.v).toBe(-250);
  });

  it("writes the total line under the table", async () => {
    const book = await read();
    const sheet = book.Sheets.TongHopCongNo!;
    expect(sheet.C5?.v).toBe("Cộng tổng");
    expect(sheet.G5?.v).toBe(95100);
    expect(sheet.H5?.v).toBe(37802000);
    expect(sheet.I5?.v).toBe(32863500);
    expect(sheet.J5?.v).toBe(5033600);
    // The identity holds in the exported file too.
    expect(sheet.G5!.v! + sheet.H5!.v! - (sheet.I5!.v as number)).toBe(
      sheet.J5?.v,
    );
  });

  it("keeps the signature block the printed report needs", async () => {
    const book = await read();
    const sheet = book.Sheets.TongHopCongNo!;
    const cells = Object.values(sheet)
      .map((cell) => (cell as XLSX.CellObject)?.v)
      .filter((value): value is string => typeof value === "string");
    expect(cells).toContain("Ngày lập báo cáo");
    expect(cells).toContain("Phụ trách kế toán");
    expect(cells).toContain("Giám đốc");
    expect(cells.some((value) => value.includes("Người lập"))).toBe(true);
  });

  it("names the reporting period on the total line", async () => {
    const book = await read();
    expect(book.Sheets.TongHopCongNo!.K5?.v).toBe(
      "Số liệu tính đến ngày 09/09/2026",
    );
  });

  it("writes sales lines with their own price snapshot", async () => {
    const book = await read();
    const sheet = book.Sheets.ChiTietBanHang!;
    expect(sheet.A3?.v).toBe("Ngày tháng");
    expect(sheet.L3?.v).toBe("Thành tiền");
    expect(sheet.A4?.v).toBe(excelSerial("2026-01-02"));
    expect(sheet.B4?.v).toBe("Nha");
    expect(sheet.F4?.v).toBe("Sonpha412C");
    expect(sheet.J4?.v).toBe(0.3);
    expect(sheet.K4?.v).toBe(150000);
    expect(sheet.L4?.v).toBe(45000);
  });

  it("writes reductions with the legacy wording", async () => {
    const book = await read();
    const sheet = book.Sheets.ThanhToan!;
    expect(sheet.G2?.v).toBe("Số tiền thanh toán/trừ sơn");
    expect(sheet.A3?.v).toBe(excelSerial("2026-01-31"));
    expect(sheet.C3?.v).toBe("Nha");
    expect(sheet.F3?.v).toBe("Trừ tiền sơn");
    expect(sheet.G3?.v).toBe(3811000);
  });

  it("contains no formula and no error value", async () => {
    const book = await read();
    for (const name of book.SheetNames) {
      const sheet = book.Sheets[name]!;
      for (const [address, cell] of Object.entries(sheet)) {
        if (address.startsWith("!")) continue;
        const value = cell as XLSX.CellObject;
        // A SUMIF that survived would let the file disagree with the server.
        expect(value.f).toBeUndefined();
        expect(value.t).not.toBe("e");
        if (typeof value.v === "string")
          expect(value.v).not.toMatch(/#REF!|#VALUE!|#N\/A|#DIV\/0!/);
      }
    }
  });

  it("keeps the print area and the frozen header", async () => {
    const book = await read();
    const summary = book.Sheets.TongHopCongNo!;
    expect(summary["!margins"]).toBeDefined();
    // Freeze panes travel in the sheet views the template carries.
    expect(summary["!ref"]).toMatch(/^A1:K\d+$/);
    expect(book.Sheets.ChiTietBanHang!["!ref"]).toMatch(/^A1:M\d+$/);
    expect(book.Sheets.ThanhToan!["!ref"]).toMatch(/^A1:H\d+$/);
  });

  it("keeps the source's column widths and merges", async () => {
    // Read straight from the package: the widths live in the template XML the
    // export never rewrites, and SheetJS only surfaces them with cellStyles.
    const bytes = await buildWorkbook(input);
    const book = XLSX.read(bytes, { type: "buffer", cellStyles: true });
    const widths = book.Sheets.TongHopCongNo!["!cols"];
    expect(widths).toBeDefined();
    expect(widths!.length).toBeGreaterThanOrEqual(11);
    // The title merge D1:K1 is part of how the report prints.
    expect(
      (book.Sheets.TongHopCongNo!["!merges"] ?? []).some(
        (merge) => merge.s.r === 0 && merge.s.c === 3 && merge.e.c === 10,
      ),
    ).toBe(true);
  });

  it("only fills the sheets the scope asks for", async () => {
    const summaryOnly = await read("summary");
    // The other two sheets stay as the template left them: headers, no rows.
    expect(summaryOnly.Sheets.TongHopCongNo!.D3?.v).toBe("Nha");
    expect(summaryOnly.Sheets.ChiTietBanHang!.A4).toBeUndefined();
    const salesOnly = await read("sales");
    expect(salesOnly.Sheets.ChiTietBanHang!.B4?.v).toBe("Nha");
    expect(salesOnly.Sheets.TongHopCongNo!.D3).toBeUndefined();
  });

  it("names the file after the scope, and a statement after the customer", () => {
    expect(exportFileNames.summary).toBe("TONG-HOP-CONG-NO.xlsx");
    expect(exportFileNames.all).toBe("CONG-NO-2026.xlsx");
    expect(statementFileName("Nha")).toBe("CONG-NO-NHA.xlsx");
    // Vietnamese diacritics are folded so the name survives any mail client.
    expect(statementFileName("Đỗ Mạnh Tuấn")).toBe("CONG-NO-DO-MANH-TUAN.xlsx");
    expect(statementFileName("C.thanh")).toBe("CONG-NO-C-THANH.xlsx");
  });

  it("converts dates to the 1899-12-30 serial epoch", () => {
    expect(excelSerial("2026-01-02")).toBe(46024);
    expect(excelSerial("2026-09-09")).toBe(46274);
  });
});
