import {
  AttachmentError,
  type AttachmentErrorCode,
} from "@/domains/assistant/attachments/contracts";
import { attachmentLimits as limits } from "@/domains/assistant/attachments/limits";
import {
  SheetCheckError,
  type SheetCell,
  type SheetCheckErrorCode,
} from "@/domains/sheet-checks/contracts";
import { renderIssue } from "@/domains/sheet-checks/issues";
import {
  readUpload,
  type ParsedWorkbook,
} from "@/domains/sheet-checks/parsing/intake";

/**
 * A spreadsheet attached to a conversation, read as text.
 *
 * There is exactly one spreadsheet reader in this project and this is not a
 * second one: `readUpload` — magic-number typing, the zip guard, SheetJS
 * with formulas never evaluated, every cap enforced — does the reading, and
 * this file only renders what it returns as a grid the model can quote.
 *
 * The distinction the notes insist on is the point of the whole file. This
 * is a plain reading of a document a person happens to hold; it is not a
 * reconciliation against anything the portal knows, and no permission was
 * checked to produce it. The gated comparison against orders, invoices and
 * receipts is the separate "Kiểm tra bảng biểu" feature, and the note says
 * so on every single attachment so neither the reader nor the model can
 * mistake one for the other.
 *
 * Notes are Vietnamese because they are extracted once, stored with the
 * attachment and re-read on every turn: there is no reader locale at the
 * moment a file is parsed, and the people who upload these files work in
 * the Vietnamese portal.
 */

const NOT_A_RECONCILIATION =
  'Đây là bản đọc thô của tệp đính kèm, không phải đối soát với dữ liệu trên hệ thống; việc đối chiếu có kiểm soát nằm ở chức năng "Kiểm tra bảng biểu".';

/**
 * Intake codes that have an exact counterpart keep it; everything else is a
 * failure to read the file, which is all the person can act on anyway.
 * `FILE_TOO_MANY_ROWS` keeps its own code rather than collapsing into
 * FILE_TOO_LARGE: the file may be small, and the only thing that helps the
 * person is being told to attach a narrower range of rows.
 */
const translatedCodes: Partial<
  Record<SheetCheckErrorCode, AttachmentErrorCode>
> = {
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  FILE_TOO_MANY_ROWS: "FILE_TOO_MANY_ROWS",
  FILE_TYPE_REJECTED: "FILE_TYPE_REJECTED",
  FILE_MACRO_REJECTED: "FILE_MACRO_REJECTED",
  FILE_ZIP_SUSPICIOUS: "FILE_ZIP_SUSPICIOUS",
  FILE_EMPTY: "FILE_EMPTY",
  NOT_FOUND: "NOT_FOUND",
  PERMISSION_DENIED: "PERMISSION_DENIED",
};

function translate(error: unknown): Error {
  if (error instanceof SheetCheckError) {
    return new AttachmentError(
      translatedCodes[error.code] ?? "FILE_PARSE_FAILED",
      error.message,
    );
  }
  if (error instanceof Error) return error;
  return new AttachmentError(
    "FILE_PARSE_FAILED",
    "The spreadsheet could not be read.",
  );
}

/**
 * One cell on one line. A cell may legitimately hold a line break; the grid
 * is line-oriented, so the break is flattened. A pipe inside a cell is left
 * alone — rewriting the person's text would be worse than a crooked column,
 * and the leading row number always says where a row starts.
 */
function cellText(cell: SheetCell): { text: string; cut: boolean } {
  const flat = cell.text.replace(/\s+/g, " ").trim();
  if (flat.length <= limits.maxSheetCellChars) {
    return { text: flat, cut: cell.truncated };
  }
  return { text: `${flat.slice(0, limits.maxSheetCellChars)}…`, cut: true };
}

export function extractSheetText(
  bytes: Uint8Array,
  fileName: string,
): { text: string; notes: string[]; truncated: boolean } {
  let workbook: ParsedWorkbook;
  try {
    workbook = readUpload({ bytes, fileName, sheetSelector: null });
  } catch (error) {
    throw translate(error);
  }

  const { chosen, sheets } = workbook;
  const columnCount = Math.min(chosen.columnCount, limits.maxSheetColumns);
  const rows = chosen.rows.slice(0, limits.maxSheetRows);
  const notes: string[] = [NOT_A_RECONCILIATION];
  let truncated = false;
  let cutCells = 0;
  let hiddenRows = 0;
  let emptyFormulas = 0;

  const lines: string[] = [
    `Danh sách sheet: ${sheets
      .map((sheet) => `"${sheet.name}" (${sheet.rowCount} dòng)`)
      .join(", ")}`,
    `Sheet được đọc: "${chosen.name}"`,
    "",
  ];
  for (const row of rows) {
    if (row.hidden) hiddenRows += 1;
    const cells: string[] = [];
    for (let column = 0; column < columnCount; column += 1) {
      const cell = row.cells[column];
      if (!cell) {
        cells.push("");
        continue;
      }
      if (cell.noCache) emptyFormulas += 1;
      const rendered = cellText(cell);
      if (rendered.cut) cutCells += 1;
      cells.push(rendered.text);
    }
    lines.push(`${row.sheetRowNumber} | ${cells.join(" | ")}`);
  }

  if (sheets.length > 1) {
    notes.push(
      `Tệp có ${sheets.length} sheet; chỉ đọc sheet "${chosen.name}".`,
    );
  }
  if (chosen.rows.length > rows.length) {
    notes.push(
      `Sheet có ${chosen.rows.length} dòng; chỉ hiển thị ${limits.maxSheetRows} dòng đầu.`,
    );
    truncated = true;
  }
  if (chosen.columnCount > columnCount) {
    notes.push(
      `Sheet có ${chosen.columnCount} cột; chỉ hiển thị ${limits.maxSheetColumns} cột đầu.`,
    );
    truncated = true;
  }
  if (cutCells > 0) {
    notes.push(
      `${cutCells} ô dài đã bị cắt ở ${limits.maxSheetCellChars} ký tự.`,
    );
    truncated = true;
  }
  if (hiddenRows > 0) {
    notes.push(`Sheet có ${hiddenRows} dòng ẩn; nội dung vẫn được đọc.`);
  }
  if (emptyFormulas > 0) {
    notes.push(
      `${emptyFormulas} ô là công thức chưa lưu kết quả; hiển thị trống.`,
    );
  }
  for (const issue of workbook.issues) notes.push(renderIssue(issue, "vi"));

  let text = lines.join("\n");
  if (text.length > limits.maxTextChars) {
    text = text.slice(0, limits.maxTextChars);
    notes.push(`Văn bản đã bị cắt ở ${limits.maxTextChars} ký tự.`);
    truncated = true;
  }
  return { text, notes, truncated };
}
