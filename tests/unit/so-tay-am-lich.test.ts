import { describe, expect, it } from "vitest";

import {
  amLich,
  canChi,
  dongNgay,
  ngayLe,
  thuTrongTuan,
} from "@/domains/so-tay/nghiep-vu/am-lich";

const am = (ngay: string) => {
  const a = amLich(ngay);
  return `${a.ngay}/${a.thang}${a.nhuan ? " nhuận" : ""} ${canChi(a.nam)}`;
};

describe("Sổ tay · âm lịch (10 ca bắt buộc mục 7.10)", () => {
  it.each([
    ["2027-02-06", "1/1 Đinh Mùi"],
    ["2026-02-17", "1/1 Bính Ngọ"],
    ["2025-01-29", "1/1 Ất Tỵ"],
    ["2024-02-10", "1/1 Giáp Thìn"],
    ["2023-01-22", "1/1 Quý Mão"],
    ["2023-03-22", "1/2 nhuận Quý Mão"],
    ["2026-09-25", "15/8 Bính Ngọ"],
    ["2026-04-26", "10/3 Bính Ngọ"],
    ["2023-04-29", "10/3 Quý Mão"],
    ["2027-02-05", "29/12 Bính Ngọ"],
  ])("%s = %s", (duong, mongDoi) => {
    expect(am(duong)).toBe(mongDoi);
  });
});

describe("Sổ tay · ngày lễ", () => {
  it("lễ dương lịch", () => {
    expect(ngayLe("2026-01-01")?.ten).toBe("Tết Dương lịch");
    expect(ngayLe("2026-04-30")?.ten).toBe("Ngày Giải phóng miền Nam");
    expect(ngayLe("2026-05-01")?.ten).toBe("Quốc tế Lao động");
    expect(ngayLe("2026-09-02")?.ten).toBe("Quốc khánh");
    // Ngày liền kề Quốc khánh không tự đánh dấu.
    expect(ngayLe("2026-09-01")).toBeNull();
    expect(ngayLe("2026-09-03")).toBeNull();
  });

  it("Tết Nguyên đán 5 ngày, tháng Chạp thiếu bắt đầu từ 29 Tết", () => {
    const tet2027 = [
      "2027-02-05",
      "2027-02-06",
      "2027-02-07",
      "2027-02-08",
      "2027-02-09",
    ];
    for (const d of tet2027) expect(ngayLe(d)?.ngan).toBe("Tết");
    expect(ngayLe("2027-02-04")).toBeNull();
    expect(ngayLe("2027-02-10")).toBeNull();
  });

  it("Tết 2026 (Chạp đủ): từ 30 Tết 16/02 đến mùng 4", () => {
    expect(ngayLe("2026-02-16")?.ten).toBe("Tết Nguyên đán (tất niên)");
    expect(ngayLe("2026-02-20")?.ten).toBe("Tết Nguyên đán (mùng 4)");
    expect(ngayLe("2026-02-15")).toBeNull();
    expect(ngayLe("2026-02-21")).toBeNull();
  });

  it("Giỗ Tổ Hùng Vương 10/3 âm", () => {
    expect(ngayLe("2026-04-26")?.ten).toBe("Giỗ Tổ Hùng Vương");
    expect(ngayLe("2023-04-29")?.ten).toBe("Giỗ Tổ Hùng Vương");
  });

  it("thứ trong tuần và dòng ngày màn hình chào", () => {
    expect(thuTrongTuan("2026-11-15")).toBe(0);
    expect(dongNgay("2026-11-17")).toMatch(
      /^Thứ Ba, 17\/11\/2026 · Âm lịch \d+\/\d+ năm Bính Ngọ$/,
    );
  });
});
