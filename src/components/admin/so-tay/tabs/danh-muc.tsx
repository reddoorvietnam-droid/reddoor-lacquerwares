"use client";

import { useState } from "react";

import {
  KHO_VT,
  ROLES,
  VAI_TRO,
  type MauTienDo,
} from "@/domains/so-tay/hang-so";
import type { DoiTuong, DonHang, TaiKhoan, VatTu } from "@/domains/so-tay/kieu";
import { soSanhSo } from "@/domains/so-tay/nghiep-vu/danh-muc";
import { fq } from "@/domains/so-tay/tien-ich";

import { HopDoiTuong } from "../dt-select";
import {
  Bang,
  BieuMau,
  Hop,
  lopNut,
  lopNutNho,
  lopNutPhu,
  lopO,
  Luoi,
  Muc,
  Nhan,
  NutGhi,
  O,
  OSo,
  ThongBao,
  tien,
  useLenh,
  useSo,
} from "../ui";
import { khop, OTim, useBoLoc } from "./chung";

export function TabDanhMuc() {
  const { nguoi } = useSo();
  useBoLoc("");
  return (
    <div>
      <TaiKhoanSo />
      <DoiTuongMuc />
      <DonHangMuc />
      <VatTuMuc />
      {nguoi.vaitro === "quanly" ? <MauTienDoMuc /> : null}
    </div>
  );
}

function TaiKhoanSo() {
  const { nguoi, du, dangSua } = useSo();
  const l = useLenh("doiVaiTro");
  const ds = [...(du.taikhoan ?? [])].sort((a, b) =>
    a.email.localeCompare(b.email),
  );
  return (
    <Muc tieuDe="Tài khoản đăng nhập" xuat={false}>
      <p className="text-sm">
        Đang đăng nhập: <b>{nguoi.ten}</b> ({nguoi.email}) · vai trò Sổ tay:{" "}
        <b>{ROLES[nguoi.vaitro]}</b>. Đăng nhập bằng Google của khu quản trị;
        vai trò lấy theo vai trò khu quản trị, Giám đốc có thể gán khác ở đây.
      </p>
      {nguoi.vaitro === "quanly" ? (
        <div className="mt-3">
          <Bang
            cot={[
              { ten: "Email", o: (t: TaiKhoan) => t.email },
              { ten: "Tên", o: (t) => t.ten ?? "" },
              {
                ten: "Vai trò Sổ tay",
                o: (t) => (
                  <select
                    className={`${lopO} !w-56`}
                    disabled={!dangSua}
                    value={t.vaitro ?? ""}
                    onChange={(e) =>
                      void l.chay(
                        { email: t.email, vaitro: e.target.value || null },
                        `Đã đổi vai trò của ${t.email}.`,
                      )
                    }
                  >
                    <option value="">Theo khu quản trị</option>
                    {VAI_TRO.map((v) => (
                      <option key={v} value={v}>
                        {ROLES[v]}
                      </option>
                    ))}
                  </select>
                ),
              },
            ]}
            dong={ds}
            khoa={(t) => t._id}
            rong="Chưa ai mở Sổ tay."
          />
          <p className="mt-1 text-xs text-[#6E6563]">
            Danh sách gồm những người đã mở Sổ tay ít nhất một lần.
          </p>
          <ThongBao tb={l.tb} />
        </div>
      ) : null}
    </Muc>
  );
}

function XoaHop({
  lenh,
  id,
  ten,
  onDong,
}: {
  lenh: string;
  id: string | null;
  ten: string;
  onDong: () => void;
}) {
  const l = useLenh(lenh);
  return (
    <Hop mo={id !== null} tieuDe={`Xóa ${ten}?`} onDong={onDong}>
      <p className="text-sm">
        Sổ sẽ kiểm tra tham chiếu trước. Nếu đang được dùng ở phiếu kho, công
        nợ, số dư… thì không xóa được; khi đó dùng Sửa.
      </p>
      <ThongBao tb={l.tb} />
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className={lopNutPhu} onClick={onDong}>
          Không
        </button>
        <button
          type="button"
          className={lopNut}
          disabled={l.dangGui || !id}
          onClick={() =>
            void l.chay({ c: id }, "Đã xóa.").then((ok) => ok && onDong())
          }
        >
          Xóa hẳn
        </button>
      </div>
    </Hop>
  );
}

function DoiTuongMuc() {
  const { du } = useSo();
  const [tim, setTim] = useState("");
  const [sua, setSua] = useState<DoiTuong | null>(null);
  const [them, setThem] = useState(false);
  const [xoa, setXoa] = useState<DoiTuong | null>(null);
  const ds = [...(du.doituong ?? [])]
    .filter(
      (d) =>
        khop(tim, d.so, d._id, d.n, d.l, d.g, d.note) ||
        (tim.trim().toLowerCase() === "axx" && d.luu),
    )
    .sort(
      (a, b) =>
        Number(Boolean(a.luu)) - Number(Boolean(b.luu)) || soSanhSo(a, b),
    );
  return (
    <Muc
      tieuDe="Đối tượng"
      phu={`${(du.doituong ?? []).length} đối tượng. Số định danh tự cấp; số đã cấp không dồn lại.`}
      hanhDong={
        <>
          <OTim giaTri={tim} onDoi={setTim} goiY="Lọc theo số, tên, loại…" />
          <NutGhi onClick={() => setThem(true)}>+ Thêm đối tượng</NutGhi>
        </>
      }
    >
      <Bang
        cot={[
          { ten: "Số", o: (d: DoiTuong) => d.so ?? (d.luu ? "Axx" : "") },
          { ten: "Mã", o: (d) => <span className="text-xs">{d._id}</span> },
          { ten: "Tên", o: (d) => d.n },
          { ten: "Loại", o: (d) => d.l },
          { ten: "Nhóm / khâu", o: (d) => d.g ?? "" },
          { ten: "Cơ sở chính", o: (d) => (d.m === 1 ? "✓" : "") },
          {
            ten: "Ghi chú",
            o: (d) => <span className="text-xs">{d.note}</span>,
          },
          {
            ten: "Sửa / Xóa",
            boXuat: true,
            o: (d) => (
              <div className="flex gap-1">
                <NutGhi onClick={() => setSua(d)}>Sửa</NutGhi>
                <NutGhi nguyHiem onClick={() => setXoa(d)}>
                  Xóa
                </NutGhi>
              </div>
            ),
          },
        ]}
        dong={ds}
        khoa={(d) => d._id}
      />
      <HopDoiTuong
        mo={sua !== null}
        {...(sua ? { cu: sua } : {})}
        onDong={() => setSua(null)}
        onXong={() => setSua(null)}
      />
      <HopDoiTuong
        mo={them}
        onDong={() => setThem(false)}
        onXong={() => setThem(false)}
      />
      <XoaHop
        lenh="xoaDoiTuong"
        id={xoa?._id ?? null}
        ten={xoa?.n ?? ""}
        onDong={() => setXoa(null)}
      />
    </Muc>
  );
}

function DonHangMuc() {
  const { du } = useSo();
  const [tim, setTim] = useState("");
  const [f, setF] = useState<{ c: string; k: string; n: string } | null>(null);
  const [moi, setMoi] = useState(false);
  const [xoa, setXoa] = useState<DonHang | null>(null);
  const l = useLenh(moi ? "taoDonHang" : "suaDonHang");
  const ds = [...(du.donhang ?? [])]
    .filter((d) => khop(tim, d._id, d.k, d.n))
    .sort((a, b) => b._id.localeCompare(a._id));
  return (
    <Muc
      tieuDe="Đơn hàng"
      phu={`${(du.donhang ?? []).length} đơn. KHO-BB = Bao bì mua dùng dần (tồn kho).`}
      hanhDong={
        <>
          <OTim giaTri={tim} onDoi={setTim} goiY="Mã đơn, khách, tên" />
          <NutGhi
            onClick={() => {
              setMoi(true);
              setF({ c: "", k: "", n: "" });
            }}
          >
            + Thêm đơn
          </NutGhi>
        </>
      }
    >
      <Bang
        cot={[
          { ten: "Mã đơn", o: (d: DonHang) => <b>{d._id}</b> },
          { ten: "Khách", o: (d) => d.k ?? "" },
          { ten: "Tên đơn", o: (d) => d.n ?? "" },
          {
            ten: "Sửa / Xóa",
            boXuat: true,
            o: (d) => (
              <div className="flex gap-1">
                <NutGhi
                  onClick={() => {
                    setMoi(false);
                    setF({ c: d._id, k: d.k ?? "", n: d.n ?? "" });
                  }}
                >
                  Sửa
                </NutGhi>
                <NutGhi nguyHiem onClick={() => setXoa(d)}>
                  Xóa
                </NutGhi>
              </div>
            ),
          },
        ]}
        dong={ds}
        khoa={(d) => d._id}
      />
      <Hop
        mo={f !== null}
        tieuDe={moi ? "Thêm đơn hàng" : `Sửa đơn ${f?.c ?? ""}`}
        onDong={() => setF(null)}
      >
        {f ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void l.chay(f, "Đã lưu.").then((ok) => ok && setF(null));
            }}
          >
            <Luoi cot={3}>
              <O nhan="Mã đơn">
                <input
                  className={lopO}
                  value={f.c}
                  disabled={!moi}
                  onChange={(e) => setF({ ...f, c: e.target.value })}
                  required
                />
              </O>
              <O nhan="Khách">
                <input
                  className={lopO}
                  value={f.k}
                  onChange={(e) => setF({ ...f, k: e.target.value })}
                />
              </O>
              <O nhan="Tên đơn">
                <input
                  className={lopO}
                  value={f.n}
                  onChange={(e) => setF({ ...f, n: e.target.value })}
                />
              </O>
            </Luoi>
            <ThongBao tb={l.tb} />
            <div className="mt-3 flex justify-end">
              <button type="submit" className={lopNut} disabled={l.dangGui}>
                Lưu
              </button>
            </div>
          </form>
        ) : null}
      </Hop>
      <XoaHop
        lenh="xoaDonHang"
        id={xoa?._id ?? null}
        ten={`đơn ${xoa?._id ?? ""}`}
        onDong={() => setXoa(null)}
      />
    </Muc>
  );
}

type FVt = {
  c: string;
  n: string;
  k: "S" | "N";
  g: string;
  u: string;
  t?: number;
  gv?: number;
  y?: number;
  r?: number;
};

function VatTuMuc() {
  const { du } = useSo();
  const [tim, setTim] = useState("");
  const [f, setF] = useState<FVt | null>(null);
  const [moi, setMoi] = useState(false);
  const [xoa, setXoa] = useState<VatTu | null>(null);
  const l = useLenh(moi ? "taoVatTu" : "suaVatTu");
  const ds = [...(du.vattu ?? [])]
    .filter((v) => khop(tim, v._id, v.n, v.g))
    .sort((a, b) => a._id.localeCompare(b._id));
  const so = (k: "t" | "gv" | "y" | "r") => (v: number | undefined) =>
    f && setF({ ...f, [k]: v });
  return (
    <Muc
      tieuDe="Vật tư"
      phu={`${(du.vattu ?? []).length} vật tư. Tồn đầu kỳ không sửa ở đây; muốn đổi thì lập phiếu kiểm kê.`}
      hanhDong={
        <>
          <OTim giaTri={tim} onDoi={setTim} goiY="Mã, tên, nhóm" />
          <NutGhi
            onClick={() => {
              setMoi(true);
              setF({ c: "", n: "", k: "S", g: "", u: "kg" });
            }}
          >
            + Thêm vật tư
          </NutGhi>
        </>
      }
    >
      <Bang
        cot={[
          { ten: "Mã", o: (v: VatTu) => v._id },
          { ten: "Tên", o: (v) => v.n ?? "" },
          { ten: "Kho", o: (v) => (v.k ? KHO_VT[v.k] : "") },
          { ten: "Nhóm", o: (v) => v.g ?? "" },
          { ten: "ĐVT", o: (v) => v.u ?? "" },
          { ten: "Tồn đầu kỳ", o: (v) => fq(v.t ?? 0), so: (v) => v.t ?? 0 },
          {
            ten: "Mức vàng / đỏ",
            o: (v) =>
              [v.y, v.r]
                .map((x) => (x === undefined ? "–" : fq(x)))
                .join(" / "),
          },
          { ten: "Giá vốn", o: (v) => tien(v.gv), so: (v) => v.gv ?? 0 },
          {
            ten: "Sửa / Xóa",
            boXuat: true,
            o: (v) => (
              <div className="flex gap-1">
                <NutGhi
                  onClick={() => {
                    setMoi(false);
                    setF({
                      c: v._id,
                      n: v.n ?? "",
                      k: v.k ?? "S",
                      g: v.g ?? "",
                      u: v.u ?? "",
                      ...(v.gv !== undefined ? { gv: v.gv } : {}),
                      ...(v.y !== undefined ? { y: v.y } : {}),
                      ...(v.r !== undefined ? { r: v.r } : {}),
                    });
                  }}
                >
                  Sửa
                </NutGhi>
                <NutGhi nguyHiem onClick={() => setXoa(v)}>
                  Xóa
                </NutGhi>
              </div>
            ),
          },
        ]}
        dong={ds}
        khoa={(v) => v._id}
        toiDa={200}
      />
      <Hop
        mo={f !== null}
        tieuDe={moi ? "Thêm vật tư" : `Sửa vật tư ${f?.c ?? ""}`}
        onDong={() => setF(null)}
        rong="max-w-2xl"
      >
        {f ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const { t, ...con } = f;
              void l
                .chay(
                  moi ? { ...con, ...(t !== undefined ? { t } : {}) } : con,
                  "Đã lưu.",
                )
                .then((ok) => ok && setF(null));
            }}
          >
            <Luoi cot={3}>
              <O nhan="Mã">
                <input
                  className={lopO}
                  value={f.c}
                  disabled={!moi}
                  onChange={(e) => setF({ ...f, c: e.target.value })}
                  required
                />
              </O>
              <O nhan="Tên" rong>
                <input
                  className={lopO}
                  value={f.n}
                  onChange={(e) => setF({ ...f, n: e.target.value })}
                />
              </O>
              <O nhan="Kho">
                <select
                  className={lopO}
                  value={f.k}
                  onChange={(e) =>
                    setF({ ...f, k: e.target.value as "S" | "N" })
                  }
                >
                  <option value="S">Kho sơn</option>
                  <option value="N">Kho NVL</option>
                </select>
              </O>
              <O nhan="Nhóm">
                <input
                  className={lopO}
                  value={f.g}
                  onChange={(e) => setF({ ...f, g: e.target.value })}
                />
              </O>
              <O nhan="ĐVT">
                <input
                  className={lopO}
                  value={f.u}
                  onChange={(e) => setF({ ...f, u: e.target.value })}
                />
              </O>
              {moi ? (
                <O nhan="Tồn đầu kỳ">
                  <OSo giaTri={f.t} onDoi={so("t")} thapPhan />
                </O>
              ) : null}
              <O nhan="Mức báo vàng">
                <OSo
                  giaTri={f.y}
                  onDoi={so("y")}
                  thapPhan
                  placeholder="Để trống = theo nhóm"
                />
              </O>
              <O nhan="Mức báo đỏ">
                <OSo giaTri={f.r} onDoi={so("r")} thapPhan />
              </O>
              <O nhan="Giá vốn (đ)">
                <OSo giaTri={f.gv} onDoi={so("gv")} tienTe />
              </O>
            </Luoi>
            <ThongBao tb={l.tb} />
            <div className="mt-3 flex justify-end">
              <button type="submit" className={lopNut} disabled={l.dangGui}>
                Lưu
              </button>
            </div>
          </form>
        ) : null}
      </Hop>
      <XoaHop
        lenh="xoaVatTu"
        id={xoa?._id ?? null}
        ten={`vật tư ${xoa?._id ?? ""}`}
        onDong={() => setXoa(null)}
      />
    </Muc>
  );
}

const MOC_KEYS = ["m1", "m2", "m3", "m4", "m5"] as const;

function MauTienDoMuc() {
  const { cm } = useSo();
  const [mau, setMau] = useState<MauTienDo[]>(cm.canhBao.mau);
  const [baoTruoc, setBaoTruoc] = useState(cm.canhBao.baoTruoc);
  const l = useLenh("suaMauTienDo");
  return (
    <BieuMau
      tieuDe="Cấu hình mẫu tiến độ"
      phu="Số ngày từng mốc. Mẫu được chọn theo số ngày từ mốc gốc tới ngày xuất (≤ “Áp dụng đến”)."
      onSubmit={() => void l.chay({ baoTruoc, mau }, "Đã lưu mẫu tiến độ.")}
    >
      <div className="mb-3 max-w-56">
        <O nhan="Báo vàng trước hạn (ngày)">
          <OSo giaTri={baoTruoc} onDoi={(v) => setBaoTruoc(v ?? 0)} />
        </O>
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="text-left text-xs text-[#6E6563]">
              <th className="px-1.5 py-1">Mẫu</th>
              <th className="px-1.5 py-1">Áp dụng đến (ngày)</th>
              {MOC_KEYS.map((k) => (
                <th key={k} className="px-1.5 py-1">
                  {k}
                </th>
              ))}
              <th className="px-1.5 py-1">m5 tối đa</th>
            </tr>
          </thead>
          <tbody>
            {mau.map((m, i) => (
              <tr key={m.ten}>
                <td className="px-1.5 py-1 font-semibold">{m.ten}</td>
                <td className="w-28 px-1.5 py-1">
                  <OSo
                    giaTri={m.den}
                    onDoi={(v) =>
                      setMau(
                        mau.map((x, j) =>
                          j === i ? { ...x, den: v ?? 0 } : x,
                        ),
                      )
                    }
                  />
                </td>
                {MOC_KEYS.map((k) => (
                  <td key={k} className="w-20 px-1.5 py-1">
                    <OSo
                      giaTri={m.ngay[k]}
                      onDoi={(v) =>
                        setMau(
                          mau.map((x, j) =>
                            j === i
                              ? { ...x, ngay: { ...x.ngay, [k]: v ?? 0 } }
                              : x,
                          ),
                        )
                      }
                    />
                  </td>
                ))}
                <td className="w-20 px-1.5 py-1">
                  <OSo
                    giaTri={m.m5max}
                    onDoi={(v) =>
                      setMau(
                        mau.map((x, j) =>
                          j === i ? { ...x, m5max: v ?? 0 } : x,
                        ),
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ThongBao tb={l.tb} />
      <div className="mt-3 flex gap-2">
        <button type="submit" className={lopNut} disabled={l.dangGui}>
          Lưu mẫu tiến độ
        </button>
        <button
          type="button"
          className={lopNutNho}
          onClick={() => {
            setMau(cm.canhBao.mau);
            setBaoTruoc(cm.canhBao.baoTruoc);
          }}
        >
          Hoàn lại
        </button>
      </div>
      <p className="mt-2 text-xs text-[#6E6563]">
        <Nhan mau="xam">Gợi ý</Nhan> Mẫu cuối nên có “Áp dụng đến” lớn (9999) để
        luôn khớp.
      </p>
    </BieuMau>
  );
}
