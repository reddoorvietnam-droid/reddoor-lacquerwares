import "server-only";

import { z } from "zod";

import { trongGiaoDich } from "./db";
import { capNhatLich, taiCollections, taiTatCa } from "./du-lieu";
import { type BoiCanh, huy, sua, taoMoi, xoa } from "./ghi";
import {
  CP,
  HINH_THUC,
  KHAU,
  LOAI,
  LOAI_CHI,
  LOAI_DT,
  NV,
  NV_DS,
  TABS,
  TEN_KHAU,
  TEN_LOAI_PHIEU,
  VAI_TRO,
  type MaTab,
  type TenCollection,
} from "./hang-so";
import type {
  ChiXuong,
  DeNghiChi,
  DoiTuong,
  DonMua,
  NguoiSoTay,
  PhanCong,
  SanXuat,
} from "./kieu";
import { CanhBao, khongTimThay, LoiSoTay } from "./loi";
import { soTayModels } from "./models";
import { taoChiMuc, tenDt, khoa } from "./nghiep-vu/chi-muc";
import { canDuyet, canhBaoChiaNho, quyXuong } from "./nghiep-vu/chi-xuong";
import { congNoTheoCap } from "./nghiep-vu/cong-no";
import { demThamChieu, soLoai, soMoi, soSauKhiSua } from "./nghiep-vu/danh-muc";
import {
  butToanGhiHopDong,
  NGUON_HOP_DONG,
  sxCalc,
} from "./nghiep-vu/hop-dong";
import { mucMacDinh, tonKho } from "./nghiep-vu/kho";
import { bayGio, dvn, fm, fq, rid, slug, today } from "./tien-ich";
import { yeuCauVai, yeuCauViec } from "./truy-cap";

// ---------------------------------------------------------------- Kiểu đầu vào

const ngay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ.");
const ngayTuyY = z.union([ngay, z.literal(""), z.null()]).optional();
const chu = (max = 500) => z.string().trim().max(max);
const chuTuyY = (max = 500) => chu(max).optional();
const ma = z.string().trim().min(1, "Thiếu mã.").max(120);
const tien = z
  .number()
  .int("Số tiền phải là số nguyên (đồng).")
  .positive("Số tiền phải lớn hơn 0.");
const tienTuyY = z
  .number()
  .int("Số tiền phải là số nguyên (đồng).")
  .min(0)
  .optional();
const soLuong = z.number().positive("Số lượng phải lớn hơn 0.");
const xacNhan = z.boolean().optional();
/** z.enum cho mảng hằng số (không phải tuple). */
const en = <T extends string>(ds: readonly T[]) =>
  z.enum(ds as unknown as [T, ...T[]]);

const dongVatTu = z.object({
  vt: ma,
  sl: soLuong,
  dg: tienTuyY,
});

type Ctx = { nguoi: NguoiSoTay; boi: BoiCanh };

type Lenh<S extends z.ZodType> = {
  schema: S;
  /** Kiểm tra quyền (ở máy chủ). */
  quyen: (nguoi: NguoiSoTay) => void;
  /** Đổi dữ liệu sản xuất → tính lại lịch. */
  lich?: true;
  chay: (input: z.infer<S>, ctx: Ctx) => Promise<unknown>;
};

const lenh = <S extends z.ZodType>(l: Lenh<S>) => l;

const ai = () => undefined;
const chiQuanLy = (n: NguoiSoTay) => yeuCauVai(n, []);

const rong = <T extends Record<string, unknown>>(o: T): T => {
  const kq: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === "" || v === null) continue;
    kq[k] = v;
  }
  return kq as T;
};

async function layMot<T>(
  col: TenCollection,
  id: string,
  ten: string,
): Promise<T> {
  const m = await soTayModels();
  const d = await m[col].findById(id).lean();
  if (!d) throw khongTimThay(ten);
  return d as T;
}

// ---------------------------------------------------------------- Danh mục

const doiTuongVao = z.object({
  n: chu(200).min(1, "Phải ghi đủ họ tên / tên cơ sở."),
  l: en(LOAI_DT),
  g: chuTuyY(100),
  p: chuTuyY(50),
  cccd: chuTuyY(30),
  note: chuTuyY(1000),
  m: z.union([z.literal(0), z.literal(1)]).optional(),
});

const taoDoiTuong = lenh({
  schema: doiTuongVao,
  quyen: ai,
  chay: async (v, { boi }) => {
    const c = slug(v.n);
    if (!c) throw new LoiSoTay("Tên không hợp lệ.");
    const m = await soTayModels();
    const ds = (await m.doituong
      .find({}, { so: 1, n: 1 })
      .lean()) as unknown as DoiTuong[];
    const trung = ds.find((d) => d._id === c || slug(d.n) === c);
    if (trung) {
      throw new LoiSoTay(
        `Đã có trong danh mục: ${trung.so ? `${trung.so} · ` : ""}${trung.n}`,
        409,
      );
    }
    const nhom = soLoai({ ...v, luu: false });
    return taoMoi(
      "doituong",
      rong({
        _id: c,
        c,
        ...v,
        so: nhom ? soMoi(nhom, ds) : undefined,
        luu: false,
      }),
      boi,
    );
  },
});

const suaDoiTuong = lenh({
  schema: doiTuongVao.extend({ c: ma, luu: z.boolean().optional(), xacNhan }),
  quyen: ai,
  chay: async ({ c, xacNhan: ok, ...v }, { boi }) => {
    const m = await soTayModels();
    const ds = (await m.doituong
      .find({}, { so: 1, n: 1, g: 1, l: 1, luu: 1 })
      .lean()) as unknown as DoiTuong[];
    const cu = ds.find((d) => d._id === c);
    if (!cu) throw khongTimThay(`đối tượng ${c}`);
    const canh: string[] = [];
    const trung = ds.find((d) => d._id !== c && slug(d.n) === slug(v.n));
    if (trung)
      canh.push(`Tên trùng với ${trung.so ? `${trung.so} · ` : ""}${trung.n}.`);
    const soMoiCap = soSauKhiSua(cu, { ...v, luu: Boolean(v.luu) }, ds);
    if ((cu.so ?? "") !== (soMoiCap ?? "") && cu.so && soMoiCap) {
      canh.push(`Đổi nhóm: số ${cu.so} sẽ thành ${soMoiCap}.`);
    }
    if (canh.length && !ok)
      throw new CanhBao(`${canh.join(" ")} Bấm Lưu lần nữa để lưu.`);
    return sua(
      "doituong",
      c,
      {
        n: v.n,
        l: v.l,
        g: v.g || undefined,
        p: v.p || undefined,
        cccd: v.cccd || undefined,
        note: v.note || undefined,
        m: v.m ?? 0,
        luu: Boolean(v.luu),
        so: soMoiCap,
      },
      boi,
    );
  },
});

async function xoaDanhMuc(
  loai: "doituong" | "donhang" | "vattu",
  id: string,
  boi: BoiCanh,
) {
  const tc = demThamChieu(await taiTatCa(), loai, id);
  if (tc.length) {
    throw new LoiSoTay(
      `Không xóa được vì đang được dùng ở: ${tc.map((t) => `${t.ten} (${t.so})`).join(", ")}. Dùng Sửa thay vì xóa.`,
      409,
    );
  }
  await xoa(loai, id, boi);
  return { ok: true };
}

const xoaDoiTuong = lenh({
  schema: z.object({ c: ma }),
  quyen: (n) => yeuCauVai(n, ["ketoan", "ketoancty"]),
  chay: ({ c }, { boi }) => xoaDanhMuc("doituong", c, boi),
});

const donHangVao = z.object({ c: ma, k: chuTuyY(200), n: chuTuyY(200) });

const taoDonHang = lenh({
  schema: donHangVao,
  quyen: ai,
  chay: async (v, { boi }) => {
    const m = await soTayModels();
    if (await m.donhang.exists({ _id: v.c }))
      throw new LoiSoTay(`Đã có đơn ${v.c}.`, 409);
    return taoMoi("donhang", rong({ _id: v.c, ...v }), boi);
  },
});

const suaDonHang = lenh({
  schema: donHangVao,
  quyen: ai,
  chay: (v, { boi }) =>
    sua("donhang", v.c, { k: v.k || undefined, n: v.n || undefined }, boi),
});

const xoaDonHang = lenh({
  schema: z.object({ c: ma }),
  quyen: (n) => yeuCauVai(n, ["ketoan", "ketoancty"]),
  chay: ({ c }, { boi }) => xoaDanhMuc("donhang", c, boi),
});

const vatTuVao = z.object({
  c: ma,
  n: chuTuyY(200),
  k: z.enum(["S", "N"]).optional(),
  g: chuTuyY(100),
  u: chuTuyY(30),
  gv: z.number().min(0).optional(),
  y: z.number().min(0).optional(),
  r: z.number().min(0).optional(),
});

const taoVatTu = lenh({
  schema: vatTuVao.extend({ t: z.number().optional() }),
  quyen: (n) => yeuCauVai(n, ["thukho", "ketoan", "ketoancty"]),
  chay: async (v, { boi }) => {
    const m = await soTayModels();
    if (await m.vattu.exists({ _id: v.c }))
      throw new LoiSoTay(`Đã có vật tư ${v.c}.`, 409);
    const muc =
      v.y === undefined && v.r === undefined ? mucMacDinh(v.n ?? "", v.g) : {};
    return taoMoi("vattu", rong({ _id: v.c, ...muc, ...v, t: v.t ?? 0 }), boi);
  },
});

const suaVatTu = lenh({
  schema: vatTuVao,
  quyen: (n) => yeuCauVai(n, ["thukho", "ketoan", "ketoancty"]),
  // Tồn đầu kỳ không sửa ở đây; muốn đổi thì lập phiếu kiểm kê.
  chay: ({ c, ...v }, { boi }) =>
    sua(
      "vattu",
      c,
      {
        n: v.n || undefined,
        k: v.k,
        g: v.g || undefined,
        u: v.u || undefined,
        gv: v.gv,
        y: v.y,
        r: v.r,
      },
      boi,
    ),
});

const xoaVatTu = lenh({
  schema: z.object({ c: ma }),
  quyen: (n) => yeuCauVai(n, ["thukho", "ketoan", "ketoancty"]),
  chay: ({ c }, { boi }) => xoaDanhMuc("vattu", c, boi),
});

const doiVaiTro = lenh({
  schema: z.object({
    email: z.string().trim().toLowerCase().email(),
    vaitro: en(VAI_TRO).nullable(),
  }),
  quyen: chiQuanLy,
  chay: async ({ email, vaitro }, { boi }) => {
    const m = await soTayModels();
    if (!(await m.taikhoan.exists({ _id: email }))) {
      await taoMoi(
        "taikhoan",
        { _id: email, email, hoatdong: true, vaitro },
        boi,
      );
      return { ok: true };
    }
    return sua("taikhoan", email, { vaitro }, boi);
  },
});

const suaMauTienDo = lenh({
  schema: z.object({
    baoTruoc: z.number().int().min(0).max(30),
    mau: z
      .array(
        z.object({
          ten: chu(40).min(1),
          den: z.number().int().positive(),
          ngay: z.object({
            m1: z.number().int().min(0),
            m2: z.number().int().min(0),
            m3: z.number().int().min(0),
            m4: z.number().int().min(0),
            m5: z.number().int().min(0),
          }),
          m5max: z.number().int().min(0),
        }),
      )
      .min(1),
  }),
  quyen: chiQuanLy,
  lich: true,
  chay: async (v, { boi }) => {
    const m = await soTayModels();
    if (!(await m.cauhinh.exists({ _id: "canhbao" }))) {
      return taoMoi("cauhinh", { _id: "canhbao", ...v }, boi);
    }
    return sua("cauhinh", "canhbao", v, boi);
  },
});

// ---------------------------------------------------------------- Đơn mới, sản xuất

const maHangVao = z.object({
  ma: chu(80).min(1),
  mt: chuTuyY(1000),
  L: z.number().optional(),
  W: z.number().optional(),
  H: z.number().optional(),
  qty: z.number().positive(),
  u: chuTuyY(20),
  img: chuTuyY(500),
  in: z.boolean().optional(),
  inner: z.number().positive().optional(),
  io: z.number().positive().optional(),
  oL: z.number().optional(),
  oW: z.number().optional(),
  oH: z.number().optional(),
});

const guiDon = lenh({
  schema: z.object({
    dh: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{1,4}$/, "Mã đơn dạng YYYY-NN, ví dụ 2026-36."),
    khach: chu(200).min(1, "Thiếu khách."),
    ten: chuTuyY(200),
    ngayxuat: ngay,
    items: z.array(maHangVao).min(1, "Chưa có mã hàng nào."),
  }),
  quyen: (n) => yeuCauViec(n, "donmoi"),
  lich: true,
  chay: async (v, { boi }) => {
    const m = await soTayModels();
    if (await m.sanxuat.exists({ _id: v.dh }))
      throw new LoiSoTay(`Đơn ${v.dh} đã gửi xưởng.`, 409);
    return trongGiaoDich(async (session) => {
      const b = { ...boi, session };
      if (!(await m.donhang.exists({ _id: v.dh }).session(session))) {
        await taoMoi(
          "donhang",
          rong({ _id: v.dh, c: v.dh, k: v.khach, n: v.ten }),
          b,
        );
      }
      return taoMoi(
        "sanxuat",
        {
          _id: v.dh,
          dh: v.dh,
          khach: v.khach,
          ngayxuat: v.ngayxuat,
          items: v.items.map((i) => rong(i)),
          tt: "moi",
        },
        b,
      );
    });
  },
});

const nhanDon = lenh({
  schema: z.object({ dh: ma }),
  quyen: (n) => yeuCauViec(n, "nhandon"),
  lich: true,
  chay: async ({ dh }, { boi, nguoi }) => {
    const sx = await layMot<SanXuat>("sanxuat", dh, `đơn ${dh}`);
    if (sx.tt === "nhan") throw new LoiSoTay("Đơn này đã được nhận.", 409);
    return sua(
      "sanxuat",
      dh,
      { tt: "nhan", nhan: { by: nguoi.email, at: bayGio() } },
      boi,
    );
  },
});

const chonMau = lenh({
  schema: z.object({ dh: ma, mau: chu(40).nullable() }),
  quyen: (n) => yeuCauViec(n, "chia"),
  lich: true,
  chay: ({ dh, mau }, { boi }) =>
    sua("sanxuat", dh, { mau: mau || undefined }, boi),
});

const ghiMoc = lenh({
  schema: z.object({
    dh: ma,
    moc: z.enum(["m1", "m2", "m3", "m4", "m5"]),
    ngay: ngayTuyY,
  }),
  quyen: (n) => yeuCauViec(n, "chia"),
  lich: true,
  chay: async ({ dh, moc, ngay: n }, { boi }) => {
    const sx = await layMot<SanXuat>("sanxuat", dh, `đơn ${dh}`);
    const mocMoi = { ...(sx.moc ?? {}) };
    if (n) mocMoi[moc] = n;
    else delete mocMoi[moc];
    return sua("sanxuat", dh, { moc: mocMoi }, boi);
  },
});

const ghiKtsx = lenh({
  schema: z.object({ dh: ma, ma: chu(80).min(1), ktsx: chu(2000) }),
  quyen: (n) => yeuCauViec(n, "chia"),
  chay: async ({ dh, ma: maHang, ktsx }, { boi, nguoi }) => {
    const sx = await layMot<SanXuat>("sanxuat", dh, `đơn ${dh}`);
    if (!sx.items.some((i) => i.ma === maHang))
      throw khongTimThay(`mã hàng ${maHang}`);
    const items = sx.items.map((i) =>
      i.ma === maHang
        ? rong({
            ...i,
            ktsx: ktsx || undefined,
            ktsxBy: nguoi.ten,
            ktsxAt: bayGio(),
          })
        : i,
    );
    return sua("sanxuat", dh, { items }, boi);
  },
});

async function duLieuSanXuat() {
  return taoChiMuc(
    await taiCollections([
      "sanxuat",
      "phancong",
      "giaohang",
      "hopdong",
      "donhang",
      "doituong",
      "congno",
      "denghichi",
      "phieukho",
    ]),
  );
}

const chiaViec = lenh({
  schema: z.object({
    dh: ma,
    ma: chu(80).min(1),
    khau: en(TEN_KHAU),
    dt: ma,
    sl: soLuong,
    dg: tienTuyY,
    han: ngayTuyY,
    ghichu: chuTuyY(1000),
    tru: chuTuyY(120),
  }),
  quyen: (n) => yeuCauViec(n, "chia"),
  lich: true,
  chay: async (v, { boi }) => {
    if (v.khau === "Bao bì")
      throw new LoiSoTay("Bao bì đặt ở ô Bao bì (thủ kho).");
    const cm = await duLieuSanXuat();
    const sx = cm.sx.get(v.dh);
    if (!sx) throw khongTimThay(`đơn ${v.dh}`);
    if (sx.tt !== "nhan") throw new LoiSoTay("Xưởng chưa nhận đơn này.");
    const item = sx.items.find((i) => i.ma === v.ma);
    if (!item) throw khongTimThay(`mã hàng ${v.ma}`);
    if (v.khau === "In tại nhà máy" && !item.in)
      throw new LoiSoTay("Mã này không in hoa văn.");
    const dt = cm.dt.get(v.dt);
    if (!dt) throw khongTimThay(`cơ sở ${v.dt}`);
    const daChia = (cm.pcTheoDon.get(v.dh) ?? [])
      .filter((p) => p.khau === v.khau && p.ma === v.ma)
      .reduce((s, p) => s + (p.sl ?? 0), 0);
    const con = item.qty - daChia;
    if (v.sl > con)
      throw new LoiSoTay(`Vượt số còn lại: chỉ còn ${fq(con)} để chia.`);

    const khau = KHAU.find((k) => k.ten === v.khau);
    let ghichu = v.ghichu;
    let tru: string | undefined;
    const nguoiNhaMay =
      dt.l === "Nhân sự nhà máy" || dt.g === "In, mẫu, hoàn thiện mẫu";
    if (v.khau === "Nhập kho" && nguoiNhaMay) {
      if (!v.tru)
        throw new LoiSoTay(
          'Người nhà máy làm Nhập kho: phải chọn "Trừ tiền vào cơ sở hoàn thiện".',
        );
      if (!v.dg) throw new LoiSoTay('Phải nhập "Tiền trừ vào cơ sở (đ/cái)".');
      tru = v.tru;
      const auto = `Nhà máy làm nhập kho thay, trừ ${fm(v.dg)} đ/cái vào ${tenDt(cm, v.tru)}`;
      ghichu = ghichu ? `${auto}. ${ghichu}` : auto;
    } else if (khau?.cp && v.khau !== "Nhập kho" && !v.dg) {
      throw new LoiSoTay("Khâu này phải nhập đơn giá tạm tính.");
    }
    return taoMoi(
      "phancong",
      rong({
        _id: rid("PC"),
        dh: v.dh,
        ma: v.ma,
        khau: v.khau,
        dt: v.dt,
        sl: v.sl,
        dg: v.dg,
        han: v.han || undefined,
        ghichu,
        tru,
        ls: [],
      }),
      boi,
    );
  },
});

const datBaoBi = lenh({
  schema: z.object({
    dh: ma,
    dt: ma,
    han: ngayTuyY,
    dong: z
      .array(z.object({ ma: chu(120).min(1), sl: soLuong, dg: tien }))
      .min(1, "Chưa chọn dòng bao bì nào."),
  }),
  quyen: (n) => yeuCauViec(n, "baobi"),
  lich: true,
  chay: async (v, { boi }) => {
    const m = await soTayModels();
    const dt = (await m.doituong.findById(v.dt).lean()) as DoiTuong | null;
    if (!dt) throw khongTimThay(`cơ sở ${v.dt}`);
    if (dt.g !== "Bao bì") throw new LoiSoTay("Chỉ chọn cơ sở nhóm Bao bì.");
    return trongGiaoDich(async (session) => {
      const kq = [];
      for (const d of v.dong) {
        kq.push(
          await taoMoi(
            "phancong",
            rong({
              _id: rid("PC"),
              dh: v.dh,
              ma: d.ma,
              khau: "Bao bì",
              dt: v.dt,
              sl: d.sl,
              dg: d.dg,
              han: v.han || undefined,
              ls: [],
            }),
            { ...boi, session },
          ),
        );
      }
      return kq;
    });
  },
});

const quyenPhanCong = async (nguoi: NguoiSoTay, id: string) => {
  const pc = await layMot<PhanCong>("phancong", id, "phần việc");
  yeuCauViec(nguoi, pc.khau === "Bao bì" ? "baobi" : "chia");
  return pc;
};

const doiGia = lenh({
  schema: z.object({ id: ma, dg: z.number().int().min(0) }),
  quyen: ai,
  lich: true,
  chay: async ({ id, dg }, { boi, nguoi }) => {
    const pc = await quyenPhanCong(nguoi, id);
    if (pc.huy) throw new LoiSoTay("Phần việc đã hủy.");
    return sua(
      "phancong",
      id,
      {
        dg,
        ls: [...(pc.ls ?? []), { dg: pc.dg, at: bayGio(), by: nguoi.ten }],
      },
      boi,
    );
  },
});

const huyPhanCong = lenh({
  schema: z.object({ id: ma, lydo: chu(500) }),
  quyen: ai,
  lich: true,
  chay: async ({ id, lydo }, { boi, nguoi }) => {
    await quyenPhanCong(nguoi, id);
    const m = await soTayModels();
    if (await m.giaohang.exists({ pc: id, huy: { $exists: false } })) {
      throw new LoiSoTay(
        "Phần việc đã có phiếu nhận hàng. Hủy phiếu nhận trước.",
      );
    }
    return huy("phancong", id, lydo, boi);
  },
});

const nhanHang = lenh({
  schema: z.object({
    pc: ma,
    ngay,
    sl: z.number().min(0),
    loi: z.number().min(0).optional(),
    ghichu: chuTuyY(1000),
  }),
  quyen: (n) => yeuCauViec(n, "nhan"),
  lich: true,
  chay: async (v, { boi }) => {
    const pc = await layMot<PhanCong>("phancong", v.pc, "phần việc");
    if (pc.huy) throw new LoiSoTay("Phần việc đã hủy.");
    if ((v.loi ?? 0) > 0 && !v.ghichu)
      throw new LoiSoTay("Có hàng lỗi thì phải ghi lý do lỗi.");
    if (v.sl <= 0 && !(v.loi ?? 0))
      throw new LoiSoTay("Nhập số đạt hoặc số lỗi.");
    return taoMoi("giaohang", rong({ _id: rid("GH"), dh: pc.dh, ...v }), boi);
  },
});

const huyGiaoHang = lenh({
  schema: z.object({ id: ma, lydo: chu(500) }),
  quyen: (n) => yeuCauViec(n, "nhan"),
  lich: true,
  chay: ({ id, lydo }, { boi }) => huy("giaohang", id, lydo, boi),
});

const ghiQc1 = lenh({
  schema: z.object({ dh: ma, ngay: ngayTuyY }),
  quyen: (n) => yeuCauViec(n, "qc1"),
  lich: true,
  chay: ({ dh, ngay: n }, { boi, nguoi }) =>
    sua(
      "sanxuat",
      dh,
      { qc1: n ? { ngay: n, by: nguoi.ten } : undefined },
      boi,
    ),
});

const ghiGiao = lenh({
  schema: z.object({ dh: ma, ngay: ngayTuyY }),
  quyen: (n) => yeuCauViec(n, "giaohang"),
  lich: true,
  chay: ({ dh, ngay: n }, { boi, nguoi }) =>
    sua(
      "sanxuat",
      dh,
      { giao: n ? { ngay: n, by: nguoi.ten } : undefined },
      boi,
    ),
});

// ---------------------------------------------------------------- Hợp đồng, tiền

const kyHopDong = lenh({
  schema: z.object({
    dh: ma,
    dt: ma,
    so: chu(60).min(1, "Thiếu số hợp đồng."),
    ngay,
  }),
  quyen: (n) => yeuCauViec(n, "hd"),
  lich: true,
  chay: async (v, { boi }) => {
    const cm = await duLieuSanXuat();
    const h = sxCalc(cm, v.dh, v.dt);
    if (h.pcs.length === 0)
      throw new LoiSoTay("Cơ sở chưa có phần việc tính tiền trong đơn này.");
    const id = khoa(v.dh, v.dt);
    const cu = cm.hd.get(id);
    if (!cu) {
      return taoMoi(
        "hopdong",
        {
          _id: id,
          dh: v.dh,
          dt: v.dt,
          so: v.so,
          ngay: v.ngay,
          gt: h.gt,
          ls: [],
        },
        boi,
      );
    }
    const ls = cu.so
      ? [
          ...(cu.ls ?? []),
          rong({ so: cu.so, ngay: cu.ngay, gt: cu.gt, by: cu.by, at: cu.at }),
        ]
      : (cu.ls ?? []);
    return sua("hopdong", id, { so: v.so, ngay: v.ngay, gt: h.gt, ls }, boi);
  },
});

const ghiCongNoHd = lenh({
  schema: z.object({ dh: ma, dt: ma, ngay: ngay.optional() }),
  quyen: (n) => yeuCauViec(n, "congno"),
  chay: async (v, { boi }) => {
    const cm = await duLieuSanXuat();
    const h = sxCalc(cm, v.dh, v.dt);
    if (!h.daKy) throw new LoiSoTay("Hợp đồng chưa ký.");
    const bt = butToanGhiHopDong(h);
    if (bt.length === 0)
      throw new LoiSoTay(
        "Công nợ đã khớp giá trị hợp đồng, không có gì để ghi.",
      );
    return trongGiaoDich(async (session) => {
      const kq = [];
      for (const b of bt) {
        kq.push(
          await taoMoi(
            "congno",
            rong({
              _id: rid("CN"),
              ngay: v.ngay ?? today(),
              dh: v.dh,
              dt: v.dt,
              cp: b.cp,
              nv: b.nv,
              tien: b.tien,
              hd: h.so,
              ghichu: b.lanDau
                ? `Theo hợp đồng ${h.so ?? ""}`
                : `Đổi giá tạm tính theo phụ lục ${h.so ?? ""}`,
              nguon: NGUON_HOP_DONG,
            }),
            { ...boi, session },
          ),
        );
      }
      return kq;
    });
  },
});

const deNghi = lenh({
  schema: z.object({
    dh: ma,
    dt: ma,
    cp: en(CP).optional(),
    loai: z.enum(["Tạm ứng", "Thanh toán"]),
    tien,
    han: ngayTuyY,
    hd: chuTuyY(60),
    ghichu: chuTuyY(1000),
    xacNhan,
  }),
  quyen: (n) => yeuCauViec(n, "hd"),
  chay: async ({ xacNhan: ok, ...v }, { boi }) => {
    const cm = await duLieuSanXuat();
    const h = sxCalc(cm, v.dh, v.dt);
    if (!ok) {
      if (v.loai === "Thanh toán" && v.tien > h.conDeNghi) {
        throw new CanhBao(
          `Số đề nghị ${fm(v.tien)} đ vượt số còn có thể đề nghị ${fm(h.conDeNghi)} đ. Bấm Gửi lần nữa để vẫn gửi.`,
        );
      }
      if (v.loai === "Tạm ứng" && !h.coTamUng) {
        throw new CanhBao(
          "Hợp đồng này không thuộc diện được tạm ứng. Bấm Gửi lần nữa để vẫn gửi.",
        );
      }
      if (v.loai === "Tạm ứng" && v.tien > h.deNghiUng) {
        throw new CanhBao(
          `Vượt mức tạm ứng 30% còn được đề nghị (${fm(h.deNghiUng)} đ). Bấm Gửi lần nữa để vẫn gửi.`,
        );
      }
    }
    return taoMoi(
      "denghichi",
      rong({
        _id: rid("DN"),
        ngay: today(),
        ...v,
        cp: v.cp ?? (Object.keys(h.byCP)[0] as string | undefined),
        hd: v.hd || h.so,
        han: v.han || undefined,
        tt: "cho",
      }),
      boi,
    );
  },
});

const ghiCongNo = lenh({
  schema: z.object({
    ngay,
    dh: chuTuyY(60),
    dt: ma,
    cp: en(CP).optional(),
    nv: en(NV_DS),
    tien,
    hd: chuTuyY(60),
    ghichu: chuTuyY(1000),
    xacNhan,
  }),
  quyen: (n) => yeuCauViec(n, "congno"),
  chay: async ({ xacNhan: ok, ...v }, { boi }) => {
    if (NV[v.nv] < 0 && !ok) {
      const cm = taoChiMuc(
        await taiCollections(["congno", "phieukho"], { sodu: true }),
      );
      const cap = congNoTheoCap(cm).find(
        (c) => c.dh === (v.dh ?? "") && c.dt === v.dt,
      );
      const no = cap?.conNo ?? 0;
      if (v.tien > no) {
        throw new CanhBao(
          `Số tiền ${fm(v.tien)} đ vượt số còn nợ ${fm(no)} đ của đơn – cơ sở này. Bấm Ghi lần nữa để vẫn ghi.`,
        );
      }
    }
    return taoMoi("congno", rong({ _id: rid("CN"), ...v }), boi);
  },
});

const huyCongNo = lenh({
  schema: z.object({ id: ma, lydo: chu(500) }),
  quyen: (n) => yeuCauViec(n, "congno"),
  chay: ({ id, lydo }, { boi }) => huy("congno", id, lydo, boi),
});

const thuTien = lenh({
  schema: z.object({
    ngay,
    dt: ma,
    tien,
    ht: en(HINH_THUC),
    nd: chuTuyY(1000),
  }),
  quyen: (n) => yeuCauViec(n, "thu"),
  chay: (v, { boi }) => taoMoi("thutien", rong({ _id: rid("PT"), ...v }), boi),
});

const huyThuTien = lenh({
  schema: z.object({ id: ma, lydo: chu(500) }),
  quyen: (n) => yeuCauViec(n, "thu"),
  chay: ({ id, lydo }, { boi }) => huy("thutien", id, lydo, boi),
});

const daChi = lenh({
  schema: z.object({ id: ma, ngay, tien, ht: en(HINH_THUC) }),
  quyen: (n) => yeuCauViec(n, "chi"),
  chay: async (v, { boi, nguoi }) => {
    const dn = await layMot<DeNghiChi>("denghichi", v.id, "đề nghị chi");
    if (dn.tt !== "cho") throw new LoiSoTay("Đề nghị này đã được xử lý.", 409);
    // Tiền chỉ vào công nợ khi kế toán công ty đã chi thật.
    return trongGiaoDich(async (session) => {
      const b = { ...boi, session };
      const cnId = rid("CN");
      await taoMoi(
        "congno",
        rong({
          _id: cnId,
          ngay: v.ngay,
          dh: dn.dh,
          dt: dn.dt,
          cp: dn.cp,
          nv: dn.loai,
          tien: v.tien,
          hd: dn.hd,
          ghichu: `${dn.loai} theo đề nghị ${dn._id} · ${v.ht}`,
          nguon: "chi",
          dn: dn._id,
        }),
        b,
      );
      return sua(
        "denghichi",
        dn._id,
        {
          tt: "dachi",
          chi: {
            ngay: v.ngay,
            tien: v.tien,
            ht: v.ht,
            cn: cnId,
            by: nguoi.ten,
            at: bayGio(),
          },
        },
        b,
      );
    });
  },
});

const tuChoiDeNghi = lenh({
  schema: z.object({
    id: ma,
    lydo: chu(500).min(1, "Phải ghi lý do từ chối."),
  }),
  quyen: (n) => yeuCauViec(n, "chi"),
  chay: async ({ id, lydo }, { boi, nguoi }) => {
    const dn = await layMot<DeNghiChi>("denghichi", id, "đề nghị chi");
    if (dn.tt !== "cho") throw new LoiSoTay("Đề nghị này đã được xử lý.", 409);
    return sua(
      "denghichi",
      id,
      { tt: "tuchoi", tuchoi: { lydo, by: nguoi.ten, at: bayGio() } },
      boi,
    );
  },
});

// ---------------------------------------------------------------- Nhân sự

const luuChamCong = lenh({
  schema: z.object({
    ngay,
    dong: z.array(
      z.object({
        nv: ma,
        cong: z.number().min(0).max(3),
        tc: z.number().min(0).max(24).optional(),
        ghichu: chuTuyY(500),
      }),
    ),
  }),
  quyen: (n) => yeuCauViec(n, "nhancong"),
  chay: async ({ ngay: n, dong }, { boi }) => {
    const m = await soTayModels();
    let soDong = 0;
    for (const d of dong) {
      const id = `${n}~${d.nv}`;
      const du = { cong: d.cong, tc: d.tc ?? 0, ghichu: d.ghichu || undefined };
      if (await m.chamcong.exists({ _id: id }))
        await sua("chamcong", id, du, boi);
      else
        await taoMoi(
          "chamcong",
          rong({ _id: id, ngay: n, nv: d.nv, ...du, tc: d.tc ?? 0 }),
          boi,
        );
      soDong++;
    }
    return { soDong };
  },
});

const luuLuongVp = lenh({
  schema: z.object({
    dong: z.array(
      z.object({
        nv: ma,
        luong: tienTuyY,
        congviec: chuTuyY(200),
        ghichu: chuTuyY(500),
      }),
    ),
  }),
  quyen: (n) => yeuCauViec(n, "nhancongvp"),
  chay: async ({ dong }, { boi }) => {
    const m = await soTayModels();
    for (const d of dong) {
      const du = {
        luong: d.luong,
        congviec: d.congviec || undefined,
        ghichu: d.ghichu || undefined,
      };
      if (await m.nhanvienvp.exists({ _id: d.nv }))
        await sua("nhanvienvp", d.nv, du, boi);
      else
        await taoMoi("nhanvienvp", rong({ _id: d.nv, nv: d.nv, ...du }), boi);
    }
    return { soDong: dong.length };
  },
});

// ---------------------------------------------------------------- Kho

const lapPhieu = lenh({
  schema: z.object({
    ngay,
    loai: en(TEN_LOAI_PHIEU),
    dt: chuTuyY(120),
    dh: chuTuyY(60),
    ghichu: chuTuyY(1000),
    dong: z.array(dongVatTu).min(1, "Chưa có dòng vật tư nào."),
    xacNhan,
  }),
  quyen: (n) => yeuCauViec(n, "kho"),
  chay: async ({ xacNhan: ok, ...v }, { boi }) => {
    const loai = LOAI.find((l) => l.ten === v.loai);
    if (!loai) throw new LoiSoTay("Loại phiếu không hợp lệ.");
    if (loai.dh && !v.dh) throw new LoiSoTay("Loại phiếu này cần mã đơn.");
    if (loai.dt && !v.dt)
      throw new LoiSoTay(
        loai.dt === "ncc" ? "Chọn nhà cung cấp." : "Chọn đối tượng.",
      );
    if ("lydo" in loai && !v.ghichu)
      throw new LoiSoTay("Loại phiếu này bắt buộc ghi lý do.");
    if ("gia" in loai && v.dong.some((d) => !d.dg))
      throw new LoiSoTay("Loại phiếu này cần đơn giá từng dòng.");
    const du = await taiCollections(["vattu", "phieukho"], { sodu: true });
    const vts = new Map((du.vattu ?? []).map((x) => [x._id, x]));
    for (const d of v.dong)
      if (!vts.has(d.vt)) throw khongTimThay(`vật tư ${d.vt}`);
    if (loai.h < 0 && !ok) {
      const ton = tonKho(du.vattu ?? [], du.phieukho ?? [], du.sodu?.ngay);
      const am = v.dong.filter((d) => (ton.get(d.vt) ?? 0) - d.sl < 0);
      if (am.length) {
        throw new CanhBao(
          `Xuất làm tồn âm: ${am.map((d) => `${d.vt} (tồn ${fq(ton.get(d.vt) ?? 0)})`).join(", ")}. Bấm Lưu lần nữa để vẫn lưu.`,
        );
      }
    }
    const so = rid("PK");
    return taoMoi(
      "phieukho",
      rong({ _id: so, so, ...v, dong: v.dong.map((d) => rong(d)) }),
      boi,
    );
  },
});

const huyPhieu = lenh({
  schema: z.object({ so: ma, lydo: chu(500) }),
  quyen: (n) => yeuCauViec(n, "kho"),
  chay: ({ so, lydo }, { boi }) => huy("phieukho", so, lydo, boi),
});

const datMua = lenh({
  schema: z.object({
    ncc: ma,
    han: ngayTuyY,
    ghichu: chuTuyY(1000),
    dong: z.array(dongVatTu).min(1, "Chưa có dòng vật tư nào."),
  }),
  quyen: (n) => yeuCauViec(n, "muavt"),
  chay: (v, { boi }) => {
    const so = rid("DM");
    return taoMoi(
      "donmua",
      rong({
        _id: so,
        so,
        ngay: today(),
        ...v,
        han: v.han || undefined,
        dong: v.dong.map((d) => rong(d)),
        tt: "dat",
      }),
      boi,
    );
  },
});

const nhanDonMua = lenh({
  schema: z.object({ so: ma, ngay }),
  quyen: (n) => yeuCauViec(n, "muavt"),
  chay: async (v, { boi, nguoi }) => {
    const dm = await layMot<DonMua>("donmua", v.so, `đơn mua ${v.so}`);
    if (dm.tt === "nhan") throw new LoiSoTay("Đơn mua đã nhận hàng.", 409);
    if (dm.huy) throw new LoiSoTay("Đơn mua đã hủy.");
    return trongGiaoDich(async (session) => {
      const b = { ...boi, session };
      const pk = rid("PK");
      await taoMoi(
        "phieukho",
        rong({
          _id: pk,
          so: pk,
          ngay: v.ngay,
          loai: "Nhập mua",
          dt: dm.ncc,
          ghichu: `Nhận hàng đơn mua ${dm.so}`,
          dong: dm.dong,
        }),
        b,
      );
      return sua(
        "donmua",
        dm.so,
        {
          tt: "nhan",
          nhan: { ngay: v.ngay, phieu: pk, by: nguoi.ten, at: bayGio() },
        },
        b,
      );
    });
  },
});

const huyDonMua = lenh({
  schema: z.object({ so: ma, lydo: chu(500) }),
  quyen: (n) => yeuCauViec(n, "muavt"),
  chay: ({ so, lydo }, { boi }) => huy("donmua", so, lydo, boi),
});

// ---------------------------------------------------------------- Chi tiêu xưởng

const chiXuong = lenh({
  schema: z.object({
    ngay,
    loai: en(LOAI_CHI),
    nd: chu(500).min(1, "Thiếu nội dung."),
    tien,
    nguoinhan: chuTuyY(200),
    dh: chuTuyY(60),
    ghichu: chuTuyY(1000),
    xacNhan,
  }),
  quyen: (n) => yeuCauViec(n, "chixuong"),
  chay: async ({ xacNhan: ok, ...v }, { boi, nguoi }) => {
    const ds = (await (
      await soTayModels()
    ).chixuong
      .find({})
      .lean()) as unknown as ChiXuong[];
    if (canDuyet(v.tien)) {
      return taoMoi(
        "chixuong",
        rong({ _id: rid("CX"), kieu: "chi", ...v, tt: "cho" }),
        boi,
      );
    }
    if (!ok) {
      const canh: string[] = [];
      const quy = quyXuong(ds);
      if (v.tien > quy.con)
        canh.push(
          `Số chi lớn hơn số dư quỹ (${fm(quy.con)} đ), nhớ báo kế toán nạp quỹ.`,
        );
      const chiaNho = canhBaoChiaNho(ds, v);
      for (const c of chiaNho) {
        canh.push(
          `Cảnh báo chia nhỏ: ${c.so} khoản cho ${c.nguoinhan} ngày ${dvn(c.ngay)} cộng ${fm(c.tong)} đ (≥ 1 triệu).`,
        );
      }
      if (canh.length)
        throw new CanhBao(`${canh.join(" ")} Bấm Lưu lần nữa để vẫn lưu.`);
    }
    return taoMoi(
      "chixuong",
      rong({
        _id: rid("CX"),
        kieu: "chi",
        ...v,
        tt: "dachi",
        chi: { ngay: v.ngay, by: nguoi.ten, at: bayGio() },
      }),
      boi,
    );
  },
});

const napQuy = lenh({
  schema: z.object({ ngay, tien, nd: chuTuyY(500) }),
  quyen: (n) => yeuCauVai(n, ["ketoancty"]),
  chay: (v, { boi }) =>
    taoMoi(
      "chixuong",
      rong({ _id: rid("NQ"), kieu: "nap", ...v, nd: v.nd || "Nạp quỹ xưởng" }),
      boi,
    ),
});

const layChi = async (id: string) => {
  const c = await layMot<ChiXuong>("chixuong", id, "khoản chi");
  if (c.kieu !== "chi") throw new LoiSoTay("Không phải khoản chi.");
  return c;
};

const duyetChi = lenh({
  schema: z.object({ id: ma }),
  quyen: chiQuanLy,
  chay: async ({ id }, { boi, nguoi }) => {
    const c = await layChi(id);
    if (c.tt !== "cho" || c.duyet)
      throw new LoiSoTay("Khoản này không chờ duyệt.", 409);
    return sua("chixuong", id, { duyet: { by: nguoi.ten, at: bayGio() } }, boi);
  },
});

const khongDuyetChi = lenh({
  schema: z.object({ id: ma, lydo: chu(500).min(1, "Phải ghi lý do.") }),
  quyen: chiQuanLy,
  chay: async ({ id, lydo }, { boi, nguoi }) => {
    const c = await layChi(id);
    if (c.tt !== "cho") throw new LoiSoTay("Khoản này không chờ duyệt.", 409);
    return sua(
      "chixuong",
      id,
      { tt: "tuchoi", tuchoi: { lydo, by: nguoi.ten, at: bayGio() } },
      boi,
    );
  },
});

const daChiXuong = lenh({
  schema: z.object({ id: ma, ngay }),
  quyen: (n) => yeuCauViec(n, "chixuong"),
  chay: async ({ id, ngay: n }, { boi, nguoi }) => {
    const c = await layChi(id);
    if (c.tt !== "cho" || !c.duyet)
      throw new LoiSoTay("Khoản này chưa được Giám đốc duyệt.");
    return sua(
      "chixuong",
      id,
      { tt: "dachi", chi: { ngay: n, by: nguoi.ten, at: bayGio() } },
      boi,
    );
  },
});

// ---------------------------------------------------------------- Hoàn tác phiên

const hoanTac = lenh({
  schema: z.object({ phien: ma }),
  quyen: ai,
  lich: true,
  chay: async ({ phien }, { nguoi }) => {
    const m = await soTayModels();
    const ds = (await m.lichsu
      .find({
        phien,
        tk: nguoi.email,
        op: { $in: ["Tạo mới", "Sửa", "Hủy", "Xóa"] },
      })
      .sort({ at: -1, _id: -1 })
      .lean()) as unknown as Array<{
      _id: string;
      col: TenCollection;
      id: string;
      op: string;
      tom?: string;
      truoc?: Record<string, unknown> | null;
      tab?: string;
    }>;
    if (ds.length === 0) return { soDong: 0 };
    await trongGiaoDich(async (session) => {
      for (const d of ds) {
        const model = m[d.col];
        if (d.op === "Tạo mới")
          await model.deleteOne({ _id: d.id }, { session });
        else if (d.truoc)
          await model.replaceOne({ _id: d.id }, d.truoc, {
            upsert: true,
            session,
          });
        await m.lichsu.create(
          [
            {
              _id: rid("LS"),
              at: bayGio(),
              by: nguoi.email,
              ten: nguoi.ten,
              tk: nguoi.email,
              tab: d.tab,
              col: d.col,
              id: d.id,
              op: d.op === "Tạo mới" ? "Xóa" : "Sửa",
              tom: `Hoàn tác (Hủy chỉnh sửa): ${d.tom ?? ""}`,
              truoc: null,
            },
          ],
          { session },
        );
      }
    });
    return { soDong: ds.length };
  },
});

// ---------------------------------------------------------------- Danh sách

export const LENH = {
  taoDoiTuong,
  suaDoiTuong,
  xoaDoiTuong,
  taoDonHang,
  suaDonHang,
  xoaDonHang,
  taoVatTu,
  suaVatTu,
  xoaVatTu,
  doiVaiTro,
  suaMauTienDo,
  guiDon,
  nhanDon,
  chonMau,
  ghiMoc,
  ghiKtsx,
  chiaViec,
  datBaoBi,
  doiGia,
  huyPhanCong,
  nhanHang,
  huyGiaoHang,
  ghiQc1,
  ghiGiao,
  kyHopDong,
  ghiCongNoHd,
  deNghi,
  ghiCongNo,
  huyCongNo,
  thuTien,
  huyThuTien,
  daChi,
  tuChoiDeNghi,
  luuChamCong,
  luuLuongVp,
  lapPhieu,
  huyPhieu,
  datMua,
  nhanDonMua,
  huyDonMua,
  chiXuong,
  napQuy,
  duyetChi,
  khongDuyetChi,
  daChiXuong,
  hoanTac,
} as const;

export type TenLenh = keyof typeof LENH;

const MA_TAB = new Set<string>(TABS.map((t) => t.ma));

/** Chạy một lệnh: kiểm quyền, kiểm đầu vào, ghi, rồi tính lại lịch nếu cần. */
export async function chayLenh(
  ten: string,
  body: unknown,
  nguoi: NguoiSoTay,
): Promise<unknown> {
  const l = (LENH as Record<string, Lenh<z.ZodType>>)[ten];
  if (!l) throw new LoiSoTay("Lệnh không tồn tại.", 404);
  const goi = z
    .object({
      tab: z.string().optional(),
      phien: z.string().max(80).optional(),
      du: z.unknown(),
    })
    .parse(body);
  l.quyen(nguoi);
  const input = l.schema.parse(goi.du);
  const tab = goi.tab && MA_TAB.has(goi.tab) ? (goi.tab as MaTab) : null;
  const boi: BoiCanh = {
    nguoi: { email: nguoi.email, ten: nguoi.ten },
    tab,
    ...(goi.phien ? { phien: goi.phien } : {}),
  };
  const kq = await l.chay(input, { nguoi, boi });
  if (l.lich) await capNhatLich();
  return kq;
}
