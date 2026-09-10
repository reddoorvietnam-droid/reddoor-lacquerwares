import "server-only";
import Decimal from "decimal.js";
import type { ClientSession } from "mongodb";
import type { Types } from "mongoose";
import { z } from "zod";
import { getAuditEventModel } from "@/domains/audit/model";
import { appendAuditEventWithSession } from "@/domains/audit/mongo-repository";
import { getUserModel } from "@/domains/identity/models";
import { getPaintMasterModel } from "@/domains/paint-warehouse/models";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongoose";
import { canReadAmounts, receivablesCapabilities } from "./access";
import {
  buildLedger,
  cancelInputSchema,
  catalogueItemInputSchema,
  codeKey,
  computeBalance,
  customerSaveSchema,
  debtStateOf,
  entryQuerySchema,
  entryUpdateSchema,
  exportScopes,
  hasActivity,
  lineAmount,
  OPENING_DATE,
  OPENING_PERIOD_YEAR,
  openingBalanceInputSchema,
  postInputSchema,
  reductionInputSchema,
  ReceivablesError,
  roleOfType,
  saleBatchInputSchema,
  saleInputSchema,
  summaryKpis,
  summaryQuerySchema,
  sumTotals,
  todayInBusinessZone,
  type CatalogueItem,
  type Capabilities,
  type CustomerDetail,
  type EntryListResponse,
  type EntryRole,
  type EntryType,
  type ExportScope,
  type HistoryEntry,
  type HistoryResponse,
  type Lookups,
  type ReceivableCustomer,
  type ReceivableEntry,
  type SummaryResponse,
  type SummaryRow,
} from "./contracts";
import type { ExportInput } from "./export-workbook";
import {
  decimalToString,
  getReceivableCounterModel,
  getReceivableCustomerModel,
  getReceivableEntryModel,
  toDecimal128,
  type StoredCustomer,
  type StoredEntry,
} from "./models";

/**
 * Server side of Công nợ.
 *
 * Two invariants hold every figure this module produces:
 *
 *  1. No total is ever stored. `Dư cuối` is recomputed from the ledger on every
 *     read, so it can always be traced back to `Dư đầu` plus the entries that
 *     moved it. Nothing in the API accepts a closing balance.
 *  2. A source document backs at most one entry. The unique index on
 *     (referenceType, referenceId) enforces it in the database, not just here,
 *     so neither a re-run migration nor a retried POST can double-count.
 */

const conflictMessage =
  "Dòng đã được người khác cập nhật. Tải lại để xem số mới nhất.";

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

/** UTC midnight of a calendar date; the ledger is date-only. */
const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const toIso = (date: Date) => date.toISOString().slice(0, 10);

const offsetSchema = z.coerce.number().int().min(0).max(10_000_000);

/** One customer ledger is bounded in practice; refuse rather than truncate. */
const LEDGER_CAP = 20_000;

// ---------------------------------------------------------------- mapping

function toCustomer(row: StoredCustomer): ReceivableCustomer {
  return {
    id: row._id,
    version: row.version,
    code: row.code,
    name: row.name ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    type: row.type ?? "",
    note: row.note ?? "",
    active: row.active !== false,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
  };
}

function toEntry(row: StoredEntry, amountsVisible: boolean): ReceivableEntry {
  const money = (value: unknown) =>
    amountsVisible ? (decimalToString(value) ?? "0") : "0";
  const optionalMoney = (value: unknown) =>
    amountsVisible ? decimalToString(value) : null;
  return {
    id: row._id,
    version: row.version,
    customerId: row.customerId,
    customerCode: row.customerCode,
    customerName: row.customerName ?? "",
    customerPhone: row.customerPhone ?? "",
    entryDate: toIso(row.entryDate),
    role: row.role as EntryRole,
    type: row.type as EntryType,
    status: row.status as ReceivableEntry["status"],
    amount: money(row.amount),
    documentNumber: row.documentNumber ?? "",
    description: row.description ?? "",
    note: row.note ?? "",
    legacyDescription: row.legacyDescription ?? "",
    itemCode: row.itemCode ?? "",
    itemName: row.itemName ?? "",
    unit: row.unit ?? "",
    quantity: decimalToString(row.quantity),
    unitPrice: optionalMoney(row.unitPrice),
    referenceType: row.referenceType as ReceivableEntry["referenceType"],
    referenceId: row.referenceId,
    referenceNumber: row.referenceNumber ?? "",
    sequence: row.sequence,
    batchId: row.batchId ?? null,
    periodYear: row.periodYear,
    sourceType: row.sourceType as ReceivableEntry["sourceType"],
    migrationSource: row.migrationSource,
    migrationSheet: row.migrationSheet,
    sourceRow: row.sourceRow,
    issues: (row.issues ?? []) as ReceivableEntry["issues"],
    postedAt: row.postedAt,
    postedBy: row.postedBy,
    cancelledAt: row.cancelledAt,
    cancelledBy: row.cancelledBy,
    cancelReason: row.cancelReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
  };
}

/** Blanks every amount when the reader lacks `customerDebt.readAmount`. */
const hide = (value: string, visible: boolean) => (visible ? value : "0");

// ---------------------------------------------------------------- audit

const audit = (
  session: ClientSession,
  actor: string,
  action: string,
  resourceId: string,
  changes: { before: unknown; after: unknown },
  reason?: string,
) =>
  appendAuditEventWithSession(
    {
      actor: { type: "user", userId: actor },
      action,
      resourceType: "receivables",
      resourceId,
      requestId: crypto.randomUUID(),
      changes,
      ...(reason ? { reason } : {}),
      occurredAt: new Date(),
    },
    session,
  );

// ---------------------------------------------------------------- sequence

/**
 * A global, gap-tolerant counter. It only has to be monotonic: it is the stable
 * tie-breaker that keeps a running balance identical between two reads when
 * several entries share a date.
 */
async function nextSequence(
  count: number,
  session: ClientSession | null,
): Promise<number> {
  const query = getReceivableCounterModel().findOneAndUpdate(
    { _id: "entry" },
    { $inc: { value: count } },
    { upsert: true, new: true, ...(session ? { session } : {}) },
  );
  const counter = await query.lean<{ value: number }>().exec();
  const end = counter?.value ?? count;
  return end - count + 1;
}

// ---------------------------------------------------------------- lookups

export async function readLookups(): Promise<Lookups> {
  await connectToDatabase();
  const [customers, capabilities, amountsVisible] = await Promise.all([
    getReceivableCustomerModel()
      .find({})
      .sort({ sortOrder: 1 })
      .lean<StoredCustomer[]>()
      .exec(),
    receivablesCapabilities(),
    canReadAmounts(),
  ]);
  return {
    customers: customers.map(toCustomer),
    items: await readCatalogue(amountsVisible),
    capabilities,
  };
}

/**
 * The paint catalogue behind the sale form. It supplies a default price only —
 * the entry keeps its own snapshot, so changing a catalogue price never moves
 * a debt that was already recorded.
 */
async function readCatalogue(
  amountsVisible: boolean,
): Promise<CatalogueItem[]> {
  const rows = await getPaintMasterModel()
    .find({ kind: "material" })
    .select({ code: 1, name: 1, unit: 1, salePrice: 1, unitPrice: 1 })
    .lean<
      { code: string; name: string; unit: string; salePrice: string | null }[]
    >()
    .exec();
  return rows
    .filter((row) => row.code)
    .map((row) => ({
      code: row.code,
      name: row.name ?? "",
      unit: row.unit ?? "",
      salePrice: amountsVisible ? (row.salePrice ?? null) : null,
    }))
    .sort((left, right) => left.code.localeCompare(right.code, "vi"));
}

async function requireCustomer(
  customerId: string,
  session: ClientSession | null,
): Promise<StoredCustomer> {
  const query = getReceivableCustomerModel().findById(customerId);
  if (session) query.session(session);
  const customer = await query.lean<StoredCustomer>().exec();
  if (!customer) throw new ReceivablesError("Không tìm thấy khách hàng.", 404);
  return customer;
}

// ---------------------------------------------------------------- summary

type Bucketed = {
  _id: string;
  opening: unknown;
  increase: unknown;
  decrease: unknown;
  entryCount: number;
  openingCount: number;
};

/**
 * One `$group` over the whole ledger: opening, increase and decrease per
 * customer, inside the window. Decimal128 keeps the arithmetic exact, so the
 * aggregate agrees with the per-entry maths to the last đồng.
 *
 * With `from` set, every posted movement before it folds into the opening
 * figure — that is what makes a filtered period read as a real debt statement
 * rather than losing the carried balance.
 */
async function bucketedTotals(
  window: { from: string | null; to: string | null },
  customerId?: string,
): Promise<Map<string, Bucketed>> {
  const match: Record<string, unknown> = { status: "POSTED" };
  if (customerId) match.customerId = customerId;
  // `Đến ngày` bounds the movements only. An opening balance is the period's
  // starting point, so it always counts however early the window ends.
  if (window.to)
    match.$or = [
      { role: "OPENING" },
      { entryDate: { $lte: toDate(window.to) } },
    ];

  const isOpening = window.from
    ? {
        $or: [
          { $eq: ["$role", "OPENING"] },
          { $lt: ["$entryDate", toDate(window.from)] },
        ],
      }
    : { $eq: ["$role", "OPENING"] };
  const signed = {
    $cond: [
      { $eq: ["$role", "CREDIT"] },
      { $multiply: ["$amount", -1] },
      "$amount",
    ],
  };
  const zero = toDecimal128("0");

  const rows = await getReceivableEntryModel()
    .aggregate<Bucketed>([
      { $match: match },
      {
        $group: {
          _id: "$customerId",
          opening: { $sum: { $cond: [isOpening, signed, zero] } },
          increase: {
            $sum: {
              $cond: [
                { $and: [{ $not: isOpening }, { $eq: ["$role", "DEBIT"] }] },
                "$amount",
                zero,
              ],
            },
          },
          decrease: {
            $sum: {
              $cond: [
                { $and: [{ $not: isOpening }, { $eq: ["$role", "CREDIT"] }] },
                "$amount",
                zero,
              ],
            },
          },
          entryCount: { $sum: { $cond: [isOpening, 0, 1] } },
          // Distinct from `entryCount`: whether the customer is on the report
          // at all, which stays true for the fifteen all-zero rows.
          openingCount: {
            $sum: { $cond: [{ $eq: ["$role", "OPENING"] }, 1, 0] },
          },
        },
      },
    ])
    .exec();
  return new Map(rows.map((row) => [row._id, row]));
}

export async function readSummary(
  params: URLSearchParams,
): Promise<SummaryResponse> {
  await connectToDatabase();
  const query = summaryQuerySchema.parse(Object.fromEntries(params));
  const window = { from: query.from ?? null, to: query.to ?? null };
  if (window.from && window.to && window.from > window.to)
    throw new ReceivablesError("Từ ngày phải trước Đến ngày.");

  const amountsVisible = await canReadAmounts();
  const [customers, totals] = await Promise.all([
    getReceivableCustomerModel()
      .find(query.includeInactive === "1" ? {} : { active: true })
      .sort({ sortOrder: 1 })
      .lean<StoredCustomer[]>()
      .exec(),
    bucketedTotals(window),
  ]);

  // An inactive customer that still carries a balance or had movement stays on
  // the board: hiding a debt because a code was retired would lose money.
  const byId = new Map(customers.map((row) => [row._id, row]));
  if (query.includeInactive !== "1") {
    const missing = [...totals.keys()].filter((id) => !byId.has(id));
    if (missing.length) {
      const extra = await getReceivableCustomerModel()
        .find({ _id: { $in: missing } })
        .lean<StoredCustomer[]>()
        .exec();
      for (const row of extra) {
        const bucket = totals.get(row._id);
        const moved =
          bucket &&
          [bucket.opening, bucket.increase, bucket.decrease].some(
            (value) => !new Decimal(decimalToString(value) ?? "0").isZero(),
          );
        if (moved) byId.set(row._id, row);
      }
    }
  }

  let rows: SummaryRow[] = [...byId.values()]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((customer, index) => {
      const bucket = totals.get(customer._id);
      const opening = decimalToString(bucket?.opening) ?? "0";
      const increase = decimalToString(bucket?.increase) ?? "0";
      const decrease = decimalToString(bucket?.decrease) ?? "0";
      const closing = new Decimal(opening)
        .plus(increase)
        .minus(decrease)
        .toFixed();
      return {
        stt: index + 1,
        customerId: customer._id,
        code: customer.code,
        name: customer.name ?? "",
        phone: customer.phone ?? "",
        note: customer.note ?? "",
        active: customer.active !== false,
        opening: hide(opening, amountsVisible),
        increase: hide(increase, amountsVisible),
        decrease: hide(decrease, amountsVisible),
        closing: hide(closing, amountsVisible),
        state: debtStateOf(closing),
        entryCount: bucket?.entryCount ?? 0,
        hasOpening: (bucket?.openingCount ?? 0) > 0,
      };
    });

  const needle = (query.q ?? "").trim().toLocaleLowerCase("vi");
  if (needle)
    rows = rows.filter((row) =>
      [row.code, row.name, row.phone]
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(needle),
    );
  if (query.state) rows = rows.filter((row) => row.state === query.state);
  if (query.movement === "with")
    rows = rows.filter((row) => row.entryCount > 0);
  if (query.movement === "without")
    rows = rows.filter((row) => row.entryCount === 0);

  const compare: Record<string, (a: SummaryRow, b: SummaryRow) => number> = {
    code: (a, b) => a.code.localeCompare(b.code, "vi"),
    name: (a, b) => a.name.localeCompare(b.name, "vi"),
    closingDesc: (a, b) => new Decimal(b.closing).comparedTo(a.closing),
    closingAsc: (a, b) => new Decimal(a.closing).comparedTo(b.closing),
    increase: (a, b) => new Decimal(b.increase).comparedTo(a.increase),
    decrease: (a, b) => new Decimal(b.decrease).comparedTo(a.decrease),
  };
  if (query.sort && compare[query.sort])
    rows = [...rows].sort(compare[query.sort]!);
  rows = rows.map((row, index) => ({ ...row, stt: index + 1 }));

  // Totals describe exactly the rows on screen, never the whole book.
  const totalsRow = sumTotals(rows);
  return {
    rows,
    totals: amountsVisible
      ? totalsRow
      : { opening: "0", increase: "0", decrease: "0", closing: "0" },
    kpis: amountsVisible
      ? summaryKpis(rows)
      : { ...summaryKpis(rows), outstanding: "0", prepaidAmount: "0" },
    window,
    amountsVisible,
  };
}

// ---------------------------------------------------------------- customer ledger

export async function readCustomerDetail(
  customerId: string,
  params: URLSearchParams,
): Promise<CustomerDetail> {
  await connectToDatabase();
  const query = entryQuerySchema.parse({
    ...Object.fromEntries(params),
    customerId,
  });
  const window = { from: query.from ?? null, to: query.to ?? null };
  const amountsVisible = await canReadAmounts();
  const customer = await requireCustomer(customerId, null);

  const filter: Record<string, unknown> = { customerId };
  // Same rule as the summary: the window bounds the movements, never the
  // opening balance the ledger starts from.
  if (window.to)
    filter.$or = [
      { role: "OPENING" },
      { entryDate: { $lte: toDate(window.to) } },
    ];
  const total = await getReceivableEntryModel().countDocuments(filter);
  if (total > LEDGER_CAP)
    throw new ReceivablesError(
      `Sổ của khách này có ${total.toLocaleString("vi-VN")} dòng, vượt mức hiển thị. Hãy lọc theo khoảng ngày.`,
      413,
    );

  const stored = await getReceivableEntryModel()
    .find(filter)
    .sort({ entryDate: 1, sequence: 1, _id: 1 })
    .lean<StoredEntry[]>()
    .exec();
  const entries = stored.map((row) => toEntry(row, amountsVisible));

  // The opening figure and the ledger are built from the same list, so the
  // running balance provably ends on the same number the summary shows.
  const balance = computeBalance(entries, window);
  const inWindow = entries.filter(
    (entry) =>
      entry.role !== "OPENING" &&
      (!window.from || entry.entryDate >= window.from),
  );
  const lines = buildLedger(inWindow, balance.opening);

  const offset = offsetSchema.parse(query.offset ?? 0);
  const limit = query.limit ?? 100;
  const page = lines.slice(offset, offset + limit);
  const end = offset + page.length;

  return {
    customer: toCustomer(customer),
    balance: amountsVisible
      ? balance
      : {
          ...balance,
          opening: "0",
          increase: "0",
          decrease: "0",
          closing: "0",
        },
    openingBalance: hide(balance.opening, amountsVisible),
    lines: page,
    total: lines.length,
    nextOffset: end < lines.length ? end : null,
    amountsVisible,
  };
}

// ---------------------------------------------------------------- entry lists

export async function listEntries(
  params: URLSearchParams,
): Promise<EntryListResponse> {
  await connectToDatabase();
  const query = entryQuerySchema.parse(Object.fromEntries(params));
  const amountsVisible = await canReadAmounts();

  const filter: Record<string, unknown> = {};
  if (query.customerId) filter.customerId = query.customerId;
  if (query.role) filter.role = query.role;
  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  if (query.from || query.to)
    filter.entryDate = {
      ...(query.from ? { $gte: toDate(query.from) } : {}),
      ...(query.to ? { $lte: toDate(query.to) } : {}),
    };
  const needle = (query.q ?? "").trim();
  if (needle) {
    // Escaped: a customer's note must never compile into a regular expression.
    const safe = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { customerCode: { $regex: safe, $options: "i" } },
      { customerName: { $regex: safe, $options: "i" } },
      { itemCode: { $regex: safe, $options: "i" } },
      { itemName: { $regex: safe, $options: "i" } },
      { documentNumber: { $regex: safe, $options: "i" } },
      { description: { $regex: safe, $options: "i" } },
      { legacyDescription: { $regex: safe, $options: "i" } },
    ];
  }

  const offset = offsetSchema.parse(query.offset ?? 0);
  const limit = query.limit ?? 100;
  const model = getReceivableEntryModel();
  const [rows, total, sums] = await Promise.all([
    model
      .find(filter)
      .sort({ entryDate: -1, sequence: -1, _id: -1 })
      .skip(offset)
      .limit(limit)
      .lean<StoredEntry[]>()
      .exec(),
    model.countDocuments(filter),
    model
      .aggregate<{ total: unknown }>([
        { $match: { ...filter, status: "POSTED" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ])
      .exec(),
  ]);
  const end = offset + rows.length;
  return {
    entries: rows.map((row) => toEntry(row, amountsVisible)),
    total,
    nextOffset: end < total ? end : null,
    totalAmount: hide(decimalToString(sums[0]?.total) ?? "0", amountsVisible),
    amountsVisible,
  };
}

// ---------------------------------------------------------------- writes

type Draft = {
  customer: StoredCustomer;
  entryDate: string;
  role: EntryRole;
  type: EntryType;
  amount: string;
  documentNumber: string;
  description: string;
  note: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: string | null;
  unitPrice: string | null;
  idempotencyKey: string | null;
  batchId: string | null;
  post: boolean;
};

function assertRole(type: EntryType, role: EntryRole): void {
  if (!roleOfType[type].includes(role))
    throw new ReceivablesError("Loại giao dịch không hợp lệ.");
}

async function writeEntry(
  draft: Draft,
  actor: string,
  action: string,
): Promise<ReceivableEntry> {
  assertRole(draft.type, draft.role);
  if (draft.entryDate > todayInBusinessZone())
    throw new ReceivablesError("Không ghi sổ cho ngày trong tương lai.");

  const db = await connectToDatabase();
  const model = getReceivableEntryModel();

  // An idempotency key that already produced an entry returns that entry
  // instead of writing a second one, so a double-click or a network retry can
  // never reduce a debt twice.
  if (draft.idempotencyKey) {
    const existing = await model
      .findOne({ idempotencyKey: draft.idempotencyKey })
      .lean<StoredEntry>()
      .exec();
    if (existing) return toEntry(existing, true);
  }

  const stamp = now();
  const stored = await db.connection.transaction(async (session) => {
    const sequence = await nextSequence(1, session);
    const id = newId();
    const document = {
      _id: id,
      version: 1,
      customerId: draft.customer._id,
      customerCode: draft.customer.code,
      customerName: draft.customer.name ?? "",
      customerPhone: draft.customer.phone ?? "",
      entryDate: toDate(draft.entryDate),
      role: draft.role,
      type: draft.type,
      status: draft.post ? "POSTED" : "DRAFT",
      amount: toDecimal128(draft.amount),
      documentNumber: draft.documentNumber,
      description: draft.description,
      note: draft.note,
      legacyDescription: "",
      itemCode: draft.itemCode,
      itemName: draft.itemName,
      unit: draft.unit,
      quantity: draft.quantity === null ? null : toDecimal128(draft.quantity),
      unitPrice:
        draft.unitPrice === null ? null : toDecimal128(draft.unitPrice),
      referenceType: "MANUAL" as const,
      referenceId: null,
      referenceNumber: draft.documentNumber,
      sequence,
      batchId: draft.batchId,
      periodYear: null,
      sourceType: "WEB" as const,
      migrationSource: null,
      migrationSheet: null,
      sourceRow: null,
      issues: [],
      importKey: null,
      fingerprint: null,
      idempotencyKey: draft.idempotencyKey,
      postedAt: draft.post ? stamp : null,
      postedBy: draft.post ? actor : null,
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: null,
      createdAt: stamp,
      updatedAt: stamp,
      createdBy: actor,
      updatedBy: actor,
    };
    await model.create([document], { session });
    await audit(session, actor, action, id, { before: null, after: document });
    return document as unknown as StoredEntry;
  });
  return toEntry(stored, true);
}

export async function recordReduction(
  raw: unknown,
  actor: string,
): Promise<ReceivableEntry> {
  const input = reductionInputSchema.parse(raw);
  const customer = await requireCustomer(input.customerId, null);
  if (customer.active === false)
    throw new ReceivablesError("Khách hàng đã ngừng theo dõi công nợ.");
  return writeEntry(
    {
      customer,
      entryDate: input.entryDate,
      role: "CREDIT",
      type: input.type,
      amount: input.amount,
      documentNumber: input.documentNumber,
      description: input.description,
      note: input.note,
      itemCode: "",
      itemName: "",
      unit: "",
      quantity: null,
      unitPrice: null,
      idempotencyKey: input.idempotencyKey ?? null,
      batchId: null,
      post: input.post,
    },
    actor,
    "receivables.reduction.create",
  );
}

export async function recordSale(
  raw: unknown,
  actor: string,
): Promise<ReceivableEntry> {
  const input = saleInputSchema.parse(raw);
  const customer = await requireCustomer(input.customerId, null);
  if (customer.active === false)
    throw new ReceivablesError("Khách hàng đã ngừng theo dõi công nợ.");
  if (!input.itemCode.trim()) throw new ReceivablesError("Nhập mã hàng hóa.");

  // The catalogue only fills in name and unit; the amount is always the
  // server's own product of the quantity and the price on this line.
  const catalogue = await getPaintMasterModel()
    .findOne({ kind: "material", key: codeKey(input.itemCode) })
    .lean<{ code: string; name: string; unit: string }>()
    .exec();
  const amount = lineAmount(input.quantity, input.unitPrice);
  if (amount === null)
    throw new ReceivablesError("Thiếu số lượng hoặc đơn giá.");

  return writeEntry(
    {
      customer,
      entryDate: input.entryDate,
      role: "DEBIT",
      type: "SALE",
      amount,
      documentNumber: input.documentNumber,
      description: input.description || "xuất kho",
      note: input.note,
      itemCode: catalogue?.code ?? input.itemCode.trim(),
      itemName: catalogue?.name ?? "",
      unit: catalogue?.unit ?? "",
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      idempotencyKey: input.idempotencyKey ?? null,
      batchId: null,
      post: input.post,
    },
    actor,
    "receivables.sale.create",
  );
}

/**
 * A multi-item purchase: one customer, one date, one document number, many
 * lines — the way a workshop actually buys. Each line becomes its own debit
 * entry (that is what keeps `Phát sinh tăng` traceable down to an item), and
 * they share a `batchId` so the ledger can show them as one visit.
 *
 * The whole batch is written inside one transaction: either every line lands
 * or none does, so a half-recorded purchase can never move a balance.
 */
export async function recordSaleBatch(
  raw: unknown,
  actor: string,
): Promise<ReceivableEntry[]> {
  const input = saleBatchInputSchema.parse(raw);
  const customer = await requireCustomer(input.customerId, null);
  if (customer.active === false)
    throw new ReceivablesError("Khách hàng đã ngừng theo dõi công nợ.");
  if (input.entryDate > todayInBusinessZone())
    throw new ReceivablesError("Không ghi sổ cho ngày trong tương lai.");

  const db = await connectToDatabase();
  const model = getReceivableEntryModel();
  const batchId = input.idempotencyKey ?? crypto.randomUUID();

  // A retry hands back the lines the first attempt wrote, so a slow network or
  // a double-clicked "Ghi sổ" can never bill the same purchase twice.
  //
  // The result is re-checked in memory on purpose. `strictQuery` drops a
  // condition on a path the loaded model does not know, which would turn this
  // lookup into "every entry in the book" and hand the whole ledger back as if
  // it were this purchase. A guard whose only condition can be dropped must
  // never be trusted on the query alone.
  const existing = (
    await model
      .find({ batchId })
      .sort({ sequence: 1 })
      .lean<StoredEntry[]>()
      .exec()
  ).filter((row) => row.batchId === batchId);
  if (existing.length) return existing.map((row) => toEntry(row, true));

  // Names and units are read once for the whole batch.
  const codes = [...new Set(input.lines.map((line) => codeKey(line.itemCode)))];
  const catalogue = await getPaintMasterModel()
    .find({ kind: "material", key: { $in: codes } })
    .select("key code name unit")
    .lean<{ key: string; code: string; name: string; unit: string }[]>()
    .exec();
  const byKey = new Map(catalogue.map((item) => [item.key, item]));

  const stamp = now();
  const stored = await db.connection.transaction(async (session) => {
    const first = await nextSequence(input.lines.length, session);
    let total = new Decimal(0);
    const documents = input.lines.map((line, index) => {
      const amount = lineAmount(line.quantity, line.unitPrice);
      if (amount === null)
        throw new ReceivablesError("Thiếu số lượng hoặc đơn giá.");
      total = total.plus(amount);
      const item = byKey.get(codeKey(line.itemCode));
      return {
        _id: newId(),
        version: 1,
        customerId: customer._id,
        customerCode: customer.code,
        customerName: customer.name ?? "",
        customerPhone: customer.phone ?? "",
        entryDate: toDate(input.entryDate),
        role: "DEBIT" as const,
        type: "SALE" as const,
        status: input.post ? "POSTED" : "DRAFT",
        amount: toDecimal128(amount),
        documentNumber: input.documentNumber,
        description: line.description || "xuất kho",
        note: line.note || input.note,
        legacyDescription: "",
        itemCode: item?.code ?? line.itemCode.trim(),
        itemName: item?.name ?? "",
        unit: item?.unit ?? "",
        quantity: toDecimal128(line.quantity),
        unitPrice: toDecimal128(line.unitPrice),
        referenceType: "MANUAL" as const,
        referenceId: null,
        referenceNumber: input.documentNumber,
        sequence: first + index,
        batchId,
        periodYear: null,
        sourceType: "WEB" as const,
        migrationSource: null,
        migrationSheet: null,
        sourceRow: null,
        issues: [],
        importKey: null,
        fingerprint: null,
        // Unique per line and deterministic per batch, so the database refuses
        // a second write even if this code somehow ran twice.
        idempotencyKey: `${batchId}#${index}`,
        postedAt: input.post ? stamp : null,
        postedBy: input.post ? actor : null,
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
        createdAt: stamp,
        updatedAt: stamp,
        createdBy: actor,
        updatedBy: actor,
      };
    });
    await model.create(documents, { session, ordered: true });
    await audit(session, actor, "receivables.sale.createBatch", batchId, {
      before: null,
      after: {
        customerCode: customer.code,
        entryDate: input.entryDate,
        documentNumber: input.documentNumber,
        lines: documents.length,
        total: total.toFixed(),
      },
    });
    return documents as unknown as StoredEntry[];
  });
  return stored.map((row) => toEntry(row, true));
}

/**
 * Corrects a recorded line in place.
 *
 * Cancel-and-re-enter leaves two rows in the book for one real transaction,
 * which is why the spec allows a restricted edit workflow beside it.
 * Restricted means: the version is checked so two people cannot overwrite each
 * other, a cancelled line is never revived, an opening balance is never
 * touched here, a sale can never turn into a payment, and every changed field
 * is written to the audit log with the actor and a reason.
 *
 * A sale's amount is always recomputed from its quantity and price — the
 * client cannot type a total.
 */
export async function updateEntry(
  raw: unknown,
  actor: string,
): Promise<ReceivableEntry> {
  const input = entryUpdateSchema.parse(raw);
  const patch = input.patch;
  const db = await connectToDatabase();
  const model = getReceivableEntryModel();

  const stored = await db.connection.transaction(async (session) => {
    const before = await model
      .findById(input.id)
      .session(session)
      .lean<StoredEntry>()
      .exec();
    if (!before) throw new ReceivablesError("Không tìm thấy giao dịch.", 404);
    if (before.status === "CANCELLED")
      throw new ReceivablesError(
        "Giao dịch đã hủy thì không sửa được. Hãy ghi một giao dịch mới.",
        409,
      );
    if (before.role === "OPENING")
      throw new ReceivablesError(
        "Dư đầu kỳ được sửa ở màn hình chi tiết khách hàng.",
        409,
      );

    const next: Record<string, unknown> = {};

    if (patch.entryDate !== undefined) {
      if (patch.entryDate > todayInBusinessZone())
        throw new ReceivablesError("Không ghi sổ cho ngày trong tương lai.");
      next.entryDate = toDate(patch.entryDate);
    }

    if (
      patch.customerId !== undefined &&
      patch.customerId !== before.customerId
    ) {
      // The client sends an id; the server reads the master and re-snapshots.
      const customer = await requireCustomer(patch.customerId, session);
      next.customerId = customer._id;
      next.customerCode = customer.code;
      next.customerName = customer.name ?? "";
      next.customerPhone = customer.phone ?? "";
    }

    if (patch.type !== undefined && patch.type !== before.type) {
      const role = before.role as EntryRole;
      if (!roleOfType[patch.type].includes(role))
        throw new ReceivablesError(
          "Không đổi được giữa phát sinh tăng và phát sinh giảm. Hãy hủy dòng này rồi ghi lại.",
        );
      next.type = patch.type;
    }

    if (patch.documentNumber !== undefined) {
      next.documentNumber = patch.documentNumber;
      next.referenceNumber = patch.documentNumber;
    }
    if (patch.description !== undefined) next.description = patch.description;
    if (patch.note !== undefined) next.note = patch.note;

    if (before.role === "DEBIT") {
      if (patch.amount !== undefined)
        throw new ReceivablesError(
          "Thành tiền của dòng bán hàng do máy tính lại từ số lượng × đơn giá.",
        );
      if (patch.itemCode !== undefined) {
        const code = patch.itemCode.trim();
        if (!code) throw new ReceivablesError("Nhập mã hàng hóa.");
        const item = await getPaintMasterModel()
          .findOne({ kind: "material", key: codeKey(code) })
          .select("code name unit")
          .lean<{ code: string; name: string; unit: string }>()
          .exec();
        next.itemCode = item?.code ?? code;
        next.itemName = item?.name ?? "";
        next.unit = item?.unit ?? "";
      }
      if (patch.quantity !== undefined)
        next.quantity = toDecimal128(patch.quantity);
      if (patch.unitPrice !== undefined)
        next.unitPrice = toDecimal128(patch.unitPrice);
      if (patch.quantity !== undefined || patch.unitPrice !== undefined) {
        const amount = lineAmount(
          patch.quantity ?? decimalToString(before.quantity),
          patch.unitPrice ?? decimalToString(before.unitPrice),
        );
        if (amount === null)
          throw new ReceivablesError("Thiếu số lượng hoặc đơn giá.");
        next.amount = toDecimal128(amount);
      }
    } else if (patch.amount !== undefined) {
      next.amount = toDecimal128(patch.amount);
    }

    if (Object.keys(next).length === 0)
      throw new ReceivablesError("Không có thay đổi nào để lưu.");

    const stamp = now();
    const written = await model.updateOne(
      { _id: input.id, version: input.version, status: { $ne: "CANCELLED" } },
      {
        $set: {
          ...next,
          version: before.version + 1,
          updatedAt: stamp,
          updatedBy: actor,
        },
      },
      { session },
    );
    if (written.modifiedCount !== 1)
      throw new ReceivablesError(conflictMessage, 409);

    // Only the fields that actually moved reach the audit log, so a reader
    // sees the correction rather than the whole document twice.
    const changed = Object.keys(next);
    const readable = (value: unknown) =>
      value instanceof Date
        ? value.toISOString().slice(0, 10)
        : (decimalToString(value) ?? value);
    const snapshot = (row: Record<string, unknown>) =>
      Object.fromEntries(changed.map((key) => [key, readable(row[key])]));
    await audit(
      session,
      actor,
      "receivables.entry.update",
      input.id,
      {
        before: snapshot(before as unknown as Record<string, unknown>),
        after: snapshot(next),
      },
      input.reason || undefined,
    );
    return { ...before, ...next, version: before.version + 1 } as StoredEntry;
  });
  return toEntry(stored, true);
}

/**
 * Adds or reprices a paint code from the counter.
 *
 * New codes appear constantly, so the catalogue cannot be a fixed list. It
 * writes to `paintwarehousemasters` — the same catalogue `Bảng xuất kho sơn`
 * and `Hóa đơn bán hàng` read — rather than a third copy that would drift away
 * from them. Repricing never moves a debt already recorded: every sale keeps
 * the price snapshotted on its own line.
 */
export async function saveCatalogueItem(
  raw: unknown,
  actor: string,
): Promise<CatalogueItem> {
  const input = catalogueItemInputSchema.parse(raw);
  const code = input.code.trim();
  const key = codeKey(code);
  const db = await connectToDatabase();
  const model = getPaintMasterModel();

  type MasterRow = {
    code: string;
    name: string;
    unit: string;
    salePrice: string | null;
  };

  const saved = await db.connection.transaction(async (session) => {
    const before = await model
      .findOne({ kind: "material", key })
      .select("code name unit salePrice")
      .session(session)
      .lean<MasterRow>()
      .exec();
    await model.updateOne(
      { kind: "material", key },
      {
        $set: {
          name: input.name,
          unit: input.unit,
          salePrice: input.salePrice,
        },
        // An existing row keeps the spelling it already had.
        $setOnInsert: { kind: "material", key, code },
      },
      { upsert: true, session },
    );
    await audit(
      session,
      actor,
      before ? "receivables.catalogue.update" : "receivables.catalogue.create",
      key,
      {
        before: before ?? null,
        after: { ...input, code: before?.code ?? code },
      },
    );
    return { code: before?.code ?? code };
  });

  return {
    code: saved.code,
    name: input.name,
    unit: input.unit,
    salePrice: input.salePrice,
  };
}

/** DRAFT → POSTED. Only from a draft, and only once. */
export async function postEntry(
  raw: unknown,
  actor: string,
): Promise<ReceivableEntry> {
  const input = postInputSchema.parse(raw);
  const db = await connectToDatabase();
  const model = getReceivableEntryModel();
  const stored = await db.connection.transaction(async (session) => {
    const before = await model
      .findById(input.id)
      .session(session)
      .lean<StoredEntry>()
      .exec();
    if (!before) throw new ReceivablesError("Không tìm thấy giao dịch.", 404);
    if (before.status !== "DRAFT")
      throw new ReceivablesError("Chỉ ghi sổ được bản nháp.", 409);
    const stamp = now();
    const written = await model.updateOne(
      { _id: input.id, version: input.version, status: "DRAFT" },
      {
        $set: {
          status: "POSTED",
          postedAt: stamp,
          postedBy: actor,
          version: before.version + 1,
          updatedAt: stamp,
          updatedBy: actor,
        },
      },
      { session },
    );
    if (written.modifiedCount !== 1)
      throw new ReceivablesError(conflictMessage, 409);
    const after = {
      ...before,
      status: "POSTED",
      postedAt: stamp,
      postedBy: actor,
    };
    await audit(session, actor, "receivables.entry.post", input.id, {
      before,
      after,
    });
    return after as StoredEntry;
  });
  return toEntry(stored, true);
}

/**
 * POSTED → CANCELLED, with a reason. Never a hard delete: the entry stays in
 * the ledger, stops contributing, and the balance returns to what it was.
 */
export async function cancelEntry(
  raw: unknown,
  actor: string,
): Promise<ReceivableEntry> {
  const input = cancelInputSchema.parse(raw);
  const db = await connectToDatabase();
  const model = getReceivableEntryModel();
  const stored = await db.connection.transaction(async (session) => {
    const before = await model
      .findById(input.id)
      .session(session)
      .lean<StoredEntry>()
      .exec();
    if (!before) throw new ReceivablesError("Không tìm thấy giao dịch.", 404);
    if (before.status === "CANCELLED")
      throw new ReceivablesError("Giao dịch đã hủy.", 409);
    if (before.role === "OPENING")
      throw new ReceivablesError(
        "Dư đầu kỳ không hủy được; hãy sửa số dư đầu kỳ.",
        409,
      );
    const stamp = now();
    const written = await model.updateOne(
      { _id: input.id, version: input.version, status: { $ne: "CANCELLED" } },
      {
        $set: {
          status: "CANCELLED",
          cancelledAt: stamp,
          cancelledBy: actor,
          cancelReason: input.reason,
          version: before.version + 1,
          updatedAt: stamp,
          updatedBy: actor,
        },
      },
      { session },
    );
    if (written.modifiedCount !== 1)
      throw new ReceivablesError(conflictMessage, 409);
    const after = {
      ...before,
      status: "CANCELLED",
      cancelledAt: stamp,
      cancelledBy: actor,
      cancelReason: input.reason,
    };
    await audit(
      session,
      actor,
      "receivables.entry.cancel",
      input.id,
      { before, after },
      input.reason,
    );
    return after as StoredEntry;
  });
  return toEntry(stored, true);
}

/**
 * Restates one customer's opening balance for the period.
 *
 * It is a ledger entry like any other, so the closing balance stays traceable;
 * the (referenceType, referenceId) index guarantees a customer can only ever
 * have one. Requires `customerDebt.updateOpeningBalance` and always audits the
 * before, the after and the reason.
 */
export async function setOpeningBalance(
  raw: unknown,
  actor: string,
): Promise<ReceivableEntry> {
  const input = openingBalanceInputSchema.parse(raw);
  const db = await connectToDatabase();
  const model = getReceivableEntryModel();
  const customer = await requireCustomer(input.customerId, null);
  const referenceId = `${OPENING_PERIOD_YEAR}:${customer._id}`;

  const stored = await db.connection.transaction(async (session) => {
    const before = await model
      .findOne({ referenceType: "OPENING_BALANCE", referenceId })
      .session(session)
      .lean<StoredEntry>()
      .exec();
    const stamp = now();
    if (before) {
      const written = await model.updateOne(
        { _id: before._id, version: before.version },
        {
          $set: {
            amount: toDecimal128(input.amount),
            version: before.version + 1,
            updatedAt: stamp,
            updatedBy: actor,
          },
        },
        { session },
      );
      if (written.modifiedCount !== 1)
        throw new ReceivablesError(conflictMessage, 409);
      const after = {
        ...before,
        amount: input.amount,
        version: before.version + 1,
      };
      await audit(
        session,
        actor,
        "receivables.openingBalance.update",
        before._id,
        {
          before: { amount: decimalToString(before.amount) },
          after: { amount: input.amount },
        },
        input.reason,
      );
      return after as unknown as StoredEntry;
    }
    const sequence = await nextSequence(1, session);
    const id = newId();
    const document = {
      _id: id,
      version: 1,
      customerId: customer._id,
      customerCode: customer.code,
      customerName: customer.name ?? "",
      customerPhone: customer.phone ?? "",
      entryDate: toDate(OPENING_DATE),
      role: "OPENING" as const,
      type: "OPENING_BALANCE" as const,
      status: "POSTED" as const,
      amount: toDecimal128(input.amount),
      documentNumber: "",
      description: `Dư đầu ngày ${OPENING_DATE.split("-").reverse().join("/")}`,
      note: "",
      legacyDescription: "",
      itemCode: "",
      itemName: "",
      unit: "",
      quantity: null,
      unitPrice: null,
      referenceType: "OPENING_BALANCE" as const,
      referenceId,
      referenceNumber: "",
      sequence,
      periodYear: OPENING_PERIOD_YEAR,
      sourceType: "WEB" as const,
      migrationSource: null,
      migrationSheet: null,
      sourceRow: null,
      issues: [],
      importKey: null,
      fingerprint: null,
      idempotencyKey: null,
      postedAt: stamp,
      postedBy: actor,
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: null,
      createdAt: stamp,
      updatedAt: stamp,
      createdBy: actor,
      updatedBy: actor,
    };
    await model.create([document], { session });
    await audit(
      session,
      actor,
      "receivables.openingBalance.create",
      id,
      { before: null, after: { amount: input.amount } },
      input.reason,
    );
    return document as unknown as StoredEntry;
  });
  return toEntry(stored, true);
}

// ---------------------------------------------------------------- customers

export async function saveCustomer(
  raw: unknown,
  actor: string,
): Promise<ReceivableCustomer> {
  const input = customerSaveSchema.parse(raw);
  const db = await connectToDatabase();
  const model = getReceivableCustomerModel();
  const stamp = now();

  const stored = await db.connection.transaction(async (session) => {
    if (input.id) {
      const before = await model
        .findById(input.id)
        .session(session)
        .lean<StoredCustomer>()
        .exec();
      if (!before)
        throw new ReceivablesError("Không tìm thấy khách hàng.", 404);
      const patch = input.patch;
      const nextCode = patch.code?.trim() ?? before.code;
      if (codeKey(nextCode) !== before.normalizedCode) {
        const used = await getReceivableEntryModel()
          .countDocuments({ customerId: before._id })
          .session(session);
        if (used > 0)
          throw new ReceivablesError(
            "Mã khách đã có giao dịch nên không đổi được. Hãy ngừng theo dõi và tạo mã mới.",
            409,
          );
      }
      const after: StoredCustomer = {
        ...before,
        name: patch.name ?? before.name,
        phone: patch.phone ?? before.phone,
        address: patch.address ?? before.address,
        type: patch.type ?? before.type,
        note: patch.note ?? before.note,
        active: patch.active ?? before.active,
        code: nextCode,
        normalizedCode: codeKey(nextCode),
        version: before.version + 1,
        updatedAt: stamp,
        updatedBy: actor,
      };
      const written = await model.updateOne(
        { _id: before._id, version: input.version ?? before.version },
        { $set: after },
        { session },
      );
      if (written.modifiedCount !== 1)
        throw new ReceivablesError(conflictMessage, 409);
      await audit(session, actor, "receivables.customer.update", before._id, {
        before,
        after,
      });
      return after;
    }

    const code = input.patch.code?.trim();
    if (!code) throw new ReceivablesError("Nhập mã khách.");
    const last = await model
      .findOne({})
      .sort({ sortOrder: -1 })
      .session(session)
      .lean<StoredCustomer>()
      .exec();
    const document: StoredCustomer = {
      _id: newId(),
      version: 1,
      code,
      normalizedCode: codeKey(code),
      name: input.patch.name ?? "",
      phone: input.patch.phone ?? "",
      address: input.patch.address ?? "",
      type: input.patch.type ?? "",
      note: input.patch.note ?? "",
      active: input.patch.active ?? true,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      migrationSource: null,
      sourceRow: null,
      createdAt: stamp,
      updatedAt: stamp,
      createdBy: actor,
      updatedBy: actor,
    };
    await model.create([document], { session });
    await audit(session, actor, "receivables.customer.create", document._id, {
      before: null,
      after: document,
    });
    return document;
  });
  return toCustomer(stored);
}

// ---------------------------------------------------------------- export

/**
 * Gathers everything an export needs, using the very same readers the screen
 * uses, so a downloaded workbook and the page can never disagree. Refused
 * outright without `customerDebt.readAmount`: an export is the easiest way to
 * carry money out of the building.
 */
export async function buildExportInput(
  params: URLSearchParams,
  preparedBy: string,
): Promise<ExportInput> {
  if (!(await canReadAmounts()))
    throw new ContentAccessDeniedError("PERMISSION_DENIED");
  const scope = (params.get("scope") ?? "all") as ExportScope;
  if (!exportScopes.includes(scope))
    throw new ReceivablesError("Phạm vi xuất không hợp lệ.");
  const customerId = params.get("customerId");

  const summaryParams = new URLSearchParams(params);
  summaryParams.delete("scope");
  summaryParams.delete("customerId");
  const summary = await readSummary(summaryParams);
  // The workbook holds exactly what the board showed: one customer when a
  // statement was asked for, otherwise every customer the report is about.
  // `includeInactive=1` travels from the screen's own checkbox.
  const rows = customerId
    ? summary.rows.filter((row) => row.customerId === customerId)
    : params.get("includeInactive") === "1"
      ? summary.rows
      : summary.rows.filter(hasActivity);

  const window = summary.window;
  const entryFilter = (role: EntryRole) => {
    const search = new URLSearchParams();
    search.set("role", role);
    search.set("status", "POSTED");
    search.set("limit", "500");
    if (window.from) search.set("from", window.from);
    if (window.to) search.set("to", window.to);
    if (customerId) search.set("customerId", customerId);
    return search;
  };

  // Paged out in full: an export is the one place that must carry every line.
  const collect = async (role: EntryRole) => {
    const all: ReceivableEntry[] = [];
    let offset = 0;
    for (;;) {
      const search = entryFilter(role);
      search.set("offset", String(offset));
      const page = await listEntries(search);
      all.push(...page.entries);
      if (page.nextOffset === null) break;
      offset = page.nextOffset;
    }
    // The workbook reads oldest first; `listEntries` returns newest first.
    return all.reverse();
  };

  const needsSales = scope === "all" || scope === "sales";
  const needsReductions = scope === "all" || scope === "reductions";
  const [sales, reductions] = await Promise.all([
    needsSales ? collect("DEBIT") : Promise.resolve([]),
    needsReductions ? collect("CREDIT") : Promise.resolve([]),
  ]);

  return {
    scope,
    summary: rows.map((row, index) => ({ ...row, stt: index + 1 })),
    totals: sumTotals(rows),
    sales,
    reductions,
    window,
    preparedBy,
    generatedAt: new Date(),
  };
}

// ---------------------------------------------------------------- history

type AuditRow = {
  _id: Types.ObjectId;
  action: string;
  actorId?: Types.ObjectId;
  systemActorName?: string;
  occurredAt: Date;
  resourceId?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
};

/** Resolves actor display names in one query; system actors keep their own name. */
async function toHistoryEntries(rows: AuditRow[]): Promise<HistoryEntry[]> {
  const actorIds = [
    ...new Set(
      rows.flatMap((row) => (row.actorId ? [row.actorId.toHexString()] : [])),
    ),
  ];
  const users = actorIds.length
    ? await getUserModel()
        .find({ _id: { $in: actorIds } })
        .select("displayName")
        .lean<{ _id: Types.ObjectId; displayName?: string }[]>()
        .exec()
    : [];
  const names = new Map(
    users.map((user) => [user._id.toHexString(), user.displayName ?? ""]),
  );
  return rows.map((row) => {
    const actor = row.actorId
      ? row.actorId.toHexString()
      : (row.systemActorName ?? "system");
    return {
      id: row._id.toHexString(),
      action: row.action,
      actor,
      actorName:
        (row.actorId ? names.get(actor) : row.systemActorName) || actor,
      occurredAt: row.occurredAt.toISOString(),
      resourceId: row.resourceId ?? null,
      reason: row.reason ?? null,
      before: row.before ?? null,
      after: row.after ?? null,
    };
  });
}

export async function readHistory({
  offset,
  limit,
}: {
  offset: number;
  limit: number;
}): Promise<HistoryResponse> {
  await connectToDatabase();
  const audit = getAuditEventModel();
  const filter = { resourceType: "receivables" };
  const [rows, total, latest] = await Promise.all([
    audit
      .find(filter)
      .sort({ occurredAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean<AuditRow[]>()
      .exec(),
    audit.countDocuments(filter),
    audit
      .find(filter)
      .sort({ occurredAt: -1 })
      .limit(1)
      .lean<AuditRow[]>()
      .exec(),
  ]);
  const [entries, last] = await Promise.all([
    toHistoryEntries(rows),
    toHistoryEntries(latest),
  ]);
  const end = offset + entries.length;
  const lastEntry = last[0];
  return {
    entries,
    total,
    nextOffset: end < total ? end : null,
    lastActivity: lastEntry
      ? {
          occurredAt: lastEntry.occurredAt,
          actorName: lastEntry.actorName,
          action: lastEntry.action,
        }
      : null,
  };
}

// ---------------------------------------------------------------- guards

/** Throws unless the caller holds the capability the write needs. */
export function assertCapability(
  capabilities: Capabilities,
  action: keyof Capabilities,
): void {
  if (!capabilities[action])
    throw new ContentAccessDeniedError("PERMISSION_DENIED");
}
