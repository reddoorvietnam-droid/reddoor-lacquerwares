import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import {
  ProductCommandService,
  type ProductPostCommitEvent,
} from "@/domains/products/commands";
import { MongoProductCommandStore } from "@/domains/products/commands/mongo-store";
import { scheduleIndexNowSubmission } from "@/lib/seo/indexnow";

async function revalidateProducts(
  event: ProductPostCommitEvent,
): Promise<void> {
  for (const tag of event.tags) {
    revalidateTag(tag, "max");
  }

  if (event.kind === "published") {
    for (const path of event.paths) {
      revalidatePath(path, "page");
    }
    // Publishing runs inside a Server Action, so `after` is available: the
    // product pages that just changed and the listings that now show them go
    // to IndexNow once the editor has their response.
    scheduleIndexNowSubmission(
      [...event.paths, ...event.locales.map((locale) => `/${locale}/products`)],
      after,
    );
  }
}

export const productCommandService = new ProductCommandService({
  store: new MongoProductCommandStore(),
  auditRepository: mongoAuditRepository,
  postCommit: revalidateProducts,
});
