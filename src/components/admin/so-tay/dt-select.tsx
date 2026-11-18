"use client";

import { useMemo, useState } from "react";

import { LOAI_DT, NHOM_DT_GOI_Y, type LoaiDt } from "@/domains/so-tay/hang-so";
import type { DoiTuong } from "@/domains/so-tay/kieu";
import {
  soLoai,
  soMoi,
  soSanhSo,
  soSauKhiSua,
} from "@/domains/so-tay/nghiep-vu/danh-muc";
import { slug } from "@/domains/so-tay/tien-ich";

import {
  Hop,
  Luoi,
  lopNut,
  lopNutNho,
  lopO,
  O,
  ThongBao,
  useLenh,
  useSo,
} from "./ui";

export type LocDt = {
  /** Chỉ các loại này. */
  l?: readonly LoaiDt[];
  /** Chỉ các nhóm (g) này. */
  g?: readonly string[];
};

export function locDoiTuong(
  ds: readonly DoiTuong[],
  loc: LocDt | undefined,
  giu?: string,
) {
  return ds
    .filter(
      (d) =>
        d._id === giu ||
        (!d.luu &&
          (!loc?.l || loc.l.includes(d.l)) &&
          (!loc?.g || loc.g.includes(d.g ?? ""))),
    )
    .sort(soSanhSo);
}

const nhanDt = (d: DoiTuong) => [d.so, d.n, d.g].filter(Boolean).join(" · ");

/** Ô chọn đối tượng dùng chung (mục 6.3). */
export function DtSelect({
  giaTri,
  onChon,
  loc,
  macDinh,
  trong = "— Chọn —",
}: {
  giaTri: string;
  onChon: (c: string) => void;
  loc?: LocDt;
  /** Loại / nhóm điền sẵn khi thêm mới. */
  macDinh?: { l?: LoaiDt; g?: string };
  trong?: string;
}) {
  const { du, dangSua } = useSo();
  const ds = useMemo(
    () => locDoiTuong(du.doituong ?? [], loc, giaTri),
    [du.doituong, loc, giaTri],
  );
  const [tim, setTim] = useState("");
  const [hop, setHop] = useState<"them" | "sua" | null>(null);
  const dangChon = (du.doituong ?? []).find((d) => d._id === giaTri);

  const theoLoai = useMemo(() => {
    const m = new Map<string, DoiTuong[]>();
    for (const d of ds) m.set(d.l, [...(m.get(d.l) ?? []), d]);
    return [...m.entries()];
  }, [ds]);

  function goTim(t: string) {
    setTim(t);
    const q = t.trim().toLowerCase();
    if (!q) return;
    const qs = slug(q);
    const dau = ds.find(
      (d) =>
        (d.so ?? "").toLowerCase().startsWith(q) || slug(d.n).startsWith(qs),
    );
    const chua =
      dau ??
      ds.find(
        (d) => (d.so ?? "").toLowerCase().includes(q) || slug(d.n).includes(qs),
      );
    if (chua) onChon(chua._id);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <input
          className={`${lopO} w-24 shrink-0`}
          placeholder="Số A01…"
          value={tim}
          onChange={(e) => goTim(e.target.value)}
          aria-label="Gõ số định danh hoặc tên"
        />
        <select
          className={lopO}
          value={giaTri}
          onChange={(e) => onChon(e.target.value)}
        >
          <option value="">{trong}</option>
          {dangChon && !ds.some((d) => d._id === giaTri) ? (
            <option value={dangChon._id}>{nhanDt(dangChon)}</option>
          ) : null}
          {giaTri && !dangChon ? (
            <option value={giaTri}>{giaTri}</option>
          ) : null}
          {theoLoai.map(([l, items]) => (
            <optgroup key={l} label={l}>
              {items.map((d) => (
                <option key={d._id} value={d._id}>
                  {nhanDt(d)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {dangSua ? (
        <div className="flex gap-1.5">
          <button
            type="button"
            className={lopNutNho}
            onClick={() => setHop("them")}
          >
            + Thêm mới
          </button>
          {dangChon ? (
            <button
              type="button"
              className={lopNutNho}
              onClick={() => setHop("sua")}
            >
              Sửa
            </button>
          ) : null}
        </div>
      ) : null}
      <HopDoiTuong
        mo={hop !== null}
        cu={hop === "sua" ? dangChon : undefined}
        macDinh={
          macDinh ?? {
            ...(loc?.l?.[0] ? { l: loc.l[0] } : {}),
            ...(loc?.g?.[0] ? { g: loc.g[0] } : {}),
          }
        }
        onDong={() => setHop(null)}
        onXong={(c) => {
          setHop(null);
          onChon(c);
        }}
      />
    </div>
  );
}

/** Hộp thêm / sửa đối tượng. */
export function HopDoiTuong({
  mo,
  cu,
  macDinh,
  onDong,
  onXong,
}: {
  mo: boolean;
  cu?: DoiTuong | undefined;
  macDinh?: { l?: LoaiDt | undefined; g?: string | undefined } | undefined;
  onDong: () => void;
  onXong: (c: string) => void;
}) {
  return (
    <Hop
      mo={mo}
      tieuDe={
        cu ? `Sửa ${cu.so ? `${cu.so} · ` : ""}${cu.n}` : "Thêm đối tượng"
      }
      onDong={onDong}
    >
      <NoiDungDoiTuong
        key={cu?._id ?? "moi"}
        cu={cu}
        macDinh={macDinh}
        onXong={onXong}
      />
    </Hop>
  );
}

function NoiDungDoiTuong({
  cu,
  macDinh,
  onXong,
}: {
  cu?: DoiTuong | undefined;
  macDinh?: { l?: LoaiDt | undefined; g?: string | undefined } | undefined;
  onXong: (c: string) => void;
}) {
  const { du } = useSo();
  const [f, setF] = useState({
    n: cu?.n ?? "",
    l: (cu?.l ?? macDinh?.l ?? "Cơ sở gia công") as LoaiDt,
    g: cu?.g ?? macDinh?.g ?? "",
    p: cu?.p ?? "",
    cccd: cu?.cccd ?? "",
    note: cu?.note ?? "",
    m: (cu?.m ?? 0) as 0 | 1,
    luu: Boolean(cu?.luu),
  });
  const lenh = useLenh(cu ? "suaDoiTuong" : "taoDoiTuong");
  const ds = du.doituong ?? [];

  const soDuKien = cu
    ? soSauKhiSua(cu, f, ds)
    : (() => {
        const nhom = soLoai({ ...f, luu: false });
        return nhom ? soMoi(nhom, ds) : undefined;
      })();

  const luu = async () => {
    const duLieu = cu
      ? { c: cu._id, ...f }
      : { n: f.n, l: f.l, g: f.g, p: f.p, cccd: f.cccd, note: f.note, m: f.m };
    const ok = await lenh.chay(duLieu, cu ? "Đã lưu." : "Đã thêm.");
    if (ok) onXong(cu?._id ?? slug(f.n));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void luu();
      }}
    >
      <Luoi cot={2}>
        <O nhan="Họ tên / tên cơ sở (ghi đủ họ tên)" rong>
          <input
            className={lopO}
            value={f.n}
            onChange={(e) => setF({ ...f, n: e.target.value })}
            required
          />
        </O>
        <O nhan="Loại">
          <select
            className={lopO}
            value={f.l}
            onChange={(e) => setF({ ...f, l: e.target.value as LoaiDt })}
          >
            {LOAI_DT.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </O>
        <O nhan="Nhóm / khâu">
          <input
            className={lopO}
            list="so-tay-nhom-dt"
            value={f.g}
            onChange={(e) => setF({ ...f, g: e.target.value })}
          />
          <datalist id="so-tay-nhom-dt">
            {NHOM_DT_GOI_Y.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </O>
        <O nhan="Điện thoại">
          <input
            className={lopO}
            value={f.p}
            onChange={(e) => setF({ ...f, p: e.target.value })}
          />
        </O>
        <O nhan="Số CCCD">
          <input
            className={lopO}
            value={f.cccd}
            onChange={(e) => setF({ ...f, cccd: e.target.value })}
          />
        </O>
        <O nhan="Ghi chú" rong>
          <input
            className={lopO}
            value={f.note}
            onChange={(e) => setF({ ...f, note: e.target.value })}
          />
        </O>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={f.m === 1}
            onChange={(e) => setF({ ...f, m: e.target.checked ? 1 : 0 })}
          />
          Cơ sở chính
        </label>
        {cu ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.luu}
              onChange={(e) => setF({ ...f, luu: e.target.checked })}
            />
            Lưu đối chiếu (Axx)
          </label>
        ) : null}
      </Luoi>
      <p className="mt-3 text-sm text-[#6E6563]">
        {cu
          ? cu.so && soDuKien && cu.so !== soDuKien
            ? `Đổi nhóm: số ${cu.so} sẽ thành ${soDuKien}`
            : f.luu
              ? "Vào kho lưu đối chiếu Axx: không có số, giữ nguyên công nợ cũ."
              : `Số định danh: ${soDuKien ?? "(không cấp số)"}`
          : `Số định danh sẽ cấp: ${soDuKien ?? "(không cấp số)"}`}
      </p>
      <ThongBao tb={lenh.tb} />
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          className={lopNut}
          disabled={lenh.dangGui || !f.n.trim()}
        >
          {lenh.xacNhan ? "Lưu lần nữa" : "Lưu"}
        </button>
      </div>
    </form>
  );
}
