"use client";

import { useMemo, useState } from "react";

import type {
  DeNghiChi,
  DoiTuong,
  GiaoHang,
  PhanCong,
} from "@/domains/so-tay/kieu";
import { daNhan, tenDt, tong } from "@/domains/so-tay/nghiep-vu/chi-muc";
import {
  congNoTheoCap,
  soChiTietPhaiTra,
  soNoSon,
  tongTheoCoSo,
  type DongCongNo,
  type DongSo,
} from "@/domains/so-tay/nghiep-vu/cong-no";
import { soSanhSo } from "@/domains/so-tay/nghiep-vu/danh-muc";
import { sxCalc, type HopDongTinh } from "@/domains/so-tay/nghiep-vu/hop-dong";
import { mocDon } from "@/domains/so-tay/nghiep-vu/tien-do";
import { dvn, fq, slug } from "@/domains/so-tay/tien-ich";

import { HopDoiTuong } from "../dt-select";
import { hopDongExcel, hopDongPdf } from "../hop-dong-file";
import { Bang, DaiThe, lopNutNho, Muc, Nhan, The, tien, useSo } from "../ui";
import { khop, OTim, useBoLoc } from "./chung";

export const AXX = "Axx";

type DongCs = {
  d: DoiTuong;
  donDangLam: number;
  slDangLam: number;
  hd: number;
  conNo: number;
  noSon: number;
};

function useSoLieuCoSo() {
  const { cm } = useSo();
  return useMemo(() => {
    const tongCs = tongTheoCoSo(cm);
    const pcTheoDt = new Map<string, PhanCong[]>();
    for (const ds of cm.pcTheoDon.values())
      for (const p of ds) {
        for (const k of new Set(
          [p.dt, p.tru].filter((x): x is string => Boolean(x)),
        )) {
          pcTheoDt.set(k, [...(pcTheoDt.get(k) ?? []), p]);
        }
      }
    const dong = (d: DoiTuong): DongCs => {
      const ps = (pcTheoDt.get(d._id) ?? []).filter(
        (p) => p.dt === d._id && !cm.sx.get(p.dh)?.giao?.ngay,
      );
      const t = tongCs.get(d._id);
      return {
        d,
        donDangLam: new Set(ps.map((p) => p.dh)).size,
        slDangLam: tong(
          ps.map((p) => Math.max(0, (p.sl ?? 0) - daNhan(cm, p._id))),
        ),
        hd: t?.hd ?? 0,
        conNo: t?.conNo ?? 0,
        noSon: t?.noSon ?? 0,
      };
    };
    return { tongCs, pcTheoDt, dong };
  }, [cm]);
}

export function TabCoSo() {
  const { chiTiet } = useSo();
  if (chiTiet === AXX) return <KhoAxx />;
  if (chiTiet) return <ChiTietCoSo dt={chiTiet} />;
  return <DanhSachCoSo />;
}

function DanhSachCoSo() {
  const { du, moChiTiet } = useSo();
  const { dong, tongCs } = useSoLieuCoSo();
  const [tim, setTim] = useState("");
  useBoLoc(tim ? `Tìm: ${tim}` : "");

  const ds = useMemo(() => {
    const coSo = (du.doituong ?? []).filter(
      (d) =>
        !d.luu &&
        (d.so ||
          (tongCs.get(d._id)?.hd ?? 0) !== 0 ||
          (tongCs.get(d._id)?.noSon ?? 0) !== 0),
    );
    return coSo.sort(soSanhSo).map(dong);
  }, [du.doituong, dong, tongCs]);
  const axx = (du.doituong ?? []).filter((d) => d.luu);
  const loc = ds.filter((r) =>
    khop(tim, r.d.so, r.d.n, slug(r.d.n).replace(/_/g, " ")),
  );
  const tongAxx = axx.reduce(
    (s, d) => ({
      conNo: s.conNo + (tongCs.get(d._id)?.conNo ?? 0),
      noSon: s.noSon + (tongCs.get(d._id)?.noSon ?? 0),
      hd: s.hd + (tongCs.get(d._id)?.hd ?? 0),
    }),
    { conNo: 0, noSon: 0, hd: 0 },
  );
  const hienAxx = !tim || khop(tim, "axx", "kho lưu đối chiếu");

  return (
    <Muc
      tieuDe="Cơ sở sản xuất"
      phu="Gõ số A01, B05… hoặc tên; gõ Axx để mở kho lưu đối chiếu."
      hanhDong={
        <OTim
          giaTri={tim}
          onDoi={(v) =>
            v.trim().toLowerCase() === "axx" ? moChiTiet(AXX) : setTim(v)
          }
          goiY="Số A01… hoặc tên"
        />
      }
    >
      <Bang
        cot={[
          { ten: "Số", o: (r: DongCs | null) => (r ? (r.d.so ?? "") : "Axx") },
          {
            ten: "Cơ sở",
            o: (r) =>
              r ? r.d.n : `Kho lưu đối chiếu (${axx.length} cơ sở cũ)`,
          },
          { ten: "Nhóm", o: (r) => (r ? (r.d.g ?? "") : "Lưu trữ") },
          {
            ten: "Đơn đang làm",
            o: (r) => (r ? String(r.donDangLam || "") : ""),
            so: (r) => r?.donDangLam ?? null,
          },
          {
            ten: "SL đang làm",
            o: (r) => (r?.slDangLam ? fq(r.slDangLam) : ""),
            so: (r) => r?.slDangLam ?? null,
          },
          {
            ten: "Giá trị HĐ",
            o: (r) => tien(r ? r.hd : tongAxx.hd),
            so: (r) => (r ? r.hd : tongAxx.hd),
          },
          {
            ten: "RD còn nợ",
            o: (r) => tien(r ? r.conNo : tongAxx.conNo),
            so: (r) => (r ? r.conNo : tongAxx.conNo),
          },
          {
            ten: "Nợ RD tiền sơn",
            o: (r) => tien(r ? r.noSon : tongAxx.noSon),
            so: (r) => (r ? r.noSon : tongAxx.noSon),
          },
        ]}
        dong={[...loc, ...(hienAxx && axx.length ? [null] : [])]}
        khoa={(r) => r?.d._id ?? AXX}
        onDong={(r) => moChiTiet(r ? r.d._id : AXX)}
        tong={[
          { text: "Tổng" },
          null,
          null,
          null,
          null,
          { so: tong(loc.map((r) => r.hd)) + (hienAxx ? tongAxx.hd : 0) },
          { so: tong(loc.map((r) => r.conNo)) + (hienAxx ? tongAxx.conNo : 0) },
          { so: tong(loc.map((r) => r.noSon)) + (hienAxx ? tongAxx.noSon : 0) },
        ]}
      />
    </Muc>
  );
}

function KhoAxx() {
  const { du, cm, moChiTiet } = useSo();
  const { tongCs } = useSoLieuCoSo();
  useBoLoc("Kho lưu đối chiếu Axx");
  const axx = (du.doituong ?? [])
    .filter((d) => d.luu)
    .sort((a, b) => a.n.localeCompare(b.n, "vi"));
  const ids = new Set(axx.map((d) => d._id));
  const cap = congNoTheoCap(cm).filter(
    (c) => ids.has(c.dt) && Math.abs(c.conNo) >= 1,
  );
  return (
    <div>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          className={lopNutNho}
          onClick={() => moChiTiet(null)}
        >
          ← Tất cả cơ sở
        </button>
      </div>
      <h2 className="mb-3 text-xl font-semibold text-[#8E2927]">
        Axx · Kho lưu đối chiếu
      </h2>
      <DaiThe>
        <The nhan="Số cơ sở trong kho" giaTri={String(axx.length)} />
        <The
          nhan="Tổng RD còn nợ"
          giaTri={`${tien(tong(axx.map((d) => tongCs.get(d._id)?.conNo ?? 0)))} đ`}
        />
        <The
          nhan="Nợ tiền sơn"
          giaTri={`${tien(tong(axx.map((d) => tongCs.get(d._id)?.noSon ?? 0)))} đ`}
        />
      </DaiThe>
      <Muc tieuDe="Cơ sở trong kho">
        <Bang
          cot={[
            { ten: "Cơ sở", o: (d: DoiTuong) => d.n },
            {
              ten: "Loại · nhóm",
              o: (d) => [d.l, d.g].filter(Boolean).join(" · "),
            },
            {
              ten: "RD còn nợ",
              o: (d) => tien(tongCs.get(d._id)?.conNo),
              so: (d) => tongCs.get(d._id)?.conNo ?? 0,
            },
            {
              ten: "Nợ tiền sơn",
              o: (d) => tien(tongCs.get(d._id)?.noSon),
              so: (d) => tongCs.get(d._id)?.noSon ?? 0,
            },
            { ten: "Ghi chú", o: (d) => d.note ?? "" },
          ]}
          dong={axx}
          khoa={(d) => d._id}
          onDong={(d) => moChiTiet(d._id)}
        />
      </Muc>
      <Muc tieuDe="Công nợ còn lại theo đơn">
        <Bang
          cot={[
            { ten: "Đơn", o: (c: DongCongNo) => c.dh },
            { ten: "Cơ sở", o: (c) => tenDt(cm, c.dt) },
            { ten: "Hợp đồng", o: (c) => tien(c.hd), so: (c) => c.hd },
            { ten: "Đã trả", o: (c) => tien(c.daTra), so: (c) => c.daTra },
            { ten: "Còn nợ", o: (c) => tien(c.conNo), so: (c) => c.conNo },
          ]}
          dong={cap}
          khoa={(c) => `${c.dh}~${c.dt}`}
          tong={[
            { text: "Tổng" },
            null,
            null,
            null,
            { so: tong(cap.map((c) => c.conNo)) },
          ]}
        />
      </Muc>
    </div>
  );
}

const ngayHoacTrong = (n: string) => (n ? dvn(n) : "(không ghi ngày)");

function BangSo({ ds, tieuDe }: { ds: DongSo[]; tieuDe: string }) {
  return (
    <Muc tieuDe={tieuDe}>
      <Bang
        cot={[
          { ten: "Ngày", o: (r: DongSo) => ngayHoacTrong(r.ngay) },
          { ten: "Nghiệp vụ", o: (r) => r.nv },
          { ten: "Đơn", o: (r) => r.dh },
          {
            ten: "Tăng",
            o: (r) => (r.tang ? tien(r.tang) : ""),
            so: (r) => r.tang || null,
          },
          {
            ten: "Giảm",
            o: (r) => (r.giam ? tien(r.giam) : ""),
            so: (r) => r.giam || null,
          },
          { ten: "Còn", o: (r) => tien(r.con), so: (r) => r.con },
          {
            ten: "Nội dung",
            o: (r) => <span className="text-xs">{r.nd}</span>,
          },
        ]}
        dong={ds}
        khoa={(_, i) => String(i)}
      />
    </Muc>
  );
}

function ChiTietCoSo({ dt }: { dt: string }) {
  const { cm, du, moChiTiet, dangSua } = useSo();
  const { dong, pcTheoDt, tongCs } = useSoLieuCoSo();
  const [sua, setSua] = useState(false);
  const d = cm.dt.get(dt);
  useBoLoc(d ? `Cơ sở ${d.so ?? ""} ${d.n}` : dt);
  if (!d) return <p className="text-sm">Không tìm thấy cơ sở {dt}.</p>;
  const r = dong(d);
  const t = tongCs.get(dt);
  const pcs = pcTheoDt.get(dt) ?? [];
  const dons = [...new Set(pcs.map((p) => p.dh))].sort().reverse();
  const hds: HopDongTinh[] = dons
    .map((dh) => sxCalc(cm, dh, dt))
    .filter((h) => h.pcs.length || h.daKy);
  const theoKhau = dons.flatMap((dh) =>
    [
      ...new Set(
        pcs.filter((p) => p.dh === dh && p.dt === dt).map((p) => p.khau),
      ),
    ].map((khau) => ({
      dh,
      khau,
      ps: pcs.filter((p) => p.dh === dh && p.dt === dt && p.khau === khau),
    })),
  );
  const dns = (du.denghichi ?? [])
    .filter((x) => x.dt === dt)
    .sort((a, b) => b.ngay.localeCompare(a.ngay));
  const ghs = pcs
    .filter((p) => p.dt === dt)
    .flatMap((p) => (cm.ghTheoPc.get(p._id) ?? []).map((g) => ({ g, p })))
    .sort((a, b) => b.g.ngay.localeCompare(a.g.ngay));

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={lopNutNho}
          onClick={() => moChiTiet(null)}
        >
          ← Tất cả cơ sở
        </button>
        {d.luu ? (
          <button
            type="button"
            className={lopNutNho}
            onClick={() => moChiTiet(AXX)}
          >
            ← Kho Axx
          </button>
        ) : null}
        {dangSua ? (
          <button
            type="button"
            className={lopNutNho}
            onClick={() => setSua(true)}
          >
            Sửa thông tin cơ sở
          </button>
        ) : null}
      </div>
      <h2 className="text-xl font-semibold text-[#8E2927]">
        {d.so ?? (d.luu ? "Axx" : "")} · {d.n}
      </h2>
      <p className="mb-3 text-sm text-[#6E6563]">
        {[
          d.l,
          d.g,
          d.p ? `ĐT ${d.p}` : "",
          d.cccd ? `CCCD ${d.cccd}` : "",
          d.note,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <DaiThe>
        <The nhan="Đơn đang làm" giaTri={String(r.donDangLam)} />
        <The nhan="SL đang làm" giaTri={fq(r.slDangLam)} />
        <The nhan="Giá trị hợp đồng" giaTri={`${tien(t?.hd)} đ`} />
        <The nhan="Đã ứng + thanh toán" giaTri={`${tien(t?.daTra)} đ`} />
        <The
          nhan="RD còn nợ cơ sở"
          giaTri={`${tien(t?.conNo)} đ`}
          mau={(t?.conNo ?? 0) > 0 ? "do" : undefined}
        />
        <The nhan="Cơ sở nợ RD tiền sơn, gỗ" giaTri={`${tien(t?.noSon)} đ`} />
      </DaiThe>

      <Muc tieuDe="Đơn hàng và tiến độ">
        <Bang
          cot={[
            { ten: "Đơn", o: (x: (typeof theoKhau)[number]) => x.dh },
            { ten: "Khâu", o: (x) => x.khau },
            {
              ten: "Đã giao / SL",
              o: (x) =>
                `${fq(tong(x.ps.map((p) => daNhan(cm, p._id))))} / ${fq(tong(x.ps.map((p) => p.sl ?? 0)))}`,
            },
            {
              ten: "Giá trị HĐ",
              o: (x) => tien(tong(x.ps.map((p) => (p.sl ?? 0) * (p.dg ?? 0)))),
              so: (x) => tong(x.ps.map((p) => (p.sl ?? 0) * (p.dg ?? 0))),
            },
            {
              ten: "Nhận đơn",
              o: (x) =>
                dvn(
                  cm.hd.get(`${x.dh}~${dt}`)?.ngay ??
                    x.ps.map((p) => p.at ?? "").sort()[0],
                ),
            },
            ...(["m2", "m4", "m5"] as const).map((k, i) => ({
              ten: ["Đem in", "Kiểm hàng", "Giao tại kho"][i] as string,
              o: (x: (typeof theoKhau)[number]) => {
                const sx = cm.sx.get(x.dh);
                if (!sx || sx.tt !== "nhan") return "";
                const m = mocDon(cm, sx).moc.find((y) => y.ma === k);
                if (!m) return "";
                return (
                  <span className="whitespace-nowrap">
                    {dvn(m.tt ?? m.han)}{" "}
                    {m.tt ? (
                      <Nhan mau="xanh">xong</Nhan>
                    ) : m.muc === "do" ? (
                      <Nhan mau="do">trễ</Nhan>
                    ) : null}
                  </span>
                );
              },
            })),
            {
              ten: "Tình trạng",
              o: (x) => {
                const xong = x.ps.every(
                  (p) => daNhan(cm, p._id) >= (p.sl ?? 0),
                );
                const tre = x.ps.some(
                  (p) =>
                    p.han && p.han < cm.hom && daNhan(cm, p._id) < (p.sl ?? 0),
                );
                return xong ? (
                  <Nhan mau="xanh">Đã giao đủ</Nhan>
                ) : tre ? (
                  <Nhan mau="do">Trễ hạn</Nhan>
                ) : (
                  <Nhan mau="xam">Đang làm</Nhan>
                );
              },
            },
            {
              ten: "Hợp đồng",
              boXuat: true,
              o: (x) => (
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={lopNutNho}
                    onClick={() => void hopDongExcel(cm, x.dh, dt)}
                  >
                    Excel
                  </button>
                  <button
                    type="button"
                    className={lopNutNho}
                    onClick={() => void hopDongPdf(cm, x.dh, dt)}
                  >
                    PDF
                  </button>
                </div>
              ),
            },
          ]}
          dong={theoKhau}
          khoa={(x) => `${x.dh}-${x.khau}`}
          rong="Cơ sở chưa nhận phần việc nào trên Sổ tay."
        />
      </Muc>

      <Muc tieuDe="Sản phẩm đang làm">
        <Bang
          cot={[
            { ten: "Đơn", o: (p: PhanCong) => p.dh },
            {
              ten: "Mã hàng",
              o: (p) => (
                <div>
                  <b>{p.ma}</b>
                  <div className="text-xs text-[#6E6563]">
                    {cm.sx.get(p.dh)?.items.find((i) => i.ma === p.ma)?.mt ??
                      ""}
                  </div>
                </div>
              ),
            },
            { ten: "Khâu", o: (p) => p.khau },
            { ten: "SL", o: (p) => fq(p.sl ?? 0), so: (p) => p.sl ?? 0 },
            {
              ten: "Đã giao",
              o: (p) => fq(daNhan(cm, p._id)),
              so: (p) => daNhan(cm, p._id),
            },
            {
              ten: "Đơn giá",
              o: (p) => tien(p.dg),
              so: (p) => (p.tru === dt ? -(p.dg ?? 0) : (p.dg ?? 0)),
            },
            { ten: "Hạn", o: (p) => dvn(p.han) },
            {
              ten: "Tình trạng",
              o: (p) =>
                daNhan(cm, p._id) >= (p.sl ?? 0) ? (
                  <Nhan mau="xanh">Đã giao đủ</Nhan>
                ) : p.han && p.han < cm.hom ? (
                  <Nhan mau="do">Trễ hạn</Nhan>
                ) : (
                  <Nhan mau="xam">Đang làm</Nhan>
                ),
            },
            {
              ten: "Ghi chú kỹ thuật",
              o: (p) => (
                <span className="text-xs whitespace-pre-wrap">
                  {cm.sx.get(p.dh)?.items.find((i) => i.ma === p.ma)?.ktsx ??
                    ""}
                </span>
              ),
            },
          ]}
          dong={pcs}
          khoa={(p) => p._id}
          rong="Không có sản phẩm nào."
        />
      </Muc>

      <Muc tieuDe="Hợp đồng">
        <Bang
          cot={[
            { ten: "Đơn", o: (h: HopDongTinh) => h.dh },
            {
              ten: "Số HĐ",
              o: (h) => h.so ?? <span className="text-[#6E6563]">chưa ký</span>,
            },
            { ten: "Ngày ký", o: (h) => dvn(h.ngayKy) },
            { ten: "Giá trị tạm tính", o: (h) => tien(h.gt), so: (h) => h.gt },
            {
              ten: "Đã ghi công nợ",
              o: (h) => tien(h.daGhi),
              so: (h) => h.daGhi,
            },
            { ten: "Đã ứng", o: (h) => tien(h.daUng), so: (h) => h.daUng },
            { ten: "Đã thanh toán", o: (h) => tien(h.daTT), so: (h) => h.daTT },
            {
              ten: "Vật tư xưởng cấp",
              o: (h) => tien(h.vtCap),
              so: (h) => h.vtCap,
            },
            {
              ten: "Còn phải trả",
              o: (h) => <b>{tien(h.conPhaiTra)}</b>,
              so: (h) => h.conPhaiTra,
            },
          ]}
          dong={hds}
          khoa={(h) => h.dh}
          rong="Chưa có hợp đồng trên Sổ tay."
        />
      </Muc>

      <Muc tieuDe="Thanh toán (đề nghị chi)">
        <Bang
          cot={[
            { ten: "Ngày đề nghị", o: (x: DeNghiChi) => dvn(x.ngay) },
            { ten: "Đơn", o: (x) => x.dh ?? "" },
            { ten: "Loại", o: (x) => x.loai },
            { ten: "Số tiền", o: (x) => tien(x.tien), so: (x) => x.tien },
            {
              ten: "Trạng thái",
              o: (x) =>
                x.tt === "dachi" ? (
                  <Nhan mau="xanh">Đã chi</Nhan>
                ) : x.tt === "tuchoi" ? (
                  <Nhan mau="do">Từ chối</Nhan>
                ) : (
                  <Nhan mau="vang">Chờ chi</Nhan>
                ),
            },
            { ten: "Ngày chi", o: (x) => dvn(x.chi?.ngay) },
            {
              ten: "Đã chi",
              o: (x) => (x.chi?.tien ? tien(x.chi.tien) : ""),
              so: (x) => x.chi?.tien ?? null,
            },
            {
              ten: "Hình thức / lý do",
              o: (x) => x.chi?.ht ?? x.tuchoi?.lydo ?? "",
            },
          ]}
          dong={dns}
          khoa={(x) => x._id}
          rong="Chưa có đề nghị chi nào."
        />
      </Muc>

      <Muc tieuDe="Công nợ theo đơn">
        <Bang
          cot={[
            { ten: "Đơn", o: (c: DongCongNo) => c.dh },
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
          dong={congNoTheoCap(cm)
            .filter((c) => c.dt === dt)
            .sort((a, b) => b.dh.localeCompare(a.dh))}
          khoa={(c) => c.dh}
          tong={[
            { text: "Tổng" },
            { so: t?.hd ?? 0 },
            { so: t?.daTra ?? 0 },
            { so: t?.vtCap ?? 0 },
            { so: t?.conNo ?? 0 },
          ]}
        />
      </Muc>

      <BangSo
        tieuDe="Sổ chi tiết RD phải trả cơ sở"
        ds={soChiTietPhaiTra(cm, dt)}
      />
      <BangSo
        tieuDe="Sổ chi tiết cơ sở nợ RD (sơn, gỗ, vật tư mua của nhà máy)"
        ds={soNoSon(cm, dt)}
      />

      <Muc tieuDe="Ngày giao hàng về nhà máy">
        <Bang
          cot={[
            {
              ten: "Ngày",
              o: (x: { g: GiaoHang; p: PhanCong }) => dvn(x.g.ngay),
            },
            { ten: "Đơn", o: (x) => x.p.dh },
            { ten: "Mã hàng", o: (x) => x.p.ma ?? "" },
            { ten: "Khâu", o: (x) => x.p.khau },
            {
              ten: "SL nhận",
              o: (x) => fq(x.g.sl ?? 0),
              so: (x) => x.g.sl ?? 0,
            },
            {
              ten: "Lỗi",
              o: (x) => (x.g.loi ? `${fq(x.g.loi)} · ${x.g.ghichu ?? ""}` : ""),
            },
          ]}
          dong={ghs}
          khoa={(x) => x.g._id}
          rong="Chưa có lần giao hàng nào."
        />
      </Muc>
      <HopDoiTuong
        mo={sua}
        cu={d}
        onDong={() => setSua(false)}
        onXong={() => setSua(false)}
      />
    </div>
  );
}
