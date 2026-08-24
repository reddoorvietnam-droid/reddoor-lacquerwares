import "server-only";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoIdentityRepository } from "@/domains/identity/mongo-repository";
import { createContentPermissionGuard } from "@/lib/auth/guard";
import { resolveSessionIdentity } from "@/lib/auth/session";

export type {
  AccessContext,
  ContentPermissionTarget,
} from "@/lib/auth/authorization";
export { ContentAccessDeniedError } from "@/lib/auth/authorization";
export type { RequireContentPermissionOptions } from "@/lib/auth/guard";

export const requireContentPermission = createContentPermissionGuard({
  resolveSessionIdentity,
  authorizationRepository: mongoIdentityRepository,
  auditRepository: mongoAuditRepository,
});
