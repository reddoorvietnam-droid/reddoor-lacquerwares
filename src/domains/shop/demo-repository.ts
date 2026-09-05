import type {
  PublicShopItem,
  PublicShopRepository,
} from "@/domains/shop/public-contract";

/**
 * The shop has no stand-in fixtures: without a database the storefront is
 * honestly empty rather than showing items nobody can buy.
 */
export const demoShopRepository: PublicShopRepository = {
  async list(): Promise<readonly PublicShopItem[]> {
    return [];
  },
  async getBySlug(): Promise<PublicShopItem | null> {
    return null;
  },
};
