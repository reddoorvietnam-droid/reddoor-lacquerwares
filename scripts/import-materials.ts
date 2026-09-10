import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import Decimal from "decimal.js";
import { getRoleDefinitionModel } from "../src/domains/identity/models";
import {
  capabilityActions,
  codeKey,
  type Lookups,
} from "../src/domains/materials/contracts";
import {
  classifyTransaction,
  parseMaterialsWorkbook,
  writeImportedTransactions,
  type ParsedFacility,
  type ParsedMaterial,
  type ParsedSummaryRow,
  type ParsedTransaction,
  type ParsedWorkbook,
} from "../src/domains/materials/import-workbook";
import {
  getFacilityModel,
  getMaterialModel,
  getMaterialTransactionModel,
  toDecimal128,
  type StoredFacility,
  type StoredMaterial,
} from "../src/domains/materials/models";
import { readBalances, readLookups } from "../src/domains/materials/service";
import { connectToDatabase } from "../src/lib/db/mongoose";

/**
 * One-off migration of `RedDoor - NVL - 2026.xlsx` into the materials
 * collections. Dry run by default; `--apply` writes inside one transaction,
 * idempotently (masters keyed by normalizedCode, lines by importKey).
 *
 *   npm run import:materials -- "assets/RedDoor - NVL - 2026.xlsx" [--apply]
 */

const reportPath = "backups/materials-migration-report.json";
const systemActor = "materials-workbook-migration";
const tolerance = new Decimal("0.000001");

type MasterDraft = {
  code: string;
  name: string;
  unit: string;
  openingQuantity: string;
  note: string;
  sortOrder: number;
  sourceRow: number;
};

type Mismatch = {
  code: string;
  excelOpening: string;
  importedIn: string;
  importedOut: string;
  calculatedClosing: string;
  excelClosing: string | null;
  difference: string;
};

type Reconciliation = {
  source: "replica" | "database";
  materialCount: number;
  matched: number;
  mismatched: number;
  mismatches: Mismatch[];
  movementWithoutSummaryRow: {
    code: string;
    balance: string;
    negative: boolean;
  }[];
};

type LedgerSection = {
  candidateRows: number;
  validTransactions: number;
  imported: number | null;
  invalid: number;
  duplicate: number | null;
  skipped: {
    formulaOnly: number;
    empty: number;
    whitespaceOnly: number;
    helperOnly: number;
  };
  cellsOutsideTable: number;
  invalidRows: { row: number; message: string }[];
};

/** KhoNVL is the canonical spelling and unit; Tong kho contributes opening, note and order. */
function buildMaterialMaster(parsed: ParsedWorkbook) {
  const byKey = new Map<string, MasterDraft>();
  const unitConflicts: {
    code: string;
    row: number;
    tongKho: string;
    khoNVL: string;
  }[] = [];
  const unitCaseDifferences: {
    code: string;
    row: number;
    tongKho: string;
    khoNVL: string;
  }[] = [];
  const caseDifferences: { tongKho: string; khoNVL: string }[] = [];
  const summaryOnly: string[] = [];
  const duplicateSummaryRows: { code: string; row: number; opening: string }[] =
    [];
  const catalog = new Map<string, ParsedMaterial>(
    parsed.materials.map((m) => [codeKey(m.code), m]),
  );
  parsed.summary.forEach((row: ParsedSummaryRow, index) => {
    const key = codeKey(row.code);
    const master = catalog.get(key);
    // Every Tong kho row is compared, the duplicated one included; only the first row feeds the master.
    if (master) {
      if (master.code !== row.code)
        caseDifferences.push({ tongKho: row.code, khoNVL: master.code });
      if (codeKey(master.unit) !== codeKey(row.unit))
        unitConflicts.push({
          code: master.code,
          row: row.sourceRow,
          tongKho: row.unit,
          khoNVL: master.unit,
        });
      else if (master.unit !== row.unit)
        unitCaseDifferences.push({
          code: master.code,
          row: row.sourceRow,
          tongKho: row.unit,
          khoNVL: master.unit,
        });
    }
    if (byKey.has(key)) {
      duplicateSummaryRows.push({
        code: row.code,
        row: row.sourceRow,
        opening: row.opening,
      });
      return;
    }
    if (!master) summaryOnly.push(row.code);
    byKey.set(key, {
      code: master?.code ?? row.code,
      name: master?.name ?? row.name,
      unit: master?.unit ?? row.unit,
      openingQuantity: row.opening,
      note: row.note,
      sortOrder: index + 1,
      sourceRow: master?.sourceRow ?? row.sourceRow,
    });
  });
  parsed.materials.forEach((material, index) => {
    const key = codeKey(material.code);
    if (byKey.has(key)) return;
    byKey.set(key, {
      code: material.code,
      name: material.name,
      unit: material.unit,
      openingQuantity: "0",
      note: "",
      sortOrder: 1000 + index + 1,
      sourceRow: material.sourceRow,
    });
  });
  return {
    masters: [...byKey.values()].sort((a, b) => a.sortOrder - b.sortOrder),
    unitConflicts,
    unitCaseDifferences,
    caseDifferences,
    summaryOnly,
    duplicateSummaryRows,
  };
}

function ledgerSection(
  parsed: ParsedWorkbook,
  sheet: ParsedTransaction["sheet"],
  invalid: { row: number; message: string }[],
): LedgerSection {
  const report =
    sheet === "ChiTietNhapNVL" ? parsed.report.inbound : parsed.report.outbound;
  const partial = parsed.issues
    .filter((issue) => issue.sheet === sheet)
    .map((issue) => ({ row: issue.row, message: issue.message }));
  return {
    candidateRows: report.candidateRows,
    validTransactions: report.transactions - invalid.length,
    imported: null,
    invalid: partial.length + invalid.length,
    duplicate: null,
    skipped: {
      formulaOnly: report.formulaOnly,
      empty: report.empty,
      whitespaceOnly: report.whitespaceOnly,
      helperOnly: report.helperOnly,
    },
    cellsOutsideTable: report.cellsOutsideTable,
    invalidRows: [...partial, ...invalid].sort((a, b) => a.row - b.row),
  };
}

function reconcile(
  summary: readonly ParsedSummaryRow[],
  balanceOf: (key: string) => {
    opening: string;
    inbound: string;
    outbound: string;
    current: string;
  } | null,
  movedKeys: Iterable<string>,
  codeOf: (key: string) => string,
  source: Reconciliation["source"],
): Reconciliation {
  const mismatches: Mismatch[] = [];
  let matched = 0;
  for (const row of summary) {
    const balance = balanceOf(codeKey(row.code));
    const importedIn = balance?.inbound ?? "0";
    const importedOut = balance?.outbound ?? "0";
    const calculated = new Decimal(row.opening)
      .add(importedIn)
      .sub(importedOut);
    const excelClosing =
      row.excelClosing === null ? null : new Decimal(row.excelClosing);
    const same = (a: string | null, b: string) =>
      a !== null && new Decimal(a).sub(b).abs().lte(tolerance);
    const ok =
      same(row.excelInbound, importedIn) &&
      same(row.excelOutbound, importedOut) &&
      excelClosing !== null &&
      excelClosing.sub(calculated).abs().lte(tolerance);
    if (ok) matched += 1;
    else
      mismatches.push({
        code: row.code,
        excelOpening: row.opening,
        importedIn,
        importedOut,
        calculatedClosing: calculated.toFixed(),
        excelClosing: row.excelClosing,
        difference: excelClosing
          ? excelClosing.sub(calculated).toFixed()
          : "n/a",
      });
  }
  const summarised = new Set(summary.map((row) => codeKey(row.code)));
  const movementWithoutSummaryRow = [...new Set(movedKeys)]
    .filter((key) => !summarised.has(key))
    .sort()
    .map((key) => {
      const balance = balanceOf(key)?.current ?? "0";
      return {
        code: codeOf(key),
        balance,
        negative: new Decimal(balance).lt(0),
      };
    });
  return {
    source,
    materialCount: summary.length,
    matched,
    mismatched: mismatches.length,
    mismatches,
    movementWithoutSummaryRow,
  };
}

/** Balances the parsed rows would produce, before anything touches the database. */
function replicaBalances(masters: MasterDraft[], rows: ParsedTransaction[]) {
  const map = new Map<
    string,
    { opening: string; inbound: Decimal; outbound: Decimal }
  >();
  for (const master of masters)
    map.set(codeKey(master.code), {
      opening: master.openingQuantity,
      inbound: new Decimal(0),
      outbound: new Decimal(0),
    });
  for (const row of rows) {
    const entry = map.get(codeKey(row.materialCode));
    if (!entry) continue;
    if (row.type === "INBOUND") entry.inbound = entry.inbound.add(row.quantity);
    else entry.outbound = entry.outbound.add(row.quantity);
  }
  return (key: string) => {
    const entry = map.get(key);
    if (!entry) return null;
    return {
      opening: entry.opening,
      inbound: entry.inbound.toFixed(),
      outbound: entry.outbound.toFixed(),
      current: new Decimal(entry.opening)
        .add(entry.inbound)
        .sub(entry.outbound)
        .toFixed(),
    };
  };
}

const stamp = () => new Date().toISOString();

const storedMaterial = (
  draft: MasterDraft,
  source: string,
): StoredMaterial => ({
  _id: crypto.randomUUID(),
  version: 1,
  code: draft.code,
  normalizedCode: codeKey(draft.code),
  name: draft.name,
  unit: draft.unit,
  openingQuantity: toDecimal128(draft.openingQuantity),
  minimumStock: null,
  note: draft.note,
  active: true,
  sortOrder: draft.sortOrder,
  migrationSource: source,
  sourceRow: draft.sourceRow,
  createdAt: stamp(),
  updatedAt: stamp(),
  createdBy: systemActor,
  updatedBy: systemActor,
});

const storedFacility = (
  facility: ParsedFacility,
  index: number,
  source: string,
): StoredFacility => ({
  _id: crypto.randomUUID(),
  version: 1,
  code: facility.code,
  normalizedCode: codeKey(facility.code),
  name: facility.name,
  type: facility.type,
  phone: facility.phone,
  note: facility.note,
  active: true,
  sortOrder: index + 1,
  migrationSource: source,
  sourceRow: facility.sourceRow,
  createdAt: stamp(),
  updatedAt: stamp(),
  createdBy: systemActor,
  updatedBy: systemActor,
});

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((arg) => !arg.startsWith("--"));
  if (!file)
    throw new Error(
      'Usage: npm run import:materials -- "<source.xlsx>" [--apply]',
    );
  const apply = args.includes("--apply");
  const fileName = basename(file);
  const parsed = parseMaterialsWorkbook(new Uint8Array(await readFile(file)), {
    fileName,
    requireMasters: true,
  });
  if (!parsed.materials.length || !parsed.facilities.length)
    throw new Error("Danh mục vật tư hoặc cơ sở trống; dừng, chưa ghi DB.");

  const master = buildMaterialMaster(parsed);
  const lookups: Lookups = {
    materials: master.masters.map((m) => ({
      id: codeKey(m.code),
      code: m.code,
      name: m.name,
      unit: m.unit,
      active: true,
    })),
    facilities: parsed.facilities.map((f) => ({
      id: codeKey(f.code),
      code: f.code,
      name: f.name,
      active: true,
    })),
  };
  const invalid: Record<
    ParsedTransaction["sheet"],
    { row: number; message: string }[]
  > = {
    ChiTietNhapNVL: [],
    ChiTietxuatNVL: [],
  };
  const rows = parsed.transactions.filter((row) => {
    const decision = classifyTransaction(row, lookups);
    if (decision.status === "valid") return true;
    invalid[row.sheet].push({
      row: row.sourceRow,
      message: decision.message ?? decision.status,
    });
    return false;
  });
  const movedKeys = rows.map((row) => codeKey(row.materialCode));
  const codeOf = (key: string) =>
    lookups.materials.find((m) => m.id === key)?.code ?? key;

  const report = {
    source: fileName,
    sourceHash: parsed.hash,
    mode: apply ? "apply" : "dry-run",
    generatedAt: stamp(),
    committed: false,
    materials: {
      sourceRows: parsed.report.materials.sourceRows,
      valid: master.masters.length,
      duplicates: parsed.report.materials.duplicates,
      conflictingCodes: master.unitConflicts.length,
      imported: null as number | null,
      summaryOnly: master.summaryOnly,
      unitConflicts: master.unitConflicts,
      unitCaseDifferences: master.unitCaseDifferences,
      caseDifferences: master.caseDifferences,
      whitespaceCodes: parsed.report.materials.whitespaceCodes,
      duplicateNames: parsed.report.materials.duplicateNames,
      duplicateSummaryRows: master.duplicateSummaryRows,
      notMigrated: {
        khoNVLColumnE: parsed.report.materials.columnEValues,
        khoNVLColumnF: parsed.report.materials.columnFValues,
      },
    },
    facilities: {
      sourceRows: parsed.report.facilities.sourceRows,
      valid: parsed.facilities.length,
      duplicates: parsed.report.facilities.duplicates,
      imported: null as number | null,
    },
    inbound: ledgerSection(parsed, "ChiTietNhapNVL", invalid.ChiTietNhapNVL),
    outbound: ledgerSection(parsed, "ChiTietxuatNVL", invalid.ChiTietxuatNVL),
    stockReconciliation: reconcile(
      parsed.summary,
      replicaBalances(master.masters, rows),
      movedKeys,
      codeOf,
      "replica",
    ),
    negativeBalances: [] as string[],
    batchId: null as string | null,
    warnings: parsed.warnings,
    issues: parsed.issues,
  };
  await mkdir("backups", { recursive: true });
  const persist = () => writeFile(reportPath, JSON.stringify(report, null, 2));
  await persist();

  if (apply) {
    const db = await connectToDatabase();
    try {
      await getMaterialModel().createIndexes();
      await getFacilityModel().createIndexes();
      await getMaterialTransactionModel().createIndexes();
      const batchId = crypto.randomUUID();
      const outcome = await db.connection.transaction(async (session) => {
        const materialsWritten = await getMaterialModel().bulkWrite(
          master.masters.map((draft) => {
            const document = storedMaterial(draft, fileName);
            return {
              updateOne: {
                filter: { normalizedCode: document.normalizedCode },
                update: { $setOnInsert: document },
                upsert: true,
              },
            };
          }),
          { session, ordered: true },
        );
        const facilitiesWritten = await getFacilityModel().bulkWrite(
          parsed.facilities.map((facility, index) => {
            const document = storedFacility(facility, index, fileName);
            return {
              updateOne: {
                filter: { normalizedCode: document.normalizedCode },
                update: { $setOnInsert: document },
                upsert: true,
              },
            };
          }),
          { session, ordered: true },
        );
        report.materials.imported = materialsWritten.upsertedCount;
        report.facilities.imported = facilitiesWritten.upsertedCount;
        // Existing masters keep their ids; lines must reference whatever is in the DB now.
        const dbLookups = await readLookups(session);
        const written = await writeImportedTransactions(
          session,
          rows,
          dbLookups,
          { type: "system", systemName: systemActor },
          {
            hash: parsed.hash,
            fileName,
            batchId,
            metadata: {
              materialsInserted: materialsWritten.upsertedCount,
              facilitiesInserted: facilitiesWritten.upsertedCount,
            },
          },
        );
        return written;
      });
      report.committed = true;
      report.batchId = outcome.batchId;
      report.negativeBalances = outcome.negativeBalances;
      const perSheet = (sheet: ParsedTransaction["sheet"]) =>
        rows.filter((row) => row.sheet === sheet).length;
      // The bulk result is not split by sheet; attribute skips to a sheet by re-reading keys.
      const existing = new Set(
        (
          await getMaterialTransactionModel()
            .find({ importKey: { $in: rows.map((row) => row.importKey) } })
            .select("importKey batchId")
            .lean<{ importKey: string; batchId: string | null }[]>()
            .exec()
        )
          .filter((line) => line.batchId === outcome.batchId)
          .map((line) => line.importKey),
      );
      for (const [sheet, section] of [
        ["ChiTietNhapNVL", report.inbound],
        ["ChiTietxuatNVL", report.outbound],
      ] as const) {
        const inserted = rows.filter(
          (row) => row.sheet === sheet && existing.has(row.importKey),
        ).length;
        section.imported = inserted;
        section.duplicate = perSheet(sheet) - inserted;
      }

      const [balances, lookupsAfter] = await Promise.all([
        readBalances(null),
        readLookups(null),
      ]);
      const idByKey = new Map(
        lookupsAfter.materials.map((m) => [codeKey(m.code), m.id]),
      );
      report.stockReconciliation = reconcile(
        parsed.summary,
        (key) => {
          const id = idByKey.get(key);
          const balance = id ? balances.get(id) : undefined;
          return balance
            ? {
                opening: balance.openingQuantity,
                inbound: balance.inboundQuantity,
                outbound: balance.outboundQuantity,
                current: balance.currentQuantity,
              }
            : null;
        },
        movedKeys,
        codeOf,
        "database",
      );

      // Add only the missing global grants, preserving every existing one.
      for (const key of ["WAREHOUSE_MANAGER", "DIRECTOR"])
        for (const action of capabilityActions)
          await getRoleDefinitionModel().updateOne(
            { key, "permissions.permission": { $ne: `materials.${action}` } },
            {
              $push: {
                permissions: {
                  permission: `materials.${action}`,
                  scope: "all",
                },
              },
            },
          );
    } finally {
      await persist();
      await db.disconnect();
    }
  }

  console.info(
    JSON.stringify(
      {
        mode: report.mode,
        committed: report.committed,
        materials: {
          sourceRows: report.materials.sourceRows,
          valid: report.materials.valid,
          duplicates: report.materials.duplicates,
          conflictingCodes: report.materials.conflictingCodes,
          imported: report.materials.imported,
          summaryOnly: report.materials.summaryOnly,
          caseDifferences: report.materials.caseDifferences.length,
          duplicateSummaryRows: report.materials.duplicateSummaryRows.map(
            (d) => d.code,
          ),
          notMigrated: report.materials.notMigrated,
        },
        facilities: report.facilities,
        inbound: {
          ...report.inbound,
          invalidRows: report.inbound.invalidRows.length,
        },
        outbound: {
          ...report.outbound,
          invalidRows: report.outbound.invalidRows.length,
        },
        stockReconciliation: {
          ...report.stockReconciliation,
          mismatches: report.stockReconciliation.mismatches.length,
        },
        negativeBalances: report.negativeBalances,
        dateOutsideYear: report.warnings.filter(
          (w) => w.kind === "date-outside-year",
        ).length,
        warnings: report.warnings.length,
        issues: report.issues.length,
        report: reportPath,
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
