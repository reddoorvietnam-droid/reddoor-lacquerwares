import {
  requirePaintAccess,
  paintCapabilities,
} from "@/domains/paint-warehouse/access";
import {
  failure,
  json,
  readJsonBody,
  responseHeaders,
} from "@/domains/paint-warehouse/http";
import {
  batchSchema,
  readRows,
  readMasters,
  saveRows,
  deleteRow,
  rowFilter,
  toRow,
  type StoredRow,
} from "@/domains/paint-warehouse/service";
import { exportPaintWorkbook } from "@/domains/paint-warehouse/export-workbook";
import { getPaintRowModel } from "@/domains/paint-warehouse/models";
import { connectToDatabase } from "@/lib/db/mongoose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePaintAccess("read");
    const params = new URL(request.url).searchParams;
    if (params.get("export") === "1") {
      await requirePaintAccess("export");
      await connectToDatabase();
      const rows = await getPaintRowModel()
        .find(rowFilter(params))
        .sort({ exportDate: 1, _id: 1 })
        .lean<StoredRow[]>()
        .exec();
      return new Response(
        new Uint8Array(await exportPaintWorkbook(rows.map(toRow))),
        {
          headers: {
            ...responseHeaders,
            "content-type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "content-disposition":
              'attachment; filename="BANG-XUAT-KHO-SON.xlsx"',
          },
        },
      );
    }
    if (params.get("masters") === "1")
      return json({
        masters: await readMasters(),
        capabilities: await paintCapabilities(),
      });
    return json(await readRows(params));
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const access = await requirePaintAccess("read");
    const input = batchSchema.parse(await readJsonBody(request));
    if (input.changes.some((c) => c.version === 0))
      await requirePaintAccess("create");
    if (input.changes.some((c) => c.version > 0))
      await requirePaintAccess("update");
    return json({ rows: await saveRows(input, access.userId) });
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const access = await requirePaintAccess("delete");
    await deleteRow(await readJsonBody(request), access.userId);
    return json({ deleted: true });
  } catch (error) {
    return failure(error);
  }
}
