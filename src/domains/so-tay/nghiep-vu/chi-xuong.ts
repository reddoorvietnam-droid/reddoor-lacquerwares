/**
 * Chi tiêu xưởng (mục 7.9).
 */

import { NGUONG_DUYET_CHI_XUONG } from "../hang-so";
import type { ChiXuong } from "../kieu";
import { slug } from "../tien-ich";

/** Quỹ xưởng = Σ nạp − Σ khoản chi đã chi. */
export function quyXuong(ds: readonly ChiXuong[]): {
  nap: number;
  chi: number;
  con: number;
} {
  let nap = 0;
  let chi = 0;
  for (const c of ds) {
    if (c.kieu === "nap") nap += c.tien;
    else if (c.tt === "dachi") chi += c.tien;
  }
  return { nap, chi, con: nap - chi };
}

/** Khoản từ 1.000.000 đ phải chờ Giám đốc duyệt. */
export const canDuyet = (tien: number) => tien >= NGUONG_DUYET_CHI_XUONG;

export type CanhBaoChiaNho = {
  ngay: string;
  nguoinhan: string;
  so: number;
  tong: number;
};

/**
 * Nhiều khoản dưới 1 triệu cùng ngày, cùng người nhận mà cộng lại ≥ 1 triệu.
 * `moi` là khoản đang nhập (chưa lưu), để cảnh báo trước khi lưu.
 */
export function canhBaoChiaNho(
  ds: readonly ChiXuong[],
  moi?: { ngay: string; nguoinhan?: string | undefined; tien: number },
): CanhBaoChiaNho[] {
  const nhom = new Map<string, CanhBaoChiaNho>();
  const them = (c: {
    ngay: string;
    nguoinhan?: string | undefined;
    tien: number;
  }) => {
    if (!c.nguoinhan?.trim() || canDuyet(c.tien)) return;
    const k = `${c.ngay}|${slug(c.nguoinhan)}`;
    const x = nhom.get(k) ?? {
      ngay: c.ngay,
      nguoinhan: c.nguoinhan.trim(),
      so: 0,
      tong: 0,
    };
    x.so += 1;
    x.tong += c.tien;
    nhom.set(k, x);
  };
  for (const c of ds) if (c.kieu === "chi" && c.tt !== "tuchoi") them(c);
  if (moi) them(moi);
  return [...nhom.values()].filter(
    (x) => x.so >= 2 && x.tong >= NGUONG_DUYET_CHI_XUONG,
  );
}

/** Tổng chi đã chi theo loại trong tháng "YYYY-MM". */
export function tongTheoLoai(
  ds: readonly ChiXuong[],
  thang: string,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of ds) {
    if (c.kieu !== "chi" || c.tt !== "dachi" || !c.ngay.startsWith(thang))
      continue;
    const k = c.loai || "Khác";
    m.set(k, (m.get(k) ?? 0) + c.tien);
  }
  return m;
}
