import type { CSSProperties } from "react";
import type { SalesSlip } from "@/domains/sales-slips/contracts";
import {
  cellStyle,
  columnWidthsPt,
  printFontFamily,
  printScale,
  printableWidthPt,
  type BorderSide,
} from "@/domains/sales-slips/layout";
import {
  buildSlipSheet,
  type SheetCell,
  type SheetRow,
} from "@/domains/sales-slips/sheet";
import "./print.css";

/**
 * The slip exactly as `HOADONMAU` prints it: same fonts, sizes, fills,
 * borders, widths and heights, scaled the way Excel fits the columns on an
 * A4 page. Pure and server-renderable; the print page and the PDF share
 * the sheet model behind it.
 */

const border = (side: BorderSide) => (side ? "0.75pt solid #000" : "none");

function cellCss(cell: SheetCell): CSSProperties {
  const style = cellStyle(cell.ref);
  const horizontal =
    style.align.horizontal ?? (cell.kind === "text" ? "left" : "right");
  return {
    fontFamily: printFontFamily,
    fontSize: `${style.font.size * printScale}pt`,
    fontWeight: style.font.bold ? 700 : 400,
    fontStyle: style.font.italic ? "italic" : "normal",
    backgroundColor: style.fill ?? undefined,
    textAlign: horizontal as CSSProperties["textAlign"],
    verticalAlign: style.align.vertical === "center" ? "middle" : "bottom",
    borderLeft: border(style.border.left),
    borderRight: border(style.border.right),
    borderTop: border(style.border.top),
    borderBottom: border(style.border.bottom),
    padding: `0 ${2 * printScale}pt`,
    whiteSpace: cell.wrap ? "normal" : "nowrap",
    overflow: "hidden",
    lineHeight: 1.15,
  };
}

function Row({ row }: { row: SheetRow }) {
  return (
    <tr style={{ height: `${row.height * printScale}pt` }}>
      {row.cells.map((cell) => (
        <td
          key={`${cell.ref}-${cell.col}`}
          colSpan={cell.span}
          style={cellCss(cell)}
        >
          {cell.text}
        </td>
      ))}
    </tr>
  );
}

function ColumnGroup() {
  return (
    <colgroup>
      {columnWidthsPt.map((width, index) => (
        <col key={index} style={{ width: `${width * printScale}pt` }} />
      ))}
    </colgroup>
  );
}

const tableCss: CSSProperties = {
  tableLayout: "fixed",
  borderCollapse: "collapse",
  width: `${printableWidthPt}pt`,
  color: "#000",
};

export function SalesSlipSheet({ slip }: { slip: SalesSlip }) {
  const sheet = buildSlipSheet(slip);
  const head = sheet.rows.filter((row) => row.templateRow <= 9);
  const header = sheet.rows.filter((row) => row.templateRow === 10);
  const body = sheet.rows.filter((row) => row.templateRow === 11);
  const footer = sheet.rows.filter((row) => row.templateRow >= 14);
  return (
    <div
      className="sales-slip-print-page"
      data-cancelled={sheet.cancelled || undefined}
    >
      {sheet.cancelled ? (
        <div className="sales-slip-print-watermark" aria-hidden>
          ĐÃ HỦY
        </div>
      ) : null}
      <table style={tableCss}>
        <ColumnGroup />
        <tbody>
          {head.map((row, index) => (
            <Row key={index} row={row} />
          ))}
        </tbody>
      </table>
      <table style={tableCss}>
        <ColumnGroup />
        <thead>
          {header.map((row, index) => (
            <Row key={index} row={row} />
          ))}
        </thead>
        <tbody>
          {body.map((row, index) => (
            <Row key={index} row={row} />
          ))}
        </tbody>
      </table>
      <table style={tableCss} className="sales-slip-print-footer">
        <ColumnGroup />
        <tbody>
          {footer.map((row, index) => (
            <Row key={index} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
