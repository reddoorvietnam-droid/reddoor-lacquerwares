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
  type ReceivablesAction,
} from "./contracts";

/**
 * Công nợ is company-wide: a customer debt belongs to the company, not to a
 * business unit, so only explicit global grants (`customerDebt.*` at scope
 * `all`) reach it. Built without the dev open-access bypass so a developer
 * machine still exercises the real grants.
 */
const guard = createPermissionGuard({
  resolveSessionIdentity: cache(resolveSessionIdentity),
  authorizationRepository: mongoIdentityRepository,
  auditRepository: mongoAuditRepository,
});

export const requireReceivablesAccess = (
  action: ReceivablesAction,
): Promise<AccessContext> => guard(`customerDebt.${action}`);

/** Every action the signed-in reader may take, for hiding controls only. */
export const receivablesCapabilities = cache(
  async (): Promise<Capabilities> => {
    const entries = await Promise.all(
      capabilityActions.map(async (action) => {
        try {
          await requireReceivablesAccess(action);
          return [action, true] as const;
        } catch (error) {
          if (error instanceof ContentAccessDeniedError)
            return [action, false] as const;
          throw error;
        }
      }),
    );
    return Object.fromEntries(entries) as Capabilities;
  },
);

/**
 * Whether the reader may see money. Every server response consults this before
 * it puts an amount in the payload: a reader without it receives blank fields,
 * not a number the browser is asked politely not to render.
 */
export const canReadAmounts = cache(async (): Promise<boolean> => {
  try {
    await requireReceivablesAccess("readAmount");
    return true;
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) return false;
    throw error;
  }
});

/**
 * Sidebar visibility must follow the same strict guard the page uses, or a
 * reader granted through DEV_OPEN_ACCESS or a unit-bound grant would see a
 * menu item that 404s.
 */
export const canSeeReceivables = cache(async (): Promise<boolean> => {
  try {
    await requireReceivablesAccess("read");
    return true;
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) return false;
    throw error;
  }
});
