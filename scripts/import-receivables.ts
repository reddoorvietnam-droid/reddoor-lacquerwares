import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import Decimal from "decimal.js";
import {
  classifyReduction,
  OPENING_DATE,
  OPENING_PERIOD_YEAR,
  type MigrationIssue,
} from "../src/domains/receivables/contracts";
import {
  importKeyOf,
  parseReceivablesWorkbook,
  SHEETS,
  type ParsedReduction,
  type ParsedSale,
} from "../src/domains/receivables/import-workbook";
import {
  getReceivableCounterModel,
  getReceivableCustomerModel,
  getReceivableEntryModel,
  toDecimal128,
  type StoredCustomer,
} from "../src/domains/receivables/models";
import { connectToDatabase } from "../src/lib/db/mongoose";

/**
 * One-off migration of `Reddoor-congno-2026.xlsx` into the receivables
 * collections. Dry run by default; `--apply` writes idempotently (customers
 * keyed by normalizedCode, entries by importKey), so a second run updates the
 * same documents instead of doubling any figure.
 *
 *   npm run import:receivables -- "assets/Reddoor-congno-2026.xlsx" [--apply]
 *
 * Four sheets are imported and 27 are deliberately not; `classifySheets` in
 * `import-workbook.ts` records the evidence for each. The run is only reported
 * as successful when the rebuilt balances equal the workbook's own totals.
 */

const reportPath = "backups/receivables-migration-report.json";
const systemActor = "receivables-workbook-migration";

/**
 * Sequence blocks keep the workbook's own row order inside each ledger and put
 * a day's sales before that day's payments — the order the counter works in,
 * and the one the printed statements already read in.
 */
const OPENING_BASE = 1_000;
const SALES_BASE = 100_000;
const REDUCTION_BASE = 2_000_000;
const COUNTER_START = 4_000_000;

type Mismatch = {
  code: string;
  name: string;
  excelOpening: string;
  excelIncrease: string;
  excelDecrease: string;
  excelClosing: string;
  dbOpening: string;
  dbIncrease: string;
  dbDecrease: string;
  dbClosing: string;
  difference: string;
};

const arg = (name: string) => process.argv.includes(name);
const money = (value: string) => new Decimal(value);
const fixed = (value: Decimal) => value.toFixed();

function tally<T extends { issues: MigrationIssue[] }>(rows: readonly T[]) {
  const counts: Record<string, number> = {};
  for (const row of rows)
    for (const issue of row.issues) counts[issue] = (counts[issue] ?? 0) + 1;
  return counts;
}

async function main() {
  const source =
    process.argv.slice(2).find((value) => !value.startsWith("--")) ??
    "assets/Reddoor-congno-2026.xlsx";
  const apply = arg("--apply");
  const bytes = await readFile(source);
  const parsed = parseReceivablesWorkbook(bytes, basename(source));

  console.log(`\nNguồn: ${parsed.sourceName}`);
  console.log(`SHA-256: ${parsed.sourceSha256}`);
  console.log(
    `Khách hàng: ${parsed.customers.length} · Dư đầu: ${parsed.openings.length} · ` +
      `Bán hàng: ${parsed.sales.length} · Giảm nợ: ${parsed.reductions.length}`,
  );

  // ------------------------------------------------------------ reconcile
  // Replicates the workbook's own SUMIFs, case-insensitively, before anything
  // is written: if this does not agree with the file, nothing else can.
  const salesByCode = new Map<string, Decimal>();
  for (const sale of parsed.sales)
    salesByCode.set(
      sale.normalizedCode,
      (salesByCode.get(sale.normalizedCode) ?? new Decimal(0)).plus(
        sale.amount,
      ),
    );
  const reductionsByCode = new Map<string, Decimal>();
  for (const reduction of parsed.reductions)
    reductionsByCode.set(
      reduction.normalizedCode,
      (reductionsByCode.get(reduction.normalizedCode) ?? new Decimal(0)).plus(
        reduction.amount,
      ),
    );

  const openingByCode = new Map(
    parsed.openings.map((opening) => [opening.normalizedCode, opening]),
  );
  const mismatches: Mismatch[] = [];
  let excelOpening = new Decimal(0);
  let replicaIncrease = new Decimal(0);
  let replicaDecrease = new Decimal(0);

  for (const opening of parsed.openings) {
    const increase = salesByCode.get(opening.normalizedCode) ?? new Decimal(0);
    const decrease =
      reductionsByCode.get(opening.normalizedCode) ?? new Decimal(0);
    const closing = money(opening.amount).plus(increase).minus(decrease);
    excelOpening = excelOpening.plus(opening.amount);
    replicaIncrease = replicaIncrease.plus(increase);
    replicaDecrease = replicaDecrease.plus(decrease);
    const difference = closing.minus(opening.excelClosing);
    if (
      !increase.minus(opening.excelIncrease).abs().lessThanOrEqualTo("0.005") ||
      !decrease.minus(opening.excelDecrease).abs().lessThanOrEqualTo("0.005") ||
      !difference.abs().lessThanOrEqualTo("0.005")
    )
      mismatches.push({
        code: opening.code,
        name: "",
        excelOpening: opening.amount,
        excelIncrease: opening.excelIncrease,
        excelDecrease: opening.excelDecrease,
        excelClosing: opening.excelClosing,
        dbOpening: opening.amount,
        dbIncrease: fixed(increase),
        dbDecrease: fixed(decrease),
        dbClosing: fixed(closing),
        difference: fixed(difference),
      });
  }

  /**
   * Codes that trade but never reached the report. `linh` is one: the workbook
   * sums only the 50 rows someone typed into `TongHopCongNo`, so a customer who
   * bought and paid the same 385.000 is simply absent. The web version carries
   * them with an opening balance of zero, which is why the ledger totals below
   * are larger than the workbook's report totals by exactly that trade.
   */
  const unlisted = [
    ...new Set([...salesByCode.keys(), ...reductionsByCode.keys()]),
  ]
    .filter((code) => code && !openingByCode.has(code))
    .map((code) => ({
      code,
      increase: fixed(salesByCode.get(code) ?? new Decimal(0)),
      decrease: fixed(reductionsByCode.get(code) ?? new Decimal(0)),
    }));

  const ledgerIncrease = parsed.sales.reduce(
    (total, sale) => total.plus(sale.amount),
    new Decimal(0),
  );
  const ledgerDecrease = parsed.reductions.reduce(
    (total, reduction) => total.plus(reduction.amount),
    new Decimal(0),
  );

  console.log("\n— Đối soát với bảng tổng hợp trong file —");
  console.log(
    `  Dư đầu      Excel ${parsed.excelTotals.opening.padStart(15)}  |  replica ${fixed(excelOpening).padStart(15)}`,
  );
  console.log(
    `  Phát sinh + Excel ${parsed.excelTotals.increase.padStart(15)}  |  replica ${fixed(replicaIncrease).padStart(15)}`,
  );
  console.log(
    `  Phát sinh - Excel ${parsed.excelTotals.decrease.padStart(15)}  |  replica ${fixed(replicaDecrease).padStart(15)}`,
  );
  console.log(
    `  Dư cuối     Excel ${parsed.excelTotals.closing.padStart(15)}  |  replica ${fixed(excelOpening.plus(replicaIncrease).minus(replicaDecrease)).padStart(15)}`,
  );
  console.log(`  Khách lệch: ${mismatches.length}/${parsed.openings.length}`);
  if (unlisted.length)
    console.log(
      `  Khách có giao dịch nhưng không có dòng trong TongHopCongNo: ${unlisted
        .map((row) => `${row.code} (+${row.increase} / -${row.decrease})`)
        .join(", ")}`,
    );
  console.log(
    `  Toàn bộ sổ  bán ${fixed(ledgerIncrease)} · giảm ${fixed(ledgerDecrease)}`,
  );

  console.log("\n— Cờ cần rà soát —");
  console.log("  Bán hàng:", JSON.stringify(tally(parsed.sales)));
  console.log("  Giảm nợ :", JSON.stringify(tally(parsed.reductions)));

  console.log("\n— Phân loại sheet —");
  for (const verdict of parsed.sheets)
    console.log(
      `  ${verdict.sheet.padEnd(24)} ${verdict.classification.padEnd(17)} ${verdict.reason}`,
    );

  const descriptions: Record<string, { count: number; type: string }> = {};
  for (const reduction of parsed.reductions) {
    const key = reduction.legacyDescription || "(trống)";
    const existing = descriptions[key];
    if (existing) existing.count += 1;
    else
      descriptions[key] = {
        count: 1,
        type: classifyReduction(reduction.legacyDescription).type,
      };
  }
  console.log("\n— Ánh xạ diễn giải → loại giảm nợ —");
  for (const [text, info] of Object.entries(descriptions).sort(
    (left, right) => right[1].count - left[1].count,
  ))
    console.log(
      `  ${String(info.count).padStart(4)}  ${info.type.padEnd(16)} ${text}`,
    );

  // ------------------------------------------------------------ write
  const report = {
    source: parsed.sourceName,
    sourceSha256: parsed.sourceSha256,
    runAt: new Date().toISOString(),
    applied: apply,
    customers: {
      rowsFound: parsed.customers.length,
      uniqueCodes: new Set(parsed.customers.map((row) => row.normalizedCode))
        .size,
      imported: 0,
      updated: 0,
      createdFromLedger: [] as string[],
    },
    sales: {
      candidateRows: parsed.sales.length,
      imported: 0,
      amountTotal: fixed(ledgerIncrease),
      issues: tally(parsed.sales),
      flaggedRows: parsed.sales
        .filter((sale) => sale.issues.length)
        .map((sale) => ({
          row: sale.sourceRow,
          issues: sale.issues,
          amount: sale.amount,
        })),
    },
    reductions: {
      candidateRows: parsed.reductions.length,
      imported: 0,
      amountTotal: fixed(ledgerDecrease),
      issues: tally(parsed.reductions),
      typeCounts: Object.entries(descriptions).reduce<Record<string, number>>(
        (counts, [, info]) => {
          counts[info.type] = (counts[info.type] ?? 0) + info.count;
          return counts;
        },
        {},
      ),
      descriptionMapping: descriptions,
    },
    openingBalance: {
      customers: parsed.openings.length,
      total: fixed(excelOpening),
      openingDate: OPENING_DATE,
      periodYear: OPENING_PERIOD_YEAR,
      imported: 0,
    },
    reconciliation: {
      excelTotals: parsed.excelTotals,
      replicaTotals: {
        opening: fixed(excelOpening),
        increase: fixed(replicaIncrease),
        decrease: fixed(replicaDecrease),
        closing: fixed(
          excelOpening.plus(replicaIncrease).minus(replicaDecrease),
        ),
      },
      ledgerTotals: {
        increase: fixed(ledgerIncrease),
        decrease: fixed(ledgerDecrease),
      },
      matchedCustomers: parsed.openings.length - mismatches.length,
      mismatchedCustomers: mismatches.length,
      mismatches,
      customersOutsideSummary: unlisted,
      databaseTotals: null as unknown,
      databaseMismatches: [] as Mismatch[],
    },
    sheets: parsed.sheets,
  };

  if (!apply) {
    await mkdir("backups", { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`\nDRY RUN — chưa ghi gì. Báo cáo: ${reportPath}`);
    console.log("Chạy lại với --apply để ghi vào MongoDB.");
    return;
  }

  await connectToDatabase();
  const customerModel = getReceivableCustomerModel();
  const entryModel = getReceivableEntryModel();
  const stamp = new Date().toISOString();
  const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  // 1. Customers. `MaNhaCungCap` order becomes the report order; any code that
  //    only ever appears in a ledger is added after it rather than dropped.
  const existing = await customerModel.find({}).lean<StoredCustomer[]>().exec();
  const byCode = new Map(existing.map((row) => [row.normalizedCode, row]));
  let sortOrder = 0;
  for (const customer of parsed.customers) {
    sortOrder += 1;
    const before = byCode.get(customer.normalizedCode);
    const document = {
      code: customer.code,
      normalizedCode: customer.normalizedCode,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      type: customer.type,
      note: customer.note,
      active: true,
      sortOrder,
      migrationSource: parsed.sourceName,
      sourceRow: customer.sourceRow,
      updatedAt: stamp,
      updatedBy: systemActor,
    };
    if (before) {
      await customerModel.updateOne(
        { _id: before._id },
        { $set: { ...document, version: before.version + 1 } },
      );
      report.customers.updated += 1;
      byCode.set(customer.normalizedCode, {
        ...before,
        ...document,
      } as StoredCustomer);
    } else {
      const created = {
        _id: crypto.randomUUID(),
        version: 1,
        ...document,
        createdAt: stamp,
        createdBy: systemActor,
      };
      await customerModel.create(created);
      report.customers.imported += 1;
      byCode.set(customer.normalizedCode, created as StoredCustomer);
    }
  }

  const ledgerCodes = new Set(
    [...parsed.sales, ...parsed.reductions]
      .map((row) => row.normalizedCode)
      .filter(Boolean),
  );
  for (const code of ledgerCodes) {
    if (byCode.has(code)) continue;
    sortOrder += 1;
    const display =
      parsed.sales.find((sale) => sale.normalizedCode === code)?.customerCode ??
      parsed.reductions.find((row) => row.normalizedCode === code)
        ?.customerCode ??
      code;
    const created = {
      _id: crypto.randomUUID(),
      version: 1,
      code: display,
      normalizedCode: code,
      name: "",
      phone: "",
      address: "",
      type: "",
      note: "Tự tạo khi nhập dữ liệu: mã có giao dịch nhưng không có trong MaNhaCungCap.",
      active: true,
      sortOrder,
      migrationSource: parsed.sourceName,
      sourceRow: null,
      createdAt: stamp,
      createdBy: systemActor,
      updatedAt: stamp,
      updatedBy: systemActor,
    };
    await customerModel.create(created);
    report.customers.createdFromLedger.push(display);
    byCode.set(code, created as StoredCustomer);
  }

  const resolve = (code: string) => {
    const customer = byCode.get(code);
    if (!customer)
      throw new Error(`Không tìm được khách hàng cho mã "${code}".`);
    return customer;
  };

  // 2. Opening balances, as ledger entries keyed by (referenceType, referenceId)
  //    so a re-run restates the same document and never adds a second one.
  for (const [index, opening] of parsed.openings.entries()) {
    const customer = resolve(opening.normalizedCode);
    const referenceId = `${OPENING_PERIOD_YEAR}:${customer._id}`;
    await entryModel.updateOne(
      { referenceType: "OPENING_BALANCE", referenceId },
      {
        $set: {
          customerId: customer._id,
          customerCode: customer.code,
          customerName: customer.name,
          customerPhone: customer.phone,
          entryDate: toDate(OPENING_DATE),
          role: "OPENING",
          type: "OPENING_BALANCE",
          status: "POSTED",
          amount: toDecimal128(opening.amount),
          description: `Dư đầu ngày ${OPENING_DATE.split("-").reverse().join("/")}`,
          note: opening.note,
          sequence: OPENING_BASE + index,
          periodYear: OPENING_PERIOD_YEAR,
          sourceType: "MIGRATION",
          migrationSource: parsed.sourceName,
          migrationSheet: SHEETS.summary,
          sourceRow: opening.sourceRow,
          issues: [],
          postedAt: stamp,
          postedBy: systemActor,
          updatedAt: stamp,
          updatedBy: systemActor,
        },
        $setOnInsert: {
          _id: crypto.randomUUID(),
          version: 1,
          documentNumber: "",
          legacyDescription: "",
          itemCode: "",
          itemName: "",
          unit: "",
          quantity: null,
          unitPrice: null,
          referenceNumber: "",
          importKey: null,
          fingerprint: null,
          idempotencyKey: null,
          cancelledAt: null,
          cancelledBy: null,
          cancelReason: null,
          createdAt: stamp,
          createdBy: systemActor,
        },
      },
      { upsert: true },
    );
    report.openingBalance.imported += 1;
  }

  // 3. The two ledgers, keyed by importKey.
  const writeSale = async (sale: ParsedSale) => {
    const customer = resolve(sale.normalizedCode);
    const importKey = importKeyOf(
      parsed.sourceSha256,
      sale.sheet,
      sale.sourceRow,
    );
    await entryModel.updateOne(
      { importKey },
      {
        $set: {
          customerId: customer._id,
          // The master's spelling is the canonical one: Excel's SUMIF already
          // treated `Sang` and `sang` as one customer. The row the figure came
          // from stays traceable through migrationSheet + sourceRow.
          customerCode: customer.code,
          customerName: customer.name,
          customerPhone: customer.phone,
          entryDate: toDate(sale.entryDate),
          role: "DEBIT",
          type: "SALE",
          status: "POSTED",
          amount: toDecimal128(sale.amount),
          documentNumber: sale.documentNumber,
          description: sale.description,
          note: sale.note,
          legacyDescription: sale.description,
          itemCode: sale.itemCode,
          itemName: sale.itemName,
          unit: sale.unit,
          quantity: sale.quantity === null ? null : toDecimal128(sale.quantity),
          unitPrice:
            sale.unitPrice === null ? null : toDecimal128(sale.unitPrice),
          referenceType: "SALES_LEDGER",
          referenceId: importKey,
          referenceNumber: sale.documentNumber,
          sequence: SALES_BASE + sale.sourceRow,
          sourceType: "MIGRATION",
          migrationSource: parsed.sourceName,
          migrationSheet: sale.sheet,
          sourceRow: sale.sourceRow,
          issues: sale.issues,
          postedAt: stamp,
          postedBy: systemActor,
          updatedAt: stamp,
          updatedBy: systemActor,
        },
        $setOnInsert: {
          _id: crypto.randomUUID(),
          version: 1,
          periodYear: null,
          fingerprint: null,
          idempotencyKey: null,
          cancelledAt: null,
          cancelledBy: null,
          cancelReason: null,
          createdAt: stamp,
          createdBy: systemActor,
        },
      },
      { upsert: true },
    );
    report.sales.imported += 1;
  };

  const writeReduction = async (reduction: ParsedReduction) => {
    const customer = resolve(reduction.normalizedCode);
    const importKey = importKeyOf(
      parsed.sourceSha256,
      reduction.sheet,
      reduction.sourceRow,
    );
    await entryModel.updateOne(
      { importKey },
      {
        $set: {
          customerId: customer._id,
          customerCode: customer.code,
          customerName: customer.name,
          customerPhone: customer.phone,
          entryDate: toDate(reduction.entryDate),
          role: "CREDIT",
          type: reduction.type,
          status: "POSTED",
          amount: toDecimal128(reduction.amount),
          documentNumber: reduction.documentNumber,
          description: reduction.legacyDescription,
          note: reduction.note,
          // The original wording is never overwritten by the mapped type.
          legacyDescription: reduction.legacyDescription,
          referenceType: "PAYMENT_LEDGER",
          referenceId: importKey,
          referenceNumber: reduction.documentNumber,
          sequence: REDUCTION_BASE + reduction.sourceRow,
          sourceType: "MIGRATION",
          migrationSource: parsed.sourceName,
          migrationSheet: reduction.sheet,
          sourceRow: reduction.sourceRow,
          issues: reduction.issues,
          postedAt: stamp,
          postedBy: systemActor,
          updatedAt: stamp,
          updatedBy: systemActor,
        },
        $setOnInsert: {
          _id: crypto.randomUUID(),
          version: 1,
          itemCode: "",
          itemName: "",
          unit: "",
          quantity: null,
          unitPrice: null,
          periodYear: null,
          fingerprint: null,
          idempotencyKey: null,
          cancelledAt: null,
          cancelledBy: null,
          cancelReason: null,
          createdAt: stamp,
          createdBy: systemActor,
        },
      },
      { upsert: true },
    );
    report.reductions.imported += 1;
  };

  for (const sale of parsed.sales) await writeSale(sale);
  for (const reduction of parsed.reductions) await writeReduction(reduction);

  await getReceivableCounterModel().updateOne(
    { _id: "entry" },
    { $max: { value: COUNTER_START } },
    { upsert: true },
  );

  // 4. Read the balances back out of MongoDB and compare them to the workbook.
  //    Anything less would only prove the parser agrees with itself.
  const grouped = await entryModel
    .aggregate<{
      _id: string;
      opening: unknown;
      increase: unknown;
      decrease: unknown;
    }>([
      { $match: { status: "POSTED" } },
      {
        $group: {
          _id: "$customerId",
          opening: {
            $sum: {
              $cond: [
                { $eq: ["$role", "OPENING"] },
                "$amount",
                toDecimal128("0"),
              ],
            },
          },
          increase: {
            $sum: {
              $cond: [
                { $eq: ["$role", "DEBIT"] },
                "$amount",
                toDecimal128("0"),
              ],
            },
          },
          decrease: {
            $sum: {
              $cond: [
                { $eq: ["$role", "CREDIT"] },
                "$amount",
                toDecimal128("0"),
              ],
            },
          },
        },
      },
    ])
    .exec();

  const dbByCustomer = new Map(grouped.map((row) => [row._id, row]));
  const databaseMismatches: Mismatch[] = [];
  let dbOpening = new Decimal(0);
  let dbIncrease = new Decimal(0);
  let dbDecrease = new Decimal(0);
  for (const row of grouped) {
    dbOpening = dbOpening.plus(String(row.opening ?? "0"));
    dbIncrease = dbIncrease.plus(String(row.increase ?? "0"));
    dbDecrease = dbDecrease.plus(String(row.decrease ?? "0"));
  }

  for (const opening of parsed.openings) {
    const customer = resolve(opening.normalizedCode);
    const row = dbByCustomer.get(customer._id);
    const readOpening = new Decimal(String(row?.opening ?? "0"));
    const readIncrease = new Decimal(String(row?.increase ?? "0"));
    const readDecrease = new Decimal(String(row?.decrease ?? "0"));
    const closing = readOpening.plus(readIncrease).minus(readDecrease);
    const difference = closing.minus(opening.excelClosing);
    if (!difference.abs().lessThanOrEqualTo("0.005"))
      databaseMismatches.push({
        code: opening.code,
        name: customer.name,
        excelOpening: opening.amount,
        excelIncrease: opening.excelIncrease,
        excelDecrease: opening.excelDecrease,
        excelClosing: opening.excelClosing,
        dbOpening: fixed(readOpening),
        dbIncrease: fixed(readIncrease),
        dbDecrease: fixed(readDecrease),
        dbClosing: fixed(closing),
        difference: fixed(difference),
      });
  }

  report.reconciliation.databaseTotals = {
    opening: fixed(dbOpening),
    increase: fixed(dbIncrease),
    decrease: fixed(dbDecrease),
    closing: fixed(dbOpening.plus(dbIncrease).minus(dbDecrease)),
  };
  report.reconciliation.databaseMismatches = databaseMismatches;

  await mkdir("backups", { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log("\n— Đã ghi —");
  console.log(
    `  Khách hàng: tạo ${report.customers.imported}, cập nhật ${report.customers.updated}` +
      (report.customers.createdFromLedger.length
        ? `, tạo từ sổ ${report.customers.createdFromLedger.join(", ")}`
        : ""),
  );
  console.log(`  Dư đầu kỳ : ${report.openingBalance.imported}`);
  console.log(`  Bán hàng  : ${report.sales.imported}`);
  console.log(`  Giảm nợ   : ${report.reductions.imported}`);
  console.log("\n— Đối soát DB vs Excel —");
  console.log(
    `  Dư đầu  DB ${fixed(dbOpening)} | Excel ${parsed.excelTotals.opening}`,
  );
  console.log(
    `  Tăng    DB ${fixed(dbIncrease)} | Excel ${parsed.excelTotals.increase} (chênh = giao dịch của khách ngoài bảng tổng hợp)`,
  );
  console.log(
    `  Giảm    DB ${fixed(dbDecrease)} | Excel ${parsed.excelTotals.decrease}`,
  );
  console.log(
    `  Dư cuối DB ${fixed(dbOpening.plus(dbIncrease).minus(dbDecrease))} | Excel ${parsed.excelTotals.closing}`,
  );
  console.log(`  Khách lệch so với file: ${databaseMismatches.length}`);
  for (const row of databaseMismatches)
    console.log(
      `    ${row.code}: DB ${row.dbClosing} vs Excel ${row.excelClosing} (lệch ${row.difference})`,
    );
  console.log(`\nBáo cáo đầy đủ: ${reportPath}`);

  if (databaseMismatches.length)
    throw new Error(
      `${databaseMismatches.length} khách hàng lệch số dư so với file gốc — xem ${reportPath}.`,
    );
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
