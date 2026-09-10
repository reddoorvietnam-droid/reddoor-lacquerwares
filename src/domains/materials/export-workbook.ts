import "server-only";
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { createZip, type ZipEntry } from "@/domains/sample-progress/zip";
import {
  displayDate,
  type ExportScope,
  type Facility,
  type Material,
  type MaterialTransaction,
  type SummaryRow,
} from "./contracts";
import rawLayout from "./layout.json";

/**
 * Fills the checked-in template (`assets/materials-template.xlsx`: the five
 * sheets of the source workbook, formatting kept, data removed) so the export
 * opens exactly like the file the storekeeper has always used. Cells are
 * written as literal values only — the formulas that once derived names and
 * totals are replaced by what the server already computed.
 */

export type ExportInput = {
  scope: ExportScope;
  summary: SummaryRow[];
  inbound: MaterialTransaction[];
  outbound: MaterialTransaction[];
  materials: Material[];
  facilities: Facility[];
  preparedBy: string;
  generatedAt: Date;
};

type SheetName =
  "ChiTietxuatNVL" | "ChiTietNhapNVL" | "Tong kho NVL" | "KhoNVL" | "Cososx";

const scopeSheets: Record<ExportScope, SheetName[]> = {
  all: ["ChiTietxuatNVL", "ChiTietNhapNVL", "Tong kho NVL", "KhoNVL", "Cososx"],
  summary: ["Tong kho NVL"],
  inbound: ["ChiTietNhapNVL"],
  outbound: ["ChiTietxuatNVL"],
};

export const exportFileNames: Record<ExportScope, string> = {
  all: "KHO-NVL-2026.xlsx",
  summary: "TONG-KHO-NVL.xlsx",
  inbound: "CHI-TIET-NHAP-NVL.xlsx",
  outbound: "CHI-TIET-XUAT-NVL.xlsx",
};

const layout = rawLayout;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Reads only our checked-in template, never an uploaded archive. */
function templateEntries(bytes: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let at = 0;
  while (at + 30 <= bytes.length && bytes.readUInt32LE(at) === 0x04034b50) {
    const method = bytes.readUInt16LE(at + 8);
    const size = bytes.readUInt32LE(at + 18);
    const nameLength = bytes.readUInt16LE(at + 26);
    const extra = bytes.readUInt16LE(at + 28);
    const name = bytes.subarray(at + 30, at + 30 + nameLength).toString("utf8");
    const start = at + 30 + nameLength + extra;
    const payload = bytes.subarray(start, start + size);
    entries.push({
      name,
      data: method === 8 ? inflateRawSync(payload) : payload,
    });
    at = start + size;
  }
  return entries;
}

/** XML 1.0 forbids most control characters; tab and newline must survive. */
const xml = (value: string) =>
  value
    .replace(/\r\n?/g, "\n")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const unescapeXml = (value: string) =>
  value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");

const column = (index: number) => {
  let rest = index;
  let letters = "";
  while (rest > 0) {
    const remainder = (rest - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    rest = Math.floor((rest - remainder - 1) / 26);
  }
  return letters;
};

/** Excel 1900 serial for a calendar date (epoch 1899-12-30, UTC). */
export const excelSerial = (iso: string) =>
  Math.round(
    (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000,
  );

type CellValue =
  | { kind: "text"; value: string }
  | { kind: "number"; value: string | null }
  | { kind: "date"; value: string };

const cellXml = (address: string, style: number, cell: CellValue) => {
  const attrs = `r="${address}" s="${style}"`;
  if (cell.kind === "date")
    return `<c ${attrs}><v>${excelSerial(cell.value)}</v></c>`;
  if (cell.kind === "number")
    return cell.value === null || cell.value === ""
      ? `<c ${attrs}/>`
      : `<c ${attrs}><v>${xml(cell.value)}</v></c>`;
  if (cell.value === "") return `<c ${attrs}/>`;
  // Inline strings cannot execute a pasted =formula or an external link.
  return `<c ${attrs} t="inlineStr"><is><t xml:space="preserve">${xml(cell.value)}</t></is></c>`;
};

const text = (value: string): CellValue => ({ kind: "text", value });
const number = (value: string | null): CellValue => ({ kind: "number", value });
const date = (value: string): CellValue => ({ kind: "date", value });

/** px from the source workbook → pt, the unit `ht` expects. */
const pt = (px: number) => Math.round(px * 75) / 100;

function rowXml(
  r: number,
  heightPx: number,
  firstColumn: number,
  styles: readonly number[],
  cells: readonly CellValue[],
): string {
  const body = cells
    .map((cell, index) =>
      cellXml(`${column(firstColumn + index)}${r}`, styles[index] ?? 0, cell),
    )
    .join("");
  return `<row r="${r}" ht="${pt(heightPx)}" customHeight="1">${body}</row>`;
}

/** Rows the template keeps above the data: titles, subtitle, headers. */
function headerRows(original: string, firstDataRow: number): string {
  return [...original.matchAll(/<row\b[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g)]
    .filter((match) => {
      const r = /\br="(\d+)"/.exec(match[0]);
      return r !== null && Number(r[1]) < firstDataRow;
    })
    .map((match) => match[0])
    .join("");
}

function replaceSheetData(
  original: string,
  body: string,
  dimension: string,
  autoFilter: string | null,
  extraMerges: readonly string[],
): string {
  let next = original
    .replace(
      /<sheetData>[\s\S]*?<\/sheetData>|<sheetData\s*\/>/,
      `<sheetData>${body}</sheetData>`,
    )
    .replace(/<dimension ref="[^"]*"\s*\/>/, `<dimension ref="${dimension}"/>`);
  // Element order matters: sheetData, (calc/protection), autoFilter, mergeCells, ...
  if (autoFilter)
    next = next.replace(
      "</sheetData>",
      `</sheetData><autoFilter ref="${autoFilter}"/>`,
    );
  if (extraMerges.length) {
    const merges = extraMerges
      .map((ref) => `<mergeCell ref="${ref}"/>`)
      .join("");
    const anchor = autoFilter
      ? `<autoFilter ref="${autoFilter}"/>`
      : "</sheetData>";
    next = /<mergeCells count="\d+">/.test(next)
      ? next.replace(
          /<mergeCells count="(\d+)">([\s\S]*?)<\/mergeCells>/,
          (_, count: string, inner: string) =>
            `<mergeCells count="${Number(count) + extraMerges.length}">${inner}${merges}</mergeCells>`,
        )
      : next.replace(
          anchor,
          `${anchor}<mergeCells count="${extraMerges.length}">${merges}</mergeCells>`,
        );
  }
  return next;
}

const generatedDate = (at: Date) =>
  displayDate(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at),
  );

// ---------------------------------------------------------------- sheets

function summarySheet(original: string, input: ExportInput): string {
  const spec = layout.summary;
  const firstRow = 4;
  const head = headerRows(original, firstRow).replace(
    /(<c r="C2"[^>]*>\s*<is>\s*<t[^>]*>)[^<]*(<\/t>)/,
    `$1${xml(`Ngày lập bảng  : ${generatedDate(input.generatedAt)}`)}$2`,
  );
  const rows = input.summary.map((row, index) =>
    rowXml(firstRow + index, spec.heights.data, 3, spec.styles.data, [
      number(String(row.stt)),
      text(row.code),
      text(row.name),
      text(row.unit),
      number(row.openingQuantity),
      number(row.inboundQuantity),
      number(row.outboundQuantity),
      number(row.currentQuantity),
      text(row.note),
    ]),
  );
  const last = Math.max(firstRow, firstRow + input.summary.length - 1);
  // Source layout: "Tổng" right under the table, a blank row, then the signature block.
  const [totalRow, signRow, nameRow] = spec.rowsAfterTable;
  const footer: string[] = [];
  const merges: string[] = [];
  if (totalRow) {
    const r = last + 1;
    footer.push(
      rowXml(r, totalRow.height, 3, totalRow.styles, [
        text("Tổng"),
        ...Array.from({ length: 8 }, () => text("")),
      ]),
    );
    merges.push(`C${r}:D${r}`);
  }
  if (signRow)
    footer.push(
      rowXml(last + 3, signRow.height, 3, signRow.styles, [
        text(""),
        text("Người lập"),
        ...Array.from({ length: 7 }, () => text("")),
      ]),
    );
  if (nameRow)
    footer.push(
      rowXml(last + 4, nameRow.height, 3, nameRow.styles, [
        text(""),
        text(input.preparedBy),
        ...Array.from({ length: 7 }, () => text("")),
      ]),
    );
  return replaceSheetData(
    original,
    head + rows.join("") + footer.join(""),
    `A1:K${last + 4}`,
    `C3:K${last}`,
    merges,
  );
}

function ledgerSheet(
  original: string,
  kind: "inbound" | "outbound",
  rows: readonly MaterialTransaction[],
): string {
  const spec = layout[kind];
  const firstRow = 4;
  const body = rows.map((row, index) =>
    rowXml(
      firstRow + index,
      spec.heights.data,
      1,
      spec.styles.data,
      kind === "inbound"
        ? [
            date(row.transactionDate),
            text(row.materialCode),
            text(row.materialName),
            text(row.description),
            text(row.unit),
            number(row.quantity),
            number(row.unitPrice),
            number(row.amount),
            text(row.note),
          ]
        : [
            date(row.transactionDate),
            text(row.facilityCode),
            text(row.facilityName),
            text(row.materialCode),
            text(row.materialName),
            text(row.description),
            text(row.unit),
            number(row.quantity),
            text(row.note),
          ],
    ),
  );
  const last = Math.max(firstRow, firstRow + rows.length - 1);
  return replaceSheetData(
    original,
    headerRows(original, firstRow) + body.join(""),
    `A1:I${last}`,
    `A3:I${last}`,
    [],
  );
}

function catalogSheet(
  original: string,
  materials: readonly Material[],
): string {
  const spec = layout.catalog;
  const firstRow = 3;
  const body = materials.map((material, index) =>
    rowXml(firstRow + index, spec.heights.data, 1, spec.styles.data, [
      number(String(index + 1)),
      text(material.code),
      text(material.name),
      text(material.unit),
      number(material.openingQuantity),
      text(""),
    ]),
  );
  const last = Math.max(firstRow, firstRow + materials.length - 1);
  return replaceSheetData(
    original,
    headerRows(original, firstRow) + body.join(""),
    `A1:F${last}`,
    null,
    [],
  );
}

function facilitySheet(
  original: string,
  facilities: readonly Facility[],
): string {
  const spec = layout.facilities;
  const firstRow = 5;
  const body = facilities.map((facility, index) =>
    rowXml(firstRow + index, spec.heights.data, 1, spec.styles.data, [
      number(String(index + 1)),
      text(facility.type),
      text(facility.code),
      text(facility.name),
      text(facility.phone),
      text(facility.note),
    ]),
  );
  const last = Math.max(firstRow, firstRow + facilities.length - 1);
  return replaceSheetData(
    original,
    headerRows(original, firstRow) + body.join(""),
    `A1:F${last}`,
    null,
    [],
  );
}

// ---------------------------------------------------------------- package

type SheetPart = { name: SheetName; rId: string; path: string; index: number };

const attr = (tag: string, name: string) =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;

/** Sheet parts are resolved by name through workbook.xml and its rels, never by index. */
function sheetParts(workbookXml: string, relsXml: string): SheetPart[] {
  const targets = new Map<string, string>();
  for (const match of relsXml.matchAll(/<Relationship\b[^>]*\/?>/g)) {
    const id = attr(match[0], "Id");
    const target = attr(match[0], "Target");
    if (id && target)
      targets.set(
        id,
        target.startsWith("/") ? target.slice(1) : `xl/${target}`,
      );
  }
  return [...workbookXml.matchAll(/<sheet\b[^>]*\/>/g)].map((match, index) => {
    const name = unescapeXml(attr(match[0], "name") ?? "") as SheetName;
    const rId = attr(match[0], "r:id") ?? "";
    const path = targets.get(rId);
    if (!path) throw new Error(`Mẫu Excel thiếu phần sheet "${name}".`);
    return { name, rId, path, index };
  });
}

function trimWorkbook(
  workbookXml: string,
  parts: SheetPart[],
  kept: SheetPart[],
): string {
  const keptIndex = new Map(kept.map((part, index) => [part.index, index]));
  let next = workbookXml.replace(/<sheet\b[^>]*\/>/g, (tag) =>
    kept.some((part) => part.rId === attr(tag, "r:id")) ? tag : "",
  );
  next = next.replace(/<definedName\b[^>]*>[\s\S]*?<\/definedName>/g, (tag) => {
    const local = attr(tag, "localSheetId");
    if (local === null) return tag;
    const renumbered = keptIndex.get(Number(local));
    return renumbered === undefined
      ? ""
      : tag.replace(/localSheetId="\d+"/, `localSheetId="${renumbered}"`);
  });
  // An empty <definedNames/> is invalid for Excel.
  next = next.replace(/<definedNames>\s*<\/definedNames>/, "");
  next = next
    .replace(/activeTab="\d+"/, 'activeTab="0"')
    .replace(/firstSheet="\d+"/, 'firstSheet="0"');
  return parts.length === kept.length ? workbookXml : next;
}

function selectTab(sheetXml: string, selected: boolean): string {
  const cleared = sheetXml.replace(
    /(<sheetView\b[^>]*?)\s+tabSelected="[^"]*"/,
    "$1",
  );
  return selected
    ? cleared.replace(/<sheetView\b/, '<sheetView tabSelected="1"')
    : cleared;
}

export async function exportMaterialsWorkbook(
  input: ExportInput,
): Promise<Uint8Array> {
  const template = await readFile(
    `${process.cwd()}/assets/materials-template.xlsx`,
  );
  const entries = templateEntries(template);
  const entry = (name: string) => {
    const found = entries.find((item) => item.name === name);
    if (!found) throw new Error(`Mẫu Excel thiếu phần "${name}".`);
    return found;
  };
  const workbook = entry("xl/workbook.xml");
  const rels = entry("xl/_rels/workbook.xml.rels");
  const contentTypes = entry("[Content_Types].xml");
  const parts = sheetParts(
    decoder.decode(workbook.data),
    decoder.decode(rels.data),
  );
  const wanted = scopeSheets[input.scope];
  const kept = parts.filter((part) => wanted.includes(part.name));
  if (kept.length !== wanted.length)
    throw new Error("Mẫu Excel thiếu sheet cần xuất.");

  const writers: Record<SheetName, (original: string) => string> = {
    "Tong kho NVL": (original) => summarySheet(original, input),
    ChiTietNhapNVL: (original) =>
      ledgerSheet(original, "inbound", input.inbound),
    ChiTietxuatNVL: (original) =>
      ledgerSheet(original, "outbound", input.outbound),
    KhoNVL: (original) => catalogSheet(original, input.materials),
    Cososx: (original) => facilitySheet(original, input.facilities),
  };
  kept.forEach((part, index) => {
    const sheet = entry(part.path);
    sheet.data = encoder.encode(
      selectTab(writers[part.name](decoder.decode(sheet.data)), index === 0),
    );
  });

  const removed = parts.filter((part) => !kept.includes(part));
  workbook.data = encoder.encode(
    trimWorkbook(decoder.decode(workbook.data), parts, kept),
  );
  if (removed.length) {
    rels.data = encoder.encode(
      decoder
        .decode(rels.data)
        .replace(/<Relationship\b[^>]*\/>/g, (tag) =>
          removed.some((part) => part.rId === attr(tag, "Id")) ? "" : tag,
        ),
    );
    contentTypes.data = encoder.encode(
      decoder
        .decode(contentTypes.data)
        .replace(/<Override\b[^>]*\/>/g, (tag) =>
          removed.some((part) => `/${part.path}` === attr(tag, "PartName"))
            ? ""
            : tag,
        ),
    );
  }
  const remaining = entries.filter(
    (item) => !removed.some((part) => part.path === item.name),
  );
  return createZip(remaining, input.generatedAt);
}
