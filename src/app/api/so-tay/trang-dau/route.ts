import { taiTrangDau } from "@/domains/so-tay/du-lieu";
import { json, loi } from "@/domains/so-tay/http";
import { yeuCauNguoi } from "@/domains/so-tay/truy-cap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Màn hình chào: lịch sản xuất 6 tháng và công việc cần lưu ý hôm nay. */
export async function GET() {
  try {
    await yeuCauNguoi();
    return json(await taiTrangDau());
  } catch (error) {
    return loi(error);
  }
}
