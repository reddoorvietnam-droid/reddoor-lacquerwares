import { describe, expect, it } from "vitest";

import {
  CANH_BAO_MAC_DINH,
  coQuyen,
  KHAU,
  LOAI,
  NHOM,
  QUYEN,
  TABS,
  THU_TU_COT_KHAU,
  TEN_KHAU,
  VAI_TRO,
  vaiTroSoTay,
  xemTab,
  type VaiTro,
} from "@/domains/so-tay/hang-so";

describe("Sổ tay · vai trò lấy từ khu quản trị", () => {
  it("đổi đúng từng vai trò", () => {
    expect(vaiTroSoTay(["DIRECTOR"])).toBe("quanly");
    expect(vaiTroSoTay(["FACTORY_MANAGER"])).toBe("quandoc");
    expect(vaiTroSoTay(["WAREHOUSE_MANAGER"])).toBe("thukho");
    expect(vaiTroSoTay(["FACTORY_ACCOUNTANT"])).toBe("ketoan");
    expect(vaiTroSoTay(["COMPANY_ACCOUNTANT"])).toBe("ketoancty");
  });

  it("nhiều vai trò thì lấy vai cao nhất", () => {
    expect(vaiTroSoTay(["WAREHOUSE_MANAGER", "DIRECTOR"])).toBe("quanly");
  });

  it("vai trò Giám đốc gán tay thắng vai trò khu quản trị", () => {
    expect(vaiTroSoTay(["FACTORY_MANAGER"], "qc")).toBe("qc");
    expect(vaiTroSoTay([], "qc")).toBe("qc");
    expect(vaiTroSoTay(["FACTORY_MANAGER"], "khong-co")).toBe("quandoc");
  });

  it("không có vai trò phù hợp thì không vào được", () => {
    expect(vaiTroSoTay([])).toBeNull();
    expect(vaiTroSoTay(["CONTENT_CREATOR"])).toBeNull();
  });
});

describe("Sổ tay · quyền thao tác", () => {
  it("Giám đốc có mọi quyền", () => {
    for (const viec of Object.keys(QUYEN) as Array<keyof typeof QUYEN>) {
      expect(coQuyen("quanly", viec)).toBe(true);
    }
  });

  it("chỉ Giám đốc gửi đơn mới", () => {
    for (const vai of VAI_TRO.filter((v) => v !== "quanly")) {
      expect(coQuyen(vai, "donmoi")).toBe(false);
    }
  });

  it("theo đúng bảng QUYEN", () => {
    expect(coQuyen("ketoancty", "chi")).toBe(true);
    expect(coQuyen("ketoan", "chi")).toBe(false);
    expect(coQuyen("thukho", "nhan")).toBe(true);
    expect(coQuyen("quandoc", "nhan")).toBe(true);
    expect(coQuyen("qc", "qc1")).toBe(true);
    expect(coQuyen("thukho", "congno")).toBe(false);
    expect(coQuyen(null, "kho")).toBe(false);
  });
});

describe("Sổ tay · tab", () => {
  it("đủ 15 tab, 7 + 8, mã không trùng", () => {
    expect(TABS).toHaveLength(15);
    expect(TABS.filter((t) => t.nhom === 1)).toHaveLength(7);
    expect(TABS.filter((t) => t.nhom === 2)).toHaveLength(8);
    expect(new Set(TABS.map((t) => t.ma)).size).toBe(15);
    for (const n of NHOM) {
      expect(TABS.find((t) => t.ma === n.tabChinh)?.nhom).toBe(n.ma);
    }
  });

  it("Giám đốc và hai kế toán xem mọi tab", () => {
    for (const vai of ["quanly", "ketoan", "ketoancty"] as VaiTro[]) {
      for (const t of TABS) expect(xemTab(vai, t.ma)).toBe(true);
    }
  });

  it("thủ kho không xem Công nợ sản xuất, xem Phiếu kho", () => {
    expect(xemTab("thukho", "congno")).toBe(false);
    expect(xemTab("thukho", "chi")).toBe(false);
    expect(xemTab("thukho", "kho")).toBe(true);
    expect(xemTab("thukho", "tongquan")).toBe(true);
  });

  it("QC chỉ xem tab chung và Sản xuất", () => {
    const xem = TABS.filter((t) => xemTab("qc", t.ma)).map((t) => t.ma);
    expect(xem).toEqual([
      "tongquan",
      "donhang",
      "sanxuat",
      "coso",
      "bangluong",
      "danhmuc",
    ]);
  });

  it("chưa có vai trò thì không xem tab nào", () => {
    expect(xemTab(null, "tongquan")).toBe(false);
  });
});

describe("Sổ tay · hằng số nghiệp vụ", () => {
  it("thứ tự cột khâu gồm đủ 6 khâu", () => {
    expect([...THU_TU_COT_KHAU].sort()).toEqual([...TEN_KHAU].sort());
    expect(KHAU).toHaveLength(6);
  });

  it("loại phiếu có tem đúng 3 loại", () => {
    expect(LOAI.filter((l) => "tem" in l).map((l) => l.ten)).toEqual([
      "Xuất vật tư tạm ứng đơn hàng",
      "Xuất bán cho cơ sở",
      "Bán khách lẻ",
    ]);
  });

  it("mẫu tiến độ mặc định đúng bảng 7.3", () => {
    expect(CANH_BAO_MAC_DINH.baoTruoc).toBe(3);
    expect(CANH_BAO_MAC_DINH.mau.map((m) => m.den)).toEqual([
      75, 105, 135, 9999,
    ]);
    expect(CANH_BAO_MAC_DINH.mau[2]).toEqual({
      ten: "4 tháng",
      den: 135,
      ngay: { m1: 30, m2: 45, m3: 15, m4: 15, m5: 15 },
      m5max: 15,
    });
  });
});
