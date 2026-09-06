import { describe, expect, it } from "vitest";

import { SheetCheckError } from "@/domains/sheet-checks/contracts";
import {
  decodeCsv,
  detectDelimiter,
  parseCsv,
} from "@/domains/sheet-checks/parsing/csv";

const encoder = new TextEncoder();

function utf8(text: string): Uint8Array {
  return encoder.encode(text);
}

function concat(
  ...parts: readonly (readonly number[] | Uint8Array)[]
): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function utf16le(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 2);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    out[index * 2] = code & 0xff;
    out[index * 2 + 1] = code >> 8;
  }
  return out;
}

function codes(issues: readonly { code: string }[]): string[] {
  return issues.map((entry) => entry.code);
}

describe("decodeCsv", () => {
  it("strips a UTF-8 BOM and reads the text as is", () => {
    const decoded = decodeCsv(
      concat([0xef, 0xbb, 0xbf], utf8("Khách,Số tiền\nA,1")),
    );
    expect(decoded.text).toBe("Khách,Số tiền\nA,1");
    expect(decoded.issues).toEqual([]);
  });

  it("reads plain UTF-8 without a BOM", () => {
    const decoded = decodeCsv(utf8("Công ty;1.250.000"));
    expect(decoded.text).toBe("Công ty;1.250.000");
    expect(decoded.issues).toEqual([]);
  });

  it("decodes UTF-16LE with a BOM", () => {
    const decoded = decodeCsv(concat([0xff, 0xfe], utf16le("Công ty,1")));
    expect(decoded.text).toBe("Công ty,1");
    expect(decoded.issues).toEqual([]);
  });

  it("decodes UTF-16BE with a BOM", () => {
    const be = utf16le("Ab,1");
    for (let index = 0; index < be.length; index += 2) {
      const low = be[index] ?? 0;
      be[index] = be[index + 1] ?? 0;
      be[index + 1] = low;
    }
    const decoded = decodeCsv(concat([0xfe, 0xff], be));
    expect(decoded.text).toBe("Ab,1");
  });

  it("falls back to Windows-1258 for a legacy export (or reports the encoding as unknown)", () => {
    // "Công ty" in Windows-1258: ô is 0xF4, which is not valid UTF-8 here.
    const bytes = new Uint8Array([0x43, 0xf4, 0x6e, 0x67, 0x20, 0x74, 0x79]);
    try {
      const decoded = decodeCsv(bytes);
      expect(decoded.text).toBe("Công ty");
      expect(codes(decoded.issues)).toContain("ENCODING_FALLBACK");
      expect(codes(decoded.issues)).not.toContain("ENCODING_LOSSY");
    } catch (error) {
      expect(error).toBeInstanceOf(SheetCheckError);
      expect((error as SheetCheckError).code).toBe("ENCODING_UNKNOWN");
    }
  });

  it("flags bytes no code page can read as lossy", () => {
    // 0x81 is unassigned in Windows-1258 and Windows-1252 alike.
    const bytes = new Uint8Array([0x41, 0x81, 0x42, 0xf4]);
    try {
      const decoded = decodeCsv(bytes);
      expect(decoded.text).toContain("�");
      expect(codes(decoded.issues)).toEqual(
        expect.arrayContaining(["ENCODING_FALLBACK", "ENCODING_LOSSY"]),
      );
    } catch (error) {
      expect((error as SheetCheckError).code).toBe("ENCODING_UNKNOWN");
    }
  });

  it("keeps a UTF-8 file with a BOM but broken bytes as UTF-8 and flags the loss", () => {
    const decoded = decodeCsv(
      concat([0xef, 0xbb, 0xbf], utf8("A,"), [0xff], utf8("B")),
    );
    expect(decoded.text.startsWith("A,")).toBe(true);
    expect(decoded.text).toContain("�");
    expect(codes(decoded.issues)).toEqual(["ENCODING_LOSSY"]);
  });
});

describe("detectDelimiter", () => {
  it("prefers ';' when decimal commas appear alongside it", () => {
    const text =
      "Khách;Số tiền;Ngày\nA;1.250.000,50;15/08/2026\nB;2.000,00;16/08/2026\n";
    expect(detectDelimiter(text)).toBe(";");
  });

  it("chooses the tab in a tab-separated file even with decimal commas", () => {
    const text =
      "Khách\tSố tiền\tNgày\nA\t1.250.000,50\t15/08/2026\nB\t2,5\t16/08/2026\n";
    expect(detectDelimiter(text)).toBe("\t");
  });

  it("chooses the comma in a plain file", () => {
    expect(detectDelimiter("a,b,c\n1,2,3\n4,5,6")).toBe(",");
  });

  it("chooses the pipe", () => {
    expect(detectDelimiter("a|b|c\n1|2|3")).toBe("|");
  });

  it("does not count delimiters inside quotes", () => {
    const text = 'Khách;Ghi chú;Số tiền\n"A, B";"x, y, z";1\n"C, D";"p, q";2\n';
    expect(detectDelimiter(text)).toBe(";");
  });

  it("defaults to the comma for a single-column file", () => {
    expect(detectDelimiter("a\nb\nc")).toBe(",");
  });
});

describe("parseCsv", () => {
  it("keeps quoted fields with embedded newlines and doubled quotes", () => {
    const rows = parseCsv('a,"line1\nline2 ""q""",c\n1,2,3', ",");
    expect(rows).toEqual([
      ["a", 'line1\nline2 "q"', "c"],
      ["1", "2", "3"],
    ]);
  });

  it("does not split on a delimiter inside quotes", () => {
    expect(parseCsv('x,"1,250",y', ",")).toEqual([["x", "1,250", "y"]]);
  });

  it("accepts CRLF, LF and CR-only line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r3,4\n5,6", ",")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ]);
  });

  it("normalises a CRLF inside quotes to a newline", () => {
    expect(parseCsv('"a\r\nb",c', ",")).toEqual([["a\nb", "c"]]);
  });

  it("throws CSV_MALFORMED naming the line where the quote opened", () => {
    let caught: unknown;
    try {
      parseCsv('a,b\n"open,c\n1,2', ",");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SheetCheckError);
    expect((caught as SheetCheckError).code).toBe("CSV_MALFORMED");
    expect((caught as SheetCheckError).message).toBe("line 2");
  });

  it("keeps dates, numbers and formulas as literal text", () => {
    const rows = parseCsv('08/09/2026;1.250;=HYPERLINK("http://x")\n', ";");
    expect(rows).toEqual([["08/09/2026", "1.250", '=HYPERLINK("http://x")']]);
  });

  it("keeps empty lines as rows so sheet row numbers stay aligned, without a phantom last row", () => {
    expect(parseCsv("a,b\n\n1,2\n", ",")).toEqual([
      ["a", "b"],
      [""],
      ["1", "2"],
    ]);
    expect(parseCsv("", ",")).toEqual([]);
  });

  it("keeps a trailing empty field", () => {
    expect(parseCsv("a,", ",")).toEqual([["a", ""]]);
  });

  it("treats a quote in the middle of a field as a literal character", () => {
    expect(parseCsv('5" pipe,x', ",")).toEqual([['5" pipe', "x"]]);
  });
});
