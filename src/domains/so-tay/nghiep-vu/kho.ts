/**
 * Kho (mục 7.8): tồn kho = tồn đầu kỳ + nhập − xuất kể từ ngày chốt, bỏ
 * phiếu đã hủy; cảnh báo theo mức vàng / đỏ.
 */

import { LOAI } from "../hang-so";
import type { PhieuKho, VatTu } from "../kieu";

const HUONG = new Map<string, 1 | -1>(LOAI.map((l) => [l.ten, l.h]));

/** Tồn hiện tại của từng vật tư. Phiếu ngày ≤ ngày chốt đã nằm trong tồn đầu kỳ. */
export function tonKho(
  vattu: readonly VatTu[],
  phieu: readonly PhieuKho[],
  ngayChot?: string | null,
): Map<string, number> {
  const ton = new Map<string, number>(vattu.map((v) => [v._id, v.t ?? 0]));
  for (const p of phieu) {
    if (p.huy) continue;
    if (ngayChot && p.ngay <= ngayChot) continue;
    const h = HUONG.get(p.loai) ?? 0;
    for (const d of p.dong) {
      ton.set(d.vt, (ton.get(d.vt) ?? 0) + h * (d.sl ?? 0));
    }
  }
  for (const [k, v] of ton) ton.set(k, Math.round(v * 1000) / 1000);
  return ton;
}

export type TrangThaiKho = "am" | "do" | "vang" | "ok";

export function stat(ton: number, vt: Pick<VatTu, "y" | "r">): TrangThaiKho {
  if (ton < 0) return "am";
  if (vt.r !== undefined && vt.r !== null && ton < vt.r) return "do";
  if (vt.y !== undefined && vt.y !== null && ton < vt.y) return "vang";
  return "ok";
}

export const NHAN_KHO: Record<TrangThaiKho, string> = {
  am: "Âm – kiểm kê",
  do: "Đỏ",
  vang: "Vàng",
  ok: "",
};

/**
 * Mức cảnh báo mặc định khi thêm vật tư: sơn lót / sơn phủ vàng dưới 400 kg,
 * đỏ dưới 200 kg; dung môi vàng dưới 200 kg; còn lại chỉ nhắc (không mức).
 */
export function mucMacDinh(
  ten: string,
  nhom?: string,
): { y?: number; r?: number } {
  const s = `${ten} ${nhom ?? ""}`.toLowerCase();
  if (s.includes("sơn lót") || s.includes("sơn phủ")) return { y: 400, r: 200 };
  if (s.includes("dung môi")) return { y: 200 };
  return {};
}
