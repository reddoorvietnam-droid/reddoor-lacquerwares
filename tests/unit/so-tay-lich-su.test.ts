import { describe, expect, it } from "vitest";

import { tomTatThayDoi, truongThayDoi } from "@/domains/so-tay/lich-su";

describe("Sổ tay · tóm tắt lịch sử", () => {
  it("sửa đối tượng: số + tên, trường tiếng Việt", () => {
    expect(
      tomTatThayDoi({
        col: "doituong",
        op: "Sửa",
        id: "LE_THI_NGA",
        truoc: { _id: "LE_THI_NGA", so: "B10", n: "Lê Thị Ngà", note: "cũ" },
        sau: { _id: "LE_THI_NGA", so: "B10", n: "Lê Thị Ngà", note: "mới" },
      }),
    ).toBe("Danh mục doituong: sửa B10 Lê Thị Ngà (ghi chú: cũ → mới)");
  });

  it("tạo phiếu kho", () => {
    expect(
      tomTatThayDoi({
        col: "phieukho",
        op: "Tạo mới",
        id: "PK-261116-AB12",
        sau: { _id: "PK-261116-AB12" },
      }),
    ).toBe("Phiếu kho PK-261116-AB12: tạo mới");
  });

  it("hủy kèm lý do", () => {
    expect(
      tomTatThayDoi({
        col: "congno",
        op: "Hủy",
        id: "CN-1",
        lydo: "Ghi nhầm cơ sở",
      }),
    ).toBe("Công nợ CN-1: hủy (lý do: Ghi nhầm cơ sở)");
  });

  it("giá trị trống, số, mảng đọc được", () => {
    expect(
      tomTatThayDoi({
        col: "phancong",
        op: "Sửa",
        id: "PC-1",
        truoc: { dg: 120000, han: null, ls: [] },
        sau: { dg: 135000, han: "2026-12-01", ls: [{ dg: 120000 }] },
      }),
    ).toBe(
      "Phần việc PC-1: sửa (đơn giá: 120.000 → 135.000; hạn: (trống) → 01/12/2026; lịch sử: 0 dòng → 1 dòng)",
    );
  });

  it("bỏ qua by / at và coi rỗng = không có", () => {
    expect(
      truongThayDoi(
        { _id: "x", by: "a", at: "1", note: "" },
        { _id: "x", by: "b", at: "2" },
      ),
    ).toEqual([]);
  });

  it("nhiều trường thì cắt bớt", () => {
    const truoc = { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 };
    const sau = { a: 2, b: 2, c: 2, d: 2, e: 2, f: 2, g: 2 };
    const tom = tomTatThayDoi({
      col: "vattu",
      op: "Sửa",
      id: "VT1",
      truoc,
      sau,
    });
    expect(tom.endsWith("; …)")).toBe(true);
  });
});
