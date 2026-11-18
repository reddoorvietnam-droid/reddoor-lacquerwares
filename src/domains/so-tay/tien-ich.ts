/**
 * Tiện ích dùng chung của Sổ tay (mục 2): ngày theo giờ Việt Nam, định dạng
 * tiền / số lượng kiểu Việt Nam, slug sinh mã đối tượng, mã chứng từ.
 *
 * Ngày luôn là chuỗi "YYYY-MM-DD"; phép tính ngày làm trên UTC để không lệch
 * vì múi giờ của máy chạy.
 */

export const MUI_GIO = "Asia/Ho_Chi_Minh";

const NGAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Tách "YYYY-MM-DD" thành [năm, tháng, ngày]; `null` nếu sai dạng. */
function tach(value: string): [number, number, number] | null {
  const m = NGAY_RE.exec(value);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function laNgay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const p = tach(value);
  if (!p) return false;
  const [y, mo, d] = p;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

const dinhDangNgayVn = new Intl.DateTimeFormat("en-CA", {
  timeZone: MUI_GIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Hôm nay theo giờ Việt Nam, "YYYY-MM-DD". */
export function today(now: Date = new Date()): string {
  return dinhDangNgayVn.format(now);
}

function sangUtc(ngay: string): number {
  const p = laNgay(ngay) ? tach(ngay) : null;
  if (!p) throw new RangeError(`Ngày không hợp lệ: ${ngay}`);
  return Date.UTC(p[0], p[1] - 1, p[2]);
}

function tuUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const MOT_NGAY = 86_400_000;

/** Cộng (hoặc trừ, nếu âm) số ngày. */
export function addDays(ngay: string, soNgay: number): string {
  return tuUtc(sangUtc(ngay) + Math.trunc(soNgay) * MOT_NGAY);
}

/** Số ngày từ `tu` tới `den` (dương nếu `den` ở sau). */
export function daysTo(tu: string, den: string): number {
  return Math.round((sangUtc(den) - sangUtc(tu)) / MOT_NGAY);
}

/** "YYYY-MM-DD" (hoặc ISO datetime) → "dd/mm/yyyy"; rỗng nếu không có. */
export function dvn(ngay: string | null | undefined): string {
  if (!ngay) return "";
  const phan = ngay.length > 10 ? today(new Date(ngay)) : ngay;
  if (!laNgay(phan)) return "";
  const [y, m, d] = phan.split("-");
  return `${d}/${m}/${y}`;
}

const dinhDangTien = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

const dinhDangSoLuong = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 3,
});

/** Số tiền VND: 1234567 → "1.234.567". */
export function fm(tien: number | null | undefined): string {
  if (tien === null || tien === undefined || !Number.isFinite(tien)) return "";
  // Tránh "-0" khi làm tròn số âm rất nhỏ.
  return dinhDangTien.format(Math.round(tien) || 0);
}

/** Số lượng, tối đa 3 chữ số thập phân: 1234.5 → "1.234,5". */
export function fq(soLuong: number | null | undefined): string {
  if (soLuong === null || soLuong === undefined || !Number.isFinite(soLuong))
    return "";
  return dinhDangSoLuong.format(soLuong);
}

/** Bỏ dấu, viết hoa, nối bằng "_": "Lê Thị Ngà" → "LE_THI_NGA". */
export function slug(ten: string): string {
  return ten
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const KY_TU_MA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function ngauNhien(soKyTu: number): string {
  const bytes = new Uint8Array(soKyTu);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => KY_TU_MA[b % KY_TU_MA.length]).join("");
}

/** Mã chứng từ: rid("PK") → "PK-261116-AB12". */
export function rid(tienTo: string, now: Date = new Date()): string {
  const yymmdd = today(now).slice(2).replaceAll("-", "");
  return `${tienTo}-${yymmdd}-${ngauNhien(4)}`;
}

/** Thời điểm hiện tại dạng ISO, dùng cho trường `at`. */
export function bayGio(now: Date = new Date()): string {
  return now.toISOString();
}
