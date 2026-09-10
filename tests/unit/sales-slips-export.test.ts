import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  applyDraft,
  emptySlip,
  type Masters,
  type SalesSlip,
} from "@/domains/sales-slips/contracts";
import {
  exportFileName,
  exportSalesSlipWorkbook,
} from "@/domains/sales-slips/export-workbook";
import { renderSalesSlipPdf } from "@/domains/sales-slips/pdf";

const masters: Masters = {
  items: [
    {
      id: "i1",
      code: "sonpha7505C-pt",
      name: "Sơn pha 7505c-pt",
      unit: "Kg",
      salePrice: "170000",
    },
    {
      id: "i2",
      code: "Hopnhuato",
      name: 'Hộp nhựa <to> & "quote"',
      unit: "Hộp",
      salePrice: "15000",
    },
  ],
  recipients: [],
};
const slip = (): SalesSlip => ({
  ...applyDraft(
    emptySlip("slip-1", "2026-09-08", "u"),
    {
      slipDate: "2026-09-08",
      recipientCode: "",
      recipientName: "ĐỖ THỊ THANH",
      recipientUnit: "",
      content: '=HYPERLINK("https://invalid.test")',
      note: "",
      lines: [
        { id: "l1", itemCode: "sonpha7505C-pt", quantity: "5" },
        { id: "l2", itemCode: "Hopnhuato", quantity: "1" },
      ],
    },
    masters,
    { canEditPrice: false },
  ),
  internalNumber: "PBH-20260908-001",
  createdAt: "2026-09-08T10:00:11.910Z",
  updatedAt: "2026-09-08T10:00:11.910Z",
});

describe("template-based XLSX export", () => {
  it("writes the form with merges, widths, values, the shifted footer and no formulas", async () => {
    const bytes = await exportSalesSlipWorkbook(slip());
    const book = XLSX.read(bytes, {
      type: "array",
      cellDates: true,
      cellStyles: true,
      cellFormula: true,
    });
    expect(book.SheetNames).toEqual(["PhieuBanHang"]);
    const sheet = book.Sheets.PhieuBanHang!;
    expect(sheet["!ref"]).toBe("A1:G18");
    expect(sheet.A1.v).toBe("CÔNG TY TNHH CỬA ĐỎ");
    expect(sheet.A2.v).toBe(
      "Số 25A,Lô 15,cụm CN làng nghề Hạ Thái,Duyên Thái,Thường Tín,Hà Nội",
    );
    expect(sheet.A4.v).toBe("PHIẾU BÁN HÀNG");
    expect(sheet.A5.v).toBe("Ngày   08   Tháng   09    năm 2026");
    expect(sheet.C6.v).toBe("ĐỖ THỊ THANH");
    expect(sheet.A8.v).toBe('Nội dung: =HYPERLINK("https://invalid.test")');
    expect(sheet.A8.f).toBeUndefined();
    expect(sheet.B10.v).toBe("Mã VT");
    expect(sheet.B11.v).toBe("sonpha7505C-pt");
    expect(sheet.C11.v).toBe("Sơn pha 7505c-pt");
    expect(sheet.D11.v).toBe("Kg");
    expect(sheet.E11.v).toBe(5);
    expect(sheet.F11.v).toBe(170000);
    expect(sheet.G11.v).toBe(850000);
    expect(sheet.C12.v).toBe('Hộp nhựa <to> & "quote"');
    expect(sheet.A13.v).toBe("Tổng tiền:");
    expect(sheet.G13.v).toBe(865000);
    expect(sheet.A14.v).toBe("Tổng cộng tiền thanh toán:");
    expect(sheet.G14.v).toBe(865000);
    expect(sheet.A15.v).toBe("Bằng chữ : Tám trăm sáu mươi lăm nghìn đồng");
    expect(sheet.B15?.v).toBeUndefined();
    expect(sheet.E16.v).toBe("Ngày….tháng….năm 2026");
    expect(sheet.A17.v).toBe("Người lập phiếu");
    expect(sheet.F17.v).toBe("Giám đốc");
    expect(sheet.A18.v).toBe("(Ký,họ tên)");
    expect(sheet["!merges"]).toContainEqual({
      s: { r: 3, c: 0 },
      e: { r: 3, c: 6 },
    });
    expect(sheet["!merges"]).toContainEqual({
      s: { r: 12, c: 0 },
      e: { r: 12, c: 5 },
    });
    expect(sheet["!merges"]).toContainEqual({
      s: { r: 17, c: 5 },
      e: { r: 17, c: 6 },
    });
    expect(sheet["!cols"]?.[1]?.width).toBeCloseTo(23.33, 1);
    expect(sheet["!cols"]?.[2]?.width).toBeCloseTo(30.55, 1);
    expect(sheet["!rows"]?.[9]?.hpt).toBe(44.25);
    expect(sheet.A10.s?.fgColor?.rgb).toBe("95B3D7");
    expect(sheet.B11.s?.fgColor?.rgb).toBe("DBEEF4");
    expect(typeof sheet.A3.v === "number" || sheet.A3.v instanceof Date).toBe(
      true,
    );
    for (const address of Object.keys(sheet))
      if (!address.startsWith("!"))
        expect((sheet[address] as XLSX.CellObject).f).toBeUndefined();
    const names = book.Workbook?.Names ?? [];
    expect(names.map((name) => [name.Name, name.Ref])).toEqual([
      ["_xlnm.Print_Area", "'PhieuBanHang'!$A$1:$G$18"],
    ]);
    expect(exportFileName(slip(), "xlsx")).toBe("PBH-20260908-001.xlsx");
  });

  it("marks a cancelled slip in the title and blanks money for a redacted reader", async () => {
    const cancelled = await exportSalesSlipWorkbook({
      ...slip(),
      status: "CANCELLED",
    });
    expect(
      XLSX.read(cancelled, { type: "array" }).Sheets.PhieuBanHang!.A4.v,
    ).toBe("PHIẾU BÁN HÀNG (ĐÃ HỦY)");
    const redacted = await exportSalesSlipWorkbook({
      ...slip(),
      pricesRedacted: true,
      subtotal: null,
      totalPayment: null,
      totalInWords: null,
    });
    const sheet = XLSX.read(redacted, { type: "array" }).Sheets.PhieuBanHang!;
    expect(sheet.F11).toBeUndefined();
    expect(sheet.G13).toBeUndefined();
    expect(sheet.E11.v).toBe(5);
  });
});

describe("PDF export", () => {
  it("renders a PDF with the embedded Vietnamese font", async () => {
    const bytes = await renderSalesSlipPdf(slip());
    const head = Buffer.from(bytes.subarray(0, 8)).toString("latin1");
    expect(head.startsWith("%PDF-1.")).toBe(true);
    const text = Buffer.from(bytes).toString("latin1");
    expect(text).toContain("/Type /Page");
    expect(text).toContain("Tinos");
    expect(bytes.length).toBeGreaterThan(20_000);
  }, 30_000);
});
