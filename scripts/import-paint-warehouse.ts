import { readFile, writeFile, mkdir } from "node:fs/promises";
import Decimal from "decimal.js";
import { parsePaintWorkbook } from "../src/domains/paint-warehouse/import-workbook";
import {
  getPaintMasterModel,
  getPaintRowModel,
} from "../src/domains/paint-warehouse/models";
import { connectToDatabase } from "../src/lib/db/mongoose";
import {
  toStored,
  toRow,
  type StoredRow,
} from "../src/domains/paint-warehouse/service";
import { codeKey, fields } from "../src/domains/paint-warehouse/contracts";
import { getRoleDefinitionModel } from "../src/domains/identity/models";
import { appendAuditEventWithSession } from "../src/domains/audit/mongo-repository";

async function main() {
  const args = process.argv.slice(2),
    file = args.find((arg) => !arg.startsWith("--"));
  if (!file)
    throw new Error("Usage: npm run import:paint -- <source.xlsx> [--apply]");
  const parsed = parsePaintWorkbook(await readFile(file));
  await mkdir("backups", { recursive: true });
  const report = {
    ...parsed.report,
    sourceHash: parsed.hash,
    mode: args.includes("--apply") ? "apply" : "dry-run",
    duplicates: 0,
    inserted: 0,
    dbAmount: "",
    dbActualAmount: "",
    mismatches: [] as number[],
    verified: false,
  };
  await writeFile(
    "backups/paint-import-report.json",
    JSON.stringify(report, null, 2),
  );
  if (parsed.report.invalidRows)
    throw new Error(
      "Có dữ liệu lỗi; xem backups/paint-import-report.json. Chưa ghi DB.",
    );
  if (args.includes("--apply")) {
    const db = await connectToDatabase();
    try {
      await getPaintRowModel().createIndexes();
      await getPaintMasterModel().createIndexes();
      await db.connection.transaction(async (session) => {
        for (const master of parsed.masters)
          await getPaintMasterModel().updateOne(
            { kind: master.kind, key: codeKey(master.code) },
            { $setOnInsert: { ...master, key: codeKey(master.code) } },
            { upsert: true, session },
          );
        const result = await getPaintRowModel().bulkWrite(
          parsed.rows.map((row) => ({
            updateOne: {
              filter: { importKey: `${parsed.hash}:${row.sourceRow}` },
              update: {
                $setOnInsert: {
                  ...toStored(row),
                  importKey: `${parsed.hash}:${row.sourceRow}`,
                  deleted: false,
                },
              },
              upsert: true,
            },
          })),
          { session },
        );
        report.inserted = result.upsertedCount;
        report.duplicates = parsed.rows.length - result.upsertedCount;
        const stored = await getPaintRowModel()
          .find({
            importKey: {
              $in: parsed.rows.map((row) => `${parsed.hash}:${row.sourceRow}`),
            },
          })
          .session(session)
          .lean<StoredRow[]>()
          .exec();
        const byId = new Map(stored.map((row) => [row._id, toRow(row)]));
        for (const source of parsed.rows) {
          const saved = byId.get(source.id);
          if (!saved || fields.some((field) => saved[field] !== source[field]))
            report.mismatches.push(source.sourceRow!);
        }
        report.dbAmount = stored
          .reduce((sum, r) => sum.add(r.amount ?? 0), new Decimal(0))
          .toFixed();
        report.dbActualAmount = stored
          .reduce((sum, r) => sum.add(r.actualAmount ?? 0), new Decimal(0))
          .toFixed();
        report.verified =
          report.mismatches.length === 0 &&
          report.dbAmount === report.sourceAmount &&
          report.dbActualAmount === report.sourceActualAmount;
        if (!report.verified)
          throw new Error(
            "Dữ liệu DB khác nguồn (có thể đã được sửa sau nhập); hủy giao dịch, không ghi đè lịch sử.",
          );
        await appendAuditEventWithSession(
          {
            actor: { type: "system", systemName: "paint-workbook-migration" },
            action: "paintWarehouse.import",
            resourceType: "paintWarehouse",
            resourceId: parsed.hash,
            requestId: crypto.randomUUID(),
            metadata: {
              imported: report.inserted,
              duplicates: report.duplicates,
              sourceAmount: report.sourceAmount,
              sourceActualAmount: report.sourceActualAmount,
            },
            occurredAt: new Date(),
          },
          session,
        );
      });
      // Add only the new global ledger permissions, preserving every existing grant.
      for (const key of ["WAREHOUSE_MANAGER", "DIRECTOR"])
        for (const action of [
          "read",
          "create",
          "update",
          "delete",
          "export",
          "import",
        ]) {
          await getRoleDefinitionModel().updateOne(
            {
              key,
              "permissions.permission": { $ne: `paintWarehouse.${action}` },
            },
            {
              $push: {
                permissions: {
                  permission: `paintWarehouse.${action}`,
                  scope: "all",
                },
              },
            },
          );
        }
    } finally {
      await writeFile(
        "backups/paint-import-report.json",
        JSON.stringify(report, null, 2),
      );
      await db.disconnect();
    }
  }
  console.info(
    JSON.stringify(
      {
        ...report,
        warnings: report.warnings.length,
        issues: report.issues.length,
      },
      null,
      2,
    ),
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Import failed");
  process.exitCode = 1;
});
