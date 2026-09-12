import "server-only";

import { cache } from "react";
import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoIdentityRepository } from "@/domains/identity/mongo-repository";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";
import { createPermissionGuard } from "@/lib/auth/guard";
import { resolveSessionIdentity } from "@/lib/auth/session";

/**
 * Reuse the existing editorial grant so installed accounts work immediately.
 * The guard is built WITHOUT an `openAccess` dependency on purpose: the shared
 * `requirePermission` helpers pass `isDevOpenAccessEnabled`, which would hand
 * every signed-in account a global grant. Weekly sample progress stays behind
 * the real snapshot even on a developer machine.
 */
const strictGuard = createPermissionGuard({
  resolveSessionIdentity: cache(resolveSessionIdentity),
  authorizationRepository: mongoIdentityRepository,
  auditRepository: mongoAuditRepository,
});

/** The editor maintains the weekly report; the viewer only reads and exports. */
export type SampleProgressRole = "editor" | "viewer";

export type SampleProgressAccess = {
  context: AccessContext;
  userId: string;
  role: SampleProgressRole;
};

/**
 * `AccessContext.permissions` carries exactly one entry — the permission just
 * evaluated — and its `roleKeys` are the active roles that granted it. The
 * allowlist reads those rather than a permission, so another role that is
 * someday granted `content.read` still stays out. Both allowed roles edit: the
 * Director maintains the report alongside the Content Creator (confirmed
 * 2026-09-11).
 */
export function sampleProgressRole(context: AccessContext): SampleProgressRole {
  const entry = context.permissions.find(
    (candidate) =>
      candidate.permission === "content.read" && candidate.scope === "all",
  );
  // DEV_OPEN_ACCESS stamps the literal role key "DEV_OPEN_ACCESS", so a bypassed
  // context can never match either name below.
  if (
    entry?.roleKeys.some(
      (roleKey) => roleKey === "CONTENT_CREATOR" || roleKey === "DIRECTOR",
    )
  )
    return "editor";
  throw new ContentAccessDeniedError("PERMISSION_DENIED");
}

export function assertSampleProgressRole(context: AccessContext): void {
  sampleProgressRole(context);
}

/** Read access: both the Director and the Content Creator. */
export async function requireSampleProgressAccess(): Promise<SampleProgressAccess> {
  const context = await strictGuard("content.read");
  return { context, userId: context.userId, role: sampleProgressRole(context) };
}

/**
 * Write access. Every allowed role edits today, but each write still passes
 * through here, and a saved revision names the account that saved it.
 */
export async function requireSampleProgressEditor(): Promise<SampleProgressAccess> {
  const access = await requireSampleProgressAccess();
  if (access.role !== "editor")
    throw new ContentAccessDeniedError("PERMISSION_DENIED");
  return access;
}

export const canSeeSampleProgress = cache(async () => {
  try {
    await requireSampleProgressAccess();
    return true;
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) return false;
    throw error;
  }
});
