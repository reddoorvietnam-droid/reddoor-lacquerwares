import "server-only";
import path from "node:path";
import {
  Document,
  Font,
  Page,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { SalesSlip } from "./contracts";
import {
  cellStyle,
  columnWidthsPt,
  page,
  printScale,
  printableWidthPt,
  type BorderSide,
} from "./layout";
import { buildSlipSheet, type SheetCell } from "./sheet";

/**
 * PDF of the slip from the same sheet model as the print preview. Tinos is
 * metric-compatible with Times New Roman and carries the Vietnamese glyphs,
 * so the page breaks where the Excel print does.
 */

const fontFamily = "Tinos";
let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), "assets", "fonts");
  Font.register({
    family: fontFamily,
    fonts: [
      { src: path.join(dir, "Tinos-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "Tinos-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const borderWidth = (side: BorderSide) => (side ? 0.5 : 0);

function Cell({ cell, height }: { cell: SheetCell; height: number }) {
  const style = cellStyle(cell.ref);
  const width =
    columnWidthsPt
      .slice(cell.col, cell.col + cell.span)
      .reduce((sum, value) => sum + value, 0) * printScale;
  const horizontal =
    style.align.horizontal ?? (cell.kind === "text" ? "left" : "right");
  const vertical = style.align.vertical === "center" ? "center" : "flex-end";
  return (
    <View
      style={{
        width,
        ...(cell.wrap ? { minHeight: height } : { height }),
        overflow: "hidden",
        justifyContent: vertical,
        paddingHorizontal: 2 * printScale,
        paddingBottom: vertical === "flex-end" ? 1.5 * printScale : 0,
        ...(style.fill ? { backgroundColor: style.fill } : {}),
        borderLeftWidth: borderWidth(style.border.left),
        borderRightWidth: borderWidth(style.border.right),
        borderTopWidth: borderWidth(style.border.top),
        borderBottomWidth: borderWidth(style.border.bottom),
        borderColor: "#000000",
        borderStyle: "solid",
      }}
    >
      <Text
        style={{
          fontFamily,
          fontSize: style.font.size * printScale,
          fontWeight: style.font.bold ? 700 : 400,
          textAlign:
            horizontal === "center"
              ? "center"
              : horizontal === "right"
                ? "right"
                : "left",
          lineHeight: 1.15,
        }}
      >
        {cell.text}
      </Text>
    </View>
  );
}

export function SalesSlipDocument({ slip }: { slip: SalesSlip }) {
  const sheet = buildSlipSheet(slip);
  return (
    <Document
      title={slip.internalNumber ?? "Phiếu bán hàng"}
      author="Red Door"
      creator="Red Door Platform"
      producer="Red Door Platform"
    >
      <Page
        size="A4"
        style={{
          paddingTop: page.marginTopPt,
          paddingBottom: page.marginBottomPt,
          paddingLeft: page.marginLeftPt,
          paddingRight: page.marginRightPt,
          fontFamily,
        }}
      >
        {sheet.rows.map((row, index) => (
          <View
            key={index}
            wrap={false}
            style={{
              flexDirection: "row",
              width: printableWidthPt,
              ...(row.cells.some((cell) => cell.wrap)
                ? { minHeight: row.height * printScale }
                : { height: row.height * printScale }),
            }}
          >
            {row.cells.map((cell) => (
              <Cell
                key={`${cell.ref}-${cell.col}`}
                cell={cell}
                height={row.height * printScale}
              />
            ))}
          </View>
        ))}
        {sheet.cancelled ? (
          <Text
            fixed
            style={{
              position: "absolute",
              top: 330,
              left: 90,
              fontFamily,
              fontSize: 96,
              fontWeight: 700,
              color: "#c0504d",
              opacity: 0.22,
              transform: "rotate(-25deg)",
            }}
          >
            ĐÃ HỦY
          </Text>
        ) : null}
      </Page>
    </Document>
  );
}

export async function renderSalesSlipPdf(slip: SalesSlip): Promise<Uint8Array> {
  registerFonts();
  const buffer = await renderToBuffer(<SalesSlipDocument slip={slip} />);
  return new Uint8Array(buffer);
}
