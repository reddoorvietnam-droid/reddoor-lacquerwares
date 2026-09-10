import {
  materialsCapabilities,
  requireMaterialsAccess,
} from "@/domains/materials/access";
import { failure, json, readJsonBody } from "@/domains/materials/http";
import {
  cancelTransaction,
  listTransactions,
  saveTransactions,
} from "@/domains/materials/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireMaterialsAccess("read");
    return json(await listTransactions(new URL(request.url).searchParams));
  } catch (error) {
    return failure(error);
  }
}

/** Nhập/xuất lines: the service refuses each type the caller may not write. */
export async function POST(request: Request) {
  try {
    const access = await requireMaterialsAccess("read");
    const body = await readJsonBody(request);
    const capabilities = await materialsCapabilities();
    return json(
      await saveTransactions(body, access.userId, {
        receive: capabilities.receive,
        issue: capabilities.issue,
      }),
    );
  } catch (error) {
    return failure(error);
  }
}

/** Hủy dòng: status CANCELLED with a reason, never a hard delete. */
export async function DELETE(request: Request) {
  try {
    const access = await requireMaterialsAccess("cancel");
    const body = await readJsonBody(request);
    return json({ row: await cancelTransaction(body, access.userId) });
  } catch (error) {
    return failure(error);
  }
}
