import "server-only";

import { cache } from "react";

import { resolveActiveRoleKeys, resolveSignedInProfile } from "@/lib/auth";

import { coQuyen, type MaTab, type Viec, vaiTroSoTay, xemTab } from "./hang-so";
import type { NguoiSoTay, TaiKhoan } from "./kieu";
import { LoiSoTay } from "./loi";
import { soTayModels } from "./models";
import { bayGio, rid } from "./tien-ich";

/**
 * Ai đang dùng Sổ tay. Đăng nhập là đăng nhập Google của khu quản trị; vai trò
 * Sổ tay lấy theo vai trò khu quản trị, trừ khi Giám đốc đã gán tay
 * (`taikhoan.vaitro`). Mọi kiểm tra quyền của Sổ tay đều đi qua đây.
 */
export const nguoiSoTay = cache(async (): Promise<NguoiSoTay | null> => {
  const [profile, vaiQuanTri] = await Promise.all([
    resolveSignedInProfile(),
    resolveActiveRoleKeys(),
  ]);
  if (!profile || vaiQuanTri.length === 0) return null;

  const email = profile.email.toLowerCase();
  const m = await soTayModels();
  const tk = (await m.taikhoan.findById(email).lean()) as TaiKhoan | null;
  if (tk?.hoatdong === false) return null;

  const vaitro = vaiTroSoTay(vaiQuanTri, tk?.vaitro ?? null);
  if (!vaitro) return null;

  const ten = tk?.ten?.trim() || profile.displayName?.trim() || email;
  return {
    email,
    ten,
    vaitro,
    chao: tk?.chao?.trim() || `Xin chào ${ten}, chúc một ngày tốt lành!`,
  };
});

/** Thanh bên trái chỉ hiện "Sổ tay" cho người có vai trò Sổ tay. */
export const canSeeSoTay = cache(async (): Promise<boolean> => {
  try {
    return (await nguoiSoTay()) !== null;
  } catch {
    return false;
  }
});

export async function yeuCauNguoi(): Promise<NguoiSoTay> {
  const [profile, nguoi] = await Promise.all([
    resolveSignedInProfile(),
    nguoiSoTay(),
  ]);
  if (!profile) throw new LoiSoTay("Bạn chưa đăng nhập.", 401);
  if (!nguoi)
    throw new LoiSoTay("Tài khoản chưa được cấp quyền vào Sổ tay.", 403);
  return nguoi;
}

export function yeuCauViec(nguoi: NguoiSoTay, viec: Viec): void {
  if (!coQuyen(nguoi.vaitro, viec)) {
    throw new LoiSoTay("Bạn không có quyền làm việc này.", 403);
  }
}

export function yeuCauVai(nguoi: NguoiSoTay, vai: readonly string[]): void {
  if (nguoi.vaitro !== "quanly" && !vai.includes(nguoi.vaitro)) {
    throw new LoiSoTay("Bạn không có quyền làm việc này.", 403);
  }
}

export function yeuCauTab(nguoi: NguoiSoTay, tab: MaTab): void {
  if (!xemTab(nguoi.vaitro, tab)) {
    throw new LoiSoTay("Bạn không có quyền xem tab này.", 403);
  }
}

const TAM_PHIEN_MS = 8 * 60 * 60 * 1000;

/**
 * Lần mở Sổ tay đầu tiên của một phiên đăng nhập (8 giờ) ghi một dòng lịch sử
 * "Đăng nhập", và lưu tên người dùng để Giám đốc thấy trong tab Danh mục.
 */
export async function ghiVaoSo(nguoi: NguoiSoTay): Promise<void> {
  const m = await soTayModels();
  await m.taikhoan.updateOne(
    { _id: nguoi.email },
    {
      $setOnInsert: {
        _id: nguoi.email,
        email: nguoi.email,
        hoatdong: true,
        at: bayGio(),
      },
      $set: { ten: nguoi.ten },
    },
    { upsert: true },
  );
  const gan = await m.lichsu
    .findOne({ tk: nguoi.email, op: "Đăng nhập" })
    .sort({ at: -1 })
    .lean();
  const lan = gan ? Date.parse(String((gan as { at?: string }).at)) : 0;
  if (Date.now() - lan < TAM_PHIEN_MS) return;
  await m.lichsu.create({
    _id: rid("LS"),
    at: bayGio(),
    by: nguoi.email,
    ten: nguoi.ten,
    tk: nguoi.email,
    op: "Đăng nhập",
    tom: `${nguoi.ten} đăng nhập Sổ tay`,
    truoc: null,
  });
}
