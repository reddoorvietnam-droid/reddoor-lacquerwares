import "server-only";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { after } from "next/server";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import {
  shopTextLocales,
  type ShopPostCommitEvent,
} from "@/domains/shop/contracts";
import {
  MongoShopItemStore,
  MongoShopOrderStore,
} from "@/domains/shop/mongo-store";
import { SHOP_CACHE_TAG } from "@/domains/shop/public-mongo-repository";
import { ShopService } from "@/domains/shop/service";
import { locales } from "@/lib/i18n/config";
import { scheduleIndexNowSubmission } from "@/lib/seo/indexnow";

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
    // Only a change the public can see is worth a search engine's visit: an
    // item that is on sale now, or was until this write (its page is a
    // legitimate removal to report). Drafts and hidden items stay quiet. The
    // shop only exists in the two languages its copy is written in, which is
    // also what the sitemap lists.
    if (event.status === "live" || event.previousStatus === "live") {
      scheduleIndexNowSubmission(
        shopTextLocales.flatMap((locale) => [
          `/${locale}/shop`,
          `/${locale}/shop/${event.slug}`,
        ]),
        after,
      );
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
