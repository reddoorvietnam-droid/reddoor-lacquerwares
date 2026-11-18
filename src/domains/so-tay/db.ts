import "server-only";

import type { ClientSession, Connection } from "mongoose";

import { connectToDatabase } from "@/lib/db/mongoose";

/**
 * Sổ tay dùng database riêng trên cùng cụm MongoDB với website (quyết định
 * 17/11/2026), để dữ liệu sổ không lẫn với dữ liệu website. Dùng chung kết
 * nối (`useDb`) nên không mở thêm pool, và transaction chạy được qua
 * `trongGiaoDich`.
 */
export const TEN_DB_MAC_DINH = "reddoor_sotay";

export function tenDbSoTay(env: NodeJS.ProcessEnv = process.env): string {
  const ten = env.SOTAY_DB_NAME?.trim();
  return ten ? ten : TEN_DB_MAC_DINH;
}

export async function ketNoiSoTay(): Promise<Connection> {
  const mongoose = await connectToDatabase();
  return mongoose.connection.useDb(tenDbSoTay(), { useCache: true });
}

/**
 * Chạy `viec` trong một MongoDB transaction (ví dụ: chi đề nghị → tạo bút toán
 * công nợ + cập nhật đề nghị). Mọi thao tác bên trong phải truyền `session`.
 */
export async function trongGiaoDich<T>(
  viec: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const db = await ketNoiSoTay();
  const session = await db.startSession();
  try {
    let ketQua: T | undefined;
    await session.withTransaction(async () => {
      ketQua = await viec(session);
    });
    return ketQua as T;
  } finally {
    await session.endSession();
  }
}
