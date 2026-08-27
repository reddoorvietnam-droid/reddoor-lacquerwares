import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import {
  ProductCommandService,
  type ProductPostCommitEvent,
} from "@/domains/products/commands";
import { MongoProductCommandStore } from "@/domains/products/commands/mongo-store";

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
  }
}

export const productCommandService = new ProductCommandService({
  store: new MongoProductCommandStore(),
  auditRepository: mongoAuditRepository,
  postCommit: revalidateProducts,
});
