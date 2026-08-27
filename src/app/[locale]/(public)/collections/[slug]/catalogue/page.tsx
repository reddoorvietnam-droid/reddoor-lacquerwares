import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import type { StoredPageDescriptor } from "@/components/flipbook/cloudinary-page-source";
import type { FlipbookLabels } from "@/components/flipbook";
import { CatalogueReader } from "@/components/public/catalogue-reader";
import { Container } from "@/components/ui";
import { findCataloguesForCollections } from "@/domains/collections/catalogue";
import { getPublicCollectionRepository } from "@/lib/public/repositories";
import { getDemoCollectionMetadata } from "@/lib/seo/route-metadata";
import {
  allowedPageWidths,
  type AllowedPageWidth,
} from "@/lib/media/storage-port";
import { CloudinaryMediaStorage } from "@/lib/media/cloudinary-storage";
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
const readerLabels: Record<Locale, FlipbookLabels & { back: string }> = {
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
    back: "Quay lại bộ sưu tập",
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
    back: "Back to the collection",
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
    back: "Retour à la collection",
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
    back: "Zurück zur Kollektion",
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
    back: "コレクションに戻る",
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
    back: "返回系列",
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
  return getDemoCollectionMetadata(locale, slug);
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
  const backHref = localePath(locale, "/collections");

  return (
    <main
      id="main-content"
      className="surface-deep text-ivory min-h-svh py-10 sm:py-14"
    >
      <Container size="wide">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href={backHref as Route}
              className="text-gold hover:text-gold-light inline-flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase"
            >
              <ArrowLeft aria-hidden="true" className="size-3.5" />
              {labels.back}
            </Link>
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
          backHref={backHref}
        />
      </Container>
    </main>
  );
}
