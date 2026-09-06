import { describe, expect, it } from "vitest";

import { computeReceivables } from "@/domains/finance/receivables";

import {
  FakeFinanceEntryStore,
  FakeInvoiceStore,
  FakeOrderStore,
} from "./helpers/finance-fakes";

/**
 * The acceptance fixture from the brief, expressed in the system's own
 * accounting rules (confirmed with the company accountant on 2026-09-05):
 *
 *   receivable 120,000,000 VND; confirmed receipts 30,000,000 and
 *   20,000,000 VND; approved reduction 5,000,000 VND → 65,000,000 VND left.
 *
 * There is no "credit note" entity in this system. A reduction is recorded
 * the way the accountant does it here: the original invoice is voided with
 * a reason and re-issued for the corrected amount. Every other number
 * follows unchanged, and the same function feeds the receivables page, the
 * customer page, the order page and the assistant's tools.
 */
describe("receivables acceptance fixture", () => {
  const now = new Date("2026-09-06T03:00:00Z");

  function base() {
    const orders = new FakeOrderStore();
    const invoices = new FakeInvoiceStore();
    const entries = new FakeFinanceEntryStore();
    const customerId = "c0c0c0c0c0c0c0c0c0c0c0c0";
    const order = orders.seed({
      orderCode: "RD-FIXTURE",
      customerId,
      customerName: "Khách Fixture",
      stage: "invoiced",
      sellingPrice: { amount: "120000000", currency: "VND" },
    });
    const invoice = invoices.seed({
      orderId: order.id,
      orderCode: order.orderCode,
      customerId,
      customerName: order.customerName,
      invoiceNumber: "INV-120",
      amount: { amount: "120000000", currency: "VND" },
      issuedAt: new Date("2026-08-01T00:00:00Z"),
      dueAt: new Date("2026-08-31T00:00:00Z"),
    });
    const receipt = (
      amount: string,
      invoiceId: string,
      invoiceNumber: string,
    ) =>
      entries.seed({
        kind: "receipt",
        category: "orderPayment",
        orderId: order.id,
        orderCode: order.orderCode,
        customerId,
        counterparty: order.customerName,
        amount: { amount, currency: "VND" },
        allocations: [
          {
            target: "invoice",
            invoiceId,
            invoiceNumber,
            orderId: order.id,
            orderCode: order.orderCode,
            amount,
          },
        ],
      });
    return { orders, invoices, entries, order, invoice, customerId, receipt };
  }

  it("120M invoiced − 30M − 20M received = 70M outstanding, overdue", async () => {
    const { orders, invoices, entries, invoice, receipt } = base();
    receipt("30000000", invoice.id, invoice.invoiceNumber);
    receipt("20000000", invoice.id, invoice.invoiceNumber);

    const report = computeReceivables({
      orders: await orders.list({ kind: "all" }),
      invoices: await invoices.list({}),
      receipts: await entries.listActive({
        kind: "receipt",
        category: "orderPayment",
      }),
      refunds: [],
      now,
    });
    const row = report.invoices[0]!;
    expect(row.paid.amount).toBe("50000000");
    expect(row.remaining.amount).toBe("70000000");
    expect(row.overdue).toBe(true);
    expect(report.customers[0]!.outstanding).toEqual({
      amount: "70000000",
      currency: "VND",
    });
    expect(report.customers[0]!.credit.amount).toBe("0");
    expect(report.totals.outstanding).toEqual([
      { amount: "70000000", currency: "VND" },
    ]);
  });

  it("an approved 5M reduction (void + re-issue 115M) leaves 65M outstanding with the same receipts", async () => {
    const { orders, invoices, entries, order, invoice, customerId, receipt } =
      base();
    receipt("30000000", invoice.id, invoice.invoiceNumber);
    receipt("20000000", invoice.id, invoice.invoiceNumber);

    // The reduction: the accountant voids INV-120 with a reason and issues
    // INV-115 for the corrected amount; the receipts are re-allocated to it.
    await invoices.void({
      invoiceId: invoice.id,
      expectedRevision: invoice.revision,
      reason: "Giảm trừ đã duyệt 5.000.000",
      updatedBy: "u",
    });
    const corrected = invoices.seed({
      orderId: order.id,
      orderCode: order.orderCode,
      customerId,
      customerName: order.customerName,
      invoiceNumber: "INV-115",
      amount: { amount: "115000000", currency: "VND" },
      issuedAt: new Date("2026-08-01T00:00:00Z"),
      dueAt: new Date("2026-08-31T00:00:00Z"),
    });
    for (const entry of await entries.listActive({ kind: "receipt" })) {
      await entries.setAllocations({
        entryId: entry.id,
        expectedRevision: entry.revision,
        allocations: [
          {
            target: "invoice",
            invoiceId: corrected.id,
            invoiceNumber: corrected.invoiceNumber,
            orderId: order.id,
            orderCode: order.orderCode,
            amount: entry.amount.amount,
          },
        ],
        updatedBy: "u",
      });
    }

    const report = computeReceivables({
      orders: await orders.list({ kind: "all" }),
      invoices: await invoices.list({}),
      receipts: await entries.listActive({
        kind: "receipt",
        category: "orderPayment",
      }),
      refunds: [],
      now,
    });
    // The voided invoice no longer counts; only INV-115 does.
    expect(report.invoices).toHaveLength(1);
    expect(report.invoices[0]!.invoice.invoiceNumber).toBe("INV-115");
    expect(report.invoices[0]!.remaining).toEqual({
      amount: "65000000",
      currency: "VND",
    });
    expect(report.customers[0]!.outstanding.amount).toBe("65000000");
    expect(report.customers[0]!.received.amount).toBe("50000000");
    expect(report.customers[0]!.balance.amount).toBe("65000000");
  });

  it("an unconfirmed (voided) receipt does not reduce the balance and a USD invoice is never summed with VND", async () => {
    const { orders, invoices, entries, order, invoice, customerId, receipt } =
      base();
    const voided = receipt("30000000", invoice.id, invoice.invoiceNumber);
    await entries.void({
      entryId: voided.id,
      expectedRevision: voided.revision,
      reason: "chuyển nhầm",
      updatedBy: "u",
    });
    receipt("20000000", invoice.id, invoice.invoiceNumber);
    invoices.seed({
      orderId: order.id,
      orderCode: order.orderCode,
      customerId,
      customerName: order.customerName,
      invoiceNumber: "INV-USD",
      amount: { amount: "1000.00", currency: "USD" },
      fxRateToVnd: "25000",
      issuedAt: new Date("2026-09-01T00:00:00Z"),
      dueAt: new Date("2026-09-30T00:00:00Z"),
    });

    const report = computeReceivables({
      orders: await orders.list({ kind: "all" }),
      invoices: await invoices.list({}),
      receipts: await entries.listActive({
        kind: "receipt",
        category: "orderPayment",
      }),
      refunds: [],
      now,
    });
    expect(
      report.invoices.find((r) => r.invoice.invoiceNumber === "INV-120")!
        .remaining.amount,
    ).toBe("100000000");
    expect(report.totals.outstanding).toEqual(
      expect.arrayContaining([
        { amount: "100000000", currency: "VND" },
        { amount: "1000.00", currency: "USD" },
      ]),
    );
    expect(report.totals.revenueVnd.amount).toBe("145000000");
  });
});
