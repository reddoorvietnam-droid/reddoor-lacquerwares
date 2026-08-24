export type AuditActor =
  { type: "user"; userId: string } | { type: "system"; systemName: string };

export type AuditPermissionDecision = {
  permission: string;
  outcome: "allowed" | "denied";
  reasonCode: string;
  scope: "own" | "assignedBusinessUnits" | "all" | null;
};

export type AuditChangeSet = {
  before?: unknown;
  after?: unknown;
};

export type AuditEventInput = {
  actor: AuditActor;
  action: string;
  resourceType: string;
  resourceId: string | null;
  businessUnitIds?: readonly string[];
  requestId: string;
  correlationId?: string;
  reason?: string;
  permissionDecision?: AuditPermissionDecision;
  changes?: AuditChangeSet;
  metadata?: unknown;
  occurredAt: Date;
};

export type AppendedAuditEvent = {
  id: string;
  occurredAt: Date;
};

export interface AuditRepository {
  append(event: AuditEventInput): Promise<AppendedAuditEvent>;
}
