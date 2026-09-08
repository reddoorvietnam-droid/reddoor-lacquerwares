import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { importSampleWorkbook } from "@/domains/sample-progress/import-workbook";
import { exportSampleWorkbook } from "@/domains/sample-progress/export-workbook";
import {
  reportColumns,
  statusLabels,
  summarize,
} from "@/domains/sample-progress/contracts";
import { buildReport } from "./helpers/sample-progress-fakes";

const realWorkbook = process.env.SAMPLE_PROGRESS_WORKBOOK;

type Cell = string | number | null;

/** Builds a workbook shaped like the Red Door report, for the edge cases. */
function workbookOf(
  rows: Cell[][],
  options: { sheets?: number; reportDate?: Cell; headers?: string[] } = {},
) {
  const header = options.headers ?? [...reportColumns];
  const data: Cell[][] = [
    [null, "BẢNG TIẾN ĐỘ SẢN XUẤT & THEO DÕI MẪU RED DOOR 2026"],
    [null, options.reportDate ?? "24/08/2026"],
    [],
    [null, ...header],
    ...rows.map((row) => [null, ...row]),
  ];
  const book = XLSX.utils.book_new();
  for (let index = 0; index < (options.sheets ?? 1); index++)
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet(data),
      `Sheet${index + 1}`,
    );
  return new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
}

const row = (overrides: Partial<Record<number, Cell>> = {}): Cell[] => {
  const base: Cell[] = [
    1,
    "Sofitel",
    "1 khay",
    statusLabels.woodwork,
    "Công ty",
    "18/07/2026",
    null,
    null,
    "Ghi chú",
  ];
  for (const [index, value] of Object.entries(overrides))
    base[Number(index)] = value ?? null;
  return base;
};

describe("reading the Red Door workbook", () => {
  it("refuses anything that is not a real xlsx package", () => {
    expect(() => importSampleWorkbook(new Uint8Array())).toThrow("dung lượng");
    expect(() => importSampleWorkbook(new Uint8Array(2_000_001))).toThrow(
      "dung lượng",
    );
    // A .xls (OLE compound file) and a renamed text file both fail the check.
    expect(() =>
      importSampleWorkbook(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3])),
    ).toThrow("không phải định dạng");
    expect(() =>
      importSampleWorkbook(new TextEncoder().encode("STT,MẪU ĐƠN HÀNG")),
    ).toThrow("không phải định dạng");
  });

  it("refuses a file with no matching table", () => {
    expect(() =>
      importSampleWorkbook(
        workbookOf([row()], { headers: ["A", "B", "C", "D", "E", "F", "G", "H", "I"] }),
      ),
    ).toThrow("Không tìm thấy bảng");
  });

  it("refuses a file with more than one matching table rather than guessing", () => {
    expect(() => importSampleWorkbook(workbookOf([row()], { sheets: 2 }))).toThrow(
      "2 bảng",
    );
  });

  it("refuses a file with no sample rows", () => {
    expect(() => importSampleWorkbook(workbookOf([]))).toThrow("không có mẫu");
  });

  it("reads the report date and derives the Monday of its week", () => {
    const preview = importSampleWorkbook(workbookOf([row()]));
    expect(preview.reportDate).toBe("2026-08-24");
    expect(preview.week).toBe("2026-08-24");
  });

  it("keeps an unknown status as an error instead of dropping the row", () => {
    const preview = importSampleWorkbook(
      workbookOf([row({ 3: "Đang chờ khách duyệt" })]),
    );
    expect(preview.rows).toHaveLength(1);
    const errors = preview.issues.filter((issue) => issue.severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain("Đang chờ khách duyệt");
    expect(errors[0]!.rowId).toBe(preview.rows[0]!.id);
  });

  it("flags a missing order name without losing the rest of the row", () => {
    const preview = importSampleWorkbook(workbookOf([row({ 1: null })]));
    expect(preview.rows[0]!.notes).toBe("Ghi chú");
    expect(
      preview.issues.some(
        (issue) =>
          issue.severity === "error" && issue.column === "MẪU ĐƠN HÀNG",
      ),
    ).toBe(true);
  });

  it("flags duplicate STT", () => {
    const preview = importSampleWorkbook(
      workbookOf([row(), row({ 1: "Khác" })]),
    );
    expect(
      preview.issues.some((issue) => issue.message.includes("STT bị trùng")),
    ).toBe(true);
  });

  it("keeps business wording in date columns and warns instead of guessing", () => {
    const preview = importSampleWorkbook(
      workbookOf([
        row({ 5: "Chờ gửi", 6: "18/07/", 7: "( hàng chỉ chụp ảnh không gửi )" }),
      ]),
    );
    const [sample] = preview.rows;
    expect(sample!.receivedDate).toEqual({ kind: "text", value: "Chờ gửi" });
    expect(sample!.qcDate).toEqual({ kind: "text", value: "18/07/" });
    expect(sample!.sentDate.kind).toBe("text");
    expect(
      preview.issues.filter((issue) => issue.severity === "warning"),
    ).toHaveLength(3);
    expect(preview.issues.every((issue) => issue.severity === "warning")).toBe(
      true,
    );
  });

  it("keeps an ambiguous written date as the author's own text", () => {
    const preview = importSampleWorkbook(workbookOf([row({ 5: "06/05/2026" })]));
    expect(preview.rows[0]!.receivedDate).toEqual({
      kind: "text",
      value: "06/05/2026",
    });
    expect(
      preview.issues.some((issue) => issue.message.includes("hai cách")),
    ).toBe(true);
  });

  it("reads a true Excel date cell and warns when its display could mislead", () => {
    const book = XLSX.read(workbookOf([row()]), { type: "array" });
    const sheet = book.Sheets[book.SheetNames[0]!]!;
    // 46089 is 8 March 2026; an m/d/yy cell shows it as "3/8/26".
    sheet.G5 = { t: "n", v: 46089, z: "m/d/yy", w: "3/8/26" };
    const preview = importSampleWorkbook(
      new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" })),
    );
    expect(preview.rows[0]!.receivedDate).toEqual({
      kind: "date",
      value: "2026-03-08",
    });
    const warning = preview.issues.find((issue) =>
      issue.message.includes("3/8/26"),
    );
    expect(warning?.severity).toBe("warning");
    expect(warning?.message).toContain("08/03/2026");
  });

  it("keeps multi-line detail exactly as written", () => {
    const detail = "2 tấm phẳng tranh bát giác\n1 bộ 3 khay đáy rời tranh";
    const preview = importSampleWorkbook(workbookOf([row({ 2: detail })]));
    expect(preview.rows[0]!.productDetails).toBe(detail);
  });

  it("counts rows, never the quantities named inside a description", () => {
    const preview = importSampleWorkbook(
      workbookOf([
        row({ 0: 1, 2: "20 chiếc cỡ 20cm" }),
        row({ 0: 2, 2: "12 hộp 2 cỡ", 3: statusLabels.sent }),
      ]),
    );
    expect(preview.rows).toHaveLength(2);
    expect(summarize(preview.rows).map((entry) => entry.count)).toEqual([
      1, 0, 0, 1,
    ]);
  });

  it("refuses a file with more than 500 samples", () => {
    const rows = Array.from({ length: 501 }, (_, index) =>
      row({ 0: index + 1, 1: `Mẫu ${index + 1}` }),
    );
    expect(() => importSampleWorkbook(workbookOf(rows))).toThrow("500");
  });
});

describe("the exported workbook can be read back", () => {
  it("round trips rows, statuses, dates and notes", () => {
    const source = buildReport();
    const preview = importSampleWorkbook(exportSampleWorkbook(source));
    expect(preview.reportDate).toBe(source.reportDate);
    expect(preview.rows).toHaveLength(source.rows.length);
    expect(preview.issues.filter((i) => i.severity === "error")).toHaveLength(0);
    source.rows.forEach((original, index) => {
      const copy = preview.rows[index]!;
      expect(copy.number).toBe(original.number);
      expect(copy.orderName).toBe(original.orderName);
      expect(copy.productDetails).toBe(original.productDetails);
      expect(copy.status).toBe(original.status);
      expect(copy.workshop).toBe(original.workshop);
      expect(copy.notes).toBe(original.notes);
      expect(copy.receivedDate).toEqual(original.receivedDate);
      expect(copy.qcDate).toEqual(original.qcDate);
      expect(copy.sentDate).toEqual(original.sentDate);
    });
  });

  it("does not turn text beginning with = + - or @ into a formula", () => {
    const preview = importSampleWorkbook(exportSampleWorkbook(buildReport()));
    expect(preview.rows[1]!.notes).toContain('=HYPERLINK("http://example.test")');
    expect(preview.rows[1]!.notes).toContain("+84 lô hàng, -2 khay, @ghi chú");
  });
});

describe.runIf(!!realWorkbook)("the workbook Red Door supplied", () => {
  it("imports all 24 samples with the 2 / 7 / 1 / 14 status split", () => {
    const preview = importSampleWorkbook(readFileSync(realWorkbook!));
    expect(preview.reportDate).toBe("2026-08-24");
    expect(preview.week).toBe("2026-08-24");
    expect(preview.rows).toHaveLength(24);
    expect(summarize(preview.rows).map((entry) => entry.count)).toEqual([
      2, 7, 1, 14,
    ]);
    expect([...preview.rows.map((row) => row.number)].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 24 }, (_, index) => index + 1),
    );
    // Nothing in the supplied file blocks a save; every issue is advisory.
    expect(preview.issues.filter((i) => i.severity === "error")).toHaveLength(0);
    expect(preview.issues.length).toBeGreaterThan(0);
  });

  it("keeps the notes, multi-line detail and non-date wording of the original", () => {
    const preview = importSampleWorkbook(readFileSync(realWorkbook!));
    const byNumber = new Map(preview.rows.map((row) => [row.number, row]));

    expect(byNumber.get(1)!.sentDate).toEqual({
      kind: "text",
      value: "Chờ gửi",
    });
    expect(byNumber.get(17)!.receivedDate).toEqual({
      kind: "text",
      value: "18/07/",
    });
    expect(byNumber.get(6)!.sentDate.value).toContain("chỉ chụp ảnh không gửi");
    expect(byNumber.get(2)!.productDetails).toContain("\n");
    expect(byNumber.get(10)!.notes).toBe(
      "Đã xong nhưng chưa đủ yêu cầu về chất lượng",
    );
    expect(byNumber.get(7)!.notes).toContain("triển khai đơn hàng luôn");
    // Every row keeps its own note; none is dropped or merged.
    expect(preview.rows.every((row) => row.notes.trim().length > 0)).toBe(true);
  });

  it("survives an export and re-import without losing a sample", () => {
    const preview = importSampleWorkbook(readFileSync(realWorkbook!));
    const again = importSampleWorkbook(
      exportSampleWorkbook({
        ...buildReport(),
        reportDate: preview.reportDate,
        rows: preview.rows.map((row) => ({
          ...row,
          updatedAt: "2026-08-24T03:00:00.000Z",
          updatedBy: "editor-1",
          updatedByName: "Biên tập nội dung",
        })),
      }),
    );
    expect(again.rows).toHaveLength(24);
    expect(summarize(again.rows).map((entry) => entry.count)).toEqual([
      2, 7, 1, 14,
    ]);
    expect(again.rows.map((row) => row.notes)).toEqual(
      preview.rows.map((row) => row.notes),
    );
    expect(again.rows.map((row) => row.receivedDate)).toEqual(
      preview.rows.map((row) => row.receivedDate),
    );
  });
});
