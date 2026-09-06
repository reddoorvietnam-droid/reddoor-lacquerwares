import { describe, expect, it } from "vitest";

import {
  buildCsvExport,
  csvField,
  exportFileName,
  exportShowsSystemValues,
} from "@/domains/sheet-checks/export";
import { issue } from "@/domains/sheet-checks/issues";
import { money } from "@/lib/money";

import {
  rowResult,
  sheetCheckDto,
  sheetCheckNow,
  sheetRowDto,
} from "./helpers/sheet-check-fakes";

/**
 * The CSV export: formula-injection safe, BOM + CRLF, and blind to system
 * money unless the check itself carries the governing permission.
 */

const BOM = 0xfeff;

function lines(content: string): string[] {
  expect(content.charCodeAt(0)).toBe(BOM);
  expect(content.endsWith("\r\n")).toBe(true);
  return content.slice(1, -2).split("\r\n");
}

describe("csvField", () => {
  it.each([
    ["=SUM(A1)", "'=SUM(A1)"],
    ["+1", "'+1"],
    ["-1.000", "'-1.000"],
    ["@cmd", "'@cmd"],
    ["\t=1", '"\'\t=1"'],
    ["\r=1", '"\'\r=1"'],
  ])("guards %j as %j", (input, expected) => {
    expect(csvField(input)).toBe(expected);
  });

  it("doubles quotes and quotes fields with separators, newlines or edge spaces", () => {
    expect(csvField('Công ty "ABC"')).toBe('"Công ty ""ABC"""');
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField("a;b")).toBe('"a;b"');
    expect(csvField("a\nb")).toBe('"a\nb"');
    expect(csvField(" lead")).toBe('" lead"');
    expect(csvField("plain")).toBe("plain");
    expect(csvField("")).toBe("");
  });
});

describe("buildCsvExport", () => {
  it("writes the grid with headers, outcome, severity and rendered findings, never a system column for a plain generic check", () => {
    const check = sheetCheckDto({
      template: "generic",
      requiredPermissions: ["orders.read"],
      headers: ["Mã đơn", "Khách", "Số tiền"],
      rowCount: 3,
      dataRowCount: 2,
    });
    const rows = [
      sheetRowDto(
        check.id,
        0,
        ["RD-0001", "Công ty ABC", "1.000.000"],
        rowResult({
          outcome: "matched",
          issues: [
            issue("ORDER_MATCHED", {
              code: "RD-0001",
              stage: "Đang sản xuất",
              customer: "Công ty ABC",
            }),
          ],
          system: {
            order: {
              id: "o1",
              orderCode: "RD-0001",
              stage: "inProduction",
              customerName: "Công ty ABC",
              sellingPrice: null,
            },
          },
        }),
      ),
      sheetRowDto(
        check.id,
        1,
        ['=HYPERLINK("x")', "-Bí Mật", "+2.000.000"],
        rowResult({
          outcome: "notFound",
          issues: [
            issue("ORDER_NOT_FOUND", { code: "RD-9999" }),
            issue("AMOUNT_NOT_COMPARED", {}, { columnIndex: 2 }),
          ],
        }),
      ),
      sheetRowDto(
        check.id,
        2,
        ["Tổng cộng", "", "3.000.000"],
        rowResult({ outcome: "skipped" }),
        { kind: "total", sheetRowNumber: 5 },
      ),
    ];

    const file = buildCsvExport({ check, rows, locale: "vi" });
    const [header, first, second, third, ...rest] = lines(file.content);
    expect(rest).toEqual([]);
    expect(header).toBe("Dòng,Loại,Mã đơn,Khách,Số tiền,Kết quả,Mức,Phát hiện");
    expect(first).toBe(
      '2,Dữ liệu,RD-0001,Công ty ABC,1.000.000,Khớp,Thông tin,"Đơn RD-0001: Đang sản xuất, khách Công ty ABC"',
    );
    expect(second).toBe(
      '3,Dữ liệu,"\'=HYPERLINK(""x"")",\'-Bí Mật,\'+2.000.000,Không thấy,Lỗi,"Không tìm thấy đơn RD-9999 trong phạm vi của bạn | Cột số tiền chỉ được kiểm tra định dạng và cộng dồn; không đối chiếu với hệ thống vì tài khoản của bạn không có quyền xem giá bán/hóa đơn/tiền khách trả"',
    );
    expect(third).toBe("5,Tổng,Tổng cộng,,3.000.000,Bỏ qua,,");
    expect(file.content).not.toContain("Hệ thống");
  });

  it("renders in English and falls back to column letters when a header is empty", () => {
    const check = sheetCheckDto({
      headers: ["", "Số tiền"],
      requiredPermissions: ["orders.read"],
    });
    const rows = [
      sheetRowDto(
        check.id,
        0,
        ["x", "1"],
        rowResult({
          outcome: "invalid",
          issues: [issue("REQUIRED_EMPTY", { field: "Mã đơn" })],
        }),
      ),
      sheetRowDto(check.id, 1, ["", ""], null, { kind: "blank" }),
    ];
    const [header, first, second] = lines(
      buildCsvExport({ check, rows, locale: "en" }).content,
    );
    expect(header).toBe("Row,Kind,A,Số tiền,Outcome,Severity,Findings");
    expect(first).toBe("2,Data,x,1,Invalid,Error,Missing Mã đơn");
    expect(second).toBe("3,Blank,,,,,");
  });

  it("adds the system column only when the check carries the governing money permission", () => {
    const receipt = {
      id: "r1",
      occurredDay: "2026-08-15",
      amount: money("25000000", "VND"),
      counterparty: "Công ty ABC",
      method: "bankTransfer",
      allocations: ["invoice:INV-0001=25000000"],
      status: "active" as const,
      voidReason: null,
    };
    const result = rowResult({
      outcome: "matched",
      issues: [
        issue("RECEIPT_MATCHED", { d: "2026-08-15", amount: "25000000 VND" }),
      ],
      system: { receipts: [receipt], matchStrength: "S2_CUSTOMER_AMOUNT_DATE" },
    });
    const cells = ["2026-08-15", "Công ty ABC", "25.000.000"];

    const cash = sheetCheckDto({
      template: "incomingCash",
      requiredPermissions: ["payments.read"],
      headers: ["Ngày", "Khách", "Số tiền"],
    });
    const withSystem = buildCsvExport({
      check: cash,
      rows: [sheetRowDto(cash.id, 0, cells, result)],
      locale: "vi",
    });
    const [header, row] = lines(withSystem.content);
    expect(header?.endsWith(",Hệ thống")).toBe(true);
    expect(row?.endsWith(",Phiếu thu 2026-08-15 25000000 VND")).toBe(true);

    // The same rows on a check whose permissions were stripped: no column at all.
    const stripped = sheetCheckDto({
      template: "incomingCash",
      requiredPermissions: [],
      headers: ["Ngày", "Khách", "Số tiền"],
    });
    const without = buildCsvExport({
      check: stripped,
      rows: [sheetRowDto(stripped.id, 0, cells, result)],
      locale: "vi",
    });
    expect(without.content).not.toContain("Hệ thống");
    expect(without.content).not.toContain("Phiếu thu 2026-08-15");
    expect(lines(without.content)[0]?.endsWith(",Phát hiện")).toBe(true);

    // A receivables check needs all three; a generic one any exercised money permission.
    expect(
      exportShowsSystemValues({
        template: "receivables",
        requiredPermissions: ["receivables.read", "invoices.read"],
      }),
    ).toBe(false);
    expect(
      exportShowsSystemValues({
        template: "receivables",
        requiredPermissions: [
          "receivables.read",
          "invoices.read",
          "payments.read",
        ],
      }),
    ).toBe(true);
    expect(
      exportShowsSystemValues({
        template: "generic",
        requiredPermissions: ["orders.read", "orders.readSellingPrice"],
      }),
    ).toBe(true);
    expect(
      exportShowsSystemValues({
        template: "generic",
        requiredPermissions: ["orders.read", "customers.read"],
      }),
    ).toBe(false);
  });

  it("renders invoice, balance and selling-price views without any JS number", () => {
    const check = sheetCheckDto({
      template: "generic",
      requiredPermissions: [
        "orders.read",
        "orders.readSellingPrice",
        "invoices.read",
      ],
      headers: ["Mã đơn", "Hóa đơn", "Giá bán"],
    });
    const row = sheetRowDto(
      check.id,
      0,
      ["RD-0001", "INV-0001", "10.000,00"],
      rowResult({
        system: {
          order: {
            id: "o1",
            orderCode: "RD-0001",
            stage: "invoiced",
            customerName: "Công ty ABC",
            sellingPrice: money("10000.00", "USD"),
          },
          invoice: {
            id: "i1",
            invoiceNumber: "INV-0001",
            orderCode: "RD-0001",
            customerName: "Công ty ABC",
            amount: money("10000.00", "USD"),
            paid: money("4000.00", "USD"),
            depositApplied: money("0.00", "USD"),
            remaining: money("6000.00", "USD"),
            issuedDay: "2026-08-01",
            dueDay: "2026-08-31",
            status: "voided",
            voidReason: "sai",
          },
          balance: {
            customerId: "c1",
            customerName: "Công ty ABC",
            currency: "USD",
            invoiced: money("10000.00", "USD"),
            received: money("4000.00", "USD"),
            refunded: money("0.00", "USD"),
            outstanding: money("6000.00", "USD"),
            credit: money("0.00", "USD"),
            balance: money("6000.00", "USD"),
            overdueInvoiceCount: 0,
          },
        },
      }),
    );
    const [, line] = lines(
      buildCsvExport({ check, rows: [row], locale: "en" }).content,
    );
    expect(line).toBe(
      '2,Data,RD-0001,INV-0001,"10.000,00",Matched,,,"Invoice INV-0001 10000.00 USD, remaining 6000.00 USD (voided) | Balance 6000.00 USD (outstanding 6000.00 USD, advance 0.00 USD) | Selling price RD-0001 10000.00 USD"',
    );
  });

  it("builds an ASCII-only, sanitised file name from the template, the business day and the id tail", () => {
    const check = sheetCheckDto({
      id: "5f5f5f5f5f5f5f5f5f5fabcdef".slice(0, 24),
      template: "incomingCash",
      checkedAt: new Date("2026-09-05T17:30:00.000Z"),
    });
    expect(exportFileName(check, "Asia/Ho_Chi_Minh")).toBe(
      "kiem-tra-incomingCash-20260906-5fabcd.csv",
    );
    expect(exportFileName(check, "UTC")).toBe(
      "kiem-tra-incomingCash-20260905-5fabcd.csv",
    );
    const odd = sheetCheckDto({
      id: "ab/cd eé../.. zz",
      template: "generic",
      checkedAt: null,
      createdAt: sheetCheckNow,
    });
    const name = exportFileName(odd, "UTC");
    expect(name).toMatch(/^kiem-tra-generic-20260906-[A-Za-z0-9-]{6}\.csv$/);
    // The id tail "/.. zz" becomes "----zz" after the separator dash.
    expect(name).toBe("kiem-tra-generic-20260906-----zz.csv");
    const file = buildCsvExport({
      check: odd,
      rows: [],
      locale: "vi",
      timeZone: "Asia/Ho_Chi_Minh",
    });
    expect(file.fileName).toBe("kiem-tra-generic-20260906-----zz.csv");
  });
});
