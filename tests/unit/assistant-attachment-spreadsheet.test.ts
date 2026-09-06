import { describe, expect, it } from "vitest";

import {
  AttachmentError,
  type AttachmentErrorCode,
} from "@/domains/assistant/attachments/contracts";
import { attachmentLimits as limits } from "@/domains/assistant/attachments/limits";
import { extractSheetText } from "@/domains/assistant/attachments/spreadsheet";

import {
  buildCsv,
  buildPng,
  buildWorkbook,
  buildXlsx,
} from "./helpers/attachment-fixtures";

/**
 * A spreadsheet the assistant reads is the person's own document. The note
 * that says so is not decoration: without it a rendered grid of amounts
 * reads exactly like a reconciliation the portal performed, which is the
 * one thing this path must never be mistaken for.
 */

function expectCode(action: () => unknown, code: AttachmentErrorCode): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(AttachmentError);
  expect((caught as AttachmentError).code).toBe(code);
}

function gridLines(text: string): string[] {
  const blank = text.indexOf("\n\n");
  return text.slice(blank + 2).split("\n");
}

describe("extractSheetText", () => {
  it("says in its notes that this is a plain reading, not a reconciliation", () => {
    const csv = buildCsv("Khách hàng,Số tiền\nCông ty A,25000000\n");
    const result = extractSheetText(csv, "thu tien.csv");
    expect(result.notes[0]).toContain("không phải đối soát");
    expect(result.notes[0]).toContain("Kiểm tra bảng biểu");
  });

  it("renders a csv as a numbered pipe grid and names the sheet it read", () => {
    const csv = buildCsv(
      "Khách hàng,Số tiền\nCông ty A,25000000\nCông ty B,1000000\n",
    );
    const result = extractSheetText(csv, "thu tien.csv");
    expect(result.text).toContain('Danh sách sheet: "CSV" (3 dòng)');
    expect(result.text).toContain('Sheet được đọc: "CSV"');
    expect(gridLines(result.text)).toEqual([
      "1 | Khách hàng | Số tiền",
      "2 | Công ty A | 25000000",
      "3 | Công ty B | 1000000",
    ]);
    expect(result.truncated).toBe(false);
  });

  it("renders a workbook and names every sheet, not only the one it read", () => {
    const bytes = buildWorkbook([
      { name: "Bìa", rows: [["Báo cáo tháng 8"]] },
      {
        name: "Dữ liệu",
        rows: [
          ["Mã đơn", "Số tiền"],
          ["SM-2026-014", "25000000"],
        ],
      },
    ]);
    const result = extractSheetText(bytes, "bao cao.xlsx");
    expect(result.text).toContain('Sheet được đọc: "Dữ liệu"');
    expect(result.text).toContain('"Bìa" (1 dòng)');
    expect(gridLines(result.text)).toEqual([
      "1 | Mã đơn | Số tiền",
      "2 | SM-2026-014 | 25000000",
    ]);
    expect(result.notes.join(" ")).toContain("Tệp có 2 sheet");
  });

  it("caps the rows it renders and says how many the sheet holds", () => {
    const rows = Array.from(
      { length: limits.maxSheetRows + 40 },
      (_unused, index) => `Dòng ${index},${index}`,
    );
    const result = extractSheetText(buildCsv(rows.join("\n")), "dai.csv");
    expect(gridLines(result.text)).toHaveLength(limits.maxSheetRows);
    expect(result.truncated).toBe(true);
    expect(result.notes.join(" ")).toContain(
      `chỉ hiển thị ${limits.maxSheetRows} dòng đầu`,
    );
  });

  it("caps the columns it renders", () => {
    const width = limits.maxSheetColumns + 5;
    const header = Array.from({ length: width }, (_unused, i) => `C${i}`);
    const row = Array.from({ length: width }, (_unused, i) => String(i));
    const result = extractSheetText(
      buildCsv(`${header.join(",")}\n${row.join(",")}`),
      "rong.csv",
    );
    const [first] = gridLines(result.text);
    expect((first ?? "").split(" | ")).toHaveLength(limits.maxSheetColumns + 1);
    expect(result.notes.join(" ")).toContain(
      `chỉ hiển thị ${limits.maxSheetColumns} cột đầu`,
    );
    expect(result.truncated).toBe(true);
  });

  it("cuts a long cell and counts it", () => {
    const long = "x".repeat(limits.maxSheetCellChars + 30);
    const result = extractSheetText(
      buildCsv(`Ghi chú,Số tiền\n${long},10\n`),
      "ghi chu.csv",
    );
    const [, second] = gridLines(result.text);
    expect(second).toBe(`2 | ${"x".repeat(limits.maxSheetCellChars)}… | 10`);
    expect(result.notes.join(" ")).toContain(
      `cắt ở ${limits.maxSheetCellChars} ký tự`,
    );
    expect(result.truncated).toBe(true);
  });

  it("carries the intake findings over as notes in Vietnamese", () => {
    // 0xC0 is not valid UTF-8, so intake falls back to Windows-1258.
    const bytes = new Uint8Array([0x61, 0x2c, 0x62, 0x0a, 0xc0, 0x2c, 0x31]);
    const result = extractSheetText(bytes, "cu.csv");
    expect(result.notes.join(" ")).toContain("Windows-1258");
  });

  it("translates an intake refusal into the matching attachment code", () => {
    expectCode(() => extractSheetText(buildCsv(""), "trong.csv"), "FILE_EMPTY");
    expectCode(
      () => extractSheetText(buildPng(), "bang.csv"),
      "FILE_TYPE_REJECTED",
    );
    expectCode(
      () => extractSheetText(buildXlsx([["a", "b"]]), "so sach.xlsm"),
      "FILE_MACRO_REJECTED",
    );
  });
});
