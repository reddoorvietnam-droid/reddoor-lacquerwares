import { kiemNguon, json, loi } from "@/domains/so-tay/http";
import { chayLenh } from "@/domains/so-tay/lenh";
import { LoiSoTay } from "@/domains/so-tay/loi";
import { yeuCauNguoi } from "@/domains/so-tay/truy-cap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ lenh: string }> };

/** Lệnh ghi của Sổ tay: { tab, phien, du }. */
export async function POST(request: Request, context: Context) {
  try {
    kiemNguon(request);
    const nguoi = await yeuCauNguoi();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new LoiSoTay("Dữ liệu gửi lên không đọc được.");
    }
    const { lenh } = await context.params;
    return json({ ok: true, ketQua: await chayLenh(lenh, body, nguoi) });
  } catch (error) {
    return loi(error);
  }
}
