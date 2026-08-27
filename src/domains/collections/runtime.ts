import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import {
  CollectionCommandService,
  type CollectionPostCommitEvent,
} from "@/domains/collections/commands";
import { MongoCollectionCommandStore } from "@/domains/collections/commands/mongo-store";

async function revalidateCollections(
  event: CollectionPostCommitEvent,
): Promise<void> {
  for (const tag of event.tags) {
    revalidateTag(tag, "max");
  }

  if (event.kind === "published") {
    for (const path of event.paths) {
      revalidatePath(path, "page");
    }
  }
}

export const collectionCommandService = new CollectionCommandService({
  store: new MongoCollectionCommandStore(),
  auditRepository: mongoAuditRepository,
  postCommit: revalidateCollections,
});
