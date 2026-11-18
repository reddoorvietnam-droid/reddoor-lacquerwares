"use client";

import { useMemo, useState } from "react";

import { LOAI } from "@/domains/so-tay/hang-so";
import type { DonHang, PhieuKho } from "@/domains/so-tay/kieu";
import { tenDt, tong } from "@/domains/so-tay/nghiep-vu/chi-muc";
import {
  congNoTheoCap,
  giaTriPhieu,
  tamTinhTheoDon,
  type DongCongNo,
} from "@/domains/so-tay/nghiep-vu/cong-no";
import { dvn } from "@/domains/so-tay/tien-ich";

import { Bang, DaiThe, lopNutNho, Muc, The, tien, useSo } from "../ui";
import { khop, OTim, useBoLoc } from "./chung";

const HUONG = new Map<string, number>(LOAI.map((l) => [l.ten, l.h]));

export function TabDonHang() {
  const { chiTiet } = useSo();
  return chiTiet ? <ChiTietDonHang dh={chiTiet} /> : <DanhSachDonHang />;
}

function useSoLieuDon() {
  const { cm } = useSo();
  return useMemo(() => {
    const cap = congNoTheoCap(cm);
    const theoDon = new Map<
      string,
      { hd: number; daTra: number; conNo: number }
    >();
    for (const c of cap) {
      const x = theoDon.get(c.dh) ?? { hd: 0, daTra: 0, conNo: 0 };
      x.hd += c.hd;
      x.daTra += c.daTra + c.vtCap;
      x.conNo += c.conNo;
      theoDon.set(c.dh, x);
    }
    const giaVon = new Map<string, number>();
    for (const p of cm.pk) {
      if (!p.dh || (HUONG.get(p.loai) ?? 0) >= 0) continue;
      const v = tong(
        p.dong.map((d) => (d.sl ?? 0) * (cm.vt.get(d.vt)?.gv ?? 0)),
      );
      giaVon.set(p.dh, (giaVon.get(p.dh) ?? 0) + v);
    }
    return { cap, theoDon, giaVon, tamTinh: tamTinhTheoDon(cm) };
  }, [cm]);
}

function DanhSachDonHang() {
  const { du, moChiTiet } = useSo();
  const { theoDon, giaVon } = useSoLieuDon();
  const [tim, setTim] = useState("");
  useBoLoc(tim ? `Tìm: ${tim}` : "");
  const ds = [...(du.donhang ?? [])]
    .filter((d) => khop(tim, d._id, d.k, d.n))
    .sort((a, b) => b._id.localeCompare(a._id));
  return (
    <Muc
      tieuDe="Đơn hàng"
      phu="Bấm một đơn để xem công nợ theo cơ sở và phiếu kho."
      hanhDong={
        <OTim giaTri={tim} onDoi={setTim} goiY="Mã đơn, khách, tên đơn" />
      }
    >
      <Bang
        cot={[
          { ten: "Mã đơn", o: (d: DonHang) => <b>{d._id}</b> },
          { ten: "Khách", o: (d) => d.k ?? "" },
          { ten: "Tên đơn", o: (d) => d.n ?? "" },
          {
            ten: "Tổng giá trị HĐ cơ sở",
            o: (d) => tien(theoDon.get(d._id)?.hd),
            so: (d) => theoDon.get(d._id)?.hd ?? 0,
          },
          {
            ten: "Đã trả",
            o: (d) => tien(theoDon.get(d._id)?.daTra),
            so: (d) => theoDon.get(d._id)?.daTra ?? 0,
          },
          {
            ten: "Còn nợ",
            o: (d) => tien(theoDon.get(d._id)?.conNo),
            so: (d) => theoDon.get(d._id)?.conNo ?? 0,
          },
          {
            ten: "Giá vốn vật tư đã xuất",
            o: (d) => tien(giaVon.get(d._id)),
            so: (d) => giaVon.get(d._id) ?? 0,
          },
        ]}
        dong={ds}
        khoa={(d) => d._id}
        onDong={(d) => moChiTiet(d._id)}
        tong={[
          { text: "Tổng" },
          null,
          null,
          { so: tong(ds.map((d) => theoDon.get(d._id)?.hd ?? 0)) },
          { so: tong(ds.map((d) => theoDon.get(d._id)?.daTra ?? 0)) },
          { so: tong(ds.map((d) => theoDon.get(d._id)?.conNo ?? 0)) },
          { so: tong(ds.map((d) => giaVon.get(d._id) ?? 0)) },
        ]}
      />
    </Muc>
  );
}

function ChiTietDonHang({ dh }: { dh: string }) {
  const { cm, moChiTiet, diTab } = useSo();
  const { cap, theoDon, giaVon, tamTinh } = useSoLieuDon();
  useBoLoc(`Đơn ${dh}`);
  const d = cm.don.get(dh);
  const capDon = cap.filter((c) => c.dh === dh);
  const phieu = cm.pk
    .filter((p) => p.dh === dh)
    .sort((a, b) => b.ngay.localeCompare(a.ngay));
  const t = theoDon.get(dh);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={lopNutNho}
          onClick={() => moChiTiet(null)}
        >
          ← Tất cả đơn
        </button>
        {cm.sx.has(dh) ? (
          <button
            type="button"
            className={lopNutNho}
            onClick={() => diTab("sanxuat", dh)}
          >
            Mở ở tab Sản xuất →
          </button>
        ) : null}
      </div>
      <h2 className="mb-3 text-xl font-semibold text-[#8E2927]">
        {dh} · {d?.n ?? ""} · {d?.k ?? ""}
      </h2>
      <DaiThe>
        <The nhan="Tổng giá trị HĐ cơ sở" giaTri={`${tien(t?.hd)} đ`} />
        <The nhan="Đã trả" giaTri={`${tien(t?.daTra)} đ`} />
        <The
          nhan="Còn nợ"
          giaTri={`${tien(t?.conNo)} đ`}
          mau={(t?.conNo ?? 0) > 0 ? "do" : undefined}
        />
        <The
          nhan="Giá vốn vật tư đã xuất"
          giaTri={`${tien(giaVon.get(dh))} đ`}
        />
        {tamTinh.get(dh) ? (
          <The
            nhan="Giá trị tạm tính (không cộng công nợ)"
            giaTri={`${tien(tamTinh.get(dh))} đ`}
          />
        ) : null}
      </DaiThe>
      <Muc tieuDe="Công nợ theo cơ sở">
        <Bang
          cot={[
            { ten: "Cơ sở", o: (c: DongCongNo) => tenDt(cm, c.dt) },
            { ten: "Khoản chi phí", o: (c) => c.cp.join(", ") },
            { ten: "Hợp đồng", o: (c) => tien(c.hd), so: (c) => c.hd },
            { ten: "Đã trả", o: (c) => tien(c.daTra), so: (c) => c.daTra },
            {
              ten: "Vật tư xưởng cấp",
              o: (c) => tien(c.vtCap),
              so: (c) => c.vtCap,
            },
            {
              ten: "Còn nợ",
              o: (c) => <b>{tien(c.conNo)}</b>,
              so: (c) => c.conNo,
            },
          ]}
          dong={capDon}
          khoa={(c) => c.dt}
          onDong={(c) => diTab("coso", c.dt)}
          tong={[
            { text: "Tổng" },
            null,
            { so: tong(capDon.map((c) => c.hd)) },
            { so: tong(capDon.map((c) => c.daTra)) },
            { so: tong(capDon.map((c) => c.vtCap)) },
            { so: tong(capDon.map((c) => c.conNo)) },
          ]}
        />
      </Muc>
      <Muc tieuDe="Phiếu kho của đơn">
        <Bang
          cot={[
            { ten: "Số phiếu", o: (p: PhieuKho) => p.so },
            { ten: "Ngày", o: (p) => dvn(p.ngay) },
            { ten: "Loại", o: (p) => p.loai },
            { ten: "Đối tượng", o: (p) => tenDt(cm, p.dt) },
            { ten: "Số dòng", o: (p) => String(p.dong.length) },
            {
              ten: "Giá trị",
              o: (p) => tien(giaTriPhieu(p.dong)),
              so: (p) => giaTriPhieu(p.dong),
            },
          ]}
          dong={phieu}
          khoa={(p) => p._id}
          rong="Chưa có phiếu kho nào cho đơn này."
        />
      </Muc>
    </div>
  );
}
