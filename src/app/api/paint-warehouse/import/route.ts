import { z } from "zod";
import { requirePaintAccess } from "@/domains/paint-warehouse/access";
import { PaintError } from "@/domains/paint-warehouse/contracts";
import { failure, json, readFormBody } from "@/domains/paint-warehouse/http";
import {
  buildPaintImportPreview,
  importPaintRows,
  parsePaintWorkbook,
  type ParsedPaintWorkbook,
} from "@/domains/paint-warehouse/import-workbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxImportBytes = 5 * 1024 * 1024;
const modeSchema = z.enum(["preview", "apply"]);
/** xlsx/xlsm is a ZIP package; anything else is refused before SheetJS sees it. */
const zipSignature = [0x50, 0x4b, 0x03, 0x04];

/**
 * multipart/form-data: `file` (.xlsx/.xlsm ≤ 5 MB), `mode=preview|apply`,
 * `includeDuplicates=1`. Preview never writes; apply inserts the valid rows
 * (plus duplicates when asked) and never touches the master catalogue.
 */
export async function POST(request: Request) {
  try {
    const access = await requirePaintAccess("import");
    // The stream is capped while it is read: the declared length is not trusted.
    const form = await readFormBody(
      request,
      maxImportBytes + 64 * 1024,
      "Tệp vượt quá 5 MB.",
    );
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0)
      throw new PaintError("Chưa chọn tệp Excel (.xlsx).");
    if (file.size > maxImportBytes)
      throw new PaintError("Tệp vượt quá 5 MB.", 413);
    const mode = modeSchema.parse(form.get("mode") ?? "preview");
    const includeDuplicates = form.get("includeDuplicates") === "1";
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (zipSignature.some((byte, index) => bytes[index] !== byte))
      throw new PaintError("Chỉ nhận tệp Excel .xlsx hoặc .xlsm.");
    let parsed: ParsedPaintWorkbook;
    try {
      parsed = parsePaintWorkbook(bytes);
    } catch {
      // Never leak SheetJS internals; say which sheets the workbook must carry.
      throw new PaintError(
        "Không đọc được tệp Excel. Cần đủ các sheet ChiTietxuatkho, Cososx và Kho son.",
      );
    }
    const fileName = file.name.trim().slice(0, 255) || "import.xlsx";
    if (mode === "preview")
      return json(await buildPaintImportPreview(parsed, fileName));
    return json(
      await importPaintRows(parsed, access.userId, {
        includeDuplicates,
        fileName,
      }),
    );
  } catch (error) {
    return failure(error);
  }
}
