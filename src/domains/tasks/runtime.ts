import "server-only";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoIdentityRepository } from "@/domains/identity/mongo-repository";
import { mongoUserDirectory } from "@/domains/identity/user-directory";
import { mongoOrderStore } from "@/domains/orders/persistence/mongo-store";
import { mongoTaskStore } from "@/domains/tasks/persistence/mongo-store";
import { TaskCommandService } from "@/domains/tasks/service";
import { getNotificationEnv } from "@/lib/env/server";

/**
 * The units a person's live grants attach them to, read from the same
 * snapshot the guard evaluates. Used to stamp work that has no order of its
 * own with the units of whoever has to do it.
 */
const userUnits = {
  async unitsFor(userId: string): Promise<readonly string[]> {
    const snapshot = await mongoIdentityRepository.findSnapshotByUserId(userId);
    if (!snapshot) return [];
    const now = new Date();
    return [
      ...new Set(
        snapshot.grants.flatMap((grant) =>
          grant.status === "active" &&
          (!grant.expiresAt || grant.expiresAt > now) &&
          grant.businessUnitId
            ? [grant.businessUnitId]
            : [],
        ),
      ),
    ];
  },
};

export const taskCommandService = new TaskCommandService({
  store: mongoTaskStore,
  orderStore: mongoOrderStore,
  userDirectory: mongoUserDirectory,
  userUnits,
  auditRepository: mongoAuditRepository,
  timeZone: getNotificationEnv().BUSINESS_TIMEZONE,
});
