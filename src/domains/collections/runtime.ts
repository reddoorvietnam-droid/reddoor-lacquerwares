import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import {
  CollectionCommandService,
  type CollectionPostCommitEvent,
} from "@/domains/collections/commands";
import { MongoCollectionCommandStore } from "@/domains/collections/commands/mongo-store";
import { scheduleIndexNowSubmission } from "@/lib/seo/indexnow";

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
    // Publishing runs inside a Server Action, so `after` is available. The
    // event paths are the landing pages, `/{locale}/collections/{slug}`; the
    // flipbook reader below each one changes with the same publish, and the
    // listing gains or reorders a card.
    scheduleIndexNowSubmission(
      [
        ...event.paths.flatMap((path) => [path, `${path}/catalogue`]),
        ...event.locales.map((locale) => `/${locale}/collections`),
      ],
      after,
    );
  }
}

export const collectionCommandService = new CollectionCommandService({
  store: new MongoCollectionCommandStore(),
  auditRepository: mongoAuditRepository,
  postCommit: revalidateCollections,
});
