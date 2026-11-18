/**
 * Tem QR thùng sơn (mục 7.8): khổ A4, 21 tem 70×40 mm (3 cột × 7 hàng), in ở
 * cỡ 100%. Mỗi dòng vật tư của phiếu là một tem.
 */

import type { PhieuKho } from "@/domains/so-tay/kieu";
import { type ChiMuc, tenDt } from "@/domains/so-tay/nghiep-vu/chi-muc";
import { dvn, fm, fq } from "@/domains/so-tay/tien-ich";

import { RGB, taoPdf } from "./pdf-chung";

export async function inTemQr(cm: ChiMuc, phieu: PhieuKho) {
  const [{ doc }, QR] = await Promise.all([taoPdf(false), import("qrcode")]);
  const W = 70;
  const H = 40;
  const top = (297 - 7 * H) / 2;
  const tem = phieu.dong.map((d) => {
    const vt = cm.vt.get(d.vt);
    return {
      coSo: tenDt(cm, phieu.dt),
      mau: vt?.n ?? d.vt,
      sl: `${fq(d.sl ?? 0)} ${vt?.u ?? ""}`.trim(),
      gia: d.dg ? `${fm(d.dg)} đ` : "",
      ngay: dvn(phieu.ngay),
      ma: d.vt,
    };
  });
  for (let i = 0; i < tem.length; i++) {
    const t = tem[i];
    if (!t) continue;
    if (i > 0 && i % 21 === 0) doc.addPage();
    const vt = i % 21;
    const x = (vt % 3) * W;
    const y = top + Math.floor(vt / 3) * H;
    doc.setDrawColor(...RGB.vang);
    doc.setLineWidth(0.2);
    doc.rect(x + 1, y + 1, W - 2, H - 2);
    const noiDung = `RED DOOR | ${phieu.so} | ${t.coSo} | ${t.ma} ${t.mau} | ${t.sl} | ${t.gia} | ${t.ngay}`;
    const qr = await QR.toDataURL(noiDung, {
      margin: 0,
      width: 240,
      errorCorrectionLevel: "M",
    });
    doc.addImage(qr, "PNG", x + 3, y + 5, 28, 28);
    doc.setFont("NotoSans", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...RGB.do);
    doc.text("RED DOOR", x + 34, y + 7);
    doc.setFont("NotoSans", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...RGB.chu);
    const dong = [
      `Cơ sở: ${t.coSo}`,
      `Màu: ${t.mau}`,
      `SL: ${t.sl}`,
      t.gia ? `Đơn giá: ${t.gia}` : "",
      `Ngày bán: ${t.ngay}`,
    ].filter(Boolean);
    let yy = y + 12;
    for (const d of dong) {
      const tach = doc.splitTextToSize(d, W - 37) as string[];
      doc.text(tach.slice(0, 2), x + 34, yy);
      yy += 4 * Math.min(2, tach.length);
    }
  }
  doc.save(`TEM-${phieu.so}.pdf`);
}
