/**
 * Danh mục (mục 6): số định danh cơ sở, kho lưu đối chiếu Axx, tham chiếu
 * trước khi xóa.
 */

import type { DoiTuong, DuLieu } from "../kieu";

export type NhomSo = "A" | "B" | "C" | "D" | "E";

export const TEN_NHOM_SO: Record<NhomSo, string> = {
  A: "Cơ sở làm mộc",
  B: "Cơ sở hoàn thiện",
  C: "Cơ sở bao bì",
  D: "Vật tư & dịch vụ khác",
  E: "Vận chuyển",
};

const LOAI_CO_SO = ["Cơ sở gia công", "Nhà cung cấp", "Dịch vụ"];

/** Nhóm số định danh của một đối tượng; `null` nếu không cấp số. */
export function soLoai(d: {
  g?: string | undefined;
  l: string;
  luu?: boolean | undefined;
}): NhomSo | null {
  if (d.luu) return null;
  const g = (d.g ?? "").trim();
  if (g === "Mộc" || g === "Vóc") return "A";
  if (g === "Hoàn thiện") return "B";
  if (g === "Bao bì") return "C";
  if (g === "Vận chuyển") return "E";
  if (LOAI_CO_SO.includes(d.l) && g !== "Chưa rõ") return "D";
  return null;
}

/** Số mới = chữ nhóm + (số lớn nhất trong nhóm + 1); số đã cấp không dồn lại. */
export function soMoi(
  nhom: NhomSo,
  ds: readonly Pick<DoiTuong, "so">[],
): string {
  let max = 0;
  for (const d of ds) {
    const m = /^([A-E])(\d+)$/.exec(d.so ?? "");
    if (m && m[1] === nhom) max = Math.max(max, Number(m[2]));
  }
  return `${nhom}${String(max + 1).padStart(2, "0")}`;
}

/**
 * Số định danh sau khi sửa: nhóm không đổi thì giữ số; đổi nhóm thì cấp số
 * mới ở nhóm đó; vào kho Axx thì bỏ số; ra khỏi kho thì cấp số mới.
 */
export function soSauKhiSua(
  cu: Pick<DoiTuong, "g" | "l" | "luu" | "so" | "_id">,
  moi: { g?: string | undefined; l: string; luu?: boolean | undefined },
  ds: readonly Pick<DoiTuong, "so" | "_id">[],
): string | undefined {
  const nhomMoi = soLoai(moi);
  if (!nhomMoi) return undefined;
  if (cu.so && cu.so.startsWith(nhomMoi) && !cu.luu) return cu.so;
  return soMoi(
    nhomMoi,
    ds.filter((d) => d._id !== cu._id),
  );
}

/** So sánh theo số định danh (A01 < A02 < B01…), không có số xếp sau. */
export function soSanhSo(
  a: Pick<DoiTuong, "so" | "n">,
  b: Pick<DoiTuong, "so" | "n">,
): number {
  const ka = a.so ? `${a.so[0]}${a.so.slice(1).padStart(4, "0")}` : "~";
  const kb = b.so ? `${b.so[0]}${b.so.slice(1).padStart(4, "0")}` : "~";
  return ka.localeCompare(kb) || a.n.localeCompare(b.n, "vi");
}

export type ThamChieu = { ten: string; so: number };

/** Đếm tham chiếu tới một đối tượng / đơn / vật tư trong mọi collection và số dư. */
export function demThamChieu(
  du: DuLieu,
  loai: "doituong" | "donhang" | "vattu",
  id: string,
): ThamChieu[] {
  const kq: ThamChieu[] = [];
  const dem = (ten: string, n: number) => {
    if (n > 0) kq.push({ ten, so: n });
  };
  if (loai === "doituong") {
    dem(
      "Phần việc",
      (du.phancong ?? []).filter((p) => p.dt === id || p.tru === id).length,
    );
    dem("Hợp đồng", (du.hopdong ?? []).filter((h) => h.dt === id).length);
    dem("Công nợ", (du.congno ?? []).filter((c) => c.dt === id).length);
    dem("Phiếu thu", (du.thutien ?? []).filter((c) => c.dt === id).length);
    dem("Đề nghị chi", (du.denghichi ?? []).filter((c) => c.dt === id).length);
    dem("Phiếu kho", (du.phieukho ?? []).filter((c) => c.dt === id).length);
    dem("Đơn mua", (du.donmua ?? []).filter((c) => c.ncc === id).length);
    dem("Chấm công", (du.chamcong ?? []).filter((c) => c.nv === id).length);
    dem("Bảng lương", (du.luong ?? []).filter((c) => c.nv === id).length);
    dem(
      "Nhân viên văn phòng",
      (du.nhanvienvp ?? []).filter((c) => c.nv === id).length,
    );
    const sd = du.sodu;
    dem(
      `Số dư chốt ngày ${sd?.ngay ?? "(chưa chốt)"}`,
      (sd?.cn ?? []).filter((c) => c.d === id).length +
        (sd?.son ?? []).filter((c) => c.d === id).length,
    );
  } else if (loai === "donhang") {
    dem("Đơn sản xuất", (du.sanxuat ?? []).filter((c) => c.dh === id).length);
    dem("Phần việc", (du.phancong ?? []).filter((c) => c.dh === id).length);
    dem("Hợp đồng", (du.hopdong ?? []).filter((c) => c.dh === id).length);
    dem("Công nợ", (du.congno ?? []).filter((c) => c.dh === id).length);
    dem("Đề nghị chi", (du.denghichi ?? []).filter((c) => c.dh === id).length);
    dem("Phiếu kho", (du.phieukho ?? []).filter((c) => c.dh === id).length);
    dem(
      "Chi tiêu xưởng",
      (du.chixuong ?? []).filter((c) => c.dh === id).length,
    );
    const sd = du.sodu;
    dem(
      `Số dư chốt ngày ${sd?.ngay ?? "(chưa chốt)"}`,
      (sd?.cn ?? []).filter((c) => c.o === id).length +
        (sd?.tamtinh ?? []).filter((c) => c.o === id).length,
    );
  } else {
    dem(
      "Phiếu kho",
      (du.phieukho ?? []).filter((p) => p.dong.some((d) => d.vt === id)).length,
    );
    dem(
      "Đơn mua",
      (du.donmua ?? []).filter((p) => p.dong.some((d) => d.vt === id)).length,
    );
  }
  return kq;
}
