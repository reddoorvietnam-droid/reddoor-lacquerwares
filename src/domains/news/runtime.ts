import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import {
  ArticleCommandService,
  type ArticlePostCommitEvent,
} from "@/domains/news/commands";
import { MongoArticleCommandStore } from "@/domains/news/commands/mongo-store";

async function revalidateArticles(
  event: ArticlePostCommitEvent,
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

export const articleCommandService = new ArticleCommandService({
  store: new MongoArticleCommandStore(),
  auditRepository: mongoAuditRepository,
  postCommit: revalidateArticles,
});
