import "server-only";
import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import type { ClientSession } from "mongodb";
import type { Types } from "mongoose";
import { z } from "zod";
import { getAuditEventModel } from "@/domains/audit/model";
import { appendAuditEventWithSession } from "@/domains/audit/mongo-repository";
import { getUserModel } from "@/domains/identity/models";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongoose";
import {
  applyTransactionPatch,
  cancelSchema,
  codeKey,
  computeCurrent,
  dateSchema,
  decideStock,
  emptyTransaction,
  facilityPatchSchema,
  formatQuantity,
  idSchema,
  masterBatchSchema,
  materialPatchSchema,
  MaterialsError,
  stockDelta,
  stockState,
  todayInBusinessZone,
  transactionBatchSchema,
  transactionCompleteness,
  type Balance,
  type Facility,
  type FacilityPatch,
  type HistoryEntry,
  type HistoryListResponse,
  type Lookups,
  type MasterKind,
  type Material,
  type MaterialDetailResponse,
  type MaterialPatch,
  type MaterialTransaction,
  type SummaryKpis,
  type SummaryResponse,
  type SummaryRow,
  type TimelineEntry,
  type TransactionListResponse,
  type TransactionType,
} from "./contracts";
import {
  decimalToString,
  getFacilityModel,
  getMaterialModel,
  getMaterialTransactionModel,
  toDecimal128,
  type StoredFacility,
  type StoredMaterial,
  type StoredTransaction,
} from "./models";

export type StoredBalance = Balance;

const conflictMessage =
  "Dữ liệu đã được người khác thay đổi. Bản nháp của bạn vẫn được giữ; tải lại để đối chiếu.";
const codeLockedMessage = "Mã đã có giao dịch; không đổi mã.";

/** Decimal128 | number | string → canonical decimal string ("0" for nothing). */
const canonical = (value: unknown): string =>
  new Decimal(decimalToString(value) ?? "0").toFixed();

export const escapeRegex = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const now = () => new Date().toISOString();

// ---------------------------------------------------------------- mapping

export function toMaterial(
  s: StoredMaterial,
  hasTransactions: boolean,
): Material {
  return {
    id: s._id,
    version: s.version,
    code: s.code,
    name: s.name,
    unit: s.unit,
    openingQuantity: canonical(s.openingQuantity),
    minimumStock:
      s.minimumStock === null || s.minimumStock === undefined
        ? null
        : canonical(s.minimumStock),
    note: s.note,
    active: s.active,
    sortOrder: s.sortOrder,
    hasTransactions,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    createdBy: s.createdBy,
    updatedBy: s.updatedBy,
  };
}

export function toFacility(
  s: StoredFacility,
  hasTransactions: boolean,
): Facility {
  return {
    id: s._id,
    version: s.version,
    code: s.code,
    name: s.name,
    type: s.type,
    phone: s.phone,
    note: s.note,
    active: s.active,
    sortOrder: s.sortOrder,
    hasTransactions,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    createdBy: s.createdBy,
    updatedBy: s.updatedBy,
  };
}

export function toTransaction(s: StoredTransaction): MaterialTransaction {
  return {
    id: s._id,
    version: s.version,
    type: s.type,
    status: s.status,
    transactionDate: s.transactionDate.toISOString().slice(0, 10),
    materialId: s.materialId,
    materialCode: s.materialCode,
    materialName: s.materialName,
    unit: s.unit,
    quantity: canonical(s.quantity),
    unitPrice:
      s.unitPrice === null || s.unitPrice === undefined
        ? null
        : canonical(s.unitPrice),
    amount:
      s.amount === null || s.amount === undefined ? null : canonical(s.amount),
    facilityId: s.facilityId,
    facilityCode: s.facilityCode,
    facilityName: s.facilityName,
    description: s.description,
    note: s.note,
    batchId: s.batchId,
    migrationSource: s.migrationSource,
    sourceRow: s.sourceRow,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    createdBy: s.createdBy,
    updatedBy: s.updatedBy,
    cancelledAt: s.cancelledAt,
    cancelledBy: s.cancelledBy,
    cancelReason: s.cancelReason,
  };
}

/** importKey/fingerprint are not part of the DTO; the caller sets them. */
export function toStoredTransaction(t: MaterialTransaction): StoredTransaction {
  return {
    _id: t.id,
    version: t.version,
    type: t.type,
    status: t.status,
    transactionDate: new Date(`${t.transactionDate}T00:00:00Z`),
    materialId: t.materialId,
    materialCode: t.materialCode,
    materialName: t.materialName,
    unit: t.unit,
    quantity: toDecimal128(t.quantity),
    unitPrice: t.unitPrice === null ? null : toDecimal128(t.unitPrice),
    amount: t.amount === null ? null : toDecimal128(t.amount),
    facilityId: t.facilityId,
    facilityCode: t.facilityCode,
    facilityName: t.facilityName,
    description: t.description,
    note: t.note,
    batchId: t.batchId,
    migrationSource: t.migrationSource,
    sourceRow: t.sourceRow,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    createdBy: t.createdBy,
    updatedBy: t.updatedBy,
    cancelledAt: t.cancelledAt,
    cancelledBy: t.cancelledBy,
    cancelReason: t.cancelReason,
  };
}

const toStoredMaterial = (m: Material): StoredMaterial => ({
  _id: m.id,
  version: m.version,
  code: m.code,
  normalizedCode: codeKey(m.code),
  name: m.name,
  unit: m.unit,
  openingQuantity: toDecimal128(m.openingQuantity),
  minimumStock: m.minimumStock === null ? null : toDecimal128(m.minimumStock),
  note: m.note,
  active: m.active,
  sortOrder: m.sortOrder,
  createdAt: m.createdAt,
  updatedAt: m.updatedAt,
  createdBy: m.createdBy,
  updatedBy: m.updatedBy,
});

const toStoredFacility = (f: Facility): StoredFacility => ({
  _id: f.id,
  version: f.version,
  code: f.code,
  normalizedCode: codeKey(f.code),
  name: f.name,
  type: f.type,
  phone: f.phone,
  note: f.note,
  active: f.active,
  sortOrder: f.sortOrder,
  createdAt: f.createdAt,
  updatedAt: f.updatedAt,
  createdBy: f.createdBy,
  updatedBy: f.updatedBy,
});

/** Same shape the importer hashes, so a re-imported line is recognised as a duplicate. */
export function fingerprintOf(
  t: Pick<
    MaterialTransaction,
    | "type"
    | "transactionDate"
    | "materialCode"
    | "facilityCode"
    | "quantity"
    | "note"
  >,
): string {
  return createHash("sha256")
    .update(
      [
        t.type,
        t.transactionDate,
        codeKey(t.materialCode),
        codeKey(t.facilityCode),
        new Decimal(t.quantity).toFixed(),
        t.note.trim().toLowerCase(),
      ].join("|"),
    )
    .digest("hex");
}

// ---------------------------------------------------------------- reads

type ReferencedIds = { materials: string[]; facilities: (string | null)[] };

/** One $group over every line (any status): which masters are locked. */
async function readReferencedIds(
  filter: Record<string, unknown> = {},
  session: ClientSession | null = null,
): Promise<{ materials: Set<string>; facilities: Set<string> }> {
  const [group] = await getMaterialTransactionModel()
    .aggregate<ReferencedIds>([
      { $match: filter },
      {
        $group: {
          _id: null,
          materials: { $addToSet: "$materialId" },
          facilities: { $addToSet: "$facilityId" },
        },
      },
    ])
    .session(session);
  return {
    materials: new Set(group?.materials ?? []),
    facilities: new Set(
      (group?.facilities ?? []).filter((id): id is string => id !== null),
    ),
  };
}

const masterSort = { sortOrder: 1, code: 1 } as const;

export async function readMasters(): Promise<{
  materials: Material[];
  facilities: Facility[];
}> {
  await connectToDatabase();
  const [materials, facilities, used] = await Promise.all([
    getMaterialModel()
      .find({})
      .sort(masterSort)
      .lean<StoredMaterial[]>()
      .exec(),
    getFacilityModel()
      .find({})
      .sort(masterSort)
      .lean<StoredFacility[]>()
      .exec(),
    readReferencedIds(),
  ]);
  return {
    materials: materials.map((m) => toMaterial(m, used.materials.has(m._id))),
    facilities: facilities.map((f) =>
      toFacility(f, used.facilities.has(f._id)),
    ),
  };
}

export async function readLookups(
  session: ClientSession | null = null,
): Promise<Lookups> {
  // Sequential on purpose: two commands in flight on one session would both
  // try to start the transaction and MongoDB rejects the second.
  const materials = await getMaterialModel()
    .find({})
    .select("_id code name unit active")
    .session(session)
    .lean<Pick<StoredMaterial, "_id" | "code" | "name" | "unit" | "active">[]>()
    .exec();
  const facilities = await getFacilityModel()
    .find({})
    .select("_id code name active")
    .session(session)
    .lean<Pick<StoredFacility, "_id" | "code" | "name" | "active">[]>()
    .exec();
  return {
    materials: materials.map((m) => ({
      id: m._id,
      code: m.code,
      name: m.name,
      unit: m.unit,
      active: m.active,
    })),
    facilities: facilities.map((f) => ({
      id: f._id,
      code: f.code,
      name: f.name,
      active: f.active,
    })),
  };
}

type MovementSums = {
  _id: string;
  inbound: unknown;
  outbound: unknown;
  adjustment: unknown;
};

const sumByType = (type: TransactionType) => ({
  $sum: { $cond: [{ $eq: ["$type", type] }, "$quantity", 0] },
});

const movementGroup = {
  $group: {
    _id: "$materialId",
    inbound: sumByType("INBOUND"),
    outbound: sumByType("OUTBOUND"),
    adjustment: sumByType("ADJUSTMENT"),
  },
};

/** Posted-line sums per material; materials without lines still get a Balance. */
export async function readBalances(
  materialIds: string[] | null,
  session: ClientSession | null = null,
): Promise<Map<string, Balance>> {
  const scope = materialIds ? { $in: materialIds } : null;
  // Sequential: may run inside a transaction session (see readLookups).
  const materials = await getMaterialModel()
    .find(scope ? { _id: scope } : {})
    .select("_id openingQuantity")
    .session(session)
    .lean<Pick<StoredMaterial, "_id" | "openingQuantity">[]>()
    .exec();
  const sums = await getMaterialTransactionModel()
    .aggregate<MovementSums>([
      { $match: { status: "POSTED", ...(scope ? { materialId: scope } : {}) } },
      movementGroup,
    ])
    .session(session);
  const movements = new Map(sums.map((s) => [s._id, s]));
  const balances = new Map<string, Balance>();
  for (const material of materials) {
    const moved = movements.get(material._id);
    const partial = {
      openingQuantity: canonical(material.openingQuantity),
      inboundQuantity: canonical(moved?.inbound),
      outboundQuantity: canonical(moved?.outbound),
      adjustmentQuantity: canonical(moved?.adjustment),
    };
    balances.set(material._id, {
      ...partial,
      currentQuantity: computeCurrent(partial),
    });
  }
  return balances;
}

const emptyBalance: Balance = {
  openingQuantity: "0",
  inboundQuantity: "0",
  outboundQuantity: "0",
  adjustmentQuantity: "0",
  currentQuantity: "0",
};

const stateParamSchema = z.enum(["in", "low", "out"]).nullable();

export async function readSummary(
  params: URLSearchParams,
): Promise<SummaryResponse> {
  await connectToDatabase();
  const [materials, balances] = await Promise.all([
    getMaterialModel()
      .find({})
      .sort(masterSort)
      .lean<StoredMaterial[]>()
      .exec(),
    readBalances(null),
  ]);
  const all = materials.map((m) => {
    const balance = balances.get(m._id) ?? emptyBalance;
    const minimumStock =
      m.minimumStock === null || m.minimumStock === undefined
        ? null
        : canonical(m.minimumStock);
    return {
      materialId: m._id,
      code: m.code,
      name: m.name,
      unit: m.unit,
      ...balance,
      minimumStock,
      note: m.note,
      active: m.active,
      state: stockState(balance.currentQuantity, minimumStock),
    };
  });

  const hasMovement = (row: (typeof all)[number]) =>
    [
      row.inboundQuantity,
      row.outboundQuantity,
      row.adjustmentQuantity,
      row.currentQuantity,
    ].some((value) => !new Decimal(value).isZero());
  // "Tracked" mirrors a Tong kho NVL row: the storekeeper declared an opening
  // stock, a threshold, or moved the material. Catalogue entries that were
  // never stocked stay out of the board and its KPIs unless asked for.
  const tracked = (row: (typeof all)[number]) =>
    row.minimumStock !== null ||
    !new Decimal(row.openingQuantity).isZero() ||
    hasMovement(row);

  // KPIs describe every tracked active material, never the filtered view.
  const kpis: SummaryKpis = {
    materials: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
  };
  for (const row of all) {
    if (!row.active || !tracked(row)) continue;
    kpis.materials += 1;
    if (row.state === "in") kpis.inStock += 1;
    else if (row.state === "low") kpis.lowStock += 1;
    else kpis.outOfStock += 1;
  }

  const q = (params.get("q") ?? "").trim().slice(0, 150);
  const pattern = q ? new RegExp(escapeRegex(q), "i") : null;
  const unit = (params.get("unit") ?? "").trim();
  const state = stateParamSchema.parse(params.get("state") || null);
  // includeInactive=1 returns the whole catalogue (the client's stock cache needs every id).
  const includeInactive = params.get("includeInactive") === "1";
  const rows: SummaryRow[] = all
    .filter(
      (row) =>
        includeInactive || (row.active && tracked(row)) || hasMovement(row),
    )
    .filter(
      (row) => !pattern || pattern.test(row.code) || pattern.test(row.name),
    )
    .filter((row) => !unit || codeKey(row.unit) === codeKey(unit))
    .filter((row) => !state || row.state === state)
    .map((row, index) => ({ stt: index + 1, ...row }));
  return { rows, kpis, generatedAt: now() };
}

const ledgerTypeSchema = z.enum(["INBOUND", "OUTBOUND"]);
const statusParamSchema = z.enum(["POSTED", "CANCELLED", "ALL"]);
const utcDay = (value: string) =>
  new Date(`${dateSchema.parse(value)}T00:00:00Z`);

export function transactionFilter(
  params: URLSearchParams,
): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    type: ledgerTypeSchema.parse(params.get("type")),
  };
  const status = statusParamSchema.parse(params.get("status") || "POSTED");
  if (status !== "ALL") filter.status = status;
  const from = params.get("from");
  const to = params.get("to");
  if (from || to)
    filter.transactionDate = {
      ...(from ? { $gte: utcDay(from) } : {}),
      ...(to ? { $lte: utcDay(to) } : {}),
    };
  const materialId = params.get("materialId");
  if (materialId) filter.materialId = idSchema.parse(materialId);
  const facilityId = params.get("facilityId");
  if (facilityId) filter.facilityId = idSchema.parse(facilityId);
  const q = (params.get("q") ?? "").trim().slice(0, 150);
  if (q) {
    const regex = { $regex: escapeRegex(q), $options: "i" };
    filter.$or = [
      "materialCode",
      "materialName",
      "facilityCode",
      "facilityName",
      "note",
      "description",
    ].map((field) => ({ [field]: regex }));
  }
  return filter;
}

const offsetSchema = z.coerce.number().int().min(0).max(10_000_000);
const limitSchema = z.coerce.number().int().min(1).max(500);
const ledgerSort = { transactionDate: -1, createdAt: -1, _id: -1 } as const;

export async function listTransactions(
  params: URLSearchParams,
): Promise<TransactionListResponse> {
  await connectToDatabase();
  const filter = transactionFilter(params);
  const offset = offsetSchema.parse(params.get("offset") ?? 0);
  const limit = limitSchema.parse(params.get("limit") ?? 200);
  const model = getMaterialTransactionModel();
  const [documents, total] = await Promise.all([
    model
      .find(filter)
      .sort(ledgerSort)
      .skip(offset)
      .limit(limit)
      .lean<StoredTransaction[]>()
      .exec(),
    model.countDocuments(filter),
  ]);
  const end = offset + documents.length;
  const actorNames = await resolveActorNames(documents.map((d) => d.updatedBy));
  return {
    rows: documents.map(toTransaction),
    total,
    nextOffset: end < total ? end : null,
    actorNames: Object.fromEntries(actorNames),
  };
}

/** Display names for user ids (system actors and unknown ids are left out). */
async function resolveActorNames(
  ids: readonly string[],
): Promise<Map<string, string>> {
  const userIds = [...new Set(ids.filter((id) => /^[0-9a-f]{24}$/i.test(id)))];
  if (!userIds.length) return new Map();
  const users = await getUserModel()
    .find({ _id: { $in: userIds } })
    .select("displayName")
    .lean<{ _id: Types.ObjectId; displayName?: string }[]>()
    .exec();
  return new Map(
    users.flatMap((u) =>
      u.displayName ? [[u._id.toHexString(), u.displayName] as const] : [],
    ),
  );
}

// ---------------------------------------------------------------- stock guard

/**
 * Takes the document lock on every affected material so a concurrent batch
 * for the same material aborts with a WriteConflict and is retried after this
 * one commits. Must run before the balance read.
 */
async function touchMaterials(
  materialIds: Iterable<string>,
  session: ClientSession,
): Promise<string[]> {
  const ids = [...new Set(materialIds)].sort();
  const stamp = now();
  for (const _id of ids)
    await getMaterialModel().updateOne(
      { _id },
      { $set: { updatedAt: stamp } },
      { session },
    );
  return ids;
}

function assertStock(
  deltas: Map<string, Decimal>,
  balances: Map<string, Balance>,
  unitOf: (materialId: string) => string,
): void {
  for (const [materialId, delta] of deltas) {
    const current = balances.get(materialId)?.currentQuantity ?? "0";
    const decision = decideStock(current, delta);
    if (decision.allowed) continue;
    const unit = unitOf(materialId);
    throw new MaterialsError(
      `Số lượng xuất vượt quá tồn kho hiện tại. Tồn hiện tại: ${formatQuantity(decision.current)} ${unit} · Yêu cầu xuất: ${formatQuantity(decision.requested)} ${unit}`,
      409,
      {
        materialId,
        current: decision.current,
        requested: decision.requested,
        resulting: decision.resulting,
      },
    );
  }
}

const addDelta = (
  deltas: Map<string, Decimal>,
  materialId: string,
  delta: Decimal,
) =>
  deltas.set(materialId, (deltas.get(materialId) ?? new Decimal(0)).add(delta));

const audit = (
  session: ClientSession,
  actor: string,
  action: string,
  resourceId: string,
  changes: { before: unknown; after: unknown },
) =>
  appendAuditEventWithSession(
    {
      actor: { type: "user", userId: actor },
      action,
      resourceType: "materials",
      resourceId,
      requestId: crypto.randomUUID(),
      changes,
      occurredAt: new Date(),
    },
    session,
  );

// ---------------------------------------------------------------- transactions

export async function saveTransactions(
  raw: unknown,
  actor: string,
  allowed: { receive: boolean; issue: boolean },
): Promise<{ rows: MaterialTransaction[]; batchId: string }> {
  const { changes } = transactionBatchSchema.parse(raw);
  if (new Set(changes.map((c) => c.id)).size !== changes.length)
    throw new MaterialsError("Dòng bị lặp trong yêu cầu.");
  for (const change of changes) {
    if (change.type === "ADJUSTMENT")
      throw new MaterialsError("Điều chỉnh tồn kho chưa được mở.");
    if (change.type === "INBOUND" ? !allowed.receive : !allowed.issue)
      throw new ContentAccessDeniedError("PERMISSION_DENIED");
  }

  const db = await connectToDatabase();
  const batchId = crypto.randomUUID();
  const rows = await db.connection.transaction(async (session) => {
    const model = getMaterialTransactionModel();
    const storedRows = await model
      .find({ _id: { $in: changes.map((c) => c.id) } })
      .session(session)
      .lean<StoredTransaction[]>()
      .exec();
    const lookups = await readLookups(session);
    const stored = new Map(storedRows.map((s) => [s._id, s]));
    const unitOf = (materialId: string) =>
      lookups.materials.find((m) => m.id === materialId)?.unit ?? "";

    const deltas = new Map<string, Decimal>();
    const prepared: {
      change: (typeof changes)[number];
      before: MaterialTransaction | null;
      after: MaterialTransaction;
    }[] = [];
    for (const change of changes) {
      const current = stored.get(change.id);
      if ((current?.version ?? 0) !== change.version)
        throw new MaterialsError(conflictMessage, 409);
      if (current?.status === "CANCELLED")
        throw new MaterialsError("Dòng đã bị hủy; tải lại để đối chiếu.", 409);
      const before = current ? toTransaction(current) : null;
      if (before && before.type !== change.type)
        throw new MaterialsError(
          "Không thể đổi loại giao dịch của dòng đã lưu.",
        );
      const base =
        before ??
        emptyTransaction(
          change.id,
          change.type,
          change.patch.transactionDate ?? todayInBusinessZone(),
          actor,
        );
      const after = applyTransactionPatch(base, change.patch, lookups);
      const missing = transactionCompleteness(after);
      if (missing) throw new MaterialsError(missing);
      const stamp = now();
      after.version = base.version + 1;
      after.updatedAt = stamp;
      after.updatedBy = actor;
      if (!before) {
        after.createdAt = stamp;
        after.createdBy = actor;
        after.batchId = batchId;
      }
      if (before)
        addDelta(
          deltas,
          before.materialId,
          stockDelta(before.type, before.quantity).neg(),
        );
      addDelta(
        deltas,
        after.materialId,
        stockDelta(after.type, after.quantity),
      );
      prepared.push({ change, before, after });
    }

    const affected = await touchMaterials(deltas.keys(), session);
    assertStock(deltas, await readBalances(affected, session), unitOf);

    const saved: MaterialTransaction[] = [];
    for (const { change, before, after } of prepared) {
      const { _id, ...values } = toStoredTransaction(after);
      const document = { ...values, fingerprint: fingerprintOf(after) };
      if (before) {
        const written = await model.updateOne(
          { _id, version: change.version, status: "POSTED" },
          { $set: document },
          { session },
        );
        if (written.modifiedCount !== 1)
          throw new MaterialsError(conflictMessage, 409);
      } else await model.create([{ _id, ...document }], { session });
      await audit(
        session,
        actor,
        before
          ? "materials.transaction.update"
          : "materials.transaction.create",
        after.id,
        { before, after },
      );
      saved.push(after);
    }
    return saved;
  });
  return { rows, batchId };
}

export async function cancelTransaction(
  raw: unknown,
  actor: string,
): Promise<MaterialTransaction> {
  const input = cancelSchema.parse(raw);
  const db = await connectToDatabase();
  return db.connection.transaction(async (session) => {
    const model = getMaterialTransactionModel();
    const stored = await model
      .findById(input.id)
      .session(session)
      .lean<StoredTransaction | null>()
      .exec();
    if (!stored)
      throw new MaterialsError("Không tìm thấy dòng giao dịch.", 404);
    if (stored.status !== "POSTED")
      throw new MaterialsError("Dòng đã bị hủy trước đó.", 409);
    if (stored.version !== input.version)
      throw new MaterialsError(conflictMessage, 409);
    const before = toTransaction(stored);

    const deltas = new Map<string, Decimal>();
    addDelta(
      deltas,
      before.materialId,
      stockDelta(before.type, before.quantity).neg(),
    );
    const affected = await touchMaterials(deltas.keys(), session);
    assertStock(
      deltas,
      await readBalances(affected, session),
      () => before.unit,
    );

    const stamp = now();
    const after: MaterialTransaction = {
      ...before,
      version: before.version + 1,
      status: "CANCELLED",
      cancelledAt: stamp,
      cancelledBy: actor,
      cancelReason: input.reason ?? null,
      updatedAt: stamp,
      updatedBy: actor,
    };
    const written = await model.updateOne(
      { _id: input.id, version: input.version, status: "POSTED" },
      {
        $set: {
          status: after.status,
          cancelledAt: after.cancelledAt,
          cancelledBy: after.cancelledBy,
          cancelReason: after.cancelReason,
          updatedAt: after.updatedAt,
          updatedBy: after.updatedBy,
        },
        $inc: { version: 1 },
      },
      { session },
    );
    if (written.modifiedCount !== 1)
      throw new MaterialsError(conflictMessage, 409);
    await audit(session, actor, "materials.transaction.cancel", after.id, {
      before,
      after,
    });
    return after;
  });
}

// ---------------------------------------------------------------- masters

function applyMaterialPatch(base: Material, patch: MaterialPatch): Material {
  return {
    ...base,
    ...(patch.code !== undefined ? { code: patch.code } : {}),
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.unit !== undefined ? { unit: patch.unit } : {}),
    ...(patch.openingQuantity !== undefined
      ? { openingQuantity: patch.openingQuantity }
      : {}),
    ...(patch.minimumStock !== undefined
      ? { minimumStock: patch.minimumStock }
      : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
    ...(patch.active !== undefined ? { active: patch.active } : {}),
  };
}

function applyFacilityPatch(base: Facility, patch: FacilityPatch): Facility {
  return {
    ...base,
    ...(patch.code !== undefined ? { code: patch.code } : {}),
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.type !== undefined ? { type: patch.type } : {}),
    ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
    ...(patch.active !== undefined ? { active: patch.active } : {}),
  };
}

const emptyMaster = (id: string, sortOrder: number, actor: string) => {
  const stamp = now();
  return {
    id,
    version: 0,
    code: "",
    name: "",
    note: "",
    active: true,
    sortOrder,
    hasTransactions: false,
    createdAt: stamp,
    updatedAt: stamp,
    createdBy: actor,
    updatedBy: actor,
  };
};

type MasterRow = Material | Facility;

export async function saveMasters(
  raw: unknown,
  actor: string,
): Promise<{ kind: MasterKind; rows: MasterRow[] }> {
  const { kind, changes } = masterBatchSchema.parse(raw);
  if (new Set(changes.map((c) => c.id)).size !== changes.length)
    throw new MaterialsError("Dòng bị lặp trong yêu cầu.");
  const parsed = changes.map((change) => ({
    ...change,
    patch:
      kind === "material"
        ? { kind, value: materialPatchSchema.parse(change.patch) }
        : { kind, value: facilityPatchSchema.parse(change.patch) },
  }));
  const label = kind === "material" ? "vật tư" : "cơ sở";

  const db = await connectToDatabase();
  const rows = await db.connection.transaction(async (session) => {
    const ids = parsed.map((c) => c.id);
    const referenceField = kind === "material" ? "materialId" : "facilityId";
    // One command at a time on the session (see readLookups).
    const storedMaterials =
      kind === "material"
        ? await getMaterialModel()
            .find({ _id: { $in: ids } })
            .session(session)
            .lean<StoredMaterial[]>()
            .exec()
        : ([] as StoredMaterial[]);
    const storedFacilities =
      kind === "facility"
        ? await getFacilityModel()
            .find({ _id: { $in: ids } })
            .session(session)
            .lean<StoredFacility[]>()
            .exec()
        : ([] as StoredFacility[]);
    const used = await readReferencedIds(
      { [referenceField]: { $in: ids } },
      session,
    );
    const last = await (
      kind === "material" ? getMaterialModel() : getFacilityModel()
    )
      .findOne({})
      .sort({ sortOrder: -1 })
      .select("sortOrder")
      .session(session)
      .lean<{ sortOrder: number } | null>()
      .exec();
    const usedIds = kind === "material" ? used.materials : used.facilities;
    const stored = new Map<string, MasterRow>([
      ...storedMaterials.map((m): [string, MasterRow] => [
        m._id,
        toMaterial(m, usedIds.has(m._id)),
      ]),
      ...storedFacilities.map((f): [string, MasterRow] => [
        f._id,
        toFacility(f, usedIds.has(f._id)),
      ]),
    ]);
    let nextSortOrder = (last?.sortOrder ?? 0) + 1;
    const codesInBatch = new Set<string>();
    const saved: MasterRow[] = [];

    for (const change of parsed) {
      const before = stored.get(change.id) ?? null;
      if ((before?.version ?? 0) !== change.version)
        throw new MaterialsError(conflictMessage, 409);
      let after: MasterRow;
      if (change.patch.kind === "material") {
        const base: Material = (before as Material | null) ?? {
          ...emptyMaster(change.id, nextSortOrder++, actor),
          unit: "",
          openingQuantity: "0",
          minimumStock: null,
        };
        after = applyMaterialPatch(base, change.patch.value);
      } else {
        const base: Facility = (before as Facility | null) ?? {
          ...emptyMaster(change.id, nextSortOrder++, actor),
          type: "",
          phone: "",
        };
        after = applyFacilityPatch(base, change.patch.value);
      }
      if (!after.code.trim())
        throw new MaterialsError(`Mã ${label} không được trống.`);
      if (before?.hasTransactions && after.code !== before.code)
        throw new MaterialsError(codeLockedMessage, 409);
      // Tồn đầu kỳ feeds the balance like a movement: lowering it may not
      // push the material below zero (raising it is always allowed).
      if (kind === "material" && before && "openingQuantity" in after) {
        const delta = new Decimal(after.openingQuantity).sub(
          (before as Material).openingQuantity,
        );
        if (delta.lt(0)) {
          await touchMaterials([change.id], session);
          const balance = (await readBalances([change.id], session)).get(
            change.id,
          );
          const decision = decideStock(balance?.currentQuantity ?? "0", delta);
          if (!decision.allowed)
            throw new MaterialsError(
              `Tồn đầu mới làm tồn kho âm. Tồn hiện tại: ${formatQuantity(decision.current)} ${(after as Material).unit} · Sau khi sửa: ${formatQuantity(decision.resulting)} ${(after as Material).unit}`,
              409,
              {
                materialId: change.id,
                current: decision.current,
                requested: decision.requested,
                resulting: decision.resulting,
              },
            );
        }
      }

      const normalized = codeKey(after.code);
      const model =
        kind === "material" ? getMaterialModel() : getFacilityModel();
      const clash =
        codesInBatch.has(normalized) ||
        (await model
          .exists({ normalizedCode: normalized, _id: { $ne: change.id } })
          .session(session)
          .exec()) !== null;
      if (clash)
        throw new MaterialsError(`Mã "${after.code}" đã tồn tại.`, 409);
      codesInBatch.add(normalized);

      after.version = (before?.version ?? 0) + 1;
      after.updatedAt = now();
      after.updatedBy = actor;
      const { _id, ...values } =
        kind === "material"
          ? toStoredMaterial(after as Material)
          : toStoredFacility(after as Facility);
      if (before) {
        const written = await model.updateOne(
          { _id, version: change.version },
          { $set: values },
          { session },
        );
        if (written.modifiedCount !== 1)
          throw new MaterialsError(conflictMessage, 409);
      } else await model.create([{ _id, ...values }], { session });
      await audit(
        session,
        actor,
        `materials.${kind}.${before ? "update" : "create"}`,
        after.id,
        { before, after },
      );
      saved.push(after);
    }
    return saved;
  });
  return { kind, rows };
}

// ---------------------------------------------------------------- detail

type AuditRow = {
  _id: Types.ObjectId;
  actorType: "user" | "system";
  actorId?: Types.ObjectId | null;
  systemActorName?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  occurredAt: Date;
};

const auditFilter = (materialId?: string) =>
  materialId
    ? {
        resourceType: "materials",
        $or: [
          { resourceId: materialId },
          { "after.materialId": materialId },
          { "before.materialId": materialId },
        ],
      }
    : { resourceType: "materials" };

/** Resolves actor display names in one query; system actors keep their own name. */
async function toHistoryEntries(events: AuditRow[]): Promise<HistoryEntry[]> {
  const actorIds = [
    ...new Set(
      events.flatMap((e) => (e.actorId ? [e.actorId.toHexString()] : [])),
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
    users.map((u) => [u._id.toHexString(), u.displayName ?? ""]),
  );
  return events.map((e) => {
    const actor = e.actorId
      ? e.actorId.toHexString()
      : (e.systemActorName ?? "system");
    return {
      id: e._id.toHexString(),
      action: e.action,
      actor,
      actorName: (e.actorId ? names.get(actor) : e.systemActorName) || actor,
      occurredAt: e.occurredAt.toISOString(),
      resourceType: e.resourceType,
      resourceId: e.resourceId ?? null,
      before: e.before ?? null,
      after: e.after ?? null,
      metadata: e.metadata ?? null,
    };
  });
}

async function readHistory(materialId: string): Promise<HistoryEntry[]> {
  const events = await getAuditEventModel()
    .find(auditFilter(materialId))
    .sort({ occurredAt: -1 })
    .limit(50)
    .lean<AuditRow[]>()
    .exec();
  return toHistoryEntries(events);
}

const historyLimitSchema = z.coerce.number().int().min(1).max(200);

/** Warehouse-wide audit page (newest first) plus the counts the page header shows. */
export async function readWarehouseHistory({
  offset,
  limit,
}: {
  offset: number;
  limit: number;
}): Promise<HistoryListResponse> {
  await connectToDatabase();
  const size = historyLimitSchema.parse(limit);
  const start = offsetSchema.parse(offset);
  const audit = getAuditEventModel();
  const filter = auditFilter();
  const [events, total, transactions, latest] = await Promise.all([
    audit
      .find(filter)
      .sort({ occurredAt: -1 })
      .skip(start)
      .limit(size)
      .lean<AuditRow[]>()
      .exec(),
    audit.countDocuments(filter),
    getMaterialTransactionModel().countDocuments({ status: "POSTED" }),
    // Unpaged: the header needs the newest event even when offset > 0.
    audit
      .find(filter)
      .sort({ occurredAt: -1 })
      .limit(1)
      .lean<AuditRow[]>()
      .exec(),
  ]);
  const [entries, last] = await Promise.all([
    toHistoryEntries(events),
    toHistoryEntries(latest),
  ]);
  const end = start + entries.length;
  const lastEntry = last[0];
  return {
    entries,
    total,
    nextOffset: end < total ? end : null,
    transactions,
    lastActivity: lastEntry
      ? {
          occurredAt: lastEntry.occurredAt,
          actorName: lastEntry.actorName,
          action: lastEntry.action,
        }
      : null,
  };
}

/** Net stock effect of the posted lines that sort after `first` (newer in ledger order). */
async function newerDelta(
  materialId: string,
  first: StoredTransaction,
): Promise<Decimal> {
  const [sums] = await getMaterialTransactionModel().aggregate<MovementSums>([
    {
      $match: {
        materialId,
        status: "POSTED",
        $or: [
          { transactionDate: { $gt: first.transactionDate } },
          {
            transactionDate: first.transactionDate,
            createdAt: { $gt: first.createdAt },
          },
          {
            transactionDate: first.transactionDate,
            createdAt: first.createdAt,
            _id: { $gt: first._id },
          },
        ],
      },
    },
    movementGroup,
  ]);
  if (!sums) return new Decimal(0);
  return new Decimal(canonical(sums.inbound))
    .sub(canonical(sums.outbound))
    .add(canonical(sums.adjustment));
}

export async function readMaterialDetail(
  id: string,
  offset: number,
  limit = 200,
): Promise<MaterialDetailResponse> {
  await connectToDatabase();
  const stored = await getMaterialModel()
    .findById(id)
    .lean<StoredMaterial | null>()
    .exec();
  if (!stored) throw new MaterialsError("Không tìm thấy vật tư.", 404);
  const model = getMaterialTransactionModel();
  const filter = { materialId: id, status: "POSTED" };
  const [balances, page, total, hasAny, history] = await Promise.all([
    readBalances([id]),
    model
      .find(filter)
      .sort(ledgerSort)
      .skip(offset)
      .limit(limit)
      .lean<StoredTransaction[]>()
      .exec(),
    model.countDocuments(filter),
    model.exists({ materialId: id }).exec(),
    readHistory(id),
  ]);
  const material = toMaterial(stored, hasAny !== null);
  const balance = balances.get(id) ?? emptyBalance;

  // Walk the page newest-first: the balance after a line is the running total before its delta.
  const first = page[0];
  let running = new Decimal(balance.currentQuantity);
  if (first && offset > 0) running = running.sub(await newerDelta(id, first));
  const timeline: TimelineEntry[] = page.map((row) => {
    const entry = { ...toTransaction(row), balanceAfter: running.toFixed() };
    running = running.sub(stockDelta(entry.type, entry.quantity));
    return entry;
  });
  const end = offset + page.length;
  return {
    material,
    balance,
    state: stockState(balance.currentQuantity, material.minimumStock),
    timeline,
    timelineTotal: total,
    nextOffset: end < total ? end : null,
    history,
  };
}

export async function readMaterialByCode(
  code: string,
): Promise<Material | null> {
  await connectToDatabase();
  const stored = await getMaterialModel()
    .findOne({ normalizedCode: codeKey(code) })
    .lean<StoredMaterial | null>()
    .exec();
  if (!stored) return null;
  const used = await getMaterialTransactionModel()
    .exists({ materialId: stored._id })
    .exec();
  return toMaterial(stored, used !== null);
}
