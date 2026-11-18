/**
 * Seed cấu hình Sổ tay (tài liệu `so_tay` mục 11). Chạy lại nhiều lần không bị
 * nhân đôi và không ghi đè chỗ Giám đốc đã sửa (mọi thứ dùng `$setOnInsert`).
 *
 * Tạo: mọi collection kèm index, `cauhinh.canhbao` (mẫu tiến độ mặc định),
 * tài liệu `sodu` rỗng, tài liệu `tomtat.lich` rỗng.
 *
 * KHÔNG tạo: tài khoản (ai đăng nhập khu quản trị bằng Gmail thì tự có, vai
 * trò lấy theo khu quản trị), đối tượng, vật tư, đơn hàng, công nợ.
 *
 *   npm run seed:so-tay -- --dry-run   chỉ kiểm tra, không ghi
 *   npm run seed:so-tay                tạo collection, index, cấu hình
 */

import mongoose from "mongoose";

import { tenDbSoTay } from "@/domains/so-tay/db";
import { CANH_BAO_MAC_DINH, COLLECTIONS } from "@/domains/so-tay/hang-so";
import {
  ID_CANHBAO,
  ID_LICH,
  ID_SODU,
  soTayModels,
} from "@/domains/so-tay/models";

const NGUOI_SEED = "seed:so-tay";

function kiemTraCauHinh(): string[] {
  const loi: string[] = [];
  const { mau, baoTruoc } = CANH_BAO_MAC_DINH;
  if (!(baoTruoc >= 0)) loi.push("baoTruoc phải ≥ 0.");
  mau.forEach((m, i) => {
    const truoc = i > 0 ? mau[i - 1]?.den : undefined;
    if (truoc !== undefined && truoc >= m.den)
      loi.push(`Mẫu "${m.ten}": den phải tăng dần.`);
  });
  return loi;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  const loi = kiemTraCauHinh();
  if (loi.length > 0) {
    throw new Error(`Cấu hình mặc định sai:\n- ${loi.join("\n- ")}`);
  }

  if (dryRun) {
    console.log(
      `[so-tay] dry-run: cấu hình hợp lệ. Sẽ dùng database "${tenDbSoTay()}" với ${COLLECTIONS.length} collection.`,
    );
    return;
  }

  const m = await soTayModels();
  console.log(`[so-tay] database: ${tenDbSoTay()}`);

  for (const ten of COLLECTIONS) {
    const model = m[ten];
    await model.createCollection();
    await model.syncIndexes();
    const indexes = await model.collection.indexes();
    const ds = indexes.map((i) => i.name).join(", ");
    console.log(`[so-tay] ${ten.padEnd(11)} index: ${ds}`);
  }

  const at = new Date().toISOString();
  const tao = async (
    ten: "cauhinh" | "sodu" | "tomtat",
    id: string,
    duLieu: Record<string, unknown>,
  ) => {
    const kq = await m[ten].updateOne(
      { _id: id },
      { $setOnInsert: { _id: id, ...duLieu } },
      { upsert: true, runValidators: true },
    );
    console.log(
      `[so-tay] ${ten}.${id}: ${kq.upsertedCount > 0 ? "đã tạo" : "đã có, giữ nguyên"}`,
    );
  };

  await tao("cauhinh", ID_CANHBAO, {
    ...CANH_BAO_MAC_DINH,
    by: NGUOI_SEED,
    at,
  });
  await tao("sodu", ID_SODU, {
    ngay: null,
    cn: [],
    son: [],
    tamtinh: [],
    by: NGUOI_SEED,
    at,
  });
  await tao("tomtat", ID_LICH, { don: [], at });

  console.log("[so-tay] xong.");
}

main()
  .catch((error: unknown) => {
    console.error("[so-tay] lỗi:", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
