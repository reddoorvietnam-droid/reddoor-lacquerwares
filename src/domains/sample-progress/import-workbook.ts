import "server-only";
import * as XLSX from "xlsx";
import {
  dateNote,
  emptyRow,
  emptySampleDate,
  isoDate,
  isoDateSchema,
  maxSampleRows,
  parseVietnameseDate,
  reportColumns,
  sampleStatuses,
  statusLabels,
  weekStart,
  type SampleDate,
  type SampleRowInput,
} from "./contracts";
import { SampleProgressError } from "./service";

export type ImportIssue = {
  rowId: string | null;
  number: number | null;
  excelRow: number | null;
  column: string;
  message: string;
  severity: "error" | "warning";
};

export type ImportPreview = {
  reportDate: string;
  week: string;
  rows: SampleRowInput[];
  issues: ImportIssue[];
};

export const maxWorkbookBytes = 2_000_000;

/** xlsx and xlsm are ZIP packages; anything else is refused before parsing. */
const zipSignature = [0x50, 0x4b, 0x03, 0x04];

const normalize = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleUpperCase("vi");

function cellOf(
  sheet: XLSX.WorkSheet,
  r: number,
  c: number,
): XLSX.CellObject | undefined {
  return sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
}

/** The text a reader sees in Excel, which is what the report is written in. */
function displayText(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.t === "z") return "";
  if (cell.t === "e") return "";
  if (cell.t === "s") return String(cell.v ?? "");
  return cell.w ?? XLSX.utils.format_cell(cell);
}

function serialToIso(serial: number, date1904: boolean): string | null {
  const parsed = XLSX.SSF.parse_date_code(serial, { date1904 });
  if (!parsed || !parsed.y) return null;
  const iso = `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  return isoDateSchema.safeParse(iso).success ? iso : null;
}

export function importSampleWorkbook(bytes: Uint8Array): ImportPreview {
  if (!bytes.length || bytes.length > maxWorkbookBytes)
    throw new SampleProgressError(
      `File phải có dung lượng từ 1 byte đến ${maxWorkbookBytes / 1_000_000} MB.`,
    );
  if (!zipSignature.every((byte, index) => bytes[index] === byte))
    throw new SampleProgressError(
      "File không phải định dạng .xlsx hoặc .xlsm. Hãy lưu lại bằng Excel rồi thử lại.",
    );

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, {
      type: "array",
      cellDates: false,
      cellNF: true,
      cellHTML: false,
      // Macros are never parsed, let alone run.
      bookVBA: false,
    });
  } catch {
    throw new SampleProgressError(
      "Không đọc được file Excel. Hãy chọn file .xlsx hoặc .xlsm hợp lệ.",
    );
  }

  const date1904 = !!workbook.Workbook?.WBProps?.date1904;
  const candidates: {
    sheet: XLSX.WorkSheet;
    startRow: number;
    startCol: number;
  }[] = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet?.["!ref"]) continue;
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    if (range.e.r > 2000 || range.e.c > 100)
      throw new SampleProgressError(
        "Trang tính vượt giới hạn 2.001 dòng / 101 cột.",
      );
    for (let r = 0; r <= Math.min(range.e.r, 100); r++)
      for (let c = 0; c <= Math.min(range.e.c, 30); c++)
        if (
          reportColumns.every(
            (label, i) =>
              normalize(displayText(cellOf(sheet, r, c + i))) ===
              normalize(label),
          )
        )
          candidates.push({ sheet, startRow: r, startCol: c });
  }
  if (candidates.length !== 1)
    throw new SampleProgressError(
      candidates.length === 0
        ? "Không tìm thấy bảng tiến độ có đủ 9 cột theo mẫu Red Door trong file này."
        : `File có ${candidates.length} bảng trùng tiêu đề; hệ thống không tự đoán bảng nào là báo cáo. Hãy giữ lại đúng một bảng.`,
    );

  const { sheet, startRow, startCol } = candidates[0]!;
  const issues: ImportIssue[] = [];
  const rows: SampleRowInput[] = [];
  const end = XLSX.utils.decode_range(sheet["!ref"]!).e.r;

  for (let r = startRow + 1; r <= end; r++) {
    const cells = reportColumns.map((_, i) => cellOf(sheet, r, startCol + i));
    const values = cells.map(displayText);
    if (values.every((value) => !value.trim())) continue;
    if (rows.length >= maxSampleRows)
      throw new SampleProgressError(
        `File có nhiều hơn ${maxSampleRows} mẫu; một báo cáo tuần chỉ chứa tối đa ${maxSampleRows} mẫu.`,
      );

    const excelRow = r + 1;
    const numberCell = cells[0];
    const parsedNumber =
      numberCell?.t === "n" ? Number(numberCell.v) : Number(values[0]);
    const number =
      Number.isSafeInteger(parsedNumber) && parsedNumber >= 1
        ? parsedNumber
        : rows.length + 1;
    const row = emptyRow(number);

    if (number !== parsedNumber)
      issues.push({
        rowId: row.id,
        number,
        excelRow,
        column: "STT",
        message: `Dòng Excel ${excelRow}: STT “${values[0]}” không đọc được nên tạm đánh số ${number}. Hãy kiểm tra lại.`,
        severity: "warning",
      });

    const statusText = values[3] ?? "";
    const status = sampleStatuses.find(
      (key) => normalize(statusLabels[key]) === normalize(statusText),
    );
    if (status) row.status = status;
    else
      issues.push({
        rowId: row.id,
        number,
        excelRow,
        column: "TRẠNG THÁI TỔNG THỂ",
        message: statusText.trim()
          ? `Dòng Excel ${excelRow}: “${statusText}” không thuộc 4 trạng thái của báo cáo. Hãy chọn lại trạng thái trước khi lưu.`
          : `Dòng Excel ${excelRow}: chưa có trạng thái. Hãy chọn trạng thái trước khi lưu.`,
        severity: "error",
      });

    row.orderName = values[1]!.trim();
    row.productDetails = values[2]!;
    row.workshop = values[4]!;
    row.notes = values[8]!;
    if (!row.orderName) {
      row.orderName = `Mẫu dòng ${excelRow}`;
      issues.push({
        rowId: row.id,
        number,
        excelRow,
        column: "MẪU ĐƠN HÀNG",
        message: `Dòng Excel ${excelRow}: thiếu tên mẫu đơn hàng. Hãy điền tên trước khi lưu.`,
        severity: "error",
      });
    }

    (["receivedDate", "qcDate", "sentDate"] as const).forEach((key, offset) => {
      const index = 5 + offset;
      const result = readDateCell(cells[index], values[index]!, date1904);
      row[key] = result.value;
      if (result.message)
        issues.push({
          rowId: row.id,
          number,
          excelRow,
          column: reportColumns[index]!,
          message: `Dòng Excel ${excelRow} · ${reportColumns[index]}: ${result.message}`,
          severity: "warning",
        });
    });

    for (const cell of cells)
      if (cell?.t === "e")
        issues.push({
          rowId: row.id,
          number,
          excelRow,
          column: "",
          message: `Dòng Excel ${excelRow}: có ô báo lỗi Excel, nội dung ô đó không được nhập.`,
          severity: "warning",
        });

    rows.push(row);
  }

  if (!rows.length)
    throw new SampleProgressError("File không có mẫu nào để nhập.");

  const reportDate = findReportDate(sheet, startRow, startCol, date1904);
  if (!reportDate)
    issues.unshift({
      rowId: null,
      number: null,
      excelRow: null,
      column: "",
      message:
        "Không đọc được ngày báo cáo trong file. Hãy chọn tuần và ngày báo cáo trước khi lưu.",
      severity: "warning",
    });

  const duplicates = rows
    .map((row) => row.number)
    .filter((value, index, all) => all.indexOf(value) !== index);
  if (duplicates.length)
    issues.unshift({
      rowId: null,
      number: null,
      excelRow: null,
      column: "STT",
      message: `STT bị trùng: ${[...new Set(duplicates)].join(", ")}. Hãy sửa lại trước khi lưu.`,
      severity: "error",
    });

  return {
    reportDate,
    week: reportDate ? weekStart(reportDate) : "",
    rows,
    issues,
  };
}

/** Reads a date column, keeping the author's own wording when it is not a date. */
function readDateCell(
  cell: XLSX.CellObject | undefined,
  display: string,
  date1904: boolean,
): { value: SampleDate; message?: string } {
  if (cell?.t === "n" && typeof cell.v === "number") {
    const iso = serialToIso(cell.v, date1904);
    if (iso) {
      const shown = display.trim();
      const canonical = iso.split("-").reverse().join("/");
      // The stored value is exact, so it is read as-is. What can mislead is the
      // cell's own format: an m/d/yy cell reads as day/month to a Vietnamese
      // eye, so say what the file really holds and let the author decide.
      return shown && shown !== canonical
        ? {
            value: isoDate(iso),
            message: `Excel hiển thị “${shown}” nhưng giá trị ngày lưu trong file là ${canonical}. Nếu ý bạn là ngày khác, hãy sửa lại.`,
          }
        : { value: isoDate(iso) };
    }
  }
  const raw = display.trim();
  if (!raw) return { value: emptySampleDate };
  const parsed = parseVietnameseDate(raw);
  if (parsed && "iso" in parsed) return { value: isoDate(parsed.iso) };
  if (parsed)
    return {
      value: dateNote(raw),
      message: `giữ nguyên “${raw}” vì ngày/tháng có thể hiểu theo hai cách. Hãy nhập lại thành ngày nếu cần.`,
    };
  return {
    value: dateNote(raw),
    message: `giữ nguyên nội dung “${raw}” vì đây không phải một ngày đầy đủ.`,
  };
}

/** The report date sits above the detail table, as it does in the source file. */
function findReportDate(
  sheet: XLSX.WorkSheet,
  headerRow: number,
  startCol: number,
  date1904: boolean,
): string {
  for (let r = 0; r < headerRow; r++)
    for (let c = startCol; c < startCol + reportColumns.length; c++) {
      const cell = cellOf(sheet, r, c);
      if (!cell) continue;
      if (cell.t === "n" && typeof cell.v === "number") {
        // A bare count would also be numeric; only plausible dates qualify.
        const iso = cell.v > 20000 ? serialToIso(cell.v, date1904) : null;
        if (iso) return iso;
      }
      if (cell.t === "s") {
        const parsed = parseVietnameseDate(String(cell.v ?? ""));
        if (parsed && "iso" in parsed) return parsed.iso;
      }
    }
  return "";
}
