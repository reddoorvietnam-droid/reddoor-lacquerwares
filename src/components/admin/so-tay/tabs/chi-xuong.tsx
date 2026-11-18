"use client";

import { useState } from "react";

import { coQuyen, LOAI_CHI } from "@/domains/so-tay/hang-so";
import type { ChiXuong } from "@/domains/so-tay/kieu";
import { tong } from "@/domains/so-tay/nghiep-vu/chi-muc";
import {
  canDuyet,
  canhBaoChiaNho,
  quyXuong,
  tongTheoLoai,
} from "@/domains/so-tay/nghiep-vu/chi-xuong";
import { dvn, today } from "@/domains/so-tay/tien-ich";

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
import { useBoLoc } from "./chung";
import { LyDo } from "./san-xuat";

function NhanTt({ c }: { c: ChiXuong }) {
  if (c.kieu === "nap") return <Nhan mau="xanh">Nạp quỹ</Nhan>;
  if (c.tt === "dachi") return <Nhan mau="xanh">Đã chi</Nhan>;
  if (c.tt === "tuchoi")
    return <Nhan mau="do">Không duyệt: {c.tuchoi?.lydo}</Nhan>;
  if (c.duyet) return <Nhan mau="vang">Đã duyệt, chờ chi</Nhan>;
  return <Nhan mau="vang">Chờ Giám đốc duyệt</Nhan>;
}

export function TabChiXuong() {
  const { du, cm, nguoi } = useSo();
  const ds = du.chixuong ?? [];
  const quy = quyXuong(ds);
  const thang = cm.hom.slice(0, 7);
  useBoLoc(`Tháng ${thang.slice(5)}/${thang.slice(0, 4)}`);
  const [khongDuyet, setKhongDuyet] = useState<string | null>(null);
  const duyet = useLenh("duyetChi");
  const daChi = useLenh("daChiXuong");
  const cho = ds.filter((c) => c.kieu === "chi" && c.tt === "cho");
  const chiaNho = canhBaoChiaNho(ds);
  const theoLoai = [...tongTheoLoai(ds, thang).entries()];
  const sapXep = [...ds].sort(
    (a, b) =>
      b.ngay.localeCompare(a.ngay) || (b.at ?? "").localeCompare(a.at ?? ""),
  );

  return (
    <div>
      <DaiThe>
        <The nhan="Đã nạp" giaTri={`${tien(quy.nap)} đ`} />
        <The nhan="Đã chi" giaTri={`${tien(quy.chi)} đ`} />
        <The
          nhan="Quỹ còn lại"
          giaTri={`${tien(quy.con)} đ`}
          mau={quy.con < 0 ? "do" : "xanh"}
        />
        <The
          nhan="Chờ Giám đốc duyệt"
          giaTri={String(cho.filter((c) => !c.duyet).length)}
          mau={cho.length ? "vang" : undefined}
        />
      </DaiThe>
      {coQuyen(nguoi.vaitro, "chixuong") ? <FormChi /> : null}
      {nguoi.vaitro === "ketoancty" || nguoi.vaitro === "quanly" ? (
        <NapQuy />
      ) : null}

      <Muc
        tieuDe="Chờ Giám đốc duyệt"
        phu="Khoản từ 1.000.000 đ phải chờ Giám đốc duyệt; duyệt xong thì quản lý xưởng bấm Đã chi."
      >
        <Bang
          cot={[
            { ten: "Ngày", o: (c: ChiXuong) => dvn(c.ngay) },
            { ten: "Loại", o: (c) => c.loai ?? "" },
            { ten: "Nội dung", o: (c) => c.nd ?? "" },
            { ten: "Người nhận", o: (c) => c.nguoinhan ?? "" },
            {
              ten: "Số tiền",
              o: (c) => <b>{tien(c.tien)}</b>,
              so: (c) => c.tien,
            },
            { ten: "Tình trạng", o: (c) => <NhanTt c={c} /> },
            {
              ten: "Thao tác",
              boXuat: true,
              o: (c) => (
                <div className="flex gap-1">
                  {!c.duyet && nguoi.vaitro === "quanly" ? (
                    <>
                      <NutGhi
                        onClick={() =>
                          void duyet.chay({ id: c._id }, "Đã duyệt.")
                        }
                      >
                        Duyệt
                      </NutGhi>
                      <NutGhi nguyHiem onClick={() => setKhongDuyet(c._id)}>
                        Không duyệt
                      </NutGhi>
                    </>
                  ) : null}
                  {c.duyet && coQuyen(nguoi.vaitro, "chixuong") ? (
                    <NutGhi
                      onClick={() =>
                        void daChi.chay(
                          { id: c._id, ngay: today() },
                          "Đã ghi đã chi.",
                        )
                      }
                    >
                      Đã chi
                    </NutGhi>
                  ) : null}
                </div>
              ),
            },
          ]}
          dong={cho}
          khoa={(c) => c._id}
          rong="Không có khoản nào chờ duyệt."
        />
        <ThongBao tb={duyet.tb ?? daChi.tb} />
      </Muc>

      {chiaNho.length ? (
        <Muc
          tieuDe="Cảnh báo chia nhỏ"
          phu="Nhiều khoản dưới 1 triệu cùng ngày, cùng người nhận mà cộng lại từ 1 triệu."
        >
          <Bang
            cot={[
              { ten: "Ngày", o: (r: (typeof chiaNho)[number]) => dvn(r.ngay) },
              { ten: "Người nhận", o: (r) => r.nguoinhan },
              { ten: "Số khoản", o: (r) => String(r.so) },
              {
                ten: "Cộng",
                o: (r) => <b className="text-[#D0342C]">{tien(r.tong)}</b>,
                so: (r) => r.tong,
              },
            ]}
            dong={chiaNho}
            khoa={(r) => `${r.ngay}-${r.nguoinhan}`}
          />
        </Muc>
      ) : null}

      <Muc
        tieuDe={`Tổng chi theo loại tháng ${thang.slice(5)}/${thang.slice(0, 4)}`}
      >
        <Bang
          cot={[
            { ten: "Loại chi", o: (r: [string, number]) => r[0] },
            { ten: "Đã chi", o: (r) => tien(r[1]), so: (r) => r[1] },
          ]}
          dong={theoLoai}
          khoa={(r) => r[0]}
          rong="Tháng này chưa chi khoản nào."
          tong={[{ text: "Tổng" }, { so: tong(theoLoai.map((r) => r[1])) }]}
        />
      </Muc>

      <Muc tieuDe="Danh sách khoản chi và nạp quỹ">
        <Bang
          cot={[
            { ten: "Ngày", o: (c: ChiXuong) => dvn(c.ngay) },
            {
              ten: "Loại",
              o: (c) => (c.kieu === "nap" ? "Nạp quỹ" : (c.loai ?? "")),
            },
            { ten: "Nội dung", o: (c) => c.nd ?? "" },
            { ten: "Người nhận", o: (c) => c.nguoinhan ?? "" },
            { ten: "Đơn", o: (c) => c.dh ?? "" },
            {
              ten: "Số tiền",
              o: (c) => tien(c.tien),
              so: (c) => (c.kieu === "nap" ? c.tien : -c.tien),
            },
            { ten: "Tình trạng", o: (c) => <NhanTt c={c} /> },
            { ten: "Ghi chú", o: (c) => c.ghichu ?? "" },
          ]}
          dong={sapXep}
          khoa={(c) => c._id}
          rong="Chưa có khoản chi nào."
          toiDa={300}
        />
      </Muc>
      <Hop
        mo={khongDuyet !== null}
        tieuDe="Không duyệt khoản chi"
        onDong={() => setKhongDuyet(null)}
      >
        {khongDuyet ? (
          <LyDo
            key={khongDuyet}
            lenh="khongDuyetChi"
            id={khongDuyet}
            nut="Không duyệt"
            onXong={() => setKhongDuyet(null)}
          />
        ) : null}
      </Hop>
    </div>
  );
}

function FormChi() {
  const { du } = useSo();
  const [f, setF] = useState<{
    ngay: string;
    loai: string;
    nd: string;
    tien?: number | undefined;
    nguoinhan: string;
    dh: string;
    ghichu: string;
  }>({
    ngay: today(),
    loai: LOAI_CHI[0],
    nd: "",
    nguoinhan: "",
    dh: "",
    ghichu: "",
  });
  const l = useLenh("chiXuong");
  const lon = f.tien !== undefined && canDuyet(f.tien);
  return (
    <BieuMau
      tieuDe="Chi tiêu xưởng"
      phu="Khoản dưới 1.000.000 đ quản lý xưởng tự chi; từ 1.000.000 đ chờ Giám đốc duyệt."
      onSubmit={() =>
        void l
          .chay(
            { ...f, tien: f.tien ?? 0 },
            lon ? "Đã gửi, chờ Giám đốc duyệt." : "Đã ghi khoản chi.",
          )
          .then(
            (ok) => ok && setF({ ...f, nd: "", tien: undefined, ghichu: "" }),
          )
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
        <O nhan="Loại chi">
          <select
            className={lopO}
            value={f.loai}
            onChange={(e) => setF({ ...f, loai: e.target.value })}
          >
            {LOAI_CHI.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </O>
        <O nhan="Nội dung" rong>
          <input
            className={lopO}
            value={f.nd}
            onChange={(e) => setF({ ...f, nd: e.target.value })}
            required
          />
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
        <O nhan="Người nhận">
          <input
            className={lopO}
            value={f.nguoinhan}
            onChange={(e) => setF({ ...f, nguoinhan: e.target.value })}
          />
        </O>
        <O nhan="Mã đơn (nếu có)">
          <select
            className={lopO}
            value={f.dh}
            onChange={(e) => setF({ ...f, dh: e.target.value })}
          >
            <option value="">—</option>
            {[...(du.donhang ?? [])]
              .sort((a, b) => b._id.localeCompare(a._id))
              .map((d) => (
                <option key={d._id} value={d._id}>
                  {d._id} {d.n ?? ""}
                </option>
              ))}
          </select>
        </O>
        <O nhan="Ghi chú">
          <input
            className={lopO}
            value={f.ghichu}
            onChange={(e) => setF({ ...f, ghichu: e.target.value })}
          />
        </O>
      </Luoi>
      {lon ? (
        <p className="mt-2 text-sm font-semibold text-[#C97F00]">
          Khoản này cần Giám đốc duyệt.
        </p>
      ) : null}
      <ThongBao tb={l.tb} />
      <div className="mt-3">
        <button
          type="submit"
          className={lopNut}
          disabled={l.dangGui || !f.tien || !f.nd.trim()}
        >
          {l.xacNhan ? "Lưu lần nữa" : lon ? "Gửi chờ duyệt" : "Ghi khoản chi"}
        </button>
      </div>
    </BieuMau>
  );
}

function NapQuy() {
  const [f, setF] = useState<{
    ngay: string;
    tien?: number | undefined;
    nd: string;
  }>({ ngay: today(), nd: "" });
  const l = useLenh("napQuy");
  return (
    <BieuMau
      tieuDe="Nạp quỹ xưởng"
      onSubmit={() =>
        void l
          .chay({ ...f, tien: f.tien ?? 0 }, "Đã nạp quỹ.")
          .then((ok) => ok && setF({ ...f, tien: undefined, nd: "" }))
      }
    >
      <Luoi cot={3}>
        <O nhan="Ngày">
          <input
            type="date"
            className={lopO}
            value={f.ngay}
            onChange={(e) => setF({ ...f, ngay: e.target.value })}
            required
          />
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
        <O nhan="Nội dung">
          <input
            className={lopO}
            value={f.nd}
            onChange={(e) => setF({ ...f, nd: e.target.value })}
            placeholder="Nạp quỹ xưởng"
          />
        </O>
      </Luoi>
      <ThongBao tb={l.tb} />
      <div className="mt-3">
        <button
          type="submit"
          className={lopNut}
          disabled={l.dangGui || !f.tien}
        >
          Nạp quỹ
        </button>
      </div>
    </BieuMau>
  );
}
