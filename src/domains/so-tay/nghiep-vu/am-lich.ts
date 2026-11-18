/**
 * Âm lịch Việt Nam theo thuật toán Hồ Ngọc Đức (múi giờ +7), có tháng nhuận
 * và năm Can Chi; ngày nghỉ lễ Việt Nam (mục 7.10).
 */

import { addDays, laNgay } from "../tien-ich";

const MUI_GIO = 7;
const PI = Math.PI;
const INT = Math.floor;

function jdTuNgay(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd =
    dd +
    INT((153 * m + 2) / 5) +
    365 * y +
    INT(y / 4) -
    INT(y / 100) +
    INT(y / 400) -
    32045;
  if (jd < 2299161) {
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  }
  return jd;
}

function soiMoi(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 =
    C1 -
    0.0074 * Math.sin(dr * (M - Mpr)) +
    0.0004 * Math.sin(dr * (2 * F + M));
  C1 =
    C1 -
    0.0004 * Math.sin(dr * (2 * F - M)) -
    0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 =
    C1 +
    0.001 * Math.sin(dr * (2 * F - Mpr)) +
    0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat =
    T < -11
      ? 0.001 +
        0.000839 * T +
        0.0002261 * T2 -
        0.00000845 * T3 -
        0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Jd1 + C1 - deltat;
}

function kinhDoMatTroi(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL +=
    (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) +
    0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L -= PI * 2 * INT(L / (PI * 2));
  return L;
}

function cungMatTroi(jdn: number): number {
  return INT((kinhDoMatTroi(jdn - 0.5 - MUI_GIO / 24) / PI) * 6);
}

function ngaySoiMoi(k: number): number {
  return INT(soiMoi(k) + 0.5 + MUI_GIO / 24);
}

function thang11Am(yy: number): number {
  const off = jdTuNgay(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = ngaySoiMoi(k);
  if (cungMatTroi(nm) >= 9) nm = ngaySoiMoi(k - 1);
  return nm;
}

function viTriThangNhuan(a11: number): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = cungMatTroi(ngaySoiMoi(k + i));
  do {
    last = arc;
    i++;
    arc = cungMatTroi(ngaySoiMoi(k + i));
  } while (arc !== last && i < 14);
  return i - 1;
}

export type NgayAm = {
  ngay: number;
  thang: number;
  nam: number;
  nhuan: boolean;
};

export function duongSangAm(dd: number, mm: number, yy: number): NgayAm {
  const soNgay = jdTuNgay(dd, mm, yy);
  const k = INT((soNgay - 2415021.076998695) / 29.530588853);
  let dauThang = ngaySoiMoi(k + 1);
  if (dauThang > soNgay) dauThang = ngaySoiMoi(k);
  let a11 = thang11Am(yy);
  let b11 = a11;
  let nam: number;
  if (a11 >= dauThang) {
    nam = yy;
    a11 = thang11Am(yy - 1);
  } else {
    nam = yy + 1;
    b11 = thang11Am(yy + 1);
  }
  const ngay = soNgay - dauThang + 1;
  const diff = INT((dauThang - a11) / 29);
  let nhuan = false;
  let thang = diff + 11;
  if (b11 - a11 > 365) {
    const leap = viTriThangNhuan(a11);
    if (diff >= leap) {
      thang = diff + 10;
      if (diff === leap) nhuan = true;
    }
  }
  if (thang > 12) thang -= 12;
  if (thang >= 11 && diff < 4) nam -= 1;
  return { ngay, thang, nam, nhuan };
}

/** "YYYY-MM-DD" → ngày âm. */
export function amLich(ngay: string): NgayAm {
  if (!laNgay(ngay)) throw new RangeError(`Ngày không hợp lệ: ${ngay}`);
  const [y, m, d] = ngay.split("-").map(Number) as [number, number, number];
  return duongSangAm(d, m, y);
}

const CAN = [
  "Canh",
  "Tân",
  "Nhâm",
  "Quý",
  "Giáp",
  "Ất",
  "Bính",
  "Đinh",
  "Mậu",
  "Kỷ",
];
const CHI = [
  "Thân",
  "Dậu",
  "Tuất",
  "Hợi",
  "Tý",
  "Sửu",
  "Dần",
  "Mão",
  "Thìn",
  "Tỵ",
  "Ngọ",
  "Mùi",
];

export function canChi(nam: number): string {
  return `${CAN[nam % 10]} ${CHI[nam % 12]}`;
}

/** "d/m" kèm "n" nếu tháng nhuận. */
export function ngayAmNgan(am: NgayAm): string {
  return `${am.ngay}/${am.thang}${am.nhuan ? "n" : ""}`;
}

/** "Âm lịch d/m năm Can Chi" (tháng nhuận ghi "nhuận"). */
export function moTaAm(am: NgayAm): string {
  return `Âm lịch ${am.ngay}/${am.thang}${am.nhuan ? " nhuận" : ""} năm ${canChi(am.nam)}`;
}

export type NgayLe = { ten: string; ngan: string };

const LE_DUONG: Record<string, NgayLe> = {
  "01-01": { ten: "Tết Dương lịch", ngan: "Tết DL" },
  "04-30": { ten: "Ngày Giải phóng miền Nam", ngan: "30/4" },
  "05-01": { ten: "Quốc tế Lao động", ngan: "1/5" },
  "09-02": { ten: "Quốc khánh", ngan: "Q.khánh" },
};

/**
 * Ngày lễ (nếu có). Tết Nguyên đán 5 ngày: ngày cuối năm âm (29 hoặc 30 Tết)
 * đến mùng 4. Ngày liền kề Quốc khánh theo thông báo hằng năm, không tự đánh dấu.
 */
export function ngayLe(ngay: string): NgayLe | null {
  const duong = LE_DUONG[ngay.slice(5)];
  if (duong) return duong;
  const am = amLich(ngay);
  if (!am.nhuan && am.thang === 1 && am.ngay <= 4) {
    return { ten: `Tết Nguyên đán (mùng ${am.ngay})`, ngan: `Tết` };
  }
  if (!am.nhuan && am.thang === 3 && am.ngay === 10) {
    return { ten: "Giỗ Tổ Hùng Vương", ngan: "Giỗ Tổ" };
  }
  if (am.thang === 12 && am.ngay >= 29) {
    const mai = amLich(addDays(ngay, 1));
    if (mai.thang === 1 && mai.ngay === 1) {
      return { ten: "Tết Nguyên đán (tất niên)", ngan: "Tết" };
    }
  }
  return null;
}

const THU = [
  "Chủ nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

/** 0 = Chủ nhật … 6 = Thứ Bảy. */
export function thuTrongTuan(ngay: string): number {
  const [y, m, d] = ngay.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function tenThu(ngay: string): string {
  return THU[thuTrongTuan(ngay)] ?? "";
}

/** "Thứ…, dd/mm/yyyy · Âm lịch d/m năm Can Chi" kèm tên ngày lễ. */
export function dongNgay(ngay: string): string {
  const [y, m, d] = ngay.split("-");
  const am = amLich(ngay);
  const le = ngayLe(ngay);
  return `${tenThu(ngay)}, ${d}/${m}/${y} · ${moTaAm(am)}${le ? ` · ${le.ten}` : ""}`;
}
