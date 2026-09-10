import { describe, expect, it } from "vitest";
import {
  readVietnameseInteger,
  vndInWords,
} from "@/lib/money/vietnamese-words";

describe("VND amounts in words", () => {
  it.each([
    ["0", "Không đồng"],
    ["1", "Một đồng"],
    ["15", "Mười lăm đồng"],
    ["21", "Hai mươi mốt đồng"],
    ["24", "Hai mươi tư đồng"],
    ["105", "Một trăm linh năm đồng"],
    ["1000", "Một nghìn đồng"],
    ["10000", "Mười nghìn đồng"],
    ["105000", "Một trăm linh năm nghìn đồng"],
    ["865000", "Tám trăm sáu mươi lăm nghìn đồng"],
    ["1000000", "Một triệu đồng"],
    ["1005000", "Một triệu không trăm linh năm nghìn đồng"],
    ["1050000", "Một triệu không trăm năm mươi nghìn đồng"],
    ["3560000", "Ba triệu năm trăm sáu mươi nghìn đồng"],
    ["10700000", "Mười triệu bảy trăm nghìn đồng"],
    ["1000000000", "Một tỷ đồng"],
    ["1000001000", "Một tỷ không trăm linh một nghìn đồng"],
    [
      "1234567890123",
      "Một nghìn hai trăm ba mươi tư tỷ năm trăm sáu mươi bảy triệu tám trăm chín mươi nghìn một trăm hai mươi ba đồng",
    ],
  ])("reads %s", (amount, words) => {
    expect(vndInWords(amount)).toBe(words);
  });

  it("rounds half-up to whole đồng and accepts canonical decimals", () => {
    expect(vndInWords("40000.4")).toBe("Bốn mươi nghìn đồng");
    expect(vndInWords("40000.5")).toBe(
      "Bốn mươi nghìn không trăm linh một đồng",
    );
    expect(vndInWords("-5")).toBe("Âm năm đồng");
  });

  it("refuses anything that is not a digit string", () => {
    expect(() => readVietnameseInteger("12a")).toThrow();
    expect(() => vndInWords("abc")).toThrow();
  });
});
