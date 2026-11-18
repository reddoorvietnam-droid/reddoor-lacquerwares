"use client";

import { useMemo, useState } from "react";

import {
  coQuyen,
  KHO_VT,
  LOAI,
  TEN_LOAI_PHIEU,
  type TenLoaiPhieu,
} from "@/domains/so-tay/hang-so";
import type { DonMua, DongVatTu, PhieuKho, VatTu } from "@/domains/so-tay/kieu";
import { tenDt, tong } from "@/domains/so-tay/nghiep-vu/chi-muc";
import { giaTriPhieu } from "@/domains/so-tay/nghiep-vu/cong-no";
import {
  NHAN_KHO,
  stat,
  tonKho,
  type TrangThaiKho,
} from "@/domains/so-tay/nghiep-vu/kho";
import { dvn, fq, today } from "@/domains/so-tay/tien-ich";

import { DtSelect } from "../dt-select";
import { inTemQr } from "../tem-qr";
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
import { khop, OTim, useBoLoc } from "./chung";
import { LyDo } from "./san-xuat";

const loaiOf = (ten: string) => LOAI.find((l) => l.ten === ten);

function useTon() {
  const { du } = useSo();
  return useMemo(
    () => tonKho(du.vattu ?? [], du.phieukho ?? [], du.sodu?.ngay),
    [du.phieukho, du.sodu?.ngay, du.vattu],
  );
}

function NhanKho({ st }: { st: TrangThaiKho }) {
  if (st === "ok") return null;
  return <Nhan mau={st === "vang" ? "vang" : "do"}>{NHAN_KHO[st]}</Nhan>;
}

/** Các dòng vật tư: chọn vật tư có ô tìm, số lượng, đơn giá. */
function DongVt({
  dong,
  onDoi,
  coGia,
  ton,
}: {
  dong: DongVatTu[];
  onDoi: (d: DongVatTu[]) => void;
  coGia: boolean;
  ton?: Map<string, number>;
}) {
  const { du, cm } = useSo();
  return (
    <div>
      <datalist id="so-tay-vat-tu">
        {(du.vattu ?? []).map((v) => (
          <option key={v._id} value={v._id}>
            {v.n} · {v.u}
          </option>
        ))}
      </datalist>
      <div className="space-y-1.5">
        {dong.map((d, i) => {
          const vt = cm.vt.get(d.vt);
          return (
            <div
              key={i}
              className="grid grid-cols-1 items-center gap-2 text-sm sm:grid-cols-[12rem_1fr_8rem_9rem_auto]"
            >
              <input
                className={lopO}
                list="so-tay-vat-tu"
                placeholder="Mã vật tư"
                value={d.vt}
                onChange={(e) =>
                  onDoi(
                    dong.map((x, j) =>
                      j === i ? { ...x, vt: e.target.value.trim() } : x,
                    ),
                  )
                }
              />
              <span className="text-xs text-[#6E6563]">
                {vt
                  ? `${vt.n ?? ""} · ${vt.u ?? ""}${ton ? ` · tồn ${fq(ton.get(vt._id) ?? 0)}` : ""}`
                  : d.vt
                    ? "Không có mã này"
                    : ""}
              </span>
              <OSo
                giaTri={d.sl}
                thapPhan
                placeholder="Số lượng"
                onDoi={(v) =>
                  onDoi(
                    dong.map((x, j) =>
                      j === i
                        ? {
                            ...x,
                            ...(v === undefined
                              ? { sl: undefined }
                              : { sl: v }),
                          }
                        : x,
                    ),
                  )
                }
              />
              {coGia ? (
                <OSo
                  giaTri={d.dg}
                  tienTe
                  placeholder="Đơn giá"
                  onDoi={(v) =>
                    onDoi(
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
              ) : (
                <span />
              )}
              <button
                type="button"
                className={lopNutNho}
                onClick={() => onDoi(dong.filter((_, j) => j !== i))}
                aria-label="Xóa dòng"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className={`${lopNutNho} mt-2`}
        onClick={() => onDoi([...dong, { vt: "" }])}
      >
        + Thêm dòng
      </button>
    </div>
  );
}

export function TabKho() {
  const { du, cm, nguoi } = useSo();
  const ton = useTon();
  const [loai, setLoai] = useState<TenLoaiPhieu>("Xuất bán cho cơ sở");
  const [f, setF] = useState({ ngay: today(), dt: "", dh: "", ghichu: "" });
  const [dong, setDong] = useState<DongVatTu[]>([{ vt: "" }]);
  const [locLoai, setLocLoai] = useState("");
  const [locDon, setLocDon] = useState("");
  const [chiTem, setChiTem] = useState(false);
  const [huyPk, setHuyPk] = useState<string | null>(null);
  const l = useLenh("lapPhieu");
  const ld = loaiOf(loai);
  const vuaLap = l.ketQua as PhieuKho | null;
  useBoLoc(
    [locLoai, locDon, chiTem ? "có tem" : ""].filter(Boolean).join(" · "),
  );

  const ds = (du.phieukho ?? [])
    .filter(
      (p) =>
        (!locLoai || p.loai === locLoai) &&
        (!locDon || p.dh === locDon) &&
        (!chiTem || (loaiOf(p.loai) && "tem" in (loaiOf(p.loai) as object))),
    )
    .sort((a, b) => b.ngay.localeCompare(a.ngay) || b.so.localeCompare(a.so));

  return (
    <div>
      {coQuyen(nguoi.vaitro, "kho") ? (
        <BieuMau
          tieuDe="Lập phiếu kho"
          phu="Số phiếu tự sinh khi lưu."
          onSubmit={() =>
            void l
              .chay(
                {
                  ngay: f.ngay,
                  loai,
                  ...(ld?.dt ? { dt: f.dt } : {}),
                  ...(ld?.dh ? { dh: f.dh } : {}),
                  ghichu: f.ghichu,
                  dong: dong
                    .filter((d) => d.vt)
                    .map((d) => ({
                      vt: d.vt,
                      sl: d.sl ?? 0,
                      ...(ld && "gia" in ld ? { dg: d.dg } : {}),
                    })),
                },
                "Đã lưu phiếu kho.",
              )
              .then((ok) => {
                if (ok) {
                  setDong([{ vt: "" }]);
                  setF({ ...f, ghichu: "" });
                }
              })
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
            <O nhan="Loại phiếu">
              <select
                className={lopO}
                value={loai}
                onChange={(e) => setLoai(e.target.value as TenLoaiPhieu)}
              >
                {TEN_LOAI_PHIEU.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </O>
            {ld?.dt ? (
              <O nhan={ld.dt === "ncc" ? "Nhà cung cấp" : "Đối tượng"} rong>
                <DtSelect
                  giaTri={f.dt}
                  onChon={(dt) => setF({ ...f, dt })}
                  {...(ld.dt === "ncc"
                    ? {
                        loc: { l: ["Nhà cung cấp"] },
                        macDinh: { l: "Nhà cung cấp", g: "Vật tư" },
                      }
                    : {})}
                />
              </O>
            ) : null}
            {ld?.dh ? (
              <O nhan="Mã đơn">
                <select
                  className={lopO}
                  value={f.dh}
                  onChange={(e) => setF({ ...f, dh: e.target.value })}
                  required
                >
                  <option value="">— Chọn —</option>
                  {[...(du.donhang ?? [])]
                    .sort((a, b) => b._id.localeCompare(a._id))
                    .map((d) => (
                      <option key={d._id} value={d._id}>
                        {d._id} {d.n ?? ""}
                      </option>
                    ))}
                </select>
              </O>
            ) : null}
            <O nhan={ld && "lydo" in ld ? "Lý do (bắt buộc)" : "Ghi chú"} rong>
              <input
                className={lopO}
                value={f.ghichu}
                onChange={(e) => setF({ ...f, ghichu: e.target.value })}
                required={Boolean(ld && "lydo" in ld)}
              />
            </O>
          </Luoi>
          <div className="mt-3">
            <DongVt
              dong={dong}
              onDoi={setDong}
              coGia={Boolean(ld && "gia" in ld)}
              ton={ton}
            />
          </div>
          <ThongBao tb={l.tb} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              className={lopNut}
              disabled={l.dangGui || !dong.some((d) => d.vt && d.sl)}
            >
              {l.xacNhan ? "Lưu lần nữa" : "Lưu phiếu"}
            </button>
            {vuaLap &&
            loaiOf(vuaLap.loai) &&
            "tem" in (loaiOf(vuaLap.loai) as object) ? (
              <button
                type="button"
                className={lopNut}
                onClick={() => void inTemQr(cm, vuaLap)}
              >
                In {vuaLap.dong.length} tem QR
              </button>
            ) : null}
          </div>
        </BieuMau>
      ) : null}

      <Muc
        tieuDe="Danh sách phiếu"
        hanhDong={
          <>
            <select
              className={`${lopO} !w-auto`}
              value={locLoai}
              onChange={(e) => setLocLoai(e.target.value)}
            >
              <option value="">Mọi loại</option>
              {TEN_LOAI_PHIEU.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select
              className={`${lopO} !w-auto`}
              value={locDon}
              onChange={(e) => setLocDon(e.target.value)}
            >
              <option value="">Mọi đơn</option>
              {[
                ...new Set(
                  (du.phieukho ?? [])
                    .map((p) => p.dh)
                    .filter((x): x is string => Boolean(x)),
                ),
              ]
                .sort()
                .reverse()
                .map((d) => (
                  <option key={d}>{d}</option>
                ))}
            </select>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={chiTem}
                onChange={(e) => setChiTem(e.target.checked)}
              />{" "}
              Có tem
            </label>
          </>
        }
      >
        <Bang
          cot={[
            { ten: "Số phiếu", o: (p: PhieuKho) => p.so },
            { ten: "Ngày", o: (p) => dvn(p.ngay) },
            { ten: "Loại", o: (p) => p.loai },
            { ten: "Đối tượng", o: (p) => tenDt(cm, p.dt) },
            { ten: "Đơn", o: (p) => p.dh ?? "" },
            {
              ten: "Vật tư",
              o: (p) => (
                <span className="text-xs">
                  {p.dong
                    .map(
                      (d) => `${cm.vt.get(d.vt)?.n ?? d.vt} ${fq(d.sl ?? 0)}`,
                    )
                    .join("; ")}
                </span>
              ),
            },
            {
              ten: "Giá trị",
              o: (p) => tien(giaTriPhieu(p.dong)),
              so: (p) => giaTriPhieu(p.dong),
            },
            {
              ten: "Ghi chú",
              o: (p) => <span className="text-xs">{p.ghichu}</span>,
            },
            {
              ten: "Trạng thái",
              o: (p) =>
                p.huy ? <Nhan mau="do">Đã hủy: {p.huy.lydo}</Nhan> : null,
            },
            {
              ten: "Thao tác",
              boXuat: true,
              o: (p) => (
                <div className="flex gap-1">
                  {!p.huy &&
                  loaiOf(p.loai) &&
                  "tem" in (loaiOf(p.loai) as object) ? (
                    <button
                      type="button"
                      className={lopNutNho}
                      onClick={() => void inTemQr(cm, p)}
                    >
                      In tem
                    </button>
                  ) : null}
                  {!p.huy && coQuyen(nguoi.vaitro, "kho") ? (
                    <NutGhi nguyHiem onClick={() => setHuyPk(p.so)}>
                      Hủy
                    </NutGhi>
                  ) : null}
                </div>
              ),
            },
          ]}
          dong={ds}
          khoa={(p) => p._id}
          rong="Chưa có phiếu kho nào trên Sổ tay."
          toiDa={300}
        />
      </Muc>
      <Hop
        mo={huyPk !== null}
        tieuDe={`Hủy phiếu ${huyPk ?? ""}`}
        onDong={() => setHuyPk(null)}
      >
        {huyPk ? (
          <LyDo
            key={huyPk}
            lenh="huyPhieu"
            khoaId="so"
            id={huyPk}
            onXong={() => setHuyPk(null)}
          />
        ) : null}
      </Hop>
    </div>
  );
}

export function TabTon() {
  const { du } = useSo();
  const ton = useTon();
  const [kho, setKho] = useState<"" | "S" | "N">("");
  const [tim, setTim] = useState("");
  const [loc, setLoc] = useState<"" | "canhbao" | "conhang">("");
  useBoLoc(
    [
      kho ? KHO_VT[kho] : "",
      tim ? `Tìm: ${tim}` : "",
      loc === "canhbao"
        ? "Chỉ cảnh báo"
        : loc === "conhang"
          ? "Chỉ còn hàng"
          : "",
    ]
      .filter(Boolean)
      .join(" · "),
  );
  const ds = (du.vattu ?? [])
    .map((v) => ({ v, ton: ton.get(v._id) ?? 0 }))
    .map((x) => ({ ...x, st: stat(x.ton, x.v) }))
    .filter(
      (x) =>
        (!kho || x.v.k === kho) &&
        khop(tim, x.v._id, x.v.n, x.v.g) &&
        (loc !== "canhbao" || x.st !== "ok") &&
        (loc !== "conhang" || x.ton > 0),
    )
    .sort(
      (a, b) =>
        (a.v.k ?? "").localeCompare(b.v.k ?? "") ||
        (a.v.g ?? "").localeCompare(b.v.g ?? "", "vi") ||
        a.v._id.localeCompare(b.v._id),
    );
  const giaTri = (x: { v: VatTu; ton: number }) =>
    Math.round(x.ton * (x.v.gv ?? 0));
  const chot = du.sodu?.ngay;
  return (
    <div>
      <DaiThe>
        <The nhan="Số vật tư" giaTri={String(ds.length)} />
        <The
          nhan="Cảnh báo đỏ"
          giaTri={String(
            ds.filter((x) => x.st === "do" || x.st === "am").length,
          )}
          mau="do"
        />
        <The
          nhan="Cảnh báo vàng"
          giaTri={String(ds.filter((x) => x.st === "vang").length)}
          mau="vang"
        />
        <The
          nhan="Tổng giá trị tồn"
          giaTri={`${tien(tong(ds.map(giaTri)))} đ`}
        />
      </DaiThe>
      <Muc
        tieuDe="Tồn kho"
        phu={`Tồn = tồn chốt ${chot ? dvn(chot) : "(chưa chốt)"} + nhập − xuất trên sổ chung. Sơn dưới 400 kg báo vàng, dưới 200 kg báo đỏ; dung môi dưới 200 kg báo vàng.`}
        hanhDong={
          <>
            <select
              className={`${lopO} !w-auto`}
              value={kho}
              onChange={(e) => setKho(e.target.value as typeof kho)}
            >
              <option value="">Mọi kho</option>
              <option value="S">Kho sơn</option>
              <option value="N">Kho NVL</option>
            </select>
            <select
              className={`${lopO} !w-auto`}
              value={loc}
              onChange={(e) => setLoc(e.target.value as typeof loc)}
            >
              <option value="">Tất cả</option>
              <option value="canhbao">Chỉ cảnh báo</option>
              <option value="conhang">Chỉ còn hàng</option>
            </select>
            <OTim giaTri={tim} onDoi={setTim} goiY="Mã, tên, nhóm" />
          </>
        }
      >
        <Bang
          cot={[
            { ten: "Mã", o: (x: (typeof ds)[number]) => x.v._id },
            { ten: "Tên", o: (x) => x.v.n ?? "" },
            { ten: "Nhóm", o: (x) => x.v.g ?? "" },
            { ten: "ĐVT", o: (x) => x.v.u ?? "" },
            { ten: "Tồn", o: (x) => <b>{fq(x.ton)}</b>, so: (x) => x.ton },
            {
              ten: "Mức cảnh báo",
              o: (x) => (
                <span className="flex flex-wrap items-center gap-1 text-xs">
                  {[
                    x.v.y !== undefined ? `vàng < ${fq(x.v.y)}` : "",
                    x.v.r !== undefined ? `đỏ < ${fq(x.v.r)}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  <NhanKho st={x.st} />
                </span>
              ),
            },
            { ten: "Giá vốn", o: (x) => tien(x.v.gv), so: (x) => x.v.gv ?? 0 },
            { ten: "Giá trị tồn", o: (x) => tien(giaTri(x)), so: giaTri },
          ]}
          dong={ds}
          khoa={(x) => x.v._id}
          rong="Không có vật tư nào khớp bộ lọc."
          tong={[
            { text: "Tổng" },
            null,
            null,
            null,
            null,
            null,
            null,
            { so: tong(ds.map(giaTri)) },
          ]}
        />
      </Muc>
    </div>
  );
}

export function TabMuaVt() {
  const { du, cm, nguoi } = useSo();
  const ton = useTon();
  const [f, setF] = useState({ ncc: "", han: "", ghichu: "" });
  const [dong, setDong] = useState<DongVatTu[]>([{ vt: "" }]);
  const [hop, setHop] = useState<{ loai: "nhan" | "huy"; dm: DonMua } | null>(
    null,
  );
  const l = useLenh("datMua");
  useBoLoc("");
  const dangDat = (du.donmua ?? []).filter((d) => d.tt === "dat" && !d.huy);
  const coDon = new Set(dangDat.flatMap((d) => d.dong.map((x) => x.vt)));
  const goiY = (du.vattu ?? [])
    .map((v) => ({ v, ton: ton.get(v._id) ?? 0 }))
    .map((x) => ({ ...x, st: stat(x.ton, x.v) }))
    .filter((x) => x.st !== "ok")
    .sort(
      (a, b) =>
        (a.st === "vang" ? 1 : 0) - (b.st === "vang" ? 1 : 0) ||
        a.v._id.localeCompare(b.v._id),
    );
  const duocMua = coQuyen(nguoi.vaitro, "muavt");

  return (
    <div>
      <Muc
        tieuDe="Gợi ý cần mua"
        phu="Vật tư đang cảnh báo đỏ / vàng; đánh dấu những vật tư đang có đơn đặt."
      >
        <Bang
          cot={[
            { ten: "Mã", o: (x: (typeof goiY)[number]) => x.v._id },
            { ten: "Tên", o: (x) => x.v.n ?? "" },
            {
              ten: "Tồn",
              o: (x) => `${fq(x.ton)} ${x.v.u ?? ""}`,
              so: (x) => x.ton,
            },
            { ten: "Mức", o: (x) => <NhanKho st={x.st} /> },
            {
              ten: "Đơn đặt",
              o: (x) =>
                coDon.has(x.v._id) ? (
                  <Nhan mau="xanh">đang có đơn đặt</Nhan>
                ) : (
                  ""
                ),
            },
            {
              ten: "Thêm",
              boXuat: true,
              o: (x) =>
                duocMua ? (
                  <NutGhi
                    onClick={() =>
                      setDong([
                        ...dong.filter((d) => d.vt),
                        { vt: x.v._id, ...(x.v.gv ? { dg: x.v.gv } : {}) },
                      ])
                    }
                  >
                    + Vào đơn
                  </NutGhi>
                ) : null,
            },
          ]}
          dong={goiY}
          khoa={(x) => x.v._id}
          rong="Không có vật tư nào cần mua."
          toiDa={200}
        />
      </Muc>
      {duocMua ? (
        <BieuMau
          tieuDe="Lập đơn đặt mua"
          onSubmit={() =>
            void l
              .chay(
                {
                  ...f,
                  dong: dong
                    .filter((d) => d.vt)
                    .map((d) => ({ vt: d.vt, sl: d.sl ?? 0, dg: d.dg })),
                },
                "Đã lập đơn đặt mua.",
              )
              .then((ok) => ok && setDong([{ vt: "" }]))
          }
        >
          <Luoi cot={4}>
            <O nhan="Nhà cung cấp" rong>
              <DtSelect
                giaTri={f.ncc}
                onChon={(ncc) => setF({ ...f, ncc })}
                loc={{ l: ["Nhà cung cấp"] }}
                macDinh={{ l: "Nhà cung cấp", g: "Vật tư" }}
              />
            </O>
            <O nhan="Hạn giao">
              <input
                type="date"
                className={lopO}
                value={f.han}
                onChange={(e) => setF({ ...f, han: e.target.value })}
              />
            </O>
            <O nhan="Ghi chú">
              <input
                className={lopO}
                value={f.ghichu}
                onChange={(e) => setF({ ...f, ghichu: e.target.value })}
              />
            </O>
          </Luoi>
          <div className="mt-3">
            <DongVt dong={dong} onDoi={setDong} coGia ton={ton} />
          </div>
          <p className="mt-2 text-sm">
            Tổng tiền: <b>{tien(giaTriPhieu(dong))} đ</b>
          </p>
          <ThongBao tb={l.tb} />
          <div className="mt-3">
            <button
              type="submit"
              className={lopNut}
              disabled={l.dangGui || !f.ncc || !dong.some((d) => d.vt && d.sl)}
            >
              Lập đơn đặt mua
            </button>
          </div>
        </BieuMau>
      ) : null}
      <Muc tieuDe="Đơn đang đặt">
        <Bang
          cot={[
            { ten: "Số", o: (d: DonMua) => d.so },
            { ten: "Ngày", o: (d) => dvn(d.ngay) },
            { ten: "Nhà cung cấp", o: (d) => tenDt(cm, d.ncc) },
            {
              ten: "Hạn",
              o: (d) =>
                d.han ? (
                  <span>
                    {dvn(d.han)}{" "}
                    {d.han < cm.hom ? <Nhan mau="do">trễ</Nhan> : null}
                  </span>
                ) : (
                  ""
                ),
            },
            {
              ten: "Vật tư",
              o: (d) => (
                <span className="text-xs">
                  {d.dong
                    .map(
                      (x) => `${cm.vt.get(x.vt)?.n ?? x.vt} ${fq(x.sl ?? 0)}`,
                    )
                    .join("; ")}
                </span>
              ),
            },
            {
              ten: "Tổng tiền",
              o: (d) => tien(giaTriPhieu(d.dong)),
              so: (d) => giaTriPhieu(d.dong),
            },
            {
              ten: "Thao tác",
              boXuat: true,
              o: (d) =>
                duocMua ? (
                  <div className="flex gap-1">
                    <NutGhi onClick={() => setHop({ loai: "nhan", dm: d })}>
                      Nhận hàng
                    </NutGhi>
                    <NutGhi
                      nguyHiem
                      onClick={() => setHop({ loai: "huy", dm: d })}
                    >
                      Hủy
                    </NutGhi>
                  </div>
                ) : null,
            },
          ]}
          dong={dangDat}
          khoa={(d) => d._id}
          rong="Không có đơn nào đang đặt."
        />
      </Muc>
      <Muc tieuDe="Đơn đã nhận gần đây">
        <Bang
          cot={[
            { ten: "Số", o: (d: DonMua) => d.so },
            { ten: "Nhà cung cấp", o: (d) => tenDt(cm, d.ncc) },
            { ten: "Ngày nhận", o: (d) => dvn(d.nhan?.ngay) },
            { ten: "Phiếu nhập", o: (d) => d.nhan?.phieu ?? "" },
            {
              ten: "Tổng tiền",
              o: (d) => tien(giaTriPhieu(d.dong)),
              so: (d) => giaTriPhieu(d.dong),
            },
          ]}
          dong={(du.donmua ?? [])
            .filter((d) => d.tt === "nhan")
            .sort((a, b) =>
              (b.nhan?.ngay ?? "").localeCompare(a.nhan?.ngay ?? ""),
            )
            .slice(0, 50)}
          khoa={(d) => d._id}
          rong="Chưa nhận đơn nào."
        />
      </Muc>
      <Hop
        mo={hop !== null}
        tieuDe={
          hop
            ? `${hop.loai === "nhan" ? "Nhận hàng" : "Hủy"} đơn mua ${hop.dm.so}`
            : ""
        }
        onDong={() => setHop(null)}
      >
        {hop?.loai === "nhan" ? (
          <NhanDonMua key={hop.dm.so} dm={hop.dm} onXong={() => setHop(null)} />
        ) : null}
        {hop?.loai === "huy" ? (
          <LyDo
            key={hop.dm.so}
            lenh="huyDonMua"
            khoaId="so"
            id={hop.dm.so}
            onXong={() => setHop(null)}
          />
        ) : null}
      </Hop>
    </div>
  );
}

function NhanDonMua({ dm, onXong }: { dm: DonMua; onXong: () => void }) {
  const [ngay, setNgay] = useState(today());
  const l = useLenh("nhanDonMua");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void l
          .chay({ so: dm.so, ngay }, "Đã nhận hàng: tạo phiếu Nhập mua.")
          .then((ok) => ok && onXong());
      }}
    >
      <p className="mb-2 text-sm">
        Sổ sẽ tự tạo phiếu “Nhập mua” cho {dm.dong.length} dòng vật tư và chuyển
        đơn sang đã nhận.
      </p>
      <O nhan="Ngày nhận">
        <input
          type="date"
          className={lopO}
          value={ngay}
          onChange={(e) => setNgay(e.target.value)}
          required
        />
      </O>
      <ThongBao tb={l.tb} />
      <div className="mt-3 flex justify-end">
        <button type="submit" className={lopNut} disabled={l.dangGui}>
          Nhận hàng
        </button>
      </div>
    </form>
  );
}
