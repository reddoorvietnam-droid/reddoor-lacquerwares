import "server-only";

import type { ContentPermission } from "@/domains/identity/contracts";
import {
  ContentAccessDeniedError,
  requireContentPermission,
  type AccessContext,
  type RequireContentPermissionOptions,
} from "@/lib/auth";
import type { AccessDenialCode } from "@/lib/auth/authorization";
import { inspectAuthEnv, inspectMongoEnv } from "@/lib/env/server";

export type LeafAccessResult =
  | { allowed: true; context: AccessContext }
  | { allowed: false; code: AccessDenialCode | "LAYOUT_HANDLES_SETUP" };

export async function resolveLeafContentAccess(
  permission: ContentPermission,
  options?: RequireContentPermissionOptions,
): Promise<LeafAccessResult> {
  if (!inspectMongoEnv().configured || !inspectAuthEnv().configured) {
    return { allowed: false, code: "LAYOUT_HANDLES_SETUP" };
  }

  try {
    return {
      allowed: true,
      context: await requireContentPermission(permission, options),
    };
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) {
      return { allowed: false, code: error.code };
    }
    throw error;
  }
}
