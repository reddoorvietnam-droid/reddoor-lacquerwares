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
  type MaterialsAction,
} from "./contracts";

/**
 * The raw-material ledger is company-wide: the workbook has no mapping from
 * facility codes to organisation units, so only explicit global grants
 * (`materials.*` at scope `all`) reach it. Built without the dev open-access
 * bypass so a developer machine still exercises the real grants.
 */
const guard = createPermissionGuard({
  resolveSessionIdentity: cache(resolveSessionIdentity),
  authorizationRepository: mongoIdentityRepository,
  auditRepository: mongoAuditRepository,
});

export const requireMaterialsAccess = (
  action: MaterialsAction,
): Promise<AccessContext> => guard(`materials.${action}`);

/** Every action the signed-in reader may take, for hiding controls only. */
export const materialsCapabilities = cache(async (): Promise<Capabilities> => {
  const entries = await Promise.all(
    capabilityActions.map(async (action) => {
      try {
        await requireMaterialsAccess(action);
        return [action, true] as const;
      } catch (error) {
        if (error instanceof ContentAccessDeniedError)
          return [action, false] as const;
        throw error;
      }
    }),
  );
  return Object.fromEntries(entries) as Capabilities;
});

/**
 * Sidebar visibility must follow the same strict guard the page uses, or a
 * reader granted through DEV_OPEN_ACCESS or a unit-bound grant would see a
 * menu item that 404s.
 */
export const canSeeMaterials = cache(async (): Promise<boolean> => {
  try {
    await requireMaterialsAccess("read");
    return true;
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) return false;
    throw error;
  }
});
