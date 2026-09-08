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
 * evaluated — and its `roleKeys` are the active roles that granted it. That is
 * the only thing that separates the two allowed roles, because CONTENT_CREATOR
 * holds a strict subset of DIRECTOR's permissions.
 */
export function sampleProgressRole(context: AccessContext): SampleProgressRole {
  const entry = context.permissions.find(
    (candidate) =>
      candidate.permission === "content.read" && candidate.scope === "all",
  );
  // DEV_OPEN_ACCESS stamps the literal role key "DEV_OPEN_ACCESS", so a bypassed
  // context can never match either name below.
  if (entry?.roleKeys.includes("CONTENT_CREATOR")) return "editor";
  if (entry?.roleKeys.includes("DIRECTOR")) return "viewer";
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
 * Write access. The Director reads and exports every report but does not edit
 * one, so a saved revision always names the person who actually maintains it.
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
