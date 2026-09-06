import { z } from "zod";

import {
  adminHref,
  guarded,
  isoDay,
  moneyView,
  notFound,
  objectIdSchema,
} from "@/domains/assistant/tools/shared";
import type {
  AssistantTool,
  ToolContext,
} from "@/domains/assistant/tools/types";
import type { ReceivablesReport } from "@/domains/finance/receivables";
import type { ListReadScope } from "@/lib/auth";

/**
 * Finance tools. Every figure comes from `computeReceivables` — the same
 * pure function behind the receivables page and the customer page — so the
 * assistant explains numbers the portal already shows and never adds its
 * own. Amounts stay per currency; the tools return no VND/USD sum and the
 * system prompt forbids inventing one.
 */

const formulas = {
  vi: {
    invoiceRemaining:
      "Còn thiếu của hóa đơn = giá trị hóa đơn − tiền đã gắn vào hóa đơn − tiền cọc của đơn được áp dụng (hạn sớm nhất trước).",
    credit:
      "Trả trước/dư của khách = tiền đã thu − tiền đã hoàn − phần các hóa đơn thực sự tiêu thụ.",
    balance:
      "Cân đối = còn phải thu − trả trước; âm nghĩa là khách đang trả dư.",
    currencies:
      "USD và VND được tính riêng, không cộng chung; doanh thu quy đổi VND chỉ dùng tỷ giá đã chốt trên từng hóa đơn USD.",
    source:
      "Số liệu từ sổ hóa đơn (INV) và phiếu thu đã ghi trong hệ thống; chưa đối soát với sao kê ngân hàng.",
  },
  en: {
    invoiceRemaining:
      "Invoice remaining = invoice amount − payments allocated to it − order deposits applied (earliest due first).",
    credit:
      "Customer credit = receipts − refunds − what invoices actually consumed.",
    balance:
      "Balance = outstanding − credit; negative means the customer is in advance.",
    currencies:
      "USD and VND are computed separately and never summed; VND revenue uses only the rate snapshotted on each USD invoice.",
    source:
      "Figures come from the invoices (INV) and receipts recorded in the system; not reconciled against a bank statement.",
  },
} as const;

function stripDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

const findCustomerInput = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .describe("Part of the customer name or the accountant's customer code."),
  limit: z.number().int().min(1).max(20).default(10),
});

export const findCustomerTool: AssistantTool<
  z.infer<typeof findCustomerInput>
> = {
  name: "find_customer",
  description:
    "Find customer records by name or code (diacritics-insensitive). Returns candidates with id, name, code, country and status. When several match, ask the user which one before doing anything else. Contact details are included only when the user holds customers.readSensitive.",
  inputSchema: findCustomerInput,
  requires: ["customers.read"],
  async run(input, context) {
    return guarded(async () => {
      await context.auth.requirePermission("customers.read");
      const coverages = await context.auth.coverages([
        "customers.readSensitive",
      ] as const);
      const sensitive = coverages["customers.readSensitive"].global;
      const needle = stripDiacritics(input.query);
      const customers = (await context.services.customers.list({}))
        .filter(
          (customer) =>
            stripDiacritics(customer.name).includes(needle) ||
            (customer.code
              ? stripDiacritics(customer.code).includes(needle)
              : false),
        )
        .slice(0, input.limit);
      return {
        ok: true,
        data: {
          items: customers.map((customer) => ({
            id: customer.id,
            name: customer.name,
            code: customer.code,
            country: customer.country,
            status: customer.status,
            defaultCurrency: customer.defaultCurrency,
            ...(sensitive
              ? { email: customer.email, phone: customer.phone }
              : {}),
          })),
          ambiguous: customers.length > 1,
        },
        sources: customers.slice(0, 5).map((customer) => ({
          label: customer.name,
          href: adminHref(context.locale, `/customers/${customer.id}`),
        })),
      };
    });
  },
};

function customerRowsView(report: ReceivablesReport, context: ToolContext) {
  return report.customers.map((row) => ({
    customerId: row.customerId,
    customerName: row.customerName,
    currency: row.currency,
    invoiced: moneyView(row.invoiced, context.locale),
    received: moneyView(row.received, context.locale),
    refunded: moneyView(row.refunded, context.locale),
    outstanding: moneyView(row.outstanding, context.locale),
    credit: moneyView(row.credit, context.locale),
    balance: moneyView(row.balance, context.locale),
    overdueInvoiceCount: row.overdueInvoiceCount,
  }));
}

function invoiceRowsView(report: ReceivablesReport, context: ToolContext) {
  return report.invoices.map((row) => ({
    invoiceId: row.invoice.id,
    invoiceNumber: row.invoice.invoiceNumber,
    orderCode: row.invoice.orderCode,
    customerName: row.invoice.customerName,
    issuedDate: isoDay(row.invoice.issuedAt),
    dueDate: isoDay(row.invoice.dueAt),
    amount: moneyView(row.invoice.amount, context.locale),
    paid: moneyView(row.paid, context.locale),
    depositApplied: moneyView(row.depositApplied, context.locale),
    remaining: moneyView(row.remaining, context.locale),
    overdue: row.overdue,
  }));
}

const customerReceivablesInput = z.object({
  customerId: objectIdSchema.describe("The customer id from find_customer."),
});

export const getCustomerReceivablesTool: AssistantTool<
  z.infer<typeof customerReceivablesInput>
> = {
  name: "get_customer_receivables",
  description:
    "Receivables of one customer as the portal computes them: per currency invoiced, received, refunded, outstanding, credit (advance) and balance, plus every active invoice with its remaining amount and overdue flag, and the formulas used. Use for 'check the debt of customer X', 'reconcile customer X'. Never add USD and VND together.",
  inputSchema: customerReceivablesInput,
  requires: ["receivables.read"],
  async run(input, context) {
    return guarded(async () => {
      await context.auth.requireListAccess("receivables.read");
      const customer = await context.services.customers.findById(
        input.customerId,
      );
      if (!customer) return notFound("Customer");
      const report = await context.services.finance.customerReceivables(
        customer.id,
        context.now,
      );
      return {
        ok: true,
        data: {
          customer: {
            id: customer.id,
            name: customer.name,
            code: customer.code,
          },
          dataAt: context.now.toISOString(),
          customerRows: customerRowsView(report, context),
          invoices: invoiceRowsView(report, context),
          orders: report.orders.map((row) => ({
            orderCode: row.orderCode,
            currency: row.currency,
            invoiced: moneyView(row.invoiced, context.locale),
            paid: moneyView(row.paid, context.locale),
            deposits: moneyView(row.deposits, context.locale),
            remaining: moneyView(row.remaining, context.locale),
          })),
          formulas: formulas[context.locale],
        },
        sources: [
          {
            label: customer.name,
            href: adminHref(context.locale, `/customers/${customer.id}`),
          },
          {
            label:
              context.locale === "vi" ? "Công nợ khách hàng" : "Receivables",
            href: adminHref(context.locale, "/finance/receivables"),
          },
        ],
      };
    });
  },
};

const overviewInput = z.object({
  limit: z.number().int().min(1).max(50).default(20),
});

export const getReceivablesOverviewTool: AssistantTool<
  z.infer<typeof overviewInput>
> = {
  name: "get_receivables_overview",
  description:
    "Totals of customer receivables inside the user's scope (outstanding and credit per currency, count of overdue invoices), the overdue invoices, and the customers with an open balance. Use for 'who owes us', 'which invoices are overdue', 'total receivables'.",
  inputSchema: overviewInput,
  requires: ["receivables.read"],
  async run(input, context) {
    return guarded(async () => {
      const { scope } =
        await context.auth.requireListAccess("receivables.read");
      const report = await context.services.finance.receivables(
        toFinanceScope(scope),
        context.now,
      );
      const overdue = report.invoices.filter((row) => row.overdue);
      return {
        ok: true,
        data: {
          dataAt: context.now.toISOString(),
          totals: {
            outstanding: report.totals.outstanding.map((total) =>
              moneyView(total, context.locale),
            ),
            credit: report.totals.credit.map((total) =>
              moneyView(total, context.locale),
            ),
            overdueInvoiceCount: report.totals.overdueInvoiceCount,
          },
          overdueInvoices: invoiceRowsView(
            { ...report, invoices: overdue.slice(0, input.limit) },
            context,
          ),
          customersWithBalance: customerRowsView(report, context)
            .filter(
              (row) =>
                row.outstanding.amount !== "0" &&
                row.outstanding.amount !== "0.00",
            )
            .slice(0, input.limit),
          formulas: formulas[context.locale],
        },
        sources: [
          {
            label:
              context.locale === "vi" ? "Công nợ khách hàng" : "Receivables",
            href: adminHref(context.locale, "/finance/receivables"),
          },
        ],
      };
    });
  },
};

function toFinanceScope(scope: ListReadScope) {
  return scope.kind === "all"
    ? ({ kind: "all" } as const)
    : scope.kind === "businessUnits"
      ? ({
          kind: "businessUnits",
          businessUnitIds: scope.businessUnitIds,
        } as const)
      : ({ kind: "own", userId: scope.userId } as const);
}
