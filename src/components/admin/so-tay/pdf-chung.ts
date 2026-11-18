/**
 * Khung PDF A4 chung của Sổ tay (mục 9.4): phông Noto Sans có đủ dấu tiếng
 * Việt, đầu trang có logo, chân trang "tên công ty · MST · tên tab" và số trang.
 */

import type { jsPDF as JsPdf } from "jspdf";

export const CONG_TY = {
  ten: "CÔNG TY TNHH CỬA ĐỎ",
  tenEn: "RED DOOR Co., Ltd · Việt Nam",
  diaChi: "Số 25A Lô 15, Cụm làng nghề sơn mài Hạ Thái, Xã Hồng Vân, TP Hà Nội",
  mst: "0101455557",
  daiDien: "Bà Nguyễn Thị Tuyến – Quản lý xưởng · ĐT 0973162771",
};

export const RGB = {
  do: [142, 41, 39] as [number, number, number],
  vang: [201, 162, 74] as [number, number, number],
  kem: [250, 245, 236] as [number, number, number],
  chu: [34, 28, 27] as [number, number, number],
  phu: [110, 101, 99] as [number, number, number],
};

let phongDem: Promise<{ thuong: string; dam: string; logo: string }> | null =
  null;

async function base64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được ${url} (${res.status}).`);
  const buf = await res.arrayBuffer();
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function taiTaiNguyen() {
  if (phongDem) return phongDem;
  const tai = Promise.all([
    base64("/so-tay/fonts/NotoSans-Regular.ttf"),
    base64("/so-tay/fonts/NotoSans-Bold.ttf"),
    base64("/logo_rd.jpg"),
  ]).then(([thuong, dam, logo]) => ({
    thuong,
    dam,
    logo: `data:image/jpeg;base64,${logo}`,
  }));
  // Lỗi mạng một lần không được làm hỏng mọi lần xuất PDF sau đó.
  tai.catch(() => {
    if (phongDem === tai) phongDem = null;
  });
  phongDem = tai;
  return tai;
}

export async function taoPdf(
  ngang: boolean,
): Promise<{ doc: JsPdf; logo: string }> {
  const [{ jsPDF }, tn] = await Promise.all([import("jspdf"), taiTaiNguyen()]);
  const doc = new jsPDF({
    orientation: ngang ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });
  doc.addFileToVFS("NotoSans-Regular.ttf", tn.thuong);
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  doc.addFileToVFS("NotoSans-Bold.ttf", tn.dam);
  doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
  doc.setFont("NotoSans", "normal");
  return { doc, logo: tn.logo };
}

/** Đầu trang đầu tiên; trả về y bắt đầu nội dung. */
export function dauTrangDau(
  doc: JsPdf,
  logo: string,
  ngayXuat: string,
  nguoiXuat: string,
): number {
  const w = doc.internal.pageSize.getWidth();
  doc.addImage(logo, "JPEG", 12, 10, 24, 18);
  doc.setFont("NotoSans", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...RGB.do);
  doc.text(CONG_TY.ten, 40, 15);
  doc.setFont("NotoSans", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...RGB.chu);
  doc.text(CONG_TY.diaChi, 40, 20);
  doc.text(`Mã số thuế: ${CONG_TY.mst}`, 40, 24);
  doc.text(`Đại diện: ${CONG_TY.daiDien}`, 40, 28);
  doc.text(`Ngày xuất: ${ngayXuat}`, w - 12, 15, { align: "right" });
  doc.text(`Người xuất: ${nguoiXuat}`, w - 12, 20, { align: "right" });
  doc.setDrawColor(...RGB.vang);
  doc.setLineWidth(0.8);
  doc.line(12, 32, w - 12, 32);
  doc.setDrawColor(...RGB.do);
  doc.setLineWidth(0.4);
  doc.line(12, 33.4, w - 12, 33.4);
  return 40;
}

/** Đầu trang nhỏ (trang sau) và chân trang mọi trang. */
export function dauChanTrang(doc: JsPdf, logo: string, tenTab: string): void {
  const n = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    if (i > 1) {
      doc.addImage(logo, "JPEG", 12, 6, 10, 7.5);
      doc.setFont("NotoSans", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...RGB.do);
      doc.text(tenTab, 25, 11);
      doc.setDrawColor(...RGB.vang);
      doc.setLineWidth(0.3);
      doc.line(12, 15, w - 12, 15);
    }
    doc.setFont("NotoSans", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...RGB.phu);
    doc.text(`${CONG_TY.ten} · MST ${CONG_TY.mst} · ${tenTab}`, 12, h - 7);
    doc.text(`Trang ${i}/${n}`, w - 12, h - 7, { align: "right" });
  }
}

/** Tiêu đề một mục: vạch vàng + chữ đỏ in hoa. */
export function tieuDeMuc(doc: JsPdf, y: number, text: string): number {
  doc.setFillColor(...RGB.vang);
  doc.rect(12, y - 3.6, 1.6, 4.6, "F");
  doc.setFont("NotoSans", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...RGB.do);
  doc.text(text.toLocaleUpperCase("vi"), 15.5, y);
  return y + 3;
}

/** Kiểu bảng chung: tiêu đề nền đỏ chữ trắng, dòng xen kẽ kem, số căn phải. */
export function kieuBang(cotSo: number[], coTong: boolean) {
  return {
    styles: {
      font: "NotoSans",
      fontSize: 7.5,
      cellPadding: 1.4,
      textColor: RGB.chu,
      lineColor: [226, 214, 196] as [number, number, number],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: RGB.do,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: "bold" as const,
    },
    alternateRowStyles: { fillColor: RGB.kem },
    footStyles: {
      fillColor: RGB.kem,
      textColor: RGB.chu,
      fontStyle: "bold" as const,
    },
    columnStyles: Object.fromEntries(
      cotSo.map((i) => [i, { halign: "right" as const }]),
    ),
    showFoot: coTong ? ("lastPage" as const) : ("never" as const),
    margin: { left: 12, right: 12, top: 20, bottom: 14 },
  };
}
