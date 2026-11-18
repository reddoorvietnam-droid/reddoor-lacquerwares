"use client";

import { useMemo, useState } from "react";

import {
  coQuyen,
  KHAU,
  THU_TU_COT_KHAU,
  type MaMoc,
  type TenKhau,
} from "@/domains/so-tay/hang-so";
import type { MaHang, PhanCong, SanXuat } from "@/domains/so-tay/kieu";
import { daNhan, tenDt, tong } from "@/domains/so-tay/nghiep-vu/chi-muc";
import {
  hopDongCuaDon,
  type HopDongTinh,
} from "@/domains/so-tay/nghiep-vu/hop-dong";
import {
  canKhau,
  hanMacDinh,
  mocDon,
  viecDon,
  type MocTinh,
  type ViecKeToan,
} from "@/domains/so-tay/nghiep-vu/tien-do";
import { dvn, fm, fq, today } from "@/domains/so-tay/tien-ich";

import { DtSelect } from "../dt-select";
import { hopDongExcel, hopDongPdf } from "../hop-dong-file";
import {
  Bang,
  BieuMau,
  DaiThe,
  Hop,
  lopNut,
  lopNutNho,
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
import { NhanMuc, useBoLoc } from "./chung";

const urlAnh = (img?: string) =>
  !img
    ? ""
    : /^(https?:)?\//.test(img)
      ? img
      : `/api/so-tay/anh/${encodeURIComponent(img)}`;

function NhanMoc({ m }: { m: MocTinh }) {
  const mau =
    m.muc === "do"
      ? "do"
      : m.muc === "vang"
        ? "vang"
        : m.muc === "xanh"
          ? "xanh"
          : "xam";
  return <Nhan mau={mau}>{m.ghiChu}</Nhan>;
}

export function TabSanXuat() {
  const { chiTiet, cm } = useSo();
  if (chiTiet && cm.sx.has(chiTiet)) return <ChiTietDon dh={chiTiet} />;
  return <DanhSachDon />;
}

function DanhSachDon() {
  const { cm, nguoi, moChiTiet } = useSo();
  const nhan = useLenh("nhanDon");
  const ds = useMemo(
    () =>
      [...cm.sx.values()].sort((a, b) =>
        a.tt === b.tt ? b.dh.localeCompare(a.dh) : a.tt === "moi" ? -1 : 1,
      ),
    [cm],
  );
  useBoLoc("");
  return (
    <div>
      <Muc
        tieuDe="Đơn sản xuất"
        phu="Bấm một đơn để xem chi tiết, chia việc, hợp đồng."
      >
        <Bang
          cot={[
            { ten: "Đơn", o: (r: SanXuat) => <b>{r.dh}</b> },
            { ten: "Tên đơn", o: (r) => cm.don.get(r.dh)?.n ?? "" },
            { ten: "Khách", o: (r) => r.khach ?? "" },
            { ten: "Xuất hàng (PI)", o: (r) => dvn(r.ngayxuat) },
            {
              ten: "Dự kiến giao",
              o: (r) => (r.tt === "nhan" ? dvn(mocDon(cm, r).duKien) : ""),
            },
            { ten: "Tiến độ", o: (r) => <NhanMuc muc={mocDon(cm, r).muc} /> },
            {
              ten: "Thao tác",
              boXuat: true,
              o: (r) =>
                r.tt === "moi" && coQuyen(nguoi.vaitro, "nhandon") ? (
                  <NutGhi
                    onClick={() =>
                      void nhan.chay({ dh: r.dh }, `Đã nhận đơn ${r.dh}.`)
                    }
                  >
                    Nhận đơn
                  </NutGhi>
                ) : null,
            },
          ]}
          dong={ds}
          khoa={(r) => r._id}
          rong="Chưa có đơn nào gửi xưởng."
          onDong={(r) => moChiTiet(r.dh)}
        />
        <ThongBao tb={nhan.tb} />
      </Muc>
    </div>
  );
}

type O1 = { daChia: number; dat: number; dts: Set<string> };

function ChiTietDon({ dh }: { dh: string }) {
  const { cm, nguoi } = useSo();
  const sx = cm.sx.get(dh) as SanXuat;
  const td = useMemo(() => mocDon(cm, sx), [cm, sx]);
  const hds = useMemo(() => hopDongCuaDon(cm, dh), [cm, dh]);
  const pcs = useMemo(() => cm.pcTheoDon.get(dh) ?? [], [cm, dh]);
  const [chonMa, setChonMa] = useState<string>("");
  const nhanDon = useLenh("nhanDon");
  useBoLoc(`Đơn ${dh}`);

  const o = useMemo(() => {
    const m = new Map<string, O1>();
    for (const p of pcs) {
      const k = `${p.ma}|${p.khau}`;
      const x = m.get(k) ?? { daChia: 0, dat: 0, dts: new Set<string>() };
      x.daChia += p.sl ?? 0;
      x.dat += daNhan(cm, p._id);
      if (p.dt) x.dts.add(p.dt);
      m.set(k, x);
    }
    return m;
  }, [cm, pcs]);

  const so = useMemo(() => {
    let can = 0;
    let chia = 0;
    let dat = 0;
    for (const it of sx.items ?? []) {
      for (const k of KHAU) {
        if (k.ten === "Bao bì" || !canKhau(it, k.ten)) continue;
        const c = o.get(`${it.ma}|${k.ten}`);
        can += it.qty;
        chia += Math.min(c?.daChia ?? 0, it.qty);
        dat += Math.min(c?.dat ?? 0, it.qty);
      }
    }
    const tre = pcs.filter(
      (p) => p.han && p.han < cm.hom && daNhan(cm, p._id) < (p.sl ?? 0),
    ).length;
    return {
      can,
      chia,
      dat,
      tre,
      qty: tong((sx.items ?? []).map((i) => i.qty)),
    };
  }, [cm, o, pcs, sx]);

  const pct = (a: number, b: number) =>
    b ? `${Math.round((a / b) * 100)}%` : "0%";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold text-[#8E2927]">
          {dh} · {cm.don.get(dh)?.n ?? ""} · {sx.khach ?? ""}
        </h2>
        <NhanMuc muc={td.muc} />
        {td.nguyen ? (
          <span className="text-sm text-[#6E6563]">{td.nguyen}</span>
        ) : null}
        {sx.tt === "moi" && coQuyen(nguoi.vaitro, "nhandon") ? (
          <NutGhi
            onClick={() => void nhanDon.chay({ dh }, `Đã nhận đơn ${dh}.`)}
          >
            Nhận đơn
          </NutGhi>
        ) : null}
      </div>
      <ThongBao tb={nhanDon.tb} />
      <DaiThe>
        <The nhan="Tổng số lượng" giaTri={fq(so.qty)} />
        <The nhan="Đã chia việc" giaTri={pct(so.chia, so.can)} />
        <The nhan="Đã hoàn thành" giaTri={pct(so.dat, so.can)} mau="xanh" />
        <The
          nhan="Giá trị HĐ tạm tính"
          giaTri={`${fm(tong(hds.map((h) => h.gt)))} đ`}
        />
        <The
          nhan="Phần trễ hạn"
          giaTri={String(so.tre)}
          mau={so.tre ? "do" : undefined}
        />
        <The
          nhan="Ngày xuất (PI) · dự kiến giao"
          giaTri={dvn(sx.ngayxuat)}
          phu={
            sx.tt === "nhan" ? `Dự kiến ${dvn(td.duKien)}` : "Chờ xưởng nhận"
          }
        />
      </DaiThe>

      {sx.tt === "nhan" ? <BangMoc sx={sx} /> : null}
      <BangMaHang sx={sx} o={o} chon={chonMa} onChon={setChonMa} />
      {sx.tt === "nhan" && coQuyen(nguoi.vaitro, "chia") ? (
        <ChiaViec sx={sx} ma={chonMa} onMa={setChonMa} />
      ) : null}
      {sx.tt === "nhan" && coQuyen(nguoi.vaitro, "baobi") ? (
        <OBaoBi sx={sx} />
      ) : null}
      <DanhSachPhanViec sx={sx} />
      <BangHopDong dh={dh} hds={hds} />
      <ViecKeToanDon sx={sx} />
    </div>
  );
}

function BangMoc({ sx }: { sx: SanXuat }) {
  const { cm, nguoi, dangSua } = useSo();
  const td = mocDon(cm, sx);
  const chon = useLenh("chonMau");
  const ghi = useLenh("ghiMoc");
  const qc = useLenh("ghiQc1");
  const giao = useLenh("ghiGiao");
  const tb = chon.tb ?? ghi.tb ?? qc.tb ?? giao.tb;

  const ghiNgay = (m: MaMoc, ngay: string) => {
    if (m === "m4")
      void qc.chay({ dh: sx.dh, ngay: ngay || null }, "Đã ghi QC lần 1.");
    else if (m === "m5")
      void giao.chay({ dh: sx.dh, ngay: ngay || null }, "Đã ghi giao hàng.");
    else
      void ghi.chay(
        { dh: sx.dh, moc: m, ngay: ngay || null },
        "Đã ghi ngày thực tế.",
      );
  };
  const duocGhi = (m: MaMoc) =>
    m === "m4"
      ? coQuyen(nguoi.vaitro, "qc1")
      : m === "m5"
        ? coQuyen(nguoi.vaitro, "giaohang")
        : coQuyen(nguoi.vaitro, "chia");

  return (
    <Muc
      tieuDe="Mốc tiến độ"
      phu={`Mốc gốc ${dvn(td.goc)}${td.coKy ? " (ngày ký hợp đồng mộc)" : " (chưa ký hợp đồng mộc: tính từ ngày nhận đơn)"}`}
      hanhDong={
        <label className="flex items-center gap-2 text-sm">
          Mẫu tiến độ
          <select
            className={`${lopO} !w-auto`}
            value={sx.mau ?? ""}
            disabled={!dangSua || !coQuyen(nguoi.vaitro, "chia")}
            onChange={(e) =>
              void chon.chay(
                { dh: sx.dh, mau: e.target.value || null },
                "Đã đổi mẫu tiến độ.",
              )
            }
          >
            <option value="">Tự chọn ({td.mau.ten})</option>
            {cm.canhBao.mau.map((m) => (
              <option key={m.ten} value={m.ten}>
                {m.ten}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <Bang
        cot={[
          { ten: "Mốc", o: (r: MocTinh) => <span title={r.tu}>{r.ten}</span> },
          {
            ten: "Số ngày",
            o: (r) =>
              r.ma === "m5"
                ? `${r.soNgay} (tối đa ${td.mau.m5max})`
                : String(r.soNgay),
          },
          { ten: "Bắt đầu", o: (r) => dvn(r.batDau) },
          {
            ten: "Hạn",
            o: (r) =>
              r.hanMax !== r.han
                ? `${dvn(r.han)} – ${dvn(r.hanMax)}`
                : dvn(r.han),
          },
          {
            ten: "Thực tế",
            o: (r) =>
              dangSua &&
              duocGhi(r.ma) &&
              (r.ttTay || r.ma === "m4" || r.ma === "m5" || !r.tt) ? (
                <input
                  type="date"
                  className={`${lopO} !w-36`}
                  defaultValue={
                    r.ma === "m4"
                      ? (sx.qc1?.ngay ?? "")
                      : r.ma === "m5"
                        ? (sx.giao?.ngay ?? "")
                        : (sx.moc?.[r.ma] ?? "")
                  }
                  onBlur={(e) => {
                    const cu =
                      r.ma === "m4"
                        ? (sx.qc1?.ngay ?? "")
                        : r.ma === "m5"
                          ? (sx.giao?.ngay ?? "")
                          : (sx.moc?.[r.ma] ?? "");
                    if (e.target.value !== cu) ghiNgay(r.ma, e.target.value);
                  }}
                />
              ) : (
                <>
                  {dvn(r.tt)}
                  {r.ttTay ? (
                    <span className="ml-1 text-xs text-[#6E6563]">
                      (ghi tay)
                    </span>
                  ) : null}
                </>
              ),
          },
          {
            ten: "Quá hạn",
            o: (r) =>
              r.qua > 0 ? (
                <Nhan mau={r.tt ? "xam" : "do"}>+{r.qua} ngày</Nhan>
              ) : (
                "–"
              ),
            so: (r) => r.qua,
          },
          { ten: "Tình trạng", o: (r) => <NhanMoc m={r} /> },
          { ten: "Phụ trách", o: (r) => r.phutrach },
        ]}
        dong={td.moc}
        khoa={(r) => r.ma}
      />
      {td.mocCS.length ? (
        <div className="mt-3">
          <h4 className="mb-1 text-sm font-semibold">Mộc theo từng cơ sở</h4>
          <Bang
            cot={[
              {
                ten: "Cơ sở",
                o: (r: (typeof td.mocCS)[number]) => tenDt(cm, r.dt),
              },
              { ten: "Hạn", o: (r) => dvn(r.han) },
              { ten: "Đã giao / cần", o: (r) => `${fq(r.da)} / ${fq(r.can)}` },
              { ten: "Tình trạng", o: (r) => <NhanMuc muc={r.muc} /> },
            ]}
            dong={td.mocCS}
            khoa={(r) => r.dt}
          />
        </div>
      ) : null}
      <ThongBao tb={tb} />
    </Muc>
  );
}

function OBaoBiTrangThai({ sx, it }: { sx: SanXuat; it: MaHang }) {
  const { cm } = useSo();
  const pcs = (cm.pcTheoDon.get(sx.dh) ?? []).filter(
    (p) => p.khau === "Bao bì" && (p.ma ?? "").includes(it.ma),
  );
  if (!pcs.length) return <Nhan mau="vang">Chưa đặt</Nhan>;
  const ve = pcs.every((p) => daNhan(cm, p._id) >= (p.sl ?? 0));
  return ve ? (
    <Nhan mau="xanh">Đã về kho</Nhan>
  ) : (
    <span className="text-xs">
      Đã đặt (
      {[...new Set(pcs.map((p) => cm.dt.get(p.dt ?? "")?.n ?? p.dt))].join(
        ", ",
      )}
      )
    </span>
  );
}

function BangMaHang({
  sx,
  o,
  chon,
  onChon,
}: {
  sx: SanXuat;
  o: Map<string, O1>;
  chon: string;
  onChon: (ma: string) => void;
}) {
  const { nguoi, dangSua } = useSo();
  const [ktsx, setKtsx] = useState<MaHang | null>(null);
  const cot = THU_TU_COT_KHAU.map((k) => ({
    ten: k,
    o: (it: MaHang) => {
      if (k === "Bao bì") return <OBaoBiTrangThai sx={sx} it={it} />;
      if (!canKhau(it, k)) return <span className="text-[#6E6563]">–</span>;
      const c = o.get(`${it.ma}|${k}`);
      return (
        <div className="text-xs whitespace-nowrap">
          <b>
            {fq(c?.dat ?? 0)} / {fq(it.qty)}
          </b>
          <div>
            {!c || c.daChia === 0 ? (
              <Nhan mau="vang">Chưa chia</Nhan>
            ) : c.daChia < it.qty ? (
              <span>Chia {fq(c.daChia)}</span>
            ) : (
              <span className="text-[#6E6563]">{c.dts.size} cơ sở</span>
            )}
          </div>
        </div>
      );
    },
  }));
  return (
    <Muc
      tieuDe="Mã hàng"
      phu="Số đạt / số cần theo từng khâu; bấm một dòng để chia việc."
    >
      <Bang
        cot={[
          {
            ten: "Ảnh",
            o: (it: MaHang) =>
              it.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urlAnh(it.img)}
                  alt=""
                  className="h-12 w-12 rounded object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="inline-block h-12 w-12 rounded bg-[#FAF5EC]" />
              ),
            boXuat: true,
          },
          { ten: "Mã hàng", o: (it) => <b>{it.ma}</b> },
          {
            ten: "Mô tả",
            o: (it) => (
              <div className="min-w-44">
                {it.mt}
                {it.in ? (
                  <span className="ml-1">
                    <Nhan mau="tim">in hoa văn</Nhan>
                  </span>
                ) : null}
                {it.ktsx ? (
                  <div className="mt-0.5 text-xs whitespace-pre-wrap text-[#6E6563]">
                    KT: {it.ktsx}
                  </div>
                ) : null}
                {dangSua && coQuyen(nguoi.vaitro, "chia") ? (
                  <button
                    type="button"
                    className={`${lopNutNho} mt-1`}
                    data-bo-xuat
                    onClick={(e) => {
                      e.stopPropagation();
                      setKtsx(it);
                    }}
                  >
                    {it.ktsx ? "Sửa ghi chú KT" : "+ Ghi chú KT"}
                  </button>
                ) : null}
              </div>
            ),
          },
          {
            ten: "KT (cm)",
            o: (it) =>
              [it.L, it.W, it.H].filter((x) => x !== undefined).join("×"),
          },
          { ten: "SL", o: (it) => fq(it.qty), so: (it) => it.qty },
          ...cot,
        ]}
        dong={sx.items ?? []}
        khoa={(it) => it.ma}
        onDong={(it) => onChon(it.ma)}
        dongLop={(it) => (it.ma === chon ? "bg-[#C9A24A]/10" : "")}
      />
      <HopKtsx sx={sx} it={ktsx} onDong={() => setKtsx(null)} />
    </Muc>
  );
}

function HopKtsx({
  sx,
  it,
  onDong,
}: {
  sx: SanXuat;
  it: MaHang | null;
  onDong: () => void;
}) {
  return (
    <Hop
      mo={it !== null}
      tieuDe={`Ghi chú kỹ thuật · ${it?.ma ?? ""}`}
      onDong={onDong}
    >
      {it ? <NoiDungKtsx key={it.ma} sx={sx} it={it} onXong={onDong} /> : null}
    </Hop>
  );
}

function NoiDungKtsx({
  sx,
  it,
  onXong,
}: {
  sx: SanXuat;
  it: MaHang;
  onXong: () => void;
}) {
  const [text, setText] = useState(it.ktsx ?? "");
  const l = useLenh("ghiKtsx");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void l
          .chay({ dh: sx.dh, ma: it.ma, ktsx: text }, "Đã lưu ghi chú KT.")
          .then((ok) => ok && onXong());
      }}
    >
      <textarea
        className={`${lopO} min-h-32 py-2`}
        value={text}
        placeholder="Loại gỗ, độ dày, màu sơn, số lớp, cách in, yêu cầu đóng gói…"
        onChange={(e) => setText(e.target.value)}
      />
      {it.ktsxBy ? (
        <p className="mt-1 text-xs text-[#6E6563]">
          Sửa lần cuối: {it.ktsxBy} · {dvn(it.ktsxAt)}
        </p>
      ) : null}
      <ThongBao tb={l.tb} />
      <div className="mt-3 flex justify-end">
        <button type="submit" className={lopNut} disabled={l.dangGui}>
          Lưu
        </button>
      </div>
    </form>
  );
}

const KHAU_CHIA = KHAU.filter((k) => k.ten !== "Bao bì");

function ChiaViec({
  sx,
  ma,
  onMa,
}: {
  sx: SanXuat;
  ma: string;
  onMa: (m: string) => void;
}) {
  const { cm } = useSo();
  const [khau, setKhau] = useState<TenKhau>("Mộc");
  const [dt, setDt] = useState("");
  const [slg, setSlg] = useState<number | undefined>();
  const [dg, setDg] = useState<number | undefined>();
  const [han, setHan] = useState("");
  const [ghichu, setGhichu] = useState("");
  const [tru, setTru] = useState("");
  const l = useLenh("chiaViec");

  const it = sx.items.find((i) => i.ma === ma);
  const kd = KHAU.find((k) => k.ten === khau);
  const daChia = tong(
    (cm.pcTheoDon.get(sx.dh) ?? [])
      .filter((p) => p.ma === ma && p.khau === khau)
      .map((p) => p.sl ?? 0),
  );
  const con = it ? it.qty - daChia : 0;
  const doiTuong = cm.dt.get(dt);
  const nguoiNhaMay =
    doiTuong?.l === "Nhân sự nhà máy" ||
    doiTuong?.g === "In, mẫu, hoàn thiện mẫu";
  const csHoanThien = [
    ...new Set(
      (cm.pcTheoDon.get(sx.dh) ?? [])
        .filter((p) => p.ma === ma && p.khau === "Hoàn thiện (sơn)" && p.dt)
        .map((p) => p.dt as string),
    ),
  ];
  const hanGoiY = hanMacDinh(cm, sx, khau);

  const gui = async () => {
    const ok = await l.chay(
      {
        dh: sx.dh,
        ma,
        khau,
        dt,
        sl: slg ?? con,
        dg,
        han: han || hanGoiY,
        ghichu,
        ...(khau === "Nhập kho" && nguoiNhaMay
          ? { tru: tru || csHoanThien[0] }
          : {}),
      },
      "Đã chia việc.",
    );
    if (ok) {
      setSlg(undefined);
      setDg(undefined);
      setGhichu("");
    }
  };

  return (
    <BieuMau
      tieuDe="Chia việc cho cơ sở"
      phu="Khâu có tính tiền (trừ Nhập kho) bắt buộc nhập giá tạm tính."
      onSubmit={() => void gui()}
    >
      <Luoi cot={4}>
        <O nhan="Mã hàng">
          <select
            className={lopO}
            value={ma}
            onChange={(e) => onMa(e.target.value)}
            required
          >
            <option value="">— Chọn —</option>
            {sx.items.map((i) => (
              <option key={i.ma} value={i.ma}>
                {i.ma}
              </option>
            ))}
          </select>
        </O>
        <O nhan="Khâu">
          <select
            className={lopO}
            value={khau}
            onChange={(e) => setKhau(e.target.value as TenKhau)}
          >
            {KHAU_CHIA.filter((k) => !it || canKhau(it, k.ten)).map((k) => (
              <option key={k.ten}>{k.ten}</option>
            ))}
          </select>
        </O>
        <O nhan="Cơ sở" rong>
          <DtSelect
            giaTri={dt}
            onChon={setDt}
            loc={{ g: kd?.nhom ?? [] }}
            macDinh={{
              l:
                khau === "In tại nhà máy" || khau === "Kiểm hàng"
                  ? "Nhân sự nhà máy"
                  : "Cơ sở gia công",
              g: kd?.nhom[0] ?? "",
            }}
          />
        </O>
        <O nhan={`Số lượng (còn ${fq(con)})`}>
          <OSo
            giaTri={slg ?? (con > 0 ? con : undefined)}
            onDoi={setSlg}
            thapPhan
          />
        </O>
        <O
          nhan={
            khau === "Nhập kho" && nguoiNhaMay
              ? "Tiền trừ vào cơ sở (đ/cái)"
              : "Đơn giá tạm tính (đ)"
          }
        >
          <OSo
            giaTri={dg}
            onDoi={setDg}
            tienTe
            placeholder={
              khau === "Nhập kho" && !nguoiNhaMay
                ? "Để trống = đã gồm trong giá hoàn thiện"
                : ""
            }
          />
        </O>
        <O nhan="Hạn">
          <input
            type="date"
            className={lopO}
            value={han || hanGoiY}
            onChange={(e) => setHan(e.target.value)}
          />
        </O>
        {khau === "Nhập kho" && nguoiNhaMay ? (
          <O nhan="Trừ tiền vào cơ sở hoàn thiện">
            <select
              className={lopO}
              value={tru || csHoanThien[0] || ""}
              onChange={(e) => setTru(e.target.value)}
              required
            >
              <option value="">— Chọn —</option>
              {csHoanThien.map((c) => (
                <option key={c} value={c}>
                  {tenDt(cm, c)}
                </option>
              ))}
            </select>
          </O>
        ) : null}
        <O nhan="Ghi chú" rong>
          <input
            className={lopO}
            value={ghichu}
            onChange={(e) => setGhichu(e.target.value)}
          />
        </O>
      </Luoi>
      <ThongBao tb={l.tb} />
      <div className="mt-3">
        <button
          type="submit"
          className={lopNut}
          disabled={l.dangGui || !ma || !dt}
        >
          Chia việc
        </button>
      </div>
    </BieuMau>
  );
}

type DongBb = {
  ma: string;
  sl: number;
  chon: boolean;
  dg?: number | undefined;
};

function OBaoBi({ sx }: { sx: SanXuat }) {
  const { cm } = useSo();
  const goiY = useMemo<DongBb[]>(() => {
    const dong: DongBb[] = [];
    let thung = 0;
    for (const it of sx.items) {
      if (!it.inner) continue;
      const hop = Math.ceil(it.qty / it.inner);
      dong.push({ ma: `Hộp trong 3 lớp · ${it.ma}`, sl: hop, chon: false });
      thung += it.io ? Math.ceil(hop / it.io) : 0;
    }
    if (thung) dong.push({ ma: "Thùng ngoài 5 lớp", sl: thung, chon: false });
    return dong;
  }, [sx.items]);
  const [dong, setDong] = useState(goiY);
  const [dt, setDt] = useState("");
  const [han, setHan] = useState("");
  const l = useLenh("datBaoBi");
  const hanGoiY = hanMacDinh(cm, sx, "Bao bì");
  const daDat = new Set(
    (cm.pcTheoDon.get(sx.dh) ?? [])
      .filter((p) => p.khau === "Bao bì")
      .map((p) => p.ma),
  );

  return (
    <BieuMau
      tieuDe="Bao bì"
      phu="Tick dòng cần đặt, chọn cơ sở bao bì, nhập giá tạm tính từng dòng. Mỗi dòng tạo một phần việc khâu Bao bì."
      onSubmit={() =>
        void l
          .chay(
            {
              dh: sx.dh,
              dt,
              han: han || hanGoiY,
              dong: dong
                .filter((d) => d.chon)
                .map((d) => ({ ma: d.ma, sl: d.sl, dg: d.dg })),
            },
            "Đã đặt bao bì.",
          )
          .then((ok) => ok && setDong(dong.map((d) => ({ ...d, chon: false }))))
      }
    >
      {dong.length === 0 ? (
        <p className="text-sm text-[#6E6563]">
          Mã hàng chưa có quy cách hộp trong (SL / hộp trong).
        </p>
      ) : null}
      <div className="space-y-1.5">
        {dong.map((d, i) => (
          <div key={d.ma} className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex min-w-64 flex-1 items-center gap-2">
              <input
                type="checkbox"
                checked={d.chon}
                onChange={(e) =>
                  setDong(
                    dong.map((x, j) =>
                      j === i ? { ...x, chon: e.target.checked } : x,
                    ),
                  )
                }
              />
              {d.ma}
              {daDat.has(d.ma) ? <Nhan mau="xanh">đã đặt</Nhan> : null}
            </label>
            <div className="w-24">
              <OSo
                giaTri={d.sl}
                onDoi={(v) =>
                  setDong(
                    dong.map((x, j) => (j === i ? { ...x, sl: v ?? 0 } : x)),
                  )
                }
              />
            </div>
            <div className="w-36">
              <OSo
                giaTri={d.dg}
                tienTe
                placeholder="Đơn giá"
                onDoi={(v) =>
                  setDong(
                    dong.map((x, j) =>
                      j === i
                        ? {
                            ...x,
                            ...(v === undefined
                              ? { dg: undefined }
                              : { dg: v }),
                          }
                        : x,
                    ),
                  )
                }
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <Luoi cot={3}>
          <O nhan="Cơ sở bao bì" rong>
            <DtSelect
              giaTri={dt}
              onChon={setDt}
              loc={{ g: ["Bao bì"] }}
              macDinh={{ l: "Cơ sở gia công", g: "Bao bì" }}
            />
          </O>
          <O nhan="Hạn giao về kho">
            <input
              type="date"
              className={lopO}
              value={han || hanGoiY}
              onChange={(e) => setHan(e.target.value)}
            />
          </O>
        </Luoi>
      </div>
      <ThongBao tb={l.tb} />
      <div className="mt-3">
        <button
          type="submit"
          className={lopNut}
          disabled={l.dangGui || !dt || !dong.some((d) => d.chon)}
        >
          Đặt bao bì
        </button>
      </div>
    </BieuMau>
  );
}

function DanhSachPhanViec({ sx }: { sx: SanXuat }) {
  const { cm, nguoi } = useSo();
  const [hop, setHop] = useState<{
    loai: "nhan" | "gia" | "huy";
    pc: PhanCong;
  } | null>(null);
  const pcs = [...(cm.pcTheoDon.get(sx.dh) ?? [])].sort(
    (a, b) =>
      THU_TU_COT_KHAU.indexOf(a.khau) - THU_TU_COT_KHAU.indexOf(b.khau) ||
      (a.ma ?? "").localeCompare(b.ma ?? ""),
  );
  const quyenSua = (p: PhanCong) =>
    coQuyen(nguoi.vaitro, p.khau === "Bao bì" ? "baobi" : "chia");
  return (
    <Muc tieuDe="Danh sách phần việc">
      <Bang
        cot={[
          { ten: "Khâu", o: (p: PhanCong) => p.khau },
          { ten: "Mã hàng", o: (p) => p.ma ?? "" },
          { ten: "Cơ sở", o: (p) => tenDt(cm, p.dt) },
          { ten: "SL", o: (p) => fq(p.sl ?? 0), so: (p) => p.sl ?? 0 },
          {
            ten: "Đã nhận",
            o: (p) => fq(daNhan(cm, p._id)),
            so: (p) => daNhan(cm, p._id),
          },
          {
            ten: "Lỗi",
            o: (p) =>
              fq(tong((cm.ghTheoPc.get(p._id) ?? []).map((g) => g.loi ?? 0))),
          },
          {
            ten: "Đơn giá",
            o: (p) => (p.dg ? fm(p.dg) : ""),
            so: (p) => p.dg ?? null,
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
            ten: "Ghi chú",
            o: (p) => <span className="text-xs">{p.ghichu}</span>,
          },
          {
            ten: "Thao tác",
            boXuat: true,
            o: (p) => (
              <div className="flex flex-wrap gap-1">
                {coQuyen(nguoi.vaitro, "nhan") ? (
                  <NutGhi onClick={() => setHop({ loai: "nhan", pc: p })}>
                    Nhận hàng
                  </NutGhi>
                ) : null}
                {quyenSua(p) ? (
                  <NutGhi onClick={() => setHop({ loai: "gia", pc: p })}>
                    Đổi giá
                  </NutGhi>
                ) : null}
                {quyenSua(p) ? (
                  <NutGhi
                    nguyHiem
                    onClick={() => setHop({ loai: "huy", pc: p })}
                  >
                    Hủy
                  </NutGhi>
                ) : null}
              </div>
            ),
          },
        ]}
        dong={pcs}
        khoa={(p) => p._id}
        rong="Chưa chia việc nào."
      />
      <Hop
        mo={hop !== null}
        tieuDe={
          hop
            ? `${hop.loai === "nhan" ? "Nhận hàng" : hop.loai === "gia" ? "Đổi giá" : "Hủy phần việc"} · ${hop.pc.khau} · ${hop.pc.ma ?? ""}`
            : ""
        }
        onDong={() => setHop(null)}
      >
        {hop?.loai === "nhan" ? (
          <NhanHang key={hop.pc._id} pc={hop.pc} />
        ) : null}
        {hop?.loai === "gia" ? (
          <DoiGia key={hop.pc._id} pc={hop.pc} onXong={() => setHop(null)} />
        ) : null}
        {hop?.loai === "huy" ? (
          <LyDo
            key={hop.pc._id}
            lenh="huyPhanCong"
            id={hop.pc._id}
            onXong={() => setHop(null)}
          />
        ) : null}
      </Hop>
    </Muc>
  );
}

function NhanHang({ pc }: { pc: PhanCong }) {
  const { cm } = useSo();
  const [ngay, setNgay] = useState(today());
  const [slg, setSlg] = useState<number | undefined>(
    Math.max(0, (pc.sl ?? 0) - daNhan(cm, pc._id)),
  );
  const [loi, setLoi] = useState<number | undefined>(0);
  const [ghichu, setGhichu] = useState("");
  const l = useLenh("nhanHang");
  const huy = useLenh("huyGiaoHang");
  const [lyDo, setLyDo] = useState("");
  const ghs = cm.ghTheoPc.get(pc._id) ?? [];
  return (
    <div>
      <p className="mb-2 text-sm">
        {tenDt(cm, pc.dt)} · đã nhận {fq(daNhan(cm, pc._id))} / {fq(pc.sl ?? 0)}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void l.chay(
            { pc: pc._id, ngay, sl: slg ?? 0, loi: loi ?? 0, ghichu },
            "Đã ghi nhận hàng.",
          );
        }}
      >
        <Luoi cot={2}>
          <O nhan="Ngày">
            <input
              type="date"
              className={lopO}
              value={ngay}
              onChange={(e) => setNgay(e.target.value)}
              required
            />
          </O>
          <O nhan="Số đạt">
            <OSo giaTri={slg} onDoi={setSlg} thapPhan />
          </O>
          <O nhan="Số lỗi">
            <OSo giaTri={loi} onDoi={setLoi} thapPhan />
          </O>
          <O nhan="Lý do lỗi / ghi chú">
            <input
              className={lopO}
              value={ghichu}
              onChange={(e) => setGhichu(e.target.value)}
              required={(loi ?? 0) > 0}
            />
          </O>
        </Luoi>
        <ThongBao tb={l.tb} />
        <div className="mt-3 flex justify-end">
          <button type="submit" className={lopNut} disabled={l.dangGui}>
            Ghi nhận hàng
          </button>
        </div>
      </form>
      {ghs.length ? (
        <div className="mt-4">
          <h4 className="mb-1 text-sm font-semibold">Các lần đã nhận</h4>
          <ul className="space-y-1 text-sm">
            {ghs.map((g) => (
              <li key={g._id} className="flex flex-wrap items-center gap-2">
                {dvn(g.ngay)} · đạt {fq(g.sl ?? 0)}
                {g.loi ? ` · lỗi ${fq(g.loi)} (${g.ghichu ?? ""})` : ""}
                <input
                  className={`${lopO} !w-40`}
                  placeholder="Lý do hủy"
                  value={lyDo}
                  onChange={(e) => setLyDo(e.target.value)}
                />
                <button
                  type="button"
                  className={lopNutNho}
                  disabled={!lyDo.trim()}
                  onClick={() =>
                    void huy.chay(
                      { id: g._id, lydo: lyDo },
                      "Đã hủy phiếu nhận.",
                    )
                  }
                >
                  Hủy phiếu
                </button>
              </li>
            ))}
          </ul>
          <ThongBao tb={huy.tb} />
        </div>
      ) : null}
    </div>
  );
}

function DoiGia({ pc, onXong }: { pc: PhanCong; onXong: () => void }) {
  const [dg, setDg] = useState<number | undefined>(pc.dg);
  const l = useLenh("doiGia");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void l
          .chay({ id: pc._id, dg: dg ?? 0 }, "Đã đổi giá.")
          .then((ok) => ok && onXong());
      }}
    >
      <O nhan="Đơn giá mới (đ)">
        <OSo giaTri={dg} onDoi={setDg} tienTe />
      </O>
      {pc.ls?.length ? (
        <p className="mt-2 text-xs text-[#6E6563]">
          Lịch sử giá:{" "}
          {pc.ls
            .map((x) => `${fm(x.dg ?? 0)} (${x.by ?? ""} ${dvn(x.at)})`)
            .join(" → ")}
        </p>
      ) : null}
      <ThongBao tb={l.tb} />
      <div className="mt-3 flex justify-end">
        <button type="submit" className={lopNut} disabled={l.dangGui}>
          Lưu giá
        </button>
      </div>
    </form>
  );
}

export function LyDo({
  lenh,
  id,
  onXong,
  khoaId = "id",
  nut = "Xác nhận hủy",
}: {
  lenh: string;
  id: string;
  onXong: () => void;
  khoaId?: string;
  nut?: string;
}) {
  const [lyDo, setLyDo] = useState("");
  const l = useLenh(lenh);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void l
          .chay({ [khoaId]: id, lydo: lyDo }, "Đã lưu.")
          .then((ok) => ok && onXong());
      }}
    >
      <O nhan="Lý do (bắt buộc)">
        <input
          className={lopO}
          value={lyDo}
          onChange={(e) => setLyDo(e.target.value)}
          required
        />
      </O>
      <ThongBao tb={l.tb} />
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          className={lopNut}
          disabled={l.dangGui || !lyDo.trim()}
        >
          {nut}
        </button>
      </div>
    </form>
  );
}

export function BangHopDong({
  dh,
  hds,
  coDon = false,
}: {
  dh?: string;
  hds: HopDongTinh[];
  coDon?: boolean;
}) {
  const { cm, nguoi } = useSo();
  const [hop, setHop] = useState<{
    loai: "ky" | "ung" | "tt";
    h: HopDongTinh;
  } | null>(null);
  const ghi = useLenh("ghiCongNoHd");
  return (
    <Muc tieuDe="Hợp đồng với cơ sở" phu={dh ? undefined : "Theo từng đơn"}>
      <Bang
        cot={[
          ...(coDon ? [{ ten: "Đơn", o: (h: HopDongTinh) => h.dh }] : []),
          {
            ten: "Cơ sở",
            o: (h: HopDongTinh) => (
              <div>
                {tenDt(cm, h.dt)}
                <div className="flex flex-wrap gap-1">
                  {h.doiGia ? <Nhan mau="vang">Đổi giá sau ký</Nhan> : null}
                  {h.choGhi ? <Nhan mau="vang">Chờ ghi công nợ</Nhan> : null}
                </div>
              </div>
            ),
          },
          {
            ten: "Phần việc",
            o: (h) => [...new Set(h.pcs.map((p) => p.khau))].join(", "),
          },
          { ten: "Giá trị", o: (h) => tien(h.gt), so: (h) => h.gt },
          {
            ten: "Đã ký",
            o: (h) =>
              h.daKy ? (
                `${h.so ?? ""} · ${dvn(h.ngayKy)}`
              ) : (
                <span className="text-[#6E6563]">chưa ký</span>
              ),
          },
          {
            ten: "Đã ghi công nợ",
            o: (h) => tien(h.daGhi),
            so: (h) => h.daGhi,
          },
          { ten: "Đã ứng", o: (h) => tien(h.daUng), so: (h) => h.daUng },
          { ten: "Đã trả", o: (h) => tien(h.daTT), so: (h) => h.daTT },
          { ten: "Vật tư cấp", o: (h) => tien(h.vtCap), so: (h) => h.vtCap },
          {
            ten: "Còn phải trả",
            o: (h) => <b>{tien(h.conPhaiTra)}</b>,
            so: (h) => h.conPhaiTra,
          },
          {
            ten: "Thao tác",
            boXuat: true,
            o: (h) => (
              <div className="flex max-w-72 flex-wrap gap-1">
                {coQuyen(nguoi.vaitro, "hd") ? (
                  <NutGhi onClick={() => setHop({ loai: "ky", h })}>
                    {h.daKy ? "Ký phụ lục" : "Ký HĐ"}
                  </NutGhi>
                ) : null}
                {coQuyen(nguoi.vaitro, "congno") && h.choGhi ? (
                  <NutGhi
                    onClick={() =>
                      void ghi.chay(
                        { dh: h.dh, dt: h.dt },
                        `Đã ghi công nợ hợp đồng ${tenDt(cm, h.dt)}.`,
                      )
                    }
                  >
                    Ghi công nợ
                  </NutGhi>
                ) : null}
                {coQuyen(nguoi.vaitro, "hd") && h.coTamUng ? (
                  <NutGhi onClick={() => setHop({ loai: "ung", h })}>
                    Đề nghị tạm ứng
                  </NutGhi>
                ) : null}
                {coQuyen(nguoi.vaitro, "hd") ? (
                  <NutGhi onClick={() => setHop({ loai: "tt", h })}>
                    Đề nghị thanh toán
                  </NutGhi>
                ) : null}
                <button
                  type="button"
                  className={lopNutNho}
                  onClick={() => void hopDongExcel(cm, h.dh, h.dt)}
                >
                  Tải HĐ Excel
                </button>
                <button
                  type="button"
                  className={lopNutNho}
                  onClick={() => void hopDongPdf(cm, h.dh, h.dt)}
                >
                  Tải HĐ PDF (A4)
                </button>
              </div>
            ),
          },
        ]}
        dong={hds}
        khoa={(h) => `${h.dh}~${h.dt}`}
        rong="Chưa có hợp đồng (chưa chia việc có tính tiền)."
        tong={[
          ...(coDon ? [null] : []),
          { text: "Tổng" },
          null,
          { so: tong(hds.map((h) => h.gt)) },
          null,
          { so: tong(hds.map((h) => h.daGhi)) },
          { so: tong(hds.map((h) => h.daUng)) },
          { so: tong(hds.map((h) => h.daTT)) },
          { so: tong(hds.map((h) => h.vtCap)) },
          { so: tong(hds.map((h) => h.conPhaiTra)) },
          null,
        ]}
      />
      <ThongBao tb={ghi.tb} />
      <Hop
        mo={hop !== null}
        tieuDe={
          hop
            ? `${hop.loai === "ky" ? "Ký hợp đồng" : hop.loai === "ung" ? "Đề nghị tạm ứng" : "Đề nghị thanh toán"} · ${tenDt(cm, hop.h.dt)}`
            : ""
        }
        onDong={() => setHop(null)}
      >
        {hop?.loai === "ky" ? (
          <KyHopDong key={hop.h.dt} h={hop.h} onXong={() => setHop(null)} />
        ) : null}
        {hop && hop.loai !== "ky" ? (
          <DeNghi
            key={`${hop.h.dt}-${hop.loai}`}
            h={hop.h}
            loai={hop.loai === "ung" ? "Tạm ứng" : "Thanh toán"}
            onXong={() => setHop(null)}
          />
        ) : null}
      </Hop>
    </Muc>
  );
}

function KyHopDong({ h, onXong }: { h: HopDongTinh; onXong: () => void }) {
  const [so, setSo] = useState(h.so ?? "");
  const [ngay, setNgay] = useState(h.ngayKy ?? today());
  const l = useLenh("kyHopDong");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void l
          .chay(
            { dh: h.dh, dt: h.dt, so, ngay },
            "Đã ký hợp đồng. Kế toán xưởng bấm Ghi công nợ.",
          )
          .then((ok) => ok && onXong());
      }}
    >
      <p className="mb-2 text-sm">Giá trị tạm tính lúc ký: {tien(h.gt)} đ</p>
      <Luoi cot={2}>
        <O nhan="Số hợp đồng">
          <input
            className={lopO}
            value={so}
            onChange={(e) => setSo(e.target.value)}
            required
          />
        </O>
        <O nhan="Ngày ký">
          <input
            type="date"
            className={lopO}
            value={ngay}
            onChange={(e) => setNgay(e.target.value)}
            required
          />
        </O>
      </Luoi>
      <ThongBao tb={l.tb} />
      <div className="mt-3 flex justify-end">
        <button type="submit" className={lopNut} disabled={l.dangGui}>
          Ký
        </button>
      </div>
    </form>
  );
}

function DeNghi({
  h,
  loai,
  onXong,
}: {
  h: HopDongTinh;
  loai: "Tạm ứng" | "Thanh toán";
  onXong: () => void;
}) {
  const [tienDn, setTienDn] = useState<number | undefined>(
    loai === "Tạm ứng"
      ? h.deNghiUng || undefined
      : Math.max(0, h.conDeNghi) || undefined,
  );
  const [han, setHan] = useState("");
  const [ghichu, setGhichu] = useState("");
  const l = useLenh("deNghi");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void l
          .chay(
            {
              dh: h.dh,
              dt: h.dt,
              loai,
              tien: tienDn ?? 0,
              han,
              hd: h.so ?? "",
              ghichu,
            },
            "Đã gửi đề nghị cho kế toán công ty.",
          )
          .then((ok) => ok && onXong());
      }}
    >
      <p className="mb-2 text-sm text-[#6E6563]">
        {loai === "Tạm ứng"
          ? `Đề xuất 30% làm tròn xuống triệu: ${tien(h.deNghiUng)} đ (đã ứng ${tien(h.daUng)} đ, đang chờ ${tien(h.ungCho)} đ).`
          : `Còn có thể đề nghị: ${tien(h.conDeNghi)} đ.`}
      </p>
      <Luoi cot={2}>
        <O nhan="Số tiền (đ)">
          <OSo giaTri={tienDn} onDoi={setTienDn} tienTe />
        </O>
        <O nhan="Hạn chi">
          <input
            type="date"
            className={lopO}
            value={han}
            onChange={(e) => setHan(e.target.value)}
          />
        </O>
        <O nhan="Ghi chú" rong>
          <input
            className={lopO}
            value={ghichu}
            onChange={(e) => setGhichu(e.target.value)}
          />
        </O>
      </Luoi>
      <ThongBao tb={l.tb} />
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          className={lopNut}
          disabled={l.dangGui || !tienDn}
        >
          {l.xacNhan ? "Gửi lần nữa" : "Gửi đề nghị"}
        </button>
      </div>
    </form>
  );
}

function ViecKeToanDon({ sx }: { sx: SanXuat }) {
  const { cm } = useSo();
  const ds = viecDon(cm, sx).sort(
    (a, b) => Number(a.xong) - Number(b.xong) || a.han.localeCompare(b.han),
  );
  if (!ds.length) return null;
  return (
    <Muc tieuDe="Việc của kế toán">
      <Bang
        cot={[
          {
            ten: "Việc",
            o: (r: ViecKeToan) => (
              <div>
                {r.viec}
                {r.ghi ? (
                  <div className="text-xs text-[#6E6563]">{r.ghi}</div>
                ) : null}
              </div>
            ),
          },
          { ten: "Phụ trách", o: (r) => r.phutrach },
          {
            ten: "Số tiền",
            o: (r) => (r.tien ? tien(r.tien) : ""),
            so: (r) => r.tien ?? null,
          },
          { ten: "Hạn", o: (r) => dvn(r.han) },
          { ten: "Tình trạng", o: (r) => <NhanMuc muc={r.muc} /> },
          { ten: "Ghi chú", o: (r) => r.ghiChu },
        ]}
        dong={ds}
        khoa={(r, i) => `${r.viec}-${i}`}
      />
    </Muc>
  );
}
