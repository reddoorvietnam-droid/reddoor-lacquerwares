/**
 * Nạp dữ liệu Sổ chung cũ vào database Sổ tay (giai đoạn 2).
 *
 * Nguồn: file JSON xuất từ Sổ chung (mặc định
 * so_tay_red_door/_so_tay_nguon/SoTay_RedDoor_du_lieu_nap_MongoDB.json) và thư
 * mục ảnh `anh/` bên cạnh. Mỗi khóa của JSON là tên collection; mỗi tài liệu
 * giữ nguyên `_id` và tên trường, nạp đúng vào collection cùng tên.
 *
 * Chạy lại nhiều lần không nhân đôi: tài liệu cùng `_id` được thay bằng bản
 * trong file (dùng cho lần nạp cuối trước khi chuyển hẳn). Tài liệu chỉ có ở
 * Sổ tay mới không bị đụng tới.
 *
 *   npm run nap:so-tay -- --dry-run          chỉ kiểm tra, không ghi
 *   npm run nap:so-tay                        nạp
 *   npm run nap:so-tay -- --file=<đường dẫn>  chọn file JSON khác
 *
 * Sau khi nạp, script đối chiếu tổng RD còn nợ cơ sở với số mong đợi
 * (mặc định 2.913.366.000 đ, đổi bằng --tong-cong-no=<số>).
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import mongoose from "mongoose";

import { tenDbSoTay } from "@/domains/so-tay/db";
import { capNhatLich, taiCollections } from "@/domains/so-tay/du-lieu";
import { COLLECTIONS, type TenCollection } from "@/domains/so-tay/hang-so";
import { soTayModels } from "@/domains/so-tay/models";
import { taoChiMuc } from "@/domains/so-tay/nghiep-vu/chi-muc";
import { congNoTheoCap, noTienSon } from "@/domains/so-tay/nghiep-vu/cong-no";
import { tonKho } from "@/domains/so-tay/nghiep-vu/kho";
import { fm, rid } from "@/domains/so-tay/tien-ich";

const MAC_DINH =
  "so_tay_red_door/_so_tay_nguon/SoTay_RedDoor_du_lieu_nap_MongoDB.json";
const TONG_MONG_DOI = 2_913_366_000;
const NGUOI = "nap:so-tay";

/** Collection được phép nạp từ file (không nạp tài khoản, lịch sử, tóm tắt). */
const DUOC_NAP = new Set<TenCollection>([
  "doituong",
  "donhang",
  "vattu",
  "sodu",
  "sanxuat",
  "phancong",
  "giaohang",
  "hopdong",
  "congno",
  "thutien",
  "denghichi",
  "chixuong",
  "phieukho",
  "donmua",
  "chamcong",
  "luong",
  "nhanvienvp",
  "cauhinh",
]);

const LOAI_ANH: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

type TaiLieu = Record<string, unknown> & { _id: string };

function thamSo(ten: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${ten}=`));
  return a?.slice(ten.length + 3);
}

/** Kiểm tra tham chiếu giữa các collection trong file. */
function kiemThamChieu(du: Record<string, TaiLieu[]>): string[] {
  const loi: string[] = [];
  const dt = new Set((du.doituong ?? []).map((d) => d._id));
  const don = new Set((du.donhang ?? []).map((d) => d._id));
  const vt = new Set((du.vattu ?? []).map((d) => d._id));
  const pc = new Set((du.phancong ?? []).map((d) => d._id));
  const thieu = (ten: string, ids: Iterable<unknown>, co: Set<string>) => {
    const ds = [
      ...new Set(
        [...ids].filter((x): x is string => typeof x === "string" && x !== ""),
      ),
    ].filter((x) => !co.has(x));
    if (ds.length)
      loi.push(
        `${ten} trỏ tới mã không có: ${ds.slice(0, 10).join(", ")}${ds.length > 10 ? "…" : ""}`,
      );
  };
  const sd = (du.sodu?.[0] ?? {}) as {
    cn?: Array<{ d: string; o: string }>;
    son?: Array<{ d: string }>;
    tamtinh?: Array<{ o: string }>;
  };
  thieu(
    "sodu.cn.d",
    (sd.cn ?? []).map((c) => c.d),
    dt,
  );
  thieu(
    "sodu.cn.o",
    (sd.cn ?? []).map((c) => c.o),
    don,
  );
  thieu(
    "sodu.son.d",
    (sd.son ?? []).map((c) => c.d),
    dt,
  );
  thieu(
    "sodu.tamtinh.o",
    (sd.tamtinh ?? []).map((c) => c.o),
    don,
  );
  thieu(
    "phancong.dt",
    (du.phancong ?? []).map((p) => p.dt),
    dt,
  );
  thieu(
    "phancong.dh",
    (du.phancong ?? []).map((p) => p.dh),
    don,
  );
  thieu(
    "giaohang.pc",
    (du.giaohang ?? []).map((p) => p.pc),
    pc,
  );
  thieu(
    "chamcong.nv",
    (du.chamcong ?? []).map((p) => p.nv),
    dt,
  );
  thieu(
    "luong.nv",
    (du.luong ?? []).map((p) => p.nv),
    dt,
  );
  thieu(
    "nhanvienvp.nv",
    (du.nhanvienvp ?? []).map((p) => p.nv),
    dt,
  );
  thieu(
    "congno.dt",
    (du.congno ?? []).map((p) => p.dt),
    dt,
  );
  thieu(
    "phieukho.dong.vt",
    (du.phieukho ?? []).flatMap((p) =>
      ((p.dong as Array<{ vt: string }>) ?? []).map((d) => d.vt),
    ),
    vt,
  );
  return loi;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const file = path.resolve(thamSo("file") ?? MAC_DINH);
  const tongMongDoi = Number(thamSo("tong-cong-no") ?? TONG_MONG_DOI);
  const du = JSON.parse(await readFile(file, "utf8")) as Record<
    string,
    TaiLieu[]
  >;
  console.log(`[nap] file: ${file}`);

  const la = Object.keys(du).filter((k) => !DUOC_NAP.has(k as TenCollection));
  if (la.length)
    throw new Error(`File có collection không được nạp: ${la.join(", ")}`);
  const thieuId = Object.entries(du).flatMap(([col, ds]) =>
    ds.filter((d) => typeof d._id !== "string" || !d._id).map(() => col),
  );
  if (thieuId.length)
    throw new Error(
      `Có tài liệu thiếu _id trong: ${[...new Set(thieuId)].join(", ")}`,
    );

  const loiTc = kiemThamChieu(du);
  if (loiTc.length) throw new Error(`Tham chiếu sai:\n- ${loiTc.join("\n- ")}`);

  // Kiểm tra từng tài liệu theo schema trước khi ghi bất cứ thứ gì.
  const m = await soTayModels();
  const loi: string[] = [];
  for (const [col, ds] of Object.entries(du) as Array<
    [TenCollection, TaiLieu[]]
  >) {
    for (const d of ds) {
      try {
        await new m[col](d).validate();
      } catch (e) {
        const chiTiet =
          e instanceof mongoose.Error.ValidationError
            ? Object.values(e.errors)
                .map((x) => x.message)
                .join("; ")
            : e instanceof Error
              ? e.message
              : String(e);
        loi.push(`${col} ${d._id}: ${chiTiet}`);
      }
    }
  }
  if (loi.length)
    throw new Error(
      `Dữ liệu không khớp schema:\n- ${loi.slice(0, 30).join("\n- ")}`,
    );
  console.log("[nap] đã kiểm tra: schema và tham chiếu đều khớp.");

  const thuMucAnh = path.join(path.dirname(file), "anh");
  const tepAnh = await readdir(thuMucAnh).catch(() => [] as string[]);
  const anh = tepAnh.filter((f) => LOAI_ANH[path.extname(f).toLowerCase()]);
  const imgCan = new Set(
    (du.sanxuat ?? []).flatMap((s) =>
      ((s.items as Array<{ img?: string }>) ?? [])
        .map((i) => i.img)
        .filter(Boolean),
    ),
  );
  const thieuAnh = [...imgCan].filter((x) => !anh.includes(String(x)));
  if (thieuAnh.length)
    console.warn(`[nap] CẢNH BÁO: thiếu file ảnh: ${thieuAnh.join(", ")}`);

  for (const [col, ds] of Object.entries(du))
    console.log(`[nap] ${col.padEnd(11)} ${ds.length} tài liệu`);
  console.log(`[nap] anh        ${anh.length} file`);

  if (dryRun) {
    console.log(`[nap] dry-run: không ghi gì. Database đích: ${tenDbSoTay()}.`);
    return;
  }

  console.log(`[nap] database: ${tenDbSoTay()}`);
  const at = new Date().toISOString();
  for (const [col, ds] of Object.entries(du) as Array<
    [TenCollection, TaiLieu[]]
  >) {
    if (!ds.length) continue;
    // Đã kiểm tra theo schema ở trên; ghi nguyên văn bằng driver để không
    // thêm giá trị mặc định (luu: false, ls: []…) mà file nguồn không có.
    const kq = await m[col].collection.bulkWrite(
      ds.map((d) => ({
        replaceOne: {
          filter: { _id: d._id } as never,
          replacement: d as never,
          upsert: true,
        },
      })),
      { ordered: true },
    );
    console.log(
      `[nap] ${col.padEnd(11)} thêm ${kq.upsertedCount}, thay ${kq.modifiedCount}, giữ ${ds.length - kq.upsertedCount - kq.modifiedCount}`,
    );
    await m.lichsu.create({
      _id: rid("LS"),
      at,
      by: NGUOI,
      ten: "Nạp dữ liệu",
      tk: NGUOI,
      col,
      op: "Tạo mới",
      tom: `Nạp ${ds.length} tài liệu ${col} từ ${path.basename(file)}`,
      truoc: null,
    });
  }
  for (const f of anh) {
    const buf = await readFile(path.join(thuMucAnh, f));
    await m.anh.replaceOne(
      { _id: f },
      {
        _id: f,
        loai: LOAI_ANH[path.extname(f).toLowerCase()],
        du: buf,
        by: NGUOI,
        at,
      },
      { upsert: true },
    );
  }
  if (anh.length) console.log(`[nap] anh        ${anh.length} file`);

  await capNhatLich();
  console.log("[nap] đã tính lại lịch sản xuất (tomtat.lich).");

  // Đối chiếu sau khi nạp, đọc lại từ database.
  const sau = await taiCollections(
    [
      "doituong",
      "donhang",
      "vattu",
      "sanxuat",
      "phancong",
      "giaohang",
      "hopdong",
      "congno",
      "thutien",
      "denghichi",
      "phieukho",
    ],
    { sodu: true },
  );
  const cm = taoChiMuc(sau);
  const tong = congNoTheoCap(cm).reduce((s, x) => s + x.conNo, 0);
  const son = [...noTienSon(cm).values()].reduce((s, x) => s + x, 0);
  const ton = tonKho(sau.vattu ?? [], sau.phieukho ?? [], sau.sodu?.ngay);
  for (const col of COLLECTIONS) {
    const n = await m[col].countDocuments();
    if (n) console.log(`[nap] trong DB: ${col.padEnd(11)} ${n}`);
  }
  console.log(
    `[nap] Tổng RD còn nợ cơ sở: ${fm(tong)} đ (mong đợi ${fm(tongMongDoi)} đ)`,
  );
  console.log(
    `[nap] Cơ sở nợ RD tiền sơn: ${fm(son)} đ · ${ton.size} vật tư có tồn`,
  );
  if (tong !== tongMongDoi) {
    process.exitCode = 2;
    console.error("[nap] LỆCH: tổng công nợ không khớp số mong đợi.");
  } else {
    console.log("[nap] KHỚP: tổng công nợ đúng số mong đợi.");
  }
}

main()
  .catch((error: unknown) => {
    console.error("[nap] lỗi:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
