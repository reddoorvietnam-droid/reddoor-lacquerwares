import "server-only";

import { demoCollectionRepository } from "@/domains/collections/demo-repository";
import type { PublicCollectionRepository } from "@/domains/collections/public-contract";
import { mongoPublicCollectionRepository } from "@/domains/collections/public-mongo-repository";
import { demoContentRepository } from "@/domains/content/demo-repository";
import type { PublicContentRepository } from "@/domains/content/public-contract";
import { mongoPublicContentRepository } from "@/domains/content/public-mongo-repository";
import { demoNewsRepository } from "@/domains/news/demo-repository";
import type { PublicNewsRepository } from "@/domains/news/public-contract";
import { mongoPublicNewsRepository } from "@/domains/news/public-mongo-repository";
import { demoProductRepository } from "@/domains/products/demo-repository";
import type { PublicProductRepository } from "@/domains/products/public-contract";
import { mongoPublicProductRepository } from "@/domains/products/public-mongo-repository";
import { requireMongoPublicDataSource } from "@/lib/data-source";

/**
 * The one place the public site chooses where its data comes from.
 *
 * Every public route asks these functions for a repository instead of naming
 * an implementation. `DATA_SOURCE` decides: with MongoDB configured the site
 * shows what the CMS has published — including honest emptiness where nothing
 * is published yet — and the DEMO fixtures serve only a development machine
 * with no database (or an explicit `DATA_SOURCE=demo`). A misconfigured
 * MongoDB selection throws rather than quietly showing stand-in copy as if
 * the company had approved it.
 */

export function getPublicContentRepository(): PublicContentRepository {
  return requireMongoPublicDataSource()
    ? mongoPublicContentRepository
    : demoContentRepository;
}

export function getPublicProductRepository(): PublicProductRepository {
  return requireMongoPublicDataSource()
    ? mongoPublicProductRepository
    : demoProductRepository;
}

export function getPublicNewsRepository(): PublicNewsRepository {
  return requireMongoPublicDataSource()
    ? mongoPublicNewsRepository
    : demoNewsRepository;
}

export function getPublicCollectionRepository(): PublicCollectionRepository {
  return requireMongoPublicDataSource()
    ? mongoPublicCollectionRepository
    : demoCollectionRepository;
}
