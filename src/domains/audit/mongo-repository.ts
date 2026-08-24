import "server-only";

import type { ClientSession } from "mongodb";
import { Types } from "mongoose";

import type {
  AppendedAuditEvent,
  AuditEventInput,
  AuditRepository,
} from "@/domains/audit/contracts";
import { getAuditEventModel } from "@/domains/audit/model";
import { redactAuditText, redactAuditValue } from "@/domains/audit/redaction";
import { connectToDatabase } from "@/lib/db/mongoose";

function toObjectIds(ids: readonly string[]): Types.ObjectId[] {
  return ids.filter(Types.ObjectId.isValid).map((id) => new Types.ObjectId(id));
}

function auditDocument(event: AuditEventInput) {
  return {
    actorType: event.actor.type,
    ...(event.actor.type === "user"
      ? { actorId: new Types.ObjectId(event.actor.userId) }
      : { systemActorName: event.actor.systemName }),
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    businessUnitIds: toObjectIds(event.businessUnitIds ?? []),
    requestId: event.requestId,
    ...(event.correlationId ? { correlationId: event.correlationId } : {}),
    ...(event.reason ? { reason: redactAuditText(event.reason) } : {}),
    ...(event.permissionDecision
      ? { permissionDecision: event.permissionDecision }
      : {}),
    ...(event.changes && "before" in event.changes
      ? { before: redactAuditValue(event.changes.before) }
      : {}),
    ...(event.changes && "after" in event.changes
      ? { after: redactAuditValue(event.changes.after) }
      : {}),
    ...(event.metadata === undefined
      ? {}
      : { metadata: redactAuditValue(event.metadata) }),
    occurredAt: event.occurredAt,
  };
}

/** Appends through the existing audit model inside a caller-owned transaction. */
export async function appendAuditEventWithSession(
  event: AuditEventInput,
  session: ClientSession,
): Promise<AppendedAuditEvent> {
  const documents = await getAuditEventModel().create([auditDocument(event)], {
    session,
  });
  const document = documents[0];

  if (!document) {
    throw new Error("The audit event was not appended.");
  }

  return { id: document._id.toHexString(), occurredAt: document.occurredAt };
}

export class MongoAuditRepository implements AuditRepository {
  async append(event: AuditEventInput): Promise<AppendedAuditEvent> {
    await connectToDatabase();

    const document = await getAuditEventModel().create(auditDocument(event));

    return { id: document._id.toHexString(), occurredAt: document.occurredAt };
  }
}

export const mongoAuditRepository = new MongoAuditRepository();
