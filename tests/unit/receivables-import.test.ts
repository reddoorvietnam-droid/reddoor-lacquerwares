import { readFileSync } from "node:fs";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { codeKey } from "@/domains/receivables/contracts";
import {
  fingerprintOf,
  importKeyOf,
  parseReceivablesWorkbook,
} from "@/domains/receivables/import-workbook";

/**
 * Migration checks. The first block runs against a small synthetic workbook so
 * the parser's rules are pinned regardless of the source file; the second runs
 * against the real `Reddoor-congno-2026.xlsx` and asserts the reconciliation
 * the client will be shown.
 */

const serial = (iso: string) =>
  (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000;
const dateCell = (iso: string): XLSX.CellObject => ({
  t: "n",
  v: serial(iso),
  z: "mm-dd-yy",
});
const formula = (f: string, v: number | string): XLSX.CellObject =>
  typeof v === "number" ? { t: "n", v, f } : { t: "s", v, f };

function buildWorkbook(): Buffer {
  const book = XLSX.utils.book_new();

  const partners = XLSX.utils.aoa_to_sheet([
    ["Ngày lập"],
    ["Người lập"],
    [],
    [
      "STT",
      "Loại",
      "Mã nhà cung cấp",
      "Tên người cung cấp",
      "Số điện thoại",
      "Địa Chỉ",
      "Ghi chú",
    ],
    [1, "Loại 1", "Nha", "Nguyễn Ngọc Nha", "0982609741", "Hà Nội", ""],
    [2, "Loại 1", "Sang", "Ngô Huy Sáng", "0", "", ""],
    [3, "Loại 2", "QuyetBK", "Đỗ Mạnh Quyết", "0", "", ""],
  ]);

  const items = XLSX.utils.aoa_to_sheet([
    ["STT", "Ma", "Tên sơn", "DonViTinh", "Gía bán"],
    [null, "952A1", "Bóng trắng CNM", "Kg", 120000],
    [null, "Sonpha412C", "Sơn pha 412C", "Kg", 150000],
  ]);
  items["!ref"] = "A2:E4";
  // openpyxl reports the sheet as starting at A2, exactly as the source does.
  const shifted = XLSX.utils.aoa_to_sheet([
    ["STT", "Ma", "Tên sơn", "DonViTinh", "Gía bán"],
    [null, "952A1", "Bóng trắng CNM", "Kg", 120000],
    [null, "Sonpha412C", "Sơn pha 412C", "Kg", 150000],
  ]);

  const summary = XLSX.utils.aoa_to_sheet([
    [null, null, null, "BẢNG TỔNG HỢP CÔNG NỢ\nNĂM-2026"],
    [
      "Ngày tháng",
      "Số chứng từ",
      "STT",
      "Mã khách",
      "Tên khách hàng",
      "Số điện thoại",
      "Dư đầu ngày \n02/01/2026",
      "Phát sinh tăng",
      "Phát sinh giảm",
      "Dư cuối kỳ",
      "Chú ý",
    ],
    [
      null,
      null,
      1,
      "Nha",
      "Nguyễn Ngọc Nha",
      "0982609741",
      100000,
      450000,
      200000,
      350000,
      "",
    ],
    [null, null, 2, "Sang", "Ngô Huy Sáng", 0, 0, 360000, 360000, 0, ""],
    [null, null, 3, "QuyetBK", "Đỗ Mạnh Quyết", 0, -250, 0, 0, -250, ""],
    [null, null, "Cộng tổng", null, null, null, 99750, 810000, 560000, 349750],
    [],
    [
      null,
      null,
      null,
      "Người lập",
      null,
      null,
      "Phụ trách kế toán",
      null,
      null,
      null,
      "Giám đốc",
    ],
  ]);

  const sales = XLSX.utils.aoa_to_sheet([
    ["SỔ CHI TIẾT BÁN HÀNG\n NĂM 2026"],
    [],
    [
      "Ngày tháng",
      "Mã khách",
      "Tên khách",
      "Số điện thoại",
      "Số chứng từ",
      "Mã hàng hóa",
      "Mặt hàng",
      "Diễn giải",
      "Đơn vị tính",
      "Số lượng",
      "Đơn giá",
      "Thành tiền",
      "Ghi chú",
    ],
  ]);
  // Row 4: an ordinary sale, lower-cased code (Excel's SUMIF is case-blind).
  XLSX.utils.sheet_add_aoa(
    sales,
    [
      [
        null,
        "nha",
        null,
        null,
        null,
        "Sonpha412C",
        null,
        "xuất kho",
        null,
        0.3,
        null,
        null,
        "",
      ],
    ],
    { origin: "A4" },
  );
  sales.A4 = dateCell("2026-01-02");
  sales.K4 = formula('IFERROR(VLOOKUP(F4,khoson,4,0),"")', 150000);
  sales.L4 = formula("K4*J4", 45000);
  // Row 5: the amount someone zeroed by hand — Excel summed 0, so must we.
  XLSX.utils.sheet_add_aoa(
    sales,
    [
      [
        null,
        "Nha",
        null,
        null,
        null,
        "952A1",
        null,
        "xuất kho",
        null,
        8.5,
        140000,
        0,
        "",
      ],
    ],
    { origin: "A5" },
  );
  sales.A5 = dateCell("2026-02-01");
  // Row 6: a second customer.
  XLSX.utils.sheet_add_aoa(
    sales,
    [
      [
        null,
        "Sang",
        null,
        null,
        null,
        "952A1",
        null,
        "xuất kho",
        null,
        3,
        120000,
        360000,
        "Caspari",
      ],
    ],
    { origin: "A6" },
  );
  sales.A6 = dateCell("2026-01-02");
  // Row 7: an item that is not in the catalogue.
  XLSX.utils.sheet_add_aoa(
    sales,
    [
      [
        null,
        "Nha",
        null,
        null,
        null,
        "khongco",
        null,
        "xuất kho",
        null,
        1,
        405000,
        405000,
        "",
      ],
    ],
    { origin: "A7" },
  );
  sales.A7 = dateCell("2026-03-01");
  // Row 8: formula-only fill-down; not a transaction.
  sales.C8 = formula('IFERROR(VLOOKUP(B8,MaNhaCungCap,2,0),"")', "");
  sales.L8 = formula("IFERROR(J8*K8,0)", 0);
  sales["!ref"] = "A1:M20";

  const payments = XLSX.utils.aoa_to_sheet([
    ["BẢNG THANH TOÁN \nNĂM - 2026"],
    [
      "Ngày tháng",
      "Số chứng từ",
      "Mã khách",
      "Tên khách hàng",
      "Số điện thoại",
      "Diễn giải",
      "Số tiền thanh toán/trừ sơn",
      "Ghi chú",
    ],
  ]);
  XLSX.utils.sheet_add_aoa(
    payments,
    [[null, "", "Nha", null, null, "thanh toán", 200000, ""]],
    { origin: "A3" },
  );
  payments.A3 = dateCell("2026-01-06");
  XLSX.utils.sheet_add_aoa(
    payments,
    [[null, "", "sang", null, null, "Trừ tiền sơn", 360000, ""]],
    { origin: "A4" },
  );
  payments.A4 = dateCell("2026-02-10");
  XLSX.utils.sheet_add_aoa(
    payments,
    [[null, "", "Nha", null, null, "TT toát nc 2 khay Kim", 1, ""]],
    { origin: "A5" },
  );
  payments.A5 = dateCell("2026-03-05");
  payments.D6 = formula('IFERROR(VLOOKUP(C6,MaNhaCungCap,2,0),"")', "");
  payments["!ref"] = "A1:M20";

  // A per-customer statement: every line is already in ChiTietBanHang.
  const statement = XLSX.utils.aoa_to_sheet([
    ["SỔ CHI TIẾT BÁN HÀNG\n NĂM 2026"],
    [
      "Ngày tháng",
      "Tên khách",
      "Mã hàng hóa",
      "Mặt hàng",
      "Diễn giải",
      "ĐVT",
      "Số lượng",
      "Đơn giá",
      "Thành tiền",
      "Ghi chú",
    ],
  ]);
  XLSX.utils.sheet_add_aoa(
    statement,
    [
      [
        null,
        "Ngô Huy Sáng",
        "952A1",
        "Bóng trắng CNM",
        "xuất kho",
        "Kg",
        3,
        120000,
        360000,
        null,
      ],
    ],
    { origin: "A3" },
  );
  statement.A3 = dateCell("2026-01-02");

  // A pre-2026 sheet: history, already inside the opening balance.
  const legacy = XLSX.utils.aoa_to_sheet([
    ["SỔ CHI TIẾT BÁN HÀNG\n NĂM 2020"],
    [
      "Ngày tháng",
      "Tên khách",
      "Mã hàng hóa",
      "Mặt hàng",
      "Diễn giải",
      "ĐVT",
      "Số lượng",
      "Đơn giá",
      "Thành tiền",
      "Ghi chú",
    ],
  ]);
  XLSX.utils.sheet_add_aoa(
    legacy,
    [
      [
        null,
        "Trần Mạnh Hùng",
        "832A1",
        "Pu trắng",
        "Xuất bán",
        "Kg",
        4,
        120000,
        480000,
        null,
      ],
    ],
    { origin: "A3" },
  );
  legacy.A3 = dateCell("2020-04-18");

  const staleSummary = XLSX.utils.aoa_to_sheet([
    [null, null, null, "BẢNG TỔNG HỢP CÔNG NỢ\nNĂM-2024"],
  ]);

  XLSX.utils.book_append_sheet(book, sales, "ChiTietBanHang");
  XLSX.utils.book_append_sheet(book, payments, "ThanhToan");
  XLSX.utils.book_append_sheet(book, summary, "TongHopCongNo");
  XLSX.utils.book_append_sheet(book, partners, "MaNhaCungCap");
  XLSX.utils.book_append_sheet(book, shifted, "KhoSon");
  XLSX.utils.book_append_sheet(book, statement, "C.Sang2708");
  XLSX.utils.book_append_sheet(book, legacy, "C.Hieu");
  XLSX.utils.book_append_sheet(book, staleSummary, "TongHopCongNo (2)");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parseReceivablesWorkbook", () => {
  const parsed = parseReceivablesWorkbook(buildWorkbook(), "fixture.xlsx");

  it("reads only the rows that carry business data", () => {
    // Four sales and three reductions; the formula-only fill-downs are not
    // transactions no matter how far the workbook drags them.
    expect(parsed.sales).toHaveLength(4);
    expect(parsed.reductions).toHaveLength(3);
  });

  it("converts Excel serials without drifting a day", () => {
    expect(parsed.sales[0]?.entryDate).toBe("2026-01-02");
    expect(parsed.sales[3]?.entryDate).toBe("2026-03-01");
    expect(parsed.reductions[0]?.entryDate).toBe("2026-01-06");
  });

  it("resolves customer codes case-insensitively", () => {
    // `nha`, `Nha` and `sang` are three spellings of two customers.
    expect(parsed.sales.map((sale) => sale.normalizedCode)).toEqual([
      "nha",
      "nha",
      "sang",
      "nha",
    ]);
    expect(parsed.reductions.map((row) => row.normalizedCode)).toEqual([
      "nha",
      "sang",
      "nha",
    ]);
    expect(
      parsed.sales.every((sale) => sale.issues.includes("UNKNOWN_CUSTOMER")),
    ).toBe(false);
  });

  it("takes the amount the workbook summed, and flags it when it disagrees", () => {
    expect(parsed.sales[0]?.amount).toBe("45000");
    // 8.5 × 140.000 would be 1.190.000, but the cell says 0 and SUMIF added 0.
    expect(parsed.sales[1]?.amount).toBe("0");
    expect(parsed.sales[1]?.issues).toContain("MISSING_AMOUNT");
  });

  it("keeps a sale whose item is not in the catalogue, flagged for review", () => {
    const unknown = parsed.sales[3];
    expect(unknown?.itemCode).toBe("khongco");
    expect(unknown?.amount).toBe("405000");
    expect(unknown?.issues).toContain("UNKNOWN_ITEM");
  });

  it("snapshots the price the sale was written with", () => {
    expect(parsed.sales[0]?.unitPrice).toBe("150000");
    expect(parsed.sales[2]?.unitPrice).toBe("120000");
  });

  it("maps reduction types and never loses the original wording", () => {
    expect(parsed.reductions[0]).toMatchObject({
      type: "PAYMENT",
      legacyDescription: "thanh toán",
    });
    expect(parsed.reductions[1]).toMatchObject({
      type: "PAINT_OFFSET",
      legacyDescription: "Trừ tiền sơn",
    });
    expect(parsed.reductions[2]).toMatchObject({
      type: "OTHER_OFFSET",
      legacyDescription: "TT toát nc 2 khay Kim",
    });
    expect(parsed.reductions[2]?.issues).toContain("UNMAPPED_DESCRIPTION");
  });

  it("reads opening balances, negatives included, and never the closing column", () => {
    expect(parsed.openings.map((row) => [row.code, row.amount])).toEqual([
      ["Nha", "100000"],
      ["Sang", "0"],
      ["QuyetBK", "-250"],
    ]);
    // The closing column is kept only to reconcile against, never imported.
    expect(parsed.openings[0]?.excelClosing).toBe("350000");
  });

  it("stops the customer list at the total row", () => {
    expect(parsed.openings).toHaveLength(3);
    expect(parsed.excelTotals).toEqual({
      opening: "99750",
      increase: "810000",
      decrease: "560000",
      closing: "349750",
    });
  });

  it("reads the partner master, blanking a phone typed as zero", () => {
    expect(parsed.customers).toHaveLength(3);
    expect(parsed.customers[0]).toMatchObject({
      code: "Nha",
      name: "Nguyễn Ngọc Nha",
      phone: "0982609741",
      address: "Hà Nội",
      type: "Loại 1",
    });
    expect(parsed.customers[1]?.phone).toBe("");
  });

  it("skips the catalogue's own header row", () => {
    expect([...parsed.itemCodes].sort()).toEqual(["952a1", "sonpha412c"]);
  });

  it("classifies every sheet, and refuses to import a derived one", () => {
    const verdict = (name: string) =>
      parsed.sheets.find((sheet) => sheet.sheet === name);
    expect(verdict("ChiTietBanHang")?.classification).toBe("primarySource");
    expect(verdict("ThanhToan")?.classification).toBe("primarySource");
    expect(verdict("TongHopCongNo")?.classification).toBe("primarySource");
    expect(verdict("MaNhaCungCap")?.classification).toBe("masterData");
    expect(verdict("KhoSon")?.classification).toBe("masterData");
    // Every line already in the sales ledger: a printed statement.
    expect(verdict("C.Sang2708")?.classification).toBe("derivedReport");
    // Pre-2026: history that the opening balance already contains.
    expect(verdict("C.Hieu")?.classification).toBe("historicalSource");
    // Same SUMIFs over the same ledgers, older opening column.
    expect(verdict("TongHopCongNo (2)")?.classification).toBe("legacyReport");
  });

  it("replicates the workbook's SUMIFs exactly", () => {
    const by = (
      code: string,
      rows: { normalizedCode: string; amount: string }[],
    ) =>
      rows
        .filter((row) => row.normalizedCode === codeKey(code))
        .reduce((total, row) => total.plus(row.amount), new Decimal(0))
        .toFixed();
    expect(by("Nha", parsed.sales)).toBe("450000");
    expect(by("Nha", parsed.reductions)).toBe("200001");
    expect(by("Sang", parsed.sales)).toBe("360000");
    expect(by("Sang", parsed.reductions)).toBe("360000");
  });
});

describe("import keys", () => {
  it("are stable per workbook, sheet and row", () => {
    expect(importKeyOf("abc", "ThanhToan", 12)).toBe("abc:ThanhToan:12");
    // A different source file is a different key, so re-importing an edited
    // copy adds rows rather than silently overwriting the originals.
    expect(importKeyOf("abd", "ThanhToan", 12)).not.toBe("abc:ThanhToan:12");
  });

  it("fingerprint two identical same-day sales the same way", () => {
    // Deduplication must never rest on the fingerprint alone: two real sales
    // of the same item to the same customer on one day are legitimate.
    const parts = ["2026-01-02", "952a1", "3", "360000"];
    expect(fingerprintOf(parts)).toBe(fingerprintOf([...parts]));
  });
});

// ---------------------------------------------------------------- real file

const sourcePath = "assets/Reddoor-congno-2026.xlsx";
let sourceBytes: Buffer | null = null;
try {
  sourceBytes = readFileSync(sourcePath);
} catch {
  sourceBytes = null;
}

describe.runIf(sourceBytes !== null)("Reddoor-congno-2026.xlsx", () => {
  const parsed = parseReceivablesWorkbook(
    sourceBytes!,
    "Reddoor-congno-2026.xlsx",
  );
  const sum = (rows: { amount: string }[]) =>
    rows.reduce((total, row) => total.plus(row.amount), new Decimal(0));

  it("finds the transactions the workbook actually holds", () => {
    expect(parsed.sales).toHaveLength(1101);
    expect(parsed.reductions).toHaveLength(168);
    expect(parsed.openings).toHaveLength(50);
    expect(parsed.customers).toHaveLength(125);
  });

  it("covers 02/01/2026 to 09/09/2026", () => {
    const dates = parsed.sales.map((sale) => sale.entryDate).sort();
    expect(dates[0]).toBe("2026-01-02");
    expect(dates.at(-1)).toBe("2026-09-09");
  });

  it("reproduces the workbook's own total line", () => {
    expect(parsed.excelTotals).toEqual({
      opening: "72014650",
      increase: "1019322500",
      decrease: "950063000",
      closing: "141274150",
    });
    // The identity the whole report rests on.
    expect(
      new Decimal(parsed.excelTotals.opening)
        .plus(parsed.excelTotals.increase)
        .minus(parsed.excelTotals.decrease)
        .toFixed(),
    ).toBe(parsed.excelTotals.closing);
  });

  it("reconciles every one of the 50 listed customers", () => {
    const salesBy = new Map<string, Decimal>();
    for (const sale of parsed.sales)
      salesBy.set(
        sale.normalizedCode,
        (salesBy.get(sale.normalizedCode) ?? new Decimal(0)).plus(sale.amount),
      );
    const reductionsBy = new Map<string, Decimal>();
    for (const row of parsed.reductions)
      reductionsBy.set(
        row.normalizedCode,
        (reductionsBy.get(row.normalizedCode) ?? new Decimal(0)).plus(
          row.amount,
        ),
      );

    const mismatched = parsed.openings.filter((opening) => {
      const increase = salesBy.get(opening.normalizedCode) ?? new Decimal(0);
      const decrease =
        reductionsBy.get(opening.normalizedCode) ?? new Decimal(0);
      const closing = new Decimal(opening.amount)
        .plus(increase)
        .minus(decrease);
      return (
        !increase.equals(opening.excelIncrease) ||
        !decrease.equals(opening.excelDecrease) ||
        !closing.equals(opening.excelClosing)
      );
    });
    expect(mismatched.map((row) => row.code)).toEqual([]);
  });

  it("accounts for the gap between the ledgers and the printed report", () => {
    // The report sums only the 50 rows typed into TongHopCongNo. `linh` traded
    // 385.000 in and 385.000 out without ever getting a row, so the ledgers are
    // larger by exactly that on both sides and the closing total is unchanged.
    const listed = new Set(parsed.openings.map((row) => row.normalizedCode));
    const missingSales = sum(
      parsed.sales.filter((sale) => !listed.has(sale.normalizedCode)),
    );
    const missingReductions = sum(
      parsed.reductions.filter((row) => !listed.has(row.normalizedCode)),
    );
    expect(missingSales.toFixed()).toBe("385000");
    expect(missingReductions.toFixed()).toBe("385000");
    expect(sum(parsed.sales).minus(missingSales).toFixed()).toBe(
      parsed.excelTotals.increase,
    );
    expect(sum(parsed.reductions).minus(missingReductions).toFixed()).toBe(
      parsed.excelTotals.decrease,
    );
  });

  it("classifies all 31 sheets, importing only the five that carry authority", () => {
    expect(parsed.sheets).toHaveLength(31);
    const counts = parsed.sheets.reduce<Record<string, number>>(
      (carry, sheet) => {
        carry[sheet.classification] = (carry[sheet.classification] ?? 0) + 1;
        return carry;
      },
      {},
    );
    expect(counts).toEqual({
      primarySource: 3,
      masterData: 2,
      derivedReport: 17,
      historicalSource: 5,
      legacyReport: 1,
      emptyOrHelper: 3,
    });
    // Not one per-customer sheet holds a 2026 line the sales ledger is missing.
    for (const sheet of parsed.sheets.filter(
      (candidate) => candidate.classification === "derivedReport",
    ))
      expect(sheet.matchedInSalesLedger).toBe(sheet.rows);
  });

  it("flags the ten incomplete amounts and the one unclear description", () => {
    const flagged = parsed.sales.filter((sale) =>
      sale.issues.includes("MISSING_AMOUNT"),
    );
    expect(flagged).toHaveLength(10);
    // Flagged, never dropped: the quantity is real even where the amount is not.
    expect(flagged.every((sale) => sale.quantity !== null)).toBe(true);
    expect(
      parsed.reductions.filter((row) =>
        row.issues.includes("UNMAPPED_DESCRIPTION"),
      ),
    ).toHaveLength(1);
  });

  it("knows every customer and item code the ledgers use", () => {
    const known = new Set(parsed.customers.map((row) => row.normalizedCode));
    const unknownCustomers = [
      ...new Set(
        [...parsed.sales, ...parsed.reductions]
          .map((row) => row.normalizedCode)
          .filter((code) => !known.has(code)),
      ),
    ];
    expect(unknownCustomers).toEqual([]);
    const unknownItems = [
      ...new Set(
        parsed.sales
          .map((sale) => codeKey(sale.itemCode))
          .filter((code) => code && !parsed.itemCodes.has(code)),
      ),
    ];
    expect(unknownItems).toEqual([]);
  });
});
