import { z } from "zod";
import { getUserModel } from "@/domains/identity/models";
import { requireMaterialsAccess } from "@/domains/materials/access";
import { exportScopes } from "@/domains/materials/contracts";
import {
  exportFileNames,
  exportMaterialsWorkbook,
} from "@/domains/materials/export-workbook";
import { failure, responseHeaders } from "@/domains/materials/http";
import {
  getMaterialTransactionModel,
  type StoredTransaction,
} from "@/domains/materials/models";
import {
  readMasters,
  readSummary,
  toTransaction,
  transactionFilter,
} from "@/domains/materials/service";
import { connectToDatabase } from "@/lib/db/mongoose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const scopeSchema = z.enum(exportScopes);
const ledgerOrder = { transactionDate: 1, createdAt: 1, _id: 1 } as const;

/** One scope per tab; the ledger filters (from, to, q, materialId, facilityId) travel along. */
export async function GET(request: Request) {
  try {
    const access = await requireMaterialsAccess("export");
    const params = new URL(request.url).searchParams;
    const scope = scopeSchema.parse(params.get("scope") ?? "all");
    const wants = (name: (typeof exportScopes)[number]) =>
      scope === "all" || scope === name;
    await connectToDatabase();

    const ledger = async (type: "INBOUND" | "OUTBOUND") => {
      const query = new URLSearchParams(params);
      query.set("type", type);
      query.set("status", "POSTED");
      const rows = await getMaterialTransactionModel()
        .find(transactionFilter(query))
        .sort(ledgerOrder)
        .lean<StoredTransaction[]>()
        .exec();
      return rows.map(toTransaction);
    };
    const [summary, inbound, outbound, masters, user] = await Promise.all([
      wants("summary") ? readSummary(new URLSearchParams()) : null,
      wants("inbound") ? ledger("INBOUND") : [],
      wants("outbound") ? ledger("OUTBOUND") : [],
      scope === "all" ? readMasters() : { materials: [], facilities: [] },
      getUserModel()
        .findById(access.userId)
        .select("displayName email")
        .lean<{ displayName?: string; email?: string } | null>()
        .exec(),
    ]);
    const bytes = await exportMaterialsWorkbook({
      scope,
      summary: summary?.rows ?? [],
      inbound,
      outbound,
      materials: masters.materials,
      facilities: masters.facilities,
      preparedBy: user?.displayName?.trim() || user?.email || "",
      generatedAt: new Date(),
    });
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...responseHeaders,
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${exportFileNames[scope]}"`,
      },
    });
  } catch (error) {
    return failure(error);
  }
}
