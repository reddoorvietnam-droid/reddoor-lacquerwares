import { describe, expect, it } from "vitest";

import {
  AttachmentError,
  type AttachmentErrorCode,
} from "@/domains/assistant/attachments/contracts";
import {
  detectAttachmentFormat,
  isAcceptedExtension,
} from "@/domains/assistant/attachments/detect";

import {
  buildCsv,
  buildDocx,
  buildPng,
  buildXlsx,
} from "./helpers/attachment-fixtures";

/**
 * The accept list is not the guard: what the file is called never decides
 * what it is. These tests hold the line the whole attachment path depends
 * on — a file renamed to slip past the picker is refused, not guessed at.
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

const pdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<< >>\n");
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a]);
const gif = new TextEncoder().encode("GIF89a...");
const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

describe("detectAttachmentFormat", () => {
  it("types every accepted format by its magic number", () => {
    expect(detectAttachmentFormat(buildXlsx([["a"]]), "So sach.xlsx")).toBe(
      "xlsx",
    );
    expect(detectAttachmentFormat(buildDocx(["a"]), "Hop dong.DOCX")).toBe(
      "docx",
    );
    expect(detectAttachmentFormat(buildCsv("a,b\n1,2"), "danh sach.csv")).toBe(
      "csv",
    );
    expect(detectAttachmentFormat(buildCsv("a\tb"), "ghi chu.txt")).toBe("csv");
    expect(detectAttachmentFormat(pdf, "bao gia.pdf")).toBe("pdf");
    expect(detectAttachmentFormat(buildPng(), "anh.png")).toBe("png");
    expect(detectAttachmentFormat(jpeg, "anh.jpg")).toBe("jpeg");
    expect(detectAttachmentFormat(jpeg, "anh.jpeg")).toBe("jpeg");
    expect(detectAttachmentFormat(gif, "anh.gif")).toBe("gif");
    expect(detectAttachmentFormat(webp, "anh.webp")).toBe("webp");
  });

  it("refuses a renamed file instead of guessing what it holds", () => {
    const png = buildPng();
    expectCode(
      () => detectAttachmentFormat(png, "bao cao.xlsx"),
      "FILE_TYPE_REJECTED",
    );
    expectCode(
      () => detectAttachmentFormat(png, "bao cao.csv"),
      "FILE_TYPE_REJECTED",
    );
    expectCode(
      () => detectAttachmentFormat(png, "anh.jpg"),
      "FILE_TYPE_REJECTED",
    );
    expectCode(
      () => detectAttachmentFormat(buildXlsx([["a"]]), "so sach.csv"),
      "FILE_TYPE_REJECTED",
    );
    expectCode(
      () => detectAttachmentFormat(buildXlsx([["a"]]), "so sach.pdf"),
      "FILE_TYPE_REJECTED",
    );
    expectCode(
      () => detectAttachmentFormat(pdf, "bao gia.png"),
      "FILE_TYPE_REJECTED",
    );
    expectCode(
      () => detectAttachmentFormat(buildCsv("a,b"), "danh sach.xlsx"),
      "FILE_TYPE_REJECTED",
    );
  });

  it("refuses a macro-enabled container before anything opens it", () => {
    const zip = buildXlsx([["a"]]);
    expectCode(
      () => detectAttachmentFormat(zip, "so sach.xlsm"),
      "FILE_MACRO_REJECTED",
    );
    expectCode(
      () => detectAttachmentFormat(zip, "mau.xltm"),
      "FILE_MACRO_REJECTED",
    );
    expectCode(
      () => detectAttachmentFormat(buildDocx(["a"]), "hop dong.docm"),
      "FILE_MACRO_REJECTED",
    );
  });

  it("reads a text file as csv only while it carries no NUL byte", () => {
    const binary = new Uint8Array([0x61, 0x2c, 0x62, 0x00, 0x31]);
    expectCode(
      () => detectAttachmentFormat(binary, "danh sach.csv"),
      "FILE_TYPE_REJECTED",
    );
    expectCode(
      () => detectAttachmentFormat(binary, "ghi chu.txt"),
      "FILE_TYPE_REJECTED",
    );
  });

  it("refuses a format that is not on the list at all", () => {
    const zipButOds = buildXlsx([["a"]]);
    expectCode(
      () => detectAttachmentFormat(zipButOds, "bang.ods"),
      "FILE_TYPE_REJECTED",
    );
    expectCode(
      () =>
        detectAttachmentFormat(new Uint8Array([0x4d, 0x5a, 0x90]), "setup.exe"),
      "FILE_TYPE_REJECTED",
    );
    expectCode(
      () => detectAttachmentFormat(buildCsv("a,b"), "khong-duoi"),
      "FILE_TYPE_REJECTED",
    );
  });
});

describe("isAcceptedExtension", () => {
  it("answers the accept list the picker shows, case-insensitively", () => {
    for (const name of [
      "a.xlsx",
      "a.XLS",
      "a.csv",
      "a.txt",
      "a.pdf",
      "a.Docx",
      "a.png",
      "a.JPG",
      "a.jpeg",
      "a.webp",
      "a.gif",
    ]) {
      expect(isAcceptedExtension(name)).toBe(true);
    }
    for (const name of ["a.xlsm", "a.docm", "a.zip", "a.exe", "a.heic", "a"]) {
      expect(isAcceptedExtension(name)).toBe(false);
    }
  });
});
