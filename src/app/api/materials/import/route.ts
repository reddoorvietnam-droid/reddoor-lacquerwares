import { z } from "zod";
import { requireMaterialsAccess } from "@/domains/materials/access";
import { MaterialsError } from "@/domains/materials/contracts";
import { failure, json, readFormBody } from "@/domains/materials/http";
import {
  buildImportPreview,
  importTransactions,
  parseMaterialsWorkbook,
} from "@/domains/materials/import-workbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxImportBytes = 5 * 1024 * 1024;
const modeSchema = z.enum(["preview", "apply"]);
/** xlsx is a ZIP package; anything else is refused before SheetJS sees it. */
const zipSignature = [0x50, 0x4b, 0x03, 0x04];

/**
 * multipart/form-data: `file` (.xlsx ≤ 5 MB), `mode=preview|apply`,
 * `includeDuplicates=1`. Preview never writes; apply imports the valid rows
 * (plus duplicates when asked) and never touches master data.
 */
export async function POST(request: Request) {
  try {
    const access = await requireMaterialsAccess("import");
    // The stream is capped while it is read: the declared length is not trusted.
    const form = await readFormBody(
      request,
      maxImportBytes + 64 * 1024,
      "Tệp vượt quá 5 MB.",
    );
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0)
      throw new MaterialsError("Chưa chọn tệp Excel (.xlsx).");
    if (file.size > maxImportBytes)
      throw new MaterialsError("Tệp vượt quá 5 MB.", 413);
    const mode = modeSchema.parse(form.get("mode") ?? "preview");
    const includeDuplicates = form.get("includeDuplicates") === "1";
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (zipSignature.some((byte, index) => bytes[index] !== byte))
      throw new MaterialsError("Chỉ nhận tệp Excel .xlsx.");
    // The name is stored on every imported line; never let a crafted part bloat them.
    const parsed = parseMaterialsWorkbook(bytes, {
      fileName: file.name.trim().slice(0, 255) || "import.xlsx",
    });
    if (mode === "preview") return json(await buildImportPreview(parsed));
    return json(
      await importTransactions(
        parsed,
        { type: "user", userId: access.userId },
        { includeDuplicates },
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
