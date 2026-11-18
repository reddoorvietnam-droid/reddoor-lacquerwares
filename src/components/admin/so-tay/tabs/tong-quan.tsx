"use client";

import { useMemo, useState } from "react";

import { TABS } from "@/domains/so-tay/hang-so";
import type { LichSu } from "@/domains/so-tay/kieu";
import { quyXuong } from "@/domains/so-tay/nghiep-vu/chi-xuong";
import { tongTheoCoSo } from "@/domains/so-tay/nghiep-vu/cong-no";
import { NHAN_KHO, stat, tonKho } from "@/domains/so-tay/nghiep-vu/kho";
import {
  mocDon,
  quaHan,
  tinZalo,
  type ViecQuaHan,
} from "@/domains/so-tay/nghiep-vu/tien-do";
import { dvn, fm } from "@/domains/so-tay/tien-ich";

import { Bang, DaiThe, lopNutNho, Muc, Nhan, sl, The, useSo } from "../ui";
import { NhanMuc } from "./chung";

export function TabTongQuan() {
  const { du, cm, diTab } = useSo();
  const [daChep, setDaChep] = useState(false);

  const so = useMemo(() => {
    const coSo = [...tongTheoCoSo(cm).values()];
    const ton = tonKho(du.vattu ?? [], du.phieukho ?? [], du.sodu?.ngay);
    const canhBao = (du.vattu ?? [])
      .map((v) => ({ v, ton: ton.get(v._id) ?? 0 }))
      .map((x) => ({ ...x, st: stat(x.ton, x.v) }))
      .filter((x) => x.st !== "ok");
    const dangSx = [...cm.sx.values()].filter((s) => !s.giao?.ngay);
    return {
      rdNo: coSo.reduce((s, x) => s + x.conNo, 0),
      noSon: coSo.reduce((s, x) => s + Math.max(0, x.noSon), 0),
      canhBao,
      dangSx,
      deNghiCho: (du.denghichi ?? []).filter((d) => d.tt === "cho"),
      chiCho: (du.chixuong ?? []).filter(
        (c) => c.kieu === "chi" && c.tt === "cho",
      ),
      quy: quyXuong(du.chixuong ?? []),
    };
  }, [cm, du]);

  const qh = useMemo(() => quaHan(cm), [cm]);
  const doDem = so.canhBao.filter((x) => x.st === "do" || x.st === "am").length;
  const vangDem = so.canhBao.filter((x) => x.st === "vang").length;

  return (
    <div>
      <DaiThe>
        <The
          nhan="RD còn nợ cơ sở"
          giaTri={`${fm(so.rdNo)} đ`}
          onClick={() => diTab("congno")}
        />
        <The
          nhan="Cơ sở nợ RD tiền sơn"
          giaTri={`${fm(so.noSon)} đ`}
          onClick={() => diTab("coso")}
        />
        <The
          nhan="Vật tư cảnh báo đỏ / vàng"
          giaTri={`${doDem} / ${vangDem}`}
          mau={doDem ? "do" : vangDem ? "vang" : "xanh"}
          onClick={() => diTab("ton")}
        />
        <The
          nhan="Đơn đang sản xuất"
          giaTri={String(so.dangSx.length)}
          onClick={() => diTab("sanxuat")}
        />
        <The
          nhan="Đề nghị chi chờ chi"
          giaTri={String(so.deNghiCho.length)}
          phu={`${fm(so.deNghiCho.reduce((s, d) => s + d.tien, 0))} đ`}
          onClick={() => diTab("chi")}
        />
        <The
          nhan="Khoản chi xưởng chờ duyệt"
          giaTri={String(so.chiCho.length)}
          phu={`Quỹ còn ${fm(so.quy.con)} đ`}
          onClick={() => diTab("chixuong")}
        />
      </DaiThe>

      <Muc
        tieuDe="Quá hạn hôm nay"
        phu={
          qh.length ? `${qh.length} việc quá hạn, lâu nhất lên đầu` : undefined
        }
        hanhDong={
          qh.length ? (
            <button
              type="button"
              className={lopNutNho}
              onClick={() => {
                void navigator.clipboard
                  .writeText(tinZalo(qh, cm.hom))
                  .then(() => setDaChep(true));
              }}
            >
              {daChep ? "Đã chép ✓" : "Sao chép tin Zalo"}
            </button>
          ) : null
        }
      >
        <Bang
          cot={[
            { ten: "Đơn", o: (r: ViecQuaHan) => `${r.dh} ${r.ten}` },
            { ten: "Việc", o: (r) => r.viec },
            { ten: "Hạn", o: (r) => dvn(r.han) },
            {
              ten: "Quá",
              o: (r) => (
                <span className="font-semibold text-[#D0342C]">
                  {r.qua} ngày
                </span>
              ),
              so: (r) => r.qua,
            },
            { ten: "Phụ trách", o: (r) => r.phutrach },
          ]}
          dong={qh}
          khoa={(r, i) => `${r.dh}-${i}`}
          rong="Không có việc nào quá hạn."
          onDong={(r) => diTab("sanxuat", r.dh)}
        />
      </Muc>

      <Muc tieuDe="Đơn đang sản xuất">
        <Bang
          cot={[
            {
              ten: "Đơn",
              o: (r: (typeof so.dangSx)[number]) =>
                `${r.dh} ${cm.don.get(r.dh)?.n ?? ""}`,
            },
            { ten: "Khách", o: (r) => r.khach ?? "" },
            { ten: "Mức", o: (r) => <NhanMuc muc={mocDon(cm, r).muc} /> },
            {
              ten: "Dự kiến giao",
              o: (r) => (r.tt === "nhan" ? dvn(mocDon(cm, r).duKien) : ""),
            },
            { ten: "Ngày xuất (PI)", o: (r) => dvn(r.ngayxuat) },
          ]}
          dong={so.dangSx}
          khoa={(r) => r._id}
          rong="Chưa có đơn nào đang sản xuất."
          onDong={(r) => diTab("sanxuat", r.dh)}
        />
      </Muc>

      <Muc tieuDe="Cảnh báo tồn kho">
        <Bang
          cot={[
            { ten: "Mã", o: (r: (typeof so.canhBao)[number]) => r.v._id },
            { ten: "Tên", o: (r) => r.v.n ?? "" },
            {
              ten: "Tồn",
              o: (r) => `${sl(r.ton)} ${r.v.u ?? ""}`,
              so: (r) => r.ton,
            },
            {
              ten: "Mức",
              o: (r) => (
                <Nhan mau={r.st === "vang" ? "vang" : "do"}>
                  {NHAN_KHO[r.st] || "Đỏ"}
                </Nhan>
              ),
            },
          ]}
          dong={so.canhBao}
          khoa={(r) => r.v._id}
          rong="Không có vật tư nào cảnh báo."
        />
      </Muc>

      <Muc tieuDe="Hoạt động gần đây">
        <Bang
          cot={[
            {
              ten: "Thời gian",
              o: (r: LichSu) =>
                `${dvn(r.at)} ${new Date(r.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })}`,
            },
            { ten: "Người làm", o: (r) => r.ten ?? r.tk ?? "" },
            {
              ten: "Tab",
              o: (r) => TABS.find((t) => t.ma === r.tab)?.ten ?? "",
            },
            { ten: "Nội dung", o: (r) => r.tom ?? "" },
          ]}
          dong={du.ganDay ?? []}
          khoa={(r) => r._id}
          rong="Chưa có hoạt động nào."
        />
      </Muc>

      <p className="text-xs text-[#6E6563]">
        {du.sodu?.ngay
          ? `Số dư công nợ cơ sở lấy từ file ${du.sodu.nguon ?? "(chưa ghi tên file)"} ngày ${dvn(du.sodu.ngay)}.`
          : "Chưa nạp số dư công nợ cơ sở (giai đoạn 2 sẽ nạp từ Sổ chung cũ)."}
      </p>
    </div>
  );
}
