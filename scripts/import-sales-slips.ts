/**
 * Migration of the sales-slip workbook (`assets/08092026.xlsx`).
 *
 *   npm run import:sales-slips -- assets/08092026.xlsx            dry run: report only
 *   npm run import:sales-slips -- assets/08092026.xlsx --apply    write masters + slips
 *
 * What `--apply` does, in one transaction:
 *   1. `KhoSon` → PaintWarehouseMaster (kind material): existing codes get
 *      `salePrice` set (name, unit, export price untouched); unknown codes
 *      are inserted with `unitPrice: null`.
 *   2. `MaNhaCungCap` → PaintWarehouseMaster (kind facility): missing codes only.
 *   3. Every sheet classified as an invoice → one SalesSlip with N lines,
 *      CONFIRMED when the sheet reconciles, DRAFT with `migrationIssues`
 *      otherwise. Idempotent through `importKey = sha256:sheet`.
 *   4. Verifies stored totals against the workbook, then appends one audit event.
 * Template, shipping-label, legacy-ledger and helper sheets are never imported.
 * The report is written to backups/sales-slip-import-report.json either way.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { connectToDatabase } from "../src/lib/db/mongoose";
import { appendAuditEventWithSession } from "../src/domains/audit/mongo-repository";
import { getRoleDefinitionModel } from "../src/domains/identity/models";
import { getPaintMasterModel } from "../src/domains/paint-warehouse/models";
import {
  codeKey,
  capabilityActions,
} from "../src/domains/sales-slips/contracts";
import {
  linkSlip,
  migrationActor,
  parseSalesWorkbook,
} from "../src/domains/sales-slips/import-workbook";
import {
  getSalesSlipModel,
  toSlip,
  toStored,
  type StoredSlip,
} from "../src/domains/sales-slips/models";
import { readMasters } from "../src/domains/sales-slips/service";

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((arg) => !arg.startsWith("--"));
  if (!file)
    throw new Error(
      "Usage: npm run import:sales-slips -- <source.xlsx> [--apply]",
    );
  const apply = args.includes("--apply");
  const db = await connectToDatabase();
  const bytes = await readFile(file);
  const parsed = parseSalesWorkbook(
    bytes,
    await readMasters(),
    path.basename(file),
  );
  await mkdir("backups", { recursive: true });

  const existing = await getSalesSlipModel()
    .find({
      fingerprint: {
        $in: parsed.invoices.map((invoice) => invoice.fingerprint),
      },
    })
    .select("_id importKey fingerprint migrationSheet")
    .lean<
      {
        _id: string;
        importKey?: string;
        fingerprint?: string;
        migrationSheet?: string;
      }[]
    >()
    .exec();
  const report = {
    mode: apply ? "apply" : "dry-run",
    ...parsed.report,
    sheets: parsed.sheets,
    invoices: parsed.invoices.map((invoice) => ({
      sheet: invoice.sheet,
      hidden: invoice.hidden,
      date: invoice.slip.slipDate,
      recipient: invoice.slip.recipientName,
      recipientLinked: invoice.slip.recipientCode || null,
      lines: invoice.slip.lines.length,
      excelTotal: invoice.excelTotal,
      computedTotal: invoice.computedTotal,
      difference: invoice.difference,
      status: invoice.slip.status,
      issues: invoice.issues,
      unknownItems: invoice.unknownItems,
      fingerprintAlreadyStored: existing
        .filter((row) => row.fingerprint === invoice.fingerprint)
        .map((row) => row.migrationSheet ?? row._id),
    })),
    itemsInserted: 0,
    itemsPriced: 0,
    recipientsInserted: 0,
    inserted: 0,
    duplicates: 0,
    dbTotal: "",
    verified: false,
  };
  const save = () =>
    writeFile(
      "backups/sales-slip-import-report.json",
      JSON.stringify(report, null, 2),
    );
  await save();

  if (apply) {
    try {
      await getSalesSlipModel().createIndexes();
      await db.connection.transaction(async (session) => {
        const masterModel = getPaintMasterModel();
        for (const item of parsed.items) {
          const result = await masterModel.updateOne(
            { kind: "material", key: codeKey(item.code) },
            {
              $set: { salePrice: item.salePrice },
              $setOnInsert: {
                kind: "material",
                key: codeKey(item.code),
                code: item.code,
                name: item.name,
                unit: item.unit,
                unitPrice: null,
              },
            },
            { upsert: true, session },
          );
          if (result.upsertedCount) report.itemsInserted += 1;
          else report.itemsPriced += 1;
        }
        for (const recipient of parsed.recipients) {
          const result = await masterModel.updateOne(
            { kind: "facility", key: codeKey(recipient.code) },
            {
              $setOnInsert: {
                kind: "facility",
                key: codeKey(recipient.code),
                code: recipient.code,
                name: recipient.name,
                unit: "",
                unitPrice: null,
              },
            },
            { upsert: true, session },
          );
          if (result.upsertedCount) report.recipientsInserted += 1;
        }
        // Re-resolve ids now that every code exists.
        const rows = await masterModel
          .find({})
          .session(session)
          .select("kind code name unit salePrice")
          .lean<
            {
              _id: { toHexString(): string };
              kind: string;
              code?: string;
              name?: string;
              unit?: string;
              salePrice?: string | null;
            }[]
          >()
          .exec();
        const masters = {
          items: rows
            .filter((row) => row.kind === "material")
            .map((row) => ({
              id: row._id.toHexString(),
              code: row.code ?? "",
              name: row.name ?? "",
              unit: row.unit ?? "",
              salePrice: row.salePrice ?? null,
            })),
          recipients: rows
            .filter((row) => row.kind === "facility")
            .map((row) => ({
              id: row._id.toHexString(),
              code: row.code ?? "",
              name: row.name ?? "",
            })),
        };
        const keyOf = (sheet: string) => `${parsed.hash}:${sheet}`;
        const result = await getSalesSlipModel().bulkWrite(
          parsed.invoices.map((invoice) => ({
            updateOne: {
              filter: { importKey: keyOf(invoice.sheet) },
              update: {
                $setOnInsert: {
                  ...toStored(linkSlip(invoice.slip, masters)),
                  importKey: keyOf(invoice.sheet),
                  fingerprint: invoice.fingerprint,
                },
              },
              upsert: true,
            },
          })),
          { session },
        );
        report.inserted = result.upsertedCount;
        report.duplicates = parsed.invoices.length - result.upsertedCount;
        const stored = await getSalesSlipModel()
          .find({
            importKey: {
              $in: parsed.invoices.map((invoice) => keyOf(invoice.sheet)),
            },
          })
          .session(session)
          .lean<StoredSlip[]>()
          .exec();
        const slips = stored.map(toSlip);
        report.dbTotal = slips
          .reduce((sum, slip) => sum.add(slip.subtotal ?? 0), new Decimal(0))
          .toFixed();
        const mismatched = parsed.invoices.filter((invoice) => {
          const saved = slips.find((slip) => slip.id === invoice.slip.id);
          return (
            !saved ||
            saved.lines.length !== invoice.slip.lines.length ||
            (saved.subtotal ?? null) !== (invoice.computedTotal ?? null)
          );
        });
        report.verified =
          mismatched.length === 0 &&
          report.dbTotal === parsed.report.computedTotal;
        if (!report.verified)
          throw new Error(
            `Dữ liệu DB khác nguồn (${mismatched.map((invoice) => invoice.sheet).join(", ") || "tổng"}); hủy giao dịch.`,
          );
        await appendAuditEventWithSession(
          {
            actor: { type: "system", systemName: migrationActor },
            action: "salesSlips.import",
            resourceType: "salesSlip",
            resourceId: parsed.hash,
            requestId: crypto.randomUUID(),
            metadata: {
              source: path.basename(file),
              inserted: report.inserted,
              duplicates: report.duplicates,
              itemsInserted: report.itemsInserted,
              itemsPriced: report.itemsPriced,
              recipientsInserted: report.recipientsInserted,
              excelTotal: parsed.report.excelTotal,
              computedTotal: parsed.report.computedTotal,
              changes: [
                `Nhập ${report.inserted} phiếu từ ${path.basename(file)}`,
              ],
            },
            occurredAt: new Date(),
          },
          session,
        );
      });
      // Add only the new slip permissions, preserving every existing grant.
      for (const key of ["COMPANY_ACCOUNTANT", "DIRECTOR"])
        for (const action of capabilityActions)
          await getRoleDefinitionModel().updateOne(
            { key, "permissions.permission": { $ne: `salesSlips.${action}` } },
            {
              $push: {
                permissions: {
                  permission: `salesSlips.${action}`,
                  scope: "all",
                },
              },
            },
          );
    } finally {
      await save();
    }
  }
  await db.disconnect();
  console.info(
    JSON.stringify(
      {
        mode: report.mode,
        sheets: report.sheetKinds,
        invoiceCandidates: report.invoiceCandidates,
        validInvoices: report.validInvoices,
        needsReview: report.needsReview,
        totalLines: report.totalLines,
        unknownItemLines: report.unknownItemLines,
        amountMismatches: report.amountMismatches,
        totalMismatches: report.totalMismatches,
        excelTotal: report.excelTotal,
        computedTotal: report.computedTotal,
        difference: report.difference,
        masters: {
          items: report.masterItems,
          duplicates: report.masterItemDuplicates,
          recipients: report.masterRecipients,
        },
        applied: {
          itemsInserted: report.itemsInserted,
          itemsPriced: report.itemsPriced,
          recipientsInserted: report.recipientsInserted,
          inserted: report.inserted,
          duplicates: report.duplicates,
          dbTotal: report.dbTotal,
          verified: report.verified,
        },
        warnings: report.warnings,
        perInvoice: report.invoices.map(
          (invoice) =>
            `${invoice.sheet}: ${invoice.recipient} ${invoice.date} lines=${invoice.lines} excel=${invoice.excelTotal} computed=${invoice.computedTotal} ${invoice.status}${invoice.issues.length ? ` issues=${invoice.issues.length}` : ""}${invoice.fingerprintAlreadyStored.length ? ` dupOf=${invoice.fingerprintAlreadyStored.join("/")}` : ""}`,
        ),
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
