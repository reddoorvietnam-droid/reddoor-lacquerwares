import { z } from "zod";

import { adminHref, guarded } from "@/domains/assistant/tools/shared";
import type { AssistantTool } from "@/domains/assistant/tools/types";

const input = z.object({
  limit: z.number().int().min(1).max(50).default(15),
});

/**
 * The editorial desk in one read: articles, products and shop items with
 * their workflow state, through the same command services the CMS screens
 * use. This is the only data tool a Content Creator's assistant can run.
 */
export const listEditorialWorkTool: AssistantTool<z.infer<typeof input>> = {
  name: "list_editorial_work",
  description:
    "List website content the user manages — news articles and catalogue products with their draft/review/published state and translation status, and shop items with their status and stock. Use it for 'what is still in draft', 'what is waiting for review', 'which shop items are hidden'.",
  inputSchema: input,
  requires: ["content.read"],
  async run(value, context) {
    return guarded(async () => {
      const access = await context.auth.requirePermission("content.read");
      const [articles, products] = await Promise.all([
        context.services.articles.list(access, { limit: value.limit }),
        context.services.products.list(access, { limit: value.limit }),
      ]);
      const coverages = await context.auth.coverages(["shop.read"] as const);
      let shopItems: unknown[] = [];
      if (coverages["shop.read"].global) {
        const shopAccess = await context.auth.requirePermission("shop.read");
        shopItems = (await context.services.shop.listItems(shopAccess))
          .slice(0, value.limit)
          .map((item) => ({
            id: item.id,
            slug: item.slug,
            status: item.status,
            title: item.text.vi?.name ?? item.text.en?.name ?? item.slug,
            stockQuantity: item.stockQuantity,
            updatedAt: item.updatedAt.toISOString(),
          }));
      }
      return {
        ok: true,
        data: {
          articles: articles.items.map((entry) => ({
            id: entry.article.id,
            workflow: entry.article.status,
            draftVersion: entry.draftVersion,
            publishedVersion: entry.publishedVersion,
            translations: entry.translations.map((translation) => ({
              locale: translation.locale,
              title: translation.title,
              status: translation.status,
            })),
            updatedAt: entry.article.updatedAt,
          })),
          articlesTotal: articles.total,
          products: products.items.map((entry) => ({
            id: entry.product.id,
            sku: entry.product.sku,
            workflow: entry.product.status,
            draftVersion: entry.draftVersion,
            publishedVersion: entry.publishedVersion,
            translations: entry.translations,
            updatedAt: entry.product.updatedAt,
          })),
          productsTotal: products.total,
          shopItems,
        },
        sources: [
          {
            label: context.locale === "vi" ? "Tin tức" : "News",
            href: adminHref(context.locale, "/news"),
          },
          {
            label: context.locale === "vi" ? "Sản phẩm" : "Products",
            href: adminHref(context.locale, "/products"),
          },
        ],
      };
    });
  },
};
