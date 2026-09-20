import { describe, expect, it } from "vitest";

import type { ApprovalRequest } from "@/domains/approvals/contracts";
import {
  contractValue,
  deliversAfterOrderDue,
  directorDecisionState,
  exceedingLineCount,
  facilityContractLineInputSchema,
  generateFacilityContractCode,
  generateFacilityPaymentCode,
  lineExceedsPrevious,
  paymentNextActor,
  siteBalances,
  withPreviousPrices,
  type FacilityContractRecordDto,
} from "@/domains/facility-contracts/contracts";

const line = (
  productCode: string,
  unitPrice: string,
  quantity: string | null = "10",
) => ({
  id: productCode,
  productCode,
  description: "Hàng",
  quantity,
  unit: "cái",
  unitPrice,
  previousUnitPrice: null,
  previousContractCode: null,
});

const contract = (
  partial: Partial<FacilityContractRecordDto>,
): Pick<
  FacilityContractRecordDto,
  | "id"
  | "code"
  | "status"
  | "activatedAt"
  | "lines"
  | "facilityId"
  | "facilityCode"
  | "facilityName"
> => ({
  id: partial.id ?? "c1",
  code: partial.code ?? "HDCS-1",
  status: partial.status ?? "active",
  activatedAt: partial.activatedAt ?? new Date("2026-01-01T00:00:00Z"),
  lines: partial.lines ?? [],
  facilityId: partial.facilityId ?? "site-thai",
  facilityCode: partial.facilityCode ?? "Thai",
  facilityName: partial.facilityName ?? "Anh Thái",
});

describe("contract codes", () => {
  it("emits HDCS- and DNTT-YYYYMMDD-XXXX", () => {
    const now = new Date(2026, 8, 14, 12);
    expect(generateFacilityContractCode(now, () => 0)).toBe(
      "HDCS-20260914-AAAA",
    );
    expect(generateFacilityPaymentCode(now, () => 0)).toMatch(
      /^DNTT-20260914-[A-Z2-9]{4}$/,
    );
  });
});

describe("withPreviousPrices", () => {
  it("takes the price from the most recently activated other active contract, any site", () => {
    const active = [
      contract({
        id: "old",
        code: "HDCS-OLD",
        activatedAt: new Date("2026-01-01T00:00:00Z"),
        lines: [line("BOWL-01", "40000")],
      }),
      contract({
        id: "new",
        code: "HDCS-NEW",
        facilityId: "site-ha",
        activatedAt: new Date("2026-05-01T00:00:00Z"),
        lines: [line("bowl-01 ", "45000")],
      }),
      contract({
        id: "cancelled",
        code: "HDCS-X",
        status: "cancelled",
        activatedAt: new Date("2026-08-01T00:00:00Z"),
        lines: [line("BOWL-01", "99000")],
      }),
      contract({
        id: "self",
        code: "HDCS-SELF",
        activatedAt: new Date("2026-09-01T00:00:00Z"),
        lines: [line("BOWL-01", "10000")],
      }),
    ];

    const [bowl, vase] = withPreviousPrices(
      [
        {
          productCode: " Bowl-01",
          description: "Bát",
          quantity: "5",
          unit: "cái",
          unitPrice: "50000",
        },
        {
          productCode: "VASE-02",
          description: "Bình",
          quantity: null,
          unit: "cái",
          unitPrice: "70000",
        },
      ],
      active,
      "self",
    );

    expect(bowl?.previousUnitPrice).toBe("45000");
    expect(bowl?.previousContractCode).toBe("HDCS-NEW");
    expect(vase?.previousUnitPrice).toBeNull();
    expect(vase?.previousContractCode).toBeNull();
  });
});

describe("lineExceedsPrevious", () => {
  it("is true only when a previous price exists and the new one is higher", () => {
    expect(
      lineExceedsPrevious({ unitPrice: "50000", previousUnitPrice: null }),
    ).toBe(false);
    expect(
      lineExceedsPrevious({ unitPrice: "50000", previousUnitPrice: "50000" }),
    ).toBe(false);
    expect(
      lineExceedsPrevious({ unitPrice: "49999", previousUnitPrice: "50000" }),
    ).toBe(false);
    expect(
      lineExceedsPrevious({ unitPrice: "100000", previousUnitPrice: "99999" }),
    ).toBe(true);
    expect(
      exceedingLineCount([
        { unitPrice: "2", previousUnitPrice: "1" },
        { unitPrice: "1", previousUnitPrice: "2" },
        { unitPrice: "3", previousUnitPrice: "1" },
      ]),
    ).toBe(2);
  });
});

describe("contractValue", () => {
  it("sums quantity × price in VND and rounds once", () => {
    expect(
      contractValue([line("A", "50000", "100"), line("B", "12345", "2.5")]),
    ).toEqual({ amount: "5030863", currency: "VND" });
  });

  it("is unknown when any line has no quantity", () => {
    expect(
      contractValue([line("A", "50000", "1"), line("B", "1", null)]),
    ).toBeNull();
    expect(contractValue([])).toBeNull();
  });
});

describe("line input", () => {
  it("accepts separators in a VND price and a blank quantity", () => {
    const parsed = facilityContractLineInputSchema.parse({
      productCode: "A",
      description: "Bát",
      quantity: "",
      unit: "",
      unitPrice: "1.200.000",
    });
    expect(parsed).toMatchObject({
      quantity: null,
      unit: "cái",
      unitPrice: "1200000",
    });
    expect(() =>
      facilityContractLineInputSchema.parse({
        productCode: "A",
        description: "Bát",
        unitPrice: "0",
      }),
    ).toThrow();
  });
});

describe("deliversAfterOrderDue", () => {
  it("warns only when the order has a due date and the contract delivers later", () => {
    const deliveryDate = new Date("2026-10-15T00:00:00Z");
    expect(deliversAfterOrderDue({ deliveryDate }, null)).toBe(false);
    expect(
      deliversAfterOrderDue({ deliveryDate }, new Date("2026-10-15T00:00:00Z")),
    ).toBe(false);
    expect(
      deliversAfterOrderDue({ deliveryDate }, new Date("2026-10-10T00:00:00Z")),
    ).toBe(true);
  });
});

describe("directorDecisionState", () => {
  const request = (partial: Partial<ApprovalRequest>): ApprovalRequest => ({
    id: "r",
    subject: "facilityPayment.approval",
    resourceType: "facilityPayment",
    resourceId: "p",
    businessUnitIds: [],
    status: "pending",
    requestedByUserId: "u",
    requestedAt: new Date(),
    summary: "",
    decidedByUserId: null,
    decidedAt: null,
    decisionReason: null,
    expectedRevision: 2,
    ...partial,
  });

  it("reads pending, stale, approved and rejected", () => {
    expect(
      directorDecisionState(
        { pending: null, approved: null, latestDecided: null },
        2,
      ),
    ).toEqual({ kind: "none" });
    expect(
      directorDecisionState(
        { pending: request({}), approved: null, latestDecided: null },
        2,
      ).kind,
    ).toBe("pending");
    expect(
      directorDecisionState(
        { pending: request({}), approved: null, latestDecided: null },
        3,
      ).kind,
    ).toBe("pendingStale");
    const approved = request({ status: "approved" });
    expect(
      directorDecisionState(
        { pending: null, approved, latestDecided: approved },
        2,
      ).kind,
    ).toBe("approved");
    expect(
      directorDecisionState(
        { pending: null, approved, latestDecided: approved },
        3,
      ).kind,
    ).toBe("stale");
    const rejected = request({ status: "rejected", decisionReason: "Giá cao" });
    expect(
      directorDecisionState(
        { pending: null, approved: null, latestDecided: rejected },
        2,
      ),
    ).toMatchObject({ kind: "rejected", reason: "Giá cao" });
  });
});

describe("paymentNextActor", () => {
  it("names who acts next", () => {
    expect(paymentNextActor("proposed")).toBe("factoryAccountantCheck");
    expect(paymentNextActor("checked")).toBe("companyAccountantApprove");
    expect(paymentNextActor("accountantApproved")).toBe("directorThenPay");
    expect(paymentNextActor("paid")).toBeNull();
    expect(paymentNextActor("rejected")).toBeNull();
  });
});

describe("siteBalances", () => {
  it("totals known value, unknown contracts, paid, approved-unpaid and remaining per site", () => {
    const balances = siteBalances(
      [
        { ...contract({ lines: [line("A", "1000", "10")] }) },
        { ...contract({ lines: [line("B", "500", "4")] }) },
        { ...contract({ lines: [line("C", "500", null)] }) },
        { ...contract({ status: "draft", lines: [line("D", "999", "9")] }) },
        {
          ...contract({
            facilityId: "site-ha",
            facilityCode: "Ha",
            facilityName: "Chị Hà",
            lines: [line("E", "100", "1")],
          }),
        },
      ],
      [
        {
          facilityId: "site-thai",
          facilityName: "Anh Thái",
          status: "paid",
          amount: "3000",
        },
        {
          facilityId: "site-thai",
          facilityName: "Anh Thái",
          status: "accountantApproved",
          amount: "2000",
        },
        {
          facilityId: "site-thai",
          facilityName: "Anh Thái",
          status: "proposed",
          amount: "700",
        },
        {
          facilityId: "site-thai",
          facilityName: "Anh Thái",
          status: "rejected",
          amount: "900",
        },
      ],
    );

    expect(balances.map(({ facilityName }) => facilityName)).toEqual([
      "Anh Thái",
      "Chị Hà",
    ]);
    expect(balances[0]).toMatchObject({
      activeContracts: 3,
      unknownValueContracts: 1,
      knownValue: { amount: "12000" },
      paid: { amount: "3000" },
      approvedUnpaid: { amount: "2000" },
      remaining: { amount: "9000" },
    });
    expect(balances[1]).toMatchObject({
      activeContracts: 1,
      knownValue: { amount: "100" },
      paid: { amount: "0" },
      remaining: { amount: "100" },
    });
  });
});
