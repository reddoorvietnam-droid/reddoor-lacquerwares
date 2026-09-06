import type { Permission } from "@/domains/identity/permissions";
import {
  columnLabel,
  type RowOutcome,
  type RowSystemView,
  type SheetCheckDto,
  type SheetCheckTemplate,
  type SheetRowDto,
  type SheetRowKind,
} from "@/domains/sheet-checks/contracts";
import {
  renderIssue,
  worstSeverity,
  type IssueSeverity,
} from "@/domains/sheet-checks/issues";
import { formatBusinessDay } from "@/domains/tasks/policy";
import type { Money } from "@/lib/money";

/**
 * The CSV a reader takes back to the Zalo group: the grid as parsed, one
 * line per stored row, with the outcome and the rendered findings beside
 * it. The system-side figures travel only when the check itself carries the
 * money permission — the same rule that gates the page — so an export can
 * never say more than the screen.
 *
 * Every field goes through the injection guard: spreadsheet programs
 * evaluate a cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage
 * return, so those get a leading apostrophe. Cell text is data here, never
 * a formula, and this file never writes a formula cell.
 */

type ExportLocale = "vi" | "en";

const copy: Record<
  ExportLocale,
  {
    row: string;
    kind: string;
    outcome: string;
    severity: string;
    findings: string;
    system: string;
    outcomes: Record<RowOutcome, string>;
    kinds: Record<SheetRowKind, string>;
    severities: Record<IssueSeverity, string>;
    receipt: string;
    invoice: string;
    remaining: string;
    balance: string;
    outstanding: string;
    credit: string;
    sellingPrice: string;
    voided: string;
  }
> = {
  vi: {
    row: "Dòng",
    kind: "Loại",
    outcome: "Kết quả",
    severity: "Mức",
    findings: "Phát hiện",
    system: "Hệ thống",
    outcomes: {
      matched: "Khớp",
      mismatch: "Lệch",
      notFound: "Không thấy",
      notCompared: "Chưa đối chiếu",
      invalid: "Không hợp lệ",
      skipped: "Bỏ qua",
    },
    kinds: {
      data: "Dữ liệu",
      total: "Tổng",
      subtotal: "Tổng phụ",
      group: "Nhóm",
      blank: "Trống",
    },
    severities: { error: "Lỗi", warn: "Cảnh báo", info: "Thông tin" },
    receipt: "Phiếu thu",
    invoice: "Hóa đơn",
    remaining: "còn thiếu",
    balance: "Dư nợ",
    outstanding: "còn phải thu",
    credit: "trả trước",
    sellingPrice: "Giá bán",
    voided: "đã hủy",
  },
  en: {
    row: "Row",
    kind: "Kind",
    outcome: "Outcome",
    severity: "Severity",
    findings: "Findings",
    system: "System",
    outcomes: {
      matched: "Matched",
      mismatch: "Mismatch",
      notFound: "Not found",
      notCompared: "Not compared",
      invalid: "Invalid",
      skipped: "Skipped",
    },
    kinds: {
      data: "Data",
      total: "Total",
      subtotal: "Subtotal",
      group: "Group",
      blank: "Blank",
    },
    severities: { error: "Error", warn: "Warning", info: "Info" },
    receipt: "Receipt",
    invoice: "Invoice",
    remaining: "remaining",
    balance: "Balance",
    outstanding: "outstanding",
    credit: "advance",
    sellingPrice: "Selling price",
    voided: "voided",
  },
};

/**
 * The permissions that govern the money a check may show. incomingCash and
 * receivables carry them as template gates; a generic check carries them
 * only when the run exercised one.
 */
const moneyPermissions: Record<SheetCheckTemplate, readonly Permission[]> = {
  incomingCash: ["payments.read"],
  receivables: ["receivables.read", "invoices.read", "payments.read"],
  generic: ["orders.readSellingPrice", "invoices.read", "payments.read"],
};

/** Whether the check's stamped permissions allow a system-value column. */
export function exportShowsSystemValues(
  check: Pick<SheetCheckDto, "template" | "requiredPermissions">,
): boolean {
  const governing = moneyPermissions[check.template];
  const stamped = new Set(check.requiredPermissions);
  return check.template === "generic"
    ? governing.some((permission) => stamped.has(permission))
    : governing.every((permission) => stamped.has(permission));
}

const INJECTION_LEAD = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",;\t\r\n]|^\s|\s$/;

/** One CSV field: injection-guarded, quoted when needed, quotes doubled. */
export function csvField(value: string): string {
  const guarded = INJECTION_LEAD.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(guarded)
    ? `"${guarded.replace(/"/g, '""')}"`
    : guarded;
}

function moneyText(value: Money): string {
  return `${value.amount} ${value.currency}`;
}

function systemText(
  system: RowSystemView | null,
  locale: ExportLocale,
): string {
  if (!system) return "";
  const text = copy[locale];
  const parts: string[] = [];
  for (const receipt of system.receipts ?? []) {
    const status = receipt.status === "voided" ? ` (${text.voided})` : "";
    parts.push(
      `${text.receipt} ${receipt.occurredDay} ${moneyText(receipt.amount)}${status}`,
    );
  }
  if (system.invoice) {
    const invoice = system.invoice;
    const status = invoice.status === "voided" ? ` (${text.voided})` : "";
    parts.push(
      `${text.invoice} ${invoice.invoiceNumber} ${moneyText(invoice.amount)}, ${text.remaining} ${moneyText(invoice.remaining)}${status}`,
    );
  }
  if (system.balance) {
    const balance = system.balance;
    parts.push(
      `${text.balance} ${moneyText(balance.balance)} (${text.outstanding} ${moneyText(balance.outstanding)}, ${text.credit} ${moneyText(balance.credit)})`,
    );
  }
  if (system.order?.sellingPrice) {
    parts.push(
      `${text.sellingPrice} ${system.order.orderCode} ${moneyText(system.order.sellingPrice)}`,
    );
  }
  return parts.join(" | ");
}

/** `kiem-tra-<template>-<yyyymmdd>-<id6>.csv`, ASCII only. */
export function exportFileName(
  check: Pick<SheetCheckDto, "id" | "template" | "checkedAt" | "createdAt">,
  timeZone: string,
): string {
  const day = formatBusinessDay(
    check.checkedAt ?? check.createdAt,
    timeZone,
  ).replace(/-/g, "");
  const idPart = check.id.slice(-6);
  const raw = `kiem-tra-${check.template}-${day}-${idPart}`;
  return `${raw.replace(/[^A-Za-z0-9-]/g, "-")}.csv`;
}

export function buildCsvExport(input: {
  check: SheetCheckDto;
  rows: readonly SheetRowDto[];
  locale: ExportLocale;
  /** Business zone for the day in the file name; UTC when absent. */
  timeZone?: string;
}): { fileName: string; content: string } {
  const { check, rows, locale } = input;
  const text = copy[locale];
  const showSystem = exportShowsSystemValues(check);
  const headersByColumn = new Map(
    check.proposal.columns.map((column) => [column.columnIndex, column.header]),
  );

  const header: string[] = [text.row, text.kind];
  for (let index = 0; index < check.columnCount; index += 1) {
    const proposed = headersByColumn.get(index) ?? "";
    header.push(proposed.length > 0 ? proposed : columnLabel(index));
  }
  header.push(text.outcome, text.severity, text.findings);
  if (showSystem) header.push(text.system);

  const lines: string[] = [header.map(csvField).join(",")];
  for (const row of rows) {
    const fields: string[] = [String(row.sheetRowNumber), text.kinds[row.kind]];
    for (let index = 0; index < check.columnCount; index += 1) {
      fields.push(row.cells[index]?.text ?? "");
    }
    const result = row.result;
    const worst = result ? worstSeverity(result.issues) : null;
    fields.push(
      result ? text.outcomes[result.outcome] : "",
      worst ? text.severities[worst] : "",
      result
        ? result.issues.map((entry) => renderIssue(entry, locale)).join(" | ")
        : "",
    );
    if (showSystem) fields.push(systemText(result?.system ?? null, locale));
    lines.push(fields.map(csvField).join(","));
  }

  return {
    fileName: exportFileName(check, input.timeZone ?? "UTC"),
    // UTF-8 BOM so Excel opens the Vietnamese text correctly; CRLF per RFC 4180.
    content: `\uFEFF${lines.join("\r\n")}\r\n`,
  };
}
