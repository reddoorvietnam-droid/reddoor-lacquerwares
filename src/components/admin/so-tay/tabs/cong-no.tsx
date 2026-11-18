"use client";

import { useMemo, useState } from "react";

import {
  coQuyen,
  CP,
  HINH_THUC,
  MA_DON_KHO_BB,
  NV,
  NV_DS,
  type KhoanCp,
  type NghiepVu,
} from "@/domains/so-tay/hang-so";
import type { CongNo, ThuTien } from "@/domains/so-tay/kieu";
import { tenDt, tong } from "@/domains/so-tay/nghiep-vu/chi-muc";
import {
  congNoTheoCap,
  tamTinhTheoDon,
  tongTheoCoSo,
  type TongCoSo,
} from "@/domains/so-tay/nghiep-vu/cong-no";
import { hopDongCuaDon } from "@/domains/so-tay/nghiep-vu/hop-dong";
import { dvn, today } from "@/domains/so-tay/tien-ich";

import { DtSelect } from "../dt-select";
import {
  Bang,
  BieuMau,
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
import { khop, OTim, useBoLoc } from "./chung";
import { BangHopDong, LyDo } from "./san-xuat";

export function TabCongNo() {
  const { cm, du, nguoi, diTab } = useSo();
  const [locCp, setLocCp] = useState("");
  const [tim, setTim] = useState("");
  const [huyCn, setHuyCn] = useState<{ lenh: string; id: string } | null>(null);
  useBoLoc([locCp, tim].filter(Boolean).join(" · "));

  const tongCs = useMemo(() => [...tongTheoCoSo(cm).values()], [cm]);
  const cap = useMemo(() => congNoTheoCap(cm), [cm]);
  const choGhi = useMemo(
    () =>
      [...cm.sx.keys()]
        .flatMap((dh) => hopDongCuaDon(cm, dh))
        .filter((h) => h.choGhi),
    [cm],
  );
  const dongCs = useMemo(() => {
    const coCp = locCp
      ? new Set(cap.filter((c) => c.cp.includes(locCp)).map((c) => c.dt))
      : null;
    return tongCs
      .filter(
        (t) =>
          (!coCp || coCp.has(t.dt)) &&
          (Math.abs(t.conNo) >= 1 || Math.abs(t.noSon) >= 1 || t.hd),
      )
      .filter((t) => khop(tim, cm.dt.get(t.dt)?.so, cm.dt.get(t.dt)?.n))
      .map((t) => {
        if (!locCp) return t;
        const cs = cap.filter((c) => c.dt === t.dt && c.cp.includes(locCp));
        return {
          ...t,
          hd: tong(cs.map((c) => c.hd)),
          daTra: tong(cs.map((c) => c.daTra)),
          vtCap: tong(cs.map((c) => c.vtCap)),
          conNo: tong(cs.map((c) => c.conNo)),
        };
      })
      .sort((a, b) => b.conNo - a.conNo);
  }, [cap, cm.dt, locCp, tim, tongCs]);
  const tamTinh = [...tamTinhTheoDon(cm).entries()].map(([o, t]) => ({ o, t }));
  const ganDay = [
    ...(du.congno ?? []).map((c) => ({ loai: "cn" as const, c })),
    ...(du.thutien ?? []).map((c) => ({ loai: "thu" as const, c })),
  ]
    .sort((a, b) => (b.c.at ?? b.c.ngay).localeCompare(a.c.at ?? a.c.ngay))
    .slice(0, 100);

  return (
    <div>
      <DaiThe>
        <The
          nhan="RD còn nợ cơ sở"
          giaTri={`${tien(tong(tongCs.map((t) => t.conNo)))} đ`}
        />
        <The
          nhan="Cơ sở nợ RD tiền sơn"
          giaTri={`${tien(tong(tongCs.map((t) => Math.max(0, t.noSon))))} đ`}
        />
        <The
          nhan="Hợp đồng chờ ghi công nợ"
          giaTri={String(choGhi.length)}
          mau={choGhi.length ? "vang" : undefined}
        />
      </DaiThe>
      {coQuyen(nguoi.vaitro, "congno") ? <GhiCongNo /> : null}
      {coQuyen(nguoi.vaitro, "thu") ? <PhieuThu /> : null}
      {choGhi.length ? <BangHopDong hds={choGhi} coDon /> : null}

      <Muc
        tieuDe="Công nợ theo cơ sở"
        phu={
          du.sodu?.ngay
            ? `Số dư chốt ngày ${dvn(du.sodu.ngay)} (${du.sodu.nguon ?? ""}) + bút toán trên Sổ tay. Bấm một dòng để xem sổ chi tiết.`
            : undefined
        }
        hanhDong={
          <>
            <select
              className={`${lopO} !w-auto`}
              value={locCp}
              onChange={(e) => setLocCp(e.target.value)}
            >
              <option value="">Mọi khoản chi phí</option>
              {CP.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <OTim giaTri={tim} onDoi={setTim} goiY="Tên hoặc số" />
          </>
        }
      >
        <Bang
          cot={[
            {
              ten: "Số",
              o: (t: TongCoSo) =>
                cm.dt.get(t.dt)?.so ?? (cm.dt.get(t.dt)?.luu ? "Axx" : ""),
            },
            { ten: "Cơ sở", o: (t) => cm.dt.get(t.dt)?.n ?? t.dt },
            { ten: "Hợp đồng", o: (t) => tien(t.hd), so: (t) => t.hd },
            { ten: "Đã trả", o: (t) => tien(t.daTra), so: (t) => t.daTra },
            {
              ten: "Vật tư xưởng cấp",
              o: (t) => tien(t.vtCap),
              so: (t) => t.vtCap,
            },
            {
              ten: "RD còn nợ",
              o: (t) => <b>{tien(t.conNo)}</b>,
              so: (t) => t.conNo,
            },
            {
              ten: "Nợ RD tiền sơn",
              o: (t) => tien(t.noSon),
              so: (t) => t.noSon,
            },
          ]}
          dong={dongCs}
          khoa={(t) => t.dt}
          onDong={(t) => diTab("coso", t.dt)}
          tong={[
            { text: "Tổng" },
            null,
            { so: tong(dongCs.map((t) => t.hd)) },
            { so: tong(dongCs.map((t) => t.daTra)) },
            { so: tong(dongCs.map((t) => t.vtCap)) },
            { so: tong(dongCs.map((t) => t.conNo)) },
            { so: tong(dongCs.map((t) => t.noSon)) },
          ]}
        />
      </Muc>

      <Muc
        tieuDe="Giá trị tạm tính theo đơn"
        phu="Tách riêng, không cộng vào công nợ."
      >
        <Bang
          cot={[
            {
              ten: "Đơn",
              o: (r: { o: string; t: number }) =>
                `${r.o} ${cm.don.get(r.o)?.n ?? ""}`,
            },
            { ten: "Giá trị tạm tính", o: (r) => tien(r.t), so: (r) => r.t },
          ]}
          dong={tamTinh}
          khoa={(r) => r.o}
          tong={[{ text: "Tổng" }, { so: tong(tamTinh.map((r) => r.t)) }]}
        />
      </Muc>

      <Muc
        tieuDe="Bút toán gần đây"
        phu="100 bút toán công nợ và phiếu thu mới nhất."
      >
        <Bang
          cot={[
            { ten: "Ngày", o: (r: (typeof ganDay)[number]) => dvn(r.c.ngay) },
            {
              ten: "Loại",
              o: (r) => (r.loai === "cn" ? (r.c as CongNo).nv : "Phiếu thu"),
            },
            {
              ten: "Đơn",
              o: (r) => (r.loai === "cn" ? ((r.c as CongNo).dh ?? "") : ""),
            },
            { ten: "Cơ sở", o: (r) => tenDt(cm, r.c.dt) },
            { ten: "Số tiền", o: (r) => tien(r.c.tien), so: (r) => r.c.tien },
            {
              ten: "Nội dung",
              o: (r) => (
                <span className="text-xs">
                  {r.loai === "cn"
                    ? [(r.c as CongNo).cp, (r.c as CongNo).ghichu]
                        .filter(Boolean)
                        .join(" · ")
                    : [(r.c as ThuTien).ht, (r.c as ThuTien).nd]
                        .filter(Boolean)
                        .join(" · ")}
                </span>
              ),
            },
            {
              ten: "Trạng thái",
              o: (r) =>
                r.c.huy ? <Nhan mau="do">Đã hủy: {r.c.huy.lydo}</Nhan> : null,
            },
            {
              ten: "Thao tác",
              boXuat: true,
              o: (r) =>
                !r.c.huy &&
                coQuyen(nguoi.vaitro, r.loai === "cn" ? "congno" : "thu") ? (
                  <NutGhi
                    nguyHiem
                    onClick={() =>
                      setHuyCn({
                        lenh: r.loai === "cn" ? "huyCongNo" : "huyThuTien",
                        id: r.c._id,
                      })
                    }
                  >
                    Hủy
                  </NutGhi>
                ) : null,
            },
          ]}
          dong={ganDay}
          khoa={(r) => r.c._id}
          rong="Chưa có bút toán nào trên Sổ tay."
        />
      </Muc>
      <Hop
        mo={huyCn !== null}
        tieuDe="Hủy bút toán"
        onDong={() => setHuyCn(null)}
      >
        {huyCn ? (
          <LyDo
            key={huyCn.id}
            lenh={huyCn.lenh}
            id={huyCn.id}
            onXong={() => setHuyCn(null)}
          />
        ) : null}
      </Hop>
    </div>
  );
}

function GhiCongNo() {
  const { cm, du } = useSo();
  const [f, setF] = useState<{
    ngay: string;
    dh: string;
    dt: string;
    cp: KhoanCp | "";
    nv: NghiepVu;
    tien?: number | undefined;
    hd: string;
    ghichu: string;
  }>({
    ngay: today(),
    dh: "",
    dt: "",
    cp: "",
    nv: "Thanh toán",
    hd: "",
    ghichu: "",
  });
  const l = useLenh("ghiCongNo");
  const no =
    congNoTheoCap(cm).find((c) => c.dh === f.dh && c.dt === f.dt)?.conNo ?? 0;
  return (
    <BieuMau
      tieuDe="Ghi công nợ cơ sở"
      onSubmit={() =>
        void l
          .chay(
            { ...f, cp: f.cp || undefined, tien: f.tien ?? 0 },
            "Đã ghi công nợ.",
          )
          .then((ok) => ok && setF({ ...f, tien: undefined, ghichu: "" }))
      }
    >
      <Luoi cot={4}>
        <O nhan="Ngày">
          <input
            type="date"
            className={lopO}
            value={f.ngay}
            onChange={(e) => setF({ ...f, ngay: e.target.value })}
            required
          />
        </O>
        <O nhan="Mã đơn">
          <select
            className={lopO}
            value={f.dh}
            onChange={(e) => setF({ ...f, dh: e.target.value })}
          >
            <option value="">— Không gắn đơn —</option>
            <option value={MA_DON_KHO_BB}>
              KHO-BB · Bao bì mua dùng dần (tồn kho)
            </option>
            {[...(du.donhang ?? [])]
              .sort((a, b) => b._id.localeCompare(a._id))
              .filter((d) => d._id !== MA_DON_KHO_BB)
              .map((d) => (
                <option key={d._id} value={d._id}>
                  {d._id} {d.n ?? ""}
                </option>
              ))}
          </select>
        </O>
        <O nhan="Cơ sở" rong>
          <DtSelect
            giaTri={f.dt}
            onChon={(dt) => setF({ ...f, dt })}
            loc={{ l: ["Cơ sở gia công", "Nhà cung cấp", "Dịch vụ"] }}
          />
        </O>
        <O nhan="Khoản chi phí">
          <select
            className={lopO}
            value={f.cp}
            onChange={(e) => setF({ ...f, cp: e.target.value as KhoanCp })}
          >
            <option value="">—</option>
            {CP.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </O>
        <O nhan="Nghiệp vụ">
          <select
            className={lopO}
            value={f.nv}
            onChange={(e) => setF({ ...f, nv: e.target.value as NghiepVu })}
          >
            {NV_DS.map((n) => (
              <option key={n} value={n}>
                {n} ({NV[n] > 0 ? "+" : "−"})
              </option>
            ))}
          </select>
        </O>
        <O nhan="Số tiền (đ)">
          <OSo
            giaTri={f.tien}
            onDoi={(v) =>
              setF({
                ...f,
                ...(v === undefined ? { tien: undefined } : { tien: v }),
              })
            }
            tienTe
          />
        </O>
        <O nhan="Số HĐ">
          <input
            className={lopO}
            value={f.hd}
            onChange={(e) => setF({ ...f, hd: e.target.value })}
          />
        </O>
        <O nhan="Ghi chú" rong>
          <input
            className={lopO}
            value={f.ghichu}
            onChange={(e) => setF({ ...f, ghichu: e.target.value })}
          />
        </O>
      </Luoi>
      {f.dt ? (
        <p className="mt-2 text-sm">
          Còn nợ hiện tại của {f.dh || "(không gắn đơn)"} – {tenDt(cm, f.dt)}:{" "}
          <b>{tien(no)} đ</b>
        </p>
      ) : null}
      <ThongBao tb={l.tb} />
      <div className="mt-3">
        <button
          type="submit"
          className={lopNut}
          disabled={l.dangGui || !f.dt || !f.tien}
        >
          {l.xacNhan ? "Ghi lần nữa" : "Ghi công nợ"}
        </button>
      </div>
    </BieuMau>
  );
}

function PhieuThu() {
  const [f, setF] = useState<{
    ngay: string;
    dt: string;
    tien?: number | undefined;
    ht: string;
    nd: string;
  }>({ ngay: today(), dt: "", ht: "Chuyển khoản", nd: "" });
  const l = useLenh("thuTien");
  return (
    <BieuMau
      tieuDe="Phiếu thu"
      phu="Cơ sở trả tiền sơn, gỗ, vật tư mua của nhà máy."
      onSubmit={() =>
        void l
          .chay({ ...f, tien: f.tien ?? 0 }, "Đã lập phiếu thu.")
          .then((ok) => ok && setF({ ...f, tien: undefined, nd: "" }))
      }
    >
      <Luoi cot={4}>
        <O nhan="Ngày">
          <input
            type="date"
            className={lopO}
            value={f.ngay}
            onChange={(e) => setF({ ...f, ngay: e.target.value })}
            required
          />
        </O>
        <O nhan="Người trả" rong>
          <DtSelect giaTri={f.dt} onChon={(dt) => setF({ ...f, dt })} />
        </O>
        <O nhan="Số tiền (đ)">
          <OSo
            giaTri={f.tien}
            onDoi={(v) =>
              setF({
                ...f,
                ...(v === undefined ? { tien: undefined } : { tien: v }),
              })
            }
            tienTe
          />
        </O>
        <O nhan="Hình thức">
          <select
            className={lopO}
            value={f.ht}
            onChange={(e) => setF({ ...f, ht: e.target.value })}
          >
            {HINH_THUC.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </O>
        <O nhan="Nội dung" rong>
          <input
            className={lopO}
            value={f.nd}
            onChange={(e) => setF({ ...f, nd: e.target.value })}
          />
        </O>
      </Luoi>
      <ThongBao tb={l.tb} />
      <div className="mt-3">
        <button
          type="submit"
          className={lopNut}
          disabled={l.dangGui || !f.dt || !f.tien}
        >
          Lập phiếu thu
        </button>
      </div>
    </BieuMau>
  );
}
