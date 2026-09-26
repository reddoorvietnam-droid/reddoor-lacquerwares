import type { Metadata } from "next";
import type { Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import type { StoredPageDescriptor } from "@/components/flipbook/cloudinary-page-source";
import type { FlipbookLabels } from "@/components/flipbook";
import { CatalogueReader } from "@/components/public/catalogue-reader";
import { Breadcrumbs } from "@/components/public/pages/shared";
import { Container } from "@/components/ui";
import { findCataloguesForCollections } from "@/domains/collections/catalogue";
import { getPublicCollectionRepository } from "@/lib/public/repositories";
import { JsonLdScripts } from "@/lib/seo/json-ld";
import { getCollectionCatalogueMetadata } from "@/lib/seo/route-metadata";
import { collectionStructuredData } from "@/lib/seo/structured-data";
import { encodeSeoSlug } from "@/lib/seo/urls";
import {
  allowedPageWidths,
  type AllowedPageWidth,
} from "@/lib/media/storage-port";
import { CloudinaryMediaStorage } from "@/lib/media/cloudinary-storage";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale, localePath, type Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

/**
 * The catalogue reader for one published collection.
 *
 * Page-image URLs are minted here, on the server, from the stored catalogue
 * record — the client receives finished CDN URLs and nothing else. The route
 * 404s unless the collection is published AND a catalogue is attached, so an
 * unpublished upload can never be read through guesswork.
 */

/**
 * Reader chrome in every public locale. The dictionary does not carry these
 * yet; when the working group next revises the six dictionaries, these
 * belong there.
 */
const readerLabels: Record<Locale, FlipbookLabels> = {
  vi: {
    previous: "Trang trước",
    next: "Trang sau",
    page: "Trang",
    of: "trên",
    fullscreen: "Toàn màn hình",
    exitFullscreen: "Thoát toàn màn hình",
    close: "Đóng",
    loading: "Đang tải trang…",
    fallbackNotice: "Đang hiển thị dạng cuộn dọc.",
  },
  en: {
    previous: "Previous page",
    next: "Next page",
    page: "Page",
    of: "of",
    fullscreen: "Full screen",
    exitFullscreen: "Exit full screen",
    close: "Close",
    loading: "Loading the page…",
    fallbackNotice: "Showing the sequential reader.",
  },
  fr: {
    previous: "Page précédente",
    next: "Page suivante",
    page: "Page",
    of: "sur",
    fullscreen: "Plein écran",
    exitFullscreen: "Quitter le plein écran",
    close: "Fermer",
    loading: "Chargement de la page…",
    fallbackNotice: "Affichage en lecture séquentielle.",
  },
  de: {
    previous: "Vorherige Seite",
    next: "Nächste Seite",
    page: "Seite",
    of: "von",
    fullscreen: "Vollbild",
    exitFullscreen: "Vollbild beenden",
    close: "Schließen",
    loading: "Seite wird geladen…",
    fallbackNotice: "Sequentielle Ansicht wird angezeigt.",
  },
  ja: {
    previous: "前のページ",
    next: "次のページ",
    page: "ページ",
    of: "／",
    fullscreen: "全画面表示",
    exitFullscreen: "全画面を終了",
    close: "閉じる",
    loading: "ページを読み込み中…",
    fallbackNotice: "縦スクロール表示中です。",
  },
  "zh-CN": {
    previous: "上一页",
    next: "下一页",
    page: "第",
    of: "页，共",
    fullscreen: "全屏",
    exitFullscreen: "退出全屏",
    close: "关闭",
    loading: "正在加载页面…",
    fallbackNotice: "正在以纵向阅读模式显示。",
  },
};

type CataloguePageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({
  params,
}: CataloguePageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  // Canonical and hreflang point at the landing page: the reader is an
  // alternate presentation of the same collection.
  return getCollectionCatalogueMetadata(locale, slug);
}

export default async function CollectionCataloguePage({
  params,
}: CataloguePageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const collection = await getPublicCollectionRepository().getBySlug(
    locale,
    slug,
  );
  if (!collection) notFound();
  // The URL carried another language's slug (the locale switcher keeps the
  // slug); send visitors and crawlers to this locale's own address.
  if (collection.slug !== slug) {
    permanentRedirect(
      localePath(
        locale,
        `/collections/${encodeSeoSlug(collection.slug)}/catalogue`,
      ) as Route,
    );
  }

  const catalogues = await findCataloguesForCollections(
    [collection.id],
    locale,
  );
  const catalogue = catalogues.get(collection.id);
  if (!catalogue) notFound();

  let storage: CloudinaryMediaStorage;
  try {
    storage = CloudinaryMediaStorage.fromEnvironment();
  } catch {
    notFound();
  }

  // One descriptor per page: a fixed set of widths so the client can follow
  // the device pixel ratio without ever minting a new derivation.
  const servedWidths: readonly AllowedPageWidth[] = allowedPageWidths.filter(
    (width) => width >= 640 && width <= 1600,
  );
  const pages: StoredPageDescriptor[] = Array.from(
    { length: catalogue.pageCount },
    (_ignored, index) => {
      const srcSet: Record<number, string> = {};
      for (const width of servedWidths) {
        srcSet[width] = storage.buildPageImageUrl({
          publicId: catalogue.publicId,
          pageNumber: index + 1,
          width,
          version: catalogue.assetVersion,
        });
      }
      return { srcSet, src: srcSet[960] ?? Object.values(srcSet)[0] ?? "" };
    },
  );

  const labels = readerLabels[locale];
  // The reader closes back onto the collection's landing page, which is
  // also the trail's leaf: the flipbook is the same collection, presented
  // as pages, not a level below it.
  const landingHref = localePath(
    locale,
    `/collections/${encodeSeoSlug(collection.slug)}`,
  );
  const dictionary = await getDictionary(locale);
  // The visible trail behind the BreadcrumbList JSON-LD: same nav.* labels.
  const breadcrumbs = [
    { href: localePath(locale, "/"), label: dictionary.nav.home },
    {
      href: localePath(locale, "/collections"),
      label: dictionary.nav.collections,
    },
    { href: landingHref, label: collection.title },
  ];

  return (
    <>
      <JsonLdScripts
        documents={collectionStructuredData(locale, dictionary, collection)}
        enabled={!collection.isDemo}
      />
      <main
        id="main-content"
        className="surface-deep text-ivory min-h-svh py-10 sm:py-14"
      >
        <Container size="wide">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Breadcrumbs
                items={breadcrumbs}
                label={dictionary.common.breadcrumbs}
                inverse
              />
              <h1 className="mt-4 font-serif text-3xl tracking-[-0.02em] sm:text-4xl">
                {collection.title}
              </h1>
              <p className="text-ivory/55 mt-1 text-sm">
                {collection.editionLabel}
                {collection.editionLabel ? " · " : ""}
                {labels.page.toLowerCase()} 1 {labels.of} {catalogue.pageCount}
              </p>
            </div>
          </div>

          <CatalogueReader
            pages={pages}
            pageSize={{
              width: catalogue.pageWidth,
              height: catalogue.pageHeight,
            }}
            labels={labels}
            storageKey={`reddoor:catalogue:${collection.id}:${catalogue.assetVersion}`}
            backHref={landingHref}
          />
        </Container>
      </main>
    </>
  );
}
