import { describe, expect, it } from "vitest";
import {
  buildLedger,
  catalogueItemInputSchema,
  classifyReduction,
  compareEntries,
  computeBalance,
  contributionOf,
  debtStateOf,
  entryUpdateSchema,
  formatMoney,
  hasActivity,
  lineAmount,
  roleOfType,
  saleBatchInputSchema,
  summaryKpis,
  sumTotals,
  type EntryRole,
  type EntryStatus,
  type EntryType,
  type ReceivableEntry,
  type SummaryRow,
} from "@/domains/receivables/contracts";

/**
 * The debt arithmetic, checked with the same plain numbers the accountant would
 * use on paper: Dư cuối = Dư đầu + Phát sinh tăng − Phát sinh giảm.
 */

let sequence = 0;
function entry(
  role: EntryRole,
  amount: string,
  entryDate: string,
  overrides: Partial<ReceivableEntry> = {},
): ReceivableEntry {
  sequence += 1;
  const type: EntryType =
    role === "OPENING"
      ? "OPENING_BALANCE"
      : role === "DEBIT"
        ? "SALE"
        : "PAYMENT";
  return {
    id: `entry-${sequence}`,
    version: 1,
    customerId: "cus-1",
    customerCode: "Nha",
    customerName: "Nguyễn Ngọc Nha",
    customerPhone: "",
    entryDate,
    role,
    type,
    status: "POSTED" as EntryStatus,
    amount,
    documentNumber: "",
    description: "",
    note: "",
    legacyDescription: "",
    itemCode: "",
    itemName: "",
    unit: "",
    quantity: null,
    unitPrice: null,
    referenceType: "MANUAL",
    referenceId: null,
    referenceNumber: "",
    sequence,
    batchId: null,
    periodYear: null,
    sourceType: "WEB",
    migrationSource: null,
    migrationSheet: null,
    sourceRow: null,
    issues: [],
    postedAt: null,
    postedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "tester",
    updatedBy: "tester",
    ...overrides,
  };
}

describe("computeBalance", () => {
  it("closes at opening + increase − decrease", () => {
    const balance = computeBalance([
      entry("OPENING", "1000000", "2026-01-02"),
      entry("DEBIT", "3000000", "2026-03-01"),
      entry("CREDIT", "2500000", "2026-03-20"),
    ]);
    expect(balance).toMatchObject({
      opening: "1000000",
      increase: "3000000",
      decrease: "2500000",
      closing: "1500000",
    });
  });

  it("adds several sales into one increase", () => {
    const balance = computeBalance([
      entry("DEBIT", "100000", "2026-02-01"),
      entry("DEBIT", "200000", "2026-02-02"),
      entry("DEBIT", "300000", "2026-02-03"),
    ]);
    expect(balance.increase).toBe("600000");
    expect(balance.closing).toBe("600000");
  });

  it("adds several kinds of reduction into one decrease", () => {
    const balance = computeBalance([
      entry("OPENING", "1000000", "2026-01-02"),
      entry("CREDIT", "300000", "2026-02-01", { type: "PAYMENT" }),
      entry("CREDIT", "100000", "2026-02-02", { type: "PAINT_OFFSET" }),
    ]);
    expect(balance.decrease).toBe("400000");
    expect(balance.closing).toBe("600000");
  });

  it("treats a sales return as a reduction", () => {
    const balance = computeBalance([
      entry("OPENING", "2000000", "2026-01-02"),
      entry("CREDIT", "500000", "2026-04-01", { type: "SALES_RETURN" }),
    ]);
    expect(balance.closing).toBe("1500000");
  });

  it("carries the opening balance through a filtered period", () => {
    const entries = [
      entry("OPENING", "400000", "2026-01-02"),
      entry("DEBIT", "800000", "2026-05-01"),
      entry("CREDIT", "200000", "2026-06-01"),
      entry("DEBIT", "500000", "2026-08-10"),
      entry("CREDIT", "300000", "2026-08-20"),
      entry("DEBIT", "999999", "2026-09-15"),
    ];
    const balance = computeBalance(entries, {
      from: "2026-08-01",
      to: "2026-08-31",
    });
    // Everything before 01/08 folds into the opening figure, so nothing is lost.
    expect(balance).toMatchObject({
      opening: "1000000",
      increase: "500000",
      decrease: "300000",
      closing: "1200000",
    });
  });

  it("answers 'công nợ đến ngày' by ignoring later entries", () => {
    const entries = [
      entry("OPENING", "100000", "2026-01-02"),
      entry("DEBIT", "50000", "2026-08-31"),
      entry("DEBIT", "70000", "2026-09-08"),
    ];
    expect(computeBalance(entries, { to: "2026-08-31" }).closing).toBe(
      "150000",
    );
    expect(computeBalance(entries, { to: "2026-09-08" }).closing).toBe(
      "220000",
    );
  });

  it("never lets a date window drop the opening balance", () => {
    // The opening entry is dated 02/01/2026 ("Dư đầu ngày 02/01/2026"), but it
    // is the period's starting point, not a transaction inside it. Asking for
    // the debt as of 01/01/2026 must answer "95.350", not "0".
    const entries = [
      entry("OPENING", "95350", "2026-01-02"),
      entry("DEBIT", "37802000", "2026-03-01"),
    ];
    expect(computeBalance(entries, { to: "2026-01-01" })).toMatchObject({
      opening: "95350",
      increase: "0",
      closing: "95350",
    });
    // And a window that starts after it still carries it in.
    expect(computeBalance(entries, { from: "2026-06-01" }).opening).toBe(
      "37897350",
    );
  });

  it("ignores draft and cancelled entries", () => {
    const balance = computeBalance([
      entry("OPENING", "1000000", "2026-01-02"),
      entry("CREDIT", "500000", "2026-02-01", { status: "DRAFT" }),
      entry("CREDIT", "500000", "2026-02-02", { status: "CANCELLED" }),
    ]);
    expect(balance.closing).toBe("1000000");
    expect(balance.decrease).toBe("0");
  });

  it("restores the balance when a posted payment is cancelled", () => {
    const opening = entry("OPENING", "1000000", "2026-01-02");
    const payment = entry("CREDIT", "500000", "2026-02-01");
    expect(computeBalance([opening, payment]).closing).toBe("500000");
    expect(
      computeBalance([opening, { ...payment, status: "CANCELLED" }]).closing,
    ).toBe("1000000");
  });

  it("keeps a negative opening balance, as the source workbook has one", () => {
    // `QuyetBK` really does open at −250: money the company holds for them.
    const balance = computeBalance([entry("OPENING", "-250", "2026-01-02")]);
    expect(balance.closing).toBe("-250");
    expect(debtStateOf(balance.closing)).toBe("PREPAID");
  });

  it("lets an overpayment go negative rather than rejecting it", () => {
    const balance = computeBalance([
      entry("DEBIT", "300000", "2026-02-01"),
      entry("CREDIT", "500000", "2026-02-02"),
    ]);
    expect(balance.closing).toBe("-200000");
    expect(debtStateOf(balance.closing)).toBe("PREPAID");
  });

  it("keeps exact decimals where a float would drift", () => {
    const balance = computeBalance([
      entry("DEBIT", "491999.99", "2026-02-01"),
      entry("DEBIT", "0.01", "2026-02-02"),
    ]);
    expect(balance.increase).toBe("492000");
  });
});

describe("buildLedger", () => {
  it("runs the balance forward in a stable order", () => {
    const lines = buildLedger(
      [
        entry("DEBIT", "360000", "2026-01-02"),
        entry("CREDIT", "200000", "2026-01-06"),
        entry("DEBIT", "45000", "2026-01-02"),
      ],
      "0",
    );
    expect(lines.map((line) => line.balance)).toEqual([
      "360000",
      "405000",
      "205000",
    ]);
    expect(lines[0]?.increase).toBe("360000");
    expect(lines[0]?.decrease).toBeNull();
    expect(lines[2]?.decrease).toBe("200000");
  });

  it("starts from the balance carried in", () => {
    const lines = buildLedger([entry("DEBIT", "100", "2026-02-01")], "5000");
    expect(lines[0]?.balance).toBe("5100");
  });

  it("lists a cancelled line without moving the balance", () => {
    const lines = buildLedger(
      [
        entry("DEBIT", "100000", "2026-02-01"),
        entry("CREDIT", "50000", "2026-02-02", { status: "CANCELLED" }),
      ],
      "0",
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]?.balance).toBe("100000");
    expect(lines[1]?.decrease).toBeNull();
  });

  it("orders by date, then sequence, then id", () => {
    const left = { entryDate: "2026-01-02", sequence: 2, id: "b" };
    const right = { entryDate: "2026-01-02", sequence: 2, id: "c" };
    expect(compareEntries(left, right)).toBeLessThan(0);
    expect(
      compareEntries({ ...left, entryDate: "2026-01-03" }, right),
    ).toBeGreaterThan(0);
    expect(compareEntries({ ...left, sequence: 1 }, right)).toBeLessThan(0);
  });
});

describe("contributionOf", () => {
  it("signs each role the way the report reads it", () => {
    expect(
      contributionOf({
        role: "DEBIT",
        status: "POSTED",
        amount: "10",
      }).toFixed(),
    ).toBe("10");
    expect(
      contributionOf({
        role: "CREDIT",
        status: "POSTED",
        amount: "10",
      }).toFixed(),
    ).toBe("-10");
    expect(
      contributionOf({
        role: "OPENING",
        status: "POSTED",
        amount: "-250",
      }).toFixed(),
    ).toBe("-250");
    expect(
      contributionOf({
        role: "DEBIT",
        status: "DRAFT",
        amount: "10",
      }).toFixed(),
    ).toBe("0");
  });
});

describe("lineAmount", () => {
  it("is quantity × unit price, exactly", () => {
    expect(lineAmount("0.3", "150000")).toBe("45000");
    expect(lineAmount("3", "120000")).toBe("360000");
    expect(lineAmount("4.1", "120000")).toBe("492000");
    expect(lineAmount("0.05", "800000")).toBe("40000");
  });

  it("is unknown when either side is missing", () => {
    expect(lineAmount(null, "150000")).toBeNull();
    expect(lineAmount("2", null)).toBeNull();
  });
});

describe("classifyReduction", () => {
  it.each([
    ["thanh toán", "PAYMENT"],
    ["Trừ tiền sơn", "PAINT_OFFSET"],
    ["trừ tiền sơn", "PAINT_OFFSET"],
    ["Trừ tiền gỗ", "MATERIAL_OFFSET"],
    ["Trả lại sơn nhũ vàng", "SALES_RETURN"],
    ["trả lại sơn nhũ trắng", "SALES_RETURN"],
    ["Trả sơn nhũ vàng", "SALES_RETURN"],
    ["Trả lại sơn bóng thường", "SALES_RETURN"],
  ])("maps %s to %s", (description, expected) => {
    expect(classifyReduction(description)).toEqual({
      type: expected,
      mapped: true,
    });
  });

  it("refuses to guess an unclear description", () => {
    // The one description in the source nobody could vouch for.
    expect(classifyReduction("TT toát nc 2 khay Kim")).toEqual({
      type: "OTHER_OFFSET",
      mapped: false,
    });
  });
});

describe("roleOfType", () => {
  it("keeps a sale a debit and every settlement a credit", () => {
    expect(roleOfType.SALE).toEqual(["DEBIT"]);
    for (const type of [
      "PAYMENT",
      "PAINT_OFFSET",
      "MATERIAL_OFFSET",
      "SALES_RETURN",
      "OTHER_OFFSET",
    ] as const)
      expect(roleOfType[type]).toEqual(["CREDIT"]);
    expect(roleOfType.OPENING_BALANCE).toEqual(["OPENING"]);
  });
});

describe("totals and KPIs", () => {
  const rows = [
    {
      stt: 1,
      customerId: "a",
      code: "Nha",
      name: "",
      phone: "",
      note: "",
      active: true,
      opening: "95350",
      increase: "37802000",
      decrease: "32863500",
      closing: "5033850",
      state: debtStateOf("5033850"),
      entryCount: 3,
      hasOpening: true,
    },
    {
      stt: 2,
      customerId: "b",
      code: "QuyetBK",
      name: "",
      phone: "",
      note: "",
      active: true,
      opening: "-250",
      increase: "0",
      decrease: "0",
      closing: "-250",
      state: debtStateOf("-250"),
      entryCount: 0,
      hasOpening: true,
    },
    {
      stt: 3,
      customerId: "c",
      code: "Tai",
      name: "",
      phone: "",
      note: "",
      active: true,
      opening: "11200000",
      increase: "23300000",
      decrease: "34500000",
      closing: "0",
      state: debtStateOf("0"),
      entryCount: 2,
      hasOpening: true,
    },
  ];

  it("totals every column and closes on the same identity", () => {
    expect(sumTotals(rows)).toEqual({
      opening: "11295100",
      increase: "61102000",
      decrease: "67363500",
      closing: "5033600",
    });
  });

  it("counts owing, settled and prepaid separately", () => {
    expect(summaryKpis(rows)).toMatchObject({
      customers: 3,
      owing: 1,
      settled: 1,
      prepaid: 1,
      outstanding: "5033850",
      prepaidAmount: "250",
    });
  });
});

describe("saleBatchInputSchema", () => {
  const base = {
    customerId: "cus-1",
    entryDate: "2026-09-10",
    lines: [
      { id: "l1", itemCode: "952A1", quantity: "3", unitPrice: "120000" },
      { id: "l2", itemCode: "xang1", quantity: "20", unitPrice: "48000" },
    ],
  };

  it("accepts one customer buying several items at once", () => {
    const parsed = saleBatchInputSchema.parse(base);
    expect(parsed.lines).toHaveLength(2);
    // Posting is the counter default; a draft is the deliberate choice.
    expect(parsed.post).toBe(true);
    expect(parsed.lines[0]?.description).toBe("xuất kho");
  });

  it("refuses an empty purchase", () => {
    expect(() => saleBatchInputSchema.parse({ ...base, lines: [] })).toThrow();
  });

  it("refuses a line with no item code, a zero quantity or an unknown field", () => {
    const bad = (line: Record<string, unknown>) =>
      saleBatchInputSchema.parse({ ...base, lines: [{ id: "l1", ...line }] });
    expect(() =>
      bad({ itemCode: "", quantity: "1", unitPrice: "1" }),
    ).toThrow();
    expect(() =>
      bad({ itemCode: "a", quantity: "0", unitPrice: "1" }),
    ).toThrow();
    expect(() =>
      bad({ itemCode: "a", quantity: "1", unitPrice: "1", amount: "999" }),
    ).toThrow();
  });

  it("never accepts a line total — the server multiplies", () => {
    // A typed total is exactly how a book stops adding up.
    expect(
      Object.keys(saleBatchInputSchema.parse(base).lines[0]!),
    ).not.toContain("amount");
  });
});

describe("entryUpdateSchema", () => {
  it("takes only the fields that changed", () => {
    const parsed = entryUpdateSchema.parse({
      id: "e1",
      version: 3,
      patch: { amount: "500000" },
      reason: "gõ nhầm số tiền",
    });
    expect(parsed.patch).toEqual({ amount: "500000" });
    expect(parsed.reason).toBe("gõ nhầm số tiền");
  });

  it("carries a version so two people cannot overwrite each other", () => {
    expect(() =>
      entryUpdateSchema.parse({ id: "e1", patch: { amount: "1" } }),
    ).toThrow();
  });

  it("refuses a field that is not editable", () => {
    expect(() =>
      entryUpdateSchema.parse({
        id: "e1",
        version: 1,
        patch: { status: "CANCELLED" },
      }),
    ).toThrow();
    expect(() =>
      entryUpdateSchema.parse({
        id: "e1",
        version: 1,
        patch: { customerCode: "Nha" },
      }),
    ).toThrow();
  });

  it("lets a reduction change type but keeps roles apart", () => {
    // The schema allows any type; the service refuses a cross-role change,
    // which is what stops a payment becoming a sale.
    expect(
      entryUpdateSchema.parse({
        id: "e1",
        version: 1,
        patch: { type: "PAINT_OFFSET" },
      }).patch.type,
    ).toBe("PAINT_OFFSET");
    expect(roleOfType.PAYMENT).toEqual(["CREDIT"]);
    expect(roleOfType.SALE).toEqual(["DEBIT"]);
  });
});

describe("catalogueItemInputSchema", () => {
  it("adds a new paint code with a price", () => {
    expect(
      catalogueItemInputSchema.parse({
        code: "SonPha9999",
        name: "Sơn pha 9999",
        unit: "Kg",
        salePrice: "175000",
      }),
    ).toEqual({
      code: "SonPha9999",
      name: "Sơn pha 9999",
      unit: "Kg",
      salePrice: "175000",
    });
  });

  it("allows a code with no price yet", () => {
    const parsed = catalogueItemInputSchema.parse({ code: "MoiTinh" });
    expect(parsed.salePrice).toBeNull();
    expect(parsed.unit).toBe("");
  });

  it("refuses an empty code", () => {
    expect(() => catalogueItemInputSchema.parse({ code: "  " })).toThrow();
  });
});

describe("hasActivity", () => {
  const row = (over: Partial<SummaryRow>): SummaryRow => ({
    stt: 1,
    customerId: "c",
    code: "X",
    name: "",
    phone: "",
    note: "",
    active: true,
    opening: "0",
    increase: "0",
    decrease: "0",
    closing: "0",
    state: debtStateOf("0"),
    entryCount: 0,
    hasOpening: false,
    ...over,
  });

  it("keeps an all-zero customer that the report lists", () => {
    // Fifteen of the fifty rows in `TongHopCongNo` are entirely zero. The
    // accountant put them there; dropping them would shorten the report the
    // client reconciles against.
    expect(hasActivity(row({ hasOpening: true }))).toBe(true);
  });

  it("keeps anyone with a balance or a movement", () => {
    expect(hasActivity(row({ opening: "-250", closing: "-250" }))).toBe(true);
    expect(hasActivity(row({ entryCount: 1 }))).toBe(true);
    expect(hasActivity(row({ closing: "5033850" }))).toBe(true);
  });

  it("drops a partner who has never opened a balance or traded", () => {
    // 75 of the 125 codes in `MaNhaCungCap` are in this state.
    expect(hasActivity(row({}))).toBe(false);
  });
});

describe("formatMoney", () => {
  it("groups with dots, the way the workbook prints", () => {
    expect(formatMoney("5033850")).toBe("5.033.850");
    expect(formatMoney("-250")).toBe("-250");
    expect(formatMoney("1019322500")).toBe("1.019.322.500");
    expect(formatMoney("")).toBe("");
  });
});
