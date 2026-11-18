/**
 * Đọc file PI (Excel) – mục 8.2. Chỉ đọc sheet đầu (đã đổi sang mảng dòng),
 * tìm dòng tiêu đề có "Item code". KHÔNG đọc cột giá: chỉ lấy mã hàng, mô tả,
 * kích thước, số lượng, quy cách đóng gói.
 */

import type { MaHang } from "../kieu";

const chuan = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** "40x30x10", "40 x 30 x 10 cm", "Ø30xH10" → [40, 30, 10]. */
export function tachKichThuoc(
  v: unknown,
): [number | undefined, number | undefined, number | undefined] {
  const so = String(v ?? "")
    .replace(/,/g, ".")
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number);
  return [so?.[0], so?.[1], so?.[2]];
}

const laSo = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "")
    .replace(/[^\d.,-]/g, "")
    .replace(/,/g, "");
  const n = Number(s);
  return s && Number.isFinite(n) ? n : undefined;
};

type ViTri = {
  ma: number;
  kt?: number;
  mt?: number;
  u?: number;
  inner?: number;
  io?: number;
  outer?: number;
  qty?: number;
};

function timCot(tieuDe: unknown[]): ViTri | null {
  const t = tieuDe.map(chuan);
  const ma = t.findIndex((x) => x.includes("item code"));
  if (ma < 0) return null;
  const tim = (dk: (x: string) => boolean) => {
    const i = t.findIndex(
      (x, idx) => idx !== ma && dk(x) && !/price|amount|usd|total|giá/.test(x),
    );
    return i >= 0 ? i : undefined;
  };
  const vt: ViTri = { ma };
  const gan = <K extends keyof ViTri>(k: K, v: ViTri[K] | undefined) => {
    if (v !== undefined) vt[k] = v;
  };
  gan(
    "outer",
    tim((x) => x.startsWith("outer dimension")),
  );
  gan(
    "kt",
    tim((x) => x.startsWith("dimension")),
  );
  gan(
    "mt",
    tim((x) => x.startsWith("color")),
  );
  gan(
    "u",
    tim((x) => x === "unit" || x.startsWith("unit ")),
  );
  gan(
    "inner",
    tim((x) => x.startsWith("qty inner")),
  );
  gan(
    "io",
    tim((x) => x.replace(/\s/g, "").startsWith("inner/outer")),
  );
  gan(
    "qty",
    tim(
      (x) =>
        x === "qty" ||
        x === "qty." ||
        x === "quantity" ||
        x.startsWith("qty ("),
    ),
  );
  return vt;
}

export function docPi(dong: readonly unknown[][]): MaHang[] {
  const iTieuDe = dong.findIndex((d) =>
    d.some((o) => chuan(o).includes("item code")),
  );
  if (iTieuDe < 0)
    throw new Error('Không thấy dòng tiêu đề có cột "Item code".');
  const vt = timCot(dong[iTieuDe] ?? []);
  if (!vt) throw new Error('Không thấy cột "Item code".');
  if (vt.qty === undefined) throw new Error('Không thấy cột "QTY".');

  const kq: MaHang[] = [];
  for (const d of dong.slice(iTieuDe + 1)) {
    const ma = String(d[vt.ma] ?? "").trim();
    const qty = laSo(d[vt.qty]);
    if (!ma || !qty || qty <= 0) continue;
    const [L, W, H] = vt.kt !== undefined ? tachKichThuoc(d[vt.kt]) : [];
    const [oL, oW, oH] =
      vt.outer !== undefined ? tachKichThuoc(d[vt.outer]) : [];
    const item: MaHang = { ma, qty };
    const gan = <K extends keyof MaHang>(k: K, v: MaHang[K] | undefined) => {
      if (v !== undefined && v !== "") item[k] = v;
    };
    gan("mt", vt.mt !== undefined ? String(d[vt.mt] ?? "").trim() : undefined);
    gan("L", L);
    gan("W", W);
    gan("H", H);
    gan("u", vt.u !== undefined ? String(d[vt.u] ?? "").trim() : undefined);
    gan("inner", vt.inner !== undefined ? laSo(d[vt.inner]) : undefined);
    gan("io", vt.io !== undefined ? laSo(d[vt.io]) : undefined);
    gan("oL", oL);
    gan("oW", oW);
    gan("oH", oH);
    kq.push(item);
  }
  if (kq.length === 0)
    throw new Error("File PI không có mã hàng nào có số lượng.");
  return kq;
}
