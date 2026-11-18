import "server-only";

import { CANH_BAO_MAC_DINH, type CauHinhCanhBao, type MaTab } from "./hang-so";
import type { DonLich, DuLieu, LichSu, NguoiSoTay, SoDu } from "./kieu";
import { ID_CANHBAO, ID_LICH, ID_SODU, soTayModels } from "./models";
import { taoChiMuc } from "./nghiep-vu/chi-muc";
import { tomTatLich, viecHomNay, type ViecHomNay } from "./nghiep-vu/tien-do";
import { bayGio } from "./tien-ich";

type Mang = Exclude<keyof DuLieu, "sodu" | "cauhinh" | "ganDay">;

const SAN_XUAT: Mang[] = [
  "sanxuat",
  "phancong",
  "giaohang",
  "hopdong",
  "donhang",
  "doituong",
];
const TIEN: Mang[] = ["congno", "denghichi", "thutien", "phieukho"];

/** Collection mỗi tab cần. */
const CAN: Record<MaTab, { mang: Mang[]; sodu?: true; ganDay?: true }> = {
  tongquan: {
    mang: [...SAN_XUAT, ...TIEN, "vattu", "chixuong"],
    sodu: true,
    ganDay: true,
  },
  donmoi: { mang: SAN_XUAT },
  donhang: { mang: [...SAN_XUAT, ...TIEN, "vattu"], sodu: true },
  sanxuat: { mang: [...SAN_XUAT, ...TIEN, "vattu"] },
  coso: { mang: [...SAN_XUAT, ...TIEN, "vattu"], sodu: true },
  congno: { mang: [...SAN_XUAT, ...TIEN], sodu: true },
  chi: { mang: ["denghichi", "doituong", "donhang"] },
  nhancong: {
    mang: [
      "doituong",
      "chamcong",
      "phancong",
      "sanxuat",
      "giaohang",
      "donhang",
    ],
  },
  nhancongvp: { mang: ["doituong", "nhanvienvp", "luong"] },
  bangluong: { mang: ["luong"] },
  kho: { mang: ["phieukho", "vattu", "doituong", "donhang"], sodu: true },
  ton: { mang: ["vattu", "phieukho"], sodu: true },
  muavt: { mang: ["vattu", "phieukho", "donmua", "doituong"], sodu: true },
  chixuong: { mang: ["chixuong", "donhang"] },
  danhmuc: { mang: ["doituong", "donhang", "vattu", "taikhoan"] },
};

export async function taiCauHinh(): Promise<CauHinhCanhBao> {
  const m = await soTayModels();
  const ch = (await m.cauhinh
    .findById(ID_CANHBAO)
    .lean()) as Partial<CauHinhCanhBao> | null;
  if (!ch?.mau?.length) return CANH_BAO_MAC_DINH;
  return { baoTruoc: ch.baoTruoc ?? CANH_BAO_MAC_DINH.baoTruoc, mau: ch.mau };
}

const BO_TRUONG = { __v: 0 } as const;

/** Tải các collection (đủ dữ liệu, kể cả chứng từ đã hủy). */
export async function taiCollections(
  mang: readonly Mang[],
  them: { sodu?: boolean; ganDay?: boolean } = {},
): Promise<DuLieu> {
  const m = await soTayModels();
  const du: DuLieu = {};
  await Promise.all([
    ...[...new Set(mang)].map(async (ten) => {
      const ds = await m[ten].find({}, BO_TRUONG).lean();
      (du as Record<string, unknown>)[ten] = ds;
    }),
    (async () => {
      du.cauhinh = await taiCauHinh();
    })(),
    them.sodu
      ? (async () => {
          du.sodu =
            ((await m.sodu.findById(ID_SODU).lean()) as SoDu | null) ?? null;
        })()
      : Promise.resolve(),
    them.ganDay
      ? (async () => {
          du.ganDay = (await m.lichsu
            .find({ op: { $ne: "Đăng nhập" } }, { truoc: 0 })
            .sort({ at: -1 })
            .limit(30)
            .lean()) as unknown as LichSu[];
        })()
      : Promise.resolve(),
  ]);
  return du;
}

export async function taiTab(tab: MaTab, nguoi: NguoiSoTay): Promise<DuLieu> {
  const can = CAN[tab];
  const du = await taiCollections(can.mang, {
    sodu: Boolean(can.sodu),
    ganDay: Boolean(can.ganDay),
  });
  // Bảng tài khoản (email + vai trò) chỉ Giám đốc xem.
  if (tab === "danhmuc" && nguoi.vaitro !== "quanly") {
    du.taikhoan = (du.taikhoan ?? []).filter((t) => t.email === nguoi.email);
  }
  return du;
}

/** Tất cả dữ liệu (dùng cho kiểm tra tham chiếu trước khi xóa danh mục). */
export async function taiTatCa(): Promise<DuLieu> {
  return taiCollections(
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
      "chixuong",
      "phieukho",
      "donmua",
      "chamcong",
      "luong",
      "nhanvienvp",
    ],
    { sodu: true },
  );
}

/**
 * Tính lại `tomtat.lich` mỗi khi dữ liệu sản xuất đổi. Lịch sản xuất chỉ đọc
 * tài liệu nhỏ này nên hiện nhanh.
 */
export async function capNhatLich(): Promise<void> {
  const du = await taiCollections([
    "sanxuat",
    "phancong",
    "giaohang",
    "hopdong",
    "donhang",
  ]);
  const don = tomTatLich(taoChiMuc(du));
  const m = await soTayModels();
  await m.tomtat.updateOne(
    { _id: ID_LICH },
    { $set: { don, at: bayGio() } },
    { upsert: true },
  );
}

export type TrangDau = {
  lich: DonLich[];
  viec: ViecHomNay[];
};

export async function taiTrangDau(): Promise<TrangDau> {
  const m = await soTayModels();
  const [tt, du] = await Promise.all([
    m.tomtat.findById(ID_LICH).lean() as Promise<{ don?: DonLich[] } | null>,
    taiCollections([...SAN_XUAT, "congno", "denghichi"]),
  ]);
  return { lich: tt?.don ?? [], viec: viecHomNay(taoChiMuc(du)) };
}
