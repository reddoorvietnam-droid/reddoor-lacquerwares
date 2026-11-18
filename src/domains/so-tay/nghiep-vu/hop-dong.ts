/**
 * Hợp đồng với cơ sở (mục 7.5) và tạm ứng (mục 7.6), theo từng đơn × cơ sở.
 * Cách tính giữ đúng Sổ chung đang chạy (bản 16/11/2026).
 */

import { KHAU, NV, type KhoanCp } from "../hang-so";
import type { PhanCong } from "../kieu";
import { type ChiMuc, khoa, tong } from "./chi-muc";

export const TAM_UNG = 0.3;
export const NGUONG_TAM_UNG_MOC = 10_000_000;
/** Khoản chi phí không tự được tạm ứng. */
const KHONG_UNG: readonly string[] = ["Chi phí làm mộc", "Chi phí bao bì"];
/** Cơ sở bao bì được tạm ứng: Trần Quang Hiếu (C04), Công ty CP In Ecoprint (C05). */
export const BAO_BI_DUOC_UNG = ["TRAN_QUANG_HIEU", "CONG_TY_CP_IN_ECOPRINT"];
/** Bút toán sinh từ nút "Ghi công nợ" của hợp đồng. */
export const NGUON_HOP_DONG = "hopdong";

const LOAI_VT_CAP = "Xuất vật tư tạm ứng đơn hàng";

const cpCuaKhau = (khau: string): KhoanCp | null =>
  KHAU.find((k) => k.ten === khau)?.cp ?? null;

/** 30% giá trị hợp đồng, làm tròn XUỐNG đơn vị triệu đồng. */
export function mucTamUng(gt: number): number {
  if (!(gt > 0)) return 0;
  return Math.floor((gt * 3) / 10 / 1_000_000) * 1_000_000;
}

/**
 * Ai được tạm ứng: hợp đồng có khoản ngoài mộc / bao bì (cơ sở hoàn thiện…)
 * thì được; mộc khi giá trị trên 10 triệu; bao bì chỉ C04, C05.
 */
export function coTamUng(h: {
  byCP: Partial<Record<string, number>>;
  gt: number;
  dt: string;
}): boolean {
  const cps = Object.keys(h.byCP);
  if (!cps.every((cp) => KHONG_UNG.includes(cp))) return true;
  if (cps.includes("Chi phí làm mộc") && h.gt > NGUONG_TAM_UNG_MOC) return true;
  return cps.includes("Chi phí bao bì") && BAO_BI_DUOC_UNG.includes(h.dt);
}

export type HopDongTinh = {
  dh: string;
  dt: string;
  /** Phần việc tính tiền của cơ sở trong đơn (kể cả dòng trừ Nhập kho). */
  pcs: PhanCong[];
  byCP: Partial<Record<KhoanCp, number>>;
  /** Giá trị tạm tính hiện tại. */
  gt: number;
  so?: string;
  ngayKy?: string;
  daKy: boolean;
  gtKy?: number;
  /** Giá trị hiện tại khác giá trị lúc ký: cần ký phụ lục. */
  doiGia: boolean;
  /** Đã ghi công nợ theo từng khoản (bút toán nguồn "hopdong"). */
  daGhiTheoCp: Partial<Record<string, number>>;
  /** Chênh giữa giá trị hiện tại và đã ghi, theo khoản. */
  chenh: Partial<Record<string, number>>;
  daGhi: number;
  daUng: number;
  daTT: number;
  truTien: number;
  vtCap: number;
  ungCho: number;
  ttCho: number;
  /** Còn phải trả = (đã ký ? đã ghi : tạm tính) − ứng − thanh toán − trừ tiền − vật tư cấp. */
  conPhaiTra: number;
  /** Số còn có thể đề nghị = còn phải trả − đề nghị đang chờ. */
  conDeNghi: number;
  /** Đã ký mà còn chênh chưa ghi công nợ. */
  choGhi: boolean;
  coTamUng: boolean;
  /** Số đề xuất tạm ứng (30% − đã ứng − đang chờ, làm tròn xuống triệu). */
  deNghiUng: number;
  /** Hợp đồng chỉ có tiền mộc. */
  laMoc: boolean;
};

/**
 * Tiền của một phần việc vào hợp đồng. Nhập kho do người nhà máy làm thay
 * (`tru` = cơ sở hoàn thiện): đơn giá là "Tiền trừ vào cơ sở (đ/cái)", ghi ÂM
 * vào hợp đồng cơ sở bị trừ, không lên hợp đồng của người nhà máy.
 */
export function chuHopDong(
  p: PhanCong,
): { dt: string; cp: KhoanCp; tien: number } | null {
  const cp = cpCuaKhau(p.khau);
  if (!cp) return null;
  const tru = p.khau === "Nhập kho" && p.tru;
  const dt = tru ? (p.tru as string) : p.dt;
  if (!dt) return null;
  return { dt, cp, tien: (tru ? -1 : 1) * (p.sl ?? 0) * (p.dg ?? 0) };
}

export function vatTuCap(
  cm: ChiMuc,
  dh: string | undefined,
  dt: string,
): number {
  return tong(
    cm.pk
      .filter(
        (p) =>
          p.loai === LOAI_VT_CAP &&
          p.dt === dt &&
          (dh === undefined || p.dh === dh),
      )
      .flatMap((p) => p.dong.map((d) => (d.sl ?? 0) * (d.dg ?? 0))),
  );
}

export function sxCalc(cm: ChiMuc, dh: string, dt: string): HopDongTinh {
  const pcs: PhanCong[] = [];
  const byCP: Partial<Record<KhoanCp, number>> = {};
  for (const p of cm.pcTheoDon.get(dh) ?? []) {
    const t = chuHopDong(p);
    if (!t || t.dt !== dt) continue;
    pcs.push(p);
    byCP[t.cp] = (byCP[t.cp] ?? 0) + t.tien;
  }
  const gt = Math.round(tong(Object.values(byCP)));

  const hd = cm.hd.get(khoa(dh, dt));
  const daKy = Boolean(hd?.ngay);
  const cns = cm.cnTheoKhoa.get(khoa(dh, dt)) ?? [];
  const daGhiTheoCp: Partial<Record<string, number>> = {};
  for (const c of cns) {
    if (c.nguon !== NGUON_HOP_DONG) continue;
    const k = c.cp ?? "";
    daGhiTheoCp[k] = (daGhiTheoCp[k] ?? 0) + (NV[c.nv] ?? 0) * c.tien;
  }
  const chenh: Partial<Record<string, number>> = {};
  for (const cp of new Set([
    ...Object.keys(byCP),
    ...Object.keys(daGhiTheoCp),
  ])) {
    const d = (byCP[cp as KhoanCp] ?? 0) - (daGhiTheoCp[cp] ?? 0);
    if (Math.abs(d) >= 1) chenh[cp] = d;
  }
  const daGhi = tong(Object.values(daGhiTheoCp).map((x) => x ?? 0));
  const sum = (nv: string) =>
    tong(cns.filter((c) => c.nv === nv).map((c) => c.tien));
  const daUng = sum("Tạm ứng");
  const daTT = sum("Thanh toán");
  const truTien = sum("Trừ tiền");
  const vtCap = vatTuCap(cm, dh, dt);
  const cho = (cm.dnTheoKhoa.get(khoa(dh, dt)) ?? []).filter(
    (d) => d.tt === "cho",
  );
  const ungCho = tong(
    cho.filter((d) => d.loai === "Tạm ứng").map((d) => d.tien),
  );
  const ttCho = tong(
    cho.filter((d) => d.loai === "Thanh toán").map((d) => d.tien),
  );
  const conPhaiTra = (daKy ? daGhi : gt) - daUng - daTT - truTien - vtCap;
  const ung = coTamUng({ byCP, gt, dt });

  return {
    dh,
    dt,
    pcs,
    byCP,
    gt,
    ...(hd?.so ? { so: hd.so } : {}),
    ...(hd?.ngay ? { ngayKy: hd.ngay } : {}),
    daKy,
    ...(hd?.gt !== undefined ? { gtKy: hd.gt } : {}),
    doiGia: daKy && Math.abs((hd?.gt ?? 0) - gt) >= 1,
    daGhiTheoCp,
    chenh,
    daGhi,
    daUng,
    daTT,
    truTien,
    vtCap,
    ungCho,
    ttCho,
    conPhaiTra,
    conDeNghi: conPhaiTra - ungCho - ttCho,
    choGhi: daKy && Object.keys(chenh).length > 0,
    coTamUng: ung,
    deNghiUng: ung
      ? Math.max(0, Math.floor((TAM_UNG * gt - daUng - ungCho) / 1e6) * 1e6)
      : 0,
    laMoc:
      Object.keys(byCP).length > 0 &&
      Object.keys(byCP).every((cp) => cp === "Chi phí làm mộc"),
  };
}

/** Mọi hợp đồng (cơ sở có tiền) của một đơn, sắp theo số định danh. */
export function hopDongCuaDon(cm: ChiMuc, dh: string): HopDongTinh[] {
  const dts = new Set<string>();
  for (const p of cm.pcTheoDon.get(dh) ?? []) {
    const t = chuHopDong(p);
    if (t) dts.add(t.dt);
  }
  for (const h of cm.hd.values()) if (h.dh === dh) dts.add(h.dt);
  return [...dts]
    .map((dt) => sxCalc(cm, dh, dt))
    .sort((a, b) =>
      (cm.dt.get(a.dt)?.so ?? "zz").localeCompare(cm.dt.get(b.dt)?.so ?? "zz"),
    );
}

/**
 * Bút toán khi kế toán bấm "Ghi công nợ": lần đầu "Giá trị hợp đồng" theo
 * khoản; sau phụ lục ghi phần chênh "Điều chỉnh tăng / giảm".
 */
export function butToanGhiHopDong(h: HopDongTinh): Array<{
  cp: KhoanCp;
  nv: "Giá trị hợp đồng" | "Điều chỉnh tăng" | "Điều chỉnh giảm";
  tien: number;
  lanDau: boolean;
}> {
  const lanDau = Object.keys(h.daGhiTheoCp).length === 0;
  return Object.entries(h.chenh).map(([cp, d]) => ({
    cp: cp as KhoanCp,
    nv:
      lanDau && (d ?? 0) > 0
        ? "Giá trị hợp đồng"
        : (d ?? 0) > 0
          ? "Điều chỉnh tăng"
          : "Điều chỉnh giảm",
    tien: Math.abs(Math.round(d ?? 0)),
    lanDau,
  }));
}
