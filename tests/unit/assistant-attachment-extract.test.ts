import { describe, expect, it } from "vitest";

import {
  AttachmentError,
  type AttachmentErrorCode,
} from "@/domains/assistant/attachments/contracts";
import {
  extractAttachment,
  extractAttachments,
} from "@/domains/assistant/attachments/extract";
import { attachmentLimits as limits } from "@/domains/assistant/attachments/limits";

import {
  buildCsv,
  buildDocx,
  buildPng,
  buildXlsx,
} from "./helpers/attachment-fixtures";

/**
 * The door every upload goes through: the caps, the image branch, and the
 * turn-wide text budget that three separately legal files can still blow.
 *
 * PDF text extraction is not covered here on purpose. Asserting it would
 * need a real PDF binary, and this repository commits none; only the error
 * mapping is tested, with bytes that merely start like a PDF. Reading an
 * actual PDF is verified by hand against a real document.
 */

async function expectCode(
  action: () => Promise<unknown>,
  code: AttachmentErrorCode,
): Promise<void> {
  let caught: unknown;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(AttachmentError);
  expect((caught as AttachmentError).code).toBe(code);
}

/** A csv whose rendered grid is far longer than one attachment may keep. */
function longCsv(): Uint8Array {
  const cell = "x".repeat(limits.maxSheetCellChars);
  const row = Array.from({ length: 5 }, () => cell).join(",");
  return buildCsv(Array.from({ length: 200 }, () => row).join("\n"));
}

describe("extractAttachment", () => {
  it("hands an image to the model as bytes, because no parser can read one", async () => {
    const png = buildPng();
    const result = await extractAttachment({
      bytes: png,
      fileName: "phieu giao hang.png",
    });
    expect(result).toMatchObject({
      fileName: "phieu giao hang.png",
      format: "png",
      kind: "image",
      byteSize: png.length,
      text: null,
      notes: [],
      truncated: false,
    });
    expect(result.image?.mediaType).toBe("image/png");
    expect(
      new Uint8Array(Buffer.from(result.image?.base64 ?? "", "base64")),
    ).toEqual(png);
  });

  it("reads a spreadsheet and a Word document as text, never as bytes", async () => {
    const sheet = await extractAttachment({
      bytes: buildXlsx([
        ["Mã đơn", "Số tiền"],
        ["SM-2026-014", "25000000"],
      ]),
      fileName: "don hang.xlsx",
    });
    expect(sheet.kind).toBe("spreadsheet");
    expect(sheet.image).toBeNull();
    expect(sheet.text).toContain("SM-2026-014");

    const document = await extractAttachment({
      bytes: buildDocx(["Biên bản nghiệm thu"]),
      fileName: "bien ban.docx",
    });
    expect(document.kind).toBe("document");
    expect(document.format).toBe("docx");
    expect(document.text).toBe("Biên bản nghiệm thu");
    expect(document.image).toBeNull();
  });

  it("refuses an empty file and one past the byte cap before reading it", async () => {
    await expectCode(
      () => extractAttachment({ bytes: new Uint8Array(0), fileName: "a.csv" }),
      "FILE_EMPTY",
    );
    await expectCode(
      () =>
        extractAttachment({
          bytes: new Uint8Array(limits.maxFileBytes + 1),
          fileName: "lon.csv",
        }),
      "FILE_TOO_LARGE",
    );
  });

  it("holds an image to its own tighter cap, because base64 inflates it", async () => {
    const png = buildPng(limits.maxImageBytes);
    expect(png.length).toBeGreaterThan(limits.maxImageBytes);
    expect(png.length).toBeLessThan(limits.maxFileBytes);
    await expectCode(
      () => extractAttachment({ bytes: png, fileName: "anh.png" }),
      "FILE_TOO_LARGE",
    );
  });

  it("maps a PDF it cannot parse to a parse failure, not to a crash", async () => {
    await expectCode(
      () =>
        extractAttachment({
          bytes: buildCsv("%PDF-1.4\nnot in fact a document\n"),
          fileName: "hoa don.pdf",
        }),
      "FILE_PARSE_FAILED",
    );
  }, 30_000);
});

describe("extractAttachments", () => {
  it("refuses more files than one turn may carry", async () => {
    const files = Array.from({ length: limits.maxFilesPerTurn + 1 }, () => ({
      bytes: buildCsv("a,b\n1,2"),
      fileName: "a.csv",
    }));
    await expectCode(() => extractAttachments(files), "TOO_MANY_FILES");
  });

  it("refuses a set whose total size is past the cap even when each file is legal", async () => {
    const each = new Uint8Array(3 * 1024 * 1024);
    expect(each.length).toBeLessThan(limits.maxFileBytes);
    await expectCode(
      () =>
        extractAttachments([
          { bytes: each, fileName: "a.csv" },
          { bytes: each, fileName: "b.csv" },
          { bytes: each, fileName: "c.csv" },
        ]),
      "FILE_TOO_LARGE",
    );
  });

  it("trims the later attachments once the turn's text budget is spent", async () => {
    const results = await extractAttachments([
      { bytes: longCsv(), fileName: "mot.csv" },
      { bytes: longCsv(), fileName: "hai.csv" },
      { bytes: longCsv(), fileName: "ba.csv" },
    ]);
    expect(results).toHaveLength(3);
    expect(results[0]?.text).toHaveLength(limits.maxTextChars);
    expect(results[1]?.text).toHaveLength(limits.maxTextChars);
    expect(results[2]?.text).toBe("");
    expect(results[2]?.truncated).toBe(true);
    expect(results[2]?.notes.join(" ")).toContain("tổng văn bản");
  });

  it("keeps a small set whole", async () => {
    const results = await extractAttachments([
      { bytes: buildCsv("Mã,Số tiền\nSM-01,10"), fileName: "mot.csv" },
      { bytes: buildPng(), fileName: "hai.png" },
    ]);
    expect(results[0]?.truncated).toBe(false);
    expect(results[0]?.text).toContain("SM-01");
    expect(results[1]?.text).toBeNull();
    expect(results[1]?.image?.mediaType).toBe("image/png");
  });
});
