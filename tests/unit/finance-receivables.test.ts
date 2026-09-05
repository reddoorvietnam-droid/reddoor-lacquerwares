import { describe, expect, it } from "vitest";

import type {
  FinanceEntryRecordDto,
  InvoiceRecordDto,
  ReceiptAllocation,
} from "@/domains/finance/contracts";
import {
  computeReceivables,
  customerCredit,
  customerKeyOf,
  invoiceAllocationCapacity,
  type ReceivableOrder,
} from "@/domains/finance/receivables";
import type { Currency } from "@/lib/money";

/**
 * The receivables rules the company accountant confirmed on 2026-09-05,
 * checked with the same plain numbers she used: an order of 5 million,
 * a customer who pays 2 million, a due date that has passed.
 */

const actorId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const customerA = "c1c1c1c1c1c1c1c1c1c1c1c1";
const customerB = "c2c2c2c2c2c2c2c2c2c2c2c2";
const now = new Date("2026-09-05T09:00:00.000Z");
const past = new Date("2026-08-31T00:00:00.000Z");
const future = new Date("2026-09-30T00:00:00.000Z");

let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}${String(sequence).padStart(24 - prefix.length, "0")}`;
}

function order(
  partial: Partial<ReceivableOrder> & { customerId?: string | null },
): ReceivableOrder {
  return {
    id: partial.id ?? nextId("0"),
    orderCode: partial.orderCode ?? `RD-${sequence}`,
    customerId: partial.customerId === undefined ? customerA : partial.customerId,
    customerName: partial.customerName ?? "Khách A",
    stage: partial.stage ?? "invoiced",
  };
}

function invoice(
  partial: Omit<Partial<InvoiceRecordDto>, "amount"> & {
    orderId: string;
    amount: string;
    currency?: Currency;
  },
): InvoiceRecordDto {
  const currency = partial.currency ?? "VND";
  return {
    id: partial.id ?? nextId("1"),
    orderId: partial.orderId,
    orderCode: partial.orderCode ?? "RD-X",
    customerId: partial.customerId === undefined ? customerA : partial.customerId,
    customerName: partial.customerName ?? "Khách A",
    invoiceNumber: partial.invoiceNumber ?? `INV-${sequence}`,
    issuedAt: partial.issuedAt ?? past,
    dueAt: partial.dueAt ?? future,
    amount: { amount: partial.amount, currency },
    fxRateToVnd: partial.fxRateToVnd ?? null,
    note: null,
    documents: [],
    status: partial.status ?? "active",
    voidReason: null,
    businessUnitIds: [],
    createdBy: actorId,
    updatedBy: actorId,
    createdAt: past,
    updatedAt: past,
    revision: 0,
  };
}

function receipt(
  partial: Omit<Partial<FinanceEntryRecordDto>, "amount"> & {
    amount: string;
    currency?: Currency;
    allocations?: readonly ReceiptAllocation[];
  },
): FinanceEntryRecordDto {
  const currency = partial.currency ?? "VND";
  return {
    id: partial.id ?? nextId("2"),
    kind: partial.kind ?? "receipt",
    category: partial.category ?? "orderPayment",
    orderId: partial.orderId ?? null,
    orderCode: partial.orderCode ?? null,
    customerId: partial.customerId === undefined ? customerA : partial.customerId,
    supplierId: null,
    counterparty: partial.counterparty ?? "Khách A",
    amount: { amount: partial.amount, currency },
    method: "bankTransfer",
    occurredAt: partial.occurredAt ?? past,
    note: null,
    allocations: partial.allocations ?? [],
    fxRateToVnd: partial.fxRateToVnd ?? null,
    status: partial.status ?? "active",
    voidReason: null,
    businessUnitIds: [],
    createdBy: actorId,
    updatedBy: actorId,
    createdAt: past,
    updatedAt: past,
    revision: 0,
  };
}

function refund(
  partial: Omit<Partial<FinanceEntryRecordDto>, "amount"> & {
    amount: string;
    currency?: Currency;
  },
): FinanceEntryRecordDto {
  return receipt({ ...partial, kind: "expense", category: "refund" });
}

function toInvoice(
  target: InvoiceRecordDto,
  amount: string,
): ReceiptAllocation {
  return {
    target: "invoice",
    invoiceId: target.id,
    invoiceNumber: target.invoiceNumber,
    orderId: target.orderId,
    orderCode: target.orderCode,
    amount,
  };
}

function toOrder(target: ReceivableOrder, amount: string): ReceiptAllocation {
  return {
    target: "order",
    orderId: target.id,
    orderCode: target.orderCode,
    amount,
  };
}

const keyA = customerKeyOf(customerA, "Khách A");

describe("computeReceivables — the accountant's worked example", () => {
  it("order of 5 million, customer pays 2 million: 3 million remain and it is overdue past the due date", () => {
    const o = order({});
    const inv = invoice({ orderId: o.id, amount: "5000000", dueAt: past });
    const paid = receipt({ amount: "2000000", allocations: [toInvoice(inv, "2000000")] });

    const report = computeReceivables({
      orders: [o],
      invoices: [inv],
      receipts: [paid],
      refunds: [],
      now,
    });

    expect(report.invoices).toHaveLength(1);
    expect(report.invoices[0]?.paid.amount).toBe("2000000");
    expect(report.invoices[0]?.remaining.amount).toBe("3000000");
    expect(report.invoices[0]?.overdue).toBe(true);
    expect(report.totals.outstanding).toEqual([
      { amount: "3000000", currency: "VND" },
    ]);
    expect(report.totals.credit).toEqual([{ amount: "0", currency: "VND" }]);
    expect(report.totals.revenue).toEqual([
      { amount: "5000000", currency: "VND" },
    ]);
    expect(report.totals.overdueInvoiceCount).toBe(1);

    const customer = report.customers[0];
    expect(customer?.outstanding.amount).toBe("3000000");
    expect(customer?.balance.amount).toBe("3000000");
    expect(customer?.overdueInvoiceCount).toBe(1);
  });

  it("is not overdue while the due date is still ahead, and settled once fully paid", () => {
    const o = order({});
    const inv = invoice({ orderId: o.id, amount: "5000000", dueAt: future });
    const partial = receipt({ amount: "2000000", allocations: [toInvoice(inv, "2000000")] });
    const rest = receipt({ amount: "3000000", allocations: [toInvoice(inv, "3000000")] });

    const open = computeReceivables({
      orders: [o],
      invoices: [inv],
      receipts: [partial],
      refunds: [],
      now,
    });
    expect(open.invoices[0]?.overdue).toBe(false);

    const settled = computeReceivables({
      orders: [o],
      invoices: [inv],
      receipts: [partial, rest],
      refunds: [],
      now,
    });
    expect(settled.invoices[0]?.remaining.amount).toBe("0");
    expect(settled.invoices[0]?.overdue).toBe(false);
    expect(settled.totals.outstanding).toEqual([{ amount: "0", currency: "VND" }]);
  });
});

describe("computeReceivables — overpayment stays as customer credit", () => {
  it("keeps what an invoice did not consume as credit that offsets the next order", () => {
    const o = order({});
    const inv = invoice({ orderId: o.id, amount: "5000000" });
    // 7 million arrived; 5 million was applied to the invoice, 2 million left.
    const paid = receipt({ amount: "7000000", allocations: [toInvoice(inv, "5000000")] });

    const report = computeReceivables({
      orders: [o],
      invoices: [inv],
      receipts: [paid],
      refunds: [],
      now,
    });

    const customer = report.customers[0];
    expect(customer?.received.amount).toBe("7000000");
    expect(customer?.outstanding.amount).toBe("0");
    expect(customer?.credit.amount).toBe("2000000");
    expect(customer?.balance.amount).toBe("-2000000");
    expect(report.totals.credit).toEqual([{ amount: "2000000", currency: "VND" }]);
  });

  it("counts a wholly unallocated transfer as credit until it is applied", () => {
    const o = order({});
    const inv = invoice({ orderId: o.id, amount: "5000000", dueAt: past });
    const paid = receipt({ amount: "10000000" });

    const report = computeReceivables({
      orders: [o],
      invoices: [inv],
      receipts: [paid],
      refunds: [],
      now,
    });

    // The invoice is still formally open and overdue: the money has not
    // been told where to go yet.
    expect(report.invoices[0]?.remaining.amount).toBe("5000000");
    expect(report.invoices[0]?.overdue).toBe(true);
    const customer = report.customers[0];
    expect(customer?.outstanding.amount).toBe("5000000");
    expect(customer?.credit.amount).toBe("10000000");
    expect(customer?.balance.amount).toBe("-5000000");
  });
});

describe("computeReceivables — deposits per order, payments per invoice", () => {
  it("shows a deposit on an order without an invoice as credit and a negative order balance", () => {
    const o = order({ orderCode: "RD-DEP" });
    const deposit = receipt({
      amount: "1000000",
      orderId: o.id,
      orderCode: o.orderCode,
      allocations: [toOrder(o, "1000000")],
    });

    const report = computeReceivables({
      orders: [o],
      invoices: [],
      receipts: [deposit],
      refunds: [],
      now,
    });

    expect(report.orders).toHaveLength(1);
    expect(report.orders[0]?.deposits.amount).toBe("1000000");
    expect(report.orders[0]?.remaining.amount).toBe("-1000000");
    expect(report.customers[0]?.credit.amount).toBe("1000000");
    expect(report.customers[0]?.outstanding.amount).toBe("0");
  });

  it("applies the deposit to the invoice once it is issued", () => {
    const o = order({});
    const deposit = receipt({ amount: "1000000", allocations: [toOrder(o, "1000000")] });
    const inv = invoice({ orderId: o.id, amount: "5000000", dueAt: past });

    const report = computeReceivables({
      orders: [o],
      invoices: [inv],
      receipts: [deposit],
      refunds: [],
      now,
    });

    expect(report.invoices[0]?.depositApplied.amount).toBe("1000000");
    expect(report.invoices[0]?.remaining.amount).toBe("4000000");
    expect(report.invoices[0]?.overdue).toBe(true);
    expect(report.orders[0]?.remaining.amount).toBe("4000000");
    expect(report.customers[0]?.credit.amount).toBe("0");
    expect(report.customers[0]?.outstanding.amount).toBe("4000000");
  });

  it("applies a deposit to the earliest due invoice first and carries the rest forward", () => {
    const o = order({});
    const later = invoice({
      orderId: o.id,
      amount: "3000000",
      dueAt: future,
      invoiceNumber: "INV-LATER",
    });
    const earlier = invoice({
      orderId: o.id,
      amount: "2000000",
      dueAt: past,
      invoiceNumber: "INV-EARLIER",
    });
    const deposit = receipt({ amount: "2500000", allocations: [toOrder(o, "2500000")] });

    const report = computeReceivables({
      orders: [o],
      invoices: [later, earlier],
      receipts: [deposit],
      refunds: [],
      now,
    });

    const byNumber = new Map(
      report.invoices.map((row) => [row.invoice.invoiceNumber, row]),
    );
    expect(byNumber.get("INV-EARLIER")?.depositApplied.amount).toBe("2000000");
    expect(byNumber.get("INV-EARLIER")?.remaining.amount).toBe("0");
    expect(byNumber.get("INV-EARLIER")?.overdue).toBe(false);
    expect(byNumber.get("INV-LATER")?.depositApplied.amount).toBe("500000");
    expect(byNumber.get("INV-LATER")?.remaining.amount).toBe("2500000");
    expect(report.totals.overdueInvoiceCount).toBe(0);
    expect(report.customers[0]?.credit.amount).toBe("0");
  });

  it("leaves a deposit larger than all invoices as credit", () => {
    const o = order({});
    const inv = invoice({ orderId: o.id, amount: "2000000" });
    const deposit = receipt({ amount: "3000000", allocations: [toOrder(o, "3000000")] });

    const report = computeReceivables({
      orders: [o],
      invoices: [inv],
      receipts: [deposit],
      refunds: [],
      now,
    });

    expect(report.invoices[0]?.remaining.amount).toBe("0");
    expect(report.orders[0]?.remaining.amount).toBe("-1000000");
    expect(report.customers[0]?.credit.amount).toBe("1000000");
  });

  it("never applies a deposit on top of an invoice already paid directly", () => {
    const o = order({});
    const inv = invoice({ orderId: o.id, amount: "2000000" });
    const direct = receipt({ amount: "2000000", allocations: [toInvoice(inv, "2000000")] });
    const deposit = receipt({ amount: "500000", allocations: [toOrder(o, "500000")] });

    const report = computeReceivables({
      orders: [o],
      invoices: [inv],
      receipts: [direct, deposit],
      refunds: [],
      now,
    });

    expect(report.invoices[0]?.depositApplied.amount).toBe("0");
    expect(report.invoices[0]?.remaining.amount).toBe("0");
    expect(report.customers[0]?.credit.amount).toBe("500000");
  });
});

describe("computeReceivables — cancelled orders and refunds", () => {
  it("drops a cancelled order from revenue and outstanding but keeps its money as credit", () => {
    const o = order({ stage: "cancelled" });
    const inv = invoice({ orderId: o.id, amount: "5000000", dueAt: past });
    const deposit = receipt({ amount: "2000000", allocations: [toOrder(o, "2000000")] });

    const report = computeReceivables({
      orders: [o],
      invoices: [inv],
      receipts: [deposit],
      refunds: [],
      now,
    });

    expect(report.invoices).toHaveLength(0);
    expect(report.orders).toHaveLength(0);
    expect(report.totals.revenue).toEqual([]);
    expect(report.totals.overdueInvoiceCount).toBe(0);
    expect(report.customers[0]?.received.amount).toBe("2000000");
    expect(report.customers[0]?.credit.amount).toBe("2000000");
  });

  it("reduces the credit by the refund once the money is returned", () => {
    const o = order({ stage: "cancelled" });
    const deposit = receipt({ amount: "2000000", allocations: [toOrder(o, "2000000")] });
    const returned = refund({ amount: "2000000" });

    const report = computeReceivables({
      orders: [o],
      invoices: [],
      receipts: [deposit],
      refunds: [returned],
      now,
    });

    expect(report.customers[0]?.received.amount).toBe("2000000");
    expect(report.customers[0]?.refunded.amount).toBe("2000000");
    expect(report.customers[0]?.credit.amount).toBe("0");
    expect(report.customers[0]?.balance.amount).toBe("0");
  });

  it("lets credit from a cancelled order offset an invoice on the next order without a refund", () => {
    const cancelled = order({ stage: "cancelled" });
    const next = order({});
    const deposit = receipt({ amount: "2000000", allocations: [toOrder(cancelled, "2000000")] });
    const inv = invoice({ orderId: next.id, amount: "5000000" });

    const report = computeReceivables({
      orders: [cancelled, next],
      invoices: [inv],
      receipts: [deposit],
      refunds: [],
      now,
    });

    // Nothing was re-allocated yet: the invoice is open in full and the
    // customer holds the deposit as credit, so the net balance is 3 million.
    expect(report.invoices[0]?.remaining.amount).toBe("5000000");
    expect(report.customers[0]?.credit.amount).toBe("2000000");
    expect(report.customers[0]?.balance.amount).toBe("3000000");
  });
});

describe("computeReceivables — voided records", () => {
  it("ignores a voided receipt entirely", () => {
    const o = order({});
    const inv = invoice({ orderId: o.id, amount: "5000000" });
    const voided = receipt({
      amount: "5000000",
      allocations: [toInvoice(inv, "5000000")],
      status: "voided",
    });

    const report = computeReceivables({
      orders: [o],
      invoices: [inv],
      receipts: [voided],
      refunds: [],
      now,
    });

    expect(report.invoices[0]?.remaining.amount).toBe("5000000");
    expect(report.customers[0]?.received.amount).toBe("0");
    expect(report.customers[0]?.credit.amount).toBe("0");
  });

  it("treats an allocation to a voided invoice as credit again", () => {
    const o = order({});
    const voidedInvoice = invoice({ orderId: o.id, amount: "5000000", status: "voided" });
    const paid = receipt({ amount: "5000000", allocations: [toInvoice(voidedInvoice, "5000000")] });

    const report = computeReceivables({
      orders: [o],
      invoices: [voidedInvoice],
      receipts: [paid],
      refunds: [],
      now,
    });

    expect(report.invoices).toHaveLength(0);
    expect(report.totals.revenue).toEqual([]);
    expect(report.customers[0]?.credit.amount).toBe("5000000");
  });
});

describe("computeReceivables — currencies", () => {
  it("keeps USD and VND apart and converts revenue to VND through each invoice's snapshot", () => {
    const usdOrder = order({ orderCode: "RD-USD" });
    const vndOrder = order({ orderCode: "RD-VND" });
    const usdInvoice = invoice({
      orderId: usdOrder.id,
      amount: "1000.00",
      currency: "USD",
      fxRateToVnd: "25400",
    });
    const vndInvoice = invoice({ orderId: vndOrder.id, amount: "5000000" });
    const usdReceipt = receipt({
      amount: "400.00",
      currency: "USD",
      allocations: [toInvoice(usdInvoice, "400.00")],
    });

    const report = computeReceivables({
      orders: [usdOrder, vndOrder],
      invoices: [usdInvoice, vndInvoice],
      receipts: [usdReceipt],
      refunds: [],
      now,
    });

    expect(report.totals.revenue).toEqual(
      expect.arrayContaining([
        { amount: "1000.00", currency: "USD" },
        { amount: "5000000", currency: "VND" },
      ]),
    );
    expect(report.totals.revenueVnd).toEqual({
      amount: "30400000",
      currency: "VND",
    });
    expect(report.totals.revenueVndComplete).toBe(true);
    expect(report.totals.outstanding).toEqual(
      expect.arrayContaining([
        { amount: "600.00", currency: "USD" },
        { amount: "5000000", currency: "VND" },
      ]),
    );
    expect(report.customers).toHaveLength(2);
    expect(
      report.customers.map((row) => `${row.currency}:${row.outstanding.amount}`),
    ).toEqual(expect.arrayContaining(["USD:600.00", "VND:5000000"]));
  });

  it("flags the VND revenue as incomplete when a USD invoice carries no rate", () => {
    const o = order({});
    const inv = invoice({ orderId: o.id, amount: "100.00", currency: "USD" });

    const report = computeReceivables({
      orders: [o],
      invoices: [inv],
      receipts: [],
      refunds: [],
      now,
    });

    expect(report.totals.revenueVnd.amount).toBe("0");
    expect(report.totals.revenueVndComplete).toBe(false);
  });

  it("skips an allocation whose currency does not match the invoice", () => {
    const o = order({});
    const inv = invoice({ orderId: o.id, amount: "100.00", currency: "USD" });
    const wrong = receipt({ amount: "2540000", allocations: [toInvoice(inv, "2540000")] });

    const report = computeReceivables({
      orders: [o],
      invoices: [inv],
      receipts: [wrong],
      refunds: [],
      now,
    });

    expect(report.invoices[0]?.remaining.amount).toBe("100.00");
    const vndRow = report.customers.find((row) => row.currency === "VND");
    expect(vndRow?.credit.amount).toBe("2540000");
  });
});

describe("computeReceivables — customers", () => {
  it("keeps two customers apart and groups legacy records by name", () => {
    const a = order({ customerId: customerA, customerName: "Khách A" });
    const b = order({ customerId: customerB, customerName: "Khách B" });
    const legacy = order({ customerId: null, customerName: "Khách Cũ" });
    const invA = invoice({ orderId: a.id, amount: "1000000", customerId: customerA });
    const invB = invoice({
      orderId: b.id,
      amount: "2000000",
      customerId: customerB,
      customerName: "Khách B",
    });
    const invLegacy = invoice({
      orderId: legacy.id,
      amount: "3000000",
      customerId: null,
      customerName: "Khách Cũ",
    });
    const paidB = receipt({
      amount: "2000000",
      customerId: customerB,
      counterparty: "Khách B",
      allocations: [toInvoice(invB, "2000000")],
    });
    const paidLegacy = receipt({
      amount: "1000000",
      customerId: null,
      counterparty: "khách cũ",
      allocations: [toInvoice(invLegacy, "1000000")],
    });

    const report = computeReceivables({
      orders: [a, b, legacy],
      invoices: [invA, invB, invLegacy],
      receipts: [paidB, paidLegacy],
      refunds: [],
      now,
    });

    const rows = new Map(report.customers.map((row) => [row.customerKey, row]));
    expect(rows.get(keyA)?.outstanding.amount).toBe("1000000");
    expect(rows.get(customerKeyOf(customerB, "Khách B"))?.outstanding.amount).toBe("0");
    expect(rows.get(customerKeyOf(null, "Khách Cũ"))?.outstanding.amount).toBe("2000000");
    expect(rows.get(customerKeyOf(null, "Khách Cũ"))?.received.amount).toBe("1000000");
    expect(report.totals.outstanding).toEqual([{ amount: "3000000", currency: "VND" }]);
  });

  it("exposes a customer's credit through the helper, zero when none", () => {
    const o = order({});
    const paid = receipt({ amount: "750000" });
    const report = computeReceivables({
      orders: [o],
      invoices: [],
      receipts: [paid],
      refunds: [],
      now,
    });

    expect(customerCredit(report, keyA, "VND").amount).toBe("750000");
    expect(customerCredit(report, keyA, "USD").amount).toBe("0.00");
    expect(customerCredit(report, "nobody", "VND").amount).toBe("0");
  });
});

describe("invoiceAllocationCapacity", () => {
  it("is the invoice amount minus what other active receipts already allocated to it", () => {
    const o = order({});
    const inv = invoice({ orderId: o.id, amount: "5000000" });
    const first = receipt({ amount: "2000000", allocations: [toInvoice(inv, "2000000")] });
    const second = receipt({ amount: "1000000", allocations: [toInvoice(inv, "1000000")] });
    const voided = receipt({
      amount: "9000000",
      allocations: [toInvoice(inv, "9000000")],
      status: "voided",
    });

    expect(invoiceAllocationCapacity(inv, [first, second, voided], null).amount).toBe(
      "2000000",
    );
    // Re-allocating `second` itself must not count its own previous share.
    expect(invoiceAllocationCapacity(inv, [first, second], second.id).amount).toBe(
      "3000000",
    );
  });
});
