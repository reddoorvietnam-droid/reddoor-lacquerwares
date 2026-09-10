import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { Lookups } from "@/domains/materials/contracts";
import {
  classifyTransaction,
  excelNumber,
  importedTransactionId,
  parseMaterialsWorkbook,
} from "@/domains/materials/import-workbook";

/** Serial for a calendar date, independent of the machine time zone. */
const serial = (iso: string) =>
  (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000;
const dateCell = (iso: string): XLSX.CellObject => ({
  t: "n",
  v: serial(iso),
  z: "mm-dd-yy",
});
const formula = (f: string, v: number | string): XLSX.CellObject =>
  typeof v === "number" ? { t: "n", v, f } : { t: "s", v, f };

/** The same five sheets, header rows and first data rows as the source workbook. */
function buildWorkbook(): Uint8Array {
  const book = XLSX.utils.book_new();

  const outbound = XLSX.utils.aoa_to_sheet([
    ["SỔ CHI TIẾT NVL\nNĂM 2026"],
    [],
    [
      "Ngày tháng",
      "Mã  cơ sở SX",
      "Tên cơ sở SX",
      "Mã vật tư",
      "Vật tư",
      "Diễn giải",
      "Đơn vị tính",
      "Số lượng",
      "Ghi chú",
    ],
  ]);
  XLSX.utils.sheet_add_aoa(
    outbound,
    [[null, "Thanh", null, "cndenmo", null, "xuất kho", null, 3280, "Caspari"]],
    { origin: "A4" },
  );
  outbound.A4 = dateCell("2026-01-03");
  outbound.C4 = formula(
    'IFERROR(VLOOKUP(B4,MaNhaCungCap,2,0),"")',
    "Chị Thanh",
  );
  XLSX.utils.sheet_add_aoa(
    outbound,
    [[null, "Duc.cd", null, "decalpp", null, null, null, null]],
    { origin: "A5" },
  );
  outbound.A5 = dateCell("2025-01-06");
  outbound.H5 = formula("755*4", 3020);
  XLSX.utils.sheet_add_aoa(outbound, [[" "]], { origin: "D6" }); // whitespace-only row
  outbound.C7 = formula('IFERROR(VLOOKUP(B7,MaNhaCungCap,2,0),"")', ""); // formula-only row
  XLSX.utils.sheet_add_aoa(
    outbound,
    [[null, null, null, null, null, null, null, null, null, null, 3100, 12400]],
    { origin: "A8" },
  ); // helper cells K:L only
  XLSX.utils.sheet_add_aoa(outbound, [[null, "Thanh", null, "cndenmo"]], {
    origin: "A9",
  }); // partial: no date, no quantity
  outbound["!ref"] = "A1:L9";
  XLSX.utils.book_append_sheet(book, outbound, "ChiTietxuatNVL");

  const inbound = XLSX.utils.aoa_to_sheet([
    ["SỔ CHI TIẾT NHẬP NVL\nNĂM 2026"],
    [],
    [
      "Ngày tháng",
      "Mã vật tư",
      "Vật tư",
      "Diễn giải",
      "Đơn vị tính",
      "Số lượng",
      "Đơn giá",
      "Thành tiền",
      "Ghi chú",
    ],
  ]);
  XLSX.utils.sheet_add_aoa(
    inbound,
    [[null, "keogankhay", null, null, null, 48, 1000, 48000, null]],
    { origin: "A4" },
  );
  inbound.A4 = dateCell("2026-01-17");
  XLSX.utils.sheet_add_aoa(
    inbound,
    [[null, "Bangthit", null, "nhập kho", null, null, null, 999, "sai tiền"]],
    { origin: "A5" },
  );
  inbound.A5 = dateCell("2026-03-04");
  inbound.F5 = formula("36*4", 144);
  XLSX.utils.book_append_sheet(book, inbound, "ChiTietNhapNVL");

  const summary = XLSX.utils.aoa_to_sheet([
    [null, null, "KHO NGUYÊN VẬT LIỆU 2026"],
    [null, null, "Ngày lập bảng  : 02/01/2025"],
    [
      "Ngày tháng",
      "Số chứng từ",
      "STT",
      "Mã vật tư",
      "Vật tư",
      "ĐVT",
      "Tồn đầu",
      "Nhập",
      "xuất",
      "Tồn cuối",
      "Ghi chú",
    ],
    [null, null, 1, "Cndenmo", null, "Cái", 5493, 0, 3280, 2213, "  "],
    [
      null,
      null,
      2,
      "CNdenbong",
      null,
      "Cái",
      37.79999999999999,
      0,
      0,
      37.8,
      "có chân nhựa cũ",
    ],
    [null, null, 3, "Blhoakhe", "Bản lề hoa khế", "Cái", null, 0, 0, 0, null],
    [null, null, null, "cndenmo", null, "Cái", 5, 0, 0, 5, null],
    [null, null, "Tổng"],
    [null, null, null, "ghost", null, "Cái", 99, 0, 0, 99, null],
  ]);
  summary.E4 = formula(
    'IFERROR(VLOOKUP(D4,dmvattu,2,0),"")',
    "Chân nhựa đen mờ",
  );
  XLSX.utils.book_append_sheet(book, summary, "Tong kho NVL");

  const catalog = XLSX.utils.aoa_to_sheet([
    [],
    ["STT", "Mã vật tư", "Tên vật tư", "DonViTinh", "Tồn đầu kỳ"],
    [1, "CNdenmo", "Chân nhựa đen mờ", "Cái", null, 160800],
    [2, "CNdenbong", "Chân nhựa đen bóng", "Cái"],
    [3, "cndenmo", "Chân nhựa đen mờ (trùng)", "Cái"],
    [4, "HopXaPhong ", "Hộp xà phòng", "Cái", 250000],
    [5, "Bangthit", "Băng Thít", "Cuộn"],
    [6, "keogankhay", "Keo gắn khay", "Lọ"],
    [7, "decalpp", "Decal PP", "Cuộn"],
    [8, null, "không có mã"],
  ]);
  XLSX.utils.book_append_sheet(book, catalog, "KhoNVL");

  const facilities = XLSX.utils.aoa_to_sheet([
    [],
    [],
    [],
    ["STT", "Loại", "Mã cơ sở SX", "Tên cơ sở SX", "Số điện thoại", "Ghi chú"],
    [1, "Loại 1", "Thanh", "Chị Thanh", "0904747252", null],
    [2, "Loại 2", "Duc.cd", "Đức", "0", "ghi chú"],
    [3, "Loại 2", "thanh", "Trùng", null, null],
    [4, "Loại 3", null, "không có mã"],
  ]);
  XLSX.utils.book_append_sheet(book, facilities, "Cososx");

  return new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
}

describe("parseMaterialsWorkbook", () => {
  const parsed = parseMaterialsWorkbook(buildWorkbook(), {
    fileName: "test.xlsx",
    requireMasters: true,
  });

  it("keeps calendar dates exact and reads cached formula quantities", () => {
    const out = parsed.transactions.filter((t) => t.type === "OUTBOUND");
    expect(out.map((t) => t.transactionDate)).toEqual([
      "2026-01-03",
      "2025-01-06",
    ]);
    expect(out[0]).toMatchObject({
      sheet: "ChiTietxuatNVL",
      sourceRow: 4,
      facilityCode: "Thanh",
      materialCode: "cndenmo",
      quantity: "3280",
      description: "xuất kho",
      note: "Caspari",
      importKey: `${parsed.hash}:ChiTietxuatNVL:4`,
      migrationSource: "test.xlsx",
    });
    expect(out[1]).toMatchObject({ quantity: "3020", description: "xuất kho" });
    const inbound = parsed.transactions.filter((t) => t.type === "INBOUND");
    expect(inbound.map((t) => t.transactionDate)).toEqual([
      "2026-01-17",
      "2026-03-04",
    ]);
    expect(inbound[0]).toMatchObject({
      quantity: "48",
      unitPrice: "1000",
      amount: "48000",
      description: "nhập kho",
    });
    expect(inbound[1]).toMatchObject({
      quantity: "144",
      unitPrice: null,
      amount: "999",
    });
  });

  it("skips whitespace, formula-only and helper-only rows and reports partial ones", () => {
    expect(parsed.report.outbound).toEqual({
      candidateRows: 3,
      transactions: 2,
      partial: 1,
      formulaOnly: 1,
      empty: 0,
      whitespaceOnly: 1,
      helperOnly: 1,
      cellsOutsideTable: 2,
    });
    expect(parsed.report.inbound.transactions).toBe(2);
    expect(parsed.issues).toEqual([
      expect.objectContaining({
        sheet: "ChiTietxuatNVL",
        row: 9,
        kind: "partial",
      }),
    ]);
    const kinds = parsed.warnings.map((w) => `${w.sheet}:${w.row}:${w.kind}`);
    expect(kinds).toContain("ChiTietxuatNVL:5:date-outside-year");
    expect(kinds).toContain("ChiTietxuatNVL:8:cell-outside-table");
    expect(kinds).toContain("ChiTietNhapNVL:5:amount-mismatch");
    expect(kinds).not.toContain("ChiTietNhapNVL:4:amount-mismatch");
  });

  it("reads the summary until Tổng, normalises float tails and keeps first duplicates", () => {
    expect(parsed.summary.map((row) => row.code)).toEqual([
      "Cndenmo",
      "CNdenbong",
      "Blhoakhe",
      "cndenmo",
    ]);
    expect(parsed.summary[0]).toMatchObject({
      name: "Chân nhựa đen mờ",
      opening: "5493",
      excelOutbound: "3280",
      excelClosing: "2213",
      note: "",
    });
    expect(parsed.summary[1]?.opening).toBe("37.8");
    expect(parsed.summary[2]).toMatchObject({
      opening: "0",
      name: "Bản lề hoa khế",
    });
    expect(parsed.report.summary).toEqual({
      rows: 4,
      duplicateCodes: ["cndenmo"],
    });
  });

  it("builds masters like VLOOKUP: trimmed codes, first occurrence wins, stray columns reported", () => {
    expect(parsed.materials.map((m) => m.code)).toEqual([
      "CNdenmo",
      "CNdenbong",
      "HopXaPhong",
      "Bangthit",
      "keogankhay",
      "decalpp",
    ]);
    expect(parsed.report.materials).toMatchObject({
      sourceRows: 7,
      duplicates: 1,
      whitespaceCodes: ["HopXaPhong "],
      columnEValues: { HopXaPhong: "250000" },
      columnFValues: { CNdenmo: "160800" },
    });
    expect(parsed.facilities).toEqual([
      {
        sourceRow: 5,
        type: "Loại 1",
        code: "Thanh",
        name: "Chị Thanh",
        phone: "0904747252",
        note: "",
      },
      {
        sourceRow: 6,
        type: "Loại 2",
        code: "Duc.cd",
        name: "Đức",
        phone: "",
        note: "ghi chú",
      },
    ]);
    expect(parsed.report.facilities).toEqual({ sourceRows: 3, duplicates: 1 });
  });

  it("hashes the bytes and derives stable line ids", () => {
    expect(parsed.hash).toMatch(/^[0-9a-f]{64}$/);
    const first = parsed.transactions.find((t) => t.type === "OUTBOUND")!;
    const id = importedTransactionId(first);
    expect(id).toMatch(/^xuat-[0-9a-f]{24}-4$/);
    expect(importedTransactionId({ ...first })).toBe(id);
    expect(importedTransactionId(parsed.transactions[0]!)).toMatch(/^nhap-/);
  });

  it("refuses a workbook without ledger sheets and requires masters for the migration", () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([["x"]]),
      "Sheet1",
    );
    const bytes = new Uint8Array(
      XLSX.write(book, { type: "buffer", bookType: "xlsx" }),
    );
    expect(() => parseMaterialsWorkbook(bytes)).toThrow(/ChiTietNhapNVL/);
    const ledgerOnly = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      ledgerOnly,
      XLSX.utils.aoa_to_sheet([["t"], [], ["h"]]),
      "ChiTietNhapNVL",
    );
    const ledgerBytes = new Uint8Array(
      XLSX.write(ledgerOnly, { type: "buffer", bookType: "xlsx" }),
    );
    expect(parseMaterialsWorkbook(ledgerBytes).transactions).toEqual([]);
    expect(() =>
      parseMaterialsWorkbook(ledgerBytes, { requireMasters: true }),
    ).toThrow(/KhoNVL/);
  });
});

describe("classifyTransaction", () => {
  const lookups: Lookups = {
    materials: [
      {
        id: "m1",
        code: "CNdenmo",
        name: "Chân nhựa",
        unit: "Cái",
        active: true,
      },
      { id: "m2", code: "Old", name: "Cũ", unit: "Cái", active: false },
    ],
    facilities: [
      { id: "f1", code: "Thanh", name: "Chị Thanh", active: true },
      { id: "f2", code: "Gone", name: "Nghỉ", active: false },
    ],
  };
  it("matches codes case-insensitively and flags unknown or inactive masters", () => {
    expect(
      classifyTransaction(
        { type: "OUTBOUND", materialCode: "cndenmo", facilityCode: "THANH" },
        lookups,
      ),
    ).toEqual({ status: "valid", message: null });
    expect(
      classifyTransaction(
        { type: "INBOUND", materialCode: "cndenmo", facilityCode: "" },
        lookups,
      ).status,
    ).toBe("valid");
    expect(
      classifyTransaction(
        { type: "INBOUND", materialCode: "nope", facilityCode: "" },
        lookups,
      ).status,
    ).toBe("unknown-material");
    expect(
      classifyTransaction(
        { type: "OUTBOUND", materialCode: "cndenmo", facilityCode: "nope" },
        lookups,
      ).status,
    ).toBe("unknown-facility");
    expect(
      classifyTransaction(
        { type: "INBOUND", materialCode: "old", facilityCode: "" },
        lookups,
      ),
    ).toMatchObject({
      status: "invalid",
      message: expect.stringContaining("ngừng"),
    });
    expect(
      classifyTransaction(
        { type: "OUTBOUND", materialCode: "cndenmo", facilityCode: "gone" },
        lookups,
      ).status,
    ).toBe("invalid");
  });
});

describe("excelNumber", () => {
  it("drops binary tails beyond 15 significant digits", () => {
    expect(excelNumber(37.79999999999999)).toBe("37.8");
    expect(excelNumber(0.1 + 0.2)).toBe("0.3");
    expect(excelNumber(212898.6)).toBe("212898.6");
    expect(excelNumber(3280)).toBe("3280");
  });
});
