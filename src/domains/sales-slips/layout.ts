import rawLayout from "./layout.json";

/**
 * Presentation of `HOADONMAU` (A1:G19) as extracted by
 * `scripts/analyze-sales-workbook.py`: fonts, fills, borders, alignment,
 * column widths, row heights, merges and page setup. The print preview, the
 * PDF and the XLSX export all read these numbers so they agree with each
 * other and with the Excel original.
 */

export type BorderSide = { style: string; color: string } | null;
export type CellStyle = {
  font: { name: string; size: number; bold: boolean; italic: boolean };
  fill: string | null;
  align: { horizontal: string | null; vertical: string | null; wrap: boolean };
  border: {
    left: BorderSide;
    right: BorderSide;
    top: BorderSide;
    bottom: BorderSide;
  };
  format: string;
  styleId: number;
};

type Layout = {
  sourceSha256: string;
  sheet: string;
  printArea: string;
  columns: Record<string, number>;
  rowHeights: Record<string, number>;
  defaultRowHeight: number;
  merges: string[];
  page: {
    orientation: string;
    paperSize: number;
    scale: number;
    fitToPage: boolean;
    margins: {
      left: number;
      right: number;
      top: number;
      bottom: number;
      header: number;
      footer: number;
    };
  };
  cells: Record<string, CellStyle>;
  labels: Record<string, string>;
};

export const layout = rawLayout as Layout;

export const columnLetters = ["A", "B", "C", "D", "E", "F", "G"] as const;

/** Excel character width → pixels (Calibri 11: 7 px per digit + 5 px padding) → points. */
export const columnWidthsPt: readonly number[] = columnLetters.map(
  (letter) => ((layout.columns[letter] ?? 8.43) * 7 + 5) * 0.75,
);
export const sheetWidthPt = columnWidthsPt.reduce(
  (sum, width) => sum + width,
  0,
);

/** A4 portrait, margins as the workbook sets them. */
export const page = {
  widthPt: 595.28,
  heightPt: 841.89,
  marginLeftPt: layout.page.margins.left * 72,
  marginRightPt: layout.page.margins.right * 72,
  marginTopPt: layout.page.margins.top * 72,
  marginBottomPt: layout.page.margins.bottom * 72,
} as const;

/**
 * `fitToPage` with `fitToHeight=0` means "fit all columns on one page wide":
 * Excel derives the print scale from the printable width, ignoring the
 * stored 84 %. The same ratio is used for screen, PDF and print.
 */
export const printScale = Math.min(
  1,
  (page.widthPt - page.marginLeftPt - page.marginRightPt) / sheetWidthPt,
);

export const printableWidthPt = sheetWidthPt * printScale;

/** The legal identity printed on the form, exactly as the workbook prints it. */
export const company = {
  name: layout.labels.A1 ?? "CÔNG TY TNHH CỬA ĐỎ",
  address: layout.labels.A2 ?? "",
} as const;

export const labels = layout.labels;

export const cellStyle = (ref: string): CellStyle => {
  const style = layout.cells[ref];
  if (!style) throw new Error(`Template has no cell ${ref}.`);
  return style;
};

export const rowHeightPt = (templateRow: number): number =>
  layout.rowHeights[String(templateRow)] ?? layout.defaultRowHeight;

/** Font stack for the browser; Tinos is the metric-compatible file the PDF embeds. */
export const printFontFamily =
  '"Times New Roman", Tinos, "Liberation Serif", Times, serif';
