import { describe, expect, it } from "vitest";
import {
  applyDraft,
  confirmProblems,
  describeChanges,
  duplicateCodes,
  emptySlip,
  excelTimestamp,
  formatQuantity,
  formatVnd,
  internalNumberFor,
  mentionsMoney,
  multiply,
  parsePastedLines,
  redactPrices,
  slipDateLabel,
  transitionSchema,
  type DraftInput,
  type Masters,
  type SalesSlip,
} from "@/domains/sales-slips/contracts";
import { buildSlipSheet } from "@/domains/sales-slips/sheet";
import { printScale } from "@/domains/sales-slips/layout";

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
      name: "Hộp nhựa to",
      unit: "Hộp",
      salePrice: "15000",
    },
    {
      id: "i3",
      code: "Tm.vangnguyenla",
      name: "Tinh màu vàng nguyên lá",
      unit: "Kg",
      salePrice: "800000",
    },
    {
      id: "i4",
      code: "NoPrice",
      name: "Chưa có giá",
      unit: "Kg",
      salePrice: null,
    },
  ],
  recipients: [
    { id: "r1", code: "Thanh", name: "Chị Thanh" },
    { id: "r2", code: "Tuan", name: "Đỗ Mạnh Tuấn" },
  ],
};

const draft = (
  lines: DraftInput["lines"],
  extra: Partial<DraftInput> = {},
): DraftInput => ({
  slipDate: "2026-09-08",
  recipientCode: "",
  recipientName: "ĐỖ THỊ THANH",
  recipientUnit: "",
  content: "",
  note: "",
  lines,
  ...extra,
});
const base = () => emptySlip("slip-1", "2026-09-08", "actor");
const allowPrice = { canEditPrice: true };
const noPrice = { canEditPrice: false };

describe("sales slip arithmetic", () => {
  it.each([
    ["5", "170000", "850000"],
    ["0.05", "800000", "40000"],
    ["2.5", "170000", "425000"],
    ["0.5", "170000", "85000"],
    ["5", "160000", "800000"],
    ["0.1", "0.2", "0.02"],
  ])("multiplies %s × %s exactly", (quantity, price, expected) => {
    expect(multiply(quantity, price)).toBe(expected);
  });

  it("fills name, unit and the catalogue price when a code is chosen (C.Thanh (2))", () => {
    const slip = applyDraft(
      base(),
      draft([
        { id: "l1", itemCode: "SONPHA7505c-PT", quantity: "5" },
        { id: "l2", itemCode: "hopnhuato", quantity: "1" },
      ]),
      masters,
      noPrice,
    );
    expect(slip.lines).toHaveLength(2);
    expect(slip.lines[0]).toMatchObject({
      lineNumber: 1,
      itemId: "i1",
      itemCode: "sonpha7505C-pt",
      itemName: "Sơn pha 7505c-pt",
      unit: "Kg",
      unitPrice: "170000",
      lineAmount: "850000",
      priceManual: false,
    });
    expect(slip.lines[1]).toMatchObject({ lineAmount: "15000", unit: "Hộp" });
    expect(slip.subtotal).toBe("865000");
    expect(slip.totalPayment).toBe("865000");
    expect(slip.totalInWords).toBe("Tám trăm sáu mươi lăm nghìn đồng");
  });

  it("drops empty rows, keeps the order and renumbers", () => {
    const slip = applyDraft(
      base(),
      draft([
        { id: "a", itemCode: "", quantity: null },
        { id: "b", itemCode: "Hopnhuato", quantity: "2" },
        { id: "c", itemCode: "", quantity: null },
      ]),
      masters,
      noPrice,
    );
    expect(slip.lines.map((line) => [line.id, line.lineNumber])).toEqual([
      ["b", 1],
    ]);
  });
});

describe("price snapshot", () => {
  it("keeps the price written on the slip when the catalogue changes later", () => {
    const saved = applyDraft(
      base(),
      draft([{ id: "l1", itemCode: "sonpha7505C-pt", quantity: "5" }]),
      masters,
      noPrice,
    );
    const repriced: Masters = {
      ...masters,
      items: masters.items.map((item) => ({ ...item, salePrice: "180000" })),
    };
    const later = applyDraft(
      saved,
      draft([{ id: "l1", itemCode: "sonpha7505C-pt", quantity: "6" }]),
      repriced,
      noPrice,
    );
    expect(later.lines[0]?.unitPrice).toBe("170000");
    expect(later.lines[0]?.lineAmount).toBe("1020000");
    const recoded = applyDraft(
      saved,
      draft([{ id: "l1", itemCode: "Hopnhuato", quantity: "6" }]),
      repriced,
      noPrice,
    );
    expect(recoded.lines[0]?.unitPrice).toBe("180000");
  });

  it("only a price holder may change the price; equal prices are not a change", () => {
    const input = draft([
      {
        id: "l1",
        itemCode: "sonpha7505C-pt",
        quantity: "5",
        unitPrice: "160000",
      },
    ]);
    expect(() => applyDraft(base(), input, masters, noPrice)).toThrow(
      /không có quyền sửa đơn giá/,
    );
    const same = draft([
      {
        id: "l1",
        itemCode: "sonpha7505C-pt",
        quantity: "5",
        unitPrice: "170000.00",
      },
    ]);
    expect(
      applyDraft(base(), same, masters, noPrice).lines[0]?.priceManual,
    ).toBe(false);
    const edited = applyDraft(base(), input, masters, allowPrice);
    expect(edited.lines[0]).toMatchObject({
      unitPrice: "160000",
      lineAmount: "800000",
      priceManual: true,
    });
    expect(describeChanges(base(), edited)).toContain(
      "Thêm mặt hàng sonpha7505C-pt × 5 @ 160,000",
    );
  });

  it("describes a price change from one snapshot to another", () => {
    const before = applyDraft(
      base(),
      draft([{ id: "l1", itemCode: "sonpha7505C-pt", quantity: "5" }]),
      masters,
      noPrice,
    );
    const after = applyDraft(
      before,
      draft([
        {
          id: "l1",
          itemCode: "sonpha7505C-pt",
          quantity: "5",
          unitPrice: "160000",
        },
      ]),
      masters,
      allowPrice,
    );
    const changes = describeChanges(before, after);
    expect(changes).toContain("Đơn giá sonpha7505C-pt: 170,000 → 160,000");
    expect(changes).toContain("Tổng tiền: 850,000 → 800,000");
    expect(changes.filter(mentionsMoney)).toHaveLength(2);
  });
});

describe("confirm validation", () => {
  it("lists every reason a draft cannot be confirmed", () => {
    const slip = applyDraft(
      base(),
      draft(
        [
          { id: "l1", itemCode: "unknown-code", quantity: "1" },
          { id: "l2", itemCode: "sonpha7505C-pt", quantity: "0" },
          { id: "l3", itemCode: "NoPrice", quantity: "1" },
        ],
        { recipientName: "" },
      ),
      masters,
      noPrice,
    );
    const problems = confirmProblems(slip);
    expect(problems).toContain("Chưa nhập người nhận hàng.");
    expect(
      problems.some((p) =>
        p.includes("'unknown-code' không có trong danh mục"),
      ),
    ).toBe(true);
    expect(
      problems.some((p) => p.startsWith("Dòng 2") && p.includes("lớn hơn 0")),
    ).toBe(true);
    expect(
      problems.some(
        (p) => p.startsWith("Dòng 3") && p.includes("chưa có đơn giá"),
      ),
    ).toBe(true);
    expect(confirmProblems(base())).toContain("Phiếu chưa có mặt hàng nào.");
  });

  it("accepts a complete draft and warns on duplicates without merging", () => {
    const slip = applyDraft(
      base(),
      draft([
        { id: "l1", itemCode: "sonpha7505C-pt", quantity: "5" },
        { id: "l2", itemCode: "SONPHA7505C-PT", quantity: "1" },
      ]),
      masters,
      noPrice,
    );
    expect(confirmProblems(slip)).toEqual([]);
    expect(slip.lines).toHaveLength(2);
    expect(duplicateCodes(slip.lines)).toEqual(["sonpha7505C-pt"]);
  });

  it("rejects negative and malformed quantities at the schema", () => {
    expect(() => parsePastedLines("Hopnhuato\t-1")).toThrow();
    expect(() => parsePastedLines("Hopnhuato\t0,3")).toThrow(/dấu chấm/);
    expect(
      parsePastedLines("Hopnhuato\t2\nsonpha7505C-pt\t0.05\t170,000"),
    ).toEqual([
      { itemCode: "Hopnhuato", quantity: "2", unitPrice: null },
      { itemCode: "sonpha7505C-pt", quantity: "0.05", unitPrice: "170000" },
    ]);
    expect(
      transitionSchema.safeParse({ action: "delete", version: 1 }).success,
    ).toBe(false);
  });
});

describe("recipients", () => {
  it("links a catalogue recipient by code and keeps a typed name otherwise", () => {
    const linked = applyDraft(
      base(),
      draft([], { recipientCode: "tuan", recipientName: "" }),
      masters,
      noPrice,
    );
    expect(linked).toMatchObject({
      recipientId: "r2",
      recipientCode: "Tuan",
      recipientName: "Đỗ Mạnh Tuấn",
    });
    const typed = applyDraft(
      base(),
      draft([], { recipientName: "NGÔ HUY SÁNG" }),
      masters,
      noPrice,
    );
    expect(typed).toMatchObject({
      recipientId: null,
      recipientCode: "",
      recipientName: "NGÔ HUY SÁNG",
    });
    expect(() =>
      applyDraft(
        base(),
        draft([], { recipientCode: "nobody" }),
        masters,
        noPrice,
      ),
    ).toThrow();
  });
});

describe("projection without readPrice", () => {
  it("strips every money field", () => {
    const slip = applyDraft(
      base(),
      draft([{ id: "l1", itemCode: "sonpha7505C-pt", quantity: "5" }]),
      masters,
      noPrice,
    );
    const redacted = redactPrices(slip);
    expect(redacted.pricesRedacted).toBe(true);
    expect(redacted.subtotal).toBeNull();
    expect(redacted.totalInWords).toBeNull();
    expect(redacted.lines[0]).toMatchObject({
      unitPrice: null,
      lineAmount: null,
      quantity: "5",
    });
    expect(JSON.stringify(redacted)).not.toContain("170000");
  });
});

describe("display helpers", () => {
  it("formats like the workbook", () => {
    expect(formatVnd("170000")).toBe("170,000");
    expect(formatVnd("10700000.4")).toBe("10,700,000");
    expect(formatQuantity("0.05")).toBe("0.05");
    expect(formatQuantity("2.5")).toBe("2.5");
    expect(formatQuantity("1234")).toBe("1,234");
    expect(slipDateLabel("2026-09-08")).toBe(
      "Ngày   08   Tháng   09    năm 2026",
    );
    expect(internalNumberFor("2026-09-08", 1)).toBe("PBH-20260908-001");
    expect(excelTimestamp("2026-09-08T10:00:11.910Z")).toBe("9/8/26 17:00");
  });

  it("lays the slip out on the template grid with the footer shifted per line", () => {
    const slip: SalesSlip = applyDraft(
      base(),
      draft([
        { id: "l1", itemCode: "sonpha7505C-pt", quantity: "5" },
        { id: "l2", itemCode: "Hopnhuato", quantity: "1" },
      ]),
      masters,
      noPrice,
    );
    const sheet = buildSlipSheet(slip);
    expect(sheet.lastRow).toBe(18);
    expect(sheet.rows.map((row) => row.templateRow)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11, 14, 15, 16, 17, 18, 19,
    ]);
    expect(sheet.merges).toContain("A13:F13");
    expect(sheet.merges).toContain("A14:F14");
    expect(sheet.merges).toContain("F18:G18");
    expect(sheet.merges).toContain("A5:G5");
    expect(sheet.merges).not.toContain("A15:F15");
    expect(sheet.merges).not.toContain("F19:G19");
    const total = sheet.rows[12]!.cells.find((cell) => cell.col === 6);
    expect(total).toMatchObject({ text: "865,000", raw: 865000, ref: "G14" });
    expect(sheet.rows[14]!.cells[0]?.text).toBe(
      "Bằng chữ : Tám trăm sáu mươi lăm nghìn đồng",
    );
    expect(sheet.rows[5]!.cells[0]).toMatchObject({
      span: 2,
      text: "Người nhận hàng:",
    });
    expect(sheet.rows[0]!.cells[0]?.text).toBe("CÔNG TY TNHH CỬA ĐỎ");
    expect(sheet.rows[3]!.cells[0]?.text).toBe("PHIẾU BÁN HÀNG");
    expect(printScale).toBeGreaterThan(0.8);
    expect(printScale).toBeLessThanOrEqual(1);
  });
});
