import "server-only";

import {
  type Connection,
  type Model,
  Schema,
  type SchemaDefinition,
  type SchemaTypeOptions,
} from "mongoose";

import {
  CP,
  HINH_THUC,
  KHO_VT,
  LOAI_CHI,
  LOAI_DE_NGHI,
  LOAI_DT,
  NV_DS,
  TEN_KHAU,
  TEN_LOAI_PHIEU,
  THAO_TAC,
  TT_DE_NGHI,
  VAI_TRO,
  type TenCollection,
} from "./hang-so";
import { ketNoiSoTay } from "./db";

/**
 * Mô hình dữ liệu Sổ tay (tài liệu `so_tay` mục 5).
 *
 * Tên collection và tên trường ngắn giữ đúng tài liệu để giai đoạn 2 nạp
 * thẳng file JSON xuất từ Sổ chung cũ. `_id` luôn là chuỗi: mã gốc (đối tượng,
 * đơn, vật tư), mã ghép (`${dh}~${dt}`…) hoặc mã chứng từ `rid()`.
 *
 * `strict: "throw"`: trường lạ bị từ chối ngay, không âm thầm bỏ đi.
 */

const chuoi = { type: String, trim: true };
const so = { type: Number };
/** Số tiền VND: số nguyên. */
const tien = {
  type: Number,
  validate: {
    validator: (v: unknown) =>
      v === null || v === undefined || Number.isInteger(v),
    message: "Số tiền phải là số nguyên (đồng).",
  },
};
/** Ngày "YYYY-MM-DD". */
const ngay: SchemaTypeOptions<string> = {
  type: String,
  match: [/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có dạng YYYY-MM-DD."],
};

const conOpts = { _id: false, strict: "throw" as const, minimize: false };

function con(definition: SchemaDefinition): Schema {
  return new Schema(definition, conOpts);
}

/** `huy: {lydo, by, at}`: hủy chứng từ, không xóa thật. */
const huySchema = con({ lydo: chuoi, by: chuoi, at: chuoi });
const nguoiLucSchema = con({ by: chuoi, at: chuoi });

/** `by` (người tạo) và `at` (ISO datetime) có ở mọi tài liệu nghiệp vụ. */
const nguoiTao = { by: chuoi, at: chuoi };

function goc(collection: TenCollection, definition: SchemaDefinition): Schema {
  return new Schema(
    { _id: { type: String, required: true }, ...definition },
    {
      collection,
      strict: "throw",
      minimize: false,
      versionKey: false,
    },
  );
}

// ---------------------------------------------------------------- 5.1 Danh mục

const doituong = goc("doituong", {
  c: { ...chuoi, required: true },
  n: { ...chuoi, required: [true, "Phải ghi đủ họ tên / tên cơ sở."] },
  l: { type: String, enum: LOAI_DT, required: true },
  g: chuoi,
  so: chuoi,
  p: chuoi,
  cccd: chuoi,
  note: chuoi,
  m: { type: Number, enum: [0, 1], default: 0 },
  luu: { type: Boolean, default: false },
  ...nguoiTao,
});
doituong.index({ so: 1 });
doituong.index({ l: 1, g: 1 });

const donhang = goc("donhang", {
  c: { ...chuoi, required: true },
  k: chuoi,
  n: chuoi,
  ...nguoiTao,
});

const vattu = goc("vattu", {
  c: { ...chuoi, required: true },
  n: chuoi,
  k: { type: String, enum: Object.keys(KHO_VT) },
  g: chuoi,
  u: chuoi,
  t: so,
  gv: so,
  y: so,
  r: so,
  ...nguoiTao,
});

// ---------------------------------------------------------------- 5.2 Số dư chốt

const sodu = goc("sodu", {
  ngay,
  nguon: chuoi,
  cn: {
    type: [
      con({
        d: chuoi,
        o: chuoi,
        cp: chuoi,
        hd: tien,
        tra: tien,
        ct: {
          type: [con({ n: chuoi, nv: chuoi, t: tien, f: chuoi, gc: chuoi })],
          default: [],
        },
      }),
    ],
    default: [],
  },
  son: { type: [con({ d: chuoi, amt: tien })], default: [] },
  /** Giá trị hợp đồng tạm tính: KHÔNG cộng vào công nợ. */
  tamtinh: { type: [con({ o: chuoi, tien })], default: [] },
  ...nguoiTao,
});

// ---------------------------------------------------------------- 5.3 Sản xuất

const maHangSchema = con({
  /** Mã đơn (Sổ chung cũ lưu kèm trong từng mã hàng). */
  dh: chuoi,
  ma: chuoi,
  mt: chuoi,
  L: so,
  W: so,
  H: so,
  qty: so,
  u: chuoi,
  img: chuoi,
  in: Boolean,
  inner: so,
  io: so,
  oL: so,
  oW: so,
  oH: so,
  ktsx: chuoi,
  ktsxBy: chuoi,
  ktsxAt: chuoi,
});

const sanxuat = goc("sanxuat", {
  dh: { ...chuoi, required: true },
  khach: chuoi,
  ngayxuat: ngay,
  items: { type: [maHangSchema], default: [] },
  tt: { type: String, enum: ["moi", "nhan"], default: "moi" },
  nhan: nguoiLucSchema,
  mau: chuoi,
  moc: con({ m1: ngay, m2: ngay, m3: ngay, m4: ngay, m5: ngay }),
  qc1: con({ ngay, by: chuoi }),
  giao: con({ ngay, by: chuoi }),
  ...nguoiTao,
});
sanxuat.index({ dh: 1 });
sanxuat.index({ tt: 1 });

const phancong = goc("phancong", {
  dh: { ...chuoi, required: true },
  ma: chuoi,
  khau: { type: String, enum: TEN_KHAU, required: true },
  dt: chuoi,
  sl: so,
  /** Đơn giá tạm tính. */
  dg: tien,
  han: ngay,
  ghichu: chuoi,
  /** Mã cơ sở hoàn thiện bị trừ tiền khi nhà máy làm Nhập kho thay. */
  tru: chuoi,
  /** Lịch sử đổi đơn giá. */
  ls: { type: [con({ dg: tien, at: chuoi, by: chuoi })], default: [] },
  huy: huySchema,
  ...nguoiTao,
});
phancong.index({ dh: 1 });
phancong.index({ dt: 1 });

const giaohang = goc("giaohang", {
  dh: chuoi,
  /** Id phần việc. */
  pc: { ...chuoi, required: true },
  ngay: { ...ngay, required: true },
  /** Số đạt. */
  sl: so,
  loi: so,
  /** Bắt buộc khi có lỗi (kiểm ở lớp nghiệp vụ). */
  ghichu: chuoi,
  huy: huySchema,
  ...nguoiTao,
});
giaohang.index({ pc: 1 });
giaohang.index({ dh: 1 });
giaohang.index({ ngay: -1 });

const hopdong = goc("hopdong", {
  dh: { ...chuoi, required: true },
  dt: { ...chuoi, required: true },
  so: chuoi,
  ngay,
  /** Giá trị lúc ký. */
  gt: tien,
  /** Các lần ký trước. */
  ls: {
    type: [con({ so: chuoi, ngay, gt: tien, by: chuoi, at: chuoi })],
    default: [],
  },
  ...nguoiTao,
});
hopdong.index({ dh: 1 });
hopdong.index({ dt: 1 });

// ---------------------------------------------------------------- 5.4 Tiền

const congno = goc("congno", {
  ngay: { ...ngay, required: true },
  dh: chuoi,
  dt: { ...chuoi, required: true },
  cp: { type: String, enum: CP },
  nv: { type: String, enum: NV_DS, required: true },
  tien: { ...tien, required: true, min: [1, "Số tiền phải lớn hơn 0."] },
  /** Số hợp đồng. */
  hd: chuoi,
  ghichu: chuoi,
  /** "chi" nếu sinh từ đề nghị chi. */
  nguon: chuoi,
  /** Id đề nghị chi. */
  dn: chuoi,
  huy: huySchema,
  ...nguoiTao,
});
congno.index({ dh: 1 });
congno.index({ dt: 1 });
congno.index({ ngay: -1 });

const thutien = goc("thutien", {
  ngay: { ...ngay, required: true },
  dt: { ...chuoi, required: true },
  tien: { ...tien, required: true, min: [1, "Số tiền phải lớn hơn 0."] },
  ht: { type: String, enum: HINH_THUC },
  nd: chuoi,
  huy: huySchema,
  ...nguoiTao,
});
thutien.index({ dt: 1 });
thutien.index({ ngay: -1 });

const denghichi = goc("denghichi", {
  ngay: { ...ngay, required: true },
  dh: chuoi,
  dt: { ...chuoi, required: true },
  cp: { type: String, enum: CP },
  loai: { type: String, enum: LOAI_DE_NGHI, required: true },
  tien: { ...tien, required: true, min: [1, "Số tiền phải lớn hơn 0."] },
  han: ngay,
  hd: chuoi,
  ghichu: chuoi,
  tt: { type: String, enum: TT_DE_NGHI, default: "cho" },
  chi: con({
    ngay,
    tien,
    ht: { type: String, enum: HINH_THUC },
    /** Id bút toán công nợ sinh ra khi chi. */
    cn: chuoi,
    by: chuoi,
    at: chuoi,
  }),
  tuchoi: con({ lydo: chuoi, by: chuoi, at: chuoi }),
  ...nguoiTao,
});
denghichi.index({ tt: 1 });
denghichi.index({ dh: 1 });
denghichi.index({ dt: 1 });
denghichi.index({ ngay: -1 });

const chixuong = goc("chixuong", {
  kieu: { type: String, enum: ["chi", "nap"], required: true },
  ngay: { ...ngay, required: true },
  /** Loại chi (LOAI_CHI); để trống với khoản nạp quỹ. */
  loai: { type: String, enum: LOAI_CHI },
  nd: chuoi,
  tien: { ...tien, required: true, min: [1, "Số tiền phải lớn hơn 0."] },
  nguoinhan: chuoi,
  dh: chuoi,
  ghichu: chuoi,
  tt: { type: String, enum: TT_DE_NGHI },
  duyet: nguoiLucSchema,
  chi: con({ ngay, by: chuoi, at: chuoi }),
  tuchoi: con({ lydo: chuoi, by: chuoi, at: chuoi }),
  ...nguoiTao,
});
chixuong.index({ tt: 1 });
chixuong.index({ ngay: -1 });
chixuong.index({ dh: 1 });

// ---------------------------------------------------------------- 5.5 Kho

const dongVatTu = con({ vt: { ...chuoi, required: true }, sl: so, dg: tien });

const phieukho = goc("phieukho", {
  so: { ...chuoi, required: true },
  ngay: { ...ngay, required: true },
  loai: { type: String, enum: TEN_LOAI_PHIEU, required: true },
  dt: chuoi,
  dh: chuoi,
  ghichu: chuoi,
  dong: { type: [dongVatTu], default: [] },
  huy: huySchema,
  ...nguoiTao,
});
phieukho.index({ ngay: -1 });
phieukho.index({ dh: 1 });
phieukho.index({ dt: 1 });
phieukho.index({ "dong.vt": 1 });

const donmua = goc("donmua", {
  so: { ...chuoi, required: true },
  ngay: { ...ngay, required: true },
  ncc: chuoi,
  han: ngay,
  ghichu: chuoi,
  dong: { type: [dongVatTu], default: [] },
  tt: { type: String, enum: ["dat", "nhan"], default: "dat" },
  nhan: con({ ngay, phieu: chuoi, by: chuoi, at: chuoi }),
  huy: huySchema,
  ...nguoiTao,
});
donmua.index({ tt: 1 });
donmua.index({ ngay: -1 });

// ---------------------------------------------------------------- 5.6 Nhân sự

const chamcong = goc("chamcong", {
  ngay: { ...ngay, required: true },
  /** Mã đối tượng nhân sự. */
  nv: { ...chuoi, required: true },
  /** 1 | 0.5 | 0, hoặc số lẻ cũ như 0.75, 1.5. */
  cong: { type: Number, min: 0 },
  /** Giờ tăng ca. */
  tc: { type: Number, min: 0 },
  ghichu: chuoi,
  ...nguoiTao,
});
chamcong.index({ ngay: 1 });
chamcong.index({ nv: 1, ngay: 1 });

const luong = goc("luong", {
  /** "YYYY-MM". */
  thang: {
    type: String,
    required: true,
    match: [/^\d{4}-\d{2}$/, "Tháng phải có dạng YYYY-MM."],
  },
  nv: { ...chuoi, required: true },
  ten: chuoi,
  khoi: { type: String, enum: ["Nhà máy", "Văn phòng"] },
  muc: so,
  cong_hc: so,
  cong_ng: so,
  cong_cn: so,
  cong_phat: so,
  tong_cong: so,
  gio_tc: so,
  ngay_cn: so,
  gio_tc_cn: so,
  tien_luong: so,
  phucap: so,
  an_trua: so,
  tam_ung: so,
  bh_nld: so,
  tong_thu_nhap: so,
  thuc_nhan: so,
  ghichu: chuoi,
  ...nguoiTao,
});
luong.index({ thang: 1 });
luong.index({ nv: 1 });

const nhanvienvp = goc("nhanvienvp", {
  nv: { ...chuoi, required: true },
  /** Lương cố định / tháng. */
  luong: tien,
  congviec: chuoi,
  ghichu: chuoi,
  ...nguoiTao,
});

// ---------------------------------------------------------------- 5.7 Hệ thống

/**
 * Người dùng Sổ tay, `_id` = email (chữ thường). Đăng nhập dùng Google của
 * khu quản trị nên không có trường mật khẩu. `vaitro` là vai trò Giám đốc gán
 * tay; để trống thì suy ra từ vai trò khu quản trị (`vaiTroSoTay`).
 */
const taikhoan = goc("taikhoan", {
  email: { ...chuoi, lowercase: true, required: true },
  ten: chuoi,
  chao: chuoi,
  vaitro: { type: String, enum: VAI_TRO, default: null },
  hoatdong: { type: Boolean, default: true },
  ...nguoiTao,
});

const soNgay = { type: Number, required: true, min: 0 };
const mauTienDoSchema = con({
  ten: { ...chuoi, required: true },
  den: { type: Number, required: true },
  ngay: con({ m1: soNgay, m2: soNgay, m3: soNgay, m4: soNgay, m5: soNgay }),
  m5max: { type: Number, min: 0 },
});

/** Tài liệu `canhbao` = mẫu tiến độ (mục 7.3). */
const cauhinh = goc("cauhinh", {
  baoTruoc: { type: Number, min: 0 },
  mau: { type: [mauTienDoSchema], default: undefined },
  ...nguoiTao,
});

/**
 * Lịch sử thay đổi (mục 9.3). `truoc` là ảnh tài liệu trước khi sửa / xóa /
 * hủy (`null` khi tạo mới), để nút Hủy của phiên chỉnh sửa hoàn tác được.
 */
const lichsu = goc("lichsu", {
  at: { ...chuoi, required: true },
  by: chuoi,
  ten: chuoi,
  /** Email người thao tác. */
  tk: chuoi,
  tab: chuoi,
  col: chuoi,
  id: chuoi,
  op: { type: String, enum: THAO_TAC, required: true },
  /** Tóm tắt thay đổi, dễ đọc. */
  tom: chuoi,
  /** Mã phiên chỉnh sửa. */
  phien: chuoi,
  truoc: { type: Schema.Types.Mixed, default: null },
});
lichsu.index({ at: -1 });
lichsu.index({ tab: 1, at: -1 });
lichsu.index({ phien: 1, at: -1 });

/** Tài liệu `lich`: bản tóm tắt nhỏ cho lịch sản xuất (mục 9.1). */
const tomtat = goc("tomtat", {
  don: {
    type: [
      con({
        dh: chuoi,
        ten: chuoi,
        khach: chuoi,
        ngayxuat: ngay,
        nhan: chuoi,
        ev: {
          type: [
            con({ k: chuoi, ngay, den: ngay, xong: Boolean, tre: Boolean }),
          ],
          default: [],
        },
        st: {
          type: [con({ k: chuoi, han: ngay, tt: ngay })],
          default: [],
        },
      }),
    ],
    default: [],
  },
  at: chuoi,
});

/**
 * Ảnh sản phẩm, `_id` = tên file (đúng giá trị `img` của mã hàng). Lưu trong
 * database Sổ tay để chỉ người đã đăng nhập xem được (`/api/so-tay/anh/…`).
 */
const anh = goc("anh", {
  loai: { type: String, required: true },
  du: { type: Buffer, required: true },
  ...nguoiTao,
});

// ---------------------------------------------------------------- Đăng ký

const SCHEMAS = {
  doituong,
  donhang,
  vattu,
  sodu,
  sanxuat,
  phancong,
  giaohang,
  hopdong,
  congno,
  thutien,
  denghichi,
  chixuong,
  phieukho,
  donmua,
  chamcong,
  luong,
  nhanvienvp,
  taikhoan,
  cauhinh,
  lichsu,
  tomtat,
  anh,
} as const satisfies Record<TenCollection, Schema>;

export type SoTayModels = {
  [K in TenCollection]: Model<Record<string, unknown>>;
};

function dangKy(db: Connection): SoTayModels {
  const models = {} as SoTayModels;
  for (const [ten, schema] of Object.entries(SCHEMAS) as Array<
    [TenCollection, Schema]
  >) {
    models[ten] = (db.models[ten] ?? db.model(ten, schema, ten)) as Model<
      Record<string, unknown>
    >;
  }
  return models;
}

/** Các model Sổ tay, gắn với database riêng. */
export async function soTayModels(): Promise<SoTayModels> {
  return dangKy(await ketNoiSoTay());
}

/** Id cố định của các tài liệu đơn lẻ. */
export const ID_SODU = "sodu";
export const ID_CANHBAO = "canhbao";
export const ID_LICH = "lich";
