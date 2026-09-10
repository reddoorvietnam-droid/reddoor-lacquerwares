import "server-only";
import Decimal from "decimal.js";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongoose";
import { appendAuditEventWithSession } from "@/domains/audit/mongo-repository";
import { getPaintRowModel, getPaintMasterModel } from "./models";
import {
  applyPatch,
  emptyRow,
  patchSchema,
  PaintError,
  dateSchema,
  type Master,
  type PaintRow,
} from "./contracts";

export type StoredRow = Omit<PaintRow, "id" | "exportDate"> & {
  _id: string;
  exportDate: Date;
  deleted?: boolean;
  importKey?: string;
};
export const toRow = (stored: StoredRow): PaintRow => {
  const {
    _id,
    exportDate,
    deleted: _deleted,
    importKey: _importKey,
    ...rest
  } = stored;
  void _deleted;
  void _importKey;
  return {
    ...rest,
    id: _id,
    exportDate: exportDate.toISOString().slice(0, 10),
  };
};
export const toStored = (row: PaintRow): StoredRow => {
  const { id, exportDate, ...rest } = row;
  return { ...rest, _id: id, exportDate: new Date(`${exportDate}T00:00:00Z`) };
};
export async function readMasters(): Promise<Master[]> {
  await connectToDatabase();
  return getPaintMasterModel()
    .find({})
    .select("-_id kind code name unit unitPrice")
    .lean<Master[]>()
    .exec();
}
export function rowFilter(params: URLSearchParams): Record<string, unknown> {
  const filter: Record<string, unknown> = { deleted: false };
  const from = params.get("from"),
    to = params.get("to");
  if (from || to)
    filter.exportDate = {
      ...(from
        ? { $gte: new Date(`${dateSchema.parse(from)}T00:00:00Z`) }
        : {}),
      ...(to ? { $lte: new Date(`${dateSchema.parse(to)}T00:00:00Z`) } : {}),
    };
  const query = (params.get("q") ?? "").trim().slice(0, 150);
  if (query) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      "facilityCode",
      "facilityNameSnapshot",
      "materialCode",
      "materialNameSnapshot",
      "note",
    ].map((field) => ({ [field]: { $regex: escaped, $options: "i" } }));
  }
  return filter;
}
export async function readRows(params: URLSearchParams) {
  await connectToDatabase();
  const filter = rowFilter(params);
  const offset = z.coerce
    .number()
    .int()
    .min(0)
    .max(10_000_000)
    .parse(params.get("offset") ?? 0);
  // The table asks for one page at a time; 500 is the ceiling per request.
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(500)
    .parse(params.get("limit") ?? 200);
  const [documents, total, sums] = await Promise.all([
    getPaintRowModel()
      .find(filter)
      .sort({ exportDate: 1, _id: 1 })
      .skip(offset)
      .limit(limit)
      .lean<StoredRow[]>()
      .exec(),
    getPaintRowModel().countDocuments(filter),
    // The page shows one slice, but the money total must cover the whole
    // filter; amounts are canonical decimal strings, so cast before summing.
    getPaintRowModel().aggregate<{ amount: unknown; actualAmount: unknown }>([
      { $match: filter },
      {
        $group: {
          _id: null,
          amount: { $sum: { $toDecimal: { $ifNull: ["$amount", "0"] } } },
          actualAmount: {
            $sum: { $toDecimal: { $ifNull: ["$actualAmount", "0"] } },
          },
        },
      },
    ]),
  ]);
  const totals = sums[0];
  return {
    rows: documents.map(toRow),
    total,
    totalAmount: new Decimal(String(totals?.amount ?? 0)).toFixed(),
    totalActualAmount: new Decimal(String(totals?.actualAmount ?? 0)).toFixed(),
    nextOffset:
      offset + documents.length < total ? offset + documents.length : null,
  };
}
const mutationSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(150)
    .regex(/^[a-zA-Z0-9_-]+$/),
  version: z.number().int().min(0),
  patch: patchSchema,
});
export const batchSchema = z
  .object({ changes: z.array(mutationSchema).min(1).max(500) })
  .strict();

/** One transaction for paste + audit, and compare-and-swap for every row. */
export async function saveRows(
  raw: unknown,
  actor: string,
): Promise<PaintRow[]> {
  const { changes } = batchSchema.parse(raw);
  if (new Set(changes.map((c) => c.id)).size !== changes.length)
    throw new PaintError("Dòng bị lặp trong yêu cầu.");
  const db = await connectToDatabase();
  const masters = await readMasters();
  const result = await db.connection.transaction(async (session) => {
    const saved: PaintRow[] = [];
    for (const change of changes) {
      const stored = await getPaintRowModel()
        .findById(change.id)
        .session(session)
        .lean<StoredRow | null>()
        .exec();
      if (stored?.deleted || (stored?.version ?? 0) !== change.version)
        throw new PaintError(
          "Dữ liệu đã được người khác thay đổi. Bản nháp của bạn vẫn được giữ; tải lại để đối chiếu.",
          409,
        );
      const before = stored ? toRow(stored) : null;
      const base =
        before ??
        emptyRow(
          change.id,
          change.patch.exportDate ?? new Date().toISOString().slice(0, 10),
          actor,
        );
      const after = applyPatch(base, change.patch, masters);
      after.version = base.version + 1;
      after.updatedAt = new Date().toISOString();
      after.updatedBy = actor;
      if (before) {
        const update = toStored(after);
        const { _id, ...values } = update;
        void _id;
        const written = await getPaintRowModel().updateOne(
          { _id: change.id, version: change.version, deleted: false },
          { $set: values },
          { session },
        );
        if (written.modifiedCount !== 1)
          throw new PaintError(
            "Xung đột phiên bản; hãy tải lại để đối chiếu.",
            409,
          );
      } else
        await getPaintRowModel().create(
          [{ ...toStored(after), deleted: false }],
          { session },
        );
      await appendAuditEventWithSession(
        {
          actor: { type: "user", userId: actor },
          action: before ? "paintWarehouse.update" : "paintWarehouse.create",
          resourceType: "paintWarehouse",
          resourceId: after.id,
          requestId: crypto.randomUUID(),
          changes: { before, after },
          occurredAt: new Date(),
        },
        session,
      );
      saved.push(after);
    }
    return saved;
  });
  return result;
}
export async function deleteRow(raw: unknown, actor: string) {
  const input = mutationSchema.omit({ patch: true }).parse(raw);
  const db = await connectToDatabase();
  await db.connection.transaction(async (session) => {
    const stored = await getPaintRowModel()
      .findOne({ _id: input.id, version: input.version, deleted: false })
      .session(session)
      .lean<StoredRow | null>()
      .exec();
    if (!stored)
      throw new PaintError(
        "Dòng đã thay đổi hoặc đã bị xóa; hãy tải lại.",
        409,
      );
    const written = await getPaintRowModel().updateOne(
      { _id: input.id, version: input.version, deleted: false },
      {
        $set: {
          deleted: true,
          updatedAt: new Date().toISOString(),
          updatedBy: actor,
        },
        $inc: { version: 1 },
      },
      { session },
    );
    if (written.modifiedCount !== 1)
      throw new PaintError("Xung đột phiên bản.", 409);
    await appendAuditEventWithSession(
      {
        actor: { type: "user", userId: actor },
        action: "paintWarehouse.delete",
        resourceType: "paintWarehouse",
        resourceId: input.id,
        requestId: crypto.randomUUID(),
        changes: { before: toRow(stored), after: { deleted: true } },
        occurredAt: new Date(),
      },
      session,
    );
  });
}
