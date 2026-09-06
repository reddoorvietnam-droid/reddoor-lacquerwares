import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

import {
  SheetCheckError,
  type SheetCheckErrorCode,
} from "@/domains/sheet-checks/contracts";
import { sheetCheckLimits as limits } from "@/domains/sheet-checks/limits";
import {
  detectFileFormat,
  inspectZipContainer,
  readUpload,
} from "@/domains/sheet-checks/parsing/intake";

// The guard must run before SheetJS is consulted: wrap `read` in a spy so
// every rejection can prove the parser never saw the bytes.
vi.mock("xlsx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("xlsx")>();
  return { ...actual, read: vi.fn(actual.read) };
});

const readSpy = vi.mocked(XLSX.read);

type SheetSpec = {
  name: string;
  aoa: unknown[][];
  rows?: XLSX.RowInfo[];
  cols?: XLSX.ColInfo[];
  merges?: XLSX.Range[];
};

function workbookBytes(
  sheets: readonly SheetSpec[],
  options: { bookType?: "xlsx" | "xlsm" | "xls"; date1904?: boolean } = {},
): Uint8Array {
  const workbook = XLSX.utils.book_new();
  for (const spec of sheets) {
    const sheet = XLSX.utils.aoa_to_sheet(spec.aoa);
    if (spec.rows) sheet["!rows"] = spec.rows;
    if (spec.cols) sheet["!cols"] = spec.cols;
    if (spec.merges) sheet["!merges"] = spec.merges;
    XLSX.utils.book_append_sheet(workbook, sheet, spec.name);
  }
  if (options.date1904) workbook.Workbook = { WBProps: { date1904: true } };
  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: options.bookType ?? "xlsx",
  }) as Buffer;
  return new Uint8Array(buffer);
}

type ZipEntry = { name: string; data?: Uint8Array; declaredSize?: number };

/** A minimal "stored" zip writer: local headers, central directory, end record. */
function zipBytes(entries: readonly ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const u16 = (view: DataView, at: number, value: number): void =>
    view.setUint16(at, value, true);
  const u32 = (view: DataView, at: number, value: number): void =>
    view.setUint32(at, value, true);

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = entry.data ?? new Uint8Array(0);
    const local = new Uint8Array(30 + name.length + data.length);
    const view = new DataView(local.buffer);
    u32(view, 0, 0x04034b50);
    u16(view, 4, 20);
    u16(view, 6, 0);
    u16(view, 8, 0);
    u16(view, 10, 0);
    u16(view, 12, 0);
    u32(view, 14, 0);
    u32(view, 18, data.length);
    u32(view, 22, data.length);
    u16(view, 26, name.length);
    u16(view, 28, 0);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    parts.push(local);

    const header = new Uint8Array(46 + name.length);
    const headerView = new DataView(header.buffer);
    u32(headerView, 0, 0x02014b50);
    u16(headerView, 4, 20);
    u16(headerView, 6, 20);
    u16(headerView, 8, 0);
    u16(headerView, 10, 0);
    u16(headerView, 12, 0);
    u16(headerView, 14, 0);
    u32(headerView, 16, 0);
    u32(headerView, 20, data.length);
    u32(headerView, 24, entry.declaredSize ?? data.length);
    u16(headerView, 28, name.length);
    u16(headerView, 30, 0);
    u16(headerView, 32, 0);
    u16(headerView, 34, 0);
    u16(headerView, 36, 0);
    u32(headerView, 38, 0);
    u32(headerView, 42, offset);
    header.set(name, 46);
    central.push(header);
    offset += local.length;
  }

  const directorySize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054b50);
  u16(endView, 4, 0);
  u16(endView, 6, 0);
  u16(endView, 8, entries.length);
  u16(endView, 10, entries.length);
  u32(endView, 12, directorySize);
  u32(endView, 16, offset);
  u16(endView, 20, 0);

  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of all) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

function expectError(
  action: () => unknown,
  code: SheetCheckErrorCode,
): SheetCheckError {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(SheetCheckError);
  expect((caught as SheetCheckError).code).toBe(code);
  return caught as SheetCheckError;
}

const simpleSheet: SheetSpec = {
  name: "Data",
  aoa: [
    ["Khách hàng", "Số tiền", "Ngày"],
    ["A", 25000000, "15/08/2026"],
    ["B", 1000000, "16/08/2026"],
  ],
};

beforeEach(() => {
  readSpy.mockClear();
});

describe("detectFileFormat", () => {
  it("types by magic number and requires the extension to agree", () => {
    const xlsx = workbookBytes([simpleSheet]);
    expect(detectFileFormat(xlsx, "Report.XLSX")).toBe("xlsx");
    expectError(
      () => detectFileFormat(xlsx, "report.csv"),
      "FILE_TYPE_REJECTED",
    );
    expectError(
      () => detectFileFormat(xlsx, "report.xlsm"),
      "FILE_MACRO_REJECTED",
    );
    expectError(
      () => detectFileFormat(xlsx, "report.xltm"),
      "FILE_MACRO_REJECTED",
    );
    expectError(
      () => detectFileFormat(xlsx, "report.xlsb"),
      "FILE_TYPE_REJECTED",
    );
    expectError(
      () => detectFileFormat(xlsx, "report.ods"),
      "FILE_TYPE_REJECTED",
    );
    const xls = workbookBytes([simpleSheet], { bookType: "xls" });
    expect(detectFileFormat(xls, "report.xls")).toBe("xls");
    expectError(
      () => detectFileFormat(xls, "report.xlsx"),
      "FILE_TYPE_REJECTED",
    );
  });

  it("rejects a PNG renamed .xlsx and accepts text as .csv/.txt", () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0,
    ]);
    expectError(
      () => detectFileFormat(png, "image.xlsx"),
      "FILE_TYPE_REJECTED",
    );
    expectError(() => detectFileFormat(png, "image.csv"), "FILE_TYPE_REJECTED");
    const text = new TextEncoder().encode("a,b\n1,2");
    expect(detectFileFormat(text, "list.csv")).toBe("csv");
    expect(detectFileFormat(text, "list.txt")).toBe("csv");
    expectError(
      () => detectFileFormat(text, "list.xlsx"),
      "FILE_TYPE_REJECTED",
    );
    const utf16 = new Uint8Array([
      0xff, 0xfe, 0x61, 0x00, 0x2c, 0x00, 0x62, 0x00,
    ]);
    expect(detectFileFormat(utf16, "list.csv")).toBe("csv");
  });
});

describe("inspectZipContainer", () => {
  it("accepts a workbook SheetJS wrote", () => {
    expect(() =>
      inspectZipContainer(workbookBytes([simpleSheet])),
    ).not.toThrow();
  });

  it("rejects an entry that declares 100 MB uncompressed", () => {
    const zip = zipBytes([
      { name: "[Content_Types].xml", data: new Uint8Array(10) },
      {
        name: "xl/worksheets/sheet1.xml",
        data: new Uint8Array(100),
        declaredSize: 100 * 1024 * 1024,
      },
    ]);
    expectError(() => inspectZipContainer(zip), "FILE_ZIP_SUSPICIOUS");
  });

  it("rejects a total above the cap even when each entry is below it", () => {
    const entries = Array.from({ length: 3 }, (_unused, index) => ({
      name: `xl/part${index}.xml`,
      data: new Uint8Array(1),
      declaredSize: 25 * 1024 * 1024,
    }));
    expectError(
      () => inspectZipContainer(zipBytes(entries)),
      "FILE_ZIP_SUSPICIOUS",
    );
  });

  it("rejects path escapes and absolute names", () => {
    expectError(
      () =>
        inspectZipContainer(
          zipBytes([{ name: "../x", data: new Uint8Array(1) }]),
        ),
      "FILE_ZIP_SUSPICIOUS",
    );
    expectError(
      () =>
        inspectZipContainer(
          zipBytes([{ name: "/etc/passwd", data: new Uint8Array(1) }]),
        ),
      "FILE_ZIP_SUSPICIOUS",
    );
    expectError(
      () =>
        inspectZipContainer(
          zipBytes([{ name: "xl\\..\\x.xml", data: new Uint8Array(1) }]),
        ),
      "FILE_ZIP_SUSPICIOUS",
    );
  });

  it("rejects too many entries and a missing end record", () => {
    const many = Array.from(
      { length: limits.maxZipEntries + 1 },
      (_unused, index) => ({
        name: `e${index}`,
      }),
    );
    expectError(
      () => inspectZipContainer(zipBytes(many)),
      "FILE_ZIP_SUSPICIOUS",
    );
    const noEnd = zipBytes([{ name: "a", data: new Uint8Array(4) }]).subarray(
      0,
      40,
    );
    expectError(() => inspectZipContainer(noEnd), "FILE_ZIP_SUSPICIOUS");
  });

  it("rejects a VBA project regardless of extension", () => {
    const zip = zipBytes([
      { name: "[Content_Types].xml", data: new Uint8Array(10) },
      { name: "xl/vbaProject.bin", data: new Uint8Array(10) },
    ]);
    expectError(() => inspectZipContainer(zip), "FILE_MACRO_REJECTED");
  });
});

describe("readUpload guards", () => {
  it("rejects a file above the byte limit before looking at it", () => {
    const bytes = new Uint8Array(limits.maxFileBytes + 1);
    expectError(
      () => readUpload({ bytes, fileName: "big.csv", sheetSelector: null }),
      "FILE_TOO_LARGE",
    );
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("rejects .xlsm bytes and an xlsx renamed .xlsm without consulting SheetJS", () => {
    const xlsm = workbookBytes([simpleSheet], { bookType: "xlsm" });
    expectError(
      () =>
        readUpload({
          bytes: xlsm,
          fileName: "macro.xlsm",
          sheetSelector: null,
        }),
      "FILE_MACRO_REJECTED",
    );
    const renamed = workbookBytes([simpleSheet]);
    expectError(
      () =>
        readUpload({
          bytes: renamed,
          fileName: "macro.xlsm",
          sheetSelector: null,
        }),
      "FILE_MACRO_REJECTED",
    );
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("rejects an .xlsx carrying xl/vbaProject.bin before SheetJS sees it", () => {
    const zip = zipBytes([
      { name: "[Content_Types].xml", data: new Uint8Array(10) },
      { name: "xl/workbook.xml", data: new Uint8Array(10) },
      { name: "xl/vbaProject.bin", data: new Uint8Array(10) },
    ]);
    expectError(
      () =>
        readUpload({ bytes: zip, fileName: "book.xlsx", sheetSelector: null }),
      "FILE_MACRO_REJECTED",
    );
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("rejects a 100 MB declared entry before SheetJS sees it", () => {
    const zip = zipBytes([
      { name: "[Content_Types].xml", data: new Uint8Array(10) },
      {
        name: "xl/worksheets/sheet1.xml",
        data: new Uint8Array(100),
        declaredSize: 100 * 1024 * 1024,
      },
    ]);
    expectError(
      () =>
        readUpload({ bytes: zip, fileName: "bomb.xlsx", sheetSelector: null }),
      "FILE_ZIP_SUSPICIOUS",
    );
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("rejects a PNG renamed .xlsx and an xlsx renamed .csv", () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0,
    ]);
    expectError(
      () => readUpload({ bytes: png, fileName: "a.xlsx", sheetSelector: null }),
      "FILE_TYPE_REJECTED",
    );
    expectError(
      () =>
        readUpload({
          bytes: workbookBytes([simpleSheet]),
          fileName: "a.csv",
          sheetSelector: null,
        }),
      "FILE_TYPE_REJECTED",
    );
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("turns a SheetJS failure into FILE_PARSE_FAILED", () => {
    const zip = zipBytes([
      { name: "[Content_Types].xml", data: new Uint8Array(10) },
    ]);
    expectError(
      () =>
        readUpload({
          bytes: zip,
          fileName: "broken.xlsx",
          sheetSelector: null,
        }),
      "FILE_PARSE_FAILED",
    );
    expect(readSpy).toHaveBeenCalledTimes(1);
  });
});

describe("readUpload xlsx", () => {
  it("reads cells with the fixed safe options and keeps formatted text, numbers and formats", () => {
    const bytes = workbookBytes([
      {
        name: "Data",
        aoa: [
          ["Khách hàng", "Số tiền", "Ngày"],
          [
            "A",
            { t: "n", v: 1250000.4, z: "#,##0" },
            { t: "n", v: 46249, z: "dd/mm/yyyy" },
          ],
        ],
      },
    ]);
    const workbook = readUpload({
      bytes,
      fileName: "báo cáo.xlsx",
      sheetSelector: null,
    });
    expect(readSpy).toHaveBeenCalledTimes(1);
    const options = readSpy.mock.calls[0]?.[1];
    expect(options).toMatchObject({
      type: "buffer",
      dense: true,
      cellFormula: true,
      cellNF: true,
      cellText: true,
      cellDates: false,
      cellHTML: false,
      bookVBA: false,
      bookFiles: false,
      bookProps: false,
      sheetRows: limits.sheetRowsCap,
      WTF: false,
    });
    expect(workbook.fileFormat).toBe("xlsx");
    expect(workbook.date1904).toBe(false);
    expect(workbook.sheets).toEqual([{ index: 0, name: "Data", rowCount: 2 }]);
    expect(workbook.chosen.columnCount).toBe(3);
    const amount = workbook.chosen.rows[1]?.cells[1];
    expect(amount).toMatchObject({
      type: "n",
      number: 1250000.4,
      numberFormat: "#,##0",
      text: "1,250,000",
      formula: false,
      noCache: false,
    });
    const date = workbook.chosen.rows[1]?.cells[2];
    expect(date).toMatchObject({
      type: "n",
      number: 46249,
      numberFormat: "dd/mm/yyyy",
    });
    expect(workbook.chosen.rows[0]?.cells[0]).toMatchObject({
      type: "s",
      text: "Khách hàng",
    });
    expect(workbook.chosen.rows[0]?.sheetRowNumber).toBe(1);
  });

  it("keeps a cached formula value and marks a formula without a cache", () => {
    const bytes = workbookBytes([
      {
        name: "S",
        aoa: [
          ["A", "B"],
          ["x", { t: "n", f: "SUM(B1)", v: 200 }],
          ["y", { t: "n", f: "SUM(B1)" }],
        ],
      },
    ]);
    const { chosen } = readUpload({
      bytes,
      fileName: "f.xlsx",
      sheetSelector: null,
    });
    expect(chosen.rows[1]?.cells[1]).toMatchObject({
      text: "200",
      number: 200,
      formula: true,
      noCache: false,
    });
    expect(chosen.rows[2]?.cells[1]).toMatchObject({
      text: "",
      number: null,
      formula: true,
      noCache: true,
    });
  });

  it("keeps error cells, booleans and cuts long text", () => {
    const bytes = workbookBytes([
      {
        name: "S",
        aoa: [
          ["A", "B", "C"],
          [
            { t: "e", v: 0x17, w: "#REF!" },
            { t: "b", v: true },
            "x".repeat(300),
          ],
        ],
      },
    ]);
    const { chosen } = readUpload({
      bytes,
      fileName: "e.xlsx",
      sheetSelector: null,
    });
    expect(chosen.rows[1]?.cells[0]).toMatchObject({
      type: "e",
      text: "#REF!",
      number: null,
    });
    expect(chosen.rows[1]?.cells[1]).toMatchObject({ type: "b", number: null });
    expect(chosen.rows[1]?.cells[2]).toMatchObject({
      type: "s",
      truncated: true,
    });
    expect(chosen.rows[1]?.cells[2]?.text).toHaveLength(limits.maxCellChars);
  });

  it("flags hidden rows and columns but still reads them", () => {
    const rows: XLSX.RowInfo[] = [];
    rows[2] = { hidden: true };
    const cols: XLSX.ColInfo[] = [];
    cols[1] = { hidden: true };
    const bytes = workbookBytes([{ ...simpleSheet, rows, cols }]);
    const workbook = readUpload({
      bytes,
      fileName: "h.xlsx",
      sheetSelector: null,
    });
    expect(workbook.chosen.rows.map((row) => row.hidden)).toEqual([
      false,
      false,
      true,
    ]);
    expect(workbook.chosen.hiddenColumnCount).toBe(1);
    expect(workbook.issues).toContainEqual(
      expect.objectContaining({ code: "HIDDEN_COLUMNS", params: { n: 1 } }),
    );
    expect(workbook.chosen.rows[2]?.cells[1]?.number).toBe(1000000);
  });

  it("fills merged ranges from the anchor and marks the copies", () => {
    const bytes = workbookBytes([
      {
        name: "S",
        aoa: [
          ["Khách hàng", "Số tiền"],
          ["Cty A", 1],
          [null, 2],
          [null, 3],
        ],
        merges: [{ s: { r: 1, c: 0 }, e: { r: 3, c: 0 } }],
      },
    ]);
    const { chosen } = readUpload({
      bytes,
      fileName: "m.xlsx",
      sheetSelector: null,
    });
    expect(chosen.rows[1]?.cells[0]).toMatchObject({
      text: "Cty A",
      mergedFill: false,
    });
    expect(chosen.rows[2]?.cells[0]).toMatchObject({
      text: "Cty A",
      type: "s",
      mergedFill: true,
    });
    expect(chosen.rows[3]?.cells[0]).toMatchObject({
      text: "Cty A",
      mergedFill: true,
    });
  });

  it("caps columns at the limit with COLUMNS_IGNORED", () => {
    const wide = Array.from(
      { length: limits.maxColumns + 1 },
      (_unused, index) => `c${index}`,
    );
    const bytes = workbookBytes([{ name: "S", aoa: [wide, wide] }]);
    const workbook = readUpload({
      bytes,
      fileName: "w.xlsx",
      sheetSelector: null,
    });
    expect(workbook.chosen.columnCount).toBe(limits.maxColumns);
    expect(workbook.chosen.rows[0]?.cells).toHaveLength(limits.maxColumns);
    expect(workbook.issues).toContainEqual(
      expect.objectContaining({
        code: "COLUMNS_IGNORED",
        params: { n: 1, max: limits.maxColumns },
      }),
    );
  });

  it("inspects at most the sheet limit with SHEETS_IGNORED", () => {
    const sheets = Array.from(
      { length: limits.maxSheets + 1 },
      (_unused, index) => ({
        name: `S${index}`,
        aoa: [["a"], [index]],
      }),
    );
    const workbook = readUpload({
      bytes: workbookBytes(sheets),
      fileName: "many.xlsx",
      sheetSelector: null,
    });
    expect(workbook.sheets).toHaveLength(limits.maxSheets);
    expect(workbook.issues).toContainEqual(
      expect.objectContaining({
        code: "SHEETS_IGNORED",
        params: { n: 1, max: limits.maxSheets },
      }),
    );
  });

  it("rejects an empty workbook", () => {
    const bytes = workbookBytes([{ name: "Empty", aoa: [] }]);
    expectError(
      () => readUpload({ bytes, fileName: "empty.xlsx", sheetSelector: null }),
      "FILE_EMPTY",
    );
  });

  it("chooses the first sheet with at least two non-blank rows", () => {
    const bytes = workbookBytes([
      { name: "Cover", aoa: [] },
      { name: "Only title", aoa: [["Báo cáo"]] },
      simpleSheet,
    ]);
    const workbook = readUpload({
      bytes,
      fileName: "three.xlsx",
      sheetSelector: null,
    });
    expect(workbook.chosen.index).toBe(2);
    expect(workbook.chosen.name).toBe("Data");
    expect(workbook.sheets.map((sheet) => sheet.rowCount)).toEqual([0, 1, 3]);
  });

  it("honours a sheet selector by 1-based index or name (case-insensitive)", () => {
    const bytes = workbookBytes([
      simpleSheet,
      { name: "Tháng 8", aoa: [["x"], ["y"]] },
    ]);
    expect(
      readUpload({ bytes, fileName: "s.xlsx", sheetSelector: "2" }).chosen.name,
    ).toBe("Tháng 8");
    expect(
      readUpload({ bytes, fileName: "s.xlsx", sheetSelector: "tháng 8" }).chosen
        .name,
    ).toBe("Tháng 8");
    expect(
      readUpload({ bytes, fileName: "s.xlsx", sheetSelector: "Data" }).chosen
        .index,
    ).toBe(0);
    expectError(
      () => readUpload({ bytes, fileName: "s.xlsx", sheetSelector: "Nope" }),
      "SHEET_NOT_FOUND",
    );
  });

  it("reads the 1904 date system flag", () => {
    const bytes = workbookBytes([simpleSheet], { date1904: true });
    expect(
      readUpload({ bytes, fileName: "mac.xlsx", sheetSelector: null }).date1904,
    ).toBe(true);
  });

  it("rejects a sheet whose non-blank rows exceed the window plus the data cap", () => {
    const aoa = Array.from(
      { length: limits.headerWindowRows + limits.maxRows + 1 },
      (_unused, index) => [`r${index}`, index],
    );
    const bytes = workbookBytes([{ name: "S", aoa }]);
    expectError(
      () => readUpload({ bytes, fileName: "tall.xlsx", sheetSelector: null }),
      "FILE_TOO_MANY_ROWS",
    );
  });

  it("reads a legacy .xls through the same cell mapping", () => {
    const bytes = workbookBytes([simpleSheet], { bookType: "xls" });
    const workbook = readUpload({
      bytes,
      fileName: "old.xls",
      sheetSelector: null,
    });
    expect(workbook.fileFormat).toBe("xls");
    expect(workbook.chosen.rows[1]?.cells[1]).toMatchObject({
      type: "n",
      number: 25000000,
    });
    expect(workbook.chosen.rows[1]?.cells[2]).toMatchObject({
      type: "s",
      text: "15/08/2026",
    });
  });
});

describe("readUpload csv", () => {
  it("never consults SheetJS and yields text cells only", () => {
    const text =
      "﻿Khách hàng;Số tiền;Ngày\nCty A;1.250.000;08/09/2026\n;;\nB;=SUM(A1);16/08/2026\n";
    const bytes = new TextEncoder().encode(text);
    const workbook = readUpload({
      bytes,
      fileName: "tien-ve.csv",
      sheetSelector: null,
    });
    expect(readSpy).not.toHaveBeenCalled();
    expect(workbook.fileFormat).toBe("csv");
    expect(workbook.date1904).toBe(false);
    expect(workbook.sheets).toEqual([{ index: 0, name: "CSV", rowCount: 3 }]);
    expect(workbook.chosen.columnCount).toBe(3);
    expect(workbook.chosen.rows).toHaveLength(4);
    expect(workbook.chosen.rows[1]?.cells.map((cell) => cell.text)).toEqual([
      "Cty A",
      "1.250.000",
      "08/09/2026",
    ]);
    expect(workbook.chosen.rows[1]?.cells[1]).toMatchObject({
      type: "s",
      number: null,
    });
    expect(
      workbook.chosen.rows[2]?.cells.every((cell) => cell.type === "z"),
    ).toBe(true);
    expect(workbook.chosen.rows[3]?.cells[1]).toMatchObject({
      type: "s",
      text: "=SUM(A1)",
      formula: false,
    });
    expect(workbook.chosen.rows[3]?.sheetRowNumber).toBe(4);
  });

  it("carries the decoding findings and rejects an empty CSV", () => {
    const legacy = new Uint8Array([
      0x43, 0xf4, 0x6e, 0x67, 0x3b, 0x31, 0x0a, 0x41, 0x3b, 0x32,
    ]);
    try {
      const workbook = readUpload({
        bytes: legacy,
        fileName: "old.csv",
        sheetSelector: null,
      });
      expect(workbook.issues.map((entry) => entry.code)).toContain(
        "ENCODING_FALLBACK",
      );
      expect(workbook.chosen.rows[0]?.cells[0]?.text).toBe("Công");
    } catch (error) {
      expect((error as SheetCheckError).code).toBe("ENCODING_UNKNOWN");
    }
    expectError(
      () =>
        readUpload({
          bytes: new TextEncoder().encode("\n\n"),
          fileName: "blank.csv",
          sheetSelector: null,
        }),
      "FILE_EMPTY",
    );
  });

  it("propagates CSV_MALFORMED with the line", () => {
    const error = expectError(
      () =>
        readUpload({
          bytes: new TextEncoder().encode('a,b\n"open,1\n'),
          fileName: "bad.csv",
          sheetSelector: null,
        }),
      "CSV_MALFORMED",
    );
    expect(error.message).toBe("line 2");
  });
});
