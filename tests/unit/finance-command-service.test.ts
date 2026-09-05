import { describe, expect, it } from "vitest";

import { FxRateService } from "@/domains/finance/fx-service";
import { InvoiceCommandService } from "@/domains/finance/invoice-service";
import { FinanceCommandService } from "@/domains/finance/service";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { MoneyError } from "@/lib/money";

import {
  accessContext,
  activeTotal,
  auditRepository,
  FakeCustomerStore,
  FakeFinanceEntryStore,
  FakeFxRateStore,
  FakeInvoiceStore,
  FakeOrderStore,
  FakeSupplierStore,
  occurredAt,
} from "./helpers/finance-fakes";

/**
 * The finance ledger against the rules confirmed with the company
 * accountant on 2026-09-05. Every scenario is the one she described: a
 * deposit per order, a payment per invoice, one transfer for several orders,
 * a cancelled order whose money stays in the book until it is refunded.
 */

function build() {
  const store = new FakeFinanceEntryStore();
  const invoices = new FakeInvoiceStore();
  const orders = new FakeOrderStore();
  const customers = new FakeCustomerStore();
  const suppliers = new FakeSupplierStore();
  const fx = new FakeFxRateStore();
  const audit = auditRepository();
  const now = () => occurredAt;

  const service = new FinanceCommandService({
    store,
    invoiceStore: invoices,
    orderStore: orders,
    customerStore: customers,
    supplierStore: suppliers,
    fxRateStore: fx,
    auditRepository: audit,
    now,
  });
  const invoiceService = new InvoiceCommandService({
    store: invoices,
    orderStore: orders,
    fxRateStore: fx,
    auditRepository: audit,
    now,
  });
  const fxService = new FxRateService({
    store: fx,
    auditRepository: audit,
    now,
  });

  return {
    store,
    invoices,
    orders,
    customers,
    suppliers,
    fx,
    audit,
    service,
    invoiceService,
    fxService,
  };
}

const payer = accessContext(["payments.record", "payments.allocate"]);
const refunder = accessContext(["payments.refund"]);
const costRecorder = accessContext(["expenses.create"]);
const invoicer = accessContext(["invoices.manage"]);
const rateKeeper = accessContext(["finance.manageFxSnapshot"]);

const vnd = (amount: string) => ({ amount, currency: "VND" as const });
const usd = (amount: string) => ({ amount, currency: "USD" as const });

function paymentInput(overrides: Record<string, unknown>) {
  return {
    kind: "receipt",
    category: "orderPayment",
    amount: vnd("1000000"),
    method: "bankTransfer",
    occurredAt: "2026-09-03",
    ...overrides,
  };
}

describe("FinanceCommandService.createEntry — customer payments", () => {
  it("applies a payment to an invoice only up to what is still open, and links the entry to the order", async () => {
    const { service, orders, customers, invoices, store, audit } = build();
    const customer = customers.seed({ name: "Khách A" });
    const order = orders.seed({
      customerId: customer.id,
      customerName: customer.name,
      sellingPrice: vnd("5000000"),
      stage: "invoiced",
    });
    const invoice = invoices.seed({
      orderId: order.id,
      orderCode: order.orderCode,
      customerId: customer.id,
      invoiceNumber: "INV-001",
      amount: vnd("5000000"),
    });
    store.seed({
      customerId: customer.id,
      amount: vnd("2000000"),
      allocations: [
        {
          target: "invoice",
          invoiceId: invoice.id,
          invoiceNumber: "INV-001",
          orderId: order.id,
          orderCode: order.orderCode,
          amount: "2000000",
        },
      ],
    });

    const entry = await service.createEntry(
      payer,
      paymentInput({
        amount: vnd("4000000"),
        allocateTo: { target: "invoice", invoiceId: invoice.id },
      }),
    );

    expect(entry.customerId).toBe(customer.id);
    expect(entry.counterparty).toBe("Khách A");
    expect(entry.orderId).toBe(order.id);
    expect(entry.orderCode).toBe(order.orderCode);
    expect(entry.businessUnitIds).toEqual(order.businessUnitIds);
    // 5,000,000 invoiced − 2,000,000 already applied = 3,000,000 open; the
    // remaining 1,000,000 stays unallocated as the customer's credit.
    expect(entry.allocations).toEqual([
      {
        target: "invoice",
        invoiceId: invoice.id,
        invoiceNumber: "INV-001",
        orderId: order.id,
        orderCode: order.orderCode,
        amount: "3000000",
      },
    ]);
    expect(entry.fxRateToVnd).toBeNull();
    expect(audit.events.map((event) => event.action)).toContain(
      "finance.receiptRecorded",
    );
    // Amounts never reach the audit trail.
    expect(JSON.stringify(audit.events)).not.toContain("4000000");
  });

  it("leaves a payment unallocated when the invoice is already fully covered", async () => {
    const { service, orders, customers, invoices, store } = build();
    const customer = customers.seed();
    const order = orders.seed({ customerId: customer.id });
    const invoice = invoices.seed({
      orderId: order.id,
      customerId: customer.id,
      amount: vnd("1000000"),
    });
    store.seed({
      customerId: customer.id,
      amount: vnd("1000000"),
      allocations: [
        {
          target: "invoice",
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          orderId: order.id,
          orderCode: order.orderCode,
          amount: "1000000",
        },
      ],
    });

    const entry = await service.createEntry(
      payer,
      paymentInput({
        amount: vnd("500000"),
        allocateTo: { target: "invoice", invoiceId: invoice.id },
      }),
    );

    expect(entry.allocations).toEqual([]);
    expect(entry.orderId).toBe(order.id);
  });

  it("records a deposit against an order in full, whether chosen as target or linked plainly", async () => {
    const { service, orders, customers } = build();
    const customer = customers.seed();
    const order = orders.seed({ customerId: customer.id });

    const chosen = await service.createEntry(
      payer,
      paymentInput({
        amount: vnd("1500000"),
        allocateTo: { target: "order", orderId: order.id },
      }),
    );
    const linked = await service.createEntry(
      payer,
      paymentInput({ amount: vnd("250000"), orderId: order.id }),
    );

    for (const entry of [chosen, linked]) {
      expect(entry.allocations).toEqual([
        {
          target: "order",
          orderId: order.id,
          orderCode: order.orderCode,
          amount: entry.amount.amount,
        },
      ]);
      expect(entry.customerId).toBe(customer.id);
    }
  });

  it("records an unallocated transfer against the customer alone", async () => {
    const { service, customers } = build();
    const customer = customers.seed({ name: "Khách B" });

    const entry = await service.createEntry(
      payer,
      paymentInput({ customerId: customer.id, amount: vnd("10000000") }),
    );

    expect(entry.orderId).toBeNull();
    expect(entry.allocations).toEqual([]);
    expect(entry.counterparty).toBe("Khách B");
    expect(entry.businessUnitIds).toEqual([]);
  });

  it("refuses a payment on a cancelled order", async () => {
    const { service, orders, customers } = build();
    const customer = customers.seed();
    const order = orders.seed({ customerId: customer.id, stage: "cancelled" });

    await expect(
      service.createEntry(payer, paymentInput({ orderId: order.id })),
    ).rejects.toMatchObject({ code: "ORDER_CANCELLED" });
  });

  it("refuses a payment in another currency than the order or the invoice", async () => {
    const { service, orders, customers, invoices } = build();
    const customer = customers.seed();
    const usdOrder = orders.seed({
      customerId: customer.id,
      sellingPrice: usd("1000.00"),
    });
    const unpriced = orders.seed({ customerId: customer.id });
    const usdInvoice = invoices.seed({
      orderId: unpriced.id,
      customerId: customer.id,
      amount: usd("500.00"),
    });

    await expect(
      service.createEntry(payer, paymentInput({ orderId: usdOrder.id })),
    ).rejects.toMatchObject({ code: "CURRENCY_MISMATCH" });
    await expect(
      service.createEntry(
        payer,
        paymentInput({
          allocateTo: { target: "invoice", invoiceId: usdInvoice.id },
        }),
      ),
    ).rejects.toMatchObject({ code: "CURRENCY_MISMATCH" });
  });

  it("refuses a payment whose customer differs from the order's customer", async () => {
    const { service, orders, customers } = build();
    const a = customers.seed({ name: "Khách A" });
    const b = customers.seed({ name: "Khách B" });
    const order = orders.seed({ customerId: a.id });

    await expect(
      service.createEntry(
        payer,
        paymentInput({ customerId: b.id, orderId: order.id }),
      ),
    ).rejects.toMatchObject({ code: "CUSTOMER_MISMATCH" });
  });

  it("requires a customer for a payment that names no order", async () => {
    const { service } = build();

    await expect(
      service.createEntry(payer, paymentInput({})),
    ).rejects.toMatchObject({ code: "CUSTOMER_REQUIRED" });
  });

  it("refuses an unknown customer, invoice, or order", async () => {
    const { service } = build();
    const missing = "ffffffffffffffffffffffff";

    await expect(
      service.createEntry(payer, paymentInput({ customerId: missing })),
    ).rejects.toMatchObject({ code: "CUSTOMER_NOT_FOUND" });
    await expect(
      service.createEntry(payer, paymentInput({ orderId: missing })),
    ).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
    await expect(
      service.createEntry(
        payer,
        paymentInput({ allocateTo: { target: "invoice", invoiceId: missing } }),
      ),
    ).rejects.toMatchObject({ code: "INVOICE_NOT_FOUND" });
  });

  it("falls back to the order's customer name for an order recorded before the customer list", async () => {
    const { service, orders } = build();
    const legacy = orders.seed({ customerId: null, customerName: "Khách Cũ" });

    const entry = await service.createEntry(
      payer,
      paymentInput({ orderId: legacy.id }),
    );

    expect(entry.customerId).toBeNull();
    expect(entry.counterparty).toBe("Khách Cũ");
  });

  it("snapshots the USD rate in force on the entry date", async () => {
    const { service, customers, fx } = build();
    const customer = customers.seed();
    fx.seed("2026-09-01", "25400");
    fx.seed("2026-09-04", "25500");

    const early = await service.createEntry(
      payer,
      paymentInput({
        customerId: customer.id,
        amount: usd("100.00"),
        occurredAt: "2026-09-03",
      }),
    );
    const late = await service.createEntry(
      payer,
      paymentInput({
        customerId: customer.id,
        amount: usd("100.00"),
        occurredAt: "2026-09-05",
      }),
    );
    const before = await service.createEntry(
      payer,
      paymentInput({
        customerId: customer.id,
        amount: usd("100.00"),
        occurredAt: "2026-08-01",
      }),
    );

    expect(early.fxRateToVnd).toBe("25400");
    expect(late.fxRateToVnd).toBe("25500");
    expect(before.fxRateToVnd).toBeNull();
  });

  it("rejects a category that does not belong to the kind, a zero amount, and a malformed amount", async () => {
    const { service, customers } = build();
    const customer = customers.seed();

    await expect(
      service.createEntry(
        payer,
        paymentInput({ kind: "expense", customerId: customer.id }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      service.createEntry(
        payer,
        paymentInput({ customerId: customer.id, amount: vnd("0") }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      service.createEntry(
        payer,
        paymentInput({ customerId: customer.id, amount: vnd("1.000.000") }),
      ),
    ).rejects.toBeInstanceOf(MoneyError);
  });

  it("refuses a context without payments.record", async () => {
    const { service, customers } = build();
    const customer = customers.seed();

    await expect(
      service.createEntry(
        accessContext(["expenses.create"]),
        paymentInput({ customerId: customer.id }),
      ),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });
});

describe("FinanceCommandService.createEntry — costs", () => {
  it("records a cost against a supplier picked from the list", async () => {
    const { service, orders, suppliers, audit } = build();
    const order = orders.seed({ sellingPrice: usd("1000.00") });
    const supplier = suppliers.seed({ name: "Xưởng gỗ B" });

    const entry = await service.createEntry(costRecorder, {
      kind: "expense",
      category: "materials",
      orderId: order.id,
      supplierId: supplier.id,
      amount: vnd("3200000"),
      method: "cash",
      occurredAt: "2026-09-03",
    });

    expect(entry.supplierId).toBe(supplier.id);
    expect(entry.counterparty).toBe("Xưởng gỗ B");
    expect(entry.customerId).toBeNull();
    // A VND cost on a USD order is fine: costs total per currency.
    expect(entry.amount).toEqual(vnd("3200000"));
    expect(entry.allocations).toEqual([]);
    expect(audit.events.map((event) => event.action)).toContain(
      "finance.expenseRecorded",
    );
  });

  it("accepts free text for a cost without a supplier and refuses one with neither", async () => {
    const { service } = build();

    const labor = await service.createEntry(costRecorder, {
      kind: "expense",
      category: "labor",
      counterparty: "Nhân công tháng 9",
      amount: vnd("12000000"),
      method: "cash",
      occurredAt: "2026-09-03",
    });
    expect(labor.counterparty).toBe("Nhân công tháng 9");

    await expect(
      service.createEntry(costRecorder, {
        kind: "expense",
        category: "labor",
        amount: vnd("12000000"),
        method: "cash",
        occurredAt: "2026-09-03",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("refuses an unknown supplier and still books costs against a cancelled order", async () => {
    const { service, orders } = build();
    const cancelled = orders.seed({ stage: "cancelled" });

    await expect(
      service.createEntry(costRecorder, {
        kind: "expense",
        category: "materials",
        supplierId: "ffffffffffffffffffffffff",
        amount: vnd("1"),
        method: "cash",
        occurredAt: "2026-09-03",
      }),
    ).rejects.toMatchObject({ code: "SUPPLIER_NOT_FOUND" });

    const entry = await service.createEntry(costRecorder, {
      kind: "expense",
      category: "materials",
      orderId: cancelled.id,
      counterparty: "Đã mua trước khi hủy",
      amount: vnd("1"),
      method: "cash",
      occurredAt: "2026-09-03",
    });
    expect(entry.orderId).toBe(cancelled.id);
  });
});

describe("FinanceCommandService.createEntry — refunds", () => {
  async function withCredit() {
    const built = build();
    const customer = built.customers.seed({ name: "Khách A" });
    const cancelled = built.orders.seed({
      customerId: customer.id,
      customerName: customer.name,
      stage: "cancelled",
    });
    // A deposit taken before the order was cancelled: still in the book.
    built.store.seed({
      customerId: customer.id,
      counterparty: customer.name,
      orderId: cancelled.id,
      amount: vnd("2000000"),
      allocations: [
        {
          target: "order",
          orderId: cancelled.id,
          orderCode: cancelled.orderCode,
          amount: "2000000",
        },
      ],
    });
    return { ...built, customer, cancelled };
  }

  it("refuses to refund more than the customer's credit", async () => {
    const { service, customer } = await withCredit();

    await expect(
      service.createEntry(refunder, {
        kind: "expense",
        category: "refund",
        customerId: customer.id,
        amount: vnd("2000001"),
        method: "bankTransfer",
        occurredAt: "2026-09-04",
      }),
    ).rejects.toMatchObject({ code: "REFUND_EXCEEDS_CREDIT" });
  });

  it("records a refund within the credit, keeps the original receipt in the cash total, and audits it", async () => {
    const { service, customer, cancelled, store, audit } = await withCredit();

    const refund = await service.createEntry(refunder, {
      kind: "expense",
      category: "refund",
      customerId: customer.id,
      orderId: cancelled.id,
      amount: vnd("2000000"),
      method: "bankTransfer",
      occurredAt: "2026-09-04",
    });

    expect(refund.kind).toBe("expense");
    expect(refund.customerId).toBe(customer.id);
    expect(refund.counterparty).toBe("Khách A");
    expect(activeTotal(store, "receipt", "VND").amount).toBe("2000000");
    expect(activeTotal(store, "expense", "VND").amount).toBe("2000000");
    expect(audit.events.map((event) => event.action)).toContain(
      "finance.refundRecorded",
    );

    // The credit is now used up.
    const credit = await service.creditFor(customer.id, customer.name);
    expect(credit).toEqual([]);
  });

  it("needs payments.refund, not expenses.create", async () => {
    const { service, customer } = await withCredit();

    await expect(
      service.createEntry(costRecorder, {
        kind: "expense",
        category: "refund",
        customerId: customer.id,
        amount: vnd("1"),
        method: "cash",
        occurredAt: "2026-09-04",
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });
});

describe("FinanceCommandService.setAllocations", () => {
  function scenario() {
    const built = build();
    const customer = built.customers.seed({ name: "Khách A" });
    const order = built.orders.seed({
      customerId: customer.id,
      customerName: "Khách A",
      orderCode: "RD-ONE",
      sellingPrice: vnd("7000000"),
    });
    const other = built.orders.seed({
      customerId: customer.id,
      customerName: "Khách A",
      orderCode: "RD-TWO",
    });
    const x = built.invoices.seed({
      orderId: order.id,
      orderCode: order.orderCode,
      customerId: customer.id,
      invoiceNumber: "INV-X",
      amount: vnd("4000000"),
    });
    const y = built.invoices.seed({
      orderId: order.id,
      orderCode: order.orderCode,
      customerId: customer.id,
      invoiceNumber: "INV-Y",
      amount: vnd("3000000"),
    });
    const receipt = built.store.seed({
      customerId: customer.id,
      counterparty: "Khách A",
      amount: vnd("10000000"),
    });
    return { ...built, customer, order, other, x, y, receipt };
  }

  it("splits one transfer across two invoices and a deposit on another order", async () => {
    const { service, receipt, x, y, other, order, audit } = scenario();

    const updated = await service.setAllocations(payer, {
      entryId: receipt.id,
      expectedRevision: receipt.revision,
      allocations: [
        { target: "invoice", invoiceId: x.id, amount: "4000000" },
        { target: "invoice", invoiceId: y.id, amount: "3000000" },
        { target: "order", orderId: other.id, amount: "2000000" },
      ],
    });

    expect(updated.revision).toBe(receipt.revision + 1);
    expect(updated.allocations).toEqual([
      {
        target: "invoice",
        invoiceId: x.id,
        invoiceNumber: "INV-X",
        orderId: order.id,
        orderCode: "RD-ONE",
        amount: "4000000",
      },
      {
        target: "invoice",
        invoiceId: y.id,
        invoiceNumber: "INV-Y",
        orderId: order.id,
        orderCode: "RD-ONE",
        amount: "3000000",
      },
      {
        target: "order",
        orderId: other.id,
        orderCode: "RD-TWO",
        amount: "2000000",
      },
    ]);
    expect(audit.events.map((event) => event.action)).toContain(
      "finance.receiptAllocated",
    );

    // Both invoices are settled. The 2,000,000 deposit sits on an order that
    // has no invoice yet and the last 1,000,000 was never applied, so the
    // customer is 3,000,000 in advance.
    const report = await service.receivables({ kind: "all" }, occurredAt);
    expect(report.customers[0]?.credit.amount).toBe("3000000");
    expect(report.customers[0]?.outstanding.amount).toBe("0");
    expect(report.customers[0]?.balance.amount).toBe("-3000000");
    const otherRow = report.orders.find((row) => row.orderCode === "RD-TWO");
    expect(otherRow?.deposits.amount).toBe("2000000");
    expect(otherRow?.remaining.amount).toBe("-2000000");
  });

  it("refuses allocations that add up to more than the receipt", async () => {
    const { service, receipt, x, other } = scenario();

    await expect(
      service.setAllocations(payer, {
        entryId: receipt.id,
        expectedRevision: 0,
        allocations: [
          { target: "invoice", invoiceId: x.id, amount: "4000000" },
          { target: "order", orderId: other.id, amount: "6000001" },
        ],
      }),
    ).rejects.toMatchObject({ code: "ALLOCATION_EXCEEDS_ENTRY" });
  });

  it("refuses more than what other receipts have left open on an invoice, but lets a receipt re-allocate its own share", async () => {
    const { service, store, receipt, x, order, customer } = scenario();
    store.seed({
      customerId: customer.id,
      amount: vnd("3000000"),
      allocations: [
        {
          target: "invoice",
          invoiceId: x.id,
          invoiceNumber: "INV-X",
          orderId: order.id,
          orderCode: order.orderCode,
          amount: "3000000",
        },
      ],
    });

    await expect(
      service.setAllocations(payer, {
        entryId: receipt.id,
        expectedRevision: 0,
        allocations: [{ target: "invoice", invoiceId: x.id, amount: "1000001" }],
      }),
    ).rejects.toMatchObject({ code: "ALLOCATION_EXCEEDS_INVOICE" });

    const first = await service.setAllocations(payer, {
      entryId: receipt.id,
      expectedRevision: 0,
      allocations: [{ target: "invoice", invoiceId: x.id, amount: "1000000" }],
    });
    // Re-saving the same share must not count itself as "already allocated".
    const again = await service.setAllocations(payer, {
      entryId: receipt.id,
      expectedRevision: first.revision,
      allocations: [{ target: "invoice", invoiceId: x.id, amount: "1000000" }],
    });
    expect(again.allocations[0]?.amount).toBe("1000000");
  });

  it("refuses a voided invoice, a cancelled order, another customer's records, and a duplicate target", async () => {
    const { service, receipt, x, invoices, orders, customers } = scenario();
    const voided = invoices.seed({
      orderId: x.orderId,
      customerId: receipt.customerId,
      status: "voided",
      amount: vnd("1"),
    });
    const cancelled = orders.seed({
      customerId: receipt.customerId,
      stage: "cancelled",
    });
    const stranger = customers.seed({ name: "Khách B" });
    const strangerOrder = orders.seed({
      customerId: stranger.id,
      customerName: "Khách B",
    });

    const attempt = (allocations: unknown[]) =>
      service.setAllocations(payer, {
        entryId: receipt.id,
        expectedRevision: 0,
        allocations,
      });

    await expect(
      attempt([{ target: "invoice", invoiceId: voided.id, amount: "1" }]),
    ).rejects.toMatchObject({ code: "INVOICE_VOIDED" });
    await expect(
      attempt([{ target: "order", orderId: cancelled.id, amount: "1" }]),
    ).rejects.toMatchObject({ code: "ORDER_CANCELLED" });
    await expect(
      attempt([{ target: "order", orderId: strangerOrder.id, amount: "1" }]),
    ).rejects.toMatchObject({ code: "CUSTOMER_MISMATCH" });
    await expect(
      attempt([
        { target: "invoice", invoiceId: x.id, amount: "1" },
        { target: "invoice", invoiceId: x.id, amount: "1" },
      ]),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      attempt([{ target: "invoice", invoiceId: x.id, amount: "0" }]),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("refuses anything but an active customer payment", async () => {
    const { service, store, receipt } = scenario();
    const cost = store.seed({
      kind: "expense",
      category: "materials",
      counterparty: "Xưởng",
      amount: vnd("1"),
    });
    const voided = store.seed({
      customerId: receipt.customerId,
      amount: vnd("1"),
      status: "voided",
    });

    await expect(
      service.setAllocations(payer, {
        entryId: cost.id,
        expectedRevision: 0,
        allocations: [],
      }),
    ).rejects.toMatchObject({ code: "NOT_A_RECEIPT" });
    await expect(
      service.setAllocations(payer, {
        entryId: voided.id,
        expectedRevision: 0,
        allocations: [],
      }),
    ).rejects.toMatchObject({ code: "ALREADY_VOIDED" });
  });

  it("rejects a stale revision and a context without payments.allocate", async () => {
    const { service, receipt } = scenario();

    await expect(
      service.setAllocations(payer, {
        entryId: receipt.id,
        expectedRevision: 7,
        allocations: [],
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    await expect(
      service.setAllocations(accessContext(["payments.record"]), {
        entryId: receipt.id,
        expectedRevision: 0,
        allocations: [],
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });
});

describe("FinanceCommandService.voidEntry", () => {
  it("voids with a reason, keeps the row, and refuses a second void", async () => {
    const { service, store, customers, audit } = build();
    const customer = customers.seed();
    const entry = store.seed({ customerId: customer.id, amount: vnd("1000") });

    const voided = await service.voidEntry(accessContext(["payments.reverse"]), {
      entryId: entry.id,
      expectedRevision: 0,
      reason: "Nhập nhầm số tiền",
    });

    expect(voided.status).toBe("voided");
    expect(voided.voidReason).toBe("Nhập nhầm số tiền");
    expect(store.entries.size).toBe(1);
    expect(activeTotal(store, "receipt", "VND").amount).toBe("0");
    expect(audit.events.at(-1)?.reason).toBe("Nhập nhầm số tiền");

    await expect(
      service.voidEntry(accessContext(["payments.reverse"]), {
        entryId: entry.id,
        expectedRevision: 1,
        reason: "again",
      }),
    ).rejects.toMatchObject({ code: "ALREADY_VOIDED" });
  });

  it("judges the reverse permission by the entry kind", async () => {
    const { service, store } = build();
    const cost = store.seed({
      kind: "expense",
      category: "materials",
      counterparty: "Xưởng",
      amount: vnd("1000"),
    });

    await expect(
      service.voidEntry(accessContext(["payments.reverse"]), {
        entryId: cost.id,
        expectedRevision: 0,
        reason: "x",
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);

    const voided = await service.voidEntry(
      accessContext(["expenses.reverse"]),
      { entryId: cost.id, expectedRevision: 0, reason: "x" },
    );
    expect(voided.status).toBe("voided");
  });
});

describe("FinanceCommandService.receivables", () => {
  it("assembles the accountant's example end to end through the services", async () => {
    const { service, invoiceService, orders, customers } = build();
    const customer = customers.seed({ name: "Khách A" });
    const order = orders.seed({
      customerId: customer.id,
      customerName: "Khách A",
      sellingPrice: vnd("5000000"),
      stage: "invoiced",
    });

    const invoice = await invoiceService.createInvoice(invoicer, {
      orderId: order.id,
      invoiceNumber: "INV-2026-001",
      issuedAt: "2026-08-20",
      dueAt: "2026-08-31",
      amount: vnd("5000000"),
    });
    await service.createEntry(
      payer,
      paymentInput({
        amount: vnd("2000000"),
        allocateTo: { target: "invoice", invoiceId: invoice.id },
      }),
    );

    const report = await service.receivables({ kind: "all" }, occurredAt);
    expect(report.invoices[0]?.remaining.amount).toBe("3000000");
    expect(report.invoices[0]?.overdue).toBe(true);
    expect(report.totals.outstanding).toEqual([vnd("3000000")]);
    expect(report.totals.revenue).toEqual([vnd("5000000")]);
    expect(report.customers[0]?.customerId).toBe(customer.id);
  });
});

describe("InvoiceCommandService", () => {
  it("issues a VND invoice with the order's customer snapshot and no rate", async () => {
    const { invoiceService, orders, customers, audit } = build();
    const customer = customers.seed({ name: "Khách A" });
    const order = orders.seed({
      customerId: customer.id,
      customerName: "Khách A",
      orderCode: "RD-INV",
      sellingPrice: vnd("5000000"),
    });

    const invoice = await invoiceService.createInvoice(invoicer, {
      orderId: order.id,
      invoiceNumber: "  INV-001 ",
      issuedAt: "2026-09-01",
      dueAt: "2026-09-30",
      amount: vnd("5500000"),
      note: "Kèm phí vận chuyển khách trả",
    });

    expect(invoice.invoiceNumber).toBe("INV-001");
    expect(invoice.orderCode).toBe("RD-INV");
    expect(invoice.customerId).toBe(customer.id);
    expect(invoice.customerName).toBe("Khách A");
    expect(invoice.amount).toEqual(vnd("5500000"));
    expect(invoice.fxRateToVnd).toBeNull();
    expect(invoice.status).toBe("active");
    expect(invoice.businessUnitIds).toEqual(order.businessUnitIds);
    expect(audit.events.map((event) => event.action)).toContain(
      "finance.invoiceIssued",
    );
    expect(JSON.stringify(audit.events)).not.toContain("5500000");
  });

  it("takes the rate table's rate for a USD invoice, lets a typed rate win, and refuses without any rate", async () => {
    const { invoiceService, orders, fx } = build();
    const order = orders.seed({ sellingPrice: usd("1000.00") });
    const base = {
      orderId: order.id,
      issuedAt: "2026-09-03",
      dueAt: "2026-10-03",
      amount: usd("1000.00"),
    };

    await expect(
      invoiceService.createInvoice(invoicer, { ...base, invoiceNumber: "A" }),
    ).rejects.toMatchObject({ code: "FX_RATE_REQUIRED" });

    fx.seed("2026-09-01", "25400");
    const fromTable = await invoiceService.createInvoice(invoicer, {
      ...base,
      invoiceNumber: "B",
      fxRateToVnd: "",
    });
    expect(fromTable.fxRateToVnd).toBe("25400");

    const typed = await invoiceService.createInvoice(invoicer, {
      ...base,
      invoiceNumber: "C",
      fxRateToVnd: "25450.5",
    });
    expect(typed.fxRateToVnd).toBe("25450.5");
  });

  it("keeps one currency per order: the price and every sibling invoice", async () => {
    const { invoiceService, orders, invoices } = build();
    const priced = orders.seed({ sellingPrice: usd("100.00") });
    const unpriced = orders.seed();
    invoices.seed({ orderId: unpriced.id, amount: usd("10.00") });

    await expect(
      invoiceService.createInvoice(invoicer, {
        orderId: priced.id,
        invoiceNumber: "X",
        issuedAt: "2026-09-01",
        dueAt: "2026-09-02",
        amount: vnd("1000"),
      }),
    ).rejects.toMatchObject({ code: "CURRENCY_MISMATCH" });
    await expect(
      invoiceService.createInvoice(invoicer, {
        orderId: unpriced.id,
        invoiceNumber: "Y",
        issuedAt: "2026-09-01",
        dueAt: "2026-09-02",
        amount: vnd("1000"),
      }),
    ).rejects.toMatchObject({ code: "CURRENCY_MISMATCH" });
  });

  it("refuses cancelled and closed orders, a due date before issue, and a zero amount", async () => {
    const { invoiceService, orders } = build();
    const cancelled = orders.seed({ stage: "cancelled" });
    const closed = orders.seed({ stage: "closed" });
    const open = orders.seed();
    const base = { issuedAt: "2026-09-01", dueAt: "2026-09-30", amount: vnd("1") };

    await expect(
      invoiceService.createInvoice(invoicer, {
        ...base,
        orderId: cancelled.id,
        invoiceNumber: "A",
      }),
    ).rejects.toMatchObject({ code: "ORDER_CANCELLED" });
    await expect(
      invoiceService.createInvoice(invoicer, {
        ...base,
        orderId: closed.id,
        invoiceNumber: "B",
      }),
    ).rejects.toMatchObject({ code: "ORDER_CLOSED" });
    await expect(
      invoiceService.createInvoice(invoicer, {
        ...base,
        orderId: open.id,
        invoiceNumber: "C",
        dueAt: "2026-08-31",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      invoiceService.createInvoice(invoicer, {
        ...base,
        orderId: open.id,
        invoiceNumber: "D",
        amount: vnd("0"),
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("refuses a duplicate active number and frees it once the first is voided", async () => {
    const { invoiceService, orders } = build();
    const order = orders.seed();
    const base = {
      orderId: order.id,
      invoiceNumber: "INV-DUP",
      issuedAt: "2026-09-01",
      dueAt: "2026-09-30",
      amount: vnd("1"),
    };

    const first = await invoiceService.createInvoice(invoicer, base);
    await expect(
      invoiceService.createInvoice(invoicer, base),
    ).rejects.toMatchObject({ code: "DUPLICATE_INVOICE_NUMBER" });

    const voided = await invoiceService.voidInvoice(invoicer, {
      invoiceId: first.id,
      expectedRevision: first.revision,
      reason: "Sai số tiền",
    });
    expect(voided.status).toBe("voided");
    expect(voided.voidReason).toBe("Sai số tiền");

    const replacement = await invoiceService.createInvoice(invoicer, base);
    expect(replacement.id).not.toBe(first.id);

    await expect(
      invoiceService.voidInvoice(invoicer, {
        invoiceId: first.id,
        expectedRevision: voided.revision,
        reason: "again",
      }),
    ).rejects.toMatchObject({ code: "ALREADY_VOIDED" });
    await expect(
      invoiceService.voidInvoice(invoicer, {
        invoiceId: replacement.id,
        expectedRevision: 9,
        reason: "stale",
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });

  it("attaches and removes the invoice file", async () => {
    const { invoiceService, orders, audit } = build();
    const order = orders.seed();
    const invoice = await invoiceService.createInvoice(invoicer, {
      orderId: order.id,
      invoiceNumber: "INV-DOC",
      issuedAt: "2026-09-01",
      dueAt: "2026-09-30",
      amount: vnd("1"),
    });

    const withFile = await invoiceService.attachDocument(invoicer, {
      invoiceId: invoice.id,
      expectedRevision: invoice.revision,
      publicId: "reddoor/invoices/abc",
      assetVersion: 12,
      format: "PDF",
      bytes: 2048,
      label: "INV-DOC.pdf",
    });
    expect(withFile.documents).toHaveLength(1);
    expect(withFile.documents[0]?.format).toBe("pdf");
    expect(withFile.documents[0]?.uploadedAt).toEqual(occurredAt);

    const withoutFile = await invoiceService.removeDocument(invoicer, {
      invoiceId: invoice.id,
      expectedRevision: withFile.revision,
      documentId: withFile.documents[0]!.id,
    });
    expect(withoutFile.documents).toHaveLength(0);
    expect(audit.events.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        "finance.invoiceDocumentAttached",
        "finance.invoiceDocumentRemoved",
      ]),
    );
  });

  it("requires invoices.manage", async () => {
    const { invoiceService, orders } = build();
    const order = orders.seed();

    await expect(
      invoiceService.createInvoice(payer, {
        orderId: order.id,
        invoiceNumber: "X",
        issuedAt: "2026-09-01",
        dueAt: "2026-09-30",
        amount: vnd("1"),
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });
});

describe("FxRateService", () => {
  it("stores one rate per calendar day at UTC midnight and audits it", async () => {
    const { fxService, audit } = build();

    const first = await fxService.setRate(rateKeeper, {
      date: "2026-09-05T15:45:00+07:00",
      rate: "25400",
      source: "PublicBank",
    });
    const corrected = await fxService.setRate(rateKeeper, {
      date: "2026-09-05",
      rate: "25420",
      source: "",
    });

    expect(first.date.toISOString()).toBe("2026-09-05T00:00:00.000Z");
    expect(corrected.id).toBe(first.id);
    expect(corrected.rate).toBe("25420");
    expect(corrected.source).toBeNull();
    expect((await fxService.list()).map((rate) => rate.rate)).toEqual(["25420"]);
    expect(audit.events.map((event) => event.action)).toEqual([
      "finance.fxRateSet",
      "finance.fxRateSet",
    ]);
  });

  it("answers the latest rate on or before a day", async () => {
    const { fxService, fx } = build();
    fx.seed("2026-09-01", "25400");
    fx.seed("2026-09-04", "25500");

    expect((await fxService.rateOn(new Date("2026-09-03T12:00:00Z")))?.rate).toBe(
      "25400",
    );
    expect((await fxService.rateOn(new Date("2026-09-04T23:59:00Z")))?.rate).toBe(
      "25500",
    );
    expect(await fxService.rateOn(new Date("2026-08-31T00:00:00Z"))).toBeNull();
  });

  it("rejects a non-positive or malformed rate and a context without the permission", async () => {
    const { fxService } = build();

    await expect(
      fxService.setRate(rateKeeper, { date: "2026-09-05", rate: "0" }),
    ).rejects.toThrow();
    await expect(
      fxService.setRate(rateKeeper, { date: "2026-09-05", rate: "25,400" }),
    ).rejects.toThrow();
    await expect(
      fxService.setRate(payer, { date: "2026-09-05", rate: "25400" }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });
});
