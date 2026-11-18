import { TABS, xemTab } from "@/domains/so-tay/hang-so";
import { json, loi } from "@/domains/so-tay/http";
import { soTayModels } from "@/domains/so-tay/models";
import { yeuCauNguoi, yeuCauTab } from "@/domains/so-tay/truy-cap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 300 dòng lịch sử gần nhất của một tab (?tab=) hoặc mọi tab (?tatca=1).
 * Chỉ trả dòng của tab người dùng được xem (dòng lịch sử ghi giá trị cũ → mới,
 * ví dụ số tiền công nợ), cộng các dòng không gắn tab (đăng nhập, nạp dữ liệu).
 */
export async function GET(request: Request) {
  try {
    const nguoi = await yeuCauNguoi();
    const q = new URL(request.url).searchParams;
    const tab = TABS.find((t) => t.ma === q.get("tab"))?.ma;
    const loc: Record<string, unknown> = {};
    if (q.get("tatca") !== "1" && tab) {
      yeuCauTab(nguoi, tab);
      loc.tab = tab;
    } else {
      const duocXem = TABS.filter((t) => xemTab(nguoi.vaitro, t.ma)).map(
        (t) => t.ma,
      );
      if (duocXem.length < TABS.length)
        // `tab: null` cũng khớp dòng không có trường tab.
        loc.$or = [{ tab: { $in: duocXem } }, { tab: null }];
    }
    const m = await soTayModels();
    const ds = await m.lichsu
      .find(loc, { truoc: 0 })
      .sort({ at: -1 })
      .limit(300)
      .lean();
    return json(ds);
  } catch (error) {
    return loi(error);
  }
}
