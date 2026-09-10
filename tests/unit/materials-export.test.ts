import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  emptyTransaction,
  type Facility,
  type Material,
  type SummaryRow,
} from "@/domains/materials/contracts";
import {
  excelSerial,
  exportFileNames,
  exportMaterialsWorkbook,
  type ExportInput,
} from "@/domains/materials/export-workbook";

const stamp = "2026-09-09T03:00:00.000Z";
const material: Material = {
  id: "m1",
  version: 1,
  code: "CNdenbong",
  name: "Chân nhựa đen bóng",
  unit: "Cái",
  openingQuantity: "212898.6",
  minimumStock: null,
  note: "có chân nhựa cũ",
  active: true,
  sortOrder: 2,
  hasTransactions: true,
  createdAt: stamp,
  updatedAt: stamp,
  createdBy: "u",
  updatedBy: "u",
};
const facility: Facility = {
  id: "f1",
  version: 1,
  code: "Thanh",
  type: "Loại 1",
  name: "Chị Thanh",
  phone: "0904747252",
  note: "",
  active: true,
  sortOrder: 1,
  hasTransactions: true,
  createdAt: stamp,
  updatedAt: stamp,
  createdBy: "u",
  updatedBy: "u",
};
const summaryRow: SummaryRow = {
  materialId: "m1",
  stt: 1,
  code: material.code,
  name: material.name,
  unit: material.unit,
  openingQuantity: "212898.6",
  inboundQuantity: "0",
  outboundQuantity: "145624",
  adjustmentQuantity: "0",
  currentQuantity: "67274.6",
  minimumStock: null,
  note: '=HYPERLINK("https://invalid.test")',
  active: true,
  state: "in",
};
const outbound = {
  ...emptyTransaction("t1", "OUTBOUND", "2026-01-03", "u"),
  version: 1,
  materialId: "m1",
  materialCode: "cndenmo",
  materialName: "Chân nhựa đen mờ",
  unit: "Cái",
  quantity: "3280",
  facilityId: "f1",
  facilityCode: "Thanh",
  facilityName: "Chị Thanh",
  note: 'Caspari <&> "quote"',
};
const inbound = {
  ...emptyTransaction("t2", "INBOUND", "2025-01-05", "u"),
  version: 1,
  materialId: "m2",
  materialCode: "Keoketkhay",
  materialName: "Keo kẹt khay",
  unit: "Lọ",
  quantity: "2.5",
  unitPrice: "120000",
  amount: "300000",
  note: "=1+1",
};

const input = (scope: ExportInput["scope"]): ExportInput => ({
  scope,
  summary: [summaryRow],
  inbound: [inbound],
  outbound: [outbound],
  materials: [material],
  facilities: [facility],
  preparedBy: "Nguyễn Thị Hải Yến",
  generatedAt: new Date("2026-09-09T20:30:00.000Z"), // 10/09/2026 in Asia/Ho_Chi_Minh
});

const read = async (scope: ExportInput["scope"]) =>
  XLSX.read(await exportMaterialsWorkbook(input(scope)), {
    type: "array",
    cellDates: true,
    cellStyles: true,
    cellFormula: true,
  });

describe("materials template export", () => {
  it("writes all five sheets in template order with titles, merges and widths", async () => {
    const book = await read("all");
    expect(book.SheetNames).toEqual([
      "ChiTietxuatNVL",
      "ChiTietNhapNVL",
      "Tong kho NVL",
      "KhoNVL",
      "Cososx",
    ]);
    const out = book.Sheets.ChiTietxuatNVL!;
    expect(out.A1.v).toBe("SỔ CHI TIẾT NVL\nNĂM 2026");
    expect(out["!merges"]).toContainEqual({
      s: { r: 0, c: 0 },
      e: { r: 0, c: 8 },
    });
    expect(out["!cols"]?.[0]?.width).toBeCloseTo(14.44, 1);
    expect(out["!autofilter"]).toEqual({ ref: "A3:I4" });
    expect(out["!ref"]).toBe("A1:I4");
    // Data row: date, snapshots, decimal quantity, escaped note, nothing hidden from the template.
    expect(out.A4.t).toBe("d");
    expect((out.A4.v as Date).toISOString().slice(0, 10)).toBe("2026-01-03");
    expect(out.B4.v).toBe("Thanh");
    expect(out.E4.v).toBe("Chân nhựa đen mờ");
    expect(out.H4.v).toBe(3280);
    expect(out.I4.v).toBe('Caspari <&> "quote"');
    expect(out.A5).toBeUndefined();
    const names = book.Workbook?.Names ?? [];
    expect(names.map((n) => [n.Name, n.Sheet, n.Ref])).toEqual([
      ["_xlnm.Print_Titles", 0, "'ChiTietxuatNVL'!$1:$3"],
      ["_xlnm.Print_Titles", 1, "'ChiTietNhapNVL'!$1:$3"],
      ["_xlnm.Print_Titles", 2, "'Tong kho NVL'!$1:$3"],
    ]);
  });

  it("writes the inbound ledger with prices and never emits formulas", async () => {
    const book = await read("all");
    const sheet = book.Sheets.ChiTietNhapNVL!;
    expect(sheet.A1.v).toBe("SỔ CHI TIẾT NHẬP NVL\nNĂM 2026");
    expect((sheet.A4.v as Date).toISOString().slice(0, 10)).toBe("2025-01-05");
    expect(sheet.F4.v).toBe(2.5);
    expect(sheet.G4.v).toBe(120000);
    expect(sheet.H4.v).toBe(300000);
    expect(sheet.I4.t).toBe("s");
    expect(sheet.I4.v).toBe("=1+1");
    expect(sheet.I4.f).toBeUndefined();
    expect(sheet["!autofilter"]).toEqual({ ref: "A3:I4" });
    for (const name of book.SheetNames)
      for (const [address, cell] of Object.entries(book.Sheets[name]!))
        if (!address.startsWith("!"))
          expect((cell as XLSX.CellObject).f).toBeUndefined();
  });

  it("writes Tổng kho at C..K with the generation date and signature block", async () => {
    const book = await read("all");
    const sheet = book.Sheets["Tong kho NVL"]!;
    expect(sheet.C1.v).toBe("KHO NGUYÊN VẬT LIỆU 2026");
    expect(sheet.C2.v).toBe("Ngày lập bảng  : 10/09/2026");
    expect(sheet["!merges"]).toContainEqual({
      s: { r: 0, c: 2 },
      e: { r: 0, c: 10 },
    });
    expect(sheet["!merges"]).toContainEqual({
      s: { r: 4, c: 2 },
      e: { r: 4, c: 3 },
    });
    expect(sheet.C4.v).toBe(1);
    expect(sheet.D4.v).toBe("CNdenbong");
    expect(sheet.G4.v).toBe(212898.6);
    expect(sheet.I4.v).toBe(145624);
    expect(sheet.J4.v).toBe(67274.6);
    expect(sheet.K4.t).toBe("s");
    expect(sheet.K4.v).toBe('=HYPERLINK("https://invalid.test")');
    expect(sheet.K4.f).toBeUndefined();
    expect(sheet.C5.v).toBe("Tổng");
    expect(sheet.D5?.v).toBeUndefined(); // label only: units differ, no sums
    expect(sheet.D7.v).toBe("Người lập");
    expect(sheet.D8.v).toBe("Nguyễn Thị Hải Yến");
    expect(sheet["!autofilter"]).toEqual({ ref: "C3:K4" });
    expect(sheet["!cols"]?.[4]?.width).toBeCloseTo(39.11, 1);
    expect(sheet["!rows"]?.[3]?.hpt).toBe(24);
  });

  it("fills the catalogue sheets from master data", async () => {
    const book = await read("all");
    const catalog = book.Sheets.KhoNVL!;
    expect(catalog.B2.v).toBe("Mã vật tư");
    expect([
      catalog.A3.v,
      catalog.B3.v,
      catalog.C3.v,
      catalog.D3.v,
      catalog.E3.v,
    ]).toEqual([1, "CNdenbong", "Chân nhựa đen bóng", "Cái", 212898.6]);
    expect(catalog.F3?.v).toBeUndefined();
    const facilities = book.Sheets.Cososx!;
    expect(facilities.C4.v).toBe("Mã cơ sở SX");
    expect([
      facilities.A5.v,
      facilities.B5.v,
      facilities.C5.v,
      facilities.D5.v,
      facilities.E5.v,
    ]).toEqual([1, "Loại 1", "Thanh", "Chị Thanh", "0904747252"]);
    expect(facilities.E5.t).toBe("s");
  });

  it.each([
    ["summary", "Tong kho NVL", "TONG-KHO-NVL.xlsx"],
    ["inbound", "ChiTietNhapNVL", "CHI-TIET-NHAP-NVL.xlsx"],
    ["outbound", "ChiTietxuatNVL", "CHI-TIET-XUAT-NVL.xlsx"],
  ] as const)(
    "scope %s keeps only %s and renumbers its print titles",
    async (scope, sheetName, fileName) => {
      const book = await read(scope);
      expect(book.SheetNames).toEqual([sheetName]);
      expect(exportFileNames[scope]).toBe(fileName);
      expect(book.Workbook?.Names?.map((n) => [n.Sheet, n.Ref])).toEqual([
        [0, `'${sheetName}'!$1:$3`],
      ]);
      const sheet = book.Sheets[sheetName]!;
      expect(sheet["!autofilter"]).toBeDefined();
      expect(
        Object.keys(sheet).some((address) => /^[A-Z]+4$/.test(address)),
      ).toBe(true);
    },
  );

  it("handles empty ledgers and computes the 1900 serial from UTC", async () => {
    const book = XLSX.read(
      await exportMaterialsWorkbook({
        ...input("all"),
        inbound: [],
        outbound: [],
        summary: [],
      }),
      { type: "array" },
    );
    expect(book.Sheets.ChiTietNhapNVL!["!autofilter"]).toEqual({
      ref: "A3:I4",
    });
    expect(book.Sheets["Tong kho NVL"]!.C5.v).toBe("Tổng");
    expect(excelSerial("2026-01-03")).toBe(46025);
    expect(excelSerial("1900-03-01")).toBe(61);
  });
});
