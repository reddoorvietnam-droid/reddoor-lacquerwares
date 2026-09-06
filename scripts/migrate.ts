/**
 * Index synchronisation.
 *
 * Mongoose declares indexes on the schema, but a serverless runtime must not
 * build them on demand — `autoIndex` is off in production, so an index that is
 * only declared never exists. This script is the deliberate, auditable point at
 * which declared indexes are reconciled with the database.
 *
 *   npm run migrate -- --dry-run   report the drift without changing anything
 *   npm run migrate                create missing and drop removed indexes
 *
 * `syncIndexes` drops indexes that the schema no longer declares. The dry run
 * exists so that removal is always seen before it happens.
 */

import type { Model } from "mongoose";

import {
  getAccessGrantModel,
  getBusinessUnitModel,
  getRoleDefinitionModel,
  getSecurityBootstrapClaimModel,
  getUserModel,
} from "@/domains/identity/models";
import { getAuditEventModel } from "@/domains/audit/model";
import { getCustomerModel } from "@/domains/customers/persistence/models";
import {
  getFinanceEntryModel,
  getFxRateModel,
  getSalesInvoiceModel,
} from "@/domains/finance/persistence/models";
import { getSalesOrderModel } from "@/domains/orders/persistence/models";
import { getSupplierModel } from "@/domains/suppliers/persistence/models";
import { getAssistantProposalModel } from "@/domains/assistant/persistence/models";
import {
  getChannelLinkModel,
  getNotificationIntentModel,
  getProcessedWebhookEventModel,
} from "@/domains/notifications/persistence/models";
import { getTaskModel } from "@/domains/tasks/persistence/models";
import { connectToDatabase } from "@/lib/db/mongoose";

function collectModels(): Model<unknown>[] {
  return [
    getUserModel(),
    getRoleDefinitionModel(),
    getAccessGrantModel(),
    getBusinessUnitModel(),
    getSecurityBootstrapClaimModel(),
    getAuditEventModel(),
    // Finance and order book: the unique invoice number and customer /
    // supplier codes only hold once these indexes exist.
    getCustomerModel(),
    getSupplierModel(),
    getSalesOrderModel(),
    getSalesInvoiceModel(),
    getFinanceEntryModel(),
    getFxRateModel(),
    // Work items, assistant proposals and the reminder outbox: the
    // idempotency of plan application and reminder delivery rests on the
    // unique indexes declared here.
    getTaskModel(),
    getAssistantProposalModel(),
    getNotificationIntentModel(),
    getChannelLinkModel(),
    getProcessedWebhookEventModel(),
  ] as unknown as Model<unknown>[];
}

async function reportDrift(model: Model<unknown>): Promise<void> {
  const existing = await model.collection
    .indexes()
    .catch(() => [] as { name?: string }[]);
  const existingNames = new Set(
    existing.flatMap((index) => (index.name ? [index.name] : [])),
  );
  const declaredNames = new Set(
    model.schema
      .indexes()
      .flatMap(([, options]) =>
        typeof options?.name === "string" ? [options.name] : [],
      ),
  );

  const missing = [...declaredNames].filter((name) => !existingNames.has(name));
  const extra = [...existingNames].filter(
    (name) => name !== "_id_" && !declaredNames.has(name),
  );

  console.info(
    `${model.modelName}: ${existingNames.size} present, ` +
      `${missing.length} missing, ${extra.length} not declared.`,
  );

  for (const name of missing) {
    console.info(`  + would create ${name}`);
  }
  for (const name of extra) {
    console.info(`  - would drop ${name}`);
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.slice(2).includes("--dry-run");

  await connectToDatabase();
  const models = collectModels();

  for (const model of models) {
    if (dryRun) {
      await reportDrift(model);
      continue;
    }

    const dropped = await model.syncIndexes();
    console.info(
      `${model.modelName}: indexes synchronised` +
        (dropped.length > 0 ? `, dropped ${dropped.join(", ")}` : ""),
    );
  }

  console.info(
    dryRun ? "Dry run complete; nothing changed." : "Migration complete.",
  );
}

main()
  .then(async () => {
    const mongoose = (await import("mongoose")).default;
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    const mongoose = (await import("mongoose")).default;
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
