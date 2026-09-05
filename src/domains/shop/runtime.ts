import "server-only";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import type { ShopPostCommitEvent } from "@/domains/shop/contracts";
import {
  MongoShopItemStore,
  MongoShopOrderStore,
} from "@/domains/shop/mongo-store";
import { SHOP_CACHE_TAG } from "@/domains/shop/public-mongo-repository";
import { ShopService } from "@/domains/shop/service";
import { locales } from "@/lib/i18n/config";

async function revalidateShop(event: ShopPostCommitEvent): Promise<void> {
  // Every shop write happens inside a Server Action, so `updateTag` applies:
  // the next request waits for fresh data instead of serving the stale
  // listing once. An item just put on sale, or just taken down, must show
  // that on the very next page view — stale-while-revalidate is not enough.
  try {
    updateTag(SHOP_CACHE_TAG);
  } catch {
    revalidateTag(SHOP_CACHE_TAG, "max");
  }
  if (event.kind === "itemChanged") {
    for (const locale of locales) {
      revalidatePath(`/${locale}/shop`, "page");
      revalidatePath(`/${locale}/shop/${event.slug}`, "page");
    }
  }
}

export const shopOrderStore = new MongoShopOrderStore();

export const shopService = new ShopService({
  itemStore: new MongoShopItemStore(),
  orderStore: shopOrderStore,
  auditRepository: mongoAuditRepository,
  postCommit: revalidateShop,
});
