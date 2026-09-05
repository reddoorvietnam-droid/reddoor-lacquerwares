/**
 * Imports the accountant's customer or supplier list from an accounting
 * software export (one sheet, one header row, MISA-style column names).
 *
 *   npm run import:partners -- --kind customers --file "C:\\path\\Export_KhachHang.xlsx" --dry-run
 *   npm run import:partners -- --kind customers --file "C:\\path\\Export_KhachHang.xlsx"
 *   npm run import:partners -- --kind suppliers --file "C:\\path\\Export_NhaCungCap.xlsx"
 *
 * Idempotent: a row is matched by its code (upper-cased). An existing record
 * gets its name, tax code, address, and country refreshed; anything the
 * accountant edited by hand in fields the sheet does not carry (email, phone,
 * notes, currency) is left alone. Records are never deleted or archived here.
 */

import { Types } from "mongoose";
import * as XLSX from "xlsx";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import {
  customerWriteInputSchema,
  type CustomerWriteInput,
} from "@/domains/customers/contracts";
import { getCustomerModel } from "@/domains/customers/persistence/models";
import { getAccessGrantModel } from "@/domains/identity/models";
import {
  supplierWriteInputSchema,
  type SupplierWriteInput,
} from "@/domains/suppliers/contracts";
import { getSupplierModel } from "@/domains/suppliers/persistence/models";
import { connectToDatabase } from "@/lib/db/mongoose";

type Options = {
  kind: "customers" | "suppliers";
  file: string;
  dryRun: boolean;
};

function parseOptions(argv: readonly string[]): Options {
  const read = (flag: string): string | null => {
    const index = argv.indexOf(flag);
    return index >= 0 ? (argv[index + 1] ?? null) : null;
  };
  const kind = read("--kind");
  const file = read("--file");
  if ((kind !== "customers" && kind !== "suppliers") || !file) {
    throw new Error(
      "Usage: --kind customers|suppliers --file <xlsx> [--dry-run]",
    );
  }
  return { kind, file, dryRun: argv.includes("--dry-run") };
}

/** Finds the first header that starts with one of the given labels. */
function column(
  headers: readonly string[],
  ...candidates: readonly string[]
): string | null {
  const normalized = headers.map((header) => header.trim().toLowerCase());
  for (const candidate of candidates) {
    const index = normalized.findIndex((header) =>
      header.startsWith(candidate.toLowerCase()),
    );
    if (index >= 0) return headers[index] ?? null;
  }
  return null;
}

const countryHints: readonly [RegExp, string][] = [
  [/vi[eệ]t\s?nam$/i, "Việt Nam"],
  [/(usa|u\.s\.a\.?|united states|,\s*us)\.?$/i, "USA"],
  [/(uk|united kingdom|england)\.?$/i, "United Kingdom"],
  [/singapore(\s+\d+)?$/i, "Singapore"],
  [/india$/i, "India"],
  [/greece$/i, "Greece"],
  [/italy$/i, "Italy"],
  [/thailand$/i, "Thailand"],
  [/uruguay$/i, "Uruguay"],
  [/china\s*\.?\s*\d*$/i, "China"],
  [/japan(\s+[\d-]+)?$/i, "Japan"],
  [/hong\s?kong$/i, "Hong Kong"],
  [/turkey$/i, "Turkey"],
  [/france$/i, "France"],
  [/poland$/i, "Poland"],
  [/lebanon$/i, "Lebanon"],
  [/jordan$/i, "Jordan"],
  [/australia$/i, "Australia"],
  [/saudi arabia$/i, "Saudi Arabia"],
  [/uae$/i, "UAE"],
  [/nam phi$/i, "South Africa"],
];

function guessCountry(address: string, taxCode: string): string | null {
  const trimmed = address.trim().replace(/[.\s]+$/, "");
  for (const [pattern, country] of countryHints) {
    if (pattern.test(trimmed)) return country;
  }
  // Vietnamese tax codes are 10 or 13 digits; a Vietnamese address without an
  // explicit country still names a province or city, and a Vietnamese address
  // is written with Vietnamese letters.
  if (/^\d{10}(?:-\d{3})?$/.test(taxCode)) return "Việt Nam";
  if (/(hà nội|hồ chí minh|đà nẵng|việt nam|vietnam)/i.test(trimmed)) {
    return "Việt Nam";
  }
  if (/[ăâđêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/i.test(trimmed)) {
    return "Việt Nam";
  }
  return null;
}

type Row = Record<string, unknown>;

function cell(row: Row, header: string | null): string {
  if (!header) return "";
  const value = row[header];
  return value === undefined || value === null ? "" : String(value).trim();
}

function readSheet(file: string): { headers: string[]; rows: Row[] } {
  const workbook = XLSX.readFile(file);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The workbook has no sheet.");
  const sheet = workbook.Sheets[sheetName]!;
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
  const headers = Object.keys(rows[0] ?? {});
  return { headers, rows };
}

function toCustomerInputs(headers: string[], rows: Row[]): CustomerWriteInput[] {
  const codeColumn = column(headers, "Mã khách hàng");
  const nameColumn = column(headers, "Tên khách hàng");
  const taxColumn = column(headers, "Mã số thuế");
  const addressColumn = column(headers, "Địa chỉ");
  const phoneColumn = column(headers, "Điện thoại");
  const emailColumn = column(headers, "Email");
  if (!codeColumn || !nameColumn) {
    throw new Error("The sheet needs 'Mã khách hàng' and 'Tên khách hàng'.");
  }
  return rows
    .map((row) => {
      const code = cell(row, codeColumn);
      const name = cell(row, nameColumn);
      if (!code && !name) return null;
      const taxCode = cell(row, taxColumn);
      const address = cell(row, addressColumn);
      const country = guessCountry(address, taxCode);
      return customerWriteInputSchema.parse({
        code: code || null,
        name: name || code,
        taxCode: taxCode || null,
        country,
        email: cell(row, emailColumn) || null,
        phone: cell(row, phoneColumn) || null,
        address: address || null,
        defaultCurrency: country === "Việt Nam" ? "VND" : "USD",
        notes: null,
      });
    })
    .filter((input): input is CustomerWriteInput => input !== null);
}

function toSupplierInputs(headers: string[], rows: Row[]): SupplierWriteInput[] {
  const codeColumn = column(headers, "Mã nhà cung cấp", "Mã NCC");
  const nameColumn = column(headers, "Tên nhà cung cấp", "Tên NCC");
  const addressColumn = column(headers, "Địa chỉ");
  const phoneColumn = column(headers, "Điện thoại");
  const emailColumn = column(headers, "Email");
  const contactColumn = column(headers, "Tên người liên hệ");
  const groupColumn = column(headers, "Nhóm NCC", "Nhóm nhà cung cấp");
  const taxColumn = column(headers, "Mã số thuế");
  if (!codeColumn || !nameColumn) {
    throw new Error(
      "The sheet needs 'Mã nhà cung cấp' and 'Tên nhà cung cấp'.",
    );
  }
  return rows
    .map((row) => {
      const code = cell(row, codeColumn);
      const name = cell(row, nameColumn);
      if (!code && !name) return null;
      // The accountant's sheet puts a contact person or a hint ("Nhà chú
      // Quảng") in the phone column for household craftsmen; only digits
      // are a phone number.
      const phoneCell = cell(row, phoneColumn);
      const phone = /^[+\d][\d\s().-]*$/.test(phoneCell) ? phoneCell : "";
      const contactFromPhone = phone ? "" : phoneCell;
      return supplierWriteInputSchema.parse({
        code: code || null,
        name: name || code,
        taxCode: cell(row, taxColumn) || null,
        category: cell(row, groupColumn) || null,
        contactName: cell(row, contactColumn) || contactFromPhone || null,
        email: cell(row, emailColumn) || null,
        phone: phone || null,
        address: cell(row, addressColumn) || null,
        notes: null,
      });
    })
    .filter((input): input is SupplierWriteInput => input !== null);
}

async function findActorId(): Promise<Types.ObjectId> {
  const grant = await getAccessGrantModel()
    .findOne({ roleKey: "DIRECTOR", status: "active" })
    .sort({ grantedAt: 1 })
    .lean<{ userId: Types.ObjectId }>()
    .exec();
  if (!grant) throw new Error("No active Director grant to attribute the import to.");
  return grant.userId;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const { headers, rows } = readSheet(options.file);
  console.info(`Read ${rows.length} rows from ${options.file}.`);

  const customers =
    options.kind === "customers" ? toCustomerInputs(headers, rows) : [];
  const suppliers =
    options.kind === "suppliers" ? toSupplierInputs(headers, rows) : [];
  const inputs = options.kind === "customers" ? customers : suppliers;

  const codes = new Set<string>();
  for (const input of inputs) {
    if (!input.code) throw new Error(`Row without a code: ${input.name}`);
    if (codes.has(input.code)) throw new Error(`Duplicate code: ${input.code}`);
    codes.add(input.code);
  }

  if (options.dryRun) {
    for (const input of inputs) {
      const extra =
        "country" in input
          ? `${input.country ?? "?"} · ${input.defaultCurrency ?? ""} · MST ${input.taxCode ?? "—"}`
          : `MST ${input.taxCode ?? "—"} · ${input.phone ?? "—"} · ${input.contactName ?? "—"}`;
      console.info(`  ${input.code}  ${input.name}  [${extra}]`);
    }
    console.info(`Dry run: ${inputs.length} ${options.kind} would be upserted.`);
    return;
  }

  await connectToDatabase();
  const actorId = await findActorId();
  const now = new Date();
  let created = 0;
  let updated = 0;

  if (options.kind === "customers") {
    const model = getCustomerModel();
    for (const input of customers) {
      const existing = await model.findOne({ code: input.code }).lean().exec();
      await model.updateOne(
        { code: input.code },
        {
          $set: {
            name: input.name,
            taxCode: input.taxCode,
            address: input.address,
            country: input.country,
            updatedBy: actorId,
          },
          $setOnInsert: {
            code: input.code,
            email: input.email,
            phone: input.phone,
            defaultCurrency: input.defaultCurrency,
            notes: input.notes,
            status: "active",
            createdBy: actorId,
          },
        },
        { upsert: true, runValidators: true },
      );
      if (existing) {
        updated += 1;
      } else {
        created += 1;
        const record = await model
          .findOne({ code: input.code })
          .lean<{ _id: Types.ObjectId }>()
          .exec();
        await mongoAuditRepository.append({
          actor: { type: "system", systemName: "import-customers" },
          action: "customer.created",
          resourceType: "customer",
          resourceId: record?._id.toHexString() ?? null,
          requestId: `import-${now.getTime()}`,
          metadata: { code: input.code, name: input.name, source: "xlsx" },
          occurredAt: now,
        });
      }
    }
  } else {
    const model = getSupplierModel();
    for (const input of suppliers) {
      const existing = await model.findOne({ code: input.code }).lean().exec();
      await model.updateOne(
        { code: input.code },
        {
          $set: {
            name: input.name,
            taxCode: input.taxCode,
            address: input.address,
            updatedBy: actorId,
          },
          $setOnInsert: {
            code: input.code,
            category: input.category,
            contactName: input.contactName,
            email: input.email,
            phone: input.phone,
            notes: input.notes,
            status: "active",
            createdBy: actorId,
          },
        },
        { upsert: true, runValidators: true },
      );
      if (existing) {
        updated += 1;
      } else {
        created += 1;
        const record = await model
          .findOne({ code: input.code })
          .lean<{ _id: Types.ObjectId }>()
          .exec();
        await mongoAuditRepository.append({
          actor: { type: "system", systemName: "import-suppliers" },
          action: "supplier.created",
          resourceType: "supplier",
          resourceId: record?._id.toHexString() ?? null,
          requestId: `import-${now.getTime()}`,
          metadata: { code: input.code, name: input.name, source: "xlsx" },
          occurredAt: now,
        });
      }
    }
  }

  console.info(
    `Import complete: ${created} created, ${updated} refreshed (${options.kind}).`,
  );
}

main()
  .then(async () => {
    const mongoose = (await import("mongoose")).default;
    await mongoose.disconnect().catch(() => undefined);
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    const mongoose = (await import("mongoose")).default;
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
