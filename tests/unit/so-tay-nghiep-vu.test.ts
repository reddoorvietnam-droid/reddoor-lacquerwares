import { describe, expect, it } from "vitest";

import type { DuLieu, PhanCong, SanXuat } from "@/domains/so-tay/kieu";
import { taoChiMuc } from "@/domains/so-tay/nghiep-vu/chi-muc";
import {
  canDuyet,
  canhBaoChiaNho,
  quyXuong,
  tongTheoLoai,
} from "@/domains/so-tay/nghiep-vu/chi-xuong";
import { congNoTheoCap, noTienSon } from "@/domains/so-tay/nghiep-vu/cong-no";
import {
  soLoai,
  soMoi,
  soSauKhiSua,
} from "@/domains/so-tay/nghiep-vu/danh-muc";
import { docPi, tachKichThuoc } from "@/domains/so-tay/nghiep-vu/doc-pi";
import {
  butToanGhiHopDong,
  coTamUng,
  mucTamUng,
  sxCalc,
} from "@/domains/so-tay/nghiep-vu/hop-dong";
import { stat, tonKho } from "@/domains/so-tay/nghiep-vu/kho";
import {
  khauXong,
  mocDon,
  quaHan,
  tinZalo,
} from "@/domains/so-tay/nghiep-vu/tien-do";
import { addDays } from "@/domains/so-tay/tien-ich";

const don = (ngayxuat: string, them: Partial<SanXuat> = {}): SanXuat => ({
  _id: "2026-01",
  dh: "2026-01",
  khach: "K",
  ngayxuat,
  tt: "nhan",
  nhan: { at: "2026-01-01T03:00:00Z" },
  items: [{ ma: "A", qty: 10 }],
  ...them,
});

const pcMoc: PhanCong = {
  _id: "PC1",
  dh: "2026-01",
  ma: "A",
  khau: "Mộc",
  dt: "MOC1",
  sl: 10,
  dg: 100_000,
};

describe("Sổ tay · mocDon (mẫu tiến độ)", () => {
  it.each([
    [70, "2 tháng"],
    [75, "2 tháng"],
    [100, "3 tháng"],
    [130, "4 tháng"],
    [200, "5 tháng"],
  ])("%i ngày từ mốc gốc tới ngày xuất → mẫu %s", (soNgay, mau) => {
    const cm = taoChiMuc(
      { sanxuat: [don(addDays("2026-01-01", soNgay))] },
      "2026-01-02",
    );
    expect(mocDon(cm, cm.sx.get("2026-01") as SanXuat).mau.ten).toBe(mau);
  });

  it("mốc gốc là ngày ký hợp đồng mộc, hạn m1 = ký + số ngày mẫu", () => {
    const cm = taoChiMuc(
      {
        sanxuat: [don("2026-03-10")],
        phancong: [pcMoc],
        hopdong: [
          {
            _id: "2026-01~MOC1",
            dh: "2026-01",
            dt: "MOC1",
            so: "HD1",
            ngay: "2026-01-05",
            gt: 1_000_000,
          },
        ],
      },
      "2026-01-06",
    );
    const td = mocDon(cm, cm.sx.get("2026-01") as SanXuat);
    expect(td.goc).toBe("2026-01-05");
    expect(td.mau.ten).toBe("2 tháng");
    expect(td.moc[0]?.han).toBe("2026-01-20");
    expect(td.mocCS[0]).toMatchObject({
      dt: "MOC1",
      han: "2026-01-20",
      can: 10,
      da: 0,
    });
  });

  it("mốc trước trễ thì mốc sau dời tới hôm nay", () => {
    const cm = taoChiMuc({ sanxuat: [don("2026-03-10")] }, "2026-01-20");
    const td = mocDon(cm, cm.sx.get("2026-01") as SanXuat);
    // Mốc gốc = ngày nhận 01/01, mẫu 2 tháng: m1 hạn 16/01, hôm nay 20/01.
    expect(td.moc[0]).toMatchObject({ han: "2026-01-16", muc: "do", qua: 4 });
    expect(td.moc[1]).toMatchObject({
      batDau: "2026-01-20",
      han: "2026-02-09",
      muc: "xanh",
    });
    expect(td.muc).toBe("do");
  });

  it("đủ hàng giao thì mốc xong theo ngày giao cuối; không có mã in thì m3 xong cùng m2", () => {
    const pcHt: PhanCong = {
      _id: "PC2",
      dh: "2026-01",
      ma: "A",
      khau: "Hoàn thiện (sơn)",
      dt: "HT1",
      sl: 10,
      dg: 50_000,
    };
    const cm = taoChiMuc(
      {
        sanxuat: [don("2026-03-10")],
        phancong: [pcMoc, pcHt],
        giaohang: [
          { _id: "G1", pc: "PC1", ngay: "2026-01-10", sl: 6 },
          { _id: "G2", pc: "PC1", ngay: "2026-01-12", sl: 4 },
          { _id: "G3", pc: "PC2", ngay: "2026-01-25", sl: 10 },
        ],
      },
      "2026-01-26",
    );
    const sx = cm.sx.get("2026-01") as SanXuat;
    expect(khauXong(cm, sx, "Mộc")).toBe("2026-01-12");
    expect(khauXong(cm, sx, "In tại nhà máy")).toBe("khong");
    const td = mocDon(cm, sx);
    expect(td.moc[0]?.tt).toBe("2026-01-12");
    expect(td.moc[1]?.batDau).toBe("2026-01-12");
    expect(td.moc[2]?.tt).toBe("2026-01-25");
  });

  it("m5: quá hạn chuẩn báo vàng, quá hạn tối đa mới báo đỏ", () => {
    const sx = don("2026-12-31", {
      mau: "2 tháng",
      moc: { m1: "2026-01-01", m2: "2026-01-01", m3: "2026-01-01" },
      qc1: { ngay: "2026-01-01" },
    });
    // 2 tháng: m5 = 5 ngày, tối đa 10 → hạn 06/01, tối đa 11/01.
    const cm1 = taoChiMuc({ sanxuat: [sx] }, "2026-01-08");
    expect(mocDon(cm1, sx).moc[4]).toMatchObject({
      han: "2026-01-06",
      hanMax: "2026-01-11",
      muc: "vang",
    });
    const cm2 = taoChiMuc({ sanxuat: [sx] }, "2026-01-12");
    expect(mocDon(cm2, sx).moc[4]).toMatchObject({ muc: "do", qua: 1 });
  });

  it("quá hạn gom việc và sinh tin Zalo", () => {
    const cm = taoChiMuc(
      {
        sanxuat: [don("2026-01-15")],
        donhang: [{ _id: "2026-01", c: "2026-01", n: "Đơn thử" }],
      },
      "2026-01-20",
    );
    const ds = quaHan(cm);
    expect(ds[0]).toMatchObject({
      viec: "Ngày xuất hàng theo PI",
      qua: 5,
      phutrach: "Giám đốc",
    });
    const tin = tinZalo(ds, "2026-01-20");
    expect(tin.startsWith("⚠ QUÁ HẠN SẢN XUẤT 20/01/2026")).toBe(true);
    expect(tin).toContain("📦 2026-01 Đơn thử");
    expect(tin.endsWith(`Tổng: ${ds.length} việc quá hạn.`)).toBe(true);
  });
});

describe("Sổ tay · tạm ứng và hợp đồng", () => {
  it("30% làm tròn xuống triệu", () => {
    expect(mucTamUng(86_190_000)).toBe(25_000_000);
    expect(mucTamUng(57_150_000)).toBe(17_000_000);
    expect(mucTamUng(3_000_000)).toBe(0);
    expect(mucTamUng(0)).toBe(0);
  });

  it("ai được tạm ứng", () => {
    expect(
      coTamUng({
        byCP: { "Chi phí hoàn thiện": 5_000_000 },
        gt: 5_000_000,
        dt: "X",
      }),
    ).toBe(true);
    expect(
      coTamUng({
        byCP: { "Chi phí làm mộc": 10_000_000 },
        gt: 10_000_000,
        dt: "X",
      }),
    ).toBe(false);
    expect(
      coTamUng({
        byCP: { "Chi phí làm mộc": 10_000_001 },
        gt: 10_000_001,
        dt: "X",
      }),
    ).toBe(true);
    expect(
      coTamUng({
        byCP: { "Chi phí bao bì": 50_000_000 },
        gt: 50_000_000,
        dt: "TRAN_QUANG_HIEU",
      }),
    ).toBe(true);
    expect(
      coTamUng({
        byCP: { "Chi phí bao bì": 50_000_000 },
        gt: 50_000_000,
        dt: "CONG_TY_CP_IN_ECOPRINT",
      }),
    ).toBe(true);
    expect(
      coTamUng({
        byCP: { "Chi phí bao bì": 50_000_000 },
        gt: 50_000_000,
        dt: "CO_SO_KHAC",
      }),
    ).toBe(false);
  });

  it("hợp đồng: Nhập kho nhà máy làm thay ghi âm vào cơ sở hoàn thiện; còn phải trả trừ vật tư cấp", () => {
    const du: DuLieu = {
      sanxuat: [don("2026-03-10")],
      phancong: [
        {
          _id: "P1",
          dh: "2026-01",
          ma: "A",
          khau: "Hoàn thiện (sơn)",
          dt: "HT1",
          sl: 100,
          dg: 861_900,
        },
        {
          _id: "P2",
          dh: "2026-01",
          ma: "A",
          khau: "Nhập kho",
          dt: "NV1",
          tru: "HT1",
          sl: 100,
          dg: 5_000,
        },
      ],
      hopdong: [
        {
          _id: "2026-01~HT1",
          dh: "2026-01",
          dt: "HT1",
          so: "HD7",
          ngay: "2026-01-03",
          gt: 85_690_000,
        },
      ],
      congno: [
        {
          _id: "C1",
          ngay: "2026-01-04",
          dh: "2026-01",
          dt: "HT1",
          cp: "Chi phí hoàn thiện",
          nv: "Giá trị hợp đồng",
          tien: 85_690_000,
          nguon: "hopdong",
        },
        {
          _id: "C2",
          ngay: "2026-01-05",
          dh: "2026-01",
          dt: "HT1",
          nv: "Tạm ứng",
          tien: 25_000_000,
        },
      ],
      phieukho: [
        {
          _id: "PK1",
          so: "PK1",
          ngay: "2026-01-06",
          loai: "Xuất vật tư tạm ứng đơn hàng",
          dt: "HT1",
          dh: "2026-01",
          dong: [{ vt: "S1", sl: 10, dg: 100_000 }],
        },
      ],
    };
    const h = sxCalc(taoChiMuc(du, "2026-01-10"), "2026-01", "HT1");
    expect(h.gt).toBe(86_190_000 - 500_000);
    expect(h.byCP["Chi phí hoàn thiện"]).toBe(85_690_000);
    expect(h.daKy && !h.doiGia && !h.choGhi).toBe(true);
    expect(h.conPhaiTra).toBe(85_690_000 - 25_000_000 - 1_000_000);
    expect(h.coTamUng).toBe(true);
    // 30% của 85.690.000 = 25.707.000 − đã ứng 25.000.000 → 0 (làm tròn xuống triệu).
    expect(h.deNghiUng).toBe(0);
    expect(
      sxCalc(taoChiMuc(du, "2026-01-10"), "2026-01", "NV1").pcs,
    ).toHaveLength(0);
  });

  it("đổi giá sau ký: chênh ghi điều chỉnh", () => {
    const du: DuLieu = {
      phancong: [
        {
          _id: "P1",
          dh: "D",
          ma: "A",
          khau: "Mộc",
          dt: "M",
          sl: 10,
          dg: 120_000,
        },
      ],
      hopdong: [
        {
          _id: "D~M",
          dh: "D",
          dt: "M",
          so: "1",
          ngay: "2026-01-01",
          gt: 1_000_000,
        },
      ],
      congno: [
        {
          _id: "C",
          ngay: "2026-01-01",
          dh: "D",
          dt: "M",
          cp: "Chi phí làm mộc",
          nv: "Giá trị hợp đồng",
          tien: 1_000_000,
          nguon: "hopdong",
        },
      ],
    };
    const h = sxCalc(taoChiMuc(du), "D", "M");
    expect(h.doiGia).toBe(true);
    expect(butToanGhiHopDong(h)).toEqual([
      {
        cp: "Chi phí làm mộc",
        nv: "Điều chỉnh tăng",
        tien: 200_000,
        lanDau: false,
      },
    ]);
  });
});

describe("Sổ tay · công nợ theo dấu nghiệp vụ", () => {
  const du: DuLieu = {
    sodu: {
      _id: "sodu",
      ngay: "2026-01-01",
      cn: [{ d: "X", o: "D", hd: 100, tra: 30 }],
      son: [{ d: "X", amt: 100 }],
      tamtinh: [{ o: "D", tien: 999 }],
    },
    congno: [
      {
        _id: "1",
        ngay: "2026-01-02",
        dh: "D",
        dt: "X",
        nv: "Giá trị hợp đồng",
        tien: 50,
      },
      {
        _id: "2",
        ngay: "2026-01-02",
        dh: "D",
        dt: "X",
        nv: "Tạm ứng",
        tien: 20,
      },
      {
        _id: "3",
        ngay: "2026-01-02",
        dh: "D",
        dt: "X",
        nv: "Điều chỉnh giảm",
        tien: 5,
      },
      {
        _id: "4",
        ngay: "2026-01-02",
        dh: "D",
        dt: "X",
        nv: "Trừ sơn / gỗ (bảng kê)",
        tien: 30,
      },
      {
        _id: "5",
        ngay: "2026-01-02",
        dh: "D",
        dt: "X",
        nv: "Thanh toán",
        tien: 1,
        huy: { lydo: "nhầm" },
      },
    ],
    phieukho: [
      {
        _id: "P",
        so: "P",
        ngay: "2026-01-03",
        loai: "Xuất vật tư tạm ứng đơn hàng",
        dt: "X",
        dh: "D",
        dong: [{ vt: "V", sl: 1, dg: 10 }],
      },
      {
        _id: "Q",
        so: "Q",
        ngay: "2026-01-03",
        loai: "Xuất bán cho cơ sở",
        dt: "X",
        dh: "D",
        dong: [{ vt: "V", sl: 2, dg: 50 }],
      },
    ],
    thutien: [{ _id: "T", ngay: "2026-01-04", dt: "X", tien: 20 }],
  };

  it("RD còn nợ = chốt + bút toán theo dấu − vật tư cấp; bỏ bút toán đã hủy; tạm tính không cộng", () => {
    const [c] = congNoTheoCap(taoChiMuc(du));
    // 70 + 50 − 20 − 5 − 30 − 10 = 55
    expect(c).toMatchObject({ dh: "D", dt: "X", vtCap: 10, conNo: 55 });
  });

  it("nợ tiền sơn = chốt + phiếu bán − trừ sơn − phiếu thu", () => {
    expect(noTienSon(taoChiMuc(du)).get("X")).toBe(100 + 100 - 30 - 20);
  });
});

describe("Sổ tay · số định danh", () => {
  const ds = [
    { _id: "b1", so: "B01" },
    { _id: "b3", so: "B03" },
    { _id: "a2", so: "A02" },
    { _id: "e10", so: "E10" },
    { _id: "khong" },
  ];
  it("soLoai theo nhóm / loại", () => {
    expect(soLoai({ g: "Mộc", l: "Cơ sở gia công" })).toBe("A");
    expect(soLoai({ g: "Vóc", l: "Cơ sở gia công" })).toBe("A");
    expect(soLoai({ g: "Hoàn thiện", l: "Cơ sở gia công" })).toBe("B");
    expect(soLoai({ g: "Bao bì", l: "Nhà cung cấp" })).toBe("C");
    expect(soLoai({ g: "Vận chuyển", l: "Dịch vụ" })).toBe("E");
    expect(soLoai({ g: "Vật tư", l: "Nhà cung cấp" })).toBe("D");
    expect(soLoai({ g: "Chưa rõ", l: "Nhà cung cấp" })).toBeNull();
    expect(
      soLoai({ g: "In, mẫu, hoàn thiện mẫu", l: "Nhân sự nhà máy" }),
    ).toBeNull();
    expect(
      soLoai({ g: "Hoàn thiện", l: "Cơ sở gia công", luu: true }),
    ).toBeNull();
  });
  it("số mới = lớn nhất + 1, không dồn số trống", () => {
    expect(soMoi("B", ds)).toBe("B04");
    expect(soMoi("E", ds)).toBe("E11");
    expect(soMoi("C", ds)).toBe("C01");
  });
  it("sửa cùng nhóm giữ số, đổi nhóm cấp số mới", () => {
    const cu = {
      _id: "X",
      so: "B03",
      g: "Hoàn thiện",
      l: "Cơ sở gia công" as const,
    };
    expect(
      soSauKhiSua(cu, { g: "Hoàn thiện", l: "Cơ sở gia công" }, [...ds, cu]),
    ).toBe("B03");
    expect(
      soSauKhiSua(cu, { g: "Mộc", l: "Cơ sở gia công" }, [...ds, cu]),
    ).toBe("A03");
    expect(
      soSauKhiSua(cu, { g: "Hoàn thiện", l: "Cơ sở gia công", luu: true }, [
        ...ds,
        cu,
      ]),
    ).toBeUndefined();
  });
});

describe("Sổ tay · tồn kho", () => {
  it("tồn = đầu kỳ + nhập − xuất sau ngày chốt, bỏ phiếu hủy", () => {
    const ton = tonKho(
      [{ _id: "V", c: "V", t: 10, y: 400, r: 200 }],
      [
        {
          _id: "1",
          so: "1",
          ngay: "2026-01-02",
          loai: "Nhập mua",
          dong: [{ vt: "V", sl: 5 }],
        },
        {
          _id: "2",
          so: "2",
          ngay: "2026-01-03",
          loai: "Xuất bán cho cơ sở",
          dong: [{ vt: "V", sl: 3 }],
        },
        {
          _id: "3",
          so: "3",
          ngay: "2026-01-03",
          loai: "Xuất dùng nội bộ",
          dong: [{ vt: "V", sl: 100 }],
          huy: { lydo: "x" },
        },
        {
          _id: "4",
          so: "4",
          ngay: "2026-01-01",
          loai: "Nhập mua",
          dong: [{ vt: "V", sl: 1000 }],
        },
      ],
      "2026-01-01",
    );
    expect(ton.get("V")).toBe(12);
  });
  it("mức cảnh báo", () => {
    expect(stat(-1, { y: 400, r: 200 })).toBe("am");
    expect(stat(150, { y: 400, r: 200 })).toBe("do");
    expect(stat(300, { y: 400, r: 200 })).toBe("vang");
    expect(stat(500, { y: 400, r: 200 })).toBe("ok");
    expect(stat(1, {})).toBe("ok");
  });
});

describe("Sổ tay · chi tiêu xưởng", () => {
  it("ngưỡng 1 triệu", () => {
    expect(canDuyet(999_999)).toBe(false);
    expect(canDuyet(1_000_000)).toBe(true);
  });
  it("cảnh báo chia nhỏ: cùng ngày, cùng người nhận, cộng ≥ 1 triệu", () => {
    const ds = [
      {
        _id: "1",
        kieu: "chi" as const,
        ngay: "2026-01-02",
        tien: 600_000,
        nguoinhan: "Anh Tú",
        tt: "dachi" as const,
      },
      {
        _id: "2",
        kieu: "chi" as const,
        ngay: "2026-01-02",
        tien: 300_000,
        nguoinhan: "anh tú",
        tt: "dachi" as const,
      },
      {
        _id: "3",
        kieu: "chi" as const,
        ngay: "2026-01-02",
        tien: 900_000,
        nguoinhan: "Chị Hoa",
        tt: "dachi" as const,
      },
    ];
    expect(canhBaoChiaNho(ds)).toEqual([]);
    expect(
      canhBaoChiaNho(ds, {
        ngay: "2026-01-02",
        nguoinhan: "Anh Tú",
        tien: 200_000,
      }),
    ).toEqual([
      { ngay: "2026-01-02", nguoinhan: "Anh Tú", so: 3, tong: 1_100_000 },
    ]);
  });
  it("quỹ và tổng theo loại", () => {
    const ds = [
      { _id: "n", kieu: "nap" as const, ngay: "2026-01-01", tien: 5_000_000 },
      {
        _id: "a",
        kieu: "chi" as const,
        ngay: "2026-01-02",
        tien: 400_000,
        loai: "Ăn uống nước",
        tt: "dachi" as const,
      },
      {
        _id: "b",
        kieu: "chi" as const,
        ngay: "2026-01-03",
        tien: 2_000_000,
        loai: "Khác",
        tt: "cho" as const,
      },
    ];
    expect(quyXuong(ds)).toEqual({
      nap: 5_000_000,
      chi: 400_000,
      con: 4_600_000,
    });
    expect([...tongTheoLoai(ds, "2026-01").entries()]).toEqual([
      ["Ăn uống nước", 400_000],
    ]);
  });
});

describe("Sổ tay · đọc file PI", () => {
  it("tìm dòng Item code, không đọc cột giá", () => {
    const rows = [
      ["PROFORMA INVOICE"],
      [],
      [
        "No",
        "Item code",
        "Picture",
        "Dimension (cm)",
        "Color / description",
        "Unit",
        "Qty inner",
        "Inner/ outer",
        "Outer dimension",
        "QTY",
        "Unit price (USD)",
        "Amount",
      ],
      [
        1,
        "T002-2/427",
        "",
        "45 x 30 x 4.5",
        "Rectangular tray",
        "PC",
        1,
        6,
        "49x40x30",
        48,
        12.5,
        600,
      ],
      [2, "", "", "", "", "", "", "", "", "", "", ""],
      [
        3,
        "B031-427",
        "",
        "Ø30xH10",
        "Bowl",
        "PC",
        2,
        4,
        "62x32x45",
        "120",
        9,
        1080,
      ],
      ["", "TOTAL", "", "", "", "", "", "", "", 168, "", 1680],
    ];
    const ds = docPi(rows);
    expect(ds).toHaveLength(3);
    expect(ds[0]).toEqual({
      ma: "T002-2/427",
      qty: 48,
      mt: "Rectangular tray",
      L: 45,
      W: 30,
      H: 4.5,
      u: "PC",
      inner: 1,
      io: 6,
      oL: 49,
      oW: 40,
      oH: 30,
    });
    expect(ds[1]).toMatchObject({ ma: "B031-427", qty: 120, L: 30, W: 10 });
    expect(JSON.stringify(ds)).not.toContain("12.5");
  });
  it("tách kích thước", () => {
    expect(tachKichThuoc("40,5 x 30 x 10 cm")).toEqual([40.5, 30, 10]);
    expect(tachKichThuoc("")).toEqual([undefined, undefined, undefined]);
  });
  it("báo lỗi khi không có cột Item code", () => {
    expect(() => docPi([["Code", "QTY"]])).toThrow("Item code");
  });
});
