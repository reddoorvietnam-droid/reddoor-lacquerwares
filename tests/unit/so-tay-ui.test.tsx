// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoiDungTab } from "@/components/admin/so-tay/tabs";
import { SoTayCtx, type SoTayNguCanh } from "@/components/admin/so-tay/ui";
import { TABS, type MaTab, type VaiTro } from "@/domains/so-tay/hang-so";
import type { DuLieu } from "@/domains/so-tay/kieu";
import { taoChiMuc } from "@/domains/so-tay/nghiep-vu/chi-muc";

afterEach(cleanup);

/** Dữ liệu mẫu nhỏ, giống hình dạng dữ liệu Sổ chung đã nạp. */
const du: DuLieu = {
  doituong: [
    { _id: "LE_VAN_LUONG", c: "LE_VAN_LUONG", n: "Lê Văn Lương", l: "Cơ sở gia công", g: "Mộc", so: "A01", m: 1 },
    { _id: "LE_THI_NGA", c: "LE_THI_NGA", n: "Lê Thị Ngà", l: "Cơ sở gia công", g: "Hoàn thiện", so: "B10" },
    { _id: "CU", c: "CU", n: "Cơ sở cũ", l: "Cơ sở gia công", g: "Hoàn thiện", luu: true },
    { _id: "NV_DAT", c: "NV_DAT", n: "Đỗ Quốc Đạt", l: "Nhân sự nhà máy", g: "In, mẫu, hoàn thiện mẫu" },
    { _id: "NV_VP", c: "NV_VP", n: "Nguyễn Văn Phòng", l: "Nhân sự văn phòng", g: "Văn phòng" },
  ],
  donhang: [{ _id: "2026-36", c: "2026-36", k: "TOP CADO SARL", n: "Top Cado 0126" }],
  vattu: [{ _id: "FYR32A57", c: "FYR32A57", n: "PU đỏ cánh sen", k: "S", g: "Sơn PU / sơn phủ", u: "kg", t: 150, gv: 140_000, y: 400, r: 200 }],
  sodu: {
    _id: "sodu",
    ngay: "2026-11-14",
    nguon: "Tong_hop_cong_no.xlsx",
    cn: [{ d: "LE_THI_NGA", o: "2026-36", cp: "Chi phí hoàn thiện", hd: 50_000_000, tra: 20_000_000, ct: [{ n: "2026-09-10", nv: "Giá trị hợp đồng", t: 50_000_000 }] }],
    son: [{ d: "LE_THI_NGA", amt: 1_000_000 }],
    tamtinh: [{ o: "2026-36", tien: 5_000_000 }],
  },
  sanxuat: [
    {
      _id: "2026-36",
      dh: "2026-36",
      khach: "TOP CADO SARL",
      ngayxuat: "2027-01-31",
      tt: "nhan",
      nhan: { at: "2026-11-10T17:13:36.265Z" },
      items: [{ ma: "T002-2/427", mt: "Rectangular tray", L: 45, W: 30, H: 4.5, qty: 48, u: "PC", in: true, inner: 1, io: 6, img: "13_T002-2_427.jpg" }],
    },
  ],
  phancong: [{ _id: "PC1", dh: "2026-36", ma: "T002-2/427", khau: "Mộc", dt: "LE_VAN_LUONG", sl: 20, dg: 200_000, han: "2026-12-10" }],
  giaohang: [],
  hopdong: [],
  congno: [],
  thutien: [],
  denghichi: [],
  chixuong: [{ _id: "N1", kieu: "nap", ngay: "2026-11-01", tien: 5_000_000 }],
  phieukho: [],
  donmua: [],
  chamcong: [{ _id: "2026-10-01~NV_DAT", ngay: "2026-10-01", nv: "NV_DAT", cong: 0.75, tc: 0 }],
  luong: [{ _id: "2026-10~NV_DAT", thang: "2026-10", nv: "NV_DAT", ten: "Đỗ Quốc Đạt", khoi: "Nhà máy", tien_luong: 9_000_000, thuc_nhan: 8_000_000 }],
  nhanvienvp: [{ _id: "NV_VP", nv: "NV_VP", luong: 16_000_000 }],
  taikhoan: [{ _id: "a@reddoor.vn", email: "a@reddoor.vn", ten: "A" }],
  ganDay: [],
};

function moTab(tab: MaTab, vaitro: VaiTro = "quanly", chiTiet: string | null = null) {
  const ctx: SoTayNguCanh = {
    nguoi: { email: "a@reddoor.vn", ten: "A", vaitro, chao: "Xin chào" },
    tab,
    du,
    cm: taoChiMuc(du, "2026-11-17"),
    dangSua: true,
    gui: vi.fn(async () => ({ ok: true as const, ketQua: null })),
    taiLai: vi.fn(),
    chiTiet,
    moChiTiet: vi.fn(),
    diTab: vi.fn(),
    datBoLoc: vi.fn(),
  };
  return render(
    <SoTayCtx.Provider value={ctx}>
      <NoiDungTab />
    </SoTayCtx.Provider>,
  );
}

describe("Sổ tay · mọi tab hiển thị được", () => {
  it.each(TABS.map((t) => [t.ma, t.ten] as const))("tab %s (%s)", (ma) => {
    const { container } = moTab(ma);
    expect(container.textContent?.length).toBeGreaterThan(20);
    expect(container.textContent).not.toContain("Đang hoàn thiện tab này");
  });

  it("chi tiết đơn ở tab Sản xuất: mốc, mã hàng, ảnh qua API có đăng nhập", () => {
    const { container } = moTab("sanxuat", "quanly", "2026-36");
    expect(screen.getByText("Mốc tiến độ")).toBeTruthy();
    expect(screen.getAllByText("T002-2/427").length).toBeGreaterThan(0);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/api/so-tay/anh/13_T002-2_427.jpg");
    expect(screen.getByText("Hợp đồng với cơ sở")).toBeTruthy();
  });

  it("chi tiết cơ sở có sổ chi tiết; kho Axx mở được", () => {
    moTab("coso", "quanly", "LE_THI_NGA");
    expect(screen.getByText("Sổ chi tiết RD phải trả cơ sở")).toBeTruthy();
    cleanup();
    moTab("coso", "quanly", "Axx");
    expect(screen.getByText("Axx · Kho lưu đối chiếu")).toBeTruthy();
  });

  it("tổng công nợ cơ sở = số dư chốt (hd − tra)", () => {
    moTab("congno");
    expect(screen.getAllByText("30.000.000 đ").length).toBeGreaterThan(0);
  });

  it("biểu mẫu ghi chỉ hiện cho vai được phép", () => {
    moTab("kho", "thukho");
    expect(screen.getByText("Lập phiếu kho")).toBeTruthy();
    cleanup();
    moTab("kho", "ketoan");
    expect(screen.queryByText("Lập phiếu kho")).toBeNull();
  });
});
