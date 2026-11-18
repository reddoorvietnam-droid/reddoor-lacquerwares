"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  NHOM,
  TABS,
  xemTab,
  type MaNhom,
  type MaTab,
} from "@/domains/so-tay/hang-so";
import type { DuLieu, LichSu, NguoiSoTay } from "@/domains/so-tay/kieu";
import { taoChiMuc } from "@/domains/so-tay/nghiep-vu/chi-muc";
import { dvn } from "@/domains/so-tay/tien-ich";
import { SignOutButton } from "@/components/admin/sign-out-button";

import { guiLenh, taiLichSu, taiTab } from "./api";
import { NoiDungTab } from "./tabs";
import { TrangDauView } from "./trang-dau";
import {
  Bang,
  Hop,
  lopNut,
  lopNutNho,
  lopNutPhu,
  SoTayCtx,
  type SoTayNguCanh,
} from "./ui";
import { xuatExcel, xuatPdf } from "./xuat";

type ManHinh =
  { man: "dau" } | { man: "so"; tab: MaTab; chiTiet: string | null };

const KHOA_TAB = "so-tay-tab";
const TOI_DA_LUI = 60;

function docTabNho(nguoi: NguoiSoTay): MaTab {
  try {
    const t = window.localStorage.getItem(KHOA_TAB) as MaTab | null;
    if (t && TABS.some((x) => x.ma === t) && xemTab(nguoi.vaitro, t)) return t;
  } catch {
    /* trình duyệt chặn lưu trữ */
  }
  return "tongquan";
}

function phienMoi(): string {
  return `PH-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function SoTayApp({ nguoi }: { nguoi: NguoiSoTay }) {
  const [man, setMan] = useState<ManHinh>({ man: "dau" });
  const [lui, setLui] = useState<ManHinh[]>([]);
  const [loiTai, setLoiTai] = useState<string | null>(null);
  const [phien, setPhien] = useState<string | null>(null);
  const [soThayDoi, setSoThayDoi] = useState(0);
  const [baoCao, setBaoCao] = useState<string | null>(null);
  const [hoiHuy, setHoiHuy] = useState(false);
  const [lichSu, setLichSu] = useState<{
    tatCa: boolean;
    ds: LichSu[] | null;
  } | null>(null);
  const [boLoc, setBoLoc] = useState("");
  const vungXuat = useRef<HTMLDivElement>(null);

  const tab = man.man === "so" ? man.tab : null;
  // Dữ liệu gắn với tab đã tải nó: đổi tab thì hiện "Đang tải…" cho tới khi có dữ liệu mới.
  const [duTab, setDuTab] = useState<{ tab: MaTab; du: DuLieu } | null>(null);
  const du = duTab && duTab.tab === tab ? duTab.du : null;
  const tabDn = TABS.find((t) => t.ma === tab);
  const nhom: MaNhom = tabDn?.nhom ?? 1;

  // ---------------------------------------------------------- tải dữ liệu
  const taiLai = useCallback(async () => {
    if (!tab) return;
    try {
      setDuTab({ tab, du: await taiTab(tab) });
      setLoiTai(null);
    } catch (e) {
      setLoiTai(e instanceof Error ? e.message : "Không tải được dữ liệu.");
    }
  }, [tab]);

  useEffect(() => {
    if (!tab) return;
    let huy = false;
    taiTab(tab)
      .then((d) => {
        if (huy) return;
        setDuTab({ tab, du: d });
        setLoiTai(null);
      })
      .catch((e: unknown) => {
        if (!huy)
          setLoiTai(e instanceof Error ? e.message : "Không tải được dữ liệu.");
      });
    return () => {
      huy = true;
    };
  }, [tab]);

  // Người khác sửa thì trang tự làm mới (15 giây).
  useEffect(() => {
    if (!tab) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void taiLai();
    }, 15_000);
    return () => window.clearInterval(t);
  }, [tab, taiLai]);

  // ---------------------------------------------------------- điều hướng
  const ketThucSua = useCallback(
    (tuDong: boolean) => {
      if (!phien) return;
      setBaoCao(
        soThayDoi > 0
          ? `${tuDong ? "Tự lưu khi chuyển trang. " : ""}Đã lưu ${soThayDoi} thay đổi. Lịch sử đã ghi người sửa và thời gian.`
          : null,
      );
      setPhien(null);
      setSoThayDoi(0);
    },
    [phien, soThayDoi],
  );

  const den = useCallback(
    (moi: ManHinh) => {
      ketThucSua(true);
      setLui((s) => [...s, man].slice(-TOI_DA_LUI));
      setMan(moi);
      if (moi.man === "so") {
        try {
          window.localStorage.setItem(KHOA_TAB, moi.tab);
        } catch {
          /* bỏ qua */
        }
      }
      window.scrollTo({ top: 0 });
    },
    [ketThucSua, man],
  );

  const quayLai = () => {
    ketThucSua(true);
    const truoc = lui[lui.length - 1];
    setLui((s) => s.slice(0, -1));
    setMan(truoc ?? { man: "dau" });
  };

  const diTab = useCallback(
    (t: MaTab, chiTiet: string | null = null) => {
      if (!xemTab(nguoi.vaitro, t)) return;
      den({ man: "so", tab: t, chiTiet });
    },
    [den, nguoi.vaitro],
  );

  const moChiTiet = useCallback(
    (id: string | null) => {
      if (man.man !== "so") return;
      den({ man: "so", tab: man.tab, chiTiet: id });
    },
    [den, man],
  );

  // ---------------------------------------------------------- ghi dữ liệu
  const gui = useCallback(
    async (lenh: string, duLieu: unknown) => {
      const r = await guiLenh(lenh, duLieu, tab, phien);
      if (r.ok) {
        setSoThayDoi((n) => n + 1);
        void taiLai();
      }
      return r;
    },
    [phien, tab, taiLai],
  );

  const hoanTac = async () => {
    if (!phien) return;
    const r = await guiLenh("hoanTac", { phien }, tab, null);
    setHoiHuy(false);
    setPhien(null);
    setSoThayDoi(0);
    setBaoCao(
      r.ok
        ? "Đã hoàn tác các thay đổi từ lúc bấm Chỉnh sửa."
        : `Không hoàn tác được: ${r.message}`,
    );
    void taiLai();
  };

  const moLichSu = async (tatCa: boolean) => {
    setLichSu({ tatCa, ds: null });
    try {
      setLichSu({ tatCa, ds: await taiLichSu(tatCa ? null : tab) });
    } catch {
      setLichSu({ tatCa, ds: [] });
    }
  };

  const cm = useMemo(() => (du ? taoChiMuc(du) : null), [du]);

  const ctx: SoTayNguCanh | null = useMemo(
    () =>
      tab && du && cm
        ? {
            nguoi,
            tab,
            du,
            cm,
            dangSua: phien !== null,
            gui,
            taiLai: () => void taiLai(),
            chiTiet: man.man === "so" ? man.chiTiet : null,
            moChiTiet,
            diTab,
            datBoLoc: setBoLoc,
          }
        : null,
    [cm, diTab, du, gui, man, moChiTiet, nguoi, phien, tab, taiLai],
  );

  // Tab chưa mở lần nào thì dùng tab đã nhớ.
  const vaoSo = () => diTab(docTabNho(nguoi));

  if (man.man === "dau") {
    return (
      <TrangDauView
        nguoi={nguoi}
        onVaoSo={vaoSo}
        onMoDon={(dh) => diTab("sanxuat", dh)}
      />
    );
  }

  const tabsNhom = TABS.filter(
    (t) => t.nhom === nhom && xemTab(nguoi.vaitro, t.ma),
  );
  const nhomDn = NHOM.find((n) => n.ma === nhom);
  const viTri = [nhomDn?.ten, tabDn?.ten, man.chiTiet ? "chi tiết" : null]
    .filter(Boolean)
    .join(" › ");
  const laTabChinh = tab === nhomDn?.tabChinh && !man.chiTiet;
  const coThanhSua = tab !== "tongquan";

  return (
    <div className="text-[#221C1B]">
      {/* Thanh điều hướng */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="mr-2 text-lg font-semibold text-[#8E2927]"
          onClick={() => den({ man: "dau" })}
        >
          Sổ chung Red Door
        </button>
        <button type="button" className={lopNutNho} onClick={quayLai}>
          ← Quay lại
        </button>
        {!laTabChinh && nhomDn ? (
          <button
            type="button"
            className={lopNutNho}
            onClick={() => diTab(nhomDn.tabChinh as MaTab)}
          >
            ⌂ Tab chính
          </button>
        ) : null}
        <button
          type="button"
          className={lopNutNho}
          onClick={() => den({ man: "dau" })}
        >
          Trang đầu
        </button>
        <span className="ml-auto text-sm text-[#6E6563]">👤 {nguoi.ten}</span>
        <SignOutButton locale="vi" variant="solid" label="🔒 Đăng xuất" />
      </div>
      <p className="mb-3 text-xs text-[#6E6563]">{viTri}</p>

      {/* Chọn nhóm */}
      <div className="mb-2 flex flex-wrap gap-2">
        {NHOM.map((n) => {
          const dau = TABS.find(
            (t) => t.nhom === n.ma && xemTab(nguoi.vaitro, t.ma),
          );
          if (!dau) return null;
          return (
            <button
              key={n.ma}
              type="button"
              onClick={() =>
                diTab(n.ma === nhom ? (tab as MaTab) : (dau.ma as MaTab))
              }
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${n.ma === nhom ? "bg-[#8E2927] text-white" : "border border-[#E2D6C4] bg-white text-[#8E2927]"}`}
            >
              {n.ten}
            </button>
          );
        })}
      </div>
      <nav
        className="mb-4 flex flex-wrap gap-1 border-b border-[#E2D6C4] pb-2"
        aria-label="Tab Sổ tay"
      >
        {tabsNhom.map((t) => (
          <button
            key={t.ma}
            type="button"
            onClick={() => diTab(t.ma)}
            className={`rounded-lg px-3 py-1.5 text-sm ${t.ma === tab ? "bg-[#FAF5EC] font-semibold text-[#8E2927] ring-1 ring-[#C9A24A]" : "text-[#6E6563] hover:bg-[#FAF5EC]"}`}
          >
            {t.ten}
          </button>
        ))}
      </nav>

      {/* Thanh công cụ */}
      <div
        className={`mb-4 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${phien ? "border-[#C9A24A] bg-[#C9A24A]/15" : "border-[#E2D6C4] bg-white"}`}
      >
        {coThanhSua ? (
          phien ? (
            <>
              <span className="text-sm font-semibold text-[#7a4d00]">
                Đang chỉnh sửa · {soThayDoi} thay đổi
              </span>
              <button
                type="button"
                className={lopNut}
                onClick={() => ketThucSua(false)}
              >
                ✓ Lưu
              </button>
              <button
                type="button"
                className={lopNutPhu}
                onClick={() =>
                  soThayDoi > 0 ? setHoiHuy(true) : ketThucSua(false)
                }
              >
                ✕ Hủy
              </button>
            </>
          ) : (
            <button
              type="button"
              className={lopNut}
              onClick={() => {
                setBaoCao(null);
                setPhien(phienMoi());
                setSoThayDoi(0);
              }}
            >
              ✎ Chỉnh sửa
            </button>
          )
        ) : null}
        {coThanhSua ? (
          <button
            type="button"
            className={lopNutPhu}
            onClick={() => void moLichSu(false)}
          >
            Lịch sử
          </button>
        ) : null}
        <span className="ml-auto" />
        <button
          type="button"
          className={lopNutPhu}
          disabled={!du}
          onClick={() =>
            vungXuat.current &&
            void xuatExcel(
              vungXuat.current,
              tabDn?.ten ?? "",
              [viTri, boLoc].filter(Boolean).join(" · "),
              nguoi.ten,
            )
          }
        >
          ⤓ Xuất Excel
        </button>
        <button
          type="button"
          className={lopNutPhu}
          disabled={!du}
          onClick={() =>
            vungXuat.current &&
            void xuatPdf(
              vungXuat.current,
              tabDn?.ten ?? "",
              [viTri, boLoc].filter(Boolean).join(" · "),
              nguoi.ten,
            )
          }
        >
          ⤓ Xuất PDF (A4)
        </button>
      </div>
      {baoCao ? (
        <p
          className="mb-4 rounded-lg border border-[#1F6B45]/30 bg-[#1F6B45]/5 px-3 py-2 text-sm text-[#1F6B45]"
          role="status"
        >
          {baoCao}
        </p>
      ) : null}

      {loiTai ? (
        <p
          className="rounded-lg border border-[#D0342C]/30 bg-[#D0342C]/5 px-3 py-2 text-sm text-[#D0342C]"
          role="alert"
        >
          {loiTai}
        </p>
      ) : null}

      <div ref={vungXuat}>
        {ctx ? (
          <SoTayCtx.Provider value={ctx}>
            <NoiDungTab />
          </SoTayCtx.Provider>
        ) : !loiTai ? (
          <p className="py-10 text-center text-sm text-[#6E6563]">Đang tải…</p>
        ) : null}
      </div>

      <Hop mo={hoiHuy} tieuDe="Hủy chỉnh sửa?" onDong={() => setHoiHuy(false)}>
        <p className="text-sm">
          Sổ sẽ hoàn tác {soThayDoi} thay đổi đã ghi từ lúc bấm Chỉnh sửa, theo
          thứ tự ngược lại. Việc hủy cũng được ghi vào lịch sử.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className={lopNutPhu}
            onClick={() => setHoiHuy(false)}
          >
            Không
          </button>
          <button
            type="button"
            className={lopNut}
            onClick={() => void hoanTac()}
          >
            Đồng ý hoàn tác
          </button>
        </div>
      </Hop>

      <Hop
        mo={lichSu !== null}
        tieuDe={
          lichSu?.tatCa
            ? "Lịch sử thay đổi · mọi tab"
            : `Lịch sử thay đổi · ${tabDn?.ten ?? ""}`
        }
        onDong={() => setLichSu(null)}
        rong="max-w-5xl"
      >
        <div className="mb-3">
          <button
            type="button"
            className={lopNutNho}
            onClick={() => void moLichSu(!lichSu?.tatCa)}
          >
            {lichSu?.tatCa ? "Chỉ tab này" : "Xem tất cả các tab"}
          </button>
        </div>
        {lichSu?.ds === null ? (
          <p className="text-sm text-[#6E6563]">Đang tải…</p>
        ) : (
          <Bang
            cot={[
              {
                ten: "Thời gian",
                o: (r: LichSu) =>
                  `${dvn(r.at)} ${new Date(r.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })}`,
              },
              { ten: "Người thay đổi", o: (r) => r.ten ?? r.tk ?? "" },
              { ten: "Thao tác", o: (r) => r.op },
              ...(lichSu?.tatCa
                ? [
                    {
                      ten: "Tab",
                      o: (r: LichSu) =>
                        TABS.find((t) => t.ma === r.tab)?.ten ?? "",
                    },
                  ]
                : []),
              { ten: "Nội dung", o: (r) => r.tom ?? "" },
            ]}
            dong={lichSu?.ds ?? []}
            khoa={(r) => r._id}
            rong="Chưa có thay đổi nào."
          />
        )}
      </Hop>
    </div>
  );
}
