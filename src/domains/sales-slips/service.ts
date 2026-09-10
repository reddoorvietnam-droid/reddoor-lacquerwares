import "server-only";
import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongoose";
import {
  appendAuditEventWithSession,
  mongoAuditRepository,
} from "@/domains/audit/mongo-repository";
import { getAuditEventModel } from "@/domains/audit/model";
import { getUserModel } from "@/domains/identity/models";
import { getPaintMasterModel } from "@/domains/paint-warehouse/models";
import {
  getSalesSlipCounterModel,
  getSalesSlipModel,
  toSlip,
  toStored,
  type StoredSlip,
} from "./models";
import {
  applyDraft,
  confirmProblems,
  createSchema,
  dateSchema,
  describeChanges,
  emptySlip,
  internalNumberFor,
  mentionsMoney,
  redactPrices,
  salesSlipStatuses,
  sortOptions,
  transitionSchema,
  updateSchema,
  SalesSlipError,
  type ApplyOptions,
  type HistoryEntry,
  type ListResponse,
  type Masters,
  type SalesSlip,
} from "./contracts";

const resourceType = "salesSlip";

// ---------------------------------------------------------------- masters

type PaintMasterRow = {
  _id: Types.ObjectId;
  kind: "facility" | "material";
  code?: string;
  name?: string;
  unit?: string;
  salePrice?: string | null;
};

/**
 * The paint-warehouse master is the canonical catalogue: `material` rows are
 * the items (their `salePrice` is the "Giá" default), `facility` rows the
 * recipients. The export-ledger `unitPrice` is deliberately not read here.
 */
export async function readMasters(): Promise<Masters> {
  await connectToDatabase();
  const rows = await getPaintMasterModel()
    .find({})
    .select("kind code name unit salePrice")
    .lean<PaintMasterRow[]>()
    .exec();
  const byCode = (a: { code: string }, b: { code: string }) =>
    a.code.localeCompare(b.code, "en", { sensitivity: "base" });
  return {
    items: rows
      .filter((row) => row.kind === "material")
      .map((row) => ({
        id: row._id.toHexString(),
        code: row.code ?? "",
        name: row.name ?? "",
        unit: row.unit ?? "",
        salePrice: row.salePrice ?? null,
      }))
      .sort(byCode),
    recipients: rows
      .filter((row) => row.kind === "facility")
      .map((row) => ({
        id: row._id.toHexString(),
        code: row.code ?? "",
        name: row.name ?? "",
      }))
      .sort(byCode),
  };
}

// ---------------------------------------------------------------- people

const migrationActor = "sales-workbook-migration";

/** Display names for actor ids; a migration actor reads as the import itself. */
export async function peopleNames(
  ids: readonly (string | null)[],
): Promise<Record<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  const names: Record<string, string> = {};
  const objectIds = wanted.filter((id) => Types.ObjectId.isValid(id));
  for (const id of wanted)
    if (!Types.ObjectId.isValid(id))
      names[id] = id === migrationActor ? "Nhập từ Excel" : id;
  if (objectIds.length) {
    await connectToDatabase();
    const users = await getUserModel()
      .find({ _id: { $in: objectIds.map((id) => new Types.ObjectId(id)) } })
      .select("displayName email")
      .lean<
        { _id: Types.ObjectId; displayName?: string | null; email: string }[]
      >()
      .exec();
    for (const user of users)
      names[user._id.toHexString()] = user.displayName?.trim() || user.email;
  }
  return names;
}

// ---------------------------------------------------------------- reads

const listQuerySchema = z.object({
  q: z.string().trim().max(150).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  recipient: z.string().trim().max(150).optional(),
  status: z.enum(salesSlipStatuses).optional(),
  hideCancelled: z.enum(["1"]).optional(),
  createdBy: z.string().trim().max(150).optional(),
  sort: z.enum(sortOptions).optional(),
  offset: z.coerce.number().int().min(0).max(10_000_000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const escapeRegex = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function listFilter(params: URLSearchParams, canReadPrice: boolean) {
  const query = listQuerySchema.parse(
    Object.fromEntries([...params].filter(([, value]) => value !== "")),
  );
  const filter: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];
  if (query.from || query.to)
    filter.slipDate = {
      ...(query.from ? { $gte: new Date(`${query.from}T00:00:00Z`) } : {}),
      ...(query.to ? { $lte: new Date(`${query.to}T00:00:00Z`) } : {}),
    };
  if (query.status) filter.status = query.status;
  else if (query.hideCancelled) filter.status = { $ne: "CANCELLED" };
  if (query.createdBy) filter.createdBy = query.createdBy;
  if (query.recipient) {
    const pattern = { $regex: escapeRegex(query.recipient), $options: "i" };
    and.push({ $or: [{ recipientName: pattern }, { recipientCode: pattern }] });
  }
  if (query.q) {
    const pattern = { $regex: escapeRegex(query.q), $options: "i" };
    and.push({
      $or: [
        { internalNumber: pattern },
        { recipientName: pattern },
        { "lines.itemCode": pattern },
        { "lines.itemName": pattern },
        { migrationSheet: pattern },
      ],
    });
  }
  if (and.length) filter.$and = and;
  const sortKey = query.sort ?? "newest";
  const sort: Record<string, 1 | -1> =
    sortKey === "oldest"
      ? { createdAt: 1, _id: 1 }
      : sortKey === "dateAsc"
        ? { slipDate: 1, createdAt: 1 }
        : sortKey === "dateDesc"
          ? { slipDate: -1, createdAt: -1 }
          : sortKey === "totalDesc" && canReadPrice
            ? { subtotal: -1, createdAt: -1 }
            : sortKey === "totalAsc" && canReadPrice
              ? { subtotal: 1, createdAt: 1 }
              : { createdAt: -1, _id: -1 };
  return {
    filter,
    sort,
    offset: query.offset ?? 0,
    limit: query.limit ?? 50,
  };
}

export async function listSlips(
  params: URLSearchParams,
  canReadPrice: boolean,
): Promise<ListResponse> {
  await connectToDatabase();
  const { filter, sort, offset, limit } = listFilter(params, canReadPrice);
  const [documents, total] = await Promise.all([
    getSalesSlipModel()
      .find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean<StoredSlip[]>()
      .exec(),
    getSalesSlipModel().countDocuments(filter),
  ]);
  const slips = documents.map((stored) =>
    canReadPrice ? toSlip(stored) : redactPrices(toSlip(stored)),
  );
  return {
    slips,
    total,
    nextOffset:
      offset + documents.length < total ? offset + documents.length : null,
    people: await peopleNames(
      slips.flatMap((slip) => [slip.createdBy, slip.updatedBy]),
    ),
  };
}

/** Distinct creators for the list filter, as `{ id, name }`. */
export async function listCreators(): Promise<{ id: string; name: string }[]> {
  await connectToDatabase();
  const ids = (await getSalesSlipModel().distinct("createdBy")) as string[];
  const names = await peopleNames(ids);
  return ids
    .map((id) => ({ id, name: names[id] ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export async function readSlip(
  id: string,
  canReadPrice: boolean,
): Promise<{ slip: SalesSlip; people: Record<string, string> }> {
  await connectToDatabase();
  const stored = await getSalesSlipModel()
    .findById(id)
    .lean<StoredSlip | null>()
    .exec();
  if (!stored) throw new SalesSlipError("Không tìm thấy phiếu bán hàng.", 404);
  const slip = canReadPrice ? toSlip(stored) : redactPrices(toSlip(stored));
  return {
    slip,
    people: await peopleNames([
      slip.createdBy,
      slip.updatedBy,
      slip.confirmedBy,
      slip.cancelledBy,
    ]),
  };
}

export async function readHistory(
  id: string,
  canReadPrice: boolean,
): Promise<HistoryEntry[]> {
  await connectToDatabase();
  const events = await getAuditEventModel()
    .find({ resourceType, resourceId: id })
    .sort({ occurredAt: -1 })
    .limit(300)
    .lean<
      {
        _id: Types.ObjectId;
        actorType: "user" | "system";
        actorId?: Types.ObjectId;
        systemActorName?: string;
        action: string;
        reason?: string;
        metadata?: { changes?: unknown; format?: unknown };
        occurredAt: Date;
      }[]
    >()
    .exec();
  const names = await peopleNames(
    events.map((event) => event.actorId?.toHexString() ?? null),
  );
  return events.map((event) => {
    const raw = event.metadata?.changes;
    const changes = Array.isArray(raw)
      ? raw.filter((change): change is string => typeof change === "string")
      : [];
    return {
      id: event._id.toHexString(),
      action: event.action,
      actorName:
        event.actorType === "user" && event.actorId
          ? (names[event.actorId.toHexString()] ?? "Người dùng")
          : event.systemActorName === migrationActor
            ? "Nhập từ Excel"
            : (event.systemActorName ?? "Hệ thống"),
      occurredAt: event.occurredAt.toISOString(),
      reason: event.reason ?? null,
      changes: canReadPrice
        ? changes
        : changes.filter((c) => !mentionsMoney(c)),
    };
  });
}

// ---------------------------------------------------------------- writes

const staleMessage =
  "Phiếu đã được người khác cập nhật. Vui lòng tải lại dữ liệu.";

const userActor = (actor: string) => ({ type: "user" as const, userId: actor });

export async function createSlip(
  raw: unknown,
  actor: string,
  options: ApplyOptions,
): Promise<SalesSlip> {
  const { id, draft } = createSchema.parse(raw);
  const db = await connectToDatabase();
  const masters = await readMasters();
  return db.connection.transaction(async (session) => {
    const existing = await getSalesSlipModel()
      .findById(id)
      .session(session)
      .lean<StoredSlip | null>()
      .exec();
    if (existing)
      throw new SalesSlipError(
        "Phiếu đã được tạo trước đó; tải lại để tiếp tục.",
        409,
      );
    const base = emptySlip(id, draft.slipDate, actor);
    const slip = applyDraft(base, draft, masters, options);
    const counter = await getSalesSlipCounterModel()
      .findOneAndUpdate(
        { _id: `PBH-${slip.slipDate.replaceAll("-", "")}` },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: "after", session },
      )
      .lean<{ seq: number }>()
      .exec();
    slip.internalNumber = internalNumberFor(slip.slipDate, counter?.seq ?? 1);
    slip.version = 1;
    slip.updatedAt = new Date().toISOString();
    await getSalesSlipModel().create([toStored(slip)], { session });
    await appendAuditEventWithSession(
      {
        actor: userActor(actor),
        action: "salesSlips.create",
        resourceType,
        resourceId: id,
        requestId: crypto.randomUUID(),
        changes: { before: null, after: slip },
        metadata: { changes: describeChanges(base, slip) },
        occurredAt: new Date(),
      },
      session,
    );
    return slip;
  });
}

async function loadForWrite(
  id: string,
  version: number,
  session: Parameters<typeof appendAuditEventWithSession>[1],
): Promise<SalesSlip> {
  const stored = await getSalesSlipModel()
    .findById(id)
    .session(session)
    .lean<StoredSlip | null>()
    .exec();
  if (!stored) throw new SalesSlipError("Không tìm thấy phiếu bán hàng.", 404);
  if (stored.version !== version) throw new SalesSlipError(staleMessage, 409);
  return toSlip(stored);
}

async function persist(
  before: SalesSlip,
  after: SalesSlip,
  actor: string,
  session: Parameters<typeof appendAuditEventWithSession>[1],
): Promise<SalesSlip> {
  after.version = before.version + 1;
  after.updatedAt = new Date().toISOString();
  after.updatedBy = actor;
  const { _id, ...values } = toStored(after);
  void _id;
  const written = await getSalesSlipModel().updateOne(
    { _id: before.id, version: before.version },
    { $set: values },
    { session },
  );
  if (written.modifiedCount !== 1) throw new SalesSlipError(staleMessage, 409);
  return after;
}

export async function updateSlip(
  id: string,
  raw: unknown,
  actor: string,
  options: ApplyOptions,
): Promise<SalesSlip> {
  const { version, draft } = updateSchema.parse(raw);
  const db = await connectToDatabase();
  const masters = await readMasters();
  return db.connection.transaction(async (session) => {
    const before = await loadForWrite(id, version, session);
    if (before.status !== "DRAFT")
      throw new SalesSlipError(
        "Phiếu đã xác nhận hoặc đã hủy; mở lại phiếu trước khi sửa.",
        409,
      );
    const applied = applyDraft(before, draft, masters, options);
    const changes = describeChanges(before, applied);
    if (changes.length === 0) return before;
    const after = await persist(before, applied, actor, session);
    await appendAuditEventWithSession(
      {
        actor: userActor(actor),
        action: "salesSlips.update",
        resourceType,
        resourceId: id,
        requestId: crypto.randomUUID(),
        changes: { before, after },
        metadata: { changes },
        occurredAt: new Date(),
      },
      session,
    );
    return after;
  });
}

export async function transitionSlip(
  id: string,
  raw: unknown,
  actor: string,
): Promise<SalesSlip> {
  const input = transitionSchema.parse(raw);
  const db = await connectToDatabase();
  return db.connection.transaction(async (session) => {
    const before = await loadForWrite(id, input.version, session);
    const now = new Date().toISOString();
    const reason = input.reason?.trim() ?? "";
    let after: SalesSlip;
    if (input.action === "confirm") {
      if (before.status !== "DRAFT")
        throw new SalesSlipError("Chỉ phiếu nháp mới xác nhận được.", 409);
      const problems = confirmProblems(before);
      if (problems.length)
        throw new SalesSlipError("Chưa thể xác nhận phiếu.", 400, problems);
      after = {
        ...before,
        status: "CONFIRMED",
        confirmedAt: now,
        confirmedBy: actor,
      };
    } else if (input.action === "reopen") {
      if (before.status !== "CONFIRMED")
        throw new SalesSlipError("Chỉ phiếu đã xác nhận mới mở lại được.", 409);
      if (!reason)
        throw new SalesSlipError("Cần lý do khi mở lại phiếu đã xác nhận.");
      after = {
        ...before,
        status: "DRAFT",
        confirmedAt: null,
        confirmedBy: null,
      };
    } else {
      if (before.status === "CANCELLED")
        throw new SalesSlipError("Phiếu đã hủy trước đó.", 409);
      if (!reason) throw new SalesSlipError("Cần lý do khi hủy phiếu.");
      after = {
        ...before,
        status: "CANCELLED",
        cancelledAt: now,
        cancelledBy: actor,
        cancelReason: reason,
      };
    }
    const saved = await persist(before, after, actor, session);
    await appendAuditEventWithSession(
      {
        actor: userActor(actor),
        action: `salesSlips.${input.action}`,
        resourceType,
        resourceId: id,
        requestId: crypto.randomUUID(),
        ...(reason ? { reason } : {}),
        changes: {
          before: { status: before.status },
          after: { status: saved.status },
        },
        metadata: {
          changes: [
            `Trạng thái: ${before.status} → ${saved.status}${reason ? ` (${reason})` : ""}`,
          ],
        },
        occurredAt: new Date(),
      },
      session,
    );
    return saved;
  });
}

/** Exports are audited like every other read of money on a slip. */
export async function recordExport(
  slip: SalesSlip,
  format: "pdf" | "xlsx",
  actor: string,
): Promise<void> {
  await mongoAuditRepository.append({
    actor: userActor(actor),
    action: "salesSlips.export",
    resourceType,
    resourceId: slip.id,
    requestId: crypto.randomUUID(),
    metadata: {
      format,
      internalNumber: slip.internalNumber,
      changes: [`Xuất ${format.toUpperCase()}`],
    },
    occurredAt: new Date(),
  });
}
