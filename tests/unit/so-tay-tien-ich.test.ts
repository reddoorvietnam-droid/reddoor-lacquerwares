import { describe, expect, it } from "vitest";

import {
  addDays,
  daysTo,
  dvn,
  fm,
  fq,
  laNgay,
  rid,
  slug,
  today,
} from "@/domains/so-tay/tien-ich";

describe("Sổ tay · tiện ích ngày", () => {
  it("today() theo giờ Việt Nam, không theo giờ máy", () => {
    // 17:30 UTC ngày 16/11 = 00:30 ngày 17/11 ở Hà Nội.
    expect(today(new Date("2026-11-16T17:30:00Z"))).toBe("2026-11-17");
    expect(today(new Date("2026-11-16T16:59:59Z"))).toBe("2026-11-16");
  });

  it("addDays qua tháng, qua năm, năm nhuận, số âm", () => {
    expect(addDays("2026-11-17", 56)).toBe("2027-01-12");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("daysTo có dấu", () => {
    expect(daysTo("2026-11-17", "2026-11-20")).toBe(3);
    expect(daysTo("2026-11-20", "2026-11-17")).toBe(-3);
    expect(daysTo("2026-01-01", "2027-01-01")).toBe(365);
  });

  it("laNgay chặn ngày không có thật", () => {
    expect(laNgay("2026-02-28")).toBe(true);
    expect(laNgay("2026-02-29")).toBe(false);
    expect(laNgay("2026-13-01")).toBe(false);
    expect(laNgay("17/11/2026")).toBe(false);
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
  });

  it("dvn hiển thị dd/mm/yyyy", () => {
    expect(dvn("2026-11-17")).toBe("17/11/2026");
    expect(dvn("2026-11-16T17:30:00Z")).toBe("17/11/2026");
    expect(dvn(null)).toBe("");
    expect(dvn("sai")).toBe("");
  });
});

describe("Sổ tay · định dạng số", () => {
  it("fm định dạng tiền Việt Nam", () => {
    expect(fm(1234567)).toBe("1.234.567");
    expect(fm(0)).toBe("0");
    expect(fm(-25000000)).toBe("-25.000.000");
    expect(fm(-0.4)).toBe("0");
    expect(fm(undefined)).toBe("");
  });

  it("fq tối đa 3 chữ số thập phân, dấu phẩy thập phân", () => {
    expect(fq(1234.5)).toBe("1.234,5");
    expect(fq(0.75)).toBe("0,75");
    expect(fq(1.23456)).toBe("1,235");
    expect(fq(12)).toBe("12");
  });
});

describe("Sổ tay · mã", () => {
  it("slug bỏ dấu, viết hoa, nối bằng _", () => {
    expect(slug("Lê Thị Ngà")).toBe("LE_THI_NGA");
    expect(slug("  Đỗ Đức  Độ ")).toBe("DO_DUC_DO");
    expect(slug("Công ty CP In Ecoprint")).toBe("CONG_TY_CP_IN_ECOPRINT");
    expect(slug("Trần Quang Hiếu (C04)")).toBe("TRAN_QUANG_HIEU_C04");
  });

  it("rid có dạng TIỀNTỐ-yymmdd-XXXX theo ngày Việt Nam", () => {
    const ma = rid("PK", new Date("2026-11-15T18:00:00Z"));
    expect(ma).toMatch(/^PK-261116-[A-Z2-9]{4}$/);
    const nhieu = new Set(Array.from({ length: 200 }, () => rid("DN")));
    expect(nhieu.size).toBeGreaterThan(190);
  });
});
