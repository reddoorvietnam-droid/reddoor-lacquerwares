"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { createPortal } from "react-dom";

const khongDoi = () => () => {};

import type { MaTab } from "@/domains/so-tay/hang-so";
import type { DuLieu, NguoiSoTay } from "@/domains/so-tay/kieu";
import type { ChiMuc } from "@/domains/so-tay/nghiep-vu/chi-muc";
import { fm, fq } from "@/domains/so-tay/tien-ich";

import type { KetQuaLenh } from "./api";

// ---------------------------------------------------------------- Màu, lớp

export const MAU = {
  do: "#8E2927",
  vang: "#C9A24A",
  kem: "#FAF5EC",
  vien: "#E2D6C4",
  chu: "#221C1B",
  phu: "#6E6563",
  tre: "#D0342C",
  sap: "#C97F00",
  dung: "#1F6B45",
} as const;

export const lopThe = "rounded-2xl border border-[#E2D6C4] bg-white p-4 sm:p-5";
export const lopNut =
  "inline-flex min-h-9 items-center justify-center gap-1 rounded-full bg-[#8E2927] px-4 text-sm font-semibold text-white hover:bg-[#6f1f1d] disabled:cursor-not-allowed disabled:opacity-40";
export const lopNutPhu =
  "inline-flex min-h-9 items-center justify-center gap-1 rounded-full border border-[#8E2927]/40 bg-white px-4 text-sm font-semibold text-[#8E2927] hover:bg-[#FAF5EC] disabled:cursor-not-allowed disabled:opacity-40";
export const lopNutNho =
  "inline-flex min-h-7 items-center rounded-full border border-[#E2D6C4] bg-white px-2.5 text-xs font-semibold text-[#8E2927] hover:bg-[#FAF5EC] disabled:cursor-not-allowed disabled:opacity-40";
export const lopO =
  "min-h-9 w-full rounded-lg border border-[#E2D6C4] bg-white px-2.5 text-sm text-[#221C1B] focus:border-[#C9A24A] focus:outline-none disabled:bg-[#f4f1ec] disabled:text-[#6E6563]";
export const lopNhan = "mb-1 block text-xs font-medium text-[#6E6563]";

// ---------------------------------------------------------------- Ngữ cảnh

export type GuiLenh = (lenh: string, du: unknown) => Promise<KetQuaLenh>;

export type SoTayNguCanh = {
  nguoi: NguoiSoTay;
  tab: MaTab;
  du: DuLieu;
  cm: ChiMuc;
  dangSua: boolean;
  gui: GuiLenh;
  taiLai: () => void;
  /** Chi tiết đang mở trong tab (mã đơn, mã cơ sở…). */
  chiTiet: string | null;
  moChiTiet: (id: string | null) => void;
  diTab: (tab: MaTab, chiTiet?: string | null) => void;
  /** Dòng phụ cho file xuất (bộ lọc đang chọn). */
  datBoLoc: (text: string) => void;
};

export const SoTayCtx = createContext<SoTayNguCanh | null>(null);

export function useSo(): SoTayNguCanh {
  const c = useContext(SoTayCtx);
  if (!c) throw new Error("Thiếu SoTayCtx");
  return c;
}

export type ThongBaoTT = { loai: "ok" | "loi" | "canh"; text: string } | null;

/**
 * Gọi một lệnh từ biểu mẫu: hiện kết quả ngay trên biểu mẫu; gặp cảnh báo
 * thì lần bấm sau gửi kèm `xacNhan: true`.
 */
export function useLenh(lenh: string) {
  const { gui } = useSo();
  const [tb, setTb] = useState<ThongBaoTT>(null);
  const [xacNhan, setXacNhan] = useState(false);
  const [dangGui, setDangGui] = useState(false);
  const [ketQua, setKetQua] = useState<unknown>(null);

  const chay = useCallback(
    async (du: Record<string, unknown>, okText: string): Promise<boolean> => {
      setDangGui(true);
      const r = await gui(lenh, xacNhan ? { ...du, xacNhan: true } : du);
      setDangGui(false);
      if (r.ok) {
        setKetQua(r.ketQua);
        setTb({ loai: "ok", text: okText });
        setXacNhan(false);
        return true;
      }
      if (r.canhBao) {
        setTb({ loai: "canh", text: r.message });
        setXacNhan(true);
        return false;
      }
      setTb({ loai: "loi", text: r.message });
      setXacNhan(false);
      return false;
    },
    [gui, lenh, xacNhan],
  );

  return {
    chay,
    tb,
    setTb,
    dangGui,
    xacNhan,
    ketQua,
    boXacNhan: () => setXacNhan(false),
  };
}

export function ThongBao({ tb }: { tb: ThongBaoTT }) {
  if (!tb) return null;
  const mau =
    tb.loai === "ok"
      ? "border-[#1F6B45]/30 bg-[#1F6B45]/5 text-[#1F6B45]"
      : tb.loai === "canh"
        ? "border-[#C97F00]/40 bg-[#C97F00]/10 text-[#7a4d00]"
        : "border-[#D0342C]/30 bg-[#D0342C]/5 text-[#D0342C]";
  return (
    <p
      role={tb.loai === "loi" ? "alert" : "status"}
      className={`mt-2 rounded-lg border px-3 py-2 text-sm ${mau}`}
    >
      {tb.text}
    </p>
  );
}

// ---------------------------------------------------------------- Khối

export function Muc({
  tieuDe,
  phu,
  children,
  hanhDong,
  xuat = true,
}: {
  tieuDe: string;
  phu?: ReactNode;
  children: ReactNode;
  hanhDong?: ReactNode;
  /** Có đưa vào file xuất không. */
  xuat?: boolean;
}) {
  return (
    <section
      className={`${lopThe} mb-4`}
      {...(xuat ? { "data-xuat-muc": tieuDe } : {})}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-[#8E2927]">{tieuDe}</h3>
          {phu ? <p className="text-xs text-[#6E6563]">{phu}</p> : null}
        </div>
        {hanhDong ? (
          <div className="flex flex-wrap gap-2" data-bo-xuat>
            {hanhDong}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Biểu mẫu ghi dữ liệu: khóa khi chưa bấm Chỉnh sửa. */
export function BieuMau({
  tieuDe,
  children,
  onSubmit,
  phu,
}: {
  tieuDe: string;
  children: ReactNode;
  onSubmit: () => void;
  phu?: ReactNode;
}) {
  const { dangSua } = useSo();
  return (
    <section className={`${lopThe} mb-4`}>
      <h3 className="text-base font-semibold text-[#8E2927]">{tieuDe}</h3>
      {phu ? <p className="mb-2 text-xs text-[#6E6563]">{phu}</p> : null}
      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (dangSua) onSubmit();
        }}
      >
        <fieldset disabled={!dangSua} className="contents">
          {children}
        </fieldset>
      </form>
      {!dangSua ? (
        <p className="mt-2 text-xs text-[#6E6563]">
          Bấm ✎ Chỉnh sửa để nhập liệu.
        </p>
      ) : null}
    </section>
  );
}

export function Luoi({
  children,
  cot = 4,
}: {
  children: ReactNode;
  cot?: 2 | 3 | 4 | 5 | 6;
}) {
  const lop = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
    5: "sm:grid-cols-3 lg:grid-cols-5",
    6: "sm:grid-cols-3 lg:grid-cols-6",
  }[cot];
  return <div className={`grid grid-cols-1 gap-3 ${lop}`}>{children}</div>;
}

export function O({
  nhan,
  children,
  rong,
}: {
  nhan: string;
  children: ReactNode;
  rong?: boolean;
}) {
  const id = useId();
  return (
    <div className={rong ? "sm:col-span-2" : undefined}>
      <label className={lopNhan} htmlFor={id}>
        {nhan}
      </label>
      <div id={id}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Thẻ số liệu

export function The({
  nhan,
  giaTri,
  mau,
  phu,
  onClick,
}: {
  nhan: string;
  giaTri: string;
  mau?: "do" | "vang" | "xanh" | undefined;
  phu?: string | undefined;
  onClick?: (() => void) | undefined;
}) {
  const mauChu =
    mau === "do"
      ? MAU.tre
      : mau === "vang"
        ? MAU.sap
        : mau === "xanh"
          ? MAU.dung
          : MAU.chu;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`${lopThe} text-left ${onClick ? "hover:border-[#C9A24A]" : ""}`}
      data-xuat-the
      data-nhan={nhan}
      data-gt={giaTri}
    >
      <p className="text-xs text-[#6E6563]">{nhan}</p>
      <p
        className="mt-1 text-xl font-semibold tabular-nums"
        style={{ color: mauChu }}
      >
        {giaTri}
      </p>
      {phu ? <p className="mt-0.5 text-xs text-[#6E6563]">{phu}</p> : null}
    </Tag>
  );
}

export function DaiThe({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- Nhãn

export function Nhan({
  mau,
  children,
}: {
  mau: "do" | "vang" | "xanh" | "xam" | "tim" | "nau";
  children: ReactNode;
}) {
  const lop = {
    do: "bg-[#D0342C]/10 text-[#D0342C] border-[#D0342C]/30",
    vang: "bg-[#C97F00]/10 text-[#8a5800] border-[#C97F00]/30",
    xanh: "bg-[#1F6B45]/10 text-[#1F6B45] border-[#1F6B45]/30",
    xam: "bg-[#6E6563]/10 text-[#6E6563] border-[#6E6563]/25",
    tim: "bg-[#7b4bb3]/10 text-[#7b4bb3] border-[#7b4bb3]/30",
    nau: "bg-[#8a5a2b]/10 text-[#8a5a2b] border-[#8a5a2b]/30",
  }[mau];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${lop}`}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- Bảng

export type Cot<T> = {
  ten: string;
  o: (r: T) => ReactNode;
  /** Giá trị số (căn phải, xuất Excel dạng số). */
  so?: (r: T) => number | null | undefined;
  /** Cột nút bấm: không xuất. */
  boXuat?: boolean;
  lop?: string;
};

export function Bang<T>({
  cot,
  dong,
  khoa,
  rong = "Chưa có dữ liệu.",
  tong,
  onDong,
  dongLop,
  toiDa,
}: {
  cot: Cot<T>[];
  dong: readonly T[];
  khoa: (r: T, i: number) => string;
  rong?: string;
  /** Dòng "Cộng / Tổng": giá trị theo từng cột (cùng thứ tự). */
  tong?: Array<{ text?: string; so?: number } | null>;
  onDong?: (r: T) => void;
  dongLop?: (r: T) => string;
  toiDa?: number;
}) {
  const hien = toiDa ? dong.slice(0, toiDa) : dong;
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table
        className="w-full min-w-max border-collapse text-sm"
        data-xuat-bang
      >
        <thead>
          <tr className="border-b border-[#E2D6C4] bg-[#FAF5EC] text-left text-xs text-[#6E6563]">
            {cot.map((c) => (
              <th
                key={c.ten}
                className={`px-2.5 py-2 font-semibold ${c.so ? "text-right" : ""} ${c.lop ?? ""}`}
                {...(c.boXuat ? { "data-bo-xuat": "" } : {})}
                {...(c.so ? { "data-so-cot": "" } : {})}
              >
                {c.ten}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hien.length === 0 && rong ? (
            <tr>
              <td
                colSpan={cot.length}
                className="px-2.5 py-4 text-center text-sm text-[#6E6563]"
                data-rong
              >
                {rong}
              </td>
            </tr>
          ) : (
            hien.map((r, i) => (
              <tr
                key={khoa(r, i)}
                className={`border-b border-[#E2D6C4]/60 align-top ${onDong ? "cursor-pointer hover:bg-[#FAF5EC]" : ""} ${dongLop?.(r) ?? ""}`}
                onClick={onDong ? () => onDong(r) : undefined}
              >
                {cot.map((c) => {
                  const so = c.so?.(r);
                  return (
                    <td
                      key={c.ten}
                      className={`px-2.5 py-2 ${c.so ? "text-right tabular-nums" : ""} ${c.lop ?? ""}`}
                      {...(c.boXuat ? { "data-bo-xuat": "" } : {})}
                      {...(so !== undefined && so !== null
                        ? { "data-so": String(so) }
                        : {})}
                    >
                      {c.o(r)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
        {tong && (hien.length > 0 || !rong) ? (
          <tfoot>
            <tr
              className="border-t-2 border-[#E2D6C4] bg-[#FAF5EC] font-semibold"
              data-tong
            >
              {cot.map((c, i) => {
                const t = tong[i];
                return (
                  <td
                    key={c.ten}
                    className={`px-2.5 py-2 ${c.so ? "text-right tabular-nums" : ""}`}
                    {...(c.boXuat ? { "data-bo-xuat": "" } : {})}
                    {...(t?.so !== undefined
                      ? { "data-so": String(t.so) }
                      : {})}
                  >
                    {t?.text ?? (t?.so !== undefined ? fm(t.so) : "")}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        ) : null}
      </table>
      {toiDa && dong.length > toiDa ? (
        <p className="mt-2 text-xs text-[#6E6563]">
          Đang hiện {toiDa}/{dong.length} dòng. Dùng ô tìm để lọc.
        </p>
      ) : null}
    </div>
  );
}

export const tien = (n: number | undefined | null) => fm(n ?? 0);
export const sl = (n: number | undefined | null) => fq(n ?? 0);

// ---------------------------------------------------------------- Hộp thoại

export function Hop({
  mo,
  tieuDe,
  onDong,
  children,
  rong = "max-w-lg",
}: {
  mo: boolean;
  tieuDe: string;
  onDong: () => void;
  children: ReactNode;
  rong?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Chỉ gắn hộp vào document.body khi đã ở trình duyệt.
  const gan = useSyncExternalStore(
    khongDoi,
    () => true,
    () => false,
  );
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (mo && !d.open) d.showModal();
    if (!mo && d.open) d.close();
  }, [mo, gan]);
  if (!gan) return null;
  return createPortal(
    <dialog
      ref={ref}
      onClose={onDong}
      onCancel={onDong}
      // Biểu mẫu trong hộp không được gửi lan ra biểu mẫu bên ngoài.
      onSubmit={(e) => e.stopPropagation()}
      className={`m-auto w-[calc(100%-2rem)] ${rong} rounded-2xl border border-[#E2D6C4] p-0 text-[#221C1B] backdrop:bg-black/40`}
    >
      {mo ? (
        <div className="max-h-[85vh] overflow-y-auto p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#8E2927]">{tieuDe}</h2>
            <button
              type="button"
              className={lopNutNho}
              onClick={onDong}
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>,
    document.body,
  );
}

/** Nút ghi dữ liệu nhanh trong bảng (khóa khi chưa Chỉnh sửa). */
export function NutGhi({
  children,
  onClick,
  nguyHiem,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  nguyHiem?: boolean;
  title?: string;
}) {
  const { dangSua } = useSo();
  return (
    <button
      type="button"
      disabled={!dangSua}
      title={dangSua ? title : "Bấm ✎ Chỉnh sửa trước"}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`${lopNutNho} ${nguyHiem ? "text-[#D0342C]" : ""}`}
    >
      {children}
    </button>
  );
}

/** Ô nhập số kiểu Việt Nam (gõ 1.234.567 hoặc 1234567). */
export function OSo({
  giaTri,
  onDoi,
  tienTe,
  placeholder,
  thapPhan,
}: {
  giaTri: number | undefined;
  onDoi: (v: number | undefined) => void;
  tienTe?: boolean;
  placeholder?: string;
  thapPhan?: boolean;
}) {
  const [text, setText] = useState(
    giaTri === undefined
      ? ""
      : tienTe
        ? fm(giaTri)
        : String(giaTri).replace(".", ","),
  );
  const cuoi = useRef(giaTri);
  useEffect(() => {
    if (giaTri !== cuoi.current) {
      cuoi.current = giaTri;
      setText(
        giaTri === undefined
          ? ""
          : tienTe
            ? fm(giaTri)
            : String(giaTri).replace(".", ","),
      );
    }
  }, [giaTri, tienTe]);
  return (
    <input
      inputMode={thapPhan ? "decimal" : "numeric"}
      className={`${lopO} text-right tabular-nums`}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const s = tienTe
          ? t.replace(/[.\s]/g, "")
          : t.includes(",")
            ? t.replace(/\./g, "").replace(",", ".")
            : t.replace(/\s/g, "");
        const n = s.trim() === "" ? undefined : Number(s);
        const v = n === undefined || Number.isNaN(n) ? undefined : n;
        cuoi.current = v;
        onDoi(v);
      }}
      onBlur={() => {
        if (tienTe && cuoi.current !== undefined) setText(fm(cuoi.current));
      }}
    />
  );
}
