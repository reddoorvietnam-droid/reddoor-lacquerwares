"use client";

import { useEffect } from "react";

import type { MucDo, TienDoDon } from "@/domains/so-tay/nghiep-vu/tien-do";

import { Nhan, useSo } from "../ui";

/** Ghi dòng phụ "bộ lọc đang chọn" cho file xuất. */
export function useBoLoc(text: string) {
  const { datBoLoc } = useSo();
  useEffect(() => datBoLoc(text), [datBoLoc, text]);
}

export function NhanMuc({ muc }: { muc: MucDo | TienDoDon["muc"] }) {
  switch (muc) {
    case "do":
      return <Nhan mau="do">Đỏ</Nhan>;
    case "vang":
      return <Nhan mau="vang">Vàng</Nhan>;
    case "xanh":
      return <Nhan mau="xanh">Đúng tiến độ</Nhan>;
    case "xong":
      return <Nhan mau="xanh">Xong</Nhan>;
    case "giao":
      return <Nhan mau="xanh">Đã giao hàng</Nhan>;
    case "cho":
      return <Nhan mau="xam">Chờ xưởng nhận</Nhan>;
  }
}

/** Ô tìm kiếm nhỏ dùng ở nhiều tab. */
export function OTim({
  giaTri,
  onDoi,
  goiY = "Tìm…",
}: {
  giaTri: string;
  onDoi: (v: string) => void;
  goiY?: string;
}) {
  return (
    <input
      type="search"
      className="min-h-9 w-full max-w-xs rounded-lg border border-[#E2D6C4] bg-white px-2.5 text-sm focus:border-[#C9A24A] focus:outline-none"
      placeholder={goiY}
      value={giaTri}
      onChange={(e) => onDoi(e.target.value)}
    />
  );
}

export const khop = (q: string, ...vals: Array<string | undefined>) => {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return vals.some((v) => (v ?? "").toLowerCase().includes(s));
};
