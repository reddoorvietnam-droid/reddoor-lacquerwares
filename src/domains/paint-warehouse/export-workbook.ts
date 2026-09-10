import "server-only";
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { createZip, type ZipEntry } from "@/domains/sample-progress/zip";
import { fields, type PaintRow } from "./contracts";
import rawLayout from "./layout.json";

type LayoutRow = { styles: number[]; height: number };
const layoutRows: Record<string, LayoutRow> = rawLayout.rows;
/** Reads only our checked-in template, never an uploaded archive. */
function templateEntries(bytes: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let at = 0;
  while (bytes.readUInt32LE(at) === 0x04034b50) {
    const method = bytes.readUInt16LE(at + 8),
      size = bytes.readUInt32LE(at + 18);
    const nameLength = bytes.readUInt16LE(at + 26),
      extra = bytes.readUInt16LE(at + 28);
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
export async function exportPaintWorkbook(
  rows: readonly PaintRow[],
): Promise<Uint8Array> {
  const entries = templateEntries(
    await readFile(process.cwd() + "/assets/paint-warehouse-template.xlsx"),
  );
  const encoder = new TextEncoder();
  const sheet = entries.find(
    (entry) => entry.name === "xl/worksheets/sheet1.xml",
  )!;
  const original = new TextDecoder().decode(sheet.data);
  const headers = [
    ...original.matchAll(/<row\b[^>]*\br="([123])"[^>]*>[\s\S]*?<\/row>/g),
  ]
    .map((match) => match[0])
    .join("");
  const body = rows
    .map((row, index) => {
      const r = index + 4;
      const style = layoutRows[String(row.sourceRow)] ?? rawLayout.defaultRow;
      const cells = fields
        .map((field, column) => {
          const value = row[field];
          const address = `${String.fromCharCode(65 + column)}${r}`;
          const attrs = `r="${address}" s="${style.styles[column]}"`;
          if (value === null || value === "") return `<c ${attrs}/>`;
          if (column === 0)
            return `<c ${attrs}><v>${(Date.parse(`${value}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000}</v></c>`;
          if ([7, 8, 9, 10, 11, 12].includes(column))
            return `<c ${attrs}><v>${xml(String(value))}</v></c>`;
          // Inline strings cannot execute a pasted =formula or an external link.
          return `<c ${attrs} t="inlineStr"><is><t xml:space="preserve">${xml(String(value))}</t></is></c>`;
        })
        .join("");
      return `<row r="${r}" ht="${(style.height * 3) / 4}" customHeight="1">${cells}</row>`;
    })
    .join("");
  sheet.data = encoder.encode(
    original
      .replace(
        /<sheetData>[\s\S]*?<\/sheetData>/,
        `<sheetData>${headers}${body}</sheetData>`,
      )
      .replace(
        /<dimension ref="[^"]*"\s*\/>/,
        `<dimension ref="A1:N${Math.max(4, rows.length + 3)}"/>`,
      ),
  );
  const workbook = entries.find((entry) => entry.name === "xl/workbook.xml")!;
  workbook.data = encoder.encode(
    new TextDecoder()
      .decode(workbook.data)
      .replace(
        /('ChiTietxuatkho'!\$A\$1:\$N\$)4/g,
        (_match, prefix: string) => `${prefix}${Math.max(4, rows.length + 3)}`,
      ),
  );
  return createZip(entries, new Date());
}
