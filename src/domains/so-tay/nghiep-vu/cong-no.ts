/**
 * Công nợ với cơ sở (mục 7.7).
 *
 * RD còn nợ cơ sở theo (đơn, cơ sở) = số dư chốt (hd − tra)
 *   + Σ bút toán công nợ theo dấu nghiệp vụ − vật tư xưởng cấp.
 * Nợ tiền sơn (cơ sở nợ RD) = số dư `son` + phiếu kho tạo nợ (cn = 1)
 *   − bút toán "Trừ sơn / gỗ (bảng kê)" − phiếu thu.
 * Giá trị tạm tính (`sodu.tamtinh`) chỉ hiển thị riêng, không cộng vào.
 */

import { LOAI, NV } from "../hang-so";
import { type ChiMuc, khoa, tong } from "./chi-muc";
import { vatTuCap } from "./hop-dong";

const TANG_HD = ["Giá trị hợp đồng", "Điều chỉnh tăng", "Điều chỉnh giảm"];
const LOAI_NO_SON = new Set<string>(
  LOAI.filter((l) => l.cn === 1).map((l) => l.ten),
);

export type DongCongNo = {
  dh: string;
  dt: string;
  cp: string[];
  /** Tổng giá trị hợp đồng (chốt + đã ghi). */
  hd: number;
  /** Đã trả (chốt + ứng + thanh toán + trừ tiền). */
  daTra: number;
  vtCap: number;
  conNo: number;
};

/** Công nợ RD với từng cặp (đơn, cơ sở). */
export function congNoTheoCap(cm: ChiMuc): DongCongNo[] {
  const cap = new Map<string, DongCongNo>();
  const lay = (dh: string, dt: string) => {
    const k = khoa(dh, dt);
    let d = cap.get(k);
    if (!d) {
      d = { dh, dt, cp: [], hd: 0, daTra: 0, vtCap: 0, conNo: 0 };
      cap.set(k, d);
    }
    return d;
  };
  for (const c of cm.du.sodu?.cn ?? []) {
    const d = lay(c.o ?? "", c.d);
    d.hd += c.hd ?? 0;
    d.daTra += c.tra ?? 0;
    if (c.cp && !d.cp.includes(c.cp)) d.cp.push(c.cp);
  }
  for (const ds of cm.cnTheoKhoa.values()) {
    for (const c of ds) {
      const d = lay(c.dh ?? "", c.dt);
      const dau = NV[c.nv] ?? 0;
      if (TANG_HD.includes(c.nv)) d.hd += dau * c.tien;
      else d.daTra += -dau * c.tien;
      if (c.cp && !d.cp.includes(c.cp)) d.cp.push(c.cp);
    }
  }
  for (const p of cm.pk) {
    if (p.loai === "Xuất vật tư tạm ứng đơn hàng" && p.dt)
      lay(p.dh ?? "", p.dt);
  }
  for (const d of cap.values()) {
    d.vtCap = vatTuCap(cm, d.dh, d.dt);
    d.conNo = d.hd - d.daTra - d.vtCap;
  }
  return [...cap.values()];
}

/** Giá trị phiếu kho = Σ sl × đơn giá. */
export const giaTriPhieu = (
  dong: ReadonlyArray<{ sl?: number | undefined; dg?: number | undefined }>,
) => tong(dong.map((d) => (d.sl ?? 0) * (d.dg ?? 0)));

/** Nợ tiền sơn của từng cơ sở (cơ sở nợ RD). */
export function noTienSon(cm: ChiMuc): Map<string, number> {
  const no = new Map<string, number>();
  const cong = (dt: string, t: number) => no.set(dt, (no.get(dt) ?? 0) + t);
  for (const s of cm.du.sodu?.son ?? []) cong(s.d, s.amt);
  for (const p of cm.pk)
    if (LOAI_NO_SON.has(p.loai) && p.dt) cong(p.dt, giaTriPhieu(p.dong));
  for (const ds of cm.cnTheoKhoa.values())
    for (const c of ds)
      if (c.nv === "Trừ sơn / gỗ (bảng kê)") cong(c.dt, -c.tien);
  for (const t of cm.du.thutien ?? []) if (!t.huy) cong(t.dt, -t.tien);
  return no;
}

export type TongCoSo = {
  dt: string;
  hd: number;
  daTra: number;
  vtCap: number;
  conNo: number;
  noSon: number;
};

export function tongTheoCoSo(cm: ChiMuc): Map<string, TongCoSo> {
  const m = new Map<string, TongCoSo>();
  const lay = (dt: string) => {
    let x = m.get(dt);
    if (!x) {
      x = { dt, hd: 0, daTra: 0, vtCap: 0, conNo: 0, noSon: 0 };
      m.set(dt, x);
    }
    return x;
  };
  for (const d of congNoTheoCap(cm)) {
    const x = lay(d.dt);
    x.hd += d.hd;
    x.daTra += d.daTra;
    x.vtCap += d.vtCap;
    x.conNo += d.conNo;
  }
  for (const [dt, v] of noTienSon(cm)) lay(dt).noSon = v;
  return m;
}

export type DongSo = {
  ngay: string;
  nv: string;
  dh: string;
  tang: number;
  giam: number;
  con: number;
  nd: string;
};

/** Sổ chi tiết RD phải trả cơ sở (mục 8.5 bảng 6). */
export function soChiTietPhaiTra(cm: ChiMuc, dt: string): DongSo[] {
  const dong: Omit<DongSo, "con">[] = [];
  for (const c of cm.du.sodu?.cn ?? []) {
    if (c.d !== dt) continue;
    const ct = c.ct ?? [];
    if (ct.length === 0) {
      if (c.hd)
        dong.push({
          ngay: "",
          nv: "Giá trị hợp đồng (số dư chốt)",
          dh: c.o,
          tang: c.hd,
          giam: 0,
          nd: c.cp ?? "",
        });
      if (c.tra)
        dong.push({
          ngay: "",
          nv: "Đã trả (số dư chốt)",
          dh: c.o,
          tang: 0,
          giam: c.tra,
          nd: c.cp ?? "",
        });
    }
    for (const x of ct) {
      const dau =
        NV[x.nv as keyof typeof NV] ?? (TANG_HD.includes(x.nv ?? "") ? 1 : -1);
      const t = x.t ?? 0;
      dong.push({
        ngay: x.n ?? "",
        nv: x.nv ?? "",
        dh: c.o,
        tang: dau > 0 ? t : 0,
        giam: dau < 0 ? t : 0,
        nd: [c.cp, x.f, x.gc ? `Ghi chú: ${x.gc}` : ""]
          .filter(Boolean)
          .join(" · "),
      });
    }
  }
  for (const ds of cm.cnTheoKhoa.values()) {
    for (const c of ds) {
      if (c.dt !== dt) continue;
      const dau = NV[c.nv] ?? 0;
      dong.push({
        ngay: c.ngay,
        nv: c.nv,
        dh: c.dh ?? "",
        tang: dau > 0 ? c.tien : 0,
        giam: dau < 0 ? c.tien : 0,
        nd: [
          c.cp,
          c.hd ? `HĐ ${c.hd}` : "",
          c.ghichu ? `Ghi chú: ${c.ghichu}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }
  }
  for (const p of cm.pk) {
    if (p.loai !== "Xuất vật tư tạm ứng đơn hàng" || p.dt !== dt) continue;
    dong.push({
      ngay: p.ngay,
      nv: "Vật tư xưởng cấp",
      dh: p.dh ?? "",
      tang: 0,
      giam: giaTriPhieu(p.dong),
      nd: `Phiếu ${p.so}`,
    });
  }
  dong.sort((a, b) => (a.ngay || "0").localeCompare(b.ngay || "0"));
  let con = 0;
  return dong.map((d) => {
    con += d.tang - d.giam;
    return { ...d, con };
  });
}

/** Sổ chi tiết cơ sở nợ RD (sơn, gỗ, vật tư mua của nhà máy). */
export function soNoSon(cm: ChiMuc, dt: string): DongSo[] {
  const dong: Omit<DongSo, "con">[] = [];
  for (const s of cm.du.sodu?.son ?? [])
    if (s.d === dt)
      dong.push({
        ngay: cm.du.sodu?.ngay ?? "",
        nv: "Số dư chốt",
        dh: "",
        tang: s.amt,
        giam: 0,
        nd: "",
      });
  for (const p of cm.pk)
    if (LOAI_NO_SON.has(p.loai) && p.dt === dt)
      dong.push({
        ngay: p.ngay,
        nv: p.loai,
        dh: p.dh ?? "",
        tang: giaTriPhieu(p.dong),
        giam: 0,
        nd: `Phiếu ${p.so}`,
      });
  for (const ds of cm.cnTheoKhoa.values())
    for (const c of ds)
      if (c.dt === dt && c.nv === "Trừ sơn / gỗ (bảng kê)")
        dong.push({
          ngay: c.ngay,
          nv: "Trừ vào HĐ",
          dh: c.dh ?? "",
          tang: 0,
          giam: c.tien,
          nd: c.ghichu ?? "",
        });
  for (const t of cm.du.thutien ?? [])
    if (!t.huy && t.dt === dt)
      dong.push({
        ngay: t.ngay,
        nv: "Cơ sở trả tiền",
        dh: "",
        tang: 0,
        giam: t.tien,
        nd: [t.ht, t.nd].filter(Boolean).join(" · "),
      });
  dong.sort((a, b) => (a.ngay || "0").localeCompare(b.ngay || "0"));
  let con = 0;
  return dong.map((d) => {
    con += d.tang - d.giam;
    return { ...d, con };
  });
}

/** Giá trị tạm tính theo đơn (không cộng vào công nợ). */
export function tamTinhTheoDon(cm: ChiMuc): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of cm.du.sodu?.tamtinh ?? [])
    m.set(t.o, (m.get(t.o) ?? 0) + t.tien);
  return m;
}
