import Decimal from "decimal.js";
import { z } from "zod";

/**
 * Công nợ phải thu khách hàng ("Công nợ"): shared contracts for the server
 * service, the API routes and the browser. Everything here is pure — no
 * database, no session — so the same rules run on both sides and the balance
 * maths is testable with plain numbers.
 *
 * Business rules carried over from `Reddoor-congno-2026.xlsx`:
 *
 *   Dư cuối = Dư đầu + Phát sinh tăng − Phát sinh giảm
 *
 * where the workbook derived the two movement columns with
 *   Phát sinh tăng  = SUMIF(ChiTietBanHang!B, mã khách, ChiTietBanHang!L)
 *   Phát sinh giảm  = SUMIF(ThanhToan!C,      mã khách, ThanhToan!G)
 * Both SUMIFs match the customer code case-insensitively, which is why the
 * source data mixes `Hien`/`hien` and `Sang`/`sang` freely; `codeKey` is the
 * one identity used here.
 *
 * The web version stores no formula and no derived total. Every figure on the
 * summary is recomputed from the ledger, so a closing balance can always be
 * traced back to an opening balance plus the entries that moved it.
 *
 * This is accounts RECEIVABLE only: money customers owe Red Door. Supplier
 * payables are a different ledger and are deliberately out of scope.
 */

export const BUSINESS_TIMEZONE = "Asia/Ho_Chi_Minh";

/** The period the migrated data belongs to; `Dư đầu ngày 02/01/2026`. */
export const OPENING_PERIOD_YEAR = 2026;
export const OPENING_DATE = "2026-01-02";

/** Excel VLOOKUP/SUMIF matching: trimmed, case-insensitive. */
export const codeKey = (code: string) => code.trim().toLocaleLowerCase("en-US");
/** Name matching for migration cross-checks: trimmed, lower-cased, one space. */
export const nameKey = (name: string) =>
  name.trim().toLocaleLowerCase("vi").replace(/\s+/g, " ");

// ---------------------------------------------------------------- ledger shape

/**
 * Which column of the report an entry lands in.
 *
 * Accounting semantics, stated once so the code never has to guess: this is a
 * receivable, so a sale is a DEBIT that increases what the customer owes, and
 * a payment, an offset or a return is a CREDIT that reduces it. `OPENING` is
 * the carried-forward balance at the start of the period and is neither — it
 * is the starting point the two movement columns move away from.
 *
 * The Vietnamese UI keeps the workbook's wording (`Phát sinh tăng` /
 * `Phát sinh giảm`) because that is what the staff read every day.
 */
export const entryRoles = ["OPENING", "DEBIT", "CREDIT"] as const;
export type EntryRole = (typeof entryRoles)[number];

export const entryTypes = [
  "OPENING_BALANCE",
  "SALE",
  "PAYMENT",
  "PAINT_OFFSET",
  "MATERIAL_OFFSET",
  "SALES_RETURN",
  "OTHER_OFFSET",
  "ADJUSTMENT",
] as const;
export type EntryType = (typeof entryTypes)[number];

/** The role each type may take. ADJUSTMENT is the only type that may do both. */
export const roleOfType: Record<EntryType, readonly EntryRole[]> = {
  OPENING_BALANCE: ["OPENING"],
  SALE: ["DEBIT"],
  PAYMENT: ["CREDIT"],
  PAINT_OFFSET: ["CREDIT"],
  MATERIAL_OFFSET: ["CREDIT"],
  SALES_RETURN: ["CREDIT"],
  OTHER_OFFSET: ["CREDIT"],
  ADJUSTMENT: ["DEBIT", "CREDIT"],
};

export const typeLabels: Record<EntryType, string> = {
  OPENING_BALANCE: "Dư đầu kỳ",
  SALE: "Bán hàng",
  PAYMENT: "Thanh toán",
  PAINT_OFFSET: "Trừ tiền sơn",
  MATERIAL_OFFSET: "Trừ tiền gỗ / vật tư",
  SALES_RETURN: "Trả lại hàng",
  OTHER_OFFSET: "Bù trừ khác",
  ADJUSTMENT: "Điều chỉnh",
};

/** The types a person may record from the "Giảm công nợ" form. */
export const reductionTypes = [
  "PAYMENT",
  "PAINT_OFFSET",
  "MATERIAL_OFFSET",
  "SALES_RETURN",
  "OTHER_OFFSET",
] as const;
export type ReductionType = (typeof reductionTypes)[number];

/** Only POSTED entries move a balance. */
export const entryStatuses = ["DRAFT", "POSTED", "CANCELLED"] as const;
export type EntryStatus = (typeof entryStatuses)[number];
export const statusLabels: Record<EntryStatus, string> = {
  DRAFT: "Nháp",
  POSTED: "Đã ghi sổ",
  CANCELLED: "Đã hủy",
};

/**
 * Where an entry came from. `referenceType` + `referenceId` is unique across
 * the ledger, which is what stops one source document from being posted twice
 * (a re-run migration, a double-submitted form, or a sales slip that is later
 * wired to post — see `docs/accounts-receivable.md`).
 */
export const referenceTypes = [
  "OPENING_BALANCE",
  "SALES_LEDGER",
  "PAYMENT_LEDGER",
  "SALES_SLIP",
  "MANUAL",
] as const;
export type ReferenceType = (typeof referenceTypes)[number];

export const sourceTypes = ["WEB", "MIGRATION"] as const;
export type SourceType = (typeof sourceTypes)[number];

/** Flags a migrated row carries when the source data was incomplete. */
export const migrationIssues = [
  "UNKNOWN_CUSTOMER",
  "UNKNOWN_ITEM",
  "MISSING_AMOUNT",
  "AMOUNT_MISMATCH",
  "UNMAPPED_DESCRIPTION",
  "DATE_OUTSIDE_PERIOD",
] as const;
export type MigrationIssue = (typeof migrationIssues)[number];

export const issueLabels: Record<MigrationIssue, string> = {
  UNKNOWN_CUSTOMER: "Mã khách không có trong danh mục",
  UNKNOWN_ITEM: "Mã hàng không có trong danh mục sơn",
  MISSING_AMOUNT: "Thành tiền trống trong file gốc",
  AMOUNT_MISMATCH: "Thành tiền khác Số lượng × Đơn giá",
  UNMAPPED_DESCRIPTION: "Diễn giải chưa xác định được loại",
  DATE_OUTSIDE_PERIOD: "Ngày nằm ngoài kỳ 2026",
};

// ---------------------------------------------------------------- validation

export class ReceivablesError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = "ReceivablesError";
  }
}

export const idSchema = z
  .string()
  .min(1)
  .max(150)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có dạng dd/MM/yyyy")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Ngày không hợp lệ");

const moneyPattern = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,2})?$/;
const signedMoneyPattern = /^-?(?:0|[1-9]\d{0,14})(?:\.\d{1,2})?$/;

/** A money amount: non-negative, at most 2 decimals (VND is normally whole). */
export const moneySchema = z
  .string()
  .trim()
  .regex(moneyPattern, "Nhập số tiền không âm, tối đa 2 chữ số thập phân")
  .transform((value) => new Decimal(value).toFixed());

/** A positive money amount: what a payment or an offset must be. */
export const positiveMoneySchema = moneySchema.refine(
  (value) => new Decimal(value).gt(0),
  "Số tiền phải lớn hơn 0",
);

/** Opening balances and adjustments may be negative (a customer in advance). */
export const signedMoneySchema = z
  .string()
  .trim()
  .regex(signedMoneyPattern, "Số tiền không hợp lệ")
  .transform((value) => new Decimal(value).toFixed());

/** Quantities keep the workbook's precision (0.05 Kg is a real sale). */
export const quantitySchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,14})(?:\.\d{1,8})?$/,
    "Nhập số không âm, tối đa 8 chữ số thập phân",
  )
  .transform((value) => new Decimal(value).toFixed());

export const positiveQuantitySchema = quantitySchema.refine(
  (value) => new Decimal(value).gt(0),
  "Số lượng phải lớn hơn 0",
);

export const textSchema = (max: number) => z.string().trim().max(max);

// ---------------------------------------------------------------- records

export type ReceivableCustomer = {
  id: string;
  version: number;
  /** `Mã khách` exactly as the workbook writes it; display form. */
  code: string;
  name: string;
  phone: string;
  address: string;
  /** `Loại` from `MaNhaCungCap` ("Loại 1"…); free text, never a role. */
  type: string;
  note: string;
  active: boolean;
  /** `MaNhaCungCap` row order first, then codes seen only in a ledger. */
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type ReceivableEntry = {
  id: string;
  version: number;
  customerId: string;
  /** Snapshot: the report must keep reading correctly if the master changes. */
  customerCode: string;
  customerName: string;
  customerPhone: string;
  entryDate: string;
  role: EntryRole;
  type: EntryType;
  status: EntryStatus;
  /** Signed for OPENING; positive for DEBIT and CREDIT. */
  amount: string;
  documentNumber: string;
  description: string;
  note: string;
  /** The source wording, kept verbatim so no meaning is lost in mapping. */
  legacyDescription: string;
  // Sale-only snapshot. The price is frozen on the line: re-reading today's
  // catalogue price would silently rewrite last quarter's debt.
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: string | null;
  unitPrice: string | null;
  referenceType: ReferenceType;
  referenceId: string | null;
  referenceNumber: string;
  /** Stable tie-breaker so a running balance never reorders between reads. */
  sequence: number;
  /** Set when the line was written as part of one multi-item purchase. */
  batchId: string | null;
  periodYear: number | null;
  sourceType: SourceType;
  migrationSource: string | null;
  migrationSheet: string | null;
  sourceRow: number | null;
  issues: MigrationIssue[];
  postedAt: string | null;
  postedBy: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

// ---------------------------------------------------------------- balance maths

/**
 * What one entry contributes to a balance, signed.
 *
 * OPENING carries its own sign (a negative opening means the customer had paid
 * ahead). DEBIT adds, CREDIT subtracts. A DRAFT or CANCELLED entry contributes
 * nothing at all — that is the whole point of the status.
 */
export function contributionOf(entry: {
  role: EntryRole;
  status: EntryStatus;
  amount: string;
}): Decimal {
  if (entry.status !== "POSTED") return new Decimal(0);
  const amount = new Decimal(entry.amount);
  if (entry.role === "CREDIT") return amount.negated();
  return amount;
}

export type BalanceWindow = {
  /** Inclusive `Từ ngày`; entries before it fold into the opening figure. */
  from?: string | null;
  /** Inclusive `Đến ngày`; entries after it are ignored entirely. */
  to?: string | null;
};

export type CustomerBalance = {
  opening: string;
  increase: string;
  decrease: string;
  closing: string;
  entryCount: number;
};

type BalanceInput = Pick<
  ReceivableEntry,
  "role" | "status" | "amount" | "entryDate"
>;

/**
 * Adds up one customer's entries inside a window.
 *
 * The opening figure is never lost to a filter: with `from` set it becomes
 * "dư đầu kỳ lọc" — the carried opening balance plus every posted movement
 * before `from` — which is how a debt statement has to read. Without `from` it
 * is exactly the workbook's `Dư đầu` column.
 */
export function computeBalance(
  entries: readonly BalanceInput[],
  window: BalanceWindow = {},
): CustomerBalance {
  const from = window.from ?? null;
  const to = window.to ?? null;
  let opening = new Decimal(0);
  let increase = new Decimal(0);
  let decrease = new Decimal(0);
  let entryCount = 0;

  for (const entry of entries) {
    if (entry.status !== "POSTED") continue;
    const contribution = contributionOf(entry);
    // An opening balance is the period's starting point, not an event inside
    // it, so no date filter may drop it. Excluding it would report a customer
    // as owing nothing before their first 2026 transaction, which is false.
    if (entry.role === "OPENING") {
      opening = opening.plus(contribution);
      continue;
    }
    if (to !== null && entry.entryDate > to) continue;
    if (from !== null && entry.entryDate < from) {
      opening = opening.plus(contribution);
      continue;
    }
    entryCount += 1;
    if (entry.role === "DEBIT") increase = increase.plus(contribution);
    else decrease = decrease.minus(contribution);
  }

  return {
    opening: opening.toFixed(),
    increase: increase.toFixed(),
    decrease: decrease.toFixed(),
    closing: opening.plus(increase).minus(decrease).toFixed(),
    entryCount,
  };
}

/**
 * Chronological ledger with the balance after each entry.
 *
 * Ordering is (date, sequence) — never the database's natural order — so two
 * entries on the same day always produce the same running balance.
 */
export type LedgerLine = {
  entry: ReceivableEntry;
  increase: string | null;
  decrease: string | null;
  balance: string;
};

export function compareEntries(
  left: Pick<ReceivableEntry, "entryDate" | "sequence" | "id">,
  right: Pick<ReceivableEntry, "entryDate" | "sequence" | "id">,
): number {
  if (left.entryDate !== right.entryDate)
    return left.entryDate < right.entryDate ? -1 : 1;
  if (left.sequence !== right.sequence) return left.sequence - right.sequence;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

/**
 * Builds the running ledger. `openingBalance` is the balance carried into the
 * first line, so a filtered view still starts from the right number.
 * Cancelled and draft entries are listed but never move the balance.
 */
export function buildLedger(
  entries: readonly ReceivableEntry[],
  openingBalance: string,
): LedgerLine[] {
  let balance = new Decimal(openingBalance);
  return [...entries].sort(compareEntries).map((entry) => {
    const contribution = contributionOf(entry);
    balance = balance.plus(contribution);
    const counts = entry.status === "POSTED";
    return {
      entry,
      increase:
        counts && entry.role !== "CREDIT"
          ? new Decimal(entry.amount).toFixed()
          : null,
      decrease:
        counts && entry.role === "CREDIT"
          ? new Decimal(entry.amount).toFixed()
          : null,
      balance: balance.toFixed(),
    };
  });
}

/** `Số lượng × Đơn giá`, the only way a sale amount is ever produced on the web. */
export function lineAmount(
  quantity: string | null,
  unitPrice: string | null,
): string | null {
  if (quantity === null || unitPrice === null) return null;
  return new Decimal(quantity).times(unitPrice).toFixed();
}

// ---------------------------------------------------------------- summary rows

export type DebtState = "OWING" | "SETTLED" | "PREPAID";

export function debtStateOf(closing: string): DebtState {
  const value = new Decimal(closing);
  if (value.isZero()) return "SETTLED";
  return value.gt(0) ? "OWING" : "PREPAID";
}

export const debtStateLabels: Record<DebtState, string> = {
  OWING: "Còn nợ",
  SETTLED: "Đã thanh toán",
  PREPAID: "Dư trả trước",
};

export type SummaryRow = {
  stt: number;
  customerId: string;
  code: string;
  name: string;
  phone: string;
  note: string;
  active: boolean;
  opening: string;
  increase: string;
  decrease: string;
  closing: string;
  state: DebtState;
  entryCount: number;
  /** True when the customer carries an opening balance for the period. */
  hasOpening: boolean;
};

export type SummaryTotals = {
  opening: string;
  increase: string;
  decrease: string;
  closing: string;
};

export type SummaryKpis = {
  customers: number;
  owing: number;
  settled: number;
  prepaid: number;
  /** Σ of the positive closing balances: what is actually still out there. */
  outstanding: string;
  /** Σ of the negative closing balances, as a positive number. */
  prepaidAmount: string;
};

export function sumTotals(rows: readonly SummaryRow[]): SummaryTotals {
  const total = rows.reduce(
    (carry, row) => ({
      opening: carry.opening.plus(row.opening),
      increase: carry.increase.plus(row.increase),
      decrease: carry.decrease.plus(row.decrease),
    }),
    {
      opening: new Decimal(0),
      increase: new Decimal(0),
      decrease: new Decimal(0),
    },
  );
  return {
    opening: total.opening.toFixed(),
    increase: total.increase.toFixed(),
    decrease: total.decrease.toFixed(),
    closing: total.opening.plus(total.increase).minus(total.decrease).toFixed(),
  };
}

/**
 * A customer the report is about.
 *
 * Carrying an opening balance counts even when it is zero: the accountant put
 * that customer on `TongHopCongNo` deliberately, and fifteen of the fifty rows
 * there are all zeroes. Dropping them would quietly shorten the report the
 * client reconciles against.
 *
 * The other 75 partners in the master have never opened a balance or traded,
 * and burying the sixteen who owe money among a hundred zero rows is how a debt
 * gets missed — so they stay behind a checkbox.
 *
 * Defined once and used by both the board and the export, so a downloaded
 * workbook always holds exactly the rows the screen showed.
 */
export function hasActivity(row: SummaryRow): boolean {
  return (
    row.hasOpening ||
    row.entryCount > 0 ||
    !new Decimal(row.opening).isZero() ||
    !new Decimal(row.closing).isZero()
  );
}

export function summaryKpis(rows: readonly SummaryRow[]): SummaryKpis {
  let outstanding = new Decimal(0);
  let prepaid = new Decimal(0);
  const counts = { OWING: 0, SETTLED: 0, PREPAID: 0 };
  for (const row of rows) {
    counts[row.state] += 1;
    const closing = new Decimal(row.closing);
    if (closing.gt(0)) outstanding = outstanding.plus(closing);
    else if (closing.lt(0)) prepaid = prepaid.plus(closing.negated());
  }
  return {
    customers: rows.length,
    owing: counts.OWING,
    settled: counts.SETTLED,
    prepaid: counts.PREPAID,
    outstanding: outstanding.toFixed(),
    prepaidAmount: prepaid.toFixed(),
  };
}

// ---------------------------------------------------------------- description mapping

type Rule = { type: ReductionType; match: RegExp };

/**
 * Maps a legacy `Diễn giải` to a reduction type.
 *
 * Deliberately conservative: anything that is not clearly one of the four
 * known phrasings becomes `OTHER_OFFSET` and keeps its original text, rather
 * than the migration inventing a meaning. `docs/accounts-receivable-migration.md`
 * lists every distinct description found and how it mapped.
 */
const reductionRules: readonly Rule[] = [
  { type: "SALES_RETURN", match: /^tr[ảa]\s*(l[ạa]i)?\s/i },
  {
    type: "MATERIAL_OFFSET",
    match: /^tr[ừu]\s*ti[ềe]n\s*(g[ỗo]|v[ậa]t\s*t[ưu])/i,
  },
  { type: "PAINT_OFFSET", match: /^tr[ừu]\s*ti[ềe]n\s*s[ơo]n/i },
  { type: "PAYMENT", match: /^thanh\s*to[áa]n$/i },
];

export function classifyReduction(description: string): {
  type: ReductionType;
  mapped: boolean;
} {
  const text = description.trim();
  for (const rule of reductionRules) {
    if (rule.match.test(text)) return { type: rule.type, mapped: true };
  }
  return { type: "OTHER_OFFSET", mapped: false };
}

// ---------------------------------------------------------------- formatting

export function displayDate(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/** Vietnamese money: dot grouping, no forced decimals — 5033850 → "5.033.850". */
export function formatMoney(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const [integer, fraction] = new Decimal(value).toFixed().split(".");
  const sign = integer!.startsWith("-") ? "-" : "";
  const grouped = integer!
    .replace("-", "")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${grouped}${fraction ? `,${fraction}` : ""}`;
}

export function formatQuantity(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const [integer, fraction] = new Decimal(value).toFixed().split(".");
  const sign = integer!.startsWith("-") ? "-" : "";
  const grouped = integer!
    .replace("-", "")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${grouped}${fraction ? `,${fraction}` : ""}`;
}

/** Today's calendar date in the business time zone (Asia/Ho_Chi_Minh). */
export function todayInBusinessZone(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// ---------------------------------------------------------------- capabilities

export const capabilityActions = [
  "read",
  "readAmount",
  "recordSale",
  "recordReduction",
  "updateEntry",
  "cancelEntry",
  "manageCatalog",
  "manageCustomer",
  "updateOpeningBalance",
  "export",
  "import",
] as const;
export type ReceivablesAction = (typeof capabilityActions)[number];
export type Capabilities = Record<ReceivablesAction, boolean>;
export const noCapabilities: Capabilities = {
  read: false,
  readAmount: false,
  recordSale: false,
  recordReduction: false,
  updateEntry: false,
  cancelEntry: false,
  manageCatalog: false,
  manageCustomer: false,
  updateOpeningBalance: false,
  export: false,
  import: false,
};

// ---------------------------------------------------------------- API payloads

export const summaryQuerySchema = z
  .object({
    q: textSchema(150).optional(),
    from: dateSchema.nullish(),
    to: dateSchema.nullish(),
    state: z.enum(["OWING", "SETTLED", "PREPAID", ""]).optional(),
    movement: z.enum(["with", "without", ""]).optional(),
    sort: z
      .enum([
        "code",
        "name",
        "closingDesc",
        "closingAsc",
        "increase",
        "decrease",
      ])
      .optional(),
    includeInactive: z.enum(["0", "1"]).optional(),
  })
  .strict();
export type SummaryQuery = z.infer<typeof summaryQuerySchema>;

export const entryQuerySchema = z
  .object({
    customerId: idSchema.optional(),
    role: z.enum(entryRoles).optional(),
    type: z.enum(entryTypes).optional(),
    status: z.enum(entryStatuses).optional(),
    from: dateSchema.nullish(),
    to: dateSchema.nullish(),
    q: textSchema(150).optional(),
    offset: z.coerce.number().int().min(0).max(10_000_000).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .strict();
export type EntryQuery = z.infer<typeof entryQuerySchema>;

/**
 * A reduction the storekeeper records. The client sends `customerId`, never a
 * name: the server reads the master itself so a tampered name cannot land in
 * the ledger.
 */
export const reductionInputSchema = z
  .object({
    id: idSchema.optional(),
    customerId: idSchema,
    entryDate: dateSchema,
    type: z.enum(reductionTypes),
    amount: positiveMoneySchema,
    documentNumber: textSchema(100).default(""),
    description: textSchema(500).default(""),
    note: textSchema(2000).default(""),
    /** Post immediately (the normal counter flow) or keep as a draft. */
    post: z.boolean().default(true),
    /** Same key twice = one entry. Guards double-click and network retry. */
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
  })
  .strict();
export type ReductionInput = z.infer<typeof reductionInputSchema>;

export const saleInputSchema = z
  .object({
    id: idSchema.optional(),
    customerId: idSchema,
    entryDate: dateSchema,
    itemCode: textSchema(150),
    quantity: positiveQuantitySchema,
    unitPrice: moneySchema,
    documentNumber: textSchema(100).default(""),
    description: textSchema(500).default("xuất kho"),
    note: textSchema(2000).default(""),
    post: z.boolean().default(true),
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
  })
  .strict();
export type SaleInput = z.infer<typeof saleInputSchema>;

/**
 * One line of a multi-item sale. A customer who buys six paints in one visit is
 * one form and one document number, not six separate trips through the screen.
 */
export const saleLineInputSchema = z
  .object({
    id: idSchema,
    itemCode: textSchema(150).min(1, "Nhập mã hàng hóa"),
    quantity: positiveQuantitySchema,
    unitPrice: moneySchema,
    description: textSchema(500).default("xuất kho"),
    note: textSchema(2000).default(""),
  })
  .strict();
export type SaleLineInput = z.infer<typeof saleLineInputSchema>;

export const saleBatchInputSchema = z
  .object({
    customerId: idSchema,
    entryDate: dateSchema,
    documentNumber: textSchema(100).default(""),
    note: textSchema(2000).default(""),
    lines: z
      .array(saleLineInputSchema)
      .min(1, "Thêm ít nhất một dòng")
      .max(200),
    post: z.boolean().default(true),
    /** Shared by the whole batch: a retry returns the same lines, never a copy. */
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
  })
  .strict();
export type SaleBatchInput = z.infer<typeof saleBatchInputSchema>;

/**
 * An in-place correction. The spec allows a restricted edit workflow beside
 * cancel-and-re-enter, provided nothing is overwritten silently: every field
 * that changes is recorded before and after, with the actor and a reason.
 *
 * `amount` is never accepted for a sale — the server recomputes it from the
 * quantity and price on the line, so a total can not be typed over.
 */
export const entryPatchSchema = z
  .object({
    entryDate: dateSchema,
    customerId: idSchema,
    type: z.enum(entryTypes),
    amount: positiveMoneySchema,
    quantity: positiveQuantitySchema,
    unitPrice: moneySchema,
    itemCode: textSchema(150),
    documentNumber: textSchema(100),
    description: textSchema(500),
    note: textSchema(2000),
  })
  .partial()
  .strict();
export type EntryPatch = z.infer<typeof entryPatchSchema>;

export const entryUpdateSchema = z
  .object({
    id: idSchema,
    version: z.number().int().min(0),
    patch: entryPatchSchema,
    reason: textSchema(500).default(""),
  })
  .strict();
export type EntryUpdate = z.infer<typeof entryUpdateSchema>;

/**
 * A paint code the storekeeper adds at the counter. New codes appear
 * constantly, so the catalogue can not be a fixed list — but it is the SAME
 * catalogue `Bảng xuất kho sơn` and `Hóa đơn bán hàng` read, never a third copy
 * of it, so a code added here shows up everywhere it should.
 */
export const catalogueItemInputSchema = z
  .object({
    code: textSchema(150).min(1, "Nhập mã hàng hóa"),
    name: textSchema(300).default(""),
    unit: textSchema(50).default(""),
    salePrice: moneySchema.nullable().default(null),
  })
  .strict();
export type CatalogueItemInput = z.infer<typeof catalogueItemInputSchema>;

export const cancelInputSchema = z
  .object({
    id: idSchema,
    version: z.number().int().min(0),
    reason: textSchema(500).min(1, "Nhập lý do hủy"),
  })
  .strict();
export type CancelInput = z.infer<typeof cancelInputSchema>;

export const postInputSchema = z
  .object({ id: idSchema, version: z.number().int().min(0) })
  .strict();

export const openingBalanceInputSchema = z
  .object({
    customerId: idSchema,
    amount: signedMoneySchema,
    reason: textSchema(500).min(1, "Nhập lý do điều chỉnh dư đầu kỳ"),
  })
  .strict();
export type OpeningBalanceInput = z.infer<typeof openingBalanceInputSchema>;

export const customerPatchSchema = z
  .object({
    code: textSchema(150).min(1, "Mã khách không được trống"),
    name: textSchema(300),
    phone: textSchema(50),
    address: textSchema(500),
    type: textSchema(50),
    note: textSchema(2000),
    active: z.boolean(),
  })
  .partial()
  .strict();
export type CustomerPatch = z.infer<typeof customerPatchSchema>;

export const customerSaveSchema = z
  .object({
    id: idSchema.optional(),
    version: z.number().int().min(0).optional(),
    patch: customerPatchSchema,
  })
  .strict();

export const exportScopes = ["summary", "sales", "reductions", "all"] as const;
export type ExportScope = (typeof exportScopes)[number];

// ---------------------------------------------------------------- responses

export type SummaryResponse = {
  rows: SummaryRow[];
  totals: SummaryTotals;
  kpis: SummaryKpis;
  window: { from: string | null; to: string | null };
  /** False when the reader may not see money; every amount is then blank. */
  amountsVisible: boolean;
};

export type CustomerDetail = {
  customer: ReceivableCustomer;
  balance: CustomerBalance;
  /** Balance carried into the first listed line. */
  openingBalance: string;
  lines: LedgerLine[];
  total: number;
  nextOffset: number | null;
  amountsVisible: boolean;
};

export type EntryListResponse = {
  entries: ReceivableEntry[];
  total: number;
  nextOffset: number | null;
  totalAmount: string;
  amountsVisible: boolean;
};

export type HistoryEntry = {
  id: string;
  action: string;
  actor: string;
  actorName: string;
  occurredAt: string;
  resourceId: string | null;
  reason: string | null;
  before: unknown;
  after: unknown;
};

export type HistoryResponse = {
  entries: HistoryEntry[];
  total: number;
  nextOffset: number | null;
  lastActivity: {
    occurredAt: string;
    actorName: string;
    action: string;
  } | null;
};

export type CatalogueItem = {
  code: string;
  name: string;
  unit: string;
  /** The catalogue default only; the entry keeps its own snapshot. */
  salePrice: string | null;
};

export type Lookups = {
  customers: ReceivableCustomer[];
  items: CatalogueItem[];
  capabilities: Capabilities;
};
