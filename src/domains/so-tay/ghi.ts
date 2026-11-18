import "server-only";

import type { ClientSession } from "mongoose";

import type { MaTab, TenCollection } from "./hang-so";
import { tomTatThayDoi, truongThayDoi } from "./lich-su";
import { khongTimThay, LoiSoTay } from "./loi";
import { soTayModels, type SoTayModels } from "./models";
import { bayGio, rid } from "./tien-ich";

/**
 * Lớp ghi chung (mục 2, 9.3): mọi thao tác tạo / sửa / xóa / hủy của Sổ tay
 * đi qua đây để tự ghi một dòng `lichsu`, kèm ảnh "trước khi sửa" phục vụ
 * hoàn tác phiên chỉnh sửa.
 *
 * Truyền `session` (từ `trongGiaoDich`) khi một thao tác ghi nhiều tài liệu:
 * dòng lịch sử nằm cùng transaction nên không bao giờ lệch với dữ liệu.
 */

export type NguoiThaoTac = { email: string; ten: string };

export type BoiCanh = {
  nguoi: NguoiThaoTac;
  /** Tab đang thao tác; `null` với thao tác hệ thống (seed, đăng nhập). */
  tab: MaTab | null;
  /** Mã phiên chỉnh sửa (Chỉnh sửa → Lưu / Hủy). */
  phien?: string | null;
  session?: ClientSession;
};

export type TaiLieu = Record<string, unknown> & { _id: string };

type DongLichSu = {
  col: TenCollection;
  id: string;
  op: "Tạo mới" | "Sửa" | "Xóa" | "Hủy";
  tom: string;
  truoc: Record<string, unknown> | null;
};

async function ghiLichSu(
  m: SoTayModels,
  ctx: BoiCanh,
  dong: DongLichSu,
): Promise<void> {
  const dongMoi: Record<string, unknown> = {
    _id: rid("LS"),
    at: bayGio(),
    by: ctx.nguoi.email,
    ten: ctx.nguoi.ten,
    tk: ctx.nguoi.email,
    tab: ctx.tab ?? undefined,
    col: dong.col,
    id: dong.id,
    op: dong.op,
    tom: dong.tom,
    phien: ctx.phien ?? undefined,
    truoc: dong.truoc,
  };
  await m.lichsu.create([dongMoi], tuyChon(ctx));
}

/** Tùy chọn `session` chỉ khi đang trong transaction. */
function tuyChon(ctx: BoiCanh): { session?: ClientSession } {
  return ctx.session ? { session: ctx.session } : {};
}

function sach(doc: unknown): TaiLieu {
  return JSON.parse(JSON.stringify(doc)) as TaiLieu;
}

/** Tạo tài liệu mới; `by`/`at` tự điền nếu chưa có. */
export async function taoMoi(
  col: TenCollection,
  doc: TaiLieu,
  ctx: BoiCanh,
): Promise<TaiLieu> {
  const m = await soTayModels();
  const duLieu: Record<string, unknown> = {
    by: ctx.nguoi.email,
    at: bayGio(),
    ...doc,
  };
  const [tao] = await m[col].create([duLieu], tuyChon(ctx));
  if (!tao) throw new LoiSoTay("Không tạo được tài liệu.");
  const sau = sach(tao.toObject());
  await ghiLichSu(m, ctx, {
    col,
    id: doc._id,
    op: "Tạo mới",
    tom: tomTatThayDoi({ col, op: "Tạo mới", id: doc._id, sau }),
    truoc: null,
  });
  return sau;
}

/**
 * Sửa các trường trong `thayDoi` (trường mang giá trị `undefined` bị xóa).
 * Không có gì khác thì không ghi lịch sử.
 */
export async function sua(
  col: TenCollection,
  id: string,
  thayDoi: Record<string, unknown>,
  ctx: BoiCanh,
  op: "Sửa" | "Hủy" = "Sửa",
  lydo?: string,
): Promise<TaiLieu> {
  const m = await soTayModels();
  const tl = await m[col].findById(id).session(ctx.session ?? null);
  if (!tl) throw khongTimThay(`${col} ${id}`);

  const truoc = sach(tl.toObject());
  for (const [k, v] of Object.entries(thayDoi)) {
    if (k === "_id") continue;
    tl.set(k, v);
  }
  const sau = sach(tl.toObject());
  if (truongThayDoi(truoc, sau).length === 0) return truoc;

  await tl.save(tuyChon(ctx));
  await ghiLichSu(m, ctx, {
    col,
    id,
    op,
    tom: tomTatThayDoi({ col, op, id, truoc, sau, ...(lydo ? { lydo } : {}) }),
    truoc,
  });
  return sau;
}

/** Hủy chứng từ: đặt `huy: {lydo, by, at}`, không xóa thật. */
export async function huy(
  col: TenCollection,
  id: string,
  lydo: string,
  ctx: BoiCanh,
): Promise<TaiLieu> {
  const lyDo = lydo.trim();
  if (!lyDo) throw new LoiSoTay("Hủy phải ghi lý do.");

  const m = await soTayModels();
  const tl = await m[col]
    .findById(id)
    .session(ctx.session ?? null)
    .lean();
  if (!tl) throw khongTimThay(`${col} ${id}`);
  if ((tl as Record<string, unknown>).huy) {
    throw new LoiSoTay("Chứng từ này đã bị hủy trước đó.", 409);
  }

  return sua(
    col,
    id,
    { huy: { lydo: lyDo, by: ctx.nguoi.email, at: bayGio() } },
    ctx,
    "Hủy",
    lyDo,
  );
}

/** Xóa hẳn (chỉ dùng cho danh mục không còn tham chiếu, mục 6.4). */
export async function xoa(
  col: TenCollection,
  id: string,
  ctx: BoiCanh,
): Promise<void> {
  const m = await soTayModels();
  const tl = await m[col]
    .findById(id)
    .session(ctx.session ?? null)
    .lean();
  if (!tl) throw khongTimThay(`${col} ${id}`);

  const truoc = sach(tl);
  await m[col].deleteOne({ _id: id }, tuyChon(ctx));
  await ghiLichSu(m, ctx, {
    col,
    id,
    op: "Xóa",
    tom: tomTatThayDoi({ col, op: "Xóa", id, truoc }),
    truoc,
  });
}
