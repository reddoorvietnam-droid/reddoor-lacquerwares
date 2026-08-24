import "server-only";

import type { AuditRepository } from "@/domains/audit/contracts";
import type {
  AuthorizationRepository,
  ContentPermission,
} from "@/domains/identity/contracts";
import {
  ContentAccessDeniedError,
  evaluateContentPermission,
  type AccessContext,
  type AccessDenialCode,
  type ContentPermissionTarget,
  type SessionIdentity,
} from "@/lib/auth/authorization";

export type SessionIdentityResolution =
  | { configured: false }
  | { configured: true; identity: SessionIdentity | null };

export type PermissionGuardDependencies = {
  resolveSessionIdentity: () => Promise<SessionIdentityResolution>;
  authorizationRepository: AuthorizationRepository;
  auditRepository: AuditRepository;
  now?: () => Date;
  createRequestId?: () => string;
};

export type RequireContentPermissionOptions = ContentPermissionTarget & {
  requestId?: string;
  correlationId?: string;
};

function safeRequestId(value: string | undefined): string | null {
  return value && /^[a-zA-Z0-9._:-]{1,255}$/.test(value) ? value : null;
}

async function appendDenialAudit(
  dependencies: PermissionGuardDependencies,
  input: {
    identity: SessionIdentity | null;
    permission: ContentPermission;
    options: RequireContentPermissionOptions;
    requestId: string;
    code: AccessDenialCode;
    occurredAt: Date;
  },
): Promise<void> {
  try {
    await dependencies.auditRepository.append({
      actor: input.identity
        ? { type: "user", userId: input.identity.userId }
        : { type: "system", systemName: "authorization-guard" },
      action: "authorization.denied",
      resourceType: "content",
      resourceId: input.options.resourceId ?? null,
      businessUnitIds: input.options.businessUnitIds ?? [],
      requestId: input.requestId,
      ...(input.options.correlationId
        ? { correlationId: input.options.correlationId }
        : {}),
      permissionDecision: {
        permission: input.permission,
        outcome: "denied",
        reasonCode: input.code,
        scope: null,
      },
      occurredAt: input.occurredAt,
    });
  } catch {
    // Authorization remains denied even if the audit store is unavailable.
  }
}

export function createContentPermissionGuard(
  dependencies: PermissionGuardDependencies,
): (
  permission: ContentPermission,
  options?: RequireContentPermissionOptions,
) => Promise<AccessContext> {
  return async (permission, options = {}) => {
    const occurredAt = dependencies.now?.() ?? new Date();
    const requestId =
      safeRequestId(options.requestId) ??
      dependencies.createRequestId?.() ??
      globalThis.crypto.randomUUID();
    let resolution: SessionIdentityResolution;

    try {
      resolution = await dependencies.resolveSessionIdentity();
    } catch {
      await appendDenialAudit(dependencies, {
        identity: null,
        permission,
        options,
        requestId,
        code: "AUTHORIZATION_UNAVAILABLE",
        occurredAt,
      });
      throw new ContentAccessDeniedError("AUTHORIZATION_UNAVAILABLE");
    }

    if (!resolution.configured) {
      await appendDenialAudit(dependencies, {
        identity: null,
        permission,
        options,
        requestId,
        code: "AUTH_NOT_CONFIGURED",
        occurredAt,
      });
      throw new ContentAccessDeniedError("AUTH_NOT_CONFIGURED");
    }

    if (!resolution.identity) {
      await appendDenialAudit(dependencies, {
        identity: null,
        permission,
        options,
        requestId,
        code: "UNAUTHENTICATED",
        occurredAt,
      });
      throw new ContentAccessDeniedError("UNAUTHENTICATED");
    }

    let snapshot;
    try {
      snapshot =
        await dependencies.authorizationRepository.findSnapshotByUserId(
          resolution.identity.userId,
        );
    } catch {
      await appendDenialAudit(dependencies, {
        identity: resolution.identity,
        permission,
        options,
        requestId,
        code: "AUTHORIZATION_UNAVAILABLE",
        occurredAt,
      });
      throw new ContentAccessDeniedError("AUTHORIZATION_UNAVAILABLE");
    }

    if (!snapshot) {
      await appendDenialAudit(dependencies, {
        identity: resolution.identity,
        permission,
        options,
        requestId,
        code: "USER_NOT_FOUND",
        occurredAt,
      });
      throw new ContentAccessDeniedError("USER_NOT_FOUND");
    }

    const decision = evaluateContentPermission({
      session: resolution.identity,
      snapshot,
      permission,
      target: options,
      requestId,
      now: occurredAt,
    });

    if (!decision.allowed) {
      await appendDenialAudit(dependencies, {
        identity: resolution.identity,
        permission,
        options,
        requestId,
        code: decision.code,
        occurredAt,
      });
      throw new ContentAccessDeniedError(decision.code);
    }

    return decision.context;
  };
}
