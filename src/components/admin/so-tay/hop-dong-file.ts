/**
 * File hợp đồng gia công từng cơ sở (mục 9.5): "PHỤ LỤC GIAO VIỆC – HỢP ĐỒNG
 * GIA CÔNG", dùng chung nội dung cho Excel và PDF A4.
 */

import { type ChiMuc } from "@/domains/so-tay/nghiep-vu/chi-muc";
import {
  BAO_BI_DUOC_UNG,
  type HopDongTinh,
  mucTamUng,
  sxCalc,
} from "@/domains/so-tay/nghiep-vu/hop-dong";
import { mocDon } from "@/domains/so-tay/nghiep-vu/tien-do";
import { dvn, fm, fq, slug, today } from "@/domains/so-tay/tien-ich";

import { CONG_TY, dauChanTrang, RGB, taoPdf, tieuDeMuc } from "./pdf-chung";

type NoiDungHd = {
  h: HopDongTinh;
  soHd: string;
  thongTin: Array<[string, string]>;
  tienDo: string[][];
  sanPham: Array<{ o: Array<string | number>; kt?: string }>;
  tong: number;
  thanhToan: Array<[string, number, boolean?]>;
  dieuKhoan: string[];
  benNhan: string;
  tenFile: string;
};

function dieuKhoanUng(h: HopDongTinh): string {
  const laMoc = (h.byCP["Chi phí làm mộc"] ?? 0) > 0;
  const laBaoBi = (h.byCP["Chi phí bao bì"] ?? 0) > 0;
  const gt = h.daKy ? h.daGhi : h.gt;
  const khac = Object.keys(h.byCP).some(
    (cp) => cp !== "Chi phí làm mộc" && cp !== "Chi phí bao bì",
  );
  if (khac)
    return "Được tạm ứng 30% giá trị hợp đồng bằng tiền mặt, làm tròn xuống triệu đồng; phần lẻ thanh toán cuối kỳ.";
  if (laMoc && gt > 10_000_000)
    return "Được xét tạm ứng tối đa 30% giá trị hợp đồng, làm tròn xuống triệu đồng; phần còn lại thanh toán trong 7 ngày kể từ khi giao xong toàn bộ mộc.";
  if (laMoc)
    return "Không tạm ứng. Tiền mộc thanh toán 100% trong 7 ngày kể từ khi giao xong toàn bộ mộc.";
  if (laBaoBi && BAO_BI_DUOC_UNG.includes(h.dt))
    return "Được tạm ứng tối đa 30% giá trị hợp đồng, làm tròn xuống triệu đồng; phần lẻ thanh toán cuối kỳ.";
  return "Không tạm ứng.";
}

export function noiDungHopDong(cm: ChiMuc, dh: string, dt: string): NoiDungHd {
  const h = sxCalc(cm, dh, dt);
  const sx = cm.sx.get(dh);
  const don = cm.don.get(dh);
  const doiTuong = cm.dt.get(dt);
  const td = sx ? mocDon(cm, sx) : null;
  const khau = new Set(h.pcs.map((p) => p.khau));
  const ngayNhan =
    h.ngayKy ??
    h.pcs
      .map((p) => (p.at ? today(new Date(p.at)) : ""))
      .filter(Boolean)
      .sort()[0] ??
    "";

  const dongTd = (ten: string, han?: string, tt?: string, gc = "") => [
    ten,
    dvn(tt ?? han),
    tt ? "Đã xong" : "Kế hoạch",
    gc,
  ];
  const tienDo: string[][] = [
    dongTd(
      "Ngày nhận đơn hàng",
      ngayNhan,
      ngayNhan,
      h.ngayKy ? "Ngày ký HĐ" : "Ngày chia việc",
    ),
  ];
  if (td && khau.has("Mộc")) {
    const cs = td.mocCS.find((m) => m.dt === dt);
    tienDo.push(
      dongTd(
        "Ngày giao mộc",
        cs?.han ?? td.moc[0]?.han,
        cs?.muc === "xong" ? (td.moc[0]?.tt ?? cs.han) : undefined,
      ),
    );
  }
  if (khau.has("Bao bì")) {
    const bb = h.pcs.filter((p) => p.khau === "Bao bì");
    const han = bb
      .map((p) => p.han ?? "")
      .sort()
      .pop();
    const du = bb.every(
      (p) =>
        (cm.ghTheoPc.get(p._id) ?? []).reduce((s, g) => s + (g.sl ?? 0), 0) >=
        (p.sl ?? 0),
    );
    const tt = du
      ? bb
          .flatMap((p) => (cm.ghTheoPc.get(p._id) ?? []).map((g) => g.ngay))
          .sort()
          .pop()
      : undefined;
    tienDo.push(dongTd("Ngày giao bao bì về kho", han, tt));
  }
  if (td) {
    const [, m2, , m4, m5] = td.moc;
    tienDo.push(dongTd("Ngày đem sản phẩm sang in", m2?.han, m2?.tt));
    tienDo.push(dongTd("Ngày giao kiểm hàng", m4?.han, m4?.tt));
    tienDo.push(dongTd("Ngày giao hàng tại kho nhà máy", m5?.han, m5?.tt));
  }

  const sanPham: NoiDungHd["sanPham"] = [];
  let stt = 0;
  const daGhiKt = new Set<string>();
  for (const p of h.pcs) {
    const item = sx?.items.find((i) => i.ma === p.ma);
    const tru = p.tru === dt;
    const thanhTien = (tru ? -1 : 1) * (p.sl ?? 0) * (p.dg ?? 0);
    stt++;
    const kt = item?.ktsx && !daGhiKt.has(item.ma) ? item.ktsx : undefined;
    if (kt && item) daGhiKt.add(item.ma);
    sanPham.push({
      o: [
        stt,
        p.ma ?? "",
        tru ? "— nhà máy làm nhập kho thay, trừ tiền" : (item?.mt ?? ""),
        item
          ? [item.L, item.W, item.H].filter((x) => x !== undefined).join("×")
          : "",
        p.khau,
        fq(p.sl ?? 0),
        tru ? -(p.dg ?? 0) : (p.dg ?? 0),
        thanhTien,
        dvn(p.han),
      ],
      ...(kt ? { kt } : {}),
    });
  }

  const thanhToan: NoiDungHd["thanhToan"] = [];
  if (h.coTamUng)
    thanhToan.push([
      "Tạm ứng 30% (làm tròn xuống triệu đồng)",
      mucTamUng(h.daKy ? h.daGhi : h.gt),
    ]);
  thanhToan.push(["Đã tạm ứng", h.daUng]);
  thanhToan.push(["Đã thanh toán", h.daTT]);
  thanhToan.push(["Vật tư xưởng cấp (trừ khi quyết toán)", h.vtCap]);
  thanhToan.push(["Còn phải trả", h.conPhaiTra, true]);

  const soDinhDanh = doiTuong?.so ?? "";
  const benNhan = `${soDinhDanh ? `${soDinhDanh} · ` : ""}${doiTuong?.n ?? dt}`;
  return {
    h,
    soHd: h.so ?? "(chưa ký – giá tạm tính)",
    thongTin: [
      [
        "Đơn hàng",
        [dh, don?.n, sx?.khach ?? don?.k].filter(Boolean).join(" · "),
      ],
      ["Ngày xuất hàng (PI)", dvn(sx?.ngayxuat)],
      ["Cơ sở nhận việc", benNhan],
      ["Số CCCD", doiTuong?.cccd ?? ""],
      ["Điện thoại cơ sở", doiTuong?.p ?? ""],
      ["Khâu", [...khau].join(", ")],
    ],
    tienDo,
    sanPham,
    tong: h.gt,
    thanhToan,
    dieuKhoan: [
      "Đơn giá là giá tạm tính. Đổi giá sau khi ký thì hai bên ký phụ lục, phần chênh ghi điều chỉnh tăng hoặc giảm.",
      dieuKhoanUng(h),
      "Vật tư xưởng cấp không trừ vào tạm ứng; trừ vào phần thanh toán sau khi cơ sở xong hợp đồng.",
      "Thanh toán hợp đồng trong 15 ngày kể từ ngày xuất hàng.",
      "Nếu nhà máy làm nhập kho thay, tiền nhập kho trừ vào thanh toán của cơ sở.",
    ],
    benNhan,
    tenFile: `HD-${dh}-${soDinhDanh || "X"}-${slug(doiTuong?.n ?? dt)}`,
  };
}

const COT_SP = [
  "STT",
  "Mã hàng",
  "Mô tả sản phẩm",
  "KT (cm)",
  "Khâu",
  "SL",
  "Đơn giá (đ)",
  "Thành tiền (đ)",
  "Hạn giao",
];

export async function hopDongExcel(cm: ChiMuc, dh: string, dt: string) {
  const XLSX = await import("xlsx");
  const nd = noiDungHopDong(cm, dh, dt);
  const aoa: Array<Array<string | number>> = [
    [CONG_TY.ten + " (RED DOOR)"],
    [CONG_TY.tenEn],
    [`Địa chỉ: ${CONG_TY.diaChi}`],
    [`Mã số thuế: ${CONG_TY.mst} · Đại diện: ${CONG_TY.daiDien}`],
    [],
    ["PHỤ LỤC GIAO VIỆC – HỢP ĐỒNG GIA CÔNG"],
    [`Số: ${nd.soHd} · Ngày lập: ${dvn(today())}`],
    [],
    ...nd.thongTin.map(([a, b]) => [a, b]),
    [],
    ["1. TIẾN ĐỘ SẢN XUẤT"],
    ["Mốc", "Ngày", "Tình trạng", "Ghi chú"],
    ...nd.tienDo,
    [],
    ["2. CHI TIẾT SẢN PHẨM"],
    COT_SP,
  ];
  const soO: Array<[number, number]> = [];
  for (const sp of nd.sanPham) {
    soO.push([aoa.length, 6], [aoa.length, 7]);
    aoa.push(sp.o);
    if (sp.kt) aoa.push(["", `Ghi chú kỹ thuật: ${sp.kt}`]);
  }
  soO.push([aoa.length, 7]);
  aoa.push(["", "TỔNG GIÁ TRỊ TẠM TÍNH", "", "", "", "", "", nd.tong]);
  aoa.push([], ["3. GIÁ TRỊ VÀ THANH TOÁN"]);
  for (const [ten, v] of nd.thanhToan) {
    soO.push([aoa.length, 1]);
    aoa.push([ten, v]);
  }
  aoa.push(
    [],
    ["4. ĐIỀU KHOẢN"],
    ...nd.dieuKhoan.map((d, i) => [`${i + 1}. ${d}`]),
  );
  aoa.push(
    [],
    ["ĐẠI DIỆN BÊN GIAO", "", "", "", "", "ĐẠI DIỆN BÊN NHẬN"],
    [CONG_TY.ten, "", "", "", "", nd.benNhan.toLocaleUpperCase("vi")],
    ["(Ký, ghi rõ họ tên, đóng dấu)", "", "", "", "", "(Ký, ghi rõ họ tên)"],
    [],
    [],
    ["Nguyễn Thị Tuyến – Quản lý xưởng"],
  );
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (const [r, c] of soO) {
    const o = ws[XLSX.utils.encode_cell({ r, c })];
    if (o) o.z = "#,##0";
  }
  ws["!cols"] = [8, 16, 40, 14, 16, 8, 14, 16, 12].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Phu luc giao viec");
  XLSX.writeFile(wb, `${nd.tenFile}.xlsx`);
}

export async function hopDongPdf(cm: ChiMuc, dh: string, dt: string) {
  const nd = noiDungHopDong(cm, dh, dt);
  const [{ doc, logo }, { default: autoTable }] = await Promise.all([
    taoPdf(false),
    import("jspdf-autotable"),
  ]);
  const w = doc.internal.pageSize.getWidth();
  const cuoi = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY;
  const kieu = {
    styles: {
      font: "NotoSans",
      fontSize: 7.2,
      cellPadding: 1.1,
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
    margin: { left: 12, right: 12, top: 18, bottom: 14 },
  };

  doc.addImage(logo, "JPEG", 12, 9, 22, 16.5);
  doc.setFont("NotoSans", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...RGB.do);
  doc.text(`${CONG_TY.ten} (RED DOOR)`, 37, 13);
  doc.setFont("NotoSans", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...RGB.chu);
  doc.text(CONG_TY.tenEn, 37, 17);
  doc.text(`Địa chỉ: ${CONG_TY.diaChi}`, 37, 20.5);
  doc.text(`Mã số thuế: ${CONG_TY.mst} · Đại diện: ${CONG_TY.daiDien}`, 37, 24);
  doc.setDrawColor(...RGB.vang);
  doc.setLineWidth(0.8);
  doc.line(12, 28, w - 12, 28);
  doc.setDrawColor(...RGB.do);
  doc.setLineWidth(0.4);
  doc.line(12, 29.3, w - 12, 29.3);
  doc.setFont("NotoSans", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(...RGB.do);
  doc.text("PHỤ LỤC GIAO VIỆC – HỢP ĐỒNG GIA CÔNG", w / 2, 36, {
    align: "center",
  });
  doc.setFont("NotoSans", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...RGB.chu);
  doc.text(`Số: ${nd.soHd} · Ngày lập: ${dvn(today())}`, w / 2, 40.5, {
    align: "center",
  });

  // Khung thông tin (nền kem, 2 cột).
  const tt = nd.thongTin;
  const dongTT: string[][] = [];
  for (let i = 0; i < tt.length; i += 2) {
    const a = tt[i] as [string, string];
    const b = tt[i + 1];
    dongTT.push([a[0], a[1], b?.[0] ?? "", b?.[1] ?? ""]);
  }
  autoTable(doc, {
    startY: 43,
    body: dongTT,
    theme: "plain",
    styles: {
      font: "NotoSans",
      fontSize: 7.5,
      cellPadding: 1,
      fillColor: RGB.kem,
      textColor: RGB.chu,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 32 },
      2: { fontStyle: "bold", cellWidth: 32 },
    },
    margin: { left: 12, right: 12 },
  });

  let y = tieuDeMuc(doc, cuoi() + 6, "1. Tiến độ sản xuất");
  autoTable(doc, {
    startY: y,
    head: [["Mốc", "Ngày", "Tình trạng", "Ghi chú"]],
    body: nd.tienDo,
    ...kieu,
  });

  y = tieuDeMuc(doc, cuoi() + 6, "2. Chi tiết sản phẩm");
  const body: Array<
    Array<
      string | number | { content: string; colSpan: number; styles?: object }
    >
  > = [];
  for (const sp of nd.sanPham) {
    body.push(sp.o.map((v, i) => (i === 6 || i === 7 ? fm(v as number) : v)));
    if (sp.kt)
      body.push([
        {
          content: `Ghi chú kỹ thuật: ${sp.kt}`,
          colSpan: 9,
          styles: { fontStyle: "italic" },
        },
      ]);
  }
  autoTable(doc, {
    startY: y,
    head: [COT_SP],
    body,
    foot: [[{ content: "TỔNG GIÁ TRỊ TẠM TÍNH", colSpan: 7 }, fm(nd.tong), ""]],
    showFoot: "lastPage",
    footStyles: { fillColor: RGB.kem, textColor: RGB.chu, fontStyle: "bold" },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
    ...kieu,
  });

  y = tieuDeMuc(doc, cuoi() + 6, "3. Giá trị và thanh toán");
  autoTable(doc, {
    startY: y,
    body: nd.thanhToan.map(([ten, v]) => [ten, fm(v)]),
    ...kieu,
    columnStyles: { 1: { halign: "right", cellWidth: 40 } },
    didParseCell: (d) => {
      if (d.row.index === nd.thanhToan.length - 1)
        d.cell.styles.fontStyle = "bold";
    },
  });

  y = tieuDeMuc(doc, cuoi() + 6, "4. Điều khoản");
  autoTable(doc, {
    startY: y,
    body: nd.dieuKhoan.map((d, i) => [`${i + 1}.`, d]),
    theme: "plain",
    styles: {
      font: "NotoSans",
      fontSize: 7.5,
      cellPadding: 0.8,
      textColor: RGB.chu,
    },
    columnStyles: { 0: { cellWidth: 6 } },
    margin: { left: 12, right: 12, top: 18, bottom: 14 },
  });

  y = cuoi() + 8;
  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = 24;
  }
  const trai = 45;
  const phai = w - 55;
  doc.setFont("NotoSans", "bold");
  doc.setFontSize(8.5);
  doc.text("ĐẠI DIỆN BÊN GIAO", trai, y, { align: "center" });
  doc.text("ĐẠI DIỆN BÊN NHẬN", phai, y, { align: "center" });
  doc.setFont("NotoSans", "normal");
  doc.setFontSize(7.5);
  doc.text(CONG_TY.ten, trai, y + 4, { align: "center" });
  doc.text(nd.benNhan.toLocaleUpperCase("vi"), phai, y + 4, {
    align: "center",
  });
  doc.text("(Ký, ghi rõ họ tên, đóng dấu)", trai, y + 8, { align: "center" });
  doc.text("(Ký, ghi rõ họ tên)", phai, y + 8, { align: "center" });
  doc.setFont("NotoSans", "bold");
  doc.text("Nguyễn Thị Tuyến – Quản lý xưởng", trai, y + 28, {
    align: "center",
  });

  // Trang sau có đầu trang nhỏ "Phụ lục giao việc – số … · cơ sở".
  dauChanTrang(doc, logo, `Phụ lục giao việc – số ${nd.soHd} · ${nd.benNhan}`);
  doc.save(`${nd.tenFile}.pdf`);
}
