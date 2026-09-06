import * as XLSX from "xlsx";

import {
  SheetCheckError,
  type SheetCell,
  type SheetCellType,
  type SheetFileFormat,
  type SheetInventoryEntry,
} from "@/domains/sheet-checks/contracts";
import { issue, type Issue } from "@/domains/sheet-checks/issues";
import { sheetCheckLimits as limits } from "@/domains/sheet-checks/limits";
import {
  decodeCsv,
  detectDelimiter,
  parseCsv,
} from "@/domains/sheet-checks/parsing/csv";

/**
 * File intake (ADR-005): the bytes are typed by their magic number, a zip
 * container is inspected by hand before SheetJS touches it, SheetJS runs
 * with a fixed option set that never evaluates formulas or loads VBA, and
 * every cap (bytes, sheets, rows, columns, cell length) is enforced here.
 * The output is a plain grid of `SheetCell`s; the original bytes are never
 * kept.
 */

export type RawRow = {
  sheetRowNumber: number;
  hidden: boolean;
  cells: SheetCell[];
};

export type ParsedSheet = {
  index: number;
  name: string;
  rows: RawRow[];
  columnCount: number;
  hiddenColumnCount: number;
};

export type ParsedWorkbook = {
  fileFormat: SheetFileFormat;
  date1904: boolean;
  sheets: SheetInventoryEntry[];
  chosen: ParsedSheet;
  issues: Issue[];
};

export type UploadInput = {
  bytes: Uint8Array;
  fileName: string;
  sheetSelector: string | null;
};

/* ------------------------------------------------------------------ */
/* Cells                                                               */
/* ------------------------------------------------------------------ */

export function blankCell(): SheetCell {
  return {
    text: "",
    type: "z",
    number: null,
    numberFormat: null,
    formula: false,
    noCache: false,
    mergedFill: false,
    truncated: false,
  };
}

/** A cell that carries nothing to read: no text, no number, no unsaved formula. */
export function isBlankCell(cell: SheetCell): boolean {
  return cell.text === "" && cell.number === null && !cell.noCache;
}

export function isBlankRow(cells: readonly SheetCell[]): boolean {
  return cells.every(isBlankCell);
}

function cut(text: string): { text: string; truncated: boolean } {
  if (text.length <= limits.maxCellChars) return { text, truncated: false };
  return { text: text.slice(0, limits.maxCellChars), truncated: true };
}

/** A CSV field: text only, blank when empty after trimming. */
function textCell(raw: string): SheetCell {
  const trimmed = raw.trim();
  if (trimmed === "") return blankCell();
  const { text, truncated } = cut(trimmed);
  return { ...blankCell(), text, type: "s", truncated };
}

function cellTypeOf(value: unknown): SheetCellType {
  switch (value) {
    case "n":
    case "s":
    case "b":
    case "e":
    case "z":
      return value;
    default:
      // "d" cannot occur with cellDates:false; anything unexpected is text.
      return "s";
  }
}

function cellObjectHasContent(
  cell: XLSX.CellObject | null | undefined,
): boolean {
  if (!cell) return false;
  if (typeof cell.f === "string") return true;
  if (cell.t === "z") return false;
  return cell.v !== undefined && cell.v !== null;
}

function sheetCellFrom(cell: XLSX.CellObject | null | undefined): SheetCell {
  if (!cell) return blankCell();
  const type = cellTypeOf(cell.t);
  const formula = typeof cell.f === "string";
  const numberFormat = typeof cell.z === "string" ? cell.z : null;
  const noCache =
    formula && (cell.v === undefined || cell.v === null || cell.t === "z");
  if (noCache) {
    return { ...blankCell(), type, numberFormat, formula: true, noCache: true };
  }

  let raw: string;
  if (type === "e") {
    raw = typeof cell.w === "string" ? cell.w : "#ERR";
  } else if (type === "s") {
    raw =
      typeof cell.v === "string"
        ? cell.v
        : typeof cell.w === "string"
          ? cell.w
          : "";
  } else if (typeof cell.w === "string") {
    raw = cell.w;
  } else if (cell.v === undefined || cell.v === null) {
    raw = "";
  } else {
    raw = String(cell.v);
  }
  const { text, truncated } = cut(raw.trim());
  return {
    text,
    type,
    number: type === "n" && typeof cell.v === "number" ? cell.v : null,
    numberFormat,
    formula,
    noCache: false,
    mergedFill: false,
    truncated,
  };
}

/* ------------------------------------------------------------------ */
/* Format detection                                                    */
/* ------------------------------------------------------------------ */

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;
const UTF16_BOMS: readonly (readonly number[])[] = [
  [0xff, 0xfe],
  [0xfe, 0xff],
];
const TEXT_PROBE_BYTES = 4096;

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((value, index) => bytes[index] === value);
}

function extensionOf(fileName: string): string {
  const base = fileName.trim().toLowerCase();
  const dot = base.lastIndexOf(".");
  return dot < 0 ? "" : base.slice(dot + 1);
}

function looksBinary(bytes: Uint8Array): boolean {
  if (UTF16_BOMS.some((bom) => hasPrefix(bytes, bom))) return false;
  const probe = bytes.subarray(0, TEXT_PROBE_BYTES);
  return probe.includes(0);
}

/**
 * The magic number decides; the extension must agree. A renamed file
 * (PNG as .xlsx, xlsx as .csv) is rejected rather than guessed, and a
 * macro-enabled container is refused before it is ever opened.
 */
export function detectFileFormat(
  bytes: Uint8Array,
  fileName: string,
): SheetFileFormat {
  const extension = extensionOf(fileName);
  if (hasPrefix(bytes, ZIP_MAGIC)) {
    if (extension === "xlsx") return "xlsx";
    if (extension === "xlsm" || extension === "xltm") {
      throw new SheetCheckError(
        "FILE_MACRO_REJECTED",
        "Macro-enabled workbooks are not accepted.",
      );
    }
    throw new SheetCheckError(
      "FILE_TYPE_REJECTED",
      `A zip container must be an .xlsx file, not .${extension}.`,
    );
  }
  if (hasPrefix(bytes, OLE2_MAGIC)) {
    if (extension === "xls") return "xls";
    throw new SheetCheckError(
      "FILE_TYPE_REJECTED",
      `An OLE2 container must be an .xls file, not .${extension}.`,
    );
  }
  if ((extension === "csv" || extension === "txt") && !looksBinary(bytes)) {
    return "csv";
  }
  throw new SheetCheckError(
    "FILE_TYPE_REJECTED",
    "Only .xlsx, .xls and .csv files are accepted.",
  );
}

/* ------------------------------------------------------------------ */
/* Zip guard                                                           */
/* ------------------------------------------------------------------ */

const EOCD_SIGNATURE = 0x06054b50;
const EOCD_LENGTH = 22;
const MAX_COMMENT_LENGTH = 0xffff;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_LOCATOR_LENGTH = 20;
const CENTRAL_SIGNATURE = 0x02014b50;
const CENTRAL_HEADER_LENGTH = 46;
const ZIP64_MARKER_16 = 0xffff;
const ZIP64_MARKER_32 = 0xffffffff;
const VBA_PROJECT_PREFIX = "xl/vbaproject";

function suspicious(reason: string): SheetCheckError {
  return new SheetCheckError(
    "FILE_ZIP_SUSPICIOUS",
    `Zip container rejected: ${reason}.`,
  );
}

function findEndOfCentralDirectory(view: DataView): number {
  const last = view.byteLength - EOCD_LENGTH;
  const floor = Math.max(0, last - MAX_COMMENT_LENGTH);
  for (let offset = last; offset >= floor; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}

/** Excel caps a sheet name at 31 characters; a hand-edited file need not. */
const MAX_SHEET_NAME = 120;

function safeSheetName(name: string): string {
  return (
    name
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .trim()
      .slice(0, MAX_SHEET_NAME) || "Sheet"
  );
}

function isUnsafeEntryName(name: string): boolean {
  if (name.startsWith("/") || name.startsWith("\\")) return true;
  if (/^[a-zA-Z]:/.test(name)) return true;
  return name.split(/[\\/]/).includes("..");
}

/**
 * Reads the central directory by hand (no library) and refuses anything
 * SheetJS should never see: too many entries, an entry or a total declared
 * larger than the caps (zip bombs), ZIP64 records, path escapes, and a VBA
 * project (a macro container with a harmless extension).
 */
export function inspectZipContainer(bytes: Uint8Array): void {
  if (bytes.length < EOCD_LENGTH) throw suspicious("too short");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd < 0) throw suspicious("no end of central directory record");
  if (
    eocd >= ZIP64_LOCATOR_LENGTH &&
    view.getUint32(eocd - ZIP64_LOCATOR_LENGTH, true) ===
      ZIP64_LOCATOR_SIGNATURE
  ) {
    throw suspicious("ZIP64 locator present");
  }

  const totalEntries = view.getUint16(eocd + 10, true);
  const directorySize = view.getUint32(eocd + 12, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (
    totalEntries === ZIP64_MARKER_16 ||
    directorySize === ZIP64_MARKER_32 ||
    directoryOffset === ZIP64_MARKER_32
  ) {
    throw suspicious("ZIP64 markers in the end record");
  }
  if (totalEntries > limits.maxZipEntries) {
    throw suspicious(`${totalEntries} entries`);
  }
  if (directoryOffset + directorySize > eocd) {
    throw suspicious("central directory extends past its end record");
  }

  const directoryEnd = directoryOffset + directorySize;
  const nameDecoder = new TextDecoder("utf-8");
  let position = directoryOffset;
  let declaredTotal = 0;
  for (let entry = 0; entry < totalEntries; entry += 1) {
    if (position + CENTRAL_HEADER_LENGTH > directoryEnd) {
      throw suspicious("truncated central directory");
    }
    if (view.getUint32(position, true) !== CENTRAL_SIGNATURE) {
      throw suspicious("bad central directory entry");
    }
    const compressedSize = view.getUint32(position + 20, true);
    const uncompressedSize = view.getUint32(position + 24, true);
    const nameLength = view.getUint16(position + 28, true);
    const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true);
    if (
      compressedSize === ZIP64_MARKER_32 ||
      uncompressedSize === ZIP64_MARKER_32
    ) {
      throw suspicious("ZIP64 entry");
    }
    if (uncompressedSize > limits.maxZipEntryBytes) {
      throw suspicious(`entry declares ${uncompressedSize} bytes`);
    }
    declaredTotal += uncompressedSize;
    if (declaredTotal > limits.maxZipTotalBytes) {
      throw suspicious(`entries declare ${declaredTotal} bytes in total`);
    }
    const nameStart = position + CENTRAL_HEADER_LENGTH;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > directoryEnd)
      throw suspicious("entry name overruns the directory");
    const name = nameDecoder.decode(bytes.subarray(nameStart, nameEnd));
    if (isUnsafeEntryName(name))
      throw suspicious("entry path escapes the container");
    if (name.toLowerCase().startsWith(VBA_PROJECT_PREFIX)) {
      throw new SheetCheckError(
        "FILE_MACRO_REJECTED",
        "The workbook carries a VBA project.",
      );
    }
    position = nameEnd + extraLength + commentLength;
    if (position > directoryEnd)
      throw suspicious("entry overruns the directory");
  }
}

/* ------------------------------------------------------------------ */
/* Sheet loading                                                       */
/* ------------------------------------------------------------------ */

/** Title window plus the data cap plus one row so an overflow is visible. */
const MAX_RAW_ROWS = limits.headerWindowRows + limits.maxRows + 1;

type LoadedSheet = ParsedSheet & {
  nonBlankRows: number;
  issues: Issue[];
};

function trimTrailingBlankRows(rows: RawRow[]): RawRow[] {
  let end = rows.length;
  while (end > 0 && isBlankRow(rows[end - 1]?.cells ?? [])) end -= 1;
  return rows.slice(0, end);
}

function finishSheet(
  index: number,
  name: string,
  rows: RawRow[],
  usedColumns: number,
  hiddenColumnCount: number,
): LoadedSheet {
  const columnCount = Math.min(limits.maxColumns, usedColumns);
  const issues: Issue[] = [];
  if (usedColumns > limits.maxColumns) {
    issues.push(
      issue("COLUMNS_IGNORED", {
        n: usedColumns - limits.maxColumns,
        max: limits.maxColumns,
      }),
    );
  }
  if (hiddenColumnCount > 0) {
    issues.push(issue("HIDDEN_COLUMNS", { n: hiddenColumnCount }));
  }
  const trimmed = trimTrailingBlankRows(rows);
  return {
    index,
    name,
    rows: trimmed,
    columnCount,
    hiddenColumnCount,
    nonBlankRows: trimmed.filter((row) => !isBlankRow(row.cells)).length,
    issues,
  };
}

function loadCsvSheet(grid: readonly (readonly string[])[]): LoadedSheet {
  const window = grid.slice(0, MAX_RAW_ROWS);
  let usedColumns = 0;
  for (const fields of window) {
    let last = -1;
    fields.forEach((field, column) => {
      if (field.trim() !== "") last = column;
    });
    usedColumns = Math.max(usedColumns, last + 1);
  }
  const columnCount = Math.min(limits.maxColumns, usedColumns);
  const rows: RawRow[] = window.map((fields, rowIndex) => ({
    sheetRowNumber: rowIndex + 1,
    hidden: false,
    cells: Array.from({ length: columnCount }, (_unused, column) =>
      textCell(fields[column] ?? ""),
    ),
  }));
  return finishSheet(0, "CSV", rows, usedColumns, 0);
}

type MergeRange = { s: { r: number; c: number }; e: { r: number; c: number } };

function mergeRanges(sheet: XLSX.WorkSheet): MergeRange[] {
  const merges: unknown = sheet["!merges"];
  if (!Array.isArray(merges)) return [];
  return merges.filter(
    (range): range is MergeRange =>
      typeof range === "object" &&
      range !== null &&
      typeof (range as MergeRange).s?.r === "number" &&
      typeof (range as MergeRange).s?.c === "number" &&
      typeof (range as MergeRange).e?.r === "number" &&
      typeof (range as MergeRange).e?.c === "number",
  );
}

function hiddenFlags(
  sheet: XLSX.WorkSheet,
  key: "!rows" | "!cols",
): ReadonlySet<number> {
  const info: unknown = sheet[key];
  const hidden = new Set<number>();
  if (!Array.isArray(info)) return hidden;
  info.forEach((entry: unknown, index) => {
    if (
      typeof entry === "object" &&
      entry !== null &&
      (entry as { hidden?: unknown }).hidden === true
    ) {
      hidden.add(index);
    }
  });
  return hidden;
}

/** Copies the anchor's value into every other cell of a merged range. */
function applyMerges(
  rows: RawRow[],
  columnCount: number,
  merges: readonly MergeRange[],
): void {
  for (const range of merges) {
    const anchor = rows[range.s.r]?.cells[range.s.c];
    if (!anchor) continue;
    const fill: SheetCell = {
      text: anchor.text,
      type: anchor.type,
      number: anchor.number,
      numberFormat: anchor.numberFormat,
      formula: false,
      noCache: false,
      mergedFill: true,
      truncated: anchor.truncated,
    };
    const lastRow = Math.min(range.e.r, rows.length - 1);
    const lastColumn = Math.min(range.e.c, columnCount - 1);
    for (let r = range.s.r; r <= lastRow; r += 1) {
      const row = rows[r];
      if (!row) continue;
      for (let c = range.s.c; c <= lastColumn; c += 1) {
        if (r === range.s.r && c === range.s.c) continue;
        row.cells[c] = { ...fill };
      }
    }
  }
}

function loadWorksheet(
  sheet: XLSX.WorkSheet | undefined,
  name: string,
  index: number,
): LoadedSheet {
  const data: unknown = sheet?.["!data"];
  const reference = sheet?.["!ref"];
  if (
    !sheet ||
    sheet["!type"] === "chart" ||
    !Array.isArray(data) ||
    typeof reference !== "string"
  ) {
    return finishSheet(index, name, [], 0, 0);
  }
  const grid = data as (XLSX.CellObject | null | undefined)[][];
  const range = XLSX.utils.decode_range(reference);
  const lastRow = Math.min(range.e.r, MAX_RAW_ROWS - 1);

  let usedColumns = 0;
  for (let r = 0; r <= lastRow; r += 1) {
    const cells = grid[r];
    if (!cells) continue;
    for (let c = cells.length - 1; c >= 0; c -= 1) {
      if (cellObjectHasContent(cells[c])) {
        usedColumns = Math.max(usedColumns, c + 1);
        break;
      }
    }
  }
  const columnCount = Math.min(limits.maxColumns, usedColumns);

  const hiddenRows = hiddenFlags(sheet, "!rows");
  const hiddenColumns = hiddenFlags(sheet, "!cols");
  let hiddenColumnCount = 0;
  for (let c = 0; c < columnCount; c += 1) {
    if (hiddenColumns.has(c)) hiddenColumnCount += 1;
  }

  const rows: RawRow[] = [];
  for (let r = 0; r <= lastRow; r += 1) {
    const cells = grid[r];
    rows.push({
      sheetRowNumber: r + 1,
      hidden: hiddenRows.has(r),
      cells: Array.from({ length: columnCount }, (_unused, c) =>
        sheetCellFrom(cells?.[c]),
      ),
    });
  }
  applyMerges(rows, columnCount, mergeRanges(sheet));
  return finishSheet(index, name, rows, usedColumns, hiddenColumnCount);
}

function readWorkbook(bytes: Uint8Array): XLSX.WorkBook {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let workbook: XLSX.WorkBook;
  try {
    // Fixed option set: formulas are kept as text only (cellFormula) so an
    // unsaved formula is detectable, nothing is evaluated, no VBA, no extra
    // files, no properties. cellStyles is needed for the hidden row/column
    // flags — SheetJS only records them with styles on.
    workbook = XLSX.read(buffer, {
      type: "buffer",
      dense: true,
      cellFormula: true,
      cellNF: true,
      cellText: true,
      cellDates: false,
      cellHTML: false,
      cellStyles: true,
      bookVBA: false,
      bookFiles: false,
      bookProps: false,
      sheetRows: limits.sheetRowsCap,
      WTF: false,
    });
  } catch (error) {
    throw new SheetCheckError(
      "FILE_PARSE_FAILED",
      error instanceof Error
        ? error.message
        : "The workbook could not be read.",
    );
  }
  if (!workbook || !Array.isArray(workbook.SheetNames)) {
    throw new SheetCheckError(
      "FILE_PARSE_FAILED",
      "The workbook has no sheet list.",
    );
  }
  return workbook;
}

/* ------------------------------------------------------------------ */
/* Sheet choice                                                        */
/* ------------------------------------------------------------------ */

function chooseSheet(
  sheets: readonly LoadedSheet[],
  selector: string | null,
): LoadedSheet {
  if (selector !== null) {
    const wanted = selector.trim();
    if (/^\d+$/.test(wanted)) {
      const byIndex = sheets[Number.parseInt(wanted, 10) - 1];
      if (byIndex) return byIndex;
    }
    const exact = sheets.find((sheet) => sheet.name === wanted);
    if (exact) return exact;
    const lower = wanted.toLowerCase();
    const loose = sheets.find((sheet) => sheet.name.toLowerCase() === lower);
    if (loose) return loose;
    throw new SheetCheckError(
      "SHEET_NOT_FOUND",
      `No sheet matches "${wanted}".`,
    );
  }
  // A header plus at least one row; an empty first sheet is common in
  // exports, so fall through to the first sheet with any content.
  const twoRows = sheets.find((sheet) => sheet.nonBlankRows >= 2);
  if (twoRows) return twoRows;
  const anyRow = sheets.find((sheet) => sheet.nonBlankRows >= 1);
  if (anyRow) return anyRow;
  const first = sheets[0];
  if (!first) throw new SheetCheckError("FILE_EMPTY", "The file has no sheet.");
  return first;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function readUpload(input: UploadInput): ParsedWorkbook {
  const { bytes, fileName, sheetSelector } = input;
  if (bytes.length > limits.maxFileBytes) {
    throw new SheetCheckError(
      "FILE_TOO_LARGE",
      `${bytes.length} bytes exceed the ${limits.maxFileBytes}-byte limit.`,
    );
  }
  const fileFormat = detectFileFormat(bytes, fileName);
  const issues: Issue[] = [];
  let date1904 = false;
  let loaded: LoadedSheet[];

  if (fileFormat === "csv") {
    const decoded = decodeCsv(bytes);
    issues.push(...decoded.issues);
    const delimiter = detectDelimiter(decoded.text);
    loaded = [loadCsvSheet(parseCsv(decoded.text, delimiter))];
  } else {
    if (fileFormat === "xlsx") inspectZipContainer(bytes);
    const workbook = readWorkbook(bytes);
    date1904 = workbook.Workbook?.WBProps?.date1904 === true;
    const names = workbook.SheetNames;
    if (names.length > limits.maxSheets) {
      issues.push(
        issue("SHEETS_IGNORED", {
          n: names.length - limits.maxSheets,
          max: limits.maxSheets,
        }),
      );
    }
    loaded = names
      .slice(0, limits.maxSheets)
      .map((name, index) => loadWorksheet(workbook.Sheets[name], name, index));
  }

  if (!loaded.some((sheet) => sheet.nonBlankRows > 0)) {
    throw new SheetCheckError("FILE_EMPTY", "No sheet holds a non-blank row.");
  }
  const chosen = chooseSheet(loaded, sheetSelector);
  if (chosen.nonBlankRows > limits.headerWindowRows + limits.maxRows) {
    throw new SheetCheckError(
      "FILE_TOO_MANY_ROWS",
      `${chosen.nonBlankRows} non-blank rows exceed the limit.`,
    );
  }
  issues.push(...chosen.issues);

  return {
    fileFormat,
    date1904,
    sheets: loaded.map((sheet) => ({
      index: sheet.index,
      name: safeSheetName(sheet.name),
      rowCount: sheet.nonBlankRows,
    })),
    chosen: {
      index: chosen.index,
      name: safeSheetName(chosen.name),
      rows: chosen.rows,
      columnCount: chosen.columnCount,
      hiddenColumnCount: chosen.hiddenColumnCount,
    },
    issues,
  };
}
