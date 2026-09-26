import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import {
  ArticleCommandService,
  type ArticlePostCommitEvent,
} from "@/domains/news/commands";
import { MongoArticleCommandStore } from "@/domains/news/commands/mongo-store";
import { scheduleIndexNowSubmission } from "@/lib/seo/indexnow";

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
    // Publishing runs inside a Server Action, so `after` is available: the
    // article pages that just changed and the listings that now show them go
    // to IndexNow once the editor has their response.
    scheduleIndexNowSubmission(
      [...event.paths, ...event.locales.map((locale) => `/${locale}/news`)],
      after,
    );
  }
}

export const articleCommandService = new ArticleCommandService({
  store: new MongoArticleCommandStore(),
  auditRepository: mongoAuditRepository,
  postCommit: revalidateArticles,
});
