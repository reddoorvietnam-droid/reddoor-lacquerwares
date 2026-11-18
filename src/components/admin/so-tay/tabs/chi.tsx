"use client";

import { useState } from "react";

import { coQuyen, HINH_THUC } from "@/domains/so-tay/hang-so";
import type { DeNghiChi } from "@/domains/so-tay/kieu";
import { tenDt, tong } from "@/domains/so-tay/nghiep-vu/chi-muc";
import { dvn, today } from "@/domains/so-tay/tien-ich";

import {
  Bang,
  DaiThe,
  Hop,
  lopNut,
  lopO,
  Luoi,
  Muc,
  Nhan,
  NutGhi,
  O,
  OSo,
  The,
  ThongBao,
  tien,
  useLenh,
  useSo,
} from "../ui";
import { useBoLoc } from "./chung";
import { LyDo } from "./san-xuat";

export function TabChi() {
  const { du, cm, nguoi } = useSo();
  const [hop, setHop] = useState<{
    loai: "chi" | "tuchoi";
    dn: DeNghiChi;
  } | null>(null);
  const thang = cm.hom.slice(0, 7);
  useBoLoc(`Tháng ${thang.slice(5)}/${thang.slice(0, 4)}`);
  const ds = du.denghichi ?? [];
  const cho = ds
    .filter((d) => d.tt === "cho")
    .sort((a, b) => (a.han ?? "9").localeCompare(b.han ?? "9"));
  const daXuLy = ds
    .filter((d) => d.tt !== "cho")
    .sort((a, b) =>
      (b.chi?.at ?? b.tuchoi?.at ?? "").localeCompare(
        a.chi?.at ?? a.tuchoi?.at ?? "",
      ),
    )
    .slice(0, 100);
  const theoCs = new Map<string, number>();
  for (const d of ds)
    if (d.tt === "dachi" && d.chi?.ngay?.startsWith(thang))
      theoCs.set(d.dt, (theoCs.get(d.dt) ?? 0) + (d.chi.tien ?? 0));
  const duocChi = coQuyen(nguoi.vaitro, "chi");

  return (
    <div>
      <DaiThe>
        <The
          nhan="Đề nghị chờ chi"
          giaTri={String(cho.length)}
          phu={`${tien(tong(cho.map((d) => d.tien)))} đ`}
          mau={cho.length ? "vang" : undefined}
        />
        <The
          nhan="Đã chi trong tháng"
          giaTri={`${tien(tong([...theoCs.values()]))} đ`}
        />
      </DaiThe>
      <Muc
        tieuDe="Đề nghị chờ chi"
        phu="Tiền chỉ vào công nợ khi kế toán công ty bấm Đã chi."
      >
        <Bang
          cot={[
            { ten: "Ngày", o: (d: DeNghiChi) => dvn(d.ngay) },
            { ten: "Đơn", o: (d) => d.dh ?? "" },
            { ten: "Cơ sở", o: (d) => tenDt(cm, d.dt) },
            { ten: "Loại", o: (d) => d.loai },
            {
              ten: "Số tiền",
              o: (d) => <b>{tien(d.tien)}</b>,
              so: (d) => d.tien,
            },
            {
              ten: "Hạn",
              o: (d) =>
                d.han ? (
                  <span>
                    {dvn(d.han)}{" "}
                    {d.han < cm.hom ? <Nhan mau="do">quá hạn</Nhan> : null}
                  </span>
                ) : (
                  ""
                ),
            },
            { ten: "Số HĐ", o: (d) => d.hd ?? "" },
            { ten: "Ghi chú", o: (d) => d.ghichu ?? "" },
            {
              ten: "Thao tác",
              boXuat: true,
              o: (d) =>
                duocChi ? (
                  <div className="flex gap-1">
                    <NutGhi onClick={() => setHop({ loai: "chi", dn: d })}>
                      Đã chi
                    </NutGhi>
                    <NutGhi
                      nguyHiem
                      onClick={() => setHop({ loai: "tuchoi", dn: d })}
                    >
                      Từ chối
                    </NutGhi>
                  </div>
                ) : null,
            },
          ]}
          dong={cho}
          khoa={(d) => d._id}
          rong="Không có đề nghị nào chờ chi."
          tong={[
            { text: "Tổng" },
            null,
            null,
            null,
            { so: tong(cho.map((d) => d.tien)) },
            null,
            null,
            null,
            null,
          ]}
        />
      </Muc>
      <Muc
        tieuDe={`Tổng đã chi trong tháng ${thang.slice(5)}/${thang.slice(0, 4)} theo cơ sở`}
      >
        <Bang
          cot={[
            { ten: "Cơ sở", o: (r: [string, number]) => tenDt(cm, r[0]) },
            { ten: "Đã chi", o: (r) => tien(r[1]), so: (r) => r[1] },
          ]}
          dong={[...theoCs.entries()].sort((a, b) => b[1] - a[1])}
          khoa={(r) => r[0]}
          rong="Tháng này chưa chi khoản nào."
          tong={[{ text: "Tổng" }, { so: tong([...theoCs.values()]) }]}
        />
      </Muc>
      <Muc tieuDe="100 đề nghị đã xử lý gần nhất">
        <Bang
          cot={[
            { ten: "Ngày đề nghị", o: (d: DeNghiChi) => dvn(d.ngay) },
            { ten: "Đơn", o: (d) => d.dh ?? "" },
            { ten: "Cơ sở", o: (d) => tenDt(cm, d.dt) },
            { ten: "Loại", o: (d) => d.loai },
            { ten: "Số tiền", o: (d) => tien(d.tien), so: (d) => d.tien },
            {
              ten: "Trạng thái",
              o: (d) =>
                d.tt === "dachi" ? (
                  <Nhan mau="xanh">Đã chi</Nhan>
                ) : (
                  <Nhan mau="do">Từ chối</Nhan>
                ),
            },
            { ten: "Ngày chi", o: (d) => dvn(d.chi?.ngay) },
            {
              ten: "Đã chi",
              o: (d) => (d.chi?.tien ? tien(d.chi.tien) : ""),
              so: (d) => d.chi?.tien ?? null,
            },
            {
              ten: "Hình thức / lý do",
              o: (d) => d.chi?.ht ?? d.tuchoi?.lydo ?? "",
            },
          ]}
          dong={daXuLy}
          khoa={(d) => d._id}
          rong="Chưa xử lý đề nghị nào."
        />
      </Muc>
      <Hop
        mo={hop !== null}
        tieuDe={
          hop
            ? `${hop.loai === "chi" ? "Đã chi" : "Từ chối"} · ${tenDt(cm, hop.dn.dt)} · ${tien(hop.dn.tien)} đ`
            : ""
        }
        onDong={() => setHop(null)}
      >
        {hop?.loai === "chi" ? (
          <DaChi key={hop.dn._id} dn={hop.dn} onXong={() => setHop(null)} />
        ) : null}
        {hop?.loai === "tuchoi" ? (
          <LyDo
            key={hop.dn._id}
            lenh="tuChoiDeNghi"
            id={hop.dn._id}
            nut="Từ chối"
            onXong={() => setHop(null)}
          />
        ) : null}
      </Hop>
    </div>
  );
}

function DaChi({ dn, onXong }: { dn: DeNghiChi; onXong: () => void }) {
  const [ngay, setNgay] = useState(today());
  const [tienChi, setTienChi] = useState<number | undefined>(dn.tien);
  const [ht, setHt] = useState<string>("Chuyển khoản");
  const l = useLenh("daChi");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void l
          .chay(
            { id: dn._id, ngay, tien: tienChi ?? 0, ht },
            "Đã chi. Bút toán công nợ đã được ghi.",
          )
          .then((ok) => ok && onXong());
      }}
    >
      <Luoi cot={3}>
        <O nhan="Ngày chi">
          <input
            type="date"
            className={lopO}
            value={ngay}
            onChange={(e) => setNgay(e.target.value)}
            required
          />
        </O>
        <O nhan="Số tiền (đ)">
          <OSo giaTri={tienChi} onDoi={setTienChi} tienTe />
        </O>
        <O nhan="Hình thức">
          <select
            className={lopO}
            value={ht}
            onChange={(e) => setHt(e.target.value)}
          >
            {HINH_THUC.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </O>
      </Luoi>
      <ThongBao tb={l.tb} />
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          className={lopNut}
          disabled={l.dangGui || !tienChi}
        >
          Xác nhận đã chi
        </button>
      </div>
    </form>
  );
}
