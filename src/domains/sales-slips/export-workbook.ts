import "server-only";
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { createZip, type ZipEntry } from "@/domains/sample-progress/zip";
import type { SalesSlip } from "./contracts";
import { buildSlipSheet } from "./sheet";

/**
 * Template-based XLSX: the checked-in `assets/sales-slip-template.xlsx` is
 * `HOADONMAU` with its values cleared. Rows 1–10 keep their cells and
 * styles, the body row is repeated per line with row 11's styles, and the
 * footer rows (totals, words, date, signatures) are re-numbered below the
 * last line together with their merges and the print area. Values are
 * written, never formulas, so the file can carry no `#REF!`/`#VALUE!`.
 */

const letters = ["A", "B", "C", "D", "E", "F", "G"] as const;

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

const xml = (text: string) =>
  text
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

type TemplateRow = { attrs: string; styles: Map<string, string> };

function parseTemplateRows(sheetXml: string): Map<number, TemplateRow> {
  const rows = new Map<number, TemplateRow>();
  for (const row of sheetXml.matchAll(
    /<row r="(\d+)"([^>]*)>([\s\S]*?)<\/row>/g,
  )) {
    const number = Number(row[1]);
    if (number > 19) continue;
    const styles = new Map<string, string>();
    for (const cell of row[3]!.matchAll(
      /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g,
    )) {
      const style = /\bs="(\d+)"/.exec(cell[2] ?? "")?.[1];
      if (style !== undefined) styles.set(cell[1]!, style);
    }
    rows.set(number, { attrs: row[2] ?? "", styles });
  }
  return rows;
}

export function exportFileName(
  slip: SalesSlip,
  extension: "xlsx" | "pdf",
): string {
  const base =
    slip.internalNumber ??
    `PBH-${slip.slipDate.replaceAll("-", "")}-${slip.migrationSheet ?? slip.id}`;
  return `${base.replace(/[^A-Za-z0-9._-]+/g, "-")}.${extension}`;
}

export async function exportSalesSlipWorkbook(
  slip: SalesSlip,
): Promise<Uint8Array> {
  const entries = templateEntries(
    await readFile(process.cwd() + "/assets/sales-slip-template.xlsx"),
  );
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const sheetEntry = entries.find(
    (entry) => entry.name === "xl/worksheets/sheet1.xml",
  );
  const workbook = entries.find((entry) => entry.name === "xl/workbook.xml");
  if (!sheetEntry || !workbook)
    throw new Error("Template thiếu sheet hoặc workbook.");
  const original = decoder.decode(sheetEntry.data);
  const templateRows = parseTemplateRows(original);
  const sheet = buildSlipSheet(slip);

  const rowsXml = sheet.rows
    .map((row, index) => {
      const r = index + 1;
      const template = templateRows.get(row.templateRow);
      if (!template) throw new Error(`Template thiếu dòng ${row.templateRow}.`);
      const cells: string[] = [];
      for (let col = 0; col < letters.length; col++) {
        const letter = letters[col]!;
        const style = template.styles.get(letter);
        const attrs = `r="${letter}${r}"${style !== undefined ? ` s="${style}"` : ""}`;
        const cell = row.cells.find((candidate) => candidate.col === col);
        let raw = cell?.raw ?? null;
        if (
          sheet.cancelled &&
          row.templateRow === 4 &&
          col === 0 &&
          typeof raw === "string"
        )
          raw = `${raw} (ĐÃ HỦY)`;
        if (cell === undefined || raw === null) {
          if (style !== undefined) cells.push(`<c ${attrs}/>`);
          continue;
        }
        if (cell.kind === "text") {
          // Inline strings cannot execute a pasted =formula or an external link.
          cells.push(
            `<c ${attrs} t="inlineStr"><is><t xml:space="preserve">${xml(String(raw))}</t></is></c>`,
          );
        } else cells.push(`<c ${attrs}><v>${raw}</v></c>`);
      }
      return `<row r="${r}"${template.attrs}>${cells.join("")}</row>`;
    })
    .join("");

  const merges = sheet.merges
    .map((merge) => `<mergeCell ref="${merge}"/>`)
    .join("");
  sheetEntry.data = encoder.encode(
    original
      .replace(
        /<sheetData>[\s\S]*?<\/sheetData>/,
        `<sheetData>${rowsXml}</sheetData>`,
      )
      .replace(
        /<dimension ref="[^"]*"\s*\/>/,
        `<dimension ref="A1:G${sheet.lastRow}"/>`,
      )
      .replace(
        /<mergeCells count="\d+">[\s\S]*?<\/mergeCells>/,
        `<mergeCells count="${sheet.merges.length}">${merges}</mergeCells>`,
      ),
  );
  workbook.data = encoder.encode(
    decoder
      .decode(workbook.data)
      .replace(/(\$A\$1:\$G\$)19/g, `$1${sheet.lastRow}`),
  );
  return createZip(entries, new Date(slip.updatedAt));
}
