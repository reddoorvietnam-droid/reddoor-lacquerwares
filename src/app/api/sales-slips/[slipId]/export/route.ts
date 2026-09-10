import {
  hasSalesSlipAccess,
  requireSalesSlipAccess,
} from "@/domains/sales-slips/access";
import { idSchema, SalesSlipError } from "@/domains/sales-slips/contracts";
import {
  exportFileName,
  exportSalesSlipWorkbook,
} from "@/domains/sales-slips/export-workbook";
import { failure, responseHeaders } from "@/domains/sales-slips/http";
import { renderSalesSlipPdf } from "@/domains/sales-slips/pdf";
import { readSlip, recordExport } from "@/domains/sales-slips/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slipId: string }> };

const contentTypes = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

/** `GET ?format=xlsx|pdf`: the slip as the Excel form or as its PDF. */
export async function GET(request: Request, context: Context) {
  try {
    const access = await requireSalesSlipAccess("export");
    const id = idSchema.parse((await context.params).slipId);
    const format = new URL(request.url).searchParams.get("format");
    if (format !== "xlsx" && format !== "pdf")
      throw new SalesSlipError("Định dạng phải là xlsx hoặc pdf.");
    const { slip } = await readSlip(id, await hasSalesSlipAccess("readPrice"));
    const bytes =
      format === "xlsx"
        ? await exportSalesSlipWorkbook(slip)
        : await renderSalesSlipPdf(slip);
    await recordExport(slip, format, access.userId);
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...responseHeaders,
        "content-type": contentTypes[format],
        "content-disposition": `attachment; filename="${exportFileName(slip, format)}"`,
      },
    });
  } catch (error) {
    return failure(error);
  }
}
