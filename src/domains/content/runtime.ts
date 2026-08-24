import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import {
  ContentCommandService,
  type ContentPostCommitEvent,
} from "@/domains/content/commands";
import { MongoContentCommandStore } from "@/domains/content/persistence/command-store";

async function revalidateContent(event: ContentPostCommitEvent): Promise<void> {
  for (const tag of event.tags) {
    revalidateTag(tag, "max");
  }

  if (event.kind === "published") {
    for (const path of event.paths) {
      revalidatePath(path, "page");
    }
  }
}

export const contentCommandService = new ContentCommandService({
  store: new MongoContentCommandStore(),
  auditRepository: mongoAuditRepository,
  postCommit: revalidateContent,
});
