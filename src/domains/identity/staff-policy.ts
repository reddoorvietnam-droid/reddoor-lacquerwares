import { normalizeEmail, type UserStatus } from "@/domains/identity/contracts";
import {
  systemRoleKeys,
  type SystemRoleKey,
} from "@/domains/identity/role-definitions";

/**
 * Rules behind "Danh sách nhân sự", the Director's staff list (agreed with the
 * client on 2026-09-13). Sign-in is Gmail only: a first Google sign-in lands in
 * the pending queue, and the Director approves it with exactly one role.
 *
 * - Every person holds one role, never two, and a role is all there is — no
 *   per-screen toggles.
 * - There is exactly one Director. The role cannot be handed out here, and a
 *   Director account cannot be locked, re-roled or rejected from this screen.
 * - Rejecting deletes the pending account, so signing in again simply queues
 *   the person again; it is not a permanent block.
 * - Locking keeps the role, so unlocking gives the same access back.
 *
 * Kept free of the database so the rules are tested on their own; the Mongo
 * service re-reads the account inside its transaction and runs them there.
 */

/**
 * Accounts the platform provisions for its own testing. `.local` is a
 * reserved top-level domain, so no Google sign-in can ever carry one of these
 * addresses: they are never staff, never listed or acted on here, and never
 * count as the company's Director. `dev-preview.reddoor.local` held the
 * retired one-click role preview; `e2e.reddoor.local` holds the admin E2E
 * role sessions.
 */
export const internalAccountDomains = [
  "dev-preview.reddoor.local",
  "e2e.reddoor.local",
] as const;

/** Matches a normalized (lower-case) address on an internal account domain. */
export const internalAccountEmailPattern = new RegExp(
  `@(?:${internalAccountDomains
    .map((domain) => domain.replaceAll(".", "\\."))
    .join("|")})$`,
);

export function isInternalAccountEmail(email: string): boolean {
  return internalAccountEmailPattern.test(normalizeEmail(email));
}

export type AssignableRoleKey = Exclude<SystemRoleKey, "DIRECTOR">;

export const assignableRoleKeys = systemRoleKeys.filter(
  (key): key is AssignableRoleKey => key !== "DIRECTOR",
);

export function isAssignableRoleKey(value: string): value is AssignableRoleKey {
  return (assignableRoleKeys as readonly string[]).includes(value);
}

export type StaffMember = {
  id: string;
  email: string;
  displayName: string | null;
  status: UserStatus;
  /** Keys of the active roles behind the account's live grants. */
  roleKeys: readonly string[];
  authzVersion: number;
  createdAt: Date | null;
  lastLoginAt: Date | null;
  suspendedAt: Date | null;
};

export type StaffCommand =
  | { kind: "approve"; roleKey: string }
  | { kind: "reject" }
  | { kind: "changeRole"; roleKey: string }
  | { kind: "suspend" }
  /** `roleKey` only when the account has no single role left to keep. */
  | { kind: "unlock"; roleKey: string | null };

export type StaffCommandKind = StaffCommand["kind"];

export const staffCommandErrorCodes = [
  "NOT_FOUND",
  "SELF",
  "DIRECTOR_PROTECTED",
  "TEST_ACCOUNT",
  "INVALID_STATE",
  "INVALID_ROLE",
  "ROLE_REQUIRED",
  "ROLE_UNCHANGED",
  "ROLE_UNAVAILABLE",
  "REVISION_CONFLICT",
] as const;

export type StaffCommandErrorCode = (typeof staffCommandErrorCodes)[number];

export class StaffCommandError extends Error {
  readonly code: StaffCommandErrorCode;

  constructor(code: StaffCommandErrorCode) {
    super(`Staff command refused: ${code}`);
    this.name = "StaffCommandError";
    this.code = code;
  }
}

export function isDirectorAccount(member: Pick<StaffMember, "roleKeys">) {
  return member.roleKeys.includes("DIRECTOR");
}

/** Why a row offers no action at all, or null when it does. */
export function protectedReason(
  member: StaffMember,
  actorUserId: string,
): "SELF" | "DIRECTOR_PROTECTED" | "TEST_ACCOUNT" | null {
  if (member.id === actorUserId) return "SELF";
  if (isInternalAccountEmail(member.email)) return "TEST_ACCOUNT";
  if (isDirectorAccount(member)) return "DIRECTOR_PROTECTED";
  return null;
}

/** The actions the Director may take on this account right now. */
export function allowedStaffCommands(
  member: StaffMember,
  actorUserId: string,
): readonly StaffCommandKind[] {
  if (protectedReason(member, actorUserId)) return [];
  switch (member.status) {
    case "pending":
      return ["approve", "reject"];
    case "active":
      return ["changeRole", "suspend"];
    case "suspended":
      return ["unlock"];
  }
}

/** The one role an account keeps, or null when it has none or several. */
export function singleRoleKey(
  member: Pick<StaffMember, "roleKeys">,
): string | null {
  return member.roleKeys.length === 1 ? member.roleKeys[0]! : null;
}

/**
 * Judges a command against the account as it is now. Throws the first rule
 * it breaks; returns the role the account must end up holding alone, or null
 * when the command leaves the grants untouched.
 */
export function assertStaffCommand(
  member: StaffMember | null,
  command: StaffCommand,
  context: { actorUserId: string; expectedAuthzVersion: number },
): AssignableRoleKey | null {
  if (!member) throw new StaffCommandError("NOT_FOUND");

  const reason = protectedReason(member, context.actorUserId);
  if (reason) throw new StaffCommandError(reason);

  // Every change bumps `authzVersion`, so a stale page cannot overwrite a
  // decision someone took after it was rendered.
  if (member.authzVersion !== context.expectedAuthzVersion) {
    throw new StaffCommandError("REVISION_CONFLICT");
  }

  if (
    !allowedStaffCommands(member, context.actorUserId).includes(command.kind)
  ) {
    throw new StaffCommandError("INVALID_STATE");
  }

  switch (command.kind) {
    case "approve":
    case "changeRole": {
      if (!isAssignableRoleKey(command.roleKey)) {
        throw new StaffCommandError("INVALID_ROLE");
      }
      if (
        command.kind === "changeRole" &&
        singleRoleKey(member) === command.roleKey
      ) {
        throw new StaffCommandError("ROLE_UNCHANGED");
      }
      return command.roleKey;
    }
    case "unlock": {
      const kept = singleRoleKey(member);
      if (kept && isAssignableRoleKey(kept)) return null;
      if (!command.roleKey) throw new StaffCommandError("ROLE_REQUIRED");
      if (!isAssignableRoleKey(command.roleKey)) {
        throw new StaffCommandError("INVALID_ROLE");
      }
      return command.roleKey;
    }
    case "reject":
    case "suspend":
      return null;
  }
}
