import { loi } from "@/domains/so-tay/http";
import { khongTimThay } from "@/domains/so-tay/loi";
import { soTayModels } from "@/domains/so-tay/models";
import { yeuCauNguoi } from "@/domains/so-tay/truy-cap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ ten: string }> };

/** Ảnh sản phẩm trong database Sổ tay; chỉ người đã đăng nhập Sổ tay xem được. */
export async function GET(_request: Request, context: Context) {
  try {
    await yeuCauNguoi();
    const { ten } = await context.params;
    const m = await soTayModels();
    const anh = (await m.anh.findById(decodeURIComponent(ten)).lean()) as {
      loai: string;
      du: { buffer: ArrayBuffer } | Buffer;
    } | null;
    if (!anh) throw khongTimThay("ảnh");
    const du = Buffer.isBuffer(anh.du) ? anh.du : Buffer.from(anh.du.buffer);
    return new Response(new Uint8Array(du), {
      headers: {
        "content-type": anh.loai,
        "cache-control": "private, max-age=86400",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return loi(error);
  }
}
