export const userStatuses = ["pending", "active", "suspended"] as const;
export type UserStatus = (typeof userStatuses)[number];

export const accessGrantStatuses = ["active", "revoked"] as const;
export type AccessGrantStatus = (typeof accessGrantStatuses)[number];

export const permissionScopes = [
  "own",
  "assignedBusinessUnits",
  "all",
] as const;
export type PermissionScope = (typeof permissionScopes)[number];

export const contentPermissions = [
  "content.read",
  "content.create",
  "content.update",
  "content.review",
  "content.publish",
] as const;
export type ContentPermission = (typeof contentPermissions)[number];

export type AuthorizationUser = {
  id: string;
  status: UserStatus;
  authzVersion: number;
};

export type AuthorizationGrant = {
  id: string;
  roleKey: string;
  businessUnitId: string | null;
  status: AccessGrantStatus;
  expiresAt: Date | null;
};

export type RolePermission = {
  permission: string;
  scope: PermissionScope;
};

export type AuthorizationRole = {
  key: string;
  active: boolean;
  permissions: readonly RolePermission[];
};

export type AuthorizationSnapshot = {
  user: AuthorizationUser;
  grants: readonly AuthorizationGrant[];
  roles: readonly AuthorizationRole[];
};

export interface AuthorizationRepository {
  findSnapshotByUserId(userId: string): Promise<AuthorizationSnapshot | null>;
}

export type GoogleIdentityInput = {
  googleSubject: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  occurredAt: Date;
};

export type AuthIdentity = AuthorizationUser & {
  normalizedEmail: string;
  displayName: string | null;
};

export interface GoogleIdentityRepository {
  synchronizeGoogleIdentity(input: GoogleIdentityInput): Promise<AuthIdentity>;
  findIdentityByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<AuthIdentity | null>;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}
