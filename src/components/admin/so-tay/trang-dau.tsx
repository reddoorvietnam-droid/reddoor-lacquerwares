"use client";

import { useEffect, useMemo, useState } from "react";

import type { DonLich, NguoiSoTay } from "@/domains/so-tay/kieu";
import {
  amLich,
  canChi,
  dongNgay,
  moTaAm,
  ngayLe,
  tenThu,
  thuTrongTuan,
} from "@/domains/so-tay/nghiep-vu/am-lich";
import {
  GIAI_DOAN,
  giaiDoanNgay,
  type ViecHomNay,
} from "@/domains/so-tay/nghiep-vu/tien-do";
import { addDays, daysTo, dvn, today } from "@/domains/so-tay/tien-ich";

import { taiTrangDau } from "./api";
import { Bang, Hop, lopNut, lopThe } from "./ui";

const MOC_LICH: Record<string, { ten: string; mau: string }> = {
  nhan: { ten: "Nhận đơn", mau: "#2f6fb0" },
  moc: { ten: "Giao mộc", mau: "#8a5a2b" },
  in: { ten: "In", mau: "#7b4bb3" },
  kiem: { ten: "Kiểm hàng", mau: "#c97f00" },
  giao: { ten: "Giao hàng", mau: "#8E2927" },
  pi: { ten: "Xuất PI", mau: "#1f6b45" },
};

const BUOC = ["Mộc", "Hoàn thiện", "In", "Kiểm hàng", "Giao hàng"];

type SuKien = {
  dh: string;
  k: string;
  xong?: boolean | undefined;
  tre?: boolean | undefined;
};

function thangCong(y: number, m: number, n: number): [number, number] {
  const t = y * 12 + (m - 1) + n;
  return [Math.floor(t / 12), (t % 12) + 1];
}

const ngayChuoi = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function TrangDauView({
  nguoi,
  onVaoSo,
  onMoDon,
}: {
  nguoi: NguoiSoTay;
  onVaoSo: () => void;
  onMoDon: (dh: string) => void;
}) {
  const hom = today();
  const [lich, setLich] = useState<DonLich[]>([]);
  const [viec, setViec] = useState<ViecHomNay[] | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [ngayMo, setNgayMo] = useState<string | null>(null);

  useEffect(() => {
    let huy = false;
    taiTrangDau()
      .then((d) => {
        if (huy) return;
        setLich(d.lich);
        setViec(d.viec);
      })
      .catch(
        (e: unknown) =>
          !huy && setLoi(e instanceof Error ? e.message : "Không tải được."),
      );
    return () => {
      huy = true;
    };
  }, []);

  // Sự kiện theo ngày, và các ngày có vạch "đang in".
  const { theoNgay, ngayIn } = useMemo(() => {
    const theoNgay = new Map<string, SuKien[]>();
    const ngayIn = new Set<string>();
    for (const d of lich) {
      for (const e of d.ev) {
        const ngayChip = e.k === "in" ? (e.den ?? e.ngay) : e.ngay;
        theoNgay.set(ngayChip, [
          ...(theoNgay.get(ngayChip) ?? []),
          { dh: d.dh, k: e.k, xong: e.xong, tre: e.tre },
        ]);
        if (e.k === "in" && e.den) {
          for (let x = e.ngay; x <= e.den; x = addDays(x, 1)) ngayIn.add(x);
        }
      }
    }
    return { theoNgay, ngayIn };
  }, [lich]);

  const [y, m] = hom.split("-").map(Number) as [number, number];
  const thangs = [-1, 0, 1, 2, 3, 4].map((n) => thangCong(y, m, n));

  return (
    <div className="text-[#221C1B]">
      {/* Màn hình chào */}
      <section className={`${lopThe} mb-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_rd.jpg"
            alt="RED DOOR"
            className="h-20 w-auto rounded-lg"
          />
          <div className="flex-1">
            <p className="text-xl font-semibold text-[#8E2927]">{nguoi.chao}</p>
            <p className="mt-1 text-sm text-[#6E6563]">{dongNgay(hom)}</p>
          </div>
          <button type="button" className={lopNut} onClick={onVaoSo}>
            Vào sổ →
          </button>
        </div>
        <h2 className="mt-5 mb-2 font-semibold">
          Công việc hiện tại của ngày hôm nay cần lưu ý là:
        </h2>
        {loi ? <p className="text-sm text-[#D0342C]">{loi}</p> : null}
        {viec === null && !loi ? (
          <p className="text-sm text-[#6E6563]">Đang tải…</p>
        ) : null}
        {viec && viec.length === 0 ? (
          <p className="text-sm text-[#6E6563]">
            Hôm nay không có việc nào quá hạn hoặc đến hạn trong 3 ngày tới.
          </p>
        ) : null}
        {viec && viec.length > 0 ? (
          <Bang
            cot={[
              { ten: "Đơn hàng", o: (r: ViecHomNay) => r.dh },
              { ten: "Công việc", o: (r) => r.viec },
              { ten: "Phụ trách", o: (r) => r.phutrach },
              { ten: "Hạn", o: (r) => dvn(r.han) },
              {
                ten: "Tình trạng",
                o: (r) =>
                  r.con < 0 ? (
                    <span className="font-semibold text-[#D0342C]">
                      Quá {-r.con} ngày
                    </span>
                  ) : r.con === 0 ? (
                    <span className="font-semibold text-[#C97F00]">
                      Hôm nay
                    </span>
                  ) : (
                    <span className="text-[#6E6563]">Còn {r.con} ngày</span>
                  ),
              },
            ]}
            dong={viec}
            khoa={(r, i) => `${r.dh}-${r.viec}-${i}`}
          />
        ) : null}
      </section>

      {/* Lịch sản xuất 6 tháng */}
      <section className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-wide text-[#8E2927]">
            CÔNG TY TNHH CỬA ĐỎ
          </h2>
          <p className="text-xs text-[#6E6563]">
            Lịch sản xuất 6 tháng · dương lịch &amp; âm lịch · bấm một ngày để
            xem tình trạng các đơn
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(MOC_LICH).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ background: v.mau }}
              />
              {v.ten}
            </span>
          ))}
        </div>
      </section>

      <div className="relative">
        <div className="mb-3 flex justify-center md:hidden">
          <button type="button" onClick={onVaoSo} title="Vào Sổ chung">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_rd.jpg"
              alt="RED DOOR – Vào Sổ chung"
              className="h-16 w-auto rounded-lg shadow"
            />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {thangs.map(([ty, tm], i) => (
            <div
              key={`${ty}-${tm}`}
              className={i === 1 ? "order-first md:order-none" : ""}
            >
              <OThang
                y={ty}
                m={tm}
                hom={hom}
                laThangNay={i === 1}
                theoNgay={theoNgay}
                ngayIn={ngayIn}
                onChon={setNgayMo}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onVaoSo}
          title="Vào Sổ chung"
          className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-1.5 shadow-lg ring-2 ring-[#C9A24A] md:block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_rd.jpg"
            alt="RED DOOR – Vào Sổ chung"
            className="h-20 w-auto rounded-lg"
          />
        </button>
      </div>
      <p className="mt-2 text-xs text-[#6E6563]">
        Ngày lễ tô hồng. Lịch nghỉ Tết chính thức theo thông báo của Chính phủ.
        Chủ nhật số đỏ, Thứ Bảy là ngày làm việc.
      </p>

      <HopNgay
        ngay={ngayMo}
        hom={hom}
        lich={lich}
        theoNgay={theoNgay}
        onDong={() => setNgayMo(null)}
        onMoDon={onMoDon}
      />
    </div>
  );
}

function OThang({
  y,
  m,
  hom,
  laThangNay,
  theoNgay,
  ngayIn,
  onChon,
}: {
  y: number;
  m: number;
  hom: string;
  laThangNay: boolean;
  theoNgay: Map<string, SuKien[]>;
  ngayIn: Set<string>;
  onChon: (ngay: string) => void;
}) {
  const soNgay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dau = ngayChuoi(y, m, 1);
  const lech = (thuTrongTuan(dau) + 6) % 7; // T2 = 0
  const o: Array<string | null> = [
    ...Array.from({ length: lech }, () => null),
    ...Array.from({ length: soNgay }, (_, i) => ngayChuoi(y, m, i + 1)),
  ];
  return (
    <div className={`${lopThe} !p-2.5`}>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="font-semibold">
          Tháng {m}/{y}
        </h3>
        {laThangNay ? (
          <span className="rounded-full bg-[#C9A24A] px-2 py-0.5 text-xs font-semibold text-white">
            Tháng này
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[0.65rem] text-[#6E6563]">
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((t) => (
          <div key={t} className={t === "CN" ? "text-[#D0342C]" : ""}>
            {t}
          </div>
        ))}
        {o.map((ngay, i) => {
          if (!ngay) return <div key={`r${i}`} />;
          const am = amLich(ngay);
          const le = ngayLe(ngay);
          const cn = thuTrongTuan(ngay) === 0;
          const dacBiet = am.ngay === 1 || am.ngay === 15;
          const sk = theoNgay.get(ngay) ?? [];
          const theoLoai = new Map<string, SuKien[]>();
          for (const s of sk)
            theoLoai.set(s.k, [...(theoLoai.get(s.k) ?? []), s]);
          return (
            <button
              key={ngay}
              type="button"
              onClick={() => onChon(ngay)}
              title={`${moTaAm(am)}${le ? ` · ${le.ten}` : ""}`}
              className={`relative flex min-h-12 flex-col rounded-md border p-0.5 text-left hover:border-[#C9A24A] ${ngay === hom ? "border-2 border-[#C9A24A]" : "border-[#E2D6C4]/60"} ${le ? "bg-[#fde4e4]" : "bg-white"}`}
            >
              <span className="flex items-start justify-between">
                <span
                  className={`text-sm leading-none font-semibold ${cn ? "text-[#D0342C]" : "text-[#221C1B]"}`}
                >
                  {Number(ngay.slice(8))}
                </span>
                <span
                  className={`text-[0.6rem] leading-none ${dacBiet ? "font-bold text-[#D0342C]" : "text-[#6E6563]"}`}
                >
                  {dacBiet ? `${am.ngay}/${am.thang}` : am.ngay}
                  {am.nhuan && dacBiet ? "n" : ""}
                </span>
              </span>
              {le ? (
                <span className="truncate text-[0.55rem] leading-tight text-[#8E2927]">
                  {le.ngan}
                </span>
              ) : null}
              <span className="mt-auto flex flex-wrap gap-0.5">
                {[...theoLoai.entries()].map(([k, ds]) => {
                  const v = MOC_LICH[k];
                  if (!v) return null;
                  const xong = ds.every((s) => s.xong);
                  const tre = ds.some((s) => s.tre);
                  return (
                    <span
                      key={k}
                      className={`rounded px-0.5 text-[0.55rem] leading-tight font-semibold text-white ${xong ? "opacity-40" : ""} ${tre ? "ring-1 ring-[#D0342C]" : ""}`}
                      style={{ background: v.mau }}
                    >
                      {ds.length > 1 ? ds.length : (ds[0]?.dh ?? "").slice(-2)}
                    </span>
                  );
                })}
              </span>
              {ngayIn.has(ngay) ? (
                <span className="absolute right-0 bottom-0 left-0 h-0.5 bg-[#7b4bb3]" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HopNgay({
  ngay,
  hom,
  lich,
  theoNgay,
  onDong,
  onMoDon,
}: {
  ngay: string | null;
  hom: string;
  lich: DonLich[];
  theoNgay: Map<string, SuKien[]>;
  onDong: () => void;
  onMoDon: (dh: string) => void;
}) {
  const ds = useMemo(
    () =>
      ngay
        ? lich
            .map((d) => ({ d, g: giaiDoanNgay(d, ngay, hom) }))
            .filter(
              (
                x,
              ): x is {
                d: DonLich;
                g: NonNullable<ReturnType<typeof giaiDoanNgay>>;
              } => x.g !== null,
            )
        : [],
    [lich, ngay, hom],
  );
  if (!ngay)
    return (
      <Hop mo={false} tieuDe="" onDong={onDong}>
        {null}
      </Hop>
    );
  const am = amLich(ngay);
  const le = ngayLe(ngay);
  const dem = GIAI_DOAN.map((g) => ({
    g,
    tong: ds.filter((x) => x.g.giaiDoan === g).length,
    tre: ds.filter((x) => x.g.giaiDoan === g && x.g.tre).length,
  }));
  const max = Math.max(1, ...dem.map((x) => x.tong));
  const sk = theoNgay.get(ngay) ?? [];

  return (
    <Hop
      mo
      tieuDe={`Tình trạng các đơn ngày ${dvn(ngay)}`}
      onDong={onDong}
      rong="max-w-3xl"
    >
      <p className="mb-3 text-sm text-[#6E6563]">
        {tenThu(ngay)} · Âm lịch {am.ngay}/{am.thang}
        {am.nhuan ? " nhuận" : ""} · năm {canChi(am.nam)}
        {le ? ` · ${le.ten}` : ""}
        {ngay > hom ? " · tình trạng tính theo kế hoạch tiến độ" : ""}
      </p>
      {sk.length ? (
        <div className="mb-4">
          <h3 className="mb-1 text-sm font-semibold">Các mốc trong ngày</h3>
          <ul className="flex flex-wrap gap-1.5 text-xs">
            {sk.map((s, i) => (
              <li
                key={`${s.dh}-${s.k}-${i}`}
                className={`rounded px-1.5 py-0.5 font-semibold text-white ${s.xong ? "opacity-50" : ""} ${s.tre ? "ring-2 ring-[#D0342C]" : ""}`}
                style={{ background: MOC_LICH[s.k]?.mau }}
              >
                {MOC_LICH[s.k]?.ten} · {s.dh}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <h3 className="mb-1 text-sm font-semibold">Số đơn theo giai đoạn</h3>
      <div className="mb-4 space-y-1">
        {dem.map((x) => (
          <div key={x.g} className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0">{x.g}</span>
            <span className="relative h-4 flex-1 rounded bg-[#FAF5EC]">
              <span
                className="absolute inset-y-0 left-0 rounded bg-[#8E2927]/70"
                style={{ width: `${(x.tong / max) * 100}%` }}
              />
              <span
                className="absolute inset-y-0 left-0 rounded"
                style={{
                  width: `${(x.tre / max) * 100}%`,
                  background:
                    "repeating-linear-gradient(45deg,#D0342C 0 4px,#f6b3ae 4px 8px)",
                }}
              />
            </span>
            <span className="w-14 text-right tabular-nums">
              {x.tong}
              {x.tre ? ` (${x.tre} trễ)` : ""}
            </span>
          </div>
        ))}
      </div>
      <h3 className="mb-1 text-sm font-semibold">Tiến độ từng đơn</h3>
      {ds.length === 0 ? (
        <p className="text-sm text-[#6E6563]">
          Không có đơn nào đang làm vào ngày này.
        </p>
      ) : null}
      <ul className="space-y-2">
        {ds.map(({ d, g }) => {
          const buocXong = g.buoc;
          const tre = g.tre && g.han ? daysTo(g.han, ngay) : 0;
          return (
            <li key={d.dh}>
              <button
                type="button"
                className="w-full rounded-lg border border-[#E2D6C4] p-2 text-left hover:border-[#C9A24A]"
                onClick={() => onMoDon(d.dh)}
              >
                <div className="mb-1 flex flex-wrap justify-between gap-1 text-xs">
                  <span className="font-semibold">
                    {d.dh} {d.ten ?? ""} {d.khach ? `· ${d.khach}` : ""}
                  </span>
                  <span className="text-[#6E6563]">
                    {g.giaiDoan === "Đã giao"
                      ? "Đã giao · 100%"
                      : `Đang: ${g.giaiDoan} · ${tre > 0 ? `trễ ${tre} ngày` : `hạn ${dvn(g.han)}`} · ${Math.round((buocXong / 5) * 100)}%`}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-0.5">
                  {BUOC.map((b, i) => (
                    <span
                      key={b}
                      title={b}
                      className={`h-2.5 rounded-sm ${i < buocXong ? "bg-[#1F6B45]" : i === buocXong ? (g.tre ? "bg-[#D0342C]" : "border-2 border-[#8E2927] bg-white") : "bg-[#E2D6C4]/60"}`}
                    />
                  ))}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Hop>
  );
}
