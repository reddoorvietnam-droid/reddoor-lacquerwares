/**
 * Câu tóm tắt dễ đọc cho mỗi dòng lịch sử (mục 9.3), ví dụ:
 *   "Danh mục doituong: sửa B10 Lê Thị Ngà (ghi chú: cũ → mới)"
 *   "Phiếu kho PK-261116-AB12: tạo mới"
 *
 * Hàm thuần, không đụng database.
 */

import type { TenCollection, ThaoTac } from "./hang-so";
import { dvn, fq, laNgay } from "./tien-ich";

/** Tên trường hiển thị bằng tiếng Việt. */
export const TEN_TRUONG: Record<string, string> = {
  c: "mã",
  n: "tên",
  g: "nhóm",
  l: "loại",
  p: "điện thoại",
  so: "số",
  cccd: "CCCD",
  note: "ghi chú",
  ghichu: "ghi chú",
  m: "cơ sở chính",
  luu: "lưu đối chiếu",
  k: "khách",
  u: "ĐVT",
  t: "tồn đầu kỳ",
  gv: "giá vốn",
  y: "mức vàng",
  r: "mức đỏ",
  dg: "đơn giá",
  sl: "số lượng",
  han: "hạn",
  tt: "trạng thái",
  tien: "số tiền",
  ngay: "ngày",
  dt: "cơ sở",
  dh: "đơn",
  khau: "khâu",
  ma: "mã hàng",
  cp: "khoản chi phí",
  nv: "nghiệp vụ",
  hd: "số HĐ",
  gt: "giá trị",
  ht: "hình thức",
  nd: "nội dung",
  loai: "loại",
  loi: "số lỗi",
  tru: "trừ tiền vào",
  khach: "khách",
  ngayxuat: "ngày xuất",
  items: "mã hàng",
  mau: "mẫu tiến độ",
  moc: "mốc",
  qc1: "QC lần 1",
  giao: "giao hàng",
  nhan: "nhận",
  dong: "dòng vật tư",
  ncc: "nhà cung cấp",
  kieu: "kiểu",
  nguoinhan: "người nhận",
  duyet: "duyệt",
  chi: "chi",
  tuchoi: "từ chối",
  huy: "hủy",
  cong: "công",
  tc: "giờ tăng ca",
  luong: "lương",
  congviec: "công việc",
  vaitro: "vai trò",
  hoatdong: "hoạt động",
  baoTruoc: "báo trước",
  ls: "lịch sử",
};

/** Tên hiển thị của collection trong lịch sử. */
export const TEN_COLLECTION: Record<TenCollection, string> = {
  doituong: "Danh mục doituong",
  donhang: "Danh mục donhang",
  vattu: "Danh mục vattu",
  sodu: "Số dư chốt",
  sanxuat: "Đơn sản xuất",
  phancong: "Phần việc",
  giaohang: "Giao hàng",
  hopdong: "Hợp đồng",
  congno: "Công nợ",
  thutien: "Phiếu thu",
  denghichi: "Đề nghị chi",
  chixuong: "Chi tiêu xưởng",
  phieukho: "Phiếu kho",
  donmua: "Đơn mua",
  chamcong: "Chấm công",
  luong: "Bảng lương",
  nhanvienvp: "Nhân viên văn phòng",
  taikhoan: "Tài khoản",
  cauhinh: "Cấu hình",
  lichsu: "Lịch sử",
  tomtat: "Tóm tắt",
  anh: "Ảnh sản phẩm",
};

const DANH_MUC: ReadonlySet<TenCollection> = new Set([
  "doituong",
  "donhang",
  "vattu",
]);

/** Trường hệ thống, không đưa vào phần "thay đổi". */
const BO_QUA = new Set(["_id", "by", "at"]);

const DAI_TOI_DA = 60;
const SO_TRUONG_TOI_DA = 6;

type TaiLieu = Record<string, unknown> | null | undefined;

function catNgan(text: string): string {
  return text.length > DAI_TOI_DA ? `${text.slice(0, DAI_TOI_DA - 1)}…` : text;
}

export function giaTriDeDoc(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(trống)";
  if (typeof value === "boolean") return value ? "có" : "không";
  if (typeof value === "number") return fq(value);
  if (laNgay(value)) return dvn(value);
  if (typeof value === "string") return catNgan(value);
  if (Array.isArray(value)) return `${value.length} dòng`;
  return "…";
}

function bang(a: unknown, b: unknown): boolean {
  const rong = (v: unknown) => v === null || v === undefined || v === "";
  if (rong(a) && rong(b)) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Các trường khác nhau giữa hai bản, theo thứ tự xuất hiện. */
export function truongThayDoi(truoc: TaiLieu, sau: TaiLieu): string[] {
  const keys = new Set([
    ...Object.keys(truoc ?? {}),
    ...Object.keys(sau ?? {}),
  ]);
  return [...keys].filter((k) => !BO_QUA.has(k) && !bang(truoc?.[k], sau?.[k]));
}

function tenDoiTuong(col: TenCollection, id: string, doc: TaiLieu): string {
  if (!doc) return id;
  if (col === "doituong") {
    const ten = [doc.so, doc.n].filter(Boolean).join(" ");
    return ten || id;
  }
  if (col === "donhang" || col === "vattu") {
    return [id, doc.n].filter(Boolean).join(" ");
  }
  return id;
}

export type DauVaoTomTat = {
  col: TenCollection;
  op: Exclude<ThaoTac, "Đăng nhập">;
  id: string;
  truoc?: TaiLieu;
  sau?: TaiLieu;
  /** Lý do hủy. */
  lydo?: string;
};

export function tomTatThayDoi({
  col,
  op,
  id,
  truoc,
  sau,
  lydo,
}: DauVaoTomTat): string {
  const dongTu =
    op === "Tạo mới"
      ? "tạo mới"
      : op === "Sửa"
        ? "sửa"
        : op === "Xóa"
          ? "xóa"
          : "hủy";

  let chiTiet = "";
  if (op === "Sửa") {
    const keys = truongThayDoi(truoc, sau);
    const phan = keys
      .slice(0, SO_TRUONG_TOI_DA)
      .map(
        (k) =>
          `${TEN_TRUONG[k] ?? k}: ${giaTriDeDoc(truoc?.[k])} → ${giaTriDeDoc(sau?.[k])}`,
      );
    if (keys.length > SO_TRUONG_TOI_DA) phan.push("…");
    if (phan.length > 0) chiTiet = ` (${phan.join("; ")})`;
  } else if (op === "Hủy" && lydo) {
    chiTiet = ` (lý do: ${catNgan(lydo)})`;
  }

  const nhan = TEN_COLLECTION[col];
  if (DANH_MUC.has(col)) {
    const ten = tenDoiTuong(col, id, sau ?? truoc);
    return `${nhan}: ${dongTu} ${ten}${chiTiet}`;
  }
  return `${nhan} ${id}: ${dongTu}${chiTiet}`;
}
