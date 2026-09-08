import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  buildReportFileName,
  exportSampleWorkbook,
  toExcelSerial,
} from "@/domains/sample-progress/export-workbook";
import { statusLabels } from "@/domains/sample-progress/contracts";
import { buildReport, buildRow } from "./helpers/sample-progress-fakes";
import {
  assertWellFormedXml,
  readZipParts,
} from "./helpers/zip-reader";

const sheetPath = "xl/worksheets/sheet1.xml";

function sheetOf(bytes: Uint8Array) {
  const workbook = XLSX.read(bytes, { type: "array", cellStyles: true });
  const name = workbook.SheetNames[0]!;
  return { workbook, name, sheet: workbook.Sheets[name]! };
}

const text = (parts: Map<string, Uint8Array>, name: string) =>
  new TextDecoder().decode(parts.get(name)!);

describe("sample progress workbook export", () => {
  it("packages every declared part with a CRC Excel accepts", () => {
    const parts = readZipParts(exportSampleWorkbook(buildReport()));
    // readZipParts throws on any CRC or size mismatch, which is the check
    // SheetJS cannot make and Excel's OPC layer does.
    expect([...parts.keys()].sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "docProps/app.xml",
      "docProps/core.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/charts/chart1.xml",
      "xl/drawings/_rels/drawing1.xml.rels",
      "xl/drawings/drawing1.xml",
      "xl/styles.xml",
      "xl/workbook.xml",
      "xl/worksheets/_rels/sheet1.xml.rels",
      "xl/worksheets/sheet1.xml",
    ]);

    // Every part named in [Content_Types].xml must actually ship: SheetJS and
    // Excel both hard-fail on a declared-but-absent part.
    const declared = [
      ...text(parts, "[Content_Types].xml").matchAll(/PartName="\/([^"]+)"/g),
    ].map((match) => match[1]!);
    for (const name of declared) expect(parts.has(name)).toBe(true);

    for (const [name, content] of parts)
      if (name.endsWith(".xml") || name.endsWith(".rels"))
        assertWellFormedXml(new TextDecoder().decode(content), name);
  });

  it("keeps a single report sheet named for the report year", () => {
    const { workbook, name } = sheetOf(exportSampleWorkbook(buildReport()));
    expect(workbook.SheetNames).toEqual(["Tien Do Mau 2026"]);
    expect(name).toBe("Tien Do Mau 2026");
  });

  it("writes the nine columns, the summary and correct formulas", () => {
    const report = buildReport();
    const { sheet } = sheetOf(exportSampleWorkbook(report));

    expect(sheet.B1!.v).toContain("BẢNG TIẾN ĐỘ SẢN XUẤT & THEO DÕI MẪU RED DOOR 2026");
    expect(sheet.B2!.v).toBe(toExcelSerial(report.reportDate));
    expect(sheet.B4!.v).toBe("BẢNG THỐNG KÊ TỔNG HỢP");
    expect([sheet.B14!.v, sheet.E14!.v, sheet.J14!.v]).toEqual([
      "STT",
      "TRẠNG THÁI TỔNG THỂ",
      "CHI TIẾT TIẾN ĐỘ / GHI CHÚ NHẬT KÝ",
    ]);

    // The source workbook counted a fixed E15:E99 window; this one covers the
    // rows that actually exist.
    expect(sheet.C6!.f).toBe("COUNTIF($E$15:$E$16,B6)");
    expect(sheet.C10!.f).toBe("SUM(C6:C9)");
    expect(sheet.D6!.f).toBe("IF($C$10>0,C6/$C$10,0)");
    expect(sheet.D6!.z).toBe("0.0%");

    // Cached results travel with the formulas so the file reads correctly
    // before any recalculation.
    expect([sheet.C6!.v, sheet.C7!.v, sheet.C8!.v, sheet.C9!.v]).toEqual([
      0, 0, 1, 1,
    ]);
    expect(sheet.C10!.v).toBe(2);
  });

  it("scales the counted range and the autofilter to the real row count", () => {
    const rows = Array.from({ length: 40 }, (_, index) =>
      buildRow({ number: index + 1 }),
    );
    const bytes = exportSampleWorkbook(buildReport({ rows }));
    const { sheet } = sheetOf(bytes);
    expect(sheet.C6!.f).toBe("COUNTIF($E$15:$E$54,B6)");
    expect(sheet.C6!.v).toBe(40);
    expect(text(readZipParts(bytes), sheetPath)).toContain(
      '<autoFilter ref="B14:J54"/>',
    );
  });

  it("writes real dates as dates and kept wording as text", () => {
    const report = buildReport();
    const { sheet } = sheetOf(exportSampleWorkbook(report));
    expect(sheet.G15!.t).toBe("n");
    expect(sheet.G15!.v).toBe(toExcelSerial("2025-12-31"));
    expect(sheet.G15!.z).toBe("dd/mm/yyyy");
    // "Chờ gửi" is a business note, never a guessed date.
    expect(sheet.I15!.t).toBe("s");
    expect(sheet.I15!.v).toBe("Chờ gửi");
  });

  it("keeps formula-like and multi-line text as literal text", () => {
    const { sheet } = sheetOf(exportSampleWorkbook(buildReport()));
    expect(sheet.J16!.t).toBe("s");
    expect(sheet.J16!.f).toBeUndefined();
    expect(sheet.J16!.v).toContain('=HYPERLINK("http://example.test")');
    expect(sheet.J16!.v).toContain("+84 lô hàng, -2 khay, @ghi chú");
    expect(sheet.D15!.v).toBe(
      "2 tấm phẳng tranh bát giác 113x74x5 cm\n1 bộ 3 khay đáy rời tranh",
    );
  });

  it("carries the four status colours into cells and the doughnut chart", () => {
    const bytes = exportSampleWorkbook(buildReport());
    const parts = readZipParts(bytes);
    const styles = text(parts, "xl/styles.xml");
    for (const colour of ["FFFF0000", "FFFFC000", "FF92D050", "FF0070C0"])
      expect(styles).toContain(`<fgColor rgb="${colour}"/>`);

    const chart = text(parts, "xl/charts/chart1.xml");
    expect(chart).toContain("<c:doughnutChart>");
    expect(chart).toContain('<c:holeSize val="65"/>');
    for (const colour of ["FF0000", "FFC000", "92D050", "0070C0"])
      expect(chart).toContain(`<a:srgbClr val="${colour}"/>`);
    // The chart reads the summary cells, so it follows a recalculation.
    expect(chart).toContain("'Tien Do Mau 2026'!$C$6:$C$9");
    expect(chart).toContain("'Tien Do Mau 2026'!$B$6:$B$9");
    for (const label of Object.values(statusLabels))
      expect(chart).toContain(label);

    // SheetJS cannot write fills but does read them, which proves styles.xml
    // is well formed and correctly indexed.
    const { sheet } = sheetOf(bytes);
    // SheetJS reports the colour without the leading alpha byte.
    expect(sheet.B6!.s).toMatchObject({ fgColor: { rgb: "FF0000" } });
  });

  it("freezes the header, prints landscape and validates only the status column", () => {
    const parts = readZipParts(exportSampleWorkbook(buildReport()));
    const sheet = text(parts, sheetPath);
    expect(sheet).toContain('<pane ySplit="14" topLeftCell="A15"');
    expect(sheet).toContain('orientation="landscape"');
    expect(sheet).toContain('paperSize="9"');
    // The source workbook wrongly bound the status list to E:G as well.
    expect(sheet).toContain('sqref="E15:E16"');
    expect(text(parts, "xl/workbook.xml")).toContain("_xlnm.Print_Titles");
  });

  it("holds the saved report date rather than a live TODAY()", () => {
    const bytes = exportSampleWorkbook(buildReport());
    const sheetXml = text(readZipParts(bytes), sheetPath);
    expect(sheetXml).not.toContain("TODAY()");
    const { sheet } = sheetOf(bytes);
    expect(sheet.B2!.f).toBeUndefined();
  });

  it("names the file by ISO week and revision", () => {
    expect(buildReportFileName(buildReport({ revision: 2 }))).toBe(
      "Bao-cao-tien-do-mau-Red-Door-2026-W35-v2.xlsx",
    );
  });

  it("exports the same revision to identical bytes", () => {
    const report = buildReport();
    expect(Buffer.from(exportSampleWorkbook(report))).toEqual(
      Buffer.from(exportSampleWorkbook(report)),
    );
  });

  it("still produces a valid workbook with no sample rows", () => {
    const bytes = exportSampleWorkbook(buildReport({ rows: [] }));
    const parts = readZipParts(bytes);
    const { sheet } = sheetOf(bytes);
    expect(sheet.C10!.v).toBe(0);
    expect(sheet.D6!.v).toBe(0);
    expect(text(parts, sheetPath)).toContain('<autoFilter ref="B14:J15"/>');
  });
});
