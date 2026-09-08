import "server-only";
import {
  formatSampleDate,
  isoWeekLabel,
  reportColumns,
  sampleStatuses,
  statusExcelColor,
  statusLabels,
  summarize,
  type SampleDate,
  type SampleReport,
  type SampleStatus,
} from "./contracts";
import { createZip, type ZipEntry } from "./zip";

/**
 * Rebuilds the workbook Red Door has always read: one sheet, the same two
 * tables, the same colours and the same doughnut chart. Written as OOXML by
 * hand because SheetJS Community Edition writes neither styles nor charts.
 *
 * Deliberate departures from the source file, all of which were defects there:
 *  - COUNTIF covers the rows that exist instead of a fixed E15:E99 window;
 *  - the status dropdown is bound to the status column only, not to the
 *    workshop and received-date columns as well;
 *  - the report date is the date the revision was saved, not TODAY(), so an
 *    archived revision keeps reading the same on any future day.
 */

// Row 1 title, row 2 report date, rows 4-10 the summary, row 14 the table head.
const TITLE_ROW = 1;
const DATE_ROW = 2;
const SUMMARY_TITLE_ROW = 4;
const SUMMARY_HEAD_ROW = 5;
const SUMMARY_FIRST_ROW = 6;
const SUMMARY_TOTAL_ROW = 10;
const TABLE_TITLE_ROW = 13;
const HEAD_ROW = 14;
const FIRST_DATA_ROW = 15;

/** Column A is a narrow gutter, exactly as in the source workbook. */
const COLUMN_WIDTHS = [4, 6, 26, 38, 26, 22, 16, 16, 16, 52];
const FIRST_COL = 2; // B
const LAST_COL = 10; // J

const STYLE = {
  default: 0,
  title: 1,
  reportDate: 2,
  section: 3,
  summaryHead: 4,
  summaryStatus: { woodwork: 5, finishing: 6, qc_passed: 7, sent: 8 },
  summaryCount: 9,
  summaryRatio: 10,
  totalLabel: 11,
  totalCount: 12,
  totalRatio: 13,
  tableHead: 14,
  bodyText: 15,
  bodyNumber: 16,
  bodyDate: 17,
  bodyStatus: { woodwork: 18, finishing: 19, qc_passed: 20, sent: 21 },
  bodyDateNote: 22,
} as const;

const encoder = new TextEncoder();
const part = (name: string, xml: string): ZipEntry => ({
  name,
  data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xml}`),
});

/** XML 1.0 forbids most control characters; tab and newline must survive. */
function escapeXml(value: string): string {
  let escaped = "";
  for (const char of value.replace(/\r\n?/g, "\n")) {
    const code = char.codePointAt(0) ?? 0;
    // XML 1.0 accepts tab and newline, but no other control character.
    if ((code < 0x20 && char !== "\n" && char !== "\t") || code === 0x7f)
      continue;
    escaped +=
      char === "&"
        ? "&amp;"
        : char === "<"
          ? "&lt;"
          : char === ">"
            ? "&gt;"
            : char === '"'
              ? "&quot;"
              : char;
  }
  return escaped;
}

export function columnLetter(index: number): string {
  let rest = index;
  let letters = "";
  while (rest > 0) {
    const remainder = (rest - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    rest = Math.floor((rest - remainder - 1) / 26);
  }
  return letters;
}

const ref = (col: number, row: number) => `${columnLetter(col)}${row}`;

/** Excel's 1900 serial date; day 1 is 1900-01-01 with the historical leap bug. */
export function toExcelSerial(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000,
  );
}

const textCell = (address: string, style: number, value: string) =>
  `<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;

const numberCell = (address: string, style: number, value: number) =>
  `<c r="${address}" s="${style}"><v>${value}</v></c>`;

/**
 * Cached values travel with every formula so the sheet reads correctly before
 * Excel recalculates and in viewers that never recalculate at all.
 */
const formulaCell = (
  address: string,
  style: number,
  formula: string,
  cached: number,
) =>
  `<c r="${address}" s="${style}"><f>${escapeXml(formula)}</f><v>${cached}</v></c>`;

/** A real date becomes a date cell; kept wording stays text; blanks vanish. */
function dateCell(address: string, entry: SampleDate): string {
  if (entry.kind === "date")
    return numberCell(address, STYLE.bodyDate, toExcelSerial(entry.value));
  if (entry.kind === "text")
    return textCell(address, STYLE.bodyDateNote, entry.value);
  return `<c r="${address}" s="${STYLE.bodyDateNote}"/>`;
}

/** Keeps wrapped text visible without needing the reader to auto-fit rows. */
function estimateRowHeight(values: string[]): number {
  let lines = 1;
  values.forEach((value, index) => {
    const width = COLUMN_WIDTHS[index + FIRST_COL - 1] ?? 20;
    const needed = value
      .split("\n")
      .reduce(
        (total, line) => total + Math.max(1, Math.ceil(line.length / width)),
        0,
      );
    lines = Math.max(lines, needed);
  });
  return Math.min(409, Math.max(20, lines * 15));
}

function stylesXml(): string {
  const font = (
    size: number,
    color: string,
    options: { bold?: boolean; italic?: boolean } = {},
  ) =>
    `<font>${options.bold ? "<b/>" : ""}${options.italic ? "<i/>" : ""}<sz val="${size}"/><color rgb="${color}"/><name val="Times New Roman"/><family val="1"/></font>`;
  const fill = (color: string) =>
    `<fill><patternFill patternType="solid"><fgColor rgb="${color}"/><bgColor indexed="64"/></patternFill></fill>`;
  const align = (
    horizontal: string,
    vertical: string,
    wrap = false,
  ) =>
    `<alignment horizontal="${horizontal}" vertical="${vertical}"${wrap ? ' wrapText="1"' : ""}/>`;
  const xf = (
    numFmtId: number,
    fontId: number,
    fillId: number,
    borderId: number,
    alignment = "",
  ) =>
    `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"${alignment ? ' applyAlignment="1">' + alignment + "</xf>" : "/>"}`;

  const status = (index: number) =>
    Object.fromEntries(
      sampleStatuses.map((key, offset) => [key, index + offset]),
    ) as Record<SampleStatus, number>;
  const summaryFill = status(4); // fill ids 4..7 carry the four status colours
  const cells = [
    xf(0, 0, 0, 0),
    xf(0, 1, 0, 0, align("center", "center", true)),
    xf(165, 2, 0, 0, align("center", "center")),
    xf(0, 3, 0, 0, align("left", "center")),
    xf(0, 4, 2, 1, align("center", "center", true)),
    ...sampleStatuses.map((key) =>
      xf(0, 5, summaryFill[key], 1, align("left", "center", true)),
    ),
    xf(0, 0, 3, 1, align("center", "center")),
    xf(164, 0, 3, 1, align("right", "center")),
    xf(0, 5, 8, 1, align("left", "center")),
    xf(0, 5, 8, 1, align("center", "center")),
    xf(164, 5, 8, 1, align("right", "center")),
    xf(0, 4, 2, 1, align("center", "center", true)),
    xf(0, 0, 3, 1, align("left", "top", true)),
    xf(0, 5, 3, 1, align("center", "center")),
    xf(165, 0, 3, 1, align("center", "center", true)),
    ...sampleStatuses.map((key) =>
      xf(0, 5, summaryFill[key], 1, align("center", "center", true)),
    ),
    xf(0, 0, 3, 1, align("center", "center", true)),
  ];

  return `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="0.0%"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts><fonts count="6">${font(11, "FF000000")}${font(20, "FF1F3864", { bold: true })}${font(12, "FF595959", { bold: true })}${font(16, "FF595959", { bold: true, italic: true })}${font(11, "FFFFFFFF", { bold: true })}${font(11, "FF000000", { bold: true })}</fonts><fills count="9"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fill("FF808080")}${fill("FFFFFFFF")}${sampleStatuses.map((key) => fill(statusExcelColor[key])).join("")}${fill("FFF2F2F2")}</fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBDC3C7"/></left><right style="thin"><color rgb="FFBDC3C7"/></right><top style="thin"><color rgb="FFBDC3C7"/></top><bottom style="thin"><color rgb="FFBDC3C7"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${cells.length}">${cells.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`;
}

function sheetXml(report: SampleReport): string {
  const totals = summarize(report.rows);
  const total = report.rows.length;
  const lastDataRow = Math.max(FIRST_DATA_ROW, HEAD_ROW + total);
  const rows: string[] = [];

  const row = (index: number, cells: string[], height?: number) =>
    rows.push(
      `<row r="${index}"${height ? ` ht="${height}" customHeight="1"` : ""}>${cells.join("")}</row>`,
    );

  const year = report.reportDate.slice(0, 4);
  row(
    TITLE_ROW,
    [
      textCell(
        ref(FIRST_COL, TITLE_ROW),
        STYLE.title,
        `BẢNG TIẾN ĐỘ SẢN XUẤT & THEO DÕI MẪU RED DOOR ${year}`,
      ),
      // Merged cells still need their style applied to every covered cell.
      ...spread(FIRST_COL + 1, LAST_COL, TITLE_ROW, STYLE.title),
    ],
    32,
  );
  row(
    DATE_ROW,
    [
      numberCell(
        ref(FIRST_COL, DATE_ROW),
        STYLE.reportDate,
        toExcelSerial(report.reportDate),
      ),
      ...spread(FIRST_COL + 1, LAST_COL, DATE_ROW, STYLE.reportDate),
    ],
    20,
  );
  row(
    SUMMARY_TITLE_ROW,
    [
      textCell(
        ref(FIRST_COL, SUMMARY_TITLE_ROW),
        STYLE.section,
        "BẢNG THỐNG KÊ TỔNG HỢP",
      ),
      ...spread(FIRST_COL + 1, FIRST_COL + 2, SUMMARY_TITLE_ROW, STYLE.section),
    ],
    28,
  );
  row(
    SUMMARY_HEAD_ROW,
    ["Trạng Thái Tổng Thể", "Số Lượng Mẫu", "Tỷ Lệ"].map((label, index) =>
      textCell(
        ref(FIRST_COL + index, SUMMARY_HEAD_ROW),
        STYLE.summaryHead,
        label,
      ),
    ),
    34,
  );
  totals.forEach((entry, index) => {
    const line = SUMMARY_FIRST_ROW + index;
    row(
      line,
      [
        textCell(
          ref(FIRST_COL, line),
          STYLE.summaryStatus[entry.status],
          statusLabels[entry.status],
        ),
        formulaCell(
          ref(FIRST_COL + 1, line),
          STYLE.summaryCount,
          `COUNTIF($E$${FIRST_DATA_ROW}:$E$${lastDataRow},${ref(FIRST_COL, line)})`,
          entry.count,
        ),
        formulaCell(
          ref(FIRST_COL + 2, line),
          STYLE.summaryRatio,
          `IF($C$${SUMMARY_TOTAL_ROW}>0,${ref(FIRST_COL + 1, line)}/$C$${SUMMARY_TOTAL_ROW},0)`,
          entry.ratio,
        ),
      ],
      26,
    );
  });
  row(
    SUMMARY_TOTAL_ROW,
    [
      textCell(
        ref(FIRST_COL, SUMMARY_TOTAL_ROW),
        STYLE.totalLabel,
        "Tổng cộng mẫu",
      ),
      formulaCell(
        ref(FIRST_COL + 1, SUMMARY_TOTAL_ROW),
        STYLE.totalCount,
        `SUM(C${SUMMARY_FIRST_ROW}:C${SUMMARY_TOTAL_ROW - 1})`,
        total,
      ),
      formulaCell(
        ref(FIRST_COL + 2, SUMMARY_TOTAL_ROW),
        STYLE.totalRatio,
        `SUM(D${SUMMARY_FIRST_ROW}:D${SUMMARY_TOTAL_ROW - 1})`,
        total ? 1 : 0,
      ),
    ],
    26,
  );
  row(
    TABLE_TITLE_ROW,
    [
      textCell(
        ref(FIRST_COL, TABLE_TITLE_ROW),
        STYLE.section,
        "BẢNG THEO DÕI TIẾN ĐỘ CHI TIẾT TỪNG ĐƠN HÀNG",
      ),
      ...spread(FIRST_COL + 1, LAST_COL, TABLE_TITLE_ROW, STYLE.section),
    ],
    28,
  );
  row(
    HEAD_ROW,
    reportColumns.map((label, index) =>
      textCell(ref(FIRST_COL + index, HEAD_ROW), STYLE.tableHead, label),
    ),
    42,
  );

  report.rows.forEach((sample, index) => {
    const line = FIRST_DATA_ROW + index;
    row(
      line,
      [
        numberCell(ref(FIRST_COL, line), STYLE.bodyNumber, sample.number),
        textCell(ref(FIRST_COL + 1, line), STYLE.bodyText, sample.orderName),
        textCell(
          ref(FIRST_COL + 2, line),
          STYLE.bodyText,
          sample.productDetails,
        ),
        textCell(
          ref(FIRST_COL + 3, line),
          STYLE.bodyStatus[sample.status],
          statusLabels[sample.status],
        ),
        textCell(ref(FIRST_COL + 4, line), STYLE.bodyText, sample.workshop),
        dateCell(ref(FIRST_COL + 5, line), sample.receivedDate),
        dateCell(ref(FIRST_COL + 6, line), sample.qcDate),
        dateCell(ref(FIRST_COL + 7, line), sample.sentDate),
        textCell(ref(FIRST_COL + 8, line), STYLE.bodyText, sample.notes),
      ],
      estimateRowHeight([
        String(sample.number),
        sample.orderName,
        sample.productDetails,
        statusLabels[sample.status],
        sample.workshop,
        formatSampleDate(sample.receivedDate),
        formatSampleDate(sample.qcDate),
        formatSampleDate(sample.sentDate),
        sample.notes,
      ]),
    );
  });

  const validation = sampleStatuses
    .map((key) => statusLabels[key])
    .join(",");
  const columns = COLUMN_WIDTHS.map(
    (width, index) =>
      `<col min="${index + 1}" max="${index + 1}" width="${width}" style="0" customWidth="1"/>`,
  ).join("");

  return `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${ref(LAST_COL, lastDataRow)}"/><sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="${HEAD_ROW}" topLeftCell="A${FIRST_DATA_ROW}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${FIRST_DATA_ROW}" sqref="A${FIRST_DATA_ROW}"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="14.5"/><cols>${columns}</cols><sheetData>${rows.join("")}</sheetData><autoFilter ref="${ref(FIRST_COL, HEAD_ROW)}:${ref(LAST_COL, lastDataRow)}"/><mergeCells count="4"><mergeCell ref="${ref(FIRST_COL, TITLE_ROW)}:${ref(LAST_COL, TITLE_ROW)}"/><mergeCell ref="${ref(FIRST_COL, DATE_ROW)}:${ref(LAST_COL, DATE_ROW)}"/><mergeCell ref="${ref(FIRST_COL, SUMMARY_TITLE_ROW)}:${ref(FIRST_COL + 2, SUMMARY_TITLE_ROW)}"/><mergeCell ref="${ref(FIRST_COL, TABLE_TITLE_ROW)}:${ref(LAST_COL, TABLE_TITLE_ROW)}"/></mergeCells><dataValidations count="1"><dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Lỗi nhập liệu" error="Trạng thái phải là một trong bốn trạng thái của báo cáo." promptTitle="Cập nhật trạng thái" prompt="Chọn công đoạn tiến độ" sqref="E${FIRST_DATA_ROW}:E${lastDataRow}"><formula1>"${escapeXml(validation)}"</formula1></dataValidation></dataValidations><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0" horizontalDpi="300" verticalDpi="300"/><drawing r:id="rId1"/></worksheet>`;

  function spread(from: number, to: number, line: number, style: number) {
    const cells: string[] = [];
    for (let col = from; col <= to; col++)
      cells.push(`<c r="${ref(col, line)}" s="${style}"/>`);
    return cells;
  }
}

function chartXml(report: SampleReport, sheetName: string): string {
  const totals = summarize(report.rows);
  const quoted = `'${escapeXml(sheetName.replace(/'/g, "''"))}'`;
  const text = (size: number, bold: boolean) =>
    `<a:defRPr sz="${size}" b="${bold ? 1 : 0}" i="0" u="none" strike="noStrike" kern="1200" baseline="0"><a:solidFill><a:srgbClr val="404040"/></a:solidFill><a:latin typeface="Times New Roman"/><a:cs typeface="Times New Roman"/></a:defRPr>`;
  const points = totals
    .map(
      (entry, index) =>
        `<c:dPt><c:idx val="${index}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${statusExcelColor[entry.status].slice(2)}"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`,
    )
    .join("");
  const categories = totals
    .map(
      (entry, index) =>
        `<c:pt idx="${index}"><c:v>${escapeXml(statusLabels[entry.status])}</c:v></c:pt>`,
    )
    .join("");
  const values = totals
    .map((entry, index) => `<c:pt idx="${index}"><c:v>${entry.count}</c:v></c:pt>`)
    .join("");

  return `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:date1904 val="0"/><c:lang val="vi-VN"/><c:roundedCorners val="0"/><c:chart><c:title><c:tx><c:rich><a:bodyPr rot="0" spcFirstLastPara="1" vertOverflow="ellipsis" vert="horz" wrap="square" anchor="ctr" anchorCtr="1"/><a:lstStyle/><a:p><a:pPr>${text(1600, true)}</a:pPr><a:r><a:rPr lang="vi-VN"/><a:t>Biểu Đồ Tỷ Lệ Tiến Độ Mẫu</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:doughnutChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:strRef><c:f>${quoted}!$C$${SUMMARY_HEAD_ROW}</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>Số Lượng Mẫu</c:v></c:pt></c:strCache></c:strRef></c:tx>${points}<c:cat><c:strRef><c:f>${quoted}!$B$${SUMMARY_FIRST_ROW}:$B$${SUMMARY_TOTAL_ROW - 1}</c:f><c:strCache><c:ptCount val="4"/>${categories}</c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>${quoted}!$C$${SUMMARY_FIRST_ROW}:$C$${SUMMARY_TOTAL_ROW - 1}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="4"/>${values}</c:numCache></c:numRef></c:val></c:ser><c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/><c:showLeaderLines val="1"/></c:dLbls><c:firstSliceAng val="0"/><c:holeSize val="65"/></c:doughnutChart><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea><c:legend><c:legendPos val="r"/><c:overlay val="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:txPr><a:bodyPr rot="0" spcFirstLastPara="1" vertOverflow="ellipsis" vert="horz" wrap="square" anchor="ctr" anchorCtr="1"/><a:lstStyle/><a:p><a:pPr>${text(1000, false)}</a:pPr><a:endParaRPr lang="vi-VN"/></a:p></c:txPr></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/><c:showDLblsOverMax val="0"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill><a:prstDash val="solid"/><a:round/></a:ln></c:spPr><c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings></c:chartSpace>`;
}

export function buildReportFileName(report: SampleReport): string {
  return `Bao-cao-tien-do-mau-Red-Door-${isoWeekLabel(report.week)}-v${report.revision}.xlsx`;
}

export function exportSampleWorkbook(report: SampleReport): Uint8Array {
  const sheetName = `Tien Do Mau ${report.reportDate.slice(0, 4)}`;
  const escapedName = escapeXml(sheetName);
  const savedAt = new Date(report.savedAt);
  const modified = Number.isFinite(savedAt.getTime()) ? savedAt : new Date(0);

  const entries: ZipEntry[] = [
    part(
      "[Content_Types].xml",
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    ),
    part(
      "_rels/.rels",
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    ),
    part(
      "docProps/core.xml",
      `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(`Báo cáo tiến độ mẫu Red Door ${report.week}`)}</dc:title><dc:creator>Red Door</dc:creator><cp:lastModifiedBy>Red Door</cp:lastModifiedBy><dcterms:modified xsi:type="dcterms:W3CDTF">${escapeXml(modified.toISOString())}</dcterms:modified></cp:coreProperties>`,
    ),
    part(
      "docProps/app.xml",
      `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Red Door</Application><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>${escapedName}</vt:lpstr></vt:vector></TitlesOfParts></Properties>`,
    ),
    part(
      "xl/workbook.xml",
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="16000"/></bookViews><sheets><sheet name="${escapedName}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${escapedName.replace(/'/g, "''")}'!$B$${HEAD_ROW}:$J$${Math.max(FIRST_DATA_ROW, HEAD_ROW + report.rows.length)}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">'${escapedName.replace(/'/g, "''")}'!$${HEAD_ROW}:$${HEAD_ROW}</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
    ),
    part(
      "xl/_rels/workbook.xml.rels",
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    part("xl/styles.xml", stylesXml()),
    part("xl/worksheets/sheet1.xml", sheetXml(report)),
    part(
      "xl/worksheets/_rels/sheet1.xml.rels",
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`,
    ),
    part(
      "xl/drawings/drawing1.xml",
      `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:oneCellAnchor><xdr:from><xdr:col>4</xdr:col><xdr:colOff>476250</xdr:colOff><xdr:row>3</xdr:row><xdr:rowOff>38100</xdr:rowOff></xdr:from><xdr:ext cx="4730415" cy="2560530"/><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Bieu do tien do mau"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`,
    ),
    part(
      "xl/drawings/_rels/drawing1.xml.rels",
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/></Relationships>`,
    ),
    part("xl/charts/chart1.xml", chartXml(report, sheetName)),
  ];

  return createZip(entries, modified);
}
