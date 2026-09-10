import {
  businessZoneParts,
  excelTimestamp,
  formatQuantity,
  formatVnd,
  slipDateLabel,
  type SalesSlip,
} from "./contracts";
import { company, labels, layout, rowHeightPt } from "./layout";

/**
 * The slip laid out as the template's grid: one row per template row, body
 * rows repeated per line, footer rows shifted down. Three renderers consume
 * it (HTML print preview, PDF, XLSX) so a change here reaches all of them.
 */

export type SheetCell = {
  /** Template address the style comes from, e.g. `B11` for every body code cell. */
  ref: string;
  /** Column index 0..6 (A..G). */
  col: number;
  /** Visual span in columns (merged region or overflow of a label). */
  span: number;
  /** Text as printed. */
  text: string;
  /** Value written to the workbook: a number for numeric cells. */
  raw: string | number | null;
  kind: "text" | "number" | "datetime";
  /** Long free text (the amount in words) may wrap and grow its row. */
  wrap?: boolean;
};

export type SheetRow = {
  templateRow: number;
  /** Row height in points before print scaling. */
  height: number;
  cells: SheetCell[];
};

export type SlipSheet = {
  rows: SheetRow[];
  lastRow: number;
  /** Workbook merges after the footer shift, e.g. `A17:F17`. */
  merges: string[];
  cancelled: boolean;
};

const letters = ["A", "B", "C", "D", "E", "F", "G"] as const;

const text = (
  row: number,
  col: number,
  value: string,
  span = 1,
): SheetCell => ({
  ref: `${letters[col]}${row}`,
  col,
  span,
  text: value,
  raw: value === "" ? null : value,
  kind: "text",
});

const number = (
  row: number,
  col: number,
  value: string | null,
  display: (v: string) => string,
): SheetCell => ({
  ref: `${letters[col]}${row}`,
  col,
  span: 1,
  text: value === null ? "" : display(value),
  raw: value === null ? null : Number(value),
  kind: "number",
});

const blanks = (row: number, cols: number[]): SheetCell[] =>
  cols.map((col) => text(row, col, ""));

/** Excel serial (days since 1899-12-30) of a wall-clock moment. */
function excelSerial(iso: string): number {
  const { year, month, day, hour, minute, second } = businessZoneParts(iso);
  const days =
    (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000;
  return days + (hour * 3600 + minute * 60 + second) / 86_400;
}

export function buildSlipSheet(slip: SalesSlip): SlipSheet {
  const rows: SheetRow[] = [];
  const row = (templateRow: number, cells: SheetCell[]) =>
    rows.push({ templateRow, height: rowHeightPt(templateRow), cells });
  const money = slip.pricesRedacted ? () => "" : formatVnd;

  row(1, [text(1, 0, company.name, 7)]);
  row(2, [text(2, 0, company.address, 7)]);
  row(3, [
    {
      ref: "A3",
      col: 0,
      span: 2,
      text: excelTimestamp(slip.createdAt),
      raw: excelSerial(slip.createdAt),
      kind: "datetime",
    },
    ...blanks(3, [2, 3, 4, 5, 6]),
  ]);
  row(4, [text(4, 0, labels.A4 ?? "PHIẾU BÁN HÀNG", 7)]);
  row(5, [text(5, 0, slipDateLabel(slip.slipDate), 7)]);
  // A6's label overflows into the empty B6 in Excel; the same span here.
  row(6, [
    text(6, 0, labels.A6 ?? "Người nhận hàng:", 2),
    text(6, 2, slip.recipientName, 3),
    ...blanks(6, [5, 6]),
  ]);
  row(7, [
    text(
      7,
      0,
      `${labels.A7 ?? "Đơn vị:"}${slip.recipientUnit ? ` ${slip.recipientUnit}` : ""}`,
      3,
    ),
    ...blanks(7, [3, 4, 5, 6]),
  ]);
  row(8, [
    text(
      8,
      0,
      `${labels.A8 ?? "Nội dung:"}${slip.content ? ` ${slip.content}` : ""}`,
      7,
    ),
  ]);
  row(9, blanks(9, [0, 1, 2, 3, 4, 5, 6]));
  row(
    10,
    letters.map((letter, col) => text(10, col, labels[`${letter}10`] ?? "")),
  );

  let current = 11;
  for (const line of slip.lines) {
    rows.push({
      templateRow: 11,
      height: rowHeightPt(11),
      cells: [
        {
          ref: "A11",
          col: 0,
          span: 1,
          text: String(line.lineNumber),
          raw: line.lineNumber,
          kind: "number",
        },
        { ...text(11, 1, line.itemCode), ref: "B11" },
        { ...text(11, 2, line.itemName), ref: "C11" },
        { ...text(11, 3, line.unit), ref: "D11" },
        { ...number(11, 4, line.quantity, formatQuantity), ref: "E11" },
        {
          ...number(11, 5, slip.pricesRedacted ? null : line.unitPrice, money),
          ref: "F11",
        },
        {
          ...number(11, 6, slip.pricesRedacted ? null : line.lineAmount, money),
          ref: "G11",
        },
      ],
    });
    current += 1;
  }

  const shift = current - 14;
  const footer = (templateRow: number, cells: SheetCell[]) => {
    rows.push({ templateRow, height: rowHeightPt(templateRow), cells });
  };
  footer(14, [
    text(14, 0, labels.A14 ?? "Tổng tiền:", 6),
    {
      ...number(14, 6, slip.pricesRedacted ? null : slip.subtotal, money),
      ref: "G14",
    },
  ]);
  footer(15, [
    text(15, 0, labels.A15 ?? "Tổng cộng tiền thanh toán:", 6),
    {
      ...number(15, 6, slip.pricesRedacted ? null : slip.totalPayment, money),
      ref: "G15",
    },
  ]);
  // Excel has no formula here: the words are typed after the label in A16
  // and overflow across the empty cells to the right.
  const words = slip.pricesRedacted ? "" : (slip.totalInWords ?? "");
  footer(16, [
    {
      ...text(
        16,
        0,
        `${labels.A16 ?? "Bằng chữ :"}${words ? ` ${words}` : ""}`,
        7,
      ),
      wrap: true,
    },
  ]);
  footer(17, [
    ...blanks(17, [0, 1, 2, 3]),
    text(
      17,
      4,
      `${(labels.E17 ?? "Ngày….tháng….năm").replace(/\s*\d{4}\s*$/, "")} ${slip.slipDate.slice(0, 4)}`,
      3,
    ),
  ]);
  footer(18, [
    text(18, 0, labels.A18 ?? "Người lập phiếu", 2),
    text(18, 2, labels.C18 ?? "Người nhận hàng"),
    text(18, 3, labels.D18 ?? "Kế toán trưởng", 2),
    text(18, 5, labels.F18 ?? "Giám đốc", 2),
  ]);
  footer(19, [
    text(19, 0, labels.A19 ?? "(Ký,họ tên)", 2),
    text(19, 2, labels.A19 ?? "(Ký,họ tên)"),
    text(19, 3, labels.A19 ?? "(Ký,họ tên)", 2),
    text(19, 5, labels.A19 ?? "(Ký,họ tên)", 2),
  ]);

  const merges = layout.merges.map((merge) => {
    const [start, end] = merge.split(":") as [string, string];
    const move = (ref: string) => {
      const match = /^([A-Z]+)(\d+)$/.exec(ref)!;
      const rowNumber = Number(match[2]);
      return rowNumber >= 14 ? `${match[1]}${rowNumber + shift}` : ref;
    };
    return `${move(start)}:${move(end)}`;
  });

  return {
    rows,
    lastRow: 19 + shift,
    merges,
    cancelled: slip.status === "CANCELLED",
  };
}
