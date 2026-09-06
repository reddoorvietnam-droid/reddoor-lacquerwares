import { describe, expect, it } from "vitest";

import {
  AttachmentError,
  type AttachmentErrorCode,
} from "@/domains/assistant/attachments/contracts";
import { extractDocxText } from "@/domains/assistant/attachments/docx";
import { attachmentLimits as limits } from "@/domains/assistant/attachments/limits";

import {
  buildDocx,
  buildDocxBody,
  buildZip,
} from "./helpers/attachment-fixtures";

/**
 * Word documents arrive from customers and suppliers, so the reader is
 * tested for the two things that would be silently wrong: text that loses
 * its diacritics or its structure, and an escaped angle bracket the author
 * typed being read back as markup.
 */

function expectCode(action: () => unknown, code: AttachmentErrorCode): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(AttachmentError);
  expect((caught as AttachmentError).code).toBe(code);
}

const CONTENT_TYPES = '<Types xmlns="http://example.invalid/ct"/>';

describe("extractDocxText", () => {
  it("keeps Vietnamese text with its diacritics, one line per paragraph", () => {
    const paragraphs = [
      "Công ty TNHH Sơn mài Đỏ",
      "Đơn hàng SM-2026-014 đã giao ngày 15/08/2026",
      "Người nhận: Nguyễn Thị Hoà — ký, ghi rõ họ tên",
    ];
    const result = extractDocxText(buildDocx(paragraphs));
    expect(result.text.split("\n")).toEqual(paragraphs);
    expect(result.truncated).toBe(false);
    expect(result.notes).toEqual([]);
  });

  it("decodes an XML entity only after the markup is gone, so it cannot inject a tag", () => {
    const result = extractDocxText(
      buildDocx(["<w:p>không phải là thẻ</w:p>", "Giá 100 & 200 < 400"]),
    );
    expect(result.text.split("\n")).toEqual([
      "<w:p>không phải là thẻ</w:p>",
      "Giá 100 & 200 < 400",
    ]);
  });

  it("turns tabs, breaks and table cells into the whitespace they stand for", () => {
    const body =
      "<w:p><w:r><w:t>A</w:t><w:tab/><w:t>B</w:t><w:br/><w:t>C</w:t></w:r></w:p>" +
      "<w:tbl><w:tr>" +
      "<w:tc><w:p><w:r><w:t>Mã</w:t></w:r></w:p></w:tc>" +
      "<w:tc><w:p><w:r><w:t>Số lượng</w:t></w:r></w:p></w:tc>" +
      "</w:tr><w:tr>" +
      "<w:tc><w:p><w:r><w:t>SM-01</w:t></w:r></w:p></w:tc>" +
      "<w:tc><w:p><w:r><w:t>120</w:t></w:r></w:p></w:tc>" +
      "</w:tr></w:tbl>";
    const result = extractDocxText(buildDocxBody(body));
    expect(result.text).toBe("A\tB\nC\nMã\tSố lượng\nSM-01\t120");
  });

  it("drops paragraph properties and field codes, which are not what anyone wrote", () => {
    const body =
      '<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr>' +
      '<w:r><w:instrText> HYPERLINK "https://example.invalid" </w:instrText></w:r>' +
      "<w:r><w:t>Xem hợp đồng</w:t></w:r></w:p>";
    const result = extractDocxText(buildDocxBody(body));
    expect(result.text).toBe("Xem hợp đồng");
  });

  it("collapses the run of blank paragraphs Word leaves between sections", () => {
    const result = extractDocxText(
      buildDocx(["Phần một", "", "", "", "Phần hai"]),
    );
    expect(result.text).toBe("Phần một\n\nPhần hai");
  });

  it("reads an entry stored without compression", () => {
    const bytes = buildZip([
      { name: "[Content_Types].xml", text: CONTENT_TYPES },
      {
        name: "word/document.xml",
        text: "<w:document><w:body><w:p><w:r><w:t>Đã lưu</w:t></w:r></w:p></w:body></w:document>",
        stored: true,
      },
    ]);
    expect(extractDocxText(bytes).text).toBe("Đã lưu");
  });

  it("refuses a document that carries a VBA project", () => {
    const bytes = buildDocxBody("<w:p><w:r><w:t>Chào</w:t></w:r></w:p>", [
      { name: "word/vbaProject.bin", bytes: new Uint8Array([1, 2, 3, 4]) },
    ]);
    expectCode(() => extractDocxText(bytes), "FILE_MACRO_REJECTED");
  });

  it("refuses a password-protected entry rather than handing back rubbish", () => {
    const bytes = buildZip([
      { name: "[Content_Types].xml", text: CONTENT_TYPES },
      {
        name: "word/document.xml",
        text: "<w:document><w:body><w:p><w:r><w:t>x</w:t></w:r></w:p></w:body></w:document>",
        encrypted: true,
      },
    ]);
    expectCode(() => extractDocxText(bytes), "FILE_ENCRYPTED");
  });

  it("reports a container with no document part, and a document with no text", () => {
    expectCode(
      () =>
        extractDocxText(
          buildZip([{ name: "[Content_Types].xml", text: CONTENT_TYPES }]),
        ),
      "NO_TEXT_FOUND",
    );
    expectCode(
      () => extractDocxText(buildDocxBody("<w:p><w:pPr/></w:p>")),
      "NO_TEXT_FOUND",
    );
  });

  it("stops at the block cap and says so", () => {
    const paragraphs = Array.from(
      { length: limits.maxDocxBlocks + 5 },
      () => "d",
    );
    const result = extractDocxText(buildDocx(paragraphs));
    expect(result.truncated).toBe(true);
    expect(result.notes.join(" ")).toContain(String(limits.maxDocxBlocks));
    expect(result.text.split("\n")).toHaveLength(limits.maxDocxBlocks);
  });
});
