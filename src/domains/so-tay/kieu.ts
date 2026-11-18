/**
 * Kiểu dữ liệu các tài liệu Sổ tay (mục 5), dùng chung cho giao diện, API và
 * các hàm nghiệp vụ. Tên trường giữ đúng tài liệu.
 */

import type {
  CauHinhCanhBao,
  KhoanCp,
  LoaiDt,
  NghiepVu,
  TenKhau,
  TenLoaiPhieu,
  ThaoTac,
  VaiTro,
} from "./hang-so";

export type Huy = { lydo: string; by?: string; at?: string };
export type NguoiLuc = { by?: string; at?: string };

type Goc = { _id: string; by?: string; at?: string };

export type DoiTuong = Goc & {
  c: string;
  n: string;
  l: LoaiDt;
  g?: string;
  so?: string;
  p?: string;
  cccd?: string;
  note?: string;
  m?: 0 | 1;
  luu?: boolean;
};

export type DonHang = Goc & { c: string; k?: string; n?: string };

export type VatTu = Goc & {
  c: string;
  n?: string;
  k?: "S" | "N";
  g?: string;
  u?: string;
  t?: number;
  gv?: number;
  y?: number;
  r?: number;
};

export type SoDu = Goc & {
  ngay?: string | null;
  nguon?: string;
  cn: Array<{
    d: string;
    o: string;
    cp?: string;
    hd?: number;
    tra?: number;
    ct?: Array<{
      n?: string;
      nv?: string;
      t?: number;
      f?: string;
      gc?: string;
    }>;
  }>;
  son: Array<{ d: string; amt: number }>;
  tamtinh: Array<{ o: string; tien: number }>;
};

export type MaHang = {
  ma: string;
  mt?: string;
  L?: number;
  W?: number;
  H?: number;
  qty: number;
  u?: string;
  img?: string;
  in?: boolean;
  inner?: number;
  io?: number;
  oL?: number;
  oW?: number;
  oH?: number;
  ktsx?: string;
  ktsxBy?: string;
  ktsxAt?: string;
};

export type MaMocKey = "m1" | "m2" | "m3" | "m4" | "m5";

export type SanXuat = Goc & {
  dh: string;
  khach?: string;
  ngayxuat?: string;
  items: MaHang[];
  tt: "moi" | "nhan";
  nhan?: NguoiLuc;
  mau?: string;
  moc?: Partial<Record<MaMocKey, string>>;
  qc1?: { ngay?: string; by?: string };
  giao?: { ngay?: string; by?: string };
};

export type PhanCong = Goc & {
  dh: string;
  ma?: string;
  khau: TenKhau;
  dt?: string;
  sl?: number;
  dg?: number;
  han?: string;
  ghichu?: string;
  tru?: string;
  ls?: Array<{ dg?: number; at?: string; by?: string }>;
  huy?: Huy;
};

export type GiaoHang = Goc & {
  dh?: string;
  pc: string;
  ngay: string;
  sl?: number;
  loi?: number;
  ghichu?: string;
  huy?: Huy;
};

export type HopDong = Goc & {
  dh: string;
  dt: string;
  so?: string;
  ngay?: string;
  gt?: number;
  ls?: Array<{
    so?: string;
    ngay?: string;
    gt?: number;
    by?: string;
    at?: string;
  }>;
};

export type CongNo = Goc & {
  ngay: string;
  dh?: string;
  dt: string;
  cp?: KhoanCp;
  nv: NghiepVu;
  tien: number;
  hd?: string;
  ghichu?: string;
  nguon?: string;
  dn?: string;
  huy?: Huy;
};

export type ThuTien = Goc & {
  ngay: string;
  dt: string;
  tien: number;
  ht?: string;
  nd?: string;
  huy?: Huy;
};

export type TrangThaiChi = "cho" | "dachi" | "tuchoi";

export type DeNghiChi = Goc & {
  ngay: string;
  dh?: string;
  dt: string;
  cp?: KhoanCp;
  loai: "Tạm ứng" | "Thanh toán";
  tien: number;
  han?: string;
  hd?: string;
  ghichu?: string;
  tt: TrangThaiChi;
  chi?: {
    ngay?: string;
    tien?: number;
    ht?: string;
    cn?: string;
    by?: string;
    at?: string;
  };
  tuchoi?: { lydo?: string; by?: string; at?: string };
};

export type ChiXuong = Goc & {
  kieu: "chi" | "nap";
  ngay: string;
  loai?: string;
  nd?: string;
  tien: number;
  nguoinhan?: string;
  dh?: string;
  ghichu?: string;
  tt?: TrangThaiChi;
  duyet?: NguoiLuc;
  chi?: { ngay?: string; by?: string; at?: string };
  tuchoi?: { lydo?: string; by?: string; at?: string };
};

export type DongVatTu = {
  vt: string;
  sl?: number | undefined;
  dg?: number | undefined;
};

export type PhieuKho = Goc & {
  so: string;
  ngay: string;
  loai: TenLoaiPhieu;
  dt?: string;
  dh?: string;
  ghichu?: string;
  dong: DongVatTu[];
  huy?: Huy;
};

export type DonMua = Goc & {
  so: string;
  ngay: string;
  ncc?: string;
  han?: string;
  ghichu?: string;
  dong: DongVatTu[];
  tt: "dat" | "nhan";
  nhan?: { ngay?: string; phieu?: string; by?: string; at?: string };
  huy?: Huy;
};

export type ChamCong = Goc & {
  ngay: string;
  nv: string;
  cong?: number;
  tc?: number;
  ghichu?: string;
};

export type Luong = Goc & {
  thang: string;
  nv: string;
  ten?: string;
  khoi?: "Nhà máy" | "Văn phòng";
  muc?: number;
  cong_hc?: number;
  cong_ng?: number;
  cong_cn?: number;
  cong_phat?: number;
  tong_cong?: number;
  gio_tc?: number;
  ngay_cn?: number;
  gio_tc_cn?: number;
  tien_luong?: number;
  phucap?: number;
  an_trua?: number;
  tam_ung?: number;
  bh_nld?: number;
  tong_thu_nhap?: number;
  thuc_nhan?: number;
  ghichu?: string;
};

export type NhanVienVp = Goc & {
  nv: string;
  luong?: number;
  congviec?: string;
  ghichu?: string;
};

export type TaiKhoan = Goc & {
  email: string;
  ten?: string;
  chao?: string;
  vaitro?: VaiTro | null;
  hoatdong?: boolean;
};

export type LichSu = {
  _id: string;
  at: string;
  by?: string;
  ten?: string;
  tk?: string;
  tab?: string;
  col?: string;
  id?: string;
  op: ThaoTac;
  tom?: string;
  phien?: string;
};

/** Một dòng của tài liệu `tomtat.lich` (mục 9.1). */
export type DonLich = {
  dh: string;
  ten?: string;
  khach?: string;
  ngayxuat?: string;
  nhan?: string;
  /** Mốc trên lịch: k = mã mốc (nhan, moc, in, kiem, giao, pi). */
  ev: Array<{
    k: string;
    ngay: string;
    den?: string;
    xong?: boolean;
    tre?: boolean;
  }>;
  /** 5 bước tiến độ: k = m1..m5, han, tt (ngày thực tế). */
  st: Array<{ k: string; han?: string; tt?: string }>;
};

/** Dữ liệu một tab gửi về giao diện. Collection nào tab không cần thì vắng. */
export type DuLieu = {
  doituong?: DoiTuong[];
  donhang?: DonHang[];
  vattu?: VatTu[];
  sodu?: SoDu | null;
  sanxuat?: SanXuat[];
  phancong?: PhanCong[];
  giaohang?: GiaoHang[];
  hopdong?: HopDong[];
  congno?: CongNo[];
  thutien?: ThuTien[];
  denghichi?: DeNghiChi[];
  chixuong?: ChiXuong[];
  phieukho?: PhieuKho[];
  donmua?: DonMua[];
  chamcong?: ChamCong[];
  luong?: Luong[];
  nhanvienvp?: NhanVienVp[];
  taikhoan?: TaiKhoan[];
  cauhinh?: CauHinhCanhBao;
  ganDay?: LichSu[];
};

/** Người đang dùng Sổ tay. */
export type NguoiSoTay = {
  email: string;
  ten: string;
  vaitro: VaiTro;
  chao: string;
};
