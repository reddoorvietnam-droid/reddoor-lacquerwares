/**
 * Tiến độ đơn (mục 7.2–7.4, 7.6): mốc, mẫu tiến độ, quá hạn, việc của kế toán
 * và bản tóm tắt cho lịch sản xuất (mục 9.1). Cách tính giữ đúng Sổ chung
 * đang chạy (bản 16/11/2026).
 */

import {
  KHAU,
  MOC,
  type MaMoc,
  type MauTienDo,
  type TenKhau,
} from "../hang-so";
import type { DonLich, MaHang, SanXuat } from "../kieu";
import { addDays, daysTo, dvn } from "../tien-ich";
import { type ChiMuc, daNhan, tenDt, tong } from "./chi-muc";
import { hopDongCuaDon, TAM_UNG } from "./hop-dong";

/** `cho` = chưa tới (mốc trước chưa xong, chưa đến ngày bắt đầu). */
export type MucDo = "xong" | "do" | "vang" | "xanh" | "cho";

const XEP: Record<MucDo, number> = { do: 3, vang: 2, xanh: 1, xong: 0, cho: 0 };

export function mucCaoNhat(ds: readonly MucDo[]): MucDo {
  return ds.reduce<MucDo>((a, b) => (XEP[b] > XEP[a] ? b : a), "xanh");
}

export const PHU_TRACH: Record<MaMoc, string> = {
  m1: "Quản lý xưởng",
  m2: "Quản lý xưởng",
  m3: "Quản lý xưởng (in)",
  m4: "QC công ty",
  m5: "Quản lý xưởng, thủ kho",
};

const KHAU_MOC: Partial<Record<MaMoc, TenKhau>> = {
  m1: "Mộc",
  m2: "Hoàn thiện (sơn)",
  m3: "In tại nhà máy",
};

/** Mã hàng có cần khâu này không (Bao bì đặt riêng; In chỉ mã có in). */
export function canKhau(it: Pick<MaHang, "in">, khau: TenKhau): boolean {
  if (khau === "Bao bì") return false;
  return KHAU.find((k) => k.ten === khau && "chiMaIn" in k)
    ? Boolean(it.in)
    : true;
}

/**
 * Ngày mọi mã hàng cần khâu đó được giao đủ số lượng; `null` nếu chưa đủ;
 * `"khong"` nếu không mã nào cần khâu này.
 */
export function khauXong(
  cm: ChiMuc,
  sx: SanXuat,
  khau: TenKhau,
): string | null | "khong" {
  const its = (sx.items ?? []).filter((i) => canKhau(i, khau));
  if (its.length === 0) return "khong";
  const pcs = (cm.pcTheoDon.get(sx.dh) ?? []).filter((p) => p.khau === khau);
  let cuoi = "";
  for (const it of its) {
    const ghs = pcs
      .filter((p) => p.ma === it.ma)
      .flatMap((p) => cm.ghTheoPc.get(p._id) ?? [])
      .sort((a, b) => a.ngay.localeCompare(b.ngay));
    let cong = 0;
    let ngay: string | null = null;
    for (const g of ghs) {
      cong += g.sl ?? 0;
      if (cong >= it.qty) {
        ngay = g.ngay;
        break;
      }
    }
    if (!ngay) return null;
    if (ngay > cuoi) cuoi = ngay;
  }
  return cuoi;
}

export type MocTinh = {
  ma: MaMoc;
  ten: string;
  tu: string;
  phutrach: string;
  /** Số ngày của mẫu. */
  soNgay: number;
  batDau: string;
  han: string;
  /** Hạn tối đa (m5: bắt đầu + m5max; mốc khác = hạn). */
  hanMax: string;
  tt?: string;
  ttTay: boolean;
  muc: MucDo;
  ghiChu: string;
  qua: number;
};

export type MocCoSo = {
  dt: string;
  han: string;
  can: number;
  da: number;
  muc: MucDo;
};

export type TienDoDon = {
  goc: string;
  mau: MauTienDo;
  moc: MocTinh[];
  mocCS: MocCoSo[];
  duKien: string;
  /** Số ngày dự kiến giao trễ so với ngày xuất PI. */
  treXuat: number;
  /** Mức của đơn; `giao` = đã giao hàng, `cho` = xưởng chưa nhận. */
  muc: Exclude<MucDo, "xong" | "cho"> | "giao" | "cho";
  nguyen: string;
  coKy: boolean;
};

/** Ngày của một ISO datetime, cắt như Sổ chung cũ (`slice(0, 10)`). */
const ngayCua = (iso: string | undefined) =>
  iso ? iso.slice(0, 10) : undefined;

export function mocDon(cm: ChiMuc, sx: SanXuat): TienDoDon {
  const cb = cm.canhBao;
  const hom = cm.hom;
  const pcsDon = cm.pcTheoDon.get(sx.dh) ?? [];
  const hdMoc = [...cm.hd.values()].filter(
    (h) =>
      h.dh === sx.dh &&
      h.ngay &&
      pcsDon.some((p) => p.dt === h.dt && p.khau === "Mộc"),
  );
  const kyMoc = hdMoc.map((h) => h.ngay as string).sort();
  const goc = kyMoc[0] ?? ngayCua(sx.nhan?.at) ?? ngayCua(sx.at) ?? hom;
  const dai = sx.ngayxuat ? daysTo(goc, sx.ngayxuat) : Number.NaN;
  const mau =
    cb.mau.find((m) => m.ten === sx.mau) ??
    cb.mau.find((m) => dai <= m.den) ??
    (cb.mau[cb.mau.length - 1] as MauTienDo);

  const moc: MocTinh[] = [];
  let bd = goc;
  let truocXong = true;
  for (const M of MOC) {
    const tay = sx.moc?.[M.ma];
    let tt: string | null | undefined = tay;
    if (!tt) {
      const khau = KHAU_MOC[M.ma];
      if (khau) {
        const x = khauXong(cm, sx, khau);
        // Không có khâu này → xong cùng mốc trước.
        tt = x === "khong" ? (moc.length ? moc[moc.length - 1]?.tt : bd) : x;
      } else if (M.ma === "m4") tt = sx.qc1?.ngay ?? null;
      else tt = sx.giao?.ngay ?? null;
    }
    const n = mau.ngay[M.ma] ?? 0;
    const han = addDays(bd, n);
    const hanMax = M.ma === "m5" ? addDays(bd, mau.m5max || n) : han;
    let muc: MucDo;
    let ghiChu: string;
    if (tt) {
      const tre = Math.max(0, daysTo(hanMax, tt));
      muc = "xong";
      ghiChu = tre ? `xong trễ ${tre} ngày` : "đúng hạn";
    } else if (!truocXong && hom < bd) {
      muc = "cho";
      ghiChu = "chưa tới";
    } else {
      const con = daysTo(hom, han);
      const conMax = daysTo(hom, hanMax);
      if (conMax < 0) {
        muc = "do";
        ghiChu = `quá hạn ${-conMax} ngày`;
      } else if (M.ma === "m5" && con < 0) {
        muc = "vang";
        ghiChu = `quá ${n} ngày chuẩn, còn ${conMax} ngày đến hạn tối đa`;
      } else if (con <= cb.baoTruoc) {
        muc = "vang";
        ghiChu = con === 0 ? "đến hạn hôm nay" : `còn ${con} ngày`;
      } else {
        muc = "xanh";
        ghiChu = `còn ${con} ngày`;
      }
    }
    const qua = tt
      ? Math.max(0, daysTo(hanMax, tt))
      : muc === "cho"
        ? 0
        : Math.max(0, daysTo(hanMax, hom));
    moc.push({
      ma: M.ma,
      ten: M.ten,
      tu: M.tu,
      phutrach: PHU_TRACH[M.ma],
      soNgay: n,
      batDau: bd,
      han,
      hanMax,
      ...(tt ? { tt } : {}),
      ttTay: Boolean(tay),
      muc,
      ghiChu,
      qua,
    });
    // Mốc trước trễ thì các mốc sau dời theo.
    bd = tt || (han < hom ? hom : han);
    truocXong = Boolean(tt);
  }

  // Hạn mộc riêng từng cơ sở: ngày ký + số ngày mộc.
  const mocCS: MocCoSo[] = [...cm.hd.values()]
    .filter((h) => h.dh === sx.dh && h.ngay)
    .flatMap((h) => {
      const ps = pcsDon.filter((p) => p.dt === h.dt && p.khau === "Mộc");
      if (!ps.length) return [];
      const can = tong(ps.map((p) => p.sl ?? 0));
      const da = tong(ps.map((p) => daNhan(cm, p._id)));
      const han = addDays(h.ngay as string, mau.ngay.m1);
      const con = daysTo(hom, han);
      const muc: MucDo =
        da >= can
          ? "xong"
          : con < 0
            ? "do"
            : con <= cb.baoTruoc
              ? "vang"
              : "xanh";
      return [{ dt: h.dt, han, can, da, muc }];
    });

  const m5 = moc[4] as MocTinh;
  const duKien = m5.tt || m5.han;
  const treXuat = sx.ngayxuat ? Math.max(0, daysTo(sx.ngayxuat, duKien)) : 0;
  let mucDon = mucCaoNhat([
    ...moc.map((x) => x.muc),
    ...mocCS.map((x) => x.muc),
  ]);
  if (treXuat > 0) mucDon = "do";
  const doMoc = moc.find((x) => x.muc === "do");
  const vangMoc = moc.find((x) => x.muc === "vang");
  const nguyen =
    mucDon === "do"
      ? treXuat > 0 && !doMoc
        ? `dự kiến giao trễ ${treXuat} ngày so với PI`
        : doMoc
          ? `${doMoc.ten}: ${doMoc.ghiChu}`
          : `Mộc: ${cm.dt.get(mocCS.find((x) => x.muc === "do")?.dt ?? "")?.n ?? ""}`
      : mucDon === "vang"
        ? vangMoc
          ? `${vangMoc.ten}: ${vangMoc.ghiChu}`
          : "Mộc sắp đến hạn"
        : "";

  const muc: TienDoDon["muc"] =
    sx.tt !== "nhan"
      ? "cho"
      : m5.tt
        ? "giao"
        : mucDon === "xong" || mucDon === "cho"
          ? "xanh"
          : mucDon;
  return {
    goc,
    mau,
    moc,
    mocCS,
    duKien,
    treXuat,
    muc,
    nguyen,
    coKy: kyMoc.length > 0,
  };
}

/** Hạn mặc định của phần việc theo mốc tiến độ, hoặc ngày xuất − off. */
export function hanMacDinh(cm: ChiMuc, sx: SanXuat, khau: TenKhau): string {
  const k = KHAU.find((x) => x.ten === khau);
  if (k?.moc) {
    const m = mocDon(cm, sx).moc.find((x) => x.ma === k.moc);
    if (m) return m.han;
  }
  if (sx.ngayxuat && k) return addDays(sx.ngayxuat, -k.off);
  return "";
}

export type ViecQuaHan = {
  dh: string;
  ten: string;
  viec: string;
  han: string;
  qua: number;
  phutrach: string;
};

/** Mọi việc quá hạn của các đơn đã nhận mà chưa giao, quá hạn lâu nhất trước. */
export function quaHan(cm: ChiMuc): ViecQuaHan[] {
  const ds: ViecQuaHan[] = [];
  const hom = cm.hom;
  for (const sx of cm.sx.values()) {
    if (sx.tt !== "nhan" || sx.giao?.ngay) continue;
    const ten = cm.don.get(sx.dh)?.n ?? "";
    const td = mocDon(cm, sx);
    for (const m of td.moc) {
      if (!m.tt && m.qua > 0) {
        ds.push({
          dh: sx.dh,
          ten,
          viec: m.ten,
          phutrach: m.phutrach,
          han: m.hanMax,
          qua: m.qua,
        });
      }
    }
    for (const m of td.mocCS) {
      if (m.muc !== "xong" && m.han < hom) {
        ds.push({
          dh: sx.dh,
          ten,
          viec: `Mộc · ${cm.dt.get(m.dt)?.n ?? m.dt} (${m.da}/${m.can})`,
          phutrach: "Quản lý xưởng",
          han: m.han,
          qua: daysTo(m.han, hom),
        });
      }
    }
    for (const p of cm.pcTheoDon.get(sx.dh) ?? []) {
      const nhan = daNhan(cm, p._id);
      if (nhan >= (p.sl ?? 0) || !p.han || p.han >= hom) continue;
      ds.push({
        dh: sx.dh,
        ten,
        viec: `${p.khau} · ${p.ma ?? ""} · ${cm.dt.get(p.dt ?? "")?.n ?? p.dt ?? ""} (đã nhận ${nhan.toLocaleString("vi-VN")}/${(p.sl ?? 0).toLocaleString("vi-VN")})`,
        phutrach: p.khau === "Bao bì" ? "Thủ kho" : "Quản lý xưởng",
        han: p.han,
        qua: daysTo(p.han, hom),
      });
    }
    if (sx.ngayxuat && sx.ngayxuat < hom) {
      ds.push({
        dh: sx.dh,
        ten,
        viec: "Ngày xuất hàng theo PI",
        phutrach: "Giám đốc",
        han: sx.ngayxuat,
        qua: daysTo(sx.ngayxuat, hom),
      });
    }
  }
  return ds.sort((a, b) => b.qua - a.qua);
}

/** Nội dung nút "Sao chép tin Zalo". */
export function tinZalo(ds: readonly ViecQuaHan[], hom: string): string {
  const theoDon = new Map<string, ViecQuaHan[]>();
  for (const v of ds) theoDon.set(v.dh, [...(theoDon.get(v.dh) ?? []), v]);
  const khoi = [...theoDon.entries()].map(
    ([dh, xs]) =>
      `\n📦 ${dh} ${xs[0]?.ten ?? ""}\n` +
      xs
        .map(
          (x) =>
            `- ${x.viec}: quá ${x.qua} ngày (hạn ${dvn(x.han)}) · ${x.phutrach}`,
        )
        .join("\n"),
  );
  return `⚠ QUÁ HẠN SẢN XUẤT ${dvn(hom)}\n${khoi.join("\n")}\n\nTổng: ${ds.length} việc quá hạn.`;
}

export type ViecKeToan = {
  dh: string;
  dt?: string;
  viec: string;
  ghi?: string;
  tien?: number;
  han: string;
  phutrach: "Kế toán xưởng" | "Kế toán công ty";
  xong: boolean;
  muc: MucDo;
  ghiChu: string;
};

const NHAC = { ungSauMoc: 7, ttSauXuat: 15 };

/** Việc của kế toán theo đơn (mục 7.6). */
export function viecDon(cm: ChiMuc, sx: SanXuat): ViecKeToan[] {
  if (sx.tt !== "nhan") return [];
  const td = mocDon(cm, sx);
  const mocXong = td.moc[0]?.tt;
  const ds: ViecKeToan[] = [];
  const them = (x: Omit<ViecKeToan, "dh" | "muc" | "ghiChu">) => {
    const con = daysTo(cm.hom, x.han);
    ds.push({
      ...x,
      dh: sx.dh,
      muc: x.xong
        ? "xong"
        : con < 0
          ? "do"
          : con <= cm.canhBao.baoTruoc
            ? "vang"
            : "xanh",
      ghiChu: x.xong
        ? "đã làm"
        : con < 0
          ? `quá hạn ${-con} ngày`
          : con === 0
            ? "hạn hôm nay"
            : `còn ${con} ngày`,
    });
  };
  for (const h of hopDongCuaDon(cm, sx.dh)) {
    const ten = cm.dt.get(h.dt)?.n ?? h.dt;
    const chuaKy = h.daKy ? "" : "chưa ký hợp đồng";
    if (h.laMoc && h.coTamUng && h.ngayKy) {
      them({
        viec: `Xét tạm ứng hợp đồng mộc (trên 10 triệu) · ${ten}`,
        ghi: `tối đa ${TAM_UNG * 100}% giá trị hợp đồng`,
        tien: h.deNghiUng,
        han: h.ngayKy,
        phutrach: "Kế toán xưởng",
        xong: h.daUng > 0 || h.ungCho > 0,
        dt: h.dt,
      });
    }
    if (mocXong) {
      const han = addDays(mocXong, NHAC.ungSauMoc);
      if (h.laMoc) {
        them({
          viec: `Đề nghị thanh toán 100% hợp đồng mộc · ${ten}`,
          ghi: chuaKy,
          tien: h.conDeNghi,
          han,
          phutrach: "Kế toán xưởng",
          xong: h.daKy && h.conDeNghi < 1,
          dt: h.dt,
        });
      } else if (h.coTamUng && (h.deNghiUng > 0 || h.daUng > 0)) {
        them({
          viec: `Đề nghị tạm ứng ${TAM_UNG * 100}% · ${ten}`,
          ghi: chuaKy,
          tien: h.deNghiUng,
          han,
          phutrach: "Kế toán xưởng",
          xong: h.daUng > 0 || h.ungCho > 0,
          dt: h.dt,
        });
      }
    }
    if (sx.giao?.ngay && !h.laMoc) {
      them({
        viec: `Đề nghị thanh toán hợp đồng · ${ten}`,
        ghi: chuaKy,
        tien: h.conDeNghi,
        han: addDays(sx.giao.ngay, NHAC.ttSauXuat),
        phutrach: "Kế toán xưởng",
        xong: h.daKy && h.conDeNghi < 1,
        dt: h.dt,
      });
    }
  }
  // Việc của kế toán công ty (mục 7.6).
  if (sx.ngayxuat) {
    them({
      viec: "Đặt lịch đóng hàng",
      han: addDays(sx.ngayxuat, -15),
      phutrach: "Kế toán công ty",
      xong: Boolean(sx.giao?.ngay),
    });
  }
  if (sx.giao?.ngay) {
    const han = addDays(sx.giao.ngay, 7);
    them({
      viec: "Làm chứng từ xuất khẩu",
      ghi: "Invoice, Packing List, tờ khai, C/O, hun trùng, B/L",
      han,
      phutrach: "Kế toán công ty",
      // Không có dữ liệu đánh dấu xong: hết nhắc sau hạn.
      xong: cm.hom > han,
    });
  }
  return ds;
}

export type ViecHomNay = {
  dh: string;
  viec: string;
  phutrach: string;
  han: string;
  /** Âm = quá hạn N ngày, 0 = hôm nay, dương = còn N ngày. */
  con: number;
};

/** Bảng công việc màn hình chào (mục 3.2 bước 4). */
export function viecHomNay(cm: ChiMuc): ViecHomNay[] {
  const tenDon = (dh: string) => `${dh} ${cm.don.get(dh)?.n ?? ""}`.trim();
  const ds: ViecHomNay[] = quaHan(cm).map((v) => ({
    dh: tenDon(v.dh),
    viec: v.viec,
    phutrach: v.phutrach,
    han: v.han,
    con: -v.qua,
  }));
  for (const sx of cm.sx.values()) {
    if (sx.tt !== "nhan" || sx.giao?.ngay) continue;
    for (const m of mocDon(cm, sx).moc) {
      const con = daysTo(cm.hom, m.han);
      if (!m.tt && m.muc !== "cho" && con >= 0 && con <= 3) {
        ds.push({
          dh: tenDon(sx.dh),
          viec: m.ten,
          phutrach: m.phutrach,
          han: m.han,
          con,
        });
      }
    }
    for (const v of viecDon(cm, sx)) {
      const con = daysTo(cm.hom, v.han);
      if (v.xong || con > 3) continue;
      ds.push({
        dh: tenDon(sx.dh),
        viec: v.viec,
        phutrach: v.phutrach,
        han: v.han,
        con,
      });
    }
  }
  return ds.sort((a, b) => a.con - b.con);
}

/** Bản tóm tắt nhỏ cho lịch sản xuất (`tomtat.lich`). */
export function tomTatLich(cm: ChiMuc): DonLich[] {
  const ds: DonLich[] = [];
  for (const sx of cm.sx.values()) {
    const td = mocDon(cm, sx);
    const [m1, m2, m3, m4, m5] = td.moc as [
      MocTinh,
      MocTinh,
      MocTinh,
      MocTinh,
      MocTinh,
    ];
    const nhan = ngayCua(sx.nhan?.at);
    const tre = (m: MocTinh) => m.muc === "do" || m.qua > 0;
    const ev: DonLich["ev"] = [];
    if (nhan) ev.push({ k: "nhan", ngay: nhan, xong: true });
    if (sx.tt === "nhan") {
      ev.push({
        k: "moc",
        ngay: m1.tt ?? m1.han,
        xong: Boolean(m1.tt),
        tre: tre(m1),
      });
      ev.push({
        k: "in",
        ngay: m2.tt ?? m2.han,
        den: m3.tt ?? m3.han,
        xong: Boolean(m3.tt),
        tre: tre(m3),
      });
      ev.push({
        k: "kiem",
        ngay: m4.tt ?? m4.han,
        xong: Boolean(m4.tt),
        tre: tre(m4),
      });
      ev.push({
        k: "giao",
        ngay: m5.tt ?? m5.han,
        xong: Boolean(m5.tt),
        tre: tre(m5),
      });
    }
    if (sx.ngayxuat) {
      ev.push({
        k: "pi",
        ngay: sx.ngayxuat,
        xong: Boolean(sx.giao?.ngay),
        tre: !sx.giao?.ngay && sx.ngayxuat < cm.hom,
      });
    }
    const ten = cm.don.get(sx.dh)?.n;
    ds.push({
      dh: sx.dh,
      ...(ten ? { ten } : {}),
      ...(sx.khach ? { khach: sx.khach } : {}),
      ...(sx.ngayxuat ? { ngayxuat: sx.ngayxuat } : {}),
      ...(nhan ? { nhan } : {}),
      ev,
      st:
        sx.tt === "nhan"
          ? td.moc.map((m) => ({
              k: m.ma,
              han: m.hanMax,
              ...(m.tt ? { tt: m.tt } : {}),
            }))
          : [],
    });
  }
  return ds.sort((a, b) => a.dh.localeCompare(b.dh));
}

export const GIAI_DOAN = [
  "Mộc",
  "Hoàn thiện",
  "In",
  "Kiểm hàng",
  "Giao hàng",
  "Đã giao",
] as const;

export type GiaiDoan = (typeof GIAI_DOAN)[number];

/**
 * Giai đoạn của một đơn vào ngày `ngay`: ngày đã qua / hôm nay tính theo ngày
 * thực tế; ngày tương lai tính theo kế hoạch (thực tế hoặc hạn).
 */
export function giaiDoanNgay(
  don: DonLich,
  ngay: string,
  hom: string,
): { giaiDoan: GiaiDoan; buoc: number; tre: boolean; han?: string } | null {
  if (don.st.length === 0 || !don.nhan || don.nhan > ngay) return null;
  const tuongLai = ngay > hom;
  for (let i = 0; i < don.st.length; i++) {
    const s = don.st[i] as DonLich["st"][number];
    const xongLuc = tuongLai ? (s.tt ?? s.han) : s.tt;
    if (!xongLuc || xongLuc > ngay) {
      return {
        giaiDoan: GIAI_DOAN[i] as GiaiDoan,
        buoc: i,
        tre: Boolean(s.han && s.han < ngay),
        ...(s.han ? { han: s.han } : {}),
      };
    }
  }
  return { giaiDoan: "Đã giao", buoc: 5, tre: false };
}

export { tenDt };
