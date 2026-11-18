import { taiTab } from "@/domains/so-tay/du-lieu";
import { TABS, type MaTab } from "@/domains/so-tay/hang-so";
import { json, loi } from "@/domains/so-tay/http";
import { LoiSoTay } from "@/domains/so-tay/loi";
import { yeuCauNguoi, yeuCauTab } from "@/domains/so-tay/truy-cap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ tab: string }> };

/** Dữ liệu một tab Sổ tay; kiểm quyền xem tab ở máy chủ. */
export async function GET(_request: Request, context: Context) {
  try {
    const nguoi = await yeuCauNguoi();
    const { tab } = await context.params;
    if (!TABS.some((t) => t.ma === tab))
      throw new LoiSoTay("Không có tab này.", 404);
    yeuCauTab(nguoi, tab as MaTab);
    return json(await taiTab(tab as MaTab, nguoi));
  } catch (error) {
    return loi(error);
  }
}
