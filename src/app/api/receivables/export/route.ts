import { getUserModel } from "@/domains/identity/models";
import { requireReceivablesAccess } from "@/domains/receivables/access";
import {
  buildWorkbook,
  exportFileNames,
  statementFileName,
} from "@/domains/receivables/export-workbook";
import { failure, responseHeaders } from "@/domains/receivables/http";
import { buildExportInput } from "@/domains/receivables/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Xuất Excel. `scope` picks the sheets; the screen's own filters (q, from, to,
 * state, sort) travel along, so the file always matches what was on screen.
 * With `customerId` it becomes that customer's debt statement.
 *
 * `buildExportInput` refuses without `customerDebt.readAmount`, so holding
 * `customerDebt.export` alone can never carry money out.
 */
export async function GET(request: Request) {
  try {
    const access = await requireReceivablesAccess("export");
    const params = new URL(request.url).searchParams;
    const user = await getUserModel()
      .findById(access.userId)
      .select("displayName email")
      .lean<{ displayName?: string; email?: string } | null>()
      .exec();
    const input = await buildExportInput(
      params,
      user?.displayName?.trim() || user?.email || "",
    );
    const bytes = await buildWorkbook(input);
    const customerCode = params.get("customerId")
      ? (input.summary[0]?.code ?? "")
      : "";
    const filename = customerCode
      ? statementFileName(customerCode)
      : exportFileNames[input.scope];
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...responseHeaders,
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return failure(error);
  }
}
