import "server-only";
import { cache } from "react";
import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoIdentityRepository } from "@/domains/identity/mongo-repository";
import { createPermissionGuard } from "@/lib/auth/guard";
import { resolveSessionIdentity } from "@/lib/auth/session";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";
import {
  capabilityActions,
  type Capabilities,
  type SalesSlipAction,
} from "./contracts";

/**
 * Sales slips are company-wide (the workbook has no business unit), so only
 * explicit global grants (`salesSlips.*` at scope `all`) reach them. Built
 * without the dev open-access bypass so a developer machine still exercises
 * the real grants, the same way the paint and material ledgers do.
 */
const guard = createPermissionGuard({
  resolveSessionIdentity: cache(resolveSessionIdentity),
  authorizationRepository: mongoIdentityRepository,
  auditRepository: mongoAuditRepository,
});

export const requireSalesSlipAccess = (
  action: SalesSlipAction,
): Promise<AccessContext> => guard(`salesSlips.${action}`);

/** True/false without throwing; the answer is for projections and controls only. */
export async function hasSalesSlipAccess(
  action: SalesSlipAction,
): Promise<boolean> {
  try {
    await requireSalesSlipAccess(action);
    return true;
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) return false;
    throw error;
  }
}

/** Every action the signed-in reader may take, for hiding controls only. */
export const salesSlipCapabilities = cache(async (): Promise<Capabilities> => {
  const entries = await Promise.all(
    capabilityActions.map(
      async (action) => [action, await hasSalesSlipAccess(action)] as const,
    ),
  );
  return Object.fromEntries(entries) as Capabilities;
});
