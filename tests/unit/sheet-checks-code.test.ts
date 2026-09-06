import { describe, expect, it } from "vitest";

import type { SheetCell } from "@/domains/sheet-checks/contracts";
import type { IssueCode } from "@/domains/sheet-checks/issues";
import {
  looseKey,
  normalizeCustomerCode,
  normalizeInvoiceNumber,
  normalizeName,
  normalizeOrderCode,
  stageFromText,
  stripDiacritics,
} from "@/domains/sheet-checks/parsing/code";

function cell(overrides: Partial<SheetCell>): SheetCell {
  return {
    text: "",
    type: "z",
    number: null,
    numberFormat: null,
    formula: false,
    noCache: false,
    mergedFill: false,
    truncated: false,
    ...overrides,
  };
}

function textCell(text: string): SheetCell {
  return cell({ text, type: "s" });
}

function numberCell(
  number: number,
  numberFormat: string | null = null,
  text: string = String(number),
): SheetCell {
  return cell({ text, type: "n", number, numberFormat });
}

function codesOf(result: {
  issues: readonly { code: IssueCode }[];
}): IssueCode[] {
  return result.issues.map((entry) => entry.code);
}

describe("normalizeOrderCode", () => {
  it.each([
    { text: " rd-20260906-e2e1 ", code: "RD-20260906-E2E1", normalized: true },
    { text: "RD–20260906–E2E1", code: "RD-20260906-E2E1", normalized: true },
    { text: "RD—20260906—E2E1", code: "RD-20260906-E2E1", normalized: true },
    { text: "RD 20260906 E2E1", code: "RD20260906E2E1", normalized: true },
    { text: "20260906-E2E1", code: "RD-20260906-E2E1", normalized: true },
    { text: "RD-20260906-E2E1", code: "RD-20260906-E2E1", normalized: false },
    { text: "RD-20260906-E2E", code: "RD-20260906-E2E", normalized: false },
    { text: "０００１２３", code: "000123", normalized: true },
    { text: "000123", code: "000123", normalized: false },
    {
      text: "RD-2026\u200D0906-E2E1",
      code: "RD-20260906-E2E1",
      normalized: true,
    },
    { text: "A".repeat(40), code: "A".repeat(40), normalized: false },
  ])("$text → $code", ({ text, code, normalized }) => {
    const result = normalizeOrderCode(textCell(text));
    expect(result.blank).toBe(false);
    expect(result.code).toBe(code);
    expect(result.issues).toEqual(
      normalized
        ? [
            expect.objectContaining({
              code: "CODE_NORMALIZED",
              severity: "info",
              params: { raw: text.trim(), code },
            }),
          ]
        : [],
    );
  });

  it.each([
    "RD/2026",
    "A".repeat(41),
    "RD--2026",
    "-RD2026",
    "RD2026-",
    "RD.2026",
    "RD_2026",
  ])("%s → CODE_INVALID", (text) => {
    const result = normalizeOrderCode(textCell(text));
    expect(result.code).toBeNull();
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "CODE_INVALID", params: { raw: text } }),
    ]);
  });

  it("refuses look-alike letters instead of guessing", () => {
    const result = normalizeOrderCode(textCell("RD-2026О906"));
    expect(result.code).toBeNull();
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "CODE_SUSPICIOUS_CHARS",
        severity: "warn",
        params: { raw: "RD-2026О906" },
      }),
    ]);
    expect(normalizeOrderCode(textCell("ĐH-001")).code).toBeNull();
  });

  it("treats placeholders and blank cells as blank", () => {
    for (const text of ["", "-", "N/A", "–"]) {
      expect(normalizeOrderCode(textCell(text))).toEqual({
        code: null,
        blank: true,
        issues: [],
      });
    }
    expect(normalizeOrderCode(cell({}))).toEqual({
      code: null,
      blank: true,
      issues: [],
    });
    expect(
      normalizeOrderCode(cell({ type: "s", formula: true, noCache: true }))
        .blank,
    ).toBe(true);
  });

  it("reads numeric cells as digits, keeping zeros the format showed", () => {
    expect(normalizeOrderCode(numberCell(123, "000000", "000123"))).toEqual({
      code: "000123",
      blank: false,
      issues: [],
    });
    const general = normalizeOrderCode(numberCell(123, "General", "123"));
    expect(general.code).toBe("123");
    expect(general.issues).toEqual([
      expect.objectContaining({ code: "CODE_NUMERIC_CELL", severity: "warn" }),
    ]);
    expect(normalizeOrderCode(numberCell(123, null, "000123")).code).toBe(
      "000123",
    );
    expect(normalizeOrderCode(numberCell(20260906, "0", "20260906")).code).toBe(
      "20260906",
    );
  });

  it("refuses decimal and scientific numeric cells", () => {
    for (const entry of [
      numberCell(1.23e5, "0.00E+00", "1.23E+05"),
      numberCell(12.5, "0.0", "12.5"),
      numberCell(-5),
      numberCell(1e21, "General", "1E+21"),
      numberCell(Number.NaN, null, ""),
    ]) {
      const result = normalizeOrderCode(entry);
      expect(result.code).toBeNull();
      expect(codesOf(result)).toEqual(["CODE_NOT_TEXT"]);
    }
  });

  it("rejects booleans and error cells", () => {
    expect(
      codesOf(normalizeOrderCode(cell({ type: "b", text: "TRUE" }))),
    ).toEqual(["CODE_INVALID"]);
    expect(
      codesOf(normalizeOrderCode(cell({ type: "e", text: "#REF!" }))),
    ).toEqual(["CODE_INVALID"]);
  });
});

describe("normalizeInvoiceNumber and normalizeCustomerCode", () => {
  it.each([
    ["inv-0001", "INV-0001"],
    ["INV 0001", "INV 0001"],
    ["INV0001", "INV0001"],
    ["HD 001/2026", "HD 001/2026"],
    ["  HD   001 ", "HD 001"],
    ["HĐ–001", "HĐ-001"],
    ["ＩＮＶ００１", "INV001"],
  ])("invoice %s → %s", (text, code) => {
    expect(normalizeInvoiceNumber(textCell(text))).toEqual({
      code,
      blank: false,
      issues: [],
    });
  });

  it("caps invoice numbers at 60 and customer codes at 80 characters", () => {
    expect(normalizeInvoiceNumber(textCell("A".repeat(60))).code).toBe(
      "A".repeat(60),
    );
    expect(codesOf(normalizeInvoiceNumber(textCell("A".repeat(61))))).toEqual([
      "CODE_INVALID",
    ]);
    expect(normalizeCustomerCode(textCell("A".repeat(80))).code).toBe(
      "A".repeat(80),
    );
    expect(codesOf(normalizeCustomerCode(textCell("A".repeat(81))))).toEqual([
      "CODE_INVALID",
    ]);
  });

  it("normalises customer codes the same way", () => {
    expect(normalizeCustomerCode(textCell(" kh0007 "))).toEqual({
      code: "KH0007",
      blank: false,
      issues: [],
    });
    expect(normalizeCustomerCode(textCell("-")).blank).toBe(true);
    expect(normalizeCustomerCode(numberCell(7, "0000", "0007")).code).toBe(
      "0007",
    );
    expect(codesOf(normalizeInvoiceNumber(numberCell(1)))).toEqual([
      "CODE_NUMERIC_CELL",
    ]);
    expect(
      codesOf(normalizeInvoiceNumber(cell({ type: "e", text: "#N/A" }))),
    ).toEqual(["CODE_INVALID"]);
  });

  it("gives loose keys that ignore separators for invoice matching", () => {
    expect(looseKey("INV-0001")).toBe("INV0001");
    expect(looseKey("inv 0001")).toBe("INV0001");
    expect(looseKey("INV0001")).toBe("INV0001");
    expect(looseKey("INV00010")).not.toBe(looseKey("INV0001"));
    expect(looseKey("HĐ 001/2026")).toBe("HD0012026");
  });
});

describe("names", () => {
  it("strips diacritics including đ", () => {
    expect(stripDiacritics("Đường Hồ Chí Minh")).toBe("duong ho chi minh");
    expect(stripDiacritics("Nguyễn Văn A")).toBe("nguyen van a");
    expect(stripDiacritics("ABC")).toBe("abc");
  });

  it("normalises names past legal forms, punctuation and diacritics", () => {
    expect(normalizeName("Cty TNHH ABC Import")).toBe("abc import");
    expect(normalizeName("Công ty TNHH ABC Import")).toBe("abc import");
    expect(normalizeName("Nguyen Van A")).toBe(normalizeName("Nguyễn Văn A"));
    expect(normalizeName("ABC Trading Co., Ltd.")).toBe("abc trading");
    expect(normalizeName("Công ty Cổ phần Một Thành Viên XYZ")).toBe("xyz");
    expect(normalizeName("XYZ Corporation Inc.")).toBe("xyz");
    expect(normalizeName("  ABC   Import  ")).toBe("abc import");
    expect(normalizeName("Cty CP Đầu Tư & Phát Triển")).toBe(
      "dau tu phat trien",
    );
    expect(normalizeName("")).toBe("");
  });

  it("keeps a bare name and does not confuse ordinary words with legal forms", () => {
    expect(normalizeName("ABC Import")).toBe("abc import");
    expect(normalizeName("Coco Trading")).toBe("coco trading");
    expect(normalizeName("Incredible Ltd")).toBe("incredible");
  });
});

describe("stageFromText", () => {
  it.each([
    ["Đang sản xuất", "inProduction"],
    ["dang san xuat", "inProduction"],
    ["Sản xuất", "inProduction"],
    ["Kế hoạch sản xuất", "productionPlanning"],
    ["Đã xuất hóa đơn", "invoiced"],
    ["Hóa đơn", "invoiced"],
    ["Đã xuất", "shipped"],
    ["Xuất hàng", "shipped"],
    ["delivered", "shipped"],
    ["Hồ sơ xuất khẩu", "tradeDocumentation"],
    ["Hồ sơ", "fileOpened"],
    ["Mở hồ sơ", "fileOpened"],
    ["chờ giám đốc duyệt", "awaitingDirectorApproval"],
    ["Chờ duyệt", "awaitingDirectorApproval"],
    ["QC", "qualityControl"],
    ["KCS", "qualityControl"],
    ["Đóng gói", "packing"],
    ["Lịch đóng hàng", "loadingScheduled"],
    ["Đóng hàng", "loadingScheduled"],
    ["Đã thanh toán", "settled"],
    ["paid", "settled"],
    ["done", "closed"],
    ["Hoàn thành", "closed"],
    ["Đã đóng", "closed"],
    ["huỷ", "cancelled"],
    ["Hủy đơn", "cancelled"],
    ["Cancelled", "cancelled"],
    ["Mới", "received"],
    ["Đã nhận", "received"],
    ["Kiểm kho", "inventoryCheck"],
    ["Mua vật tư", "materialProcurement"],
    ["Xuất vật tư", "materialIssued"],
    ["inProduction", "inProduction"],
    ["INPRODUCTION", "inProduction"],
    ["Nhận đơn hàng từ khách hàng", "received"],
    ["Customer order received", "received"],
    ["Đã đóng hồ sơ đơn hàng", "closed"],
  ])("%s → %s", (text, stage) => {
    expect(stageFromText(text)).toBe(stage);
  });

  it("returns null for unknown or empty text", () => {
    expect(stageFromText("abc")).toBeNull();
    expect(stageFromText("")).toBeNull();
    expect(stageFromText("   ")).toBeNull();
    expect(stageFromText("Renewed")).toBeNull();
    expect(stageFromText("Newton")).toBeNull();
  });
});
