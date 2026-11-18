/**
 * Hằng số dùng chung cho Sổ tay (cả giao diện và máy chủ).
 *
 * Nguồn: tài liệu `so_tay` mục 4, 5, 7, 11. Không đổi mã vai trò, mã tab,
 * tên nghiệp vụ: dữ liệu cũ của Sổ chung sẽ được nạp thẳng theo các giá trị
 * này ở giai đoạn 2.
 *
 * File này không được import thứ gì chỉ chạy ở máy chủ.
 */

// ---------------------------------------------------------------- Vai trò

export const ROLES = {
  quanly: "Giám đốc (kiêm bán hàng)",
  quandoc: "Quản lý xưởng",
  ketoancty: "Kế toán công ty",
  ketoan: "Kế toán xưởng",
  thukho: "Thủ kho",
  qc: "QC công ty",
} as const;

export type VaiTro = keyof typeof ROLES;

export const VAI_TRO = Object.keys(ROLES) as VaiTro[];

export function laVaiTro(value: unknown): value is VaiTro {
  return typeof value === "string" && value in ROLES;
}

/**
 * Vai trò Sổ tay suy ra từ vai trò khu quản trị (quyết định 17/11/2026: ai
 * đăng nhập khu quản trị bằng Gmail thì tự thấy Sổ tay). Vai trò `qc` không có
 * bên khu quản trị nên Giám đốc gán tay trong tab Danh mục.
 *
 * Thứ tự là thứ tự ưu tiên khi một người giữ nhiều vai trò.
 */
export const VAI_TU_QUAN_TRI: ReadonlyArray<readonly [string, VaiTro]> = [
  ["DIRECTOR", "quanly"],
  ["COMPANY_ACCOUNTANT", "ketoancty"],
  ["FACTORY_ACCOUNTANT", "ketoan"],
  ["FACTORY_MANAGER", "quandoc"],
  ["WAREHOUSE_MANAGER", "thukho"],
];

/**
 * Vai trò Sổ tay của một người. Vai trò Giám đốc gán tay (`ganTay`) thắng;
 * nếu không có thì lấy theo vai trò khu quản trị; không khớp vai nào thì
 * `null` (không vào được Sổ tay).
 */
export function vaiTroSoTay(
  vaiQuanTri: readonly string[],
  ganTay?: string | null,
): VaiTro | null {
  if (laVaiTro(ganTay)) return ganTay;
  for (const [quanTri, soTay] of VAI_TU_QUAN_TRI) {
    if (vaiQuanTri.includes(quanTri)) return soTay;
  }
  return null;
}

// ---------------------------------------------------------------- Quyền thao tác

export const QUYEN = {
  donmoi: { ten: "Gửi đơn mới cho xưởng", vai: [] },
  nhandon: { ten: "Nhận đơn", vai: ["quandoc"] },
  chia: { ten: "Chia việc cho cơ sở, ghi chú kỹ thuật", vai: ["quandoc"] },
  nhancong: { ten: "Chấm công nhân công nhà máy", vai: ["quandoc"] },
  nhancongvp: { ten: "Lương cố định nhân viên văn phòng", vai: ["ketoancty"] },
  baobi: { ten: "Đặt bao bì", vai: ["thukho"] },
  kho: { ten: "Lập phiếu kho", vai: ["thukho"] },
  muavt: { ten: "Đặt mua vật tư", vai: ["thukho"] },
  nhan: { ten: "Nhận hàng cơ sở giao", vai: ["thukho", "quandoc"] },
  hd: { ten: "Hợp đồng, đề nghị tạm ứng / thanh toán", vai: ["ketoan"] },
  congno: { ten: "Ghi công nợ cơ sở", vai: ["ketoan"] },
  thu: { ten: "Phiếu thu tiền cơ sở trả", vai: ["ketoan"] },
  chi: { ten: "Chi tiền cho cơ sở theo đề nghị", vai: ["ketoancty"] },
  chixuong: { ten: "Chi tiêu nhỏ tại xưởng", vai: ["quandoc"] },
  qc1: { ten: "Ghi QC lần 1", vai: ["qc", "quandoc"] },
  giaohang: { ten: "Ghi giao hàng", vai: ["quandoc", "thukho"] },
} as const satisfies Record<string, { ten: string; vai: readonly VaiTro[] }>;

export type Viec = keyof typeof QUYEN;

/** Giám đốc (`quanly`) có mọi quyền. */
export function coQuyen(vaitro: VaiTro | null, viec: Viec): boolean {
  if (!vaitro) return false;
  if (vaitro === "quanly") return true;
  return (QUYEN[viec].vai as readonly VaiTro[]).includes(vaitro);
}

// ---------------------------------------------------------------- Tab

export const NHOM = [
  { ma: 1, ten: "Quản lý sản xuất", tabChinh: "tongquan" },
  { ma: 2, ten: "Kho, nhân sự & danh mục", tabChinh: "nhancong" },
] as const;

export type MaNhom = (typeof NHOM)[number]["ma"];

type TabDinhNghia = {
  ma: string;
  ten: string;
  nhom: MaNhom;
  /** `"all"` = mọi người. */
  xem: readonly VaiTro[] | "all";
};

export const TABS = [
  { ma: "tongquan", ten: "Tổng quan", nhom: 1, xem: "all" },
  { ma: "donmoi", ten: "Đơn mới", nhom: 1, xem: ["quanly"] },
  { ma: "donhang", ten: "Đơn hàng", nhom: 1, xem: "all" },
  {
    ma: "sanxuat",
    ten: "Sản xuất",
    nhom: 1,
    xem: ["quandoc", "thukho", "ketoan", "ketoancty", "qc"],
  },
  { ma: "coso", ten: "Cơ sở sản xuất", nhom: 1, xem: "all" },
  {
    ma: "congno",
    ten: "Công nợ sản xuất",
    nhom: 1,
    xem: ["ketoan", "ketoancty"],
  },
  { ma: "chi", ten: "Chi cho cơ sở", nhom: 1, xem: ["ketoancty", "ketoan"] },
  { ma: "nhancong", ten: "Nhân công nhà máy", nhom: 2, xem: ["quandoc"] },
  { ma: "nhancongvp", ten: "Nhân công văn phòng", nhom: 2, xem: ["ketoancty"] },
  // Mọi người xem trong giai đoạn thử nghiệm.
  { ma: "bangluong", ten: "Bảng lương", nhom: 2, xem: "all" },
  { ma: "kho", ten: "Phiếu kho", nhom: 2, xem: ["thukho", "ketoan"] },
  { ma: "ton", ten: "Tồn kho", nhom: 2, xem: ["thukho", "quandoc"] },
  { ma: "muavt", ten: "Mua vật tư", nhom: 2, xem: ["thukho"] },
  {
    ma: "chixuong",
    ten: "Chi tiêu xưởng",
    nhom: 2,
    xem: ["quandoc", "ketoancty"],
  },
  { ma: "danhmuc", ten: "Danh mục & người dùng", nhom: 2, xem: "all" },
] as const satisfies readonly TabDinhNghia[];

export type MaTab = (typeof TABS)[number]["ma"];

/** Giám đốc, kế toán xưởng, kế toán công ty xem mọi tab. */
const XEM_MOI_TAB: readonly VaiTro[] = ["quanly", "ketoan", "ketoancty"];

export function xemTab(vaitro: VaiTro | null, tab: MaTab): boolean {
  if (!vaitro) return false;
  if (XEM_MOI_TAB.includes(vaitro)) return true;
  const dinhNghia = TABS.find((t) => t.ma === tab);
  if (!dinhNghia) return false;
  return (
    dinhNghia.xem === "all" ||
    (dinhNghia.xem as readonly VaiTro[]).includes(vaitro)
  );
}

// ---------------------------------------------------------------- Danh mục

export const LOAI_DT = [
  "Cơ sở gia công",
  "Nhà cung cấp",
  "Dịch vụ",
  "Nhân sự nhà máy",
  "Nhân sự văn phòng",
  "Khách lẻ",
  "Nội bộ",
  "Khác",
  "Chưa rõ",
] as const;

export type LoaiDt = (typeof LOAI_DT)[number];

/** Gợi ý cho ô Nhóm / khâu (người dùng vẫn gõ được nhóm khác). */
export const NHOM_DT_GOI_Y = [
  "Mộc",
  "Vóc",
  "Hoàn thiện",
  "Bao bì",
  "Vật tư",
  "Vận chuyển",
  "Phụ liệu",
  "In, mẫu, hoàn thiện mẫu",
  "Văn phòng",
  "Chưa rõ",
] as const;

export const KHO_VT = { S: "Kho sơn", N: "Kho NVL" } as const;

// ---------------------------------------------------------------- Tiền

/** Khoản chi phí. */
export const CP = [
  "Chi phí làm mộc",
  "Chi phí hoàn thiện",
  "Chi phí làm vóc",
  "Chi phí bao bì",
  "Chi phí vật tư",
  "Phụ liệu",
  "Vận chuyển",
  "Gia công phụ",
  "Chi phí khác",
] as const;

export type KhoanCp = (typeof CP)[number];

/** Nghiệp vụ công nợ → dấu (+1 RD nợ thêm, −1 giảm nợ). */
export const NV = {
  "Giá trị hợp đồng": 1,
  "Tạm ứng": -1,
  "Thanh toán": -1,
  "Trừ sơn / gỗ (bảng kê)": -1,
  "Trừ tiền": -1,
  "Điều chỉnh tăng": 1,
  "Điều chỉnh giảm": -1,
} as const;

export type NghiepVu = keyof typeof NV;

export const NV_DS = Object.keys(NV) as NghiepVu[];

export const HINH_THUC = ["Tiền mặt", "Chuyển khoản"] as const;

export const LOAI_DE_NGHI = ["Tạm ứng", "Thanh toán"] as const;

export const TT_DE_NGHI = ["cho", "dachi", "tuchoi"] as const;

/** Loại chi tiêu xưởng. */
export const LOAI_CHI = [
  "Vật tư lặt vặt",
  "Sửa chữa bảo trì",
  "Vận chuyển bốc xếp",
  "Ăn uống nước",
  "Công nhật thuê ngoài",
  "Khác",
] as const;

/** Khoản chi xưởng từ mức này trở lên phải chờ Giám đốc duyệt. */
export const NGUONG_DUYET_CHI_XUONG = 1_000_000;

// ---------------------------------------------------------------- Kho

type LoaiPhieu = {
  ten: string;
  /** +1 nhập, −1 xuất. */
  h: 1 | -1;
  /** 1 = tạo nợ tiền sơn cho cơ sở. */
  cn: 0 | 1;
  /** 1 = cần mã đơn. */
  dh: 0 | 1;
  /** 1 = cần đối tượng; "ncc" = cần nhà cung cấp. */
  dt: 0 | 1 | "ncc";
  /** Cần đơn giá. */
  gia?: true;
  /** Vật tư xưởng cấp, trừ khi thanh toán. */
  tu?: true;
  /** Bắt buộc ghi lý do. */
  lydo?: true;
  /** In tem QR thùng sơn. */
  tem?: true;
};

export const LOAI = [
  { ten: "Nhập mua", h: 1, cn: 0, dh: 0, dt: "ncc" },
  { ten: "Nhập trả lại từ cơ sở", h: 1, cn: 0, dh: 1, dt: 1 },
  { ten: "Xuất cấp cơ sở theo đơn", h: -1, cn: 0, dh: 1, dt: 1 },
  {
    ten: "Xuất vật tư tạm ứng đơn hàng",
    h: -1,
    cn: 0,
    dh: 1,
    dt: 1,
    gia: true,
    tu: true,
    tem: true,
  },
  {
    ten: "Xuất bán cho cơ sở",
    h: -1,
    cn: 1,
    dh: 1,
    dt: 1,
    gia: true,
    tem: true,
  },
  { ten: "Bán khách lẻ", h: -1, cn: 1, dh: 0, dt: 1, gia: true, tem: true },
  { ten: "Xuất dùng nội bộ", h: -1, cn: 0, dh: 0, dt: 1 },
  { ten: "Hao hụt / hỏng", h: -1, cn: 0, dh: 0, dt: 0, lydo: true },
  { ten: "Kiểm kê tăng", h: 1, cn: 0, dh: 0, dt: 0, lydo: true },
  { ten: "Kiểm kê giảm", h: -1, cn: 0, dh: 0, dt: 0, lydo: true },
] as const satisfies readonly LoaiPhieu[];

export type TenLoaiPhieu = (typeof LOAI)[number]["ten"];

export const TEN_LOAI_PHIEU = LOAI.map((l) => l.ten) as TenLoaiPhieu[];

// ---------------------------------------------------------------- Sản xuất

export type MaMoc = "m1" | "m2" | "m3" | "m4" | "m5";

export const MOC = [
  {
    ma: "m1",
    ten: "Mộc giao hàng",
    tu: "ngày ký hợp đồng mộc",
    phutrach: "Quản lý xưởng",
  },
  {
    ma: "m2",
    ten: "Cơ sở hoàn thiện chuyển sang nhà máy in",
    tu: "khi mộc giao xong",
    phutrach: "Quản lý xưởng",
  },
  {
    ma: "m3",
    ten: "In xong tại nhà máy",
    tu: "khi hàng về nhà máy",
    phutrach: "Quản lý xưởng (in)",
  },
  {
    ma: "m4",
    ten: "Trả cơ sở → QC kiểm tra lần 1",
    tu: "khi in xong",
    phutrach: "QC công ty",
  },
  {
    ma: "m5",
    ten: "QC lần 1 → giao hàng",
    tu: "từ QC lần 1",
    phutrach: "Quản lý xưởng, thủ kho",
  },
] as const satisfies ReadonlyArray<{
  ma: MaMoc;
  ten: string;
  tu: string;
  phutrach: string;
}>;

type KhauDinhNghia = {
  ten: string;
  /** Khoản chi phí lên hợp đồng; `null` = không lên hợp đồng. */
  cp: KhoanCp | null;
  /** Nhóm (`g`) của đối tượng được giao khâu này. */
  nhom: readonly string[];
  /** Số ngày trước ngày xuất, dùng khi chưa tính được mốc. */
  off: number;
  dvt: string;
  /** Mốc tiến độ cho hạn mặc định của phần việc. */
  moc: MaMoc | null;
  /** Chỉ cho mã hàng có `in = true`. */
  chiMaIn?: true;
};

export const KHAU = [
  {
    ten: "Mộc",
    cp: "Chi phí làm mộc",
    nhom: ["Mộc"],
    off: 56,
    dvt: "cái",
    moc: "m1",
  },
  {
    ten: "Hoàn thiện (sơn)",
    cp: "Chi phí hoàn thiện",
    nhom: ["Hoàn thiện"],
    off: 21,
    dvt: "cái",
    moc: "m2",
  },
  {
    ten: "In tại nhà máy",
    cp: null,
    nhom: ["In, mẫu, hoàn thiện mẫu"],
    off: 14,
    dvt: "cái",
    moc: "m3",
    chiMaIn: true,
  },
  {
    ten: "Bao bì",
    cp: "Chi phí bao bì",
    nhom: ["Bao bì"],
    off: 21,
    dvt: "thùng / hộp",
    moc: null,
  },
  {
    ten: "Kiểm hàng",
    cp: null,
    nhom: ["In, mẫu, hoàn thiện mẫu"],
    off: 10,
    dvt: "cái",
    moc: "m4",
  },
  {
    ten: "Nhập kho",
    cp: "Chi phí hoàn thiện",
    nhom: ["Hoàn thiện", "In, mẫu, hoàn thiện mẫu"],
    off: 7,
    dvt: "cái",
    moc: "m5",
  },
] as const satisfies readonly KhauDinhNghia[];

export type TenKhau = (typeof KHAU)[number]["ten"];

export const TEN_KHAU = KHAU.map((k) => k.ten) as TenKhau[];

/** Thứ tự cột trong bảng mã hàng (tab Sản xuất). */
export const THU_TU_COT_KHAU: readonly TenKhau[] = [
  "Mộc",
  "Hoàn thiện (sơn)",
  "Bao bì",
  "In tại nhà máy",
  "Kiểm hàng",
  "Nhập kho",
];

export type MauTienDo = {
  ten: string;
  /** Áp dụng khi số ngày từ mốc gốc tới ngày xuất ≤ `den` (mẫu cuối: 9999). */
  den: number;
  /** Số ngày của từng mốc. */
  ngay: Record<MaMoc, number>;
  /** Hạn tối đa của m5. */
  m5max: number;
};

export type CauHinhCanhBao = {
  /** Số ngày trước hạn bắt đầu báo vàng. */
  baoTruoc: number;
  mau: MauTienDo[];
};

/** Mẫu tiến độ mặc định (mục 7.3); Giám đốc sửa được trong tab Danh mục. */
export const CANH_BAO_MAC_DINH: CauHinhCanhBao = {
  baoTruoc: 3,
  mau: [
    {
      ten: "2 tháng",
      den: 75,
      ngay: { m1: 15, m2: 20, m3: 7, m4: 3, m5: 5 },
      m5max: 10,
    },
    {
      ten: "3 tháng",
      den: 105,
      ngay: { m1: 30, m2: 30, m3: 10, m4: 10, m5: 5 },
      m5max: 15,
    },
    {
      ten: "4 tháng",
      den: 135,
      ngay: { m1: 30, m2: 45, m3: 15, m4: 15, m5: 15 },
      m5max: 15,
    },
    {
      ten: "5 tháng",
      den: 9999,
      ngay: { m1: 45, m2: 45, m3: 20, m4: 20, m5: 20 },
      m5max: 20,
    },
  ],
};

/** Mã đơn đặc biệt: hợp đồng bao bì mua dùng dần, không gắn đơn nào. */
export const MA_DON_KHO_BB = "KHO-BB";

// ---------------------------------------------------------------- Lịch sử

export const THAO_TAC = ["Tạo mới", "Sửa", "Xóa", "Hủy", "Đăng nhập"] as const;

export type ThaoTac = (typeof THAO_TAC)[number];

/** Tên collection Sổ tay (giữ đúng mục 5 để nạp dữ liệu cũ). */
export const COLLECTIONS = [
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
  "taikhoan",
  "cauhinh",
  "lichsu",
  "tomtat",
  "anh",
] as const;

export type TenCollection = (typeof COLLECTIONS)[number];
