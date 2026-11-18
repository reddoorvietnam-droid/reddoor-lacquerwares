/**
 * Xuất Excel và PDF A4 cho mọi tab (mục 9.4): lấy đúng những gì đang hiện —
 * thẻ tóm tắt, các bảng (bỏ cột nút bấm), bộ lọc đang chọn.
 */

import { dvn, fm, slug, today } from "@/domains/so-tay/tien-ich";

import {
  CONG_TY,
  dauChanTrang,
  dauTrangDau,
  kieuBang,
  RGB,
  taoPdf,
  tieuDeMuc,
} from "./pdf-chung";

type O = string | number;
type BangXuat = {
  tieuDe: string;
  cot: string[];
  cotSo: number[];
  dong: O[][];
  tong?: O[];
};
type NoiDung = { the: Array<{ nhan: string; gt: string }>; bang: BangXuat[] };

const ngoaiNut = (el: Element) => !el.closest("[data-bo-xuat]");

function giaTriO(td: Element): O {
  const so = td.getAttribute("data-so");
  if (so !== null && so !== "" && !Number.isNaN(Number(so))) return Number(so);
  return (td.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function docNoiDung(vung: HTMLElement): NoiDung {
  const the = [...vung.querySelectorAll("[data-xuat-the]")]
    .filter(ngoaiNut)
    .map((e) => ({
      nhan: e.getAttribute("data-nhan") ?? "",
      gt: e.getAttribute("data-gt") ?? "",
    }));
  const bang: BangXuat[] = [];
  for (const muc of vung.querySelectorAll("[data-xuat-muc]")) {
    const tieuDe = muc.getAttribute("data-xuat-muc") ?? "";
    for (const t of muc.querySelectorAll("table[data-xuat-bang]")) {
      if (t.closest("[data-xuat-muc]") !== muc) continue;
      const ths = [...t.querySelectorAll("thead th")];
      const giu = ths.map((th) => !th.hasAttribute("data-bo-xuat"));
      const cot = ths
        .filter((_, i) => giu[i])
        .map((th) => (th.textContent ?? "").trim());
      const cotSo = ths
        .filter((_, i) => giu[i])
        .map((th, i) => (th.hasAttribute("data-so-cot") ? i : -1))
        .filter((i) => i >= 0);
      const dong = [...t.querySelectorAll("tbody tr")]
        .filter((tr) => !tr.querySelector("[data-rong]"))
        .map((tr) =>
          [...tr.querySelectorAll("td")].filter((_, i) => giu[i]).map(giaTriO),
        );
      const tr = t.querySelector("tfoot tr");
      const tong = tr
        ? [...tr.querySelectorAll("td")].filter((_, i) => giu[i]).map(giaTriO)
        : undefined;
      bang.push({ tieuDe, cot, cotSo, dong, ...(tong ? { tong } : {}) });
    }
  }
  return { the, bang };
}

const tenFile = (tenTab: string, duoi: string) =>
  `RD-${slug(tenTab)}-${today()}.${duoi}`;

export async function xuatExcel(
  vung: HTMLElement,
  tenTab: string,
  phu: string,
  nguoi: string,
) {
  const XLSX = await import("xlsx");
  const nd = docNoiDung(vung);
  const aoa: O[][] = [
    [CONG_TY.ten],
    [`${CONG_TY.diaChi} · MST ${CONG_TY.mst}`],
    [`SỔ CHUNG – ${tenTab.toLocaleUpperCase("vi")}`],
    [phu],
    [`Ngày xuất ${dvn(today())} · Người xuất ${nguoi}`],
    [],
  ];
  if (nd.the.length) {
    for (const t of nd.the) aoa.push([t.nhan, t.gt]);
    aoa.push([]);
  }
  const soO: Array<[number, number]> = [];
  for (const b of nd.bang) {
    aoa.push([b.tieuDe.toLocaleUpperCase("vi")]);
    aoa.push(b.cot);
    for (const d of [...b.dong, ...(b.tong ? [b.tong] : [])]) {
      d.forEach((v, c) => typeof v === "number" && soO.push([aoa.length, c]));
      aoa.push(d);
    }
    aoa.push([]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (const [r, c] of soO) {
    const o = ws[XLSX.utils.encode_cell({ r, c })];
    if (o) o.z = "#,##0";
  }
  const soCot = Math.max(2, ...nd.bang.map((b) => b.cot.length));
  ws["!cols"] = Array.from({ length: soCot }, (_, i) => ({
    wch: i === 0 ? 28 : 16,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tenTab.slice(0, 31) || "So tay");
  XLSX.writeFile(wb, tenFile(tenTab, "xlsx"));
}

export async function xuatPdf(
  vung: HTMLElement,
  tenTab: string,
  phu: string,
  nguoi: string,
) {
  const nd = docNoiDung(vung);
  const ngang = nd.bang.some((b) => b.cot.length > 7);
  const [{ doc, logo }, { default: autoTable }] = await Promise.all([
    taoPdf(ngang),
    import("jspdf-autotable"),
  ]);
  const w = doc.internal.pageSize.getWidth();
  let y = dauTrangDau(doc, logo, dvn(today()), nguoi);

  doc.setFont("NotoSans", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...RGB.do);
  doc.text(`SỔ CHUNG – ${tenTab.toLocaleUpperCase("vi")}`, w / 2, y, {
    align: "center",
  });
  y += 5;
  doc.setFont("NotoSans", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...RGB.phu);
  if (phu) doc.text(phu, w / 2, y, { align: "center" });
  y += 6;

  if (nd.the.length) {
    y = tieuDeMuc(doc, y, "Tóm tắt");
    autoTable(doc, {
      startY: y,
      body: nd.the.map((t) => [t.nhan, t.gt]),
      ...kieuBang([1], false),
    });
    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 7;
  }

  for (const b of nd.bang) {
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = 22;
    }
    y = tieuDeMuc(doc, y, b.tieuDe);
    const hien = (v: O) => (typeof v === "number" ? fm(v) : v);
    autoTable(doc, {
      startY: y,
      head: [b.cot],
      body: b.dong.length
        ? b.dong.map((d) => d.map(hien))
        : [
            [
              {
                content: "Chưa có dữ liệu.",
                colSpan: Math.max(1, b.cot.length),
              },
            ],
          ],
      ...(b.tong ? { foot: [b.tong.map(hien)] } : {}),
      ...kieuBang(b.cotSo, Boolean(b.tong)),
      didParseCell: (data) => {
        const text = String(data.cell.raw ?? "");
        if (data.section === "body" && /^(Cộng|Tổng)/.test(text))
          data.cell.styles.fontStyle = "bold";
      },
    });
    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 7;
  }

  dauChanTrang(doc, logo, `Sổ chung – ${tenTab}`);
  doc.save(tenFile(tenTab, "pdf"));
}
