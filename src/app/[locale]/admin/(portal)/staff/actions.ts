"use server";

import type { Route } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { userStatuses } from "@/domains/identity/contracts";
import type { Permission } from "@/domains/identity/permissions";
import { runStaffCommand } from "@/domains/identity/staff-directory";
import {
  StaffCommandError,
  type StaffCommand,
  type StaffCommandKind,
} from "@/domains/identity/staff-policy";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";
import type { AccessContext } from "@/lib/auth/authorization";

/**
 * The one server action behind "Danh sách nhân sự". Each command
 * re-authorizes with the permission it exercises; the staff service then
 * re-reads the account and judges the rules inside its transaction. The
 * outcome travels back as a query parameter so the page stays
 * server-rendered.
 */

const localeSchema = z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/);
const tabSchema = z.enum(userStatuses).catch("pending");
const inputSchema = z.object({
  userId: z.string().regex(/^[a-f0-9]{24}$/),
  expectedAuthzVersion: z.coerce.number().int().min(1),
  kind: z.enum(["approve", "reject", "changeRole", "suspend", "unlock"]),
  roleKey: z.string().trim().max(80),
});

const notices: Record<StaffCommandKind, string> = {
  approve: "approved",
  reject: "rejected",
  changeRole: "roleChanged",
  suspend: "suspended",
  unlock: "unlocked",
};

function toCommand(kind: StaffCommandKind, roleKey: string): StaffCommand {
  switch (kind) {
    case "approve":
    case "changeRole":
      return { kind, roleKey };
    case "unlock":
      return { kind, roleKey: roleKey || null };
    case "reject":
    case "suspend":
      return { kind };
  }
}

function permissionsFor(command: StaffCommand): readonly Permission[] {
  switch (command.kind) {
    case "approve":
      return ["users.activate", "users.manageRoles"];
    case "reject":
      return ["users.activate"];
    case "changeRole":
      return ["users.manageRoles"];
    case "suspend":
      return ["users.suspend"];
    case "unlock":
      return command.roleKey
        ? ["users.activate", "users.manageRoles"]
        : ["users.activate"];
  }
}

function errorCode(error: unknown): string {
  if (error instanceof ContentAccessDeniedError) return "FORBIDDEN";
  if (error instanceof StaffCommandError) return error.code;
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  return "UNAVAILABLE";
}

export async function runStaffCommandAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const tab = tabSchema.parse(formData.get("tab"));
  let outcome: string;

  try {
    const input = inputSchema.parse({
      userId: formData.get("userId"),
      expectedAuthzVersion: formData.get("expectedAuthzVersion"),
      kind: formData.get("kind"),
      roleKey: String(formData.get("roleKey") ?? ""),
    });
    const command = toCommand(input.kind, input.roleKey);

    let context: AccessContext | null = null;
    for (const permission of permissionsFor(command)) {
      context = await requirePermission(permission, {
        resourceId: input.userId,
      });
    }
    if (!context) throw new ContentAccessDeniedError("PERMISSION_DENIED");

    await runStaffCommand(context, {
      userId: input.userId,
      expectedAuthzVersion: input.expectedAuthzVersion,
      command,
    });
    outcome = `notice=${notices[input.kind]}`;
  } catch (error) {
    unstable_rethrow(error);
    outcome = `error=${errorCode(error)}`;
  }

  redirect(`/${locale}/admin/staff?tab=${tab}&${outcome}` as Route);
}
