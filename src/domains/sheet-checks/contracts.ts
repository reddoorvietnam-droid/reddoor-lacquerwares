import { z } from "zod";

import type { AuditRepository } from "@/domains/audit/contracts";
import type {
  CustomerRecordDto,
  CustomerStore,
} from "@/domains/customers/contracts";
import type {
  FinanceEntryRecordDto,
  FinanceEntryStore,
  InvoiceRecordDto,
  InvoiceStore,
} from "@/domains/finance/contracts";
import type { Permission } from "@/domains/identity/permissions";
import type { OrderRecordDto, OrderStore } from "@/domains/orders/contracts";
import type { OrderStage } from "@/domains/orders/workflow";
import type { Issue, IssueSeverity } from "@/domains/sheet-checks/issues";
import { supportedCurrencies, type Currency, type Money } from "@/lib/money";

/**
 * "Kiểm tra bảng biểu, dư nợ": a staff member uploads a spreadsheet that
 * was shared in the Zalo group (a cash-received report, a receivables
 * statement, or any order list) and the system reads it, validates every
 * cell, and compares it with what the portal holds — without ever writing
 * anything back. The result is an immutable record: the grid as parsed,
 * one finding list per row, sheet-level findings, totals and a summary.
 *
 * Reading the result is gated twice: by `documents.read` on the check and by
 * every permission the run exercised (`requiredPermissions`), re-evaluated
 * on each read, so a money comparison never leaks to a reader who may not
 * see money. The original file is never stored (ADR-005/ADR-011): the grid
 * plus the findings is the evidence.
 */

/* ------------------------------------------------------------------ */
/* Enumerations                                                        */
/* ------------------------------------------------------------------ */

export const sheetCheckTemplates = [
  "incomingCash",
  "receivables",
  "generic",
] as const;
export type SheetCheckTemplate = (typeof sheetCheckTemplates)[number];

/** `mapping`: parsed, waiting for the column mapping and the run. `checked`: immutable result. */
export const sheetCheckStatuses = ["mapping", "checked"] as const;
export type SheetCheckStatus = (typeof sheetCheckStatuses)[number];

/** `image` is reserved for the photo path; only `file` is produced today. */
export const sheetCheckSourceKinds = ["file", "image"] as const;
export type SheetCheckSourceKind = (typeof sheetCheckSourceKinds)[number];

export const sheetFileFormats = ["xlsx", "xls", "csv"] as const;
export type SheetFileFormat = (typeof sheetFileFormats)[number];

export const canonicalFields = [
  "orderCode",
  "invoiceNumber",
  "customerName",
  "customerCode",
  "date",
  "dueDate",
  "amount",
  "invoiced",
  "received",
  "refunded",
  "outstanding",
  "openingBalance",
  "currency",
  "method",
  "bankRef",
  "stage",
  "note",
  "ignore",
] as const;
export type CanonicalField = (typeof canonicalFields)[number];

export const moneyFields = [
  "amount",
  "invoiced",
  "received",
  "refunded",
  "outstanding",
  "openingBalance",
] as const satisfies readonly CanonicalField[];
export type MoneyField = (typeof moneyFields)[number];

export const dateFields = [
  "date",
  "dueDate",
] as const satisfies readonly CanonicalField[];
export type DateField = (typeof dateFields)[number];

export const codeFields = [
  "orderCode",
  "invoiceNumber",
  "customerCode",
] as const satisfies readonly CanonicalField[];
export type CodeField = (typeof codeFields)[number];

/** Columns that identify whom or what a row is about. */
export const identityFields = [
  "orderCode",
  "invoiceNumber",
  "customerName",
  "customerCode",
] as const satisfies readonly CanonicalField[];

export function isMoneyField(field: CanonicalField): field is MoneyField {
  return (moneyFields as readonly CanonicalField[]).includes(field);
}

export function isDateField(field: CanonicalField): field is DateField {
  return (dateFields as readonly CanonicalField[]).includes(field);
}

export function isCodeField(field: CanonicalField): field is CodeField {
  return (codeFields as readonly CanonicalField[]).includes(field);
}

/**
 * What each template needs before it can run and what else it reads.
 * `identityAnyOf`: at least one of these must be mapped. Everything not
 * listed is treated as `ignore` for the template even if mapped.
 */
export const templateFields: Record<
  SheetCheckTemplate,
  {
    required: readonly CanonicalField[];
    identityAnyOf: readonly CanonicalField[];
    optional: readonly CanonicalField[];
  }
> = {
  incomingCash: {
    required: ["date", "amount"],
    identityAnyOf: [
      "customerName",
      "customerCode",
      "orderCode",
      "invoiceNumber",
    ],
    optional: ["currency", "method", "bankRef", "note"],
  },
  receivables: {
    required: ["outstanding"],
    identityAnyOf: [
      "customerName",
      "customerCode",
      "orderCode",
      "invoiceNumber",
    ],
    optional: [
      "openingBalance",
      "invoiced",
      "received",
      "refunded",
      "date",
      "dueDate",
      "currency",
      "note",
    ],
  },
  generic: {
    required: ["orderCode"],
    identityAnyOf: ["orderCode"],
    optional: [
      "customerName",
      "customerCode",
      "stage",
      "amount",
      "invoiceNumber",
      "date",
      "dueDate",
      "currency",
      "note",
    ],
  },
};

export const unitMultipliers = ["1", "1000", "1000000"] as const;
export type UnitMultiplier = (typeof unitMultipliers)[number];

export const numberStyles = ["vi", "en"] as const;
/** `vi`: 1.250.000,50 · `en`: 1,250,000.50 */
export type NumberStyle = (typeof numberStyles)[number];
export type ColumnNumberStyle = NumberStyle | "mixed" | "unknown";

export const dateOrders = ["dmy", "mdy"] as const;
export type DateOrder = (typeof dateOrders)[number];
/** How a column's day/month order was settled. */
export type DateOrderSource = "confirmed" | "proven" | "assumed";

/* ------------------------------------------------------------------ */
/* Permissions                                                         */
/* ------------------------------------------------------------------ */

/**
 * Permissions a template needs, all with GLOBAL coverage for the money
 * templates (mirrors the receivables page). `generic` needs `orders.read`
 * at any scope; the run then uses that scope for every order lookup.
 */
export const templateGates: Record<SheetCheckTemplate, readonly Permission[]> =
  {
    incomingCash: ["payments.read"],
    receivables: ["receivables.read", "invoices.read", "payments.read"],
    generic: ["orders.read"],
  };

/**
 * Extra comparisons a `generic` run performs only when the runner holds the
 * permission globally; each one exercised is stamped into
 * `requiredPermissions` so later readers need it too.
 */
export const opportunisticPermissions = [
  "orders.readSellingPrice",
  "invoices.read",
  "payments.read",
  "customers.read",
] as const satisfies readonly Permission[];

/** Every permission a check may stamp; the reader's coverage is read for all of them at once. */
export const sheetCheckReadPermissions = [
  "documents.read",
  "orders.read",
  "payments.read",
  "receivables.read",
  "invoices.read",
  "orders.readSellingPrice",
  "customers.read",
] as const satisfies readonly Permission[];

/* ------------------------------------------------------------------ */
/* The grid                                                            */
/* ------------------------------------------------------------------ */

/**
 * SheetJS cell types: `n` number (dates included), `s` text, `b` boolean,
 * `e` error (#REF!), `z` blank. A CSV yields only `s` and `z`.
 */
export const sheetCellTypes = ["n", "s", "b", "e", "z"] as const;
export type SheetCellType = (typeof sheetCellTypes)[number];

export type SheetCell = {
  /** Text as the sheet shows it (formatted/cached), trimmed; "" when blank. */
  text: string;
  type: SheetCellType;
  /** The numeric value of an `n` cell, a JS double straight from the file. */
  number: number | null;
  /** The cell's number format code (e.g. "#,##0", "dd/mm/yyyy") when known. */
  numberFormat: string | null;
  /** The cell carried a formula; `text`/`number` hold its cached value. */
  formula: boolean;
  /** Formula without a cached value: treated as blank with FORMULA_NO_CACHE. */
  noCache: boolean;
  /** Filled down from the anchor of a merged range. */
  mergedFill: boolean;
  /** `text` was cut at the cell limit. */
  truncated: boolean;
};

export const sheetRowKinds = [
  "data",
  "total",
  "subtotal",
  "group",
  "blank",
] as const;
export type SheetRowKind = (typeof sheetRowKinds)[number];

export type SheetRow = {
  /** 0-based position among the stored rows (title and header rows excluded). */
  index: number;
  /** 1-based row number in the original sheet, for people. */
  sheetRowNumber: number;
  kind: SheetRowKind;
  hidden: boolean;
  /** Exactly `columnCount` cells. */
  cells: readonly SheetCell[];
};

export type SheetInventoryEntry = {
  index: number;
  name: string;
  /** Non-blank rows seen (capped), so the user can tell sheets apart. */
  rowCount: number;
};

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

export type ColumnMapping = {
  columnIndex: number;
  field: CanonicalField;
  /** Money columns whose header fixes the currency (two-row header "VND"/"USD"). */
  fixedCurrency: Currency | null;
  /** Money columns: the unit the user confirmed ("nghìn đồng" → "1000"). */
  unitMultiplier: UnitMultiplier;
  /** Money columns: explicit number style; null = inferred per column. */
  numberStyle: NumberStyle | null;
  /** Date columns: explicit day/month order; null = proven or assumed. */
  dateOrder: DateOrder | null;
};

export type SheetPeriod = { from: string; to: string };

export type SheetMapping = {
  columns: readonly ColumnMapping[];
  /** Currency for money cells that name none (CURRENCY_DEFAULTED). */
  defaultCurrency: Currency;
  /** Report period, `YYYY-MM-DD`; drives year completion and period checks. */
  period: SheetPeriod | null;
  /** `generic` only: compare the amount column with the order selling price. */
  compareSellingPrice: boolean;
};

export type MappingConfidence = "high" | "medium" | "low";

/** What the header detector proposes for one column, shown on the mapping page. */
export type ColumnProposal = {
  columnIndex: number;
  /** Header text (a two-row header joined with " / "); "" when none. */
  header: string;
  field: CanonicalField;
  confidence: MappingConfidence;
  suggestedMultiplier: UnitMultiplier;
  /** Money columns: the separator style the values vote for. */
  inferredStyle: ColumnNumberStyle | null;
  /** Date columns: the evidence in the values. */
  inferredDateOrder: DateOrder | "conflict" | "assumed" | null;
  /** Up to `sampleValuesShown` distinct non-blank values. */
  sampleValues: readonly string[];
};

export type MappingProposal = {
  /** 1-based sheet row number of the header row; null when none was found. */
  headerSheetRowNumber: number | null;
  headerFound: boolean;
  columns: readonly ColumnProposal[];
  periodHint: SheetPeriod | null;
  /** Up to three title lines above the header, for display. */
  titleLines: readonly string[];
};

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

/** One row after parsing with the confirmed mapping; unmapped or blank → null. */
export type ParsedRow = {
  orderCode: string | null;
  invoiceNumber: string | null;
  customerName: string | null;
  customerCode: string | null;
  date: string | null;
  dueDate: string | null;
  amount: Money | null;
  invoiced: Money | null;
  received: Money | null;
  refunded: Money | null;
  outstanding: Money | null;
  openingBalance: Money | null;
  currency: Currency | null;
  method: string | null;
  bankRef: string | null;
  stage: string | null;
  note: string | null;
};

export function emptyParsedRow(): ParsedRow {
  return {
    orderCode: null,
    invoiceNumber: null,
    customerName: null,
    customerCode: null,
    date: null,
    dueDate: null,
    amount: null,
    invoiced: null,
    received: null,
    refunded: null,
    outstanding: null,
    openingBalance: null,
    currency: null,
    method: null,
    bankRef: null,
    stage: null,
    note: null,
  };
}

export const matchStrengths = [
  "S1_BANK_REF",
  "S2_CUSTOMER_AMOUNT_DATE",
  "S3_ALLOCATION_TARGET",
  "S4_AMOUNT_DATE",
  "S5_FEE_TOLERANCE",
  "S6_SPLIT",
  "S7_MERGED",
] as const;
export type MatchStrength = (typeof matchStrengths)[number];

export type SystemOrderView = {
  id: string;
  orderCode: string;
  stage: OrderStage;
  customerName: string;
  /** Present only when the run compared selling prices. */
  sellingPrice: Money | null;
};

export type SystemCustomerView = {
  id: string;
  name: string;
  code: string | null;
};

export type SystemInvoiceView = {
  id: string;
  invoiceNumber: string;
  orderCode: string;
  customerName: string;
  amount: Money;
  paid: Money;
  depositApplied: Money;
  remaining: Money;
  issuedDay: string;
  dueDay: string;
  status: "active" | "voided";
  voidReason: string | null;
};

export type SystemReceiptView = {
  id: string;
  occurredDay: string;
  amount: Money;
  counterparty: string;
  method: string;
  /** "invoice:INV-1=amount" / "order:RD-…=amount" summaries. */
  allocations: readonly string[];
  status: "active" | "voided";
  voidReason: string | null;
};

export type SystemBalanceView = {
  customerId: string | null;
  customerName: string;
  currency: Currency;
  invoiced: Money;
  received: Money;
  refunded: Money;
  outstanding: Money;
  credit: Money;
  balance: Money;
  overdueInvoiceCount: number;
};

export const candidateReasons = [
  "AMOUNT_DIFF",
  "DATE_DIFF",
  "ALREADY_USED_BY_ROW",
  "CURRENCY_DIFF",
  "VOIDED",
] as const;
export type CandidateReason = (typeof candidateReasons)[number];

export type ReceiptCandidateView = {
  id: string;
  occurredDay: string;
  amount: Money;
  why: CandidateReason;
  usedByRowIndex: number | null;
};

/**
 * What the system held for a row. Money keys (`invoice`, `receipts`,
 * `candidates`, `balance`, `order.sellingPrice`) exist only on checks whose
 * `requiredPermissions` include the governing permission; a restricted run
 * stores `order`/`customer` at most, or no `system` at all.
 */
export type RowSystemView = {
  order?: SystemOrderView | null;
  customer?: SystemCustomerView | null;
  invoice?: SystemInvoiceView | null;
  receipts?: readonly SystemReceiptView[];
  candidates?: readonly ReceiptCandidateView[];
  balance?: SystemBalanceView | null;
  matchStrength?: MatchStrength | null;
};

export const rowOutcomes = [
  "matched",
  "mismatch",
  "notFound",
  "notCompared",
  "invalid",
  "skipped",
] as const;
export type RowOutcome = (typeof rowOutcomes)[number];

export type RowResult = {
  parsed: ParsedRow;
  issues: readonly Issue[];
  system: RowSystemView | null;
  outcome: RowOutcome;
};

export type TotalsLine = {
  field: MoneyField;
  columnIndex: number;
  currency: Currency;
  /** Sum of the parsable data rows. */
  computed: string;
  /** Figure on the totals row, when one exists and parses. */
  sheetTotal: string | null;
  rowsCounted: number;
  rowsSkipped: number;
  /** System-side figure for the same period, when the run may compare money. */
  system: string | null;
};

export type SystemOnlyItem = {
  kind: "receipt" | "invoice" | "customer";
  /** Display label without amounts (customer name, invoice number). */
  label: string;
  day: string | null;
  amount: Money | null;
  issue: Issue;
};

export type CheckSummary = {
  dataRows: number;
  skippedRows: number;
  errors: number;
  warnings: number;
  infos: number;
  outcomes: Record<RowOutcome, number>;
  totals: readonly TotalsLine[];
};

export type CheckResult = {
  summary: CheckSummary;
  sheetIssues: readonly Issue[];
  systemOnly: readonly SystemOnlyItem[];
  /** When the system data was read. */
  dataAt: Date;
};

/* ------------------------------------------------------------------ */
/* Records                                                             */
/* ------------------------------------------------------------------ */

export type SheetCheckDto = {
  id: string;
  template: SheetCheckTemplate;
  status: SheetCheckStatus;
  sourceKind: SheetCheckSourceKind;
  fileName: string;
  fileBytes: number;
  fileFormat: SheetFileFormat;
  sheets: readonly SheetInventoryEntry[];
  sheetIndex: number;
  sheetName: string;
  columnCount: number;
  /** The workbook uses the 1904 date system (Excel for Mac legacy). */
  date1904: boolean;
  /** Stored rows (all kinds). */
  rowCount: number;
  dataRowCount: number;
  /** Sheet-level findings from parsing (header, encoding, caps, hidden rows…). */
  intakeIssues: readonly Issue[];
  proposal: MappingProposal;
  /** The proposed mapping until the run confirms it; then the mapping used. */
  mapping: SheetMapping;
  result: CheckResult | null;
  requiredPermissions: readonly Permission[];
  scopeKind: "all" | "businessUnits";
  businessUnitIds: readonly string[];
  createdByUserId: string;
  rerunOf: string | null;
  checkedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

export type NewSheetCheckRecord = Omit<
  SheetCheckDto,
  "id" | "createdAt" | "updatedAt" | "revision"
>;

export type SheetRowDto = SheetRow & {
  checkId: string;
  result: RowResult | null;
};

export type NewSheetRowRecord = SheetRow;

/** The fields a guard needs to judge a check without reading its content. */
export type SheetCheckAuthorizationView = {
  id: string;
  status: SheetCheckStatus;
  template: SheetCheckTemplate;
  createdByUserId: string;
  businessUnitIds: readonly string[];
  requiredPermissions: readonly Permission[];
};

export type SheetCheckListScope =
  | { kind: "all" }
  | {
      kind: "businessUnits";
      businessUnitIds: readonly string[];
      userId: string;
    }
  | { kind: "own"; userId: string };

export type SheetCheckListFilter = {
  scope: SheetCheckListScope;
  template?: SheetCheckTemplate;
  status?: SheetCheckStatus;
  limit?: number;
  offset?: number;
};

export type SheetRowListOptions = {
  offset: number;
  limit: number;
  /** Only rows whose result carries at least one issue of this severity or worse. */
  minSeverity?: IssueSeverity;
};

export interface SheetCheckStore {
  insert(
    record: NewSheetCheckRecord,
    rows: readonly NewSheetRowRecord[],
  ): Promise<SheetCheckDto>;
  findById(checkId: string): Promise<SheetCheckDto | null>;
  /**
   * Newest first. `businessUnits` returns checks whose stamped units are all
   * covered OR that the user created; `own` returns the user's own only.
   */
  list(filter: SheetCheckListFilter): Promise<SheetCheckDto[]>;
  countRowsWithIssues(
    checkId: string,
    minSeverity: IssueSeverity,
  ): Promise<number>;
  listRows(
    checkId: string,
    options: SheetRowListOptions,
  ): Promise<SheetRowDto[]>;
  findRow(checkId: string, rowIndex: number): Promise<SheetRowDto | null>;
  /**
   * Conditional on `mapping` status and the revision; writes the mapping,
   * the result and every row result in one go. Null means the check moved on.
   */
  markChecked(input: {
    checkId: string;
    expectedRevision: number;
    mapping: SheetMapping;
    result: CheckResult;
    rowResults: readonly { rowIndex: number; result: RowResult }[];
    requiredPermissions: readonly Permission[];
    checkedAt: Date;
    expiresAt: Date;
  }): Promise<SheetCheckDto | null>;
  /** Removes an unrun check and its rows; false when it is not in `mapping` status or the revision moved. */
  discard(input: {
    checkId: string;
    expectedRevision: number;
  }): Promise<boolean>;
}

/* ------------------------------------------------------------------ */
/* What a run may read                                                 */
/* ------------------------------------------------------------------ */

/**
 * The system side of a reconciliation. A part is `null` when the runner
 * does not hold the permission that governs it — the data is then never
 * loaded, not merely hidden. `orders` is read with the runner's own
 * `orders.read` scope; the finance parts with the finance scopes.
 */
export type SystemSnapshot = {
  orders: readonly OrderRecordDto[] | null;
  /** Active and voided invoices (`invoices.read`). */
  invoices: readonly InvoiceRecordDto[] | null;
  /** Receipts of category `orderPayment`, active and voided (`payments.read`). */
  receipts: readonly FinanceEntryRecordDto[] | null;
  /** Active refunds (`payments.read`). */
  refunds: readonly FinanceEntryRecordDto[] | null;
  /** The customer directory (`customers.read`). */
  customers: readonly CustomerRecordDto[] | null;
  /** Whether order selling prices may be compared (`orders.readSellingPrice`, global). */
  sellingPriceVisible: boolean;
  /**
   * Whether the runner holds `orders.readSellingPrice` at all. With
   * `sellingPriceVisible` it separates "you may not see prices" from "the
   * comparison is switched off" in what the reader is told.
   */
  sellingPriceGranted?: boolean;
};

/**
 * The read-only slice of the stores the service depends on. Every write
 * method is excluded on purpose: a test asserts the type never grows one.
 */
export type SheetCheckReadStores = {
  orderStore: Pick<OrderStore, "list">;
  invoiceStore: Pick<InvoiceStore, "list">;
  financeEntryStore: Pick<FinanceEntryStore, "list" | "listActive">;
  customerStore: Pick<CustomerStore, "list">;
};

export type SheetCheckServiceDependencies = SheetCheckReadStores & {
  store: SheetCheckStore;
  auditRepository: AuditRepository;
  /** IANA zone the business calendar uses for every day comparison. */
  timeZone: string;
  /** Retention of checked results in days (7–365). */
  checkedRetentionDays?: number;
  now?: () => Date;
};

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export const sheetCheckErrorCodes = [
  // intake (nothing persisted)
  "FILE_TOO_LARGE",
  "FILE_TYPE_REJECTED",
  "FILE_MACRO_REJECTED",
  "FILE_ZIP_SUSPICIOUS",
  "FILE_EMPTY",
  "FILE_TOO_MANY_ROWS",
  "FILE_PARSE_FAILED",
  "ENCODING_UNKNOWN",
  "CSV_MALFORMED",
  "SHEET_NOT_FOUND",
  "RATE_LIMITED",
  // lifecycle
  "NOT_FOUND",
  "INVALID_STATE",
  "ALREADY_CHECKED",
  "REVISION_CONFLICT",
  /** The mapping cannot run; `issues` names the blocking findings. */
  "MAPPING_INVALID",
  "INVALID_INPUT",
  "PERMISSION_DENIED",
] as const;

export type SheetCheckErrorCode = (typeof sheetCheckErrorCodes)[number];

export class SheetCheckError extends Error {
  readonly code: SheetCheckErrorCode;
  /** Blocking findings (MAPPING_INVALID) or intake details (CSV_MALFORMED line…). */
  readonly issues: readonly Issue[];

  constructor(
    code: SheetCheckErrorCode,
    message: string,
    issues: readonly Issue[] = [],
  ) {
    super(message);
    this.name = "SheetCheckError";
    this.code = code;
    this.issues = issues;
  }
}

/* ------------------------------------------------------------------ */
/* Input schemas                                                       */
/* ------------------------------------------------------------------ */

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/);
/** `YYYY-MM-DD` that is also a real calendar day: 2026-02-30 is not one. */
const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number) as [
      number,
      number,
      number,
    ];
    const utc = new Date(Date.UTC(year, month - 1, day));
    return (
      utc.getUTCFullYear() === year &&
      utc.getUTCMonth() === month - 1 &&
      utc.getUTCDate() === day
    );
  }, "Not a calendar day.");

export const sheetCheckTemplateSchema = z.enum(sheetCheckTemplates);

export const columnMappingInputSchema = z.object({
  columnIndex: z.coerce.number().int().min(0).max(39),
  field: z.enum(canonicalFields),
  fixedCurrency: z
    .union([z.enum(supportedCurrencies), z.literal("")])
    .nullable()
    .default(null)
    .transform((value) => (value ? value : null)),
  unitMultiplier: z.enum(unitMultipliers).default("1"),
  numberStyle: z
    .union([z.enum(numberStyles), z.literal("")])
    .nullable()
    .default(null)
    .transform((value) => (value ? value : null)),
  dateOrder: z
    .union([z.enum(dateOrders), z.literal("")])
    .nullable()
    .default(null)
    .transform((value) => (value ? value : null)),
});

export const sheetMappingInputSchema = z.object({
  columns: z.array(columnMappingInputSchema).max(40),
  defaultCurrency: z.enum(supportedCurrencies).default("VND"),
  period: z
    .object({ from: daySchema, to: daySchema })
    .nullable()
    .default(null)
    .refine((value) => value === null || value.from <= value.to, {
      message: "The period must start before it ends.",
    }),
  compareSellingPrice: z.coerce.boolean().default(false),
});

export type SheetMappingInput = z.infer<typeof sheetMappingInputSchema>;

export const runSheetCheckInputSchema = z.object({
  checkId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  mapping: sheetMappingInputSchema,
});

export type RunSheetCheckInput = z.infer<typeof runSheetCheckInputSchema>;

export const discardSheetCheckInputSchema = z.object({
  checkId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
});

export const rerunSheetCheckInputSchema = z.object({
  checkId: objectIdSchema,
});

export const sheetCheckListQuerySchema = z.object({
  template: sheetCheckTemplateSchema.optional(),
  status: z.enum(sheetCheckStatuses).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

/** The upload form: template, optional sheet selector (1-based index or name), the file itself is read separately. */
export const uploadFieldsSchema = z.object({
  template: sheetCheckTemplateSchema,
  sheet: z
    .string()
    .trim()
    .max(120)
    .nullable()
    .default(null)
    .transform((value) => (value && value.length > 0 ? value : null)),
});

/* ------------------------------------------------------------------ */
/* Pure helpers shared by the service, pages and tools                 */
/* ------------------------------------------------------------------ */

/** Field labels for people (used in REQUIRED_EMPTY, MERGED_FILL, the mapping page). */
export const fieldLabels: Record<CanonicalField, { vi: string; en: string }> = {
  orderCode: { vi: "Mã đơn", en: "Order code" },
  invoiceNumber: { vi: "Số hóa đơn", en: "Invoice number" },
  customerName: { vi: "Tên khách", en: "Customer name" },
  customerCode: { vi: "Mã khách", en: "Customer code" },
  date: { vi: "Ngày", en: "Date" },
  dueDate: { vi: "Hạn thanh toán", en: "Due date" },
  amount: { vi: "Số tiền", en: "Amount" },
  invoiced: { vi: "Phát sinh (hóa đơn)", en: "Invoiced" },
  received: { vi: "Đã thu", en: "Received" },
  refunded: { vi: "Hoàn trả", en: "Refunded" },
  outstanding: { vi: "Dư nợ cuối kỳ", en: "Outstanding" },
  openingBalance: { vi: "Dư đầu kỳ", en: "Opening balance" },
  currency: { vi: "Loại tiền", en: "Currency" },
  method: { vi: "Hình thức", en: "Method" },
  bankRef: { vi: "Số chứng từ / mã GD", en: "Bank reference" },
  stage: { vi: "Trạng thái đơn", en: "Order stage" },
  note: { vi: "Ghi chú", en: "Note" },
  ignore: { vi: "Bỏ qua", en: "Ignore" },
};

export const templateLabels: Record<
  SheetCheckTemplate,
  { vi: string; en: string }
> = {
  incomingCash: { vi: "Báo cáo tiền về", en: "Cash received report" },
  receivables: { vi: "Báo cáo công nợ / dư nợ", en: "Receivables statement" },
  generic: { vi: "Danh sách đơn hàng", en: "Order list" },
};

/** Column letter for people: 0 → A, 26 → AA. */
export function columnLabel(columnIndex: number): string {
  let index = columnIndex;
  let label = "";
  do {
    label = String.fromCharCode(65 + (index % 26)) + label;
    index = Math.floor(index / 26) - 1;
  } while (index >= 0);
  return label;
}
