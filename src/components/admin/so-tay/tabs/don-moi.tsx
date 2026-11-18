"use client";

import { useState } from "react";

import type { MaHang, SanXuat } from "@/domains/so-tay/kieu";
import { docPi } from "@/domains/so-tay/nghiep-vu/doc-pi";
import { mocDon } from "@/domains/so-tay/nghiep-vu/tien-do";
import { dvn, fq } from "@/domains/so-tay/tien-ich";

import {
  Bang,
  BieuMau,
  lopNut,
  lopO,
  Luoi,
  Muc,
  Nhan,
  O,
  ThongBao,
  useLenh,
  useSo,
} from "../ui";
import { NhanMuc } from "./chung";

export function TabDonMoi() {
  const { du, cm, diTab } = useSo();
  const [items, setItems] = useState<MaHang[]>([]);
  const [tenFile, setTenFile] = useState("");
  const [loiFile, setLoiFile] = useState<string | null>(null);
  const [f, setF] = useState({ dh: "", khach: "", ten: "", ngayxuat: "" });
  const lenh = useLenh("guiDon");

  async function docFile(file: File) {
    setLoiFile(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const ten = wb.SheetNames[0];
      const ws = ten ? wb.Sheets[ten] : undefined;
      if (!ws) throw new Error("File không có sheet nào.");
      const dong = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        raw: true,
        defval: "",
      });
      setItems(docPi(dong));
      setTenFile(file.name);
    } catch (e) {
      setItems([]);
      setLoiFile(e instanceof Error ? e.message : "Không đọc được file.");
    }
  }

  const gui = async () => {
    const ok = await lenh.chay(
      {
        dh: f.dh.trim(),
        khach: f.khach,
        ten: f.ten,
        ngayxuat: f.ngayxuat,
        items,
      },
      `Đã gửi đơn ${f.dh} cho xưởng.`,
    );
    if (ok) {
      setItems([]);
      setTenFile("");
      setF({ dh: "", khach: "", ten: "", ngayxuat: "" });
    }
  };

  const daGui = [...(du.sanxuat ?? [])].sort((a, b) =>
    (b.at ?? "").localeCompare(a.at ?? ""),
  );

  return (
    <div>
      <BieuMau
        tieuDe="Nhập đơn từ file PI (Excel)"
        phu="Chỉ đọc sheet đầu, tìm dòng tiêu đề có cột Item code. Không đọc cột giá."
        onSubmit={() => void gui()}
      >
        <div className="mb-3">
          <input
            type="file"
            accept=".xlsx,.xls"
            className="text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void docFile(file);
            }}
          />
          {tenFile ? (
            <p className="mt-1 text-xs text-[#6E6563]">
              Đã đọc {tenFile}: {items.length} mã hàng.
            </p>
          ) : null}
          {loiFile ? (
            <p className="mt-1 text-sm text-[#D0342C]">{loiFile}</p>
          ) : null}
        </div>
        <Luoi cot={4}>
          <O nhan="Mã đơn (YYYY-NN)">
            <input
              className={lopO}
              value={f.dh}
              placeholder="2026-36"
              onChange={(e) => setF({ ...f, dh: e.target.value })}
              required
            />
          </O>
          <O nhan="Khách">
            <input
              className={lopO}
              value={f.khach}
              onChange={(e) => setF({ ...f, khach: e.target.value })}
              required
            />
          </O>
          <O nhan="Tên đơn">
            <input
              className={lopO}
              value={f.ten}
              placeholder="Top Cado 0126"
              onChange={(e) => setF({ ...f, ten: e.target.value })}
            />
          </O>
          <O nhan="Ngày xuất (theo PI)">
            <input
              type="date"
              className={lopO}
              value={f.ngayxuat}
              onChange={(e) => setF({ ...f, ngayxuat: e.target.value })}
              required
            />
          </O>
        </Luoi>
        {items.length ? (
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-semibold">
              Xem trước mã hàng (tick “In” nếu mã có in hoa văn tại nhà máy)
            </h4>
            <Bang
              cot={[
                { ten: "Mã hàng", o: (r: MaHang) => r.ma },
                { ten: "Mô tả", o: (r) => r.mt ?? "" },
                {
                  ten: "KT (cm)",
                  o: (r) =>
                    [r.L, r.W, r.H].filter((x) => x !== undefined).join("×"),
                },
                { ten: "SL", o: (r) => fq(r.qty), so: (r) => r.qty },
                { ten: "ĐVT", o: (r) => r.u ?? "" },
                { ten: "SL/hộp trong", o: (r) => (r.inner ? fq(r.inner) : "") },
                { ten: "Hộp trong/thùng", o: (r) => (r.io ? fq(r.io) : "") },
                {
                  ten: "KT thùng ngoài",
                  o: (r) =>
                    [r.oL, r.oW, r.oH].filter((x) => x !== undefined).join("×"),
                },
                {
                  ten: "In",
                  o: (r) => (
                    <input
                      type="checkbox"
                      checked={Boolean(r.in)}
                      onChange={(e) =>
                        setItems(
                          items.map((i) =>
                            i.ma === r.ma ? { ...i, in: e.target.checked } : i,
                          ),
                        )
                      }
                    />
                  ),
                },
              ]}
              dong={items}
              khoa={(r, i) => `${r.ma}-${i}`}
              tong={[
                { text: "Tổng" },
                null,
                null,
                { so: items.reduce((s, i) => s + i.qty, 0) },
                null,
                null,
                null,
                null,
                null,
              ]}
            />
          </div>
        ) : null}
        <ThongBao tb={lenh.tb} />
        <div className="mt-3">
          <button
            type="submit"
            className={lopNut}
            disabled={lenh.dangGui || items.length === 0}
          >
            Gửi xưởng
          </button>
        </div>
      </BieuMau>

      <Muc tieuDe="Đơn đã gửi xưởng">
        <Bang
          cot={[
            {
              ten: "Đơn",
              o: (r: SanXuat) => `${r.dh} ${cm.don.get(r.dh)?.n ?? ""}`,
            },
            { ten: "Khách", o: (r) => r.khach ?? "" },
            { ten: "Gửi lúc", o: (r) => dvn(r.at) },
            { ten: "Xuất hàng (PI)", o: (r) => dvn(r.ngayxuat) },
            {
              ten: "Xưởng",
              o: (r) =>
                r.tt === "nhan" ? (
                  <Nhan mau="xanh">Đã nhận</Nhan>
                ) : (
                  <Nhan mau="vang">Chờ nhận</Nhan>
                ),
            },
            {
              ten: "Dự kiến giao",
              o: (r) => (r.tt === "nhan" ? dvn(mocDon(cm, r).duKien) : ""),
            },
            { ten: "Tiến độ", o: (r) => <NhanMuc muc={mocDon(cm, r).muc} /> },
          ]}
          dong={daGui}
          khoa={(r) => r._id}
          rong="Chưa gửi đơn nào."
          onDong={(r) => diTab("sanxuat", r.dh)}
        />
      </Muc>
    </div>
  );
}
