import type { MaTab } from "@/domains/so-tay/hang-so";
import type { DuLieu, LichSu } from "@/domains/so-tay/kieu";
import type { TrangDau } from "@/domains/so-tay/du-lieu";

export type KetQuaLenh =
  | { ok: true; ketQua: unknown }
  | { ok: false; canhBao: boolean; message: string; status: number };

async function docLoi(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    return body.message ?? `Lỗi ${res.status}`;
  } catch {
    return `Lỗi ${res.status}`;
  }
}

export async function taiTab(tab: MaTab): Promise<DuLieu> {
  const res = await fetch(`/api/so-tay/tab/${tab}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await docLoi(res));
  return (await res.json()) as DuLieu;
}

export async function taiTrangDau(): Promise<TrangDau> {
  const res = await fetch("/api/so-tay/trang-dau", { cache: "no-store" });
  if (!res.ok) throw new Error(await docLoi(res));
  return (await res.json()) as TrangDau;
}

export async function taiLichSu(tab: MaTab | null): Promise<LichSu[]> {
  const q = tab ? `tab=${tab}` : "tatca=1";
  const res = await fetch(`/api/so-tay/lich-su?${q}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await docLoi(res));
  return (await res.json()) as LichSu[];
}

export async function guiLenh(
  lenh: string,
  du: unknown,
  tab: MaTab | null,
  phien: string | null,
): Promise<KetQuaLenh> {
  try {
    const res = await fetch(`/api/so-tay/lenh/${lenh}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tab: tab ?? undefined,
        phien: phien ?? undefined,
        du,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      ketQua?: unknown;
      message?: string;
      canhBao?: boolean;
    };
    if (res.ok && body.ok) return { ok: true, ketQua: body.ketQua };
    return {
      ok: false,
      canhBao: Boolean(body.canhBao),
      message: body.message ?? `Lỗi ${res.status}`,
      status: res.status,
    };
  } catch {
    return {
      ok: false,
      canhBao: false,
      message: "Mất kết nối, thử lại.",
      status: 0,
    };
  }
}
