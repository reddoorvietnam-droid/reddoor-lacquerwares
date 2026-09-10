import "server-only";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import Decimal from "decimal.js";
import type { ClientSession } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { appendAuditEventWithSession } from "@/domains/audit/mongo-repository";
import {
  codeKey,
  dateSchema,
  decimalSchema,
  emptyRow,
  multiply,
  PaintError,
  type Master,
  type PaintRow,
} from "./contracts";
import { getPaintMasterModel, getPaintRowModel } from "./models";
import { toStored, type StoredRow } from "./service";

export type ImportIssue = { row: number; message: string };
export function parsePaintWorkbook(bytes: Uint8Array) {
  const hash = createHash("sha256").update(bytes).digest("hex");
  const book = XLSX.read(bytes, {
    type: "array",
    cellDates: true,
    cellFormula: true,
  });
  const sheet = book.Sheets.ChiTietxuatkho;
  if (!sheet) throw new Error("Thiếu sheet ChiTietxuatkho.");
  const masters: Master[] = [],
    issues: ImportIssue[] = [],
    warnings: ImportIssue[] = [];
  const cell = (s: XLSX.WorkSheet, row: number, col: number) =>
    s[XLSX.utils.encode_cell({ r: row - 1, c: col - 1 })] as
      XLSX.CellObject | undefined;
  const text = (value: unknown) =>
    value === null || value === undefined ? "" : String(value);
  const number = (value: unknown): string | null => {
    if (value === null || value === undefined || value === "") return null;
    // Excel only guarantees 15 significant digits. Normalize cached binary tails.
    const input =
      typeof value === "number"
        ? String(Number(value.toPrecision(15)))
        : text(value);
    return decimalSchema.parse(input);
  };
  for (const kind of ["facility", "material"] as const) {
    const name = kind === "facility" ? "Cososx" : "Kho son";
    const source = book.Sheets[name];
    if (!source) throw new Error(`Thiếu sheet ${name}.`);
    const seen = new Set<string>();
    const start = kind === "facility" ? 5 : 3,
      end = kind === "facility" ? 91 : 1007;
    const col = kind === "facility" ? 3 : 2;
    for (let r = start; r <= end; r++) {
      const code = text(cell(source, r, col)?.v).trim();
      if (!code) continue;
      if (seen.has(codeKey(code))) {
        warnings.push({
          row: r,
          message: `${name}: mã trùng ${code}; giữ lần xuất hiện đầu theo VLOOKUP.`,
        });
        continue;
      }
      seen.add(codeKey(code));
      try {
        masters.push({
          kind,
          code,
          name: text(cell(source, r, col + 1)?.v),
          unit: kind === "material" ? text(cell(source, r, 4)?.v) : "",
          unitPrice: kind === "material" ? number(cell(source, r, 5)?.v) : null,
        });
      } catch {
        issues.push({
          row: r,
          message: `${name}: đơn giá không hợp lệ (${code}).`,
        });
      }
    }
  }
  const rows: PaintRow[] = [];
  let empty = 0,
    populated = 0;
  let sourceAmount = new Decimal(0),
    sourceActualAmount = new Decimal(0);
  const end = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:N3").e.r + 1;
  for (let r = 4; r <= end; r++) {
    const cells = Array.from({ length: 14 }, (_, c) => cell(sheet, r, c + 1));
    const values = cells.map((c) => c?.v);
    if (!values.some((v) => v !== undefined && v !== null && v !== "")) {
      empty++;
      continue;
    }
    populated++;
    try {
      if (cells.some((c) => c?.t === "e")) throw new Error("Ô có lỗi Excel.");
      const date =
        values[0] instanceof Date
          ? values[0].toISOString().slice(0, 10)
          : text(values[0]);
      dateSchema.parse(date);
      const row = emptyRow(
        `xlsx_${hash.slice(0, 24)}_${String(r).padStart(6, "0")}`,
        date,
        "paint-workbook-migration",
      );
      Object.assign(row, {
        version: 1,
        sourceRow: r,
        facilityCode: text(values[1]),
        facilityNameSnapshot: text(values[2]),
        materialCode: text(values[3]),
        materialNameSnapshot: text(values[4]),
        description: text(values[5]),
        unit: text(values[6]),
        quantity: number(values[7]),
        unitPrice: number(values[8]),
        amount: number(values[9]),
        actualQuantity: number(values[10]),
        discountedUnitPrice: number(values[11]),
        actualAmount: number(values[12]),
        note: text(values[13]),
        actualQuantityManual:
          !cells[10]?.f && values[10] !== undefined && values[10] !== null,
        discountedPriceManual:
          !cells[11]?.f && values[11] !== undefined && values[11] !== null,
      });
      const expected = multiply(row.quantity, row.unitPrice),
        actual = multiply(row.actualQuantity, row.discountedUnitPrice);
      if (row.amount !== expected || row.actualAmount !== actual)
        throw new Error(
          `Tổng tiền khác phép nhân: J=${row.amount}/${expected}, M=${row.actualAmount}/${actual}.`,
        );
      if (
        [
          row.quantity,
          row.unitPrice,
          row.actualQuantity,
          row.discountedUnitPrice,
        ].some((v) => v === null)
      )
        warnings.push({
          row: r,
          message:
            "Dòng chưa đủ số liệu; giữ nguyên ô trống, không tự điền đơn giá/số lượng.",
        });
      for (const [kind, code] of [
        ["material", row.materialCode],
        ["facility", row.facilityCode],
      ] as const) {
        if (
          !masters.some(
            (m) => m.kind === kind && codeKey(m.code) === codeKey(code),
          )
        )
          warnings.push({
            row: r,
            message: `Mã ${kind} '${code}' không có trong danh mục; giữ snapshot lịch sử.`,
          });
      }
      sourceAmount = sourceAmount.add(row.amount ?? 0);
      sourceActualAmount = sourceActualAmount.add(row.actualAmount ?? 0);
      rows.push(row);
    } catch (error) {
      issues.push({
        row: r,
        message: error instanceof Error ? error.message : "Dòng không hợp lệ",
      });
    }
  }
  return {
    hash,
    rows,
    masters,
    report: {
      sourceRows: populated,
      imported: rows.length,
      skippedEmptyRows: empty,
      invalidRows: issues.length,
      issues,
      warnings,
      sourceAmount: sourceAmount.toFixed(),
      sourceActualAmount: sourceActualAmount.toFixed(),
    },
  };
}

// --------------------------------------------------------- preview + write

export type ParsedPaintWorkbook = ReturnType<typeof parsePaintWorkbook>;
export type ImportRowStatus =
  "valid" | "invalid" | "already-imported" | "duplicate";
export type ImportPreviewRow = {
  sourceRow: number;
  status: ImportRowStatus;
  message: string | null;
  exportDate: string | null;
  facilityCode: string;
  materialCode: string;
  quantity: string | null;
  amount: string | null;
  note: string;
  unknownMaterial: boolean;
  unknownFacility: boolean;
};
export type PaintImportPreview = {
  hash: string;
  fileName: string;
  rows: ImportPreviewRow[];
  counts: Record<ImportRowStatus, number>;
  sourceAmount: string;
  sourceActualAmount: string;
  issues: ImportIssue[];
  warnings: ImportIssue[];
};

/** The scheme `scripts/import-paint-warehouse.ts` writes, so both paths are one operation. */
export const paintImportKey = (hash: string, sourceRow: number) =>
  `${hash}:${sourceRow}`;
const sourceRowOf = (row: PaintRow) => row.sourceRow ?? 0;
/** Business identity of a line, for spotting a re-typed copy of an existing row. */
const businessKey = (row: {
  exportDate: string;
  materialCode: string;
  facilityCode: string;
  quantity: string | null;
  note: string;
}) =>
  [
    row.exportDate,
    codeKey(row.materialCode),
    codeKey(row.facilityCode),
    row.quantity ?? "",
    row.note.trim(),
  ].join("|");
// Master-sheet problems are not ledger lines; they stay in `issues` only.
const masterIssue = (message: string) =>
  message.startsWith("Cososx:") || message.startsWith("Kho son:");
/** Zod messages arrive as multi-line JSON; the preview table needs one short line. */
const readable = (message: string) =>
  message.replace(/\s+/g, " ").trim().slice(0, 200);

async function decidePaintRows(
  parsed: ParsedPaintWorkbook,
  fileName: string,
  session: ClientSession | null,
): Promise<{
  preview: PaintImportPreview;
  statuses: Map<PaintRow, ImportRowStatus>;
}> {
  const model = getPaintRowModel();
  const keys = parsed.rows.map((row) =>
    paintImportKey(parsed.hash, sourceRowOf(row)),
  );
  // Sequential reads: inside a transaction only one command may be in flight.
  const alreadyImported = await model
    .find({ importKey: { $in: keys } })
    .select("-_id importKey")
    .session(session)
    .lean<Pick<StoredRow, "importKey">[]>()
    .exec();
  const importedKeys = new Set(
    alreadyImported
      .map((row) => row.importKey)
      .filter((key): key is string => typeof key === "string"),
  );
  const dates = [...new Set(parsed.rows.map((row) => row.exportDate))].map(
    (date) => new Date(`${date}T00:00:00Z`),
  );
  // One query for the whole file: only the days it touches, only the compared fields.
  const sameDay = dates.length
    ? await model
        .find({ deleted: false, exportDate: { $in: dates } })
        .select("-_id exportDate materialCode facilityCode quantity note")
        .session(session)
        .lean<
          Pick<
            StoredRow,
            "exportDate" | "materialCode" | "facilityCode" | "quantity" | "note"
          >[]
        >()
        .exec()
    : [];
  const existing = new Set(
    sameDay.map((row) =>
      businessKey({
        exportDate: row.exportDate.toISOString().slice(0, 10),
        materialCode: row.materialCode ?? "",
        facilityCode: row.facilityCode ?? "",
        quantity: row.quantity ?? null,
        note: row.note ?? "",
      }),
    ),
  );
  // The web import never writes master data, so unknown codes are judged against the catalogue.
  const masters = await getPaintMasterModel()
    .find({})
    .select("-_id kind key")
    .session(session)
    .lean<{ kind: Master["kind"]; key: string }[]>()
    .exec();
  const known = {
    material: new Set(
      masters.filter((m) => m.kind === "material").map((m) => m.key),
    ),
    facility: new Set(
      masters.filter((m) => m.kind === "facility").map((m) => m.key),
    ),
  };
  const statuses = new Map<PaintRow, ImportRowStatus>();
  const rows: ImportPreviewRow[] = [];
  for (const row of parsed.rows) {
    const sourceRow = sourceRowOf(row);
    let status: ImportRowStatus = "valid";
    let message: string | null = null;
    if (importedKeys.has(paintImportKey(parsed.hash, sourceRow))) {
      status = "already-imported";
      message = "Đã nhập từ đúng tệp này trước đó.";
    } else if (existing.has(businessKey(row))) {
      status = "duplicate";
      message =
        "Trùng một dòng đã có (cùng ngày, mã vật tư, mã cơ sở, số lượng, ghi chú).";
    }
    statuses.set(row, status);
    rows.push({
      sourceRow,
      status,
      message,
      exportDate: row.exportDate,
      facilityCode: row.facilityCode,
      materialCode: row.materialCode,
      quantity: row.quantity,
      amount: row.amount,
      note: row.note,
      unknownMaterial:
        row.materialCode.trim() !== "" &&
        !known.material.has(codeKey(row.materialCode)),
      unknownFacility:
        row.facilityCode.trim() !== "" &&
        !known.facility.has(codeKey(row.facilityCode)),
    });
  }
  for (const issue of parsed.report.issues) {
    if (masterIssue(issue.message)) continue;
    rows.push({
      sourceRow: issue.row,
      status: "invalid",
      message: readable(issue.message),
      exportDate: null,
      facilityCode: "",
      materialCode: "",
      quantity: null,
      amount: null,
      note: "",
      unknownMaterial: false,
      unknownFacility: false,
    });
  }
  rows.sort((a, b) => a.sourceRow - b.sourceRow);
  const counts: Record<ImportRowStatus, number> = {
    valid: 0,
    invalid: 0,
    "already-imported": 0,
    duplicate: 0,
  };
  for (const row of rows) counts[row.status] += 1;
  return {
    preview: {
      hash: parsed.hash,
      fileName,
      rows,
      counts,
      sourceAmount: parsed.report.sourceAmount,
      sourceActualAmount: parsed.report.sourceActualAmount,
      issues: parsed.report.issues,
      warnings: parsed.report.warnings,
    },
    statuses,
  };
}

/** Read-only: the storekeeper sees the whole file before anything is written. */
export async function buildPaintImportPreview(
  parsed: ParsedPaintWorkbook,
  fileName: string,
): Promise<PaintImportPreview> {
  await connectToDatabase();
  return (await decidePaintRows(parsed, fileName, null)).preview;
}

/**
 * One transaction, `$setOnInsert` on `importKey`: a second run of the same file
 * inserts nothing and never overwrites a line edited since the first import.
 * Master data stays untouched — the CLI migration owns the catalogue.
 */
export async function importPaintRows(
  parsed: ParsedPaintWorkbook,
  actor: string,
  options: { includeDuplicates: boolean; fileName?: string },
): Promise<{ hash: string; imported: number; skipped: number }> {
  const db = await connectToDatabase();
  return db.connection.transaction(async (session) => {
    const { preview, statuses } = await decidePaintRows(
      parsed,
      options.fileName ?? "",
      session,
    );
    const candidates = parsed.rows.filter((row) => {
      const status = statuses.get(row);
      return (
        status === "valid" ||
        (options.includeDuplicates && status === "duplicate")
      );
    });
    if (!candidates.length)
      throw new PaintError("Không có dòng hợp lệ để nhập.");
    const result = await getPaintRowModel().bulkWrite(
      candidates.map((row) => {
        const importKey = paintImportKey(parsed.hash, sourceRowOf(row));
        return {
          updateOne: {
            filter: { importKey },
            // The ledger records who imported the file, not the migration name.
            update: {
              $setOnInsert: {
                ...toStored({ ...row, createdBy: actor, updatedBy: actor }),
                importKey,
                deleted: false,
              },
            },
            upsert: true,
          },
        };
      }),
      { session },
    );
    const imported = result.upsertedCount;
    // Everything the file offered that did not become a new line.
    const skipped = preview.rows.length - imported;
    await appendAuditEventWithSession(
      {
        actor: { type: "user", userId: actor },
        action: "paintWarehouse.import",
        resourceType: "paintWarehouse",
        resourceId: parsed.hash,
        requestId: crypto.randomUUID(),
        metadata: {
          fileName: options.fileName ?? null,
          imported,
          skipped,
          sourceAmount: parsed.report.sourceAmount,
          sourceActualAmount: parsed.report.sourceActualAmount,
        },
        occurredAt: new Date(),
      },
      session,
    );
    return { hash: parsed.hash, imported, skipped };
  });
}
