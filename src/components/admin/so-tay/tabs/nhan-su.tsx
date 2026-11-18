"use client";

import { useMemo, useState } from "react";

import { coQuyen } from "@/domains/so-tay/hang-so";
import type { DoiTuong, Luong, PhanCong } from "@/domains/so-tay/kieu";
import { daNhan, tenDt, tong } from "@/domains/so-tay/nghiep-vu/chi-muc";
import { soSanhSo } from "@/domains/so-tay/nghiep-vu/danh-muc";
import { dvn, fq, today } from "@/domains/so-tay/tien-ich";

import {
  Bang,
  BieuMau,
  DaiThe,
  lopNut,
  lopO,
  Muc,
  Nhan,
  O,
  OSo,
  The,
  ThongBao,
  tien,
  useLenh,
  useSo,
} from "../ui";
import { useBoLoc } from "./chung";

/**
 * Bản người dùng đang sửa của một danh sách lấy từ dữ liệu: giữ bản sửa khi
 * dữ liệu gốc không đổi, tự lấy lại bản mới khi dữ liệu gốc đổi.
 */
function useBanSua<T>(banDau: T[]): [T[], (d: T[]) => void] {
  const khoa = JSON.stringify(banDau);
  const [sua, setSua] = useState<{ khoa: string; dong: T[] } | null>(null);
  const dong = sua && sua.khoa === khoa ? sua.dong : banDau;
  return [dong, (d) => setSua({ khoa, dong: d })];
}

type DongCong = {
  nv: string;
  cong: number;
  tc?: number | undefined;
  ghichu: string;
};

export function TabNhanCong() {
  const { du, cm, nguoi } = useSo();
  const [ngay, setNgay] = useState(today());
  const [thang, setThang] = useState(today().slice(0, 7));
  useBoLoc(`Ngày ${dvn(ngay)} · tháng ${thang.slice(5)}/${thang.slice(0, 4)}`);
  const nhanSu = useMemo(
    () =>
      (du.doituong ?? [])
        .filter((d) => d.l === "Nhân sự nhà máy" && !d.luu)
        .sort((a, b) => a.n.localeCompare(b.n, "vi")),
    [du.doituong],
  );
  const cc = useMemo(() => du.chamcong ?? [], [du.chamcong]);
  const daCham = cc.filter((c) => c.ngay === ngay);
  const banDau = useMemo<DongCong[]>(
    () =>
      nhanSu.map((d) => {
        const c = cc.find((x) => x.ngay === ngay && x.nv === d._id);
        return {
          nv: d._id,
          cong: c?.cong ?? 1,
          ...(c?.tc ? { tc: c.tc } : {}),
          ghichu: c?.ghichu ?? "",
        };
      }),
    [cc, ngay, nhanSu],
  );
  const [dong, setDong] = useBanSua(banDau);
  const l = useLenh("luuChamCong");

  const tongThang = nhanSu.map((d) => {
    const ds = cc.filter((c) => c.nv === d._id && c.ngay.startsWith(thang));
    return {
      d,
      cong: tong(ds.map((c) => c.cong ?? 0)),
      tc: tong(ds.map((c) => c.tc ?? 0)),
      ngay: ds.length,
    };
  });
  const viecIn = [...cm.pcTheoDon.values()]
    .flat()
    .filter(
      (p) =>
        (p.khau === "In tại nhà máy" || p.khau === "Kiểm hàng") &&
        cm.dt.get(p.dt ?? "")?.l === "Nhân sự nhà máy" &&
        daNhan(cm, p._id) < (p.sl ?? 0),
    );

  return (
    <div>
      {coQuyen(nguoi.vaitro, "nhancong") ? (
        <BieuMau
          tieuDe="Chấm công theo ngày"
          phu={
            daCham.length
              ? `Ngày ${dvn(ngay)} đã chấm ${daCham.length} người. Lưu lại sẽ ghi đè.`
              : undefined
          }
          onSubmit={() =>
            void l.chay(
              {
                ngay,
                dong: dong.map((x) => ({
                  nv: x.nv,
                  cong: x.cong,
                  tc: x.tc ?? 0,
                  ghichu: x.ghichu,
                })),
              },
              `Đã lưu chấm công ngày ${dvn(ngay)}.`,
            )
          }
        >
          <div className="mb-3 max-w-48">
            <O nhan="Ngày">
              <input
                type="date"
                className={lopO}
                value={ngay}
                onChange={(e) => setNgay(e.target.value)}
              />
            </O>
          </div>
          <div className="space-y-1.5">
            {dong.map((x, i) => {
              const cu = [1, 0.5, 0].includes(x.cong) ? null : x.cong;
              return (
                <div
                  key={x.nv}
                  className="grid grid-cols-1 items-center gap-2 text-sm sm:grid-cols-[14rem_10rem_7rem_1fr]"
                >
                  <span>{tenDt(cm, x.nv)}</span>
                  <select
                    className={lopO}
                    value={String(x.cong)}
                    onChange={(e) =>
                      setDong(
                        dong.map((y, j) =>
                          j === i ? { ...y, cong: Number(e.target.value) } : y,
                        ),
                      )
                    }
                  >
                    <option value="1">Cả ngày</option>
                    <option value="0.5">Nửa ngày</option>
                    <option value="0">Nghỉ</option>
                    {cu !== null ? (
                      <option value={String(cu)}>{fq(cu)} công</option>
                    ) : null}
                  </select>
                  <OSo
                    giaTri={x.tc}
                    thapPhan
                    placeholder="Giờ TC"
                    onDoi={(v) =>
                      setDong(
                        dong.map((y, j) =>
                          j === i
                            ? {
                                ...y,
                                ...(v === undefined
                                  ? { tc: undefined }
                                  : { tc: v }),
                              }
                            : y,
                        ),
                      )
                    }
                  />
                  <input
                    className={lopO}
                    placeholder="Ghi chú"
                    value={x.ghichu}
                    onChange={(e) =>
                      setDong(
                        dong.map((y, j) =>
                          j === i ? { ...y, ghichu: e.target.value } : y,
                        ),
                      )
                    }
                  />
                </div>
              );
            })}
          </div>
          <ThongBao tb={l.tb} />
          <div className="mt-3">
            <button
              type="submit"
              className={lopNut}
              disabled={l.dangGui || !dong.length}
            >
              Lưu chấm công ngày {dvn(ngay)}
            </button>
          </div>
        </BieuMau>
      ) : null}

      <Muc
        tieuDe={`Tổng tháng ${thang.slice(5)}/${thang.slice(0, 4)}`}
        hanhDong={
          <input
            type="month"
            className={`${lopO} !w-40`}
            value={thang}
            onChange={(e) => setThang(e.target.value)}
          />
        }
      >
        <Bang
          cot={[
            { ten: "Họ tên", o: (r: (typeof tongThang)[number]) => r.d.n },
            { ten: "Nhóm", o: (r) => r.d.g ?? "" },
            { ten: "Ngày chấm", o: (r) => String(r.ngay), so: (r) => r.ngay },
            { ten: "Ngày công", o: (r) => fq(r.cong), so: (r) => r.cong },
            { ten: "Giờ tăng ca", o: (r) => fq(r.tc), so: (r) => r.tc },
          ]}
          dong={tongThang}
          khoa={(r) => r.d._id}
          rong="Chưa có nhân sự nhà máy trong danh mục."
          tong={[
            { text: "Tổng" },
            null,
            null,
            { so: tong(tongThang.map((r) => r.cong)) },
            { so: tong(tongThang.map((r) => r.tc)) },
          ]}
        />
      </Muc>

      <Muc tieuDe="Việc in đang giao">
        <Bang
          cot={[
            { ten: "Đơn", o: (p: PhanCong) => p.dh },
            { ten: "Mã hàng", o: (p) => p.ma ?? "" },
            { ten: "Khâu", o: (p) => p.khau },
            { ten: "Người làm", o: (p) => tenDt(cm, p.dt) },
            {
              ten: "SL",
              o: (p) => `${fq(daNhan(cm, p._id))} / ${fq(p.sl ?? 0)}`,
            },
            {
              ten: "Hạn",
              o: (p) =>
                p.han ? (
                  <span>
                    {dvn(p.han)}{" "}
                    {p.han < cm.hom ? <Nhan mau="do">trễ</Nhan> : null}
                  </span>
                ) : (
                  ""
                ),
            },
          ]}
          dong={viecIn}
          khoa={(p) => p._id}
          rong="Không có việc in nào đang giao."
        />
      </Muc>
    </div>
  );
}

type DongVp = {
  nv: string;
  luong?: number | undefined;
  congviec: string;
  ghichu: string;
};

export function TabNhanCongVp() {
  const { du, nguoi } = useSo();
  useBoLoc("");
  const nhanSu = useMemo(
    () =>
      (du.doituong ?? [])
        .filter((d) => d.l === "Nhân sự văn phòng" && !d.luu)
        .sort(soSanhSo),
    [du.doituong],
  );
  const banDau = useMemo<DongVp[]>(
    () =>
      nhanSu.map((d) => {
        const v = (du.nhanvienvp ?? []).find((x) => x.nv === d._id);
        return {
          nv: d._id,
          ...(v?.luong !== undefined ? { luong: v.luong } : {}),
          congviec: v?.congviec ?? d.g ?? "",
          ghichu: v?.ghichu ?? "",
        };
      }),
    [du.nhanvienvp, nhanSu],
  );
  const [dong, setDong] = useBanSua(banDau);
  const thucNhan = (nv: string) => {
    const ls = (du.luong ?? [])
      .filter((l) => l.nv === nv)
      .sort((a, b) => b.thang.localeCompare(a.thang));
    return ls[0];
  };
  const l = useLenh("luuLuongVp");
  const ten = (nv: string) => nhanSu.find((d) => d._id === nv)?.n ?? nv;

  return (
    <div>
      <p className="mb-3 text-sm text-[#6E6563]">
        Nhân viên văn phòng hưởng lương cố định, làm việc chủ yếu online: không
        chấm công.
      </p>
      {coQuyen(nguoi.vaitro, "nhancongvp") ? (
        <BieuMau
          tieuDe="Lương cố định"
          onSubmit={() =>
            void l.chay(
              { dong: dong.map((x) => ({ ...x, luong: x.luong })) },
              "Đã lưu lương cố định.",
            )
          }
        >
          <div className="space-y-1.5">
            {dong.map((x, i) => (
              <div
                key={x.nv}
                className="grid grid-cols-1 items-center gap-2 text-sm sm:grid-cols-[14rem_1fr_10rem_1fr]"
              >
                <span>{ten(x.nv)}</span>
                <input
                  className={lopO}
                  placeholder="Bộ phận / công việc"
                  value={x.congviec}
                  onChange={(e) =>
                    setDong(
                      dong.map((y, j) =>
                        j === i ? { ...y, congviec: e.target.value } : y,
                      ),
                    )
                  }
                />
                <OSo
                  giaTri={x.luong}
                  tienTe
                  placeholder="Lương / tháng"
                  onDoi={(v) =>
                    setDong(
                      dong.map((y, j) =>
                        j === i
                          ? {
                              ...y,
                              ...(v === undefined
                                ? { luong: undefined }
                                : { luong: v }),
                            }
                          : y,
                      ),
                    )
                  }
                />
                <input
                  className={lopO}
                  placeholder="Ghi chú"
                  value={x.ghichu}
                  onChange={(e) =>
                    setDong(
                      dong.map((y, j) =>
                        j === i ? { ...y, ghichu: e.target.value } : y,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </div>
          <ThongBao tb={l.tb} />
          <div className="mt-3">
            <button
              type="submit"
              className={lopNut}
              disabled={l.dangGui || !dong.length}
            >
              Lưu lương cố định
            </button>
          </div>
        </BieuMau>
      ) : null}
      <Muc tieuDe="Nhân sự văn phòng">
        <Bang
          cot={[
            { ten: "Họ tên", o: (d: DoiTuong) => d.n },
            {
              ten: "Bộ phận / công việc",
              o: (d) =>
                (du.nhanvienvp ?? []).find((x) => x.nv === d._id)?.congviec ||
                d.g ||
                "",
            },
            {
              ten: "Lương cố định / tháng",
              o: (d) =>
                tien((du.nhanvienvp ?? []).find((x) => x.nv === d._id)?.luong),
              so: (d) =>
                (du.nhanvienvp ?? []).find((x) => x.nv === d._id)?.luong ?? 0,
            },
            {
              ten: "Ghi chú",
              o: (d) =>
                (du.nhanvienvp ?? []).find((x) => x.nv === d._id)?.ghichu ?? "",
            },
            {
              ten: "Thực nhận tháng gần nhất",
              o: (d) => {
                const t = thucNhan(d._id);
                return t
                  ? `${tien(t.thuc_nhan)} (${t.thang.slice(5)}/${t.thang.slice(0, 4)})`
                  : "";
              },
              so: (d) => thucNhan(d._id)?.thuc_nhan ?? null,
            },
          ]}
          dong={nhanSu}
          khoa={(d) => d._id}
          rong="Chưa có nhân sự văn phòng trong danh mục."
        />
      </Muc>
    </div>
  );
}

export function TabBangLuong() {
  const { du } = useSo();
  const thangs = useMemo(
    () => [...new Set((du.luong ?? []).map((l) => l.thang))].sort().reverse(),
    [du.luong],
  );
  const [thang, setThang] = useState("");
  const [khoi, setKhoi] = useState<"" | "Nhà máy" | "Văn phòng">("");
  const chon = thang || thangs[0] || "";
  useBoLoc(
    `Tháng ${chon.slice(5)}/${chon.slice(0, 4)}${khoi ? ` · ${khoi}` : ""}`,
  );
  const ds = (du.luong ?? []).filter(
    (l) => l.thang === chon && (!khoi || l.khoi === khoi),
  );
  const khoiDs = (["Nhà máy", "Văn phòng"] as const).filter(
    (k) => !khoi || k === khoi,
  );
  const cot = [
    { ten: "Họ tên", o: (r: Luong) => r.ten ?? r.nv },
    { ten: "Khối", o: (r: Luong) => r.khoi ?? "" },
    {
      ten: "Lương/công",
      o: (r: Luong) => tien(r.muc),
      so: (r: Luong) => r.muc ?? 0,
    },
    {
      ten: "Tổng công",
      o: (r: Luong) => fq(r.tong_cong ?? 0),
      so: (r: Luong) => r.tong_cong ?? 0,
    },
    {
      ten: "Giờ làm thêm",
      o: (r: Luong) => fq((r.gio_tc ?? 0) + (r.gio_tc_cn ?? 0)),
      so: (r: Luong) => (r.gio_tc ?? 0) + (r.gio_tc_cn ?? 0),
    },
    {
      ten: "Tiền lương",
      o: (r: Luong) => tien(r.tien_luong),
      so: (r: Luong) => r.tien_luong ?? 0,
    },
    {
      ten: "Phụ cấp",
      o: (r: Luong) => tien(r.phucap),
      so: (r: Luong) => r.phucap ?? 0,
    },
    {
      ten: "Ăn trưa",
      o: (r: Luong) => tien(r.an_trua),
      so: (r: Luong) => r.an_trua ?? 0,
    },
    {
      ten: "Đã tạm ứng",
      o: (r: Luong) => tien(r.tam_ung),
      so: (r: Luong) => r.tam_ung ?? 0,
    },
    {
      ten: "BH trừ vào lương",
      o: (r: Luong) => tien(r.bh_nld),
      so: (r: Luong) => r.bh_nld ?? 0,
    },
    {
      ten: "Thực nhận",
      o: (r: Luong) => <b>{tien(r.thuc_nhan)}</b>,
      so: (r: Luong) => r.thuc_nhan ?? 0,
    },
  ];
  const tongDong = (xs: Luong[], nhan: string) => [
    { text: nhan },
    null,
    null,
    null,
    null,
    { so: tong(xs.map((r) => r.tien_luong ?? 0)) },
    { so: tong(xs.map((r) => r.phucap ?? 0)) },
    { so: tong(xs.map((r) => r.an_trua ?? 0)) },
    { so: tong(xs.map((r) => r.tam_ung ?? 0)) },
    { so: tong(xs.map((r) => r.bh_nld ?? 0)) },
    { so: tong(xs.map((r) => r.thuc_nhan ?? 0)) },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <select
          className={`${lopO} !w-auto`}
          value={chon}
          onChange={(e) => setThang(e.target.value)}
        >
          {thangs.length === 0 ? (
            <option value="">Chưa có bảng lương</option>
          ) : null}
          {thangs.map((t) => (
            <option key={t} value={t}>
              Tháng {t.slice(5)}/{t.slice(0, 4)}
            </option>
          ))}
        </select>
        <select
          className={`${lopO} !w-auto`}
          value={khoi}
          onChange={(e) => setKhoi(e.target.value as typeof khoi)}
        >
          <option value="">Tất cả</option>
          <option>Nhà máy</option>
          <option>Văn phòng</option>
        </select>
      </div>
      <DaiThe>
        <The nhan="Số người" giaTri={String(ds.length)} />
        <The
          nhan="Tổng tiền lương"
          giaTri={`${tien(tong(ds.map((r) => r.tien_luong ?? 0)))} đ`}
        />
        <The
          nhan="Tổng thực nhận"
          giaTri={`${tien(tong(ds.map((r) => r.thuc_nhan ?? 0)))} đ`}
        />
      </DaiThe>
      {khoiDs.map((k) => {
        const xs = ds
          .filter((r) => r.khoi === k)
          .sort((a, b) => (a.ten ?? "").localeCompare(b.ten ?? "", "vi"));
        return (
          <Muc key={k} tieuDe={`Khối ${k}`}>
            <Bang
              cot={cot}
              dong={xs}
              khoa={(r) => r._id}
              rong="Không có dữ liệu."
              tong={tongDong(xs, `Cộng khối ${k}`)}
            />
          </Muc>
        );
      })}
      {!khoi && ds.length ? (
        <Muc tieuDe="Tổng cộng">
          <Bang
            cot={cot}
            dong={[]}
            khoa={(r) => r._id}
            rong=""
            tong={tongDong(ds, "Tổng cộng")}
          />
        </Muc>
      ) : null}
      <p className="text-xs text-[#6E6563]">
        Giai đoạn này chỉ xem; bảng lương nạp từ file bảng lương tổng hợp.
      </p>
    </div>
  );
}
