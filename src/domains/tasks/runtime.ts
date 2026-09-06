import "server-only";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoUserDirectory } from "@/domains/identity/user-directory";
import { mongoOrderStore } from "@/domains/orders/persistence/mongo-store";
import { mongoTaskStore } from "@/domains/tasks/persistence/mongo-store";
import { TaskCommandService } from "@/domains/tasks/service";
import { getNotificationEnv } from "@/lib/env/server";

export const taskCommandService = new TaskCommandService({
  store: mongoTaskStore,
  orderStore: mongoOrderStore,
  userDirectory: mongoUserDirectory,
  auditRepository: mongoAuditRepository,
  timeZone: getNotificationEnv().BUSINESS_TIMEZONE,
});
