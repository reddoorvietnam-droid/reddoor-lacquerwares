import "server-only";
import { cache } from "react";
import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoIdentityRepository } from "@/domains/identity/mongo-repository";
import { createPermissionGuard } from "@/lib/auth/guard";
import { resolveSessionIdentity } from "@/lib/auth/session";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";

// This workbook is a company-wide ledger, with no reliable mapping from Excel
// facility codes to organization units. Only explicit global grants reach it.
const guard = createPermissionGuard({
  resolveSessionIdentity: cache(resolveSessionIdentity),
  authorizationRepository: mongoIdentityRepository,
  auditRepository: mongoAuditRepository,
});
export const actions = [
  "read",
  "create",
  "update",
  "delete",
  "export",
  "import",
] as const;
export type PaintAction = (typeof actions)[number];
export const requirePaintAccess = (action: PaintAction) =>
  guard(`paintWarehouse.${action}`);
export const paintCapabilities = cache(async () => {
  const entries = await Promise.all(
    actions.map(async (action) => {
      try {
        await requirePaintAccess(action);
        return [action, true] as const;
      } catch (error) {
        if (error instanceof ContentAccessDeniedError)
          return [action, false] as const;
        throw error;
      }
    }),
  );
  return Object.fromEntries(entries) as Record<PaintAction, boolean>;
});
