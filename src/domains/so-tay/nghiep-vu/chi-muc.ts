/**
 * Chỉ mục tra cứu nhanh dựng từ dữ liệu một tab. Mọi hàm nghiệp vụ nhận chỉ
 * mục này nên chạy được cả ở máy chủ lẫn trình duyệt.
 */

import { CANH_BAO_MAC_DINH, type CauHinhCanhBao } from "../hang-so";
import type {
  CongNo,
  DeNghiChi,
  DoiTuong,
  DonHang,
  DuLieu,
  GiaoHang,
  HopDong,
  PhanCong,
  PhieuKho,
  SanXuat,
  VatTu,
} from "../kieu";
import { today } from "../tien-ich";

export const khoa = (dh: string | undefined, dt: string) => `${dh ?? ""}~${dt}`;

export type ChiMuc = {
  du: DuLieu;
  hom: string;
  canhBao: CauHinhCanhBao;
  dt: Map<string, DoiTuong>;
  don: Map<string, DonHang>;
  vt: Map<string, VatTu>;
  sx: Map<string, SanXuat>;
  /** Phần việc còn hiệu lực (chưa hủy), theo đơn. */
  pcTheoDon: Map<string, PhanCong[]>;
  pc: Map<string, PhanCong>;
  /** Phiếu giao hàng còn hiệu lực, theo phần việc. */
  ghTheoPc: Map<string, GiaoHang[]>;
  /** Hợp đồng theo `${dh}~${dt}`. */
  hd: Map<string, HopDong>;
  /** Bút toán công nợ còn hiệu lực, theo `${dh}~${dt}`. */
  cnTheoKhoa: Map<string, CongNo[]>;
  dnTheoKhoa: Map<string, DeNghiChi[]>;
  /** Phiếu kho còn hiệu lực. */
  pk: PhieuKho[];
};

function nhom<T>(ds: readonly T[], k: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of ds) {
    const key = k(x);
    const arr = m.get(key);
    if (arr) arr.push(x);
    else m.set(key, [x]);
  }
  return m;
}

export function taoChiMuc(du: DuLieu, hom: string = today()): ChiMuc {
  const pcs = (du.phancong ?? []).filter((p) => !p.huy);
  return {
    du,
    hom,
    canhBao: du.cauhinh ?? CANH_BAO_MAC_DINH,
    dt: new Map((du.doituong ?? []).map((d) => [d._id, d])),
    don: new Map((du.donhang ?? []).map((d) => [d._id, d])),
    vt: new Map((du.vattu ?? []).map((v) => [v._id, v])),
    sx: new Map((du.sanxuat ?? []).map((s) => [s._id, s])),
    pcTheoDon: nhom(pcs, (p) => p.dh),
    pc: new Map(pcs.map((p) => [p._id, p])),
    ghTheoPc: nhom(
      (du.giaohang ?? []).filter((g) => !g.huy),
      (g) => g.pc,
    ),
    hd: new Map((du.hopdong ?? []).map((h) => [khoa(h.dh, h.dt), h])),
    cnTheoKhoa: nhom(
      (du.congno ?? []).filter((c) => !c.huy),
      (c) => khoa(c.dh, c.dt),
    ),
    dnTheoKhoa: nhom(du.denghichi ?? [], (d) => khoa(d.dh, d.dt)),
    pk: (du.phieukho ?? []).filter((p) => !p.huy),
  };
}

/** "A01 · Tên" hoặc tên, hoặc mã nếu không có trong danh mục. */
export function tenDt(cm: ChiMuc, c: string | undefined): string {
  if (!c) return "";
  const d = cm.dt.get(c);
  if (!d) return c;
  return d.so ? `${d.so} · ${d.n}` : d.n;
}

export function tenDon(cm: ChiMuc, dh: string): string {
  return cm.don.get(dh)?.n ?? "";
}

/** Số lượng đã nhận đạt của một phần việc. */
export function daNhan(cm: ChiMuc, pcId: string): number {
  return (cm.ghTheoPc.get(pcId) ?? []).reduce((s, g) => s + (g.sl ?? 0), 0);
}

export const tong = (ds: readonly number[]) => ds.reduce((s, x) => s + x, 0);
