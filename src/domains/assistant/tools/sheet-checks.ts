import { z } from "zod";

import {
  adminHref,
  guarded,
  moneyView,
  notFound,
  objectIdSchema,
} from "@/domains/assistant/tools/shared";
import type {
  AssistantTool,
  ToolContext,
} from "@/domains/assistant/tools/types";
import type { Permission } from "@/domains/identity/permissions";
import type { OrderRecordDto } from "@/domains/orders/contracts";
import {
  isTerminalStage,
  orderStageDefinitions,
} from "@/domains/orders/workflow";
import {
  columnLabel,
  fieldLabels,
  isMoneyField,
  sheetCheckReadPermissions,
  sheetCheckStatuses,
  sheetCheckTemplates,
  templateLabels,
  type CanonicalField,
  type CheckSummary,
  type ParsedRow,
  type RowOutcome,
  type RowSystemView,
  type SheetCheckAuthorizationView,
  type SheetCheckDto,
  type SheetRowDto,
  type SystemOnlyItem,
  type TotalsLine,
} from "@/domains/sheet-checks/contracts";
import {
  renderIssue,
  worstSeverity,
  type Issue,
  type IssueCode,
} from "@/domains/sheet-checks/issues";
import { sheetCheckLimits } from "@/domains/sheet-checks/limits";
import type { SheetCheckService } from "@/domains/sheet-checks/service";
import { addBusinessDays, formatBusinessDay } from "@/domains/tasks/policy";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";
import type { Money } from "@/lib/money";

/**
 * Spreadsheet-check tools. A check is read exactly the way the portal reads
 * it: `documents.read` on the check itself plus every permission the run
 * exercised, re-evaluated by the injected guard before the service is
 * touched — so a money comparison is never described to someone who may not
 * see money. Results are summaries and single rows, never the grid, and the
 * follow-up tool only drafts proposals with server-templated titles that
 * carry no amount and no cell text.
 */

type Locale = ToolContext["locale"];

function sheetChecksOf(context: ToolContext): SheetCheckService {
  return context.services.sheetChecks;
}

const caveats = {
  vi: [
    "Kết quả so với sổ hóa đơn và phiếu thu đã ghi trong hệ thống; chưa đối soát với sao kê ngân hàng.",
    "Kiểm tra chỉ đọc: không ghi gì vào đơn hàng, hóa đơn, phiếu thu hay công nợ.",
  ],
  en: [
    "Figures are compared with the invoices and receipts recorded in the system; not reconciled against a bank statement.",
    "The check is read-only: nothing is written to orders, invoices, receipts or receivables.",
  ],
} as const;

/** Two guards for one action: the union of what each evaluated. */
function mergeAccess(base: AccessContext, extra: AccessContext): AccessContext {
  return { ...base, permissions: [...base.permissions, ...extra.permissions] };
}

/**
 * The read rule of a check, judged by the caller's guard: `documents.read`
 * on the check (creator, units) and every stamped permission on the same
 * units. A global check carries no units, so a unit-bound grant never
 * reaches it. Null means the check does not exist.
 */
async function authorizeRead(
  context: ToolContext,
  checkId: string,
): Promise<{
  target: SheetCheckAuthorizationView;
  access: AccessContext;
} | null> {
  const target = await sheetChecksOf(context).findForAuthorization(checkId);
  if (!target) return null;
  let access = await context.auth.requirePermission("documents.read", {
    resourceId: target.id,
    ownerUserId: target.createdByUserId,
    businessUnitIds: target.businessUnitIds,
  });
  for (const permission of target.requiredPermissions) {
    access = mergeAccess(
      access,
      await context.auth.requirePermission(permission, {
        resourceId: target.id,
        businessUnitIds: target.businessUnitIds,
      }),
    );
  }
  return { target, access };
}

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */

function issueView(entry: Issue, locale: Locale) {
  return {
    code: entry.code,
    severity: entry.severity,
    column: entry.columnIndex === null ? null : columnLabel(entry.columnIndex),
    text: renderIssue(entry, locale),
  };
}

function summaryView(summary: CheckSummary) {
  return {
    dataRows: summary.dataRows,
    skippedRows: summary.skippedRows,
    errors: summary.errors,
    warnings: summary.warnings,
    infos: summary.infos,
    outcomes: summary.outcomes,
  };
}

function totalsView(lines: readonly TotalsLine[], locale: Locale) {
  return lines.map((line) => ({
    field: line.field,
    fieldLabel: fieldLabels[line.field][locale],
    column: columnLabel(line.columnIndex),
    currency: line.currency,
    computed: moneyView(
      { amount: line.computed, currency: line.currency },
      locale,
    ),
    sheetTotal:
      line.sheetTotal === null
        ? null
        : moneyView(
            { amount: line.sheetTotal, currency: line.currency },
            locale,
          ),
    rowsCounted: line.rowsCounted,
    rowsSkipped: line.rowsSkipped,
    // Absent, not null, on a run that could not compare money: the key
    // itself must not appear in a restricted reader's payload.
    ...(line.system === null
      ? {}
      : {
          system: moneyView(
            { amount: line.system, currency: line.currency },
            locale,
          ),
        }),
  }));
}

function systemOnlyView(items: readonly SystemOnlyItem[], locale: Locale) {
  return items.map((item) => ({
    kind: item.kind,
    label: item.label,
    day: item.day,
    ...(item.amount ? { amount: moneyView(item.amount, locale) } : {}),
    text: renderIssue(item.issue, locale),
  }));
}

/** Non-null parsed fields only; money through the money module. */
function parsedView(
  parsed: ParsedRow,
  locale: Locale,
): Record<string, unknown> {
  const view: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (value === null) continue;
    const field = key as CanonicalField;
    view[key] = isMoneyField(field) ? moneyView(value as Money, locale) : value;
  }
  return view;
}

/**
 * The system side exactly as the row stores it: each key appears only when
 * the run stored it, so a restricted run yields at most `order`/`customer`
 * and never a money key — not even as null.
 */
function systemView(
  system: RowSystemView,
  locale: Locale,
): Record<string, unknown> {
  const view: Record<string, unknown> = {};
  if (system.order !== undefined) {
    view.order = system.order
      ? {
          orderCode: system.order.orderCode,
          stage: system.order.stage,
          stageLabel: orderStageDefinitions[system.order.stage].labels[locale],
          customerName: system.order.customerName,
          ...(system.order.sellingPrice
            ? { sellingPrice: moneyView(system.order.sellingPrice, locale) }
            : {}),
        }
      : null;
  }
  if (system.customer !== undefined) {
    view.customer = system.customer
      ? { name: system.customer.name, code: system.customer.code }
      : null;
  }
  if (system.invoice !== undefined) {
    const invoice = system.invoice;
    view.invoice = invoice
      ? {
          invoiceNumber: invoice.invoiceNumber,
          orderCode: invoice.orderCode,
          customerName: invoice.customerName,
          amount: moneyView(invoice.amount, locale),
          paid: moneyView(invoice.paid, locale),
          depositApplied: moneyView(invoice.depositApplied, locale),
          remaining: moneyView(invoice.remaining, locale),
          issuedDay: invoice.issuedDay,
          dueDay: invoice.dueDay,
          status: invoice.status,
          voidReason: invoice.voidReason,
        }
      : null;
  }
  if (system.receipts !== undefined) {
    view.receipts = system.receipts.map((receipt) => ({
      occurredDay: receipt.occurredDay,
      amount: moneyView(receipt.amount, locale),
      counterparty: receipt.counterparty,
      method: receipt.method,
      allocations: receipt.allocations,
      status: receipt.status,
      voidReason: receipt.voidReason,
    }));
  }
  if (system.candidates !== undefined) {
    view.candidates = system.candidates.map((candidate) => ({
      occurredDay: candidate.occurredDay,
      amount: moneyView(candidate.amount, locale),
      why: candidate.why,
      usedByRowIndex: candidate.usedByRowIndex,
    }));
  }
  if (system.balance !== undefined) {
    const balance = system.balance;
    view.balance = balance
      ? {
          customerName: balance.customerName,
          currency: balance.currency,
          invoiced: moneyView(balance.invoiced, locale),
          received: moneyView(balance.received, locale),
          refunded: moneyView(balance.refunded, locale),
          outstanding: moneyView(balance.outstanding, locale),
          credit: moneyView(balance.credit, locale),
          balance: moneyView(balance.balance, locale),
          overdueInvoiceCount: balance.overdueInvoiceCount,
        }
      : null;
  }
  if (system.matchStrength !== undefined) {
    view.matchStrength = system.matchStrength;
  }
  return view;
}

function checkHeadView(check: SheetCheckDto, context: ToolContext) {
  return {
    id: check.id,
    fileName: check.fileName,
    template: check.template,
    templateLabel: templateLabels[check.template][context.locale],
    status: check.status,
    sheetName: check.sheetName,
    dataRows: check.dataRowCount,
    createdDay: formatBusinessDay(check.createdAt, context.timeZone),
    checkedDay: check.checkedAt
      ? formatBusinessDay(check.checkedAt, context.timeZone)
      : null,
    mine: check.createdByUserId === context.userId,
    requiredPermissions: check.requiredPermissions,
  };
}

function checkSources(check: SheetCheckDto, locale: Locale) {
  return [
    {
      label: check.fileName,
      href: adminHref(locale, `/checks/${check.id}`),
    },
    {
      label: locale === "vi" ? "Kiểm tra bảng biểu" : "Sheet checks",
      href: adminHref(locale, "/checks"),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* list_sheet_checks                                                   */
/* ------------------------------------------------------------------ */

const listInput = z.object({
  template: z
    .enum(sheetCheckTemplates)
    .optional()
    .describe("Only checks of this template."),
  status: z
    .enum(sheetCheckStatuses)
    .optional()
    .describe(
      "`mapping` = uploaded but not run yet; `checked` = has a result.",
    ),
  limit: z.number().int().min(1).max(20).default(10),
  offset: z.number().int().min(0).max(10_000).default(0),
});

export const listSheetChecksTool: AssistantTool<z.infer<typeof listInput>> = {
  name: "list_sheet_checks",
  description:
    "List spreadsheet checks ('kiểm tra bảng biểu, dư nợ') the signed-in user may open: uploaded cash-received reports, receivables statements and order lists compared with the system. Returns per check the file name, template, status, row count and the error/warning counts — never the rows. Use it for 'which sheets were checked', 'the last cash report check'.",
  inputSchema: listInput,
  requires: ["documents.read"],
  async run(input, context) {
    return guarded(async () => {
      const { context: access } =
        await context.auth.requireListAccess("documents.read");
      const coverages = await context.auth.coverages(sheetCheckReadPermissions);
      const checks = await sheetChecksOf(context).listForReader(
        access,
        coverages,
        {
          ...(input.template ? { template: input.template } : {}),
          ...(input.status ? { status: input.status } : {}),
          limit: input.limit,
          offset: input.offset,
        },
      );
      return {
        ok: true,
        data: {
          items: checks.map((check) => ({
            ...checkHeadView(check, context),
            errors: check.result?.summary.errors ?? null,
            warnings: check.result?.summary.warnings ?? null,
            outcomes: check.result?.summary.outcomes ?? null,
          })),
          total: checks.length,
          offset: input.offset,
        },
        sources: [
          {
            label:
              context.locale === "vi" ? "Kiểm tra bảng biểu" : "Sheet checks",
            href: adminHref(context.locale, "/checks"),
          },
        ],
      };
    });
  },
};

/* ------------------------------------------------------------------ */
/* get_sheet_check                                                     */
/* ------------------------------------------------------------------ */

const getInput = z.object({
  checkId: objectIdSchema.describe("The check id from list_sheet_checks."),
});

const errorRowsShown = 20;
const systemOnlyShown = 20;
const issuesPerRowShown = 10;

export const getSheetCheckTool: AssistantTool<z.infer<typeof getInput>> = {
  name: "get_sheet_check",
  description:
    "Read the result of one spreadsheet check: the summary (rows, outcomes, error/warning counts), the totals per money column and currency, the sheet-level findings, the system records absent from the sheet, and up to twenty rows with errors (row number, outcome, finding sentences). Never returns the whole grid; use get_sheet_check_row for one row. The check compares the sheet with the invoices and receipts in the system — not with a bank statement.",
  inputSchema: getInput,
  requires: ["documents.read"],
  async run(input, context) {
    return guarded(async () => {
      const authorized = await authorizeRead(context, input.checkId);
      if (!authorized) return notFound("Sheet check");
      const service = sheetChecksOf(context);
      const check = await service.get(authorized.access, input.checkId);
      const head = checkHeadView(check, context);
      const intakeIssues = check.intakeIssues.map((entry) =>
        issueView(entry, context.locale),
      );

      if (check.status !== "checked" || !check.result) {
        return {
          ok: true,
          data: {
            ...head,
            summary: null,
            intakeIssues,
            proposal: {
              headerFound: check.proposal.headerFound,
              headerSheetRowNumber: check.proposal.headerSheetRowNumber,
              columns: check.proposal.columns.map((column) => ({
                column: columnLabel(column.columnIndex),
                header: column.header,
                field: column.field,
                fieldLabel: fieldLabels[column.field][context.locale],
                confidence: column.confidence,
              })),
            },
            nextStep:
              context.locale === "vi"
                ? "Bản kiểm tra chưa chạy: mở trang để xác nhận cột rồi bấm Chạy kiểm tra."
                : "The check has not run yet: open it, confirm the columns and run it.",
            caveats: caveats[context.locale],
          },
          sources: checkSources(check, context.locale),
        };
      }

      const result = check.result;
      const { rows, issueRowCount } = await service.listRows(
        authorized.access,
        check.id,
        { offset: 0, limit: errorRowsShown, minSeverity: "error" },
      );
      return {
        ok: true,
        data: {
          ...head,
          dataAt: result.dataAt.toISOString(),
          summary: summaryView(result.summary),
          totals: totalsView(result.summary.totals, context.locale),
          sheetIssues: result.sheetIssues.map((entry) =>
            issueView(entry, context.locale),
          ),
          intakeIssues,
          systemOnly: systemOnlyView(
            result.systemOnly.slice(0, systemOnlyShown),
            context.locale,
          ),
          systemOnlyTotal: result.systemOnly.length,
          rowsWithErrors: issueRowCount,
          errorRows: rows.map((row) => ({
            sheetRowNumber: row.sheetRowNumber,
            rowIndex: row.index,
            outcome: row.result?.outcome ?? null,
            worst: worstSeverity(row.result?.issues ?? []),
            issues: (row.result?.issues ?? [])
              .slice(0, issuesPerRowShown)
              .map((entry) => renderIssue(entry, context.locale)),
          })),
          caveats: caveats[context.locale],
        },
        sources: checkSources(check, context.locale),
      };
    });
  },
};

/* ------------------------------------------------------------------ */
/* get_sheet_check_row                                                 */
/* ------------------------------------------------------------------ */

const rowInput = z
  .object({
    checkId: objectIdSchema.describe("The check id."),
    rowIndex: z
      .number()
      .int()
      .min(0)
      .max(sheetCheckLimits.sheetRowsCap)
      .optional()
      .describe("0-based stored row index, as returned by get_sheet_check."),
    sheetRowNumber: z
      .number()
      .int()
      .min(1)
      .max(1_048_576)
      .optional()
      .describe("1-based row number as the person sees it in Excel."),
  })
  .refine(
    (value) =>
      value.rowIndex !== undefined || value.sheetRowNumber !== undefined,
    { message: "rowIndex or sheetRowNumber is required" },
  );

/**
 * Stored rows follow the sheet order without gaps, so the row usually sits
 * at `sheetRowNumber − header − 1`; the guess is verified and a paged scan
 * covers two-row headers and any other offset.
 */
async function locateRow(
  service: SheetCheckService,
  access: AccessContext,
  check: SheetCheckDto,
  sheetRowNumber: number,
): Promise<SheetRowDto | null> {
  const header = check.proposal.headerSheetRowNumber;
  if (header !== null) {
    const guess = sheetRowNumber - header - 1;
    if (guess >= 0 && guess < check.rowCount) {
      const { rows } = await service.listRows(access, check.id, {
        offset: guess,
        limit: 1,
      });
      const row = rows[0];
      if (row && row.sheetRowNumber === sheetRowNumber) return row;
    }
  }
  const pageSize = sheetCheckLimits.rowsPageSize;
  for (let offset = 0; offset < check.rowCount; offset += pageSize) {
    const { rows } = await service.listRows(access, check.id, {
      offset,
      limit: pageSize,
    });
    const hit = rows.find((row) => row.sheetRowNumber === sheetRowNumber);
    if (hit) return hit;
    const last = rows[rows.length - 1];
    if (
      rows.length < pageSize ||
      !last ||
      last.sheetRowNumber > sheetRowNumber
    ) {
      break;
    }
  }
  return null;
}

export const getSheetCheckRowTool: AssistantTool<z.infer<typeof rowInput>> = {
  name: "get_sheet_check_row",
  description:
    "Read one row of a spreadsheet check by its Excel row number (or stored row index): the cells as text with their headers, the parsed fields, every finding sentence, and what the system held for that row (order, customer, matched receipts, invoice or balance — only what the check was allowed to compare). Use it for 'why is row 12 flagged', 'what did the system have for that line'.",
  inputSchema: rowInput,
  requires: ["documents.read"],
  async run(input, context) {
    return guarded(async () => {
      const authorized = await authorizeRead(context, input.checkId);
      if (!authorized) return notFound("Sheet check");
      const service = sheetChecksOf(context);
      const check = await service.get(authorized.access, input.checkId);
      const row =
        input.rowIndex !== undefined
          ? await service.findRow(authorized.access, check.id, input.rowIndex)
          : await locateRow(
              service,
              authorized.access,
              check,
              input.sheetRowNumber!,
            );
      if (!row) return notFound("Row");

      const headers = new Map(
        check.proposal.columns.map((column) => [
          column.columnIndex,
          column.header,
        ]),
      );
      const fields = new Map(
        check.mapping.columns.map((column) => [
          column.columnIndex,
          column.field,
        ]),
      );
      const result = row.result;
      return {
        ok: true,
        data: {
          checkId: check.id,
          fileName: check.fileName,
          template: check.template,
          sheetRowNumber: row.sheetRowNumber,
          rowIndex: row.index,
          kind: row.kind,
          hidden: row.hidden,
          outcome: result?.outcome ?? null,
          worst: worstSeverity(result?.issues ?? []),
          cells: row.cells.map((cell, index) => ({
            column: columnLabel(index),
            header: headers.get(index) ?? null,
            field: fields.get(index) ?? null,
            text: cell.text,
          })),
          parsed: result ? parsedView(result.parsed, context.locale) : null,
          issues: (result?.issues ?? []).map((entry) =>
            issueView(entry, context.locale),
          ),
          ...(result?.system
            ? { system: systemView(result.system, context.locale) }
            : {}),
          caveats: caveats[context.locale],
        },
        sources: checkSources(check, context.locale),
      };
    });
  },
};

/* ------------------------------------------------------------------ */
/* propose_sheet_check_follow_ups                                      */
/* ------------------------------------------------------------------ */

const followUpsInput = z.object({
  checkId: objectIdSchema.describe(
    "The checked sheet to draft follow-ups for.",
  ),
  maxItems: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(10)
    .describe("At most this many rows, taken in sheet order."),
  assigneeUserId: objectIdSchema
    .optional()
    .describe(
      "Assign the follow-ups to this colleague (needs tasks.assign); default: the signed-in user.",
    ),
});

const followUpOutcomes: ReadonlySet<RowOutcome> = new Set([
  "mismatch",
  "notFound",
  "invalid",
]);

/** Fixed, digit-free labels per finding family; never the finding's params. */
function followUpLabel(code: IssueCode): string {
  if (code === "RECEIPT_NOT_FOUND") return "phiếu thu chưa có";
  if (code === "RECEIPT_AMOUNT_MISMATCH") return "lệch số tiền phiếu thu";
  if (code === "RECEIPT_VOIDED") return "phiếu thu đã hủy";
  if (code.startsWith("RECEIPT_")) return "phiếu thu chưa khớp";
  if (code === "CURRENCY_MISMATCH") return "lệch loại tiền";
  if (code === "ORDER_NOT_FOUND") return "không thấy đơn";
  if (
    code.startsWith("BALANCE_") ||
    code === "ROW_ARITHMETIC_MISMATCH" ||
    code === "ORDER_REMAINING_MISMATCH" ||
    code === "OPENING_MISMATCH" ||
    code.endsWith("_PERIOD_MISMATCH")
  ) {
    return "lệch dư nợ";
  }
  if (code.startsWith("INVOICE_")) return "hóa đơn chưa khớp";
  if (code.startsWith("DUPLICATE_")) return "dòng trùng";
  if (code.startsWith("CUSTOMER_")) return "khách chưa khớp";
  if (code.startsWith("SELLING_PRICE_")) return "lệch giá bán";
  if (code.startsWith("AMOUNT_") || code.startsWith("CURRENCY_")) {
    return "số tiền không đọc được";
  }
  if (code.startsWith("DATE_")) return "ngày không hợp lệ";
  if (
    code.startsWith("CODE_") ||
    code === "REQUIRED_EMPTY" ||
    code === "CELL_ERROR_VALUE" ||
    code === "FORMULA_NO_CACHE"
  ) {
    return "ô không đọc được";
  }
  return "cần xem lại";
}

type FollowUpRow = {
  sheetRowNumber: number;
  label: string;
  orderCode: string | null;
};

/** Rows whose comparison failed, in sheet order, capped at `maxItems`. */
async function collectFollowUpRows(
  service: SheetCheckService,
  access: AccessContext,
  check: SheetCheckDto,
  maxItems: number,
): Promise<FollowUpRow[]> {
  const pageSize = sheetCheckLimits.rowsPageSize;
  const selected: FollowUpRow[] = [];
  for (
    let offset = 0;
    offset < check.rowCount && selected.length < maxItems;
    offset += pageSize
  ) {
    const { rows } = await service.listRows(access, check.id, {
      offset,
      limit: pageSize,
      minSeverity: "error",
    });
    for (const row of rows) {
      const result = row.result;
      if (!result || !followUpOutcomes.has(result.outcome)) continue;
      const driver =
        result.issues.find((entry) => entry.severity === "error") ??
        result.issues[0];
      selected.push({
        sheetRowNumber: row.sheetRowNumber,
        label: driver ? followUpLabel(driver.code) : "cần xem lại",
        orderCode: result.system?.order?.orderCode ?? null,
      });
      if (selected.length >= maxItems) break;
    }
    if (rows.length < pageSize) break;
  }
  return selected;
}

const fileNameShown = 60;

function followUpTitle(check: SheetCheckDto, row: FollowUpRow): string {
  const fileName =
    check.fileName.length > fileNameShown
      ? `${check.fileName.slice(0, fileNameShown - 1)}…`
      : check.fileName;
  return `Kiểm tra dòng ${row.sheetRowNumber} «${fileName}»: ${row.label}`;
}

export const proposeSheetCheckFollowUpsTool: AssistantTool<
  z.infer<typeof followUpsInput>
> = {
  name: "propose_sheet_check_follow_ups",
  description:
    "Draft follow-up work items from a checked spreadsheet: one item per row whose comparison failed (receipt not found, amount or balance mismatch, order not found, unreadable cell…), grouped into one proposal per matched order plus one for the remaining rows, due in three days. Titles name the row and the file only — no amounts. The result is a PROPOSAL the user confirms in the portal; no task exists until then. Never claim a task was created.",
  inputSchema: followUpsInput,
  requires: ["documents.read", "tasks.create"],
  async run(input, context) {
    return guarded(async () => {
      const authorized = await authorizeRead(context, input.checkId);
      if (!authorized) return notFound("Sheet check");
      const service = sheetChecksOf(context);
      const check = await service.get(authorized.access, input.checkId);
      if (check.status !== "checked" || !check.result) {
        return {
          ok: false,
          code: "INVALID_STATE",
          message: "The check has not been run yet; nothing to follow up.",
        };
      }

      const rows = await collectFollowUpRows(
        service,
        authorized.access,
        check,
        input.maxItems,
      );
      const assumptions: string[] = [];
      const vi = context.locale === "vi";

      // Rows that matched an order are grouped under it, provided the
      // proposer may read that order and it is still open; anything else
      // joins the order-less group rather than failing the whole request.
      const orders = new Map<string, OrderRecordDto | null>();
      for (const code of new Set(
        rows.flatMap((row) => (row.orderCode ? [row.orderCode] : [])),
      )) {
        const raw =
          await context.services.orders.findByCodeForAuthorization(code);
        let order: OrderRecordDto | null = null;
        if (raw) {
          try {
            await context.auth.requirePermission("orders.read", {
              resourceId: raw.id,
              businessUnitIds: raw.businessUnitIds,
            });
            order = raw;
          } catch (error) {
            if (!(error instanceof ContentAccessDeniedError)) throw error;
          }
        }
        if (order && isTerminalStage(order.stage)) {
          assumptions.push(
            vi
              ? `Đơn ${code} đã đóng/hủy; việc theo dõi không gắn vào đơn.`
              : `Order ${code} is closed or cancelled; the follow-up is not linked to it.`,
          );
          order = null;
        } else if (!order) {
          assumptions.push(
            vi
              ? `Đơn ${code} không đọc được trong phạm vi của bạn; việc theo dõi không gắn vào đơn.`
              : `Order ${code} is not readable in your scope; the follow-up is not linked to it.`,
          );
        }
        orders.set(code, order);
      }

      const groups = new Map<string | null, FollowUpRow[]>();
      for (const row of rows) {
        const order = row.orderCode ? orders.get(row.orderCode) : null;
        const key = order ? order.orderCode : null;
        groups.set(key, [...(groups.get(key) ?? []), row]);
      }
      // The order-less group goes last so the reader meets the linked ones first.
      const orderedGroups = [
        ...[...groups.entries()].filter(([key]) => key !== null),
        ...[...groups.entries()].filter(([key]) => key === null),
      ];

      const coverage = (
        await context.auth.coverages(["tasks.create"] as const)
      )["tasks.create"];
      const fallbackUnits =
        check.businessUnitIds.length > 0
          ? [...check.businessUnitIds]
          : coverage.global
            ? []
            : [...coverage.businessUnitIds];
      const assigneeUserId = input.assigneeUserId ?? context.userId;
      const needsAssign = assigneeUserId !== context.userId;
      const today = formatBusinessDay(context.now, context.timeZone);
      const dueDate = addBusinessDays(today, 3);

      const proposals: {
        proposalId: string;
        status: string;
        orderCode: string | null;
        itemCount: number;
        items: { index: number; title: string; dueDate: string | null }[];
      }[] = [];
      for (const [key, groupRows] of orderedGroups) {
        const order = key === null ? null : (orders.get(key) ?? null);
        const units = order ? [...order.businessUnitIds] : fallbackUnits;
        let access = await context.auth.requirePermission("tasks.create", {
          businessUnitIds: units,
          ownerUserId: context.userId,
        });
        if (needsAssign) {
          access = mergeAccess(
            access,
            await context.auth.requirePermission("tasks.assign", {
              businessUnitIds: units,
              ownerUserId: context.userId,
            }),
          );
        }
        const proposal = await context.services.proposals.proposeTasks(access, {
          locale: context.locale,
          fallbackBusinessUnitIds: fallbackUnits,
          drafts: groupRows.map((row) => ({
            title: followUpTitle(check, row),
            note: `Kiểm tra bảng biểu ${check.id} · dòng ${row.sheetRowNumber}`,
            dueDate,
            order,
            assigneeUserId,
            priority: "normal" as const,
          })),
        });
        assumptions.push(...proposal.assumptions);
        proposals.push({
          proposalId: proposal.id,
          status: proposal.status,
          orderCode: proposal.orderCode,
          itemCount: proposal.items.length,
          items: proposal.items.map((item) => ({
            index: item.index,
            title: item.title,
            dueDate: item.dueDate,
          })),
        });
      }

      return {
        ok: true,
        data: {
          checkId: check.id,
          fileName: check.fileName,
          rowsProposed: rows.length,
          proposals,
          assumptions,
          nextStep:
            rows.length === 0
              ? vi
                ? "Không có dòng nào cần theo dõi: mọi dòng đều khớp hoặc chỉ có cảnh báo."
                : "No row needs a follow-up: every row matched or carries warnings only."
              : "The user must confirm these proposals in the portal before any task is created.",
        },
        sources: [
          {
            label: vi ? "Đề xuất chờ duyệt" : "Pending proposals",
            href: adminHref(context.locale, "/tasks#proposals"),
          },
          {
            label: check.fileName,
            href: adminHref(context.locale, `/checks/${check.id}`),
          },
        ],
      };
    });
  },
};

/** The four tools, in registry order. */
export const sheetCheckTools = [
  listSheetChecksTool,
  getSheetCheckTool,
  getSheetCheckRowTool,
  proposeSheetCheckFollowUpsTool,
] as unknown as readonly AssistantTool<never>[];

export const sheetCheckToolPermissions: readonly Permission[] = [
  ...new Set(sheetCheckTools.flatMap((tool) => tool.requires)),
];
