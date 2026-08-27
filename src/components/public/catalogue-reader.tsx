"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { CloudinaryPageSource } from "@/components/flipbook/cloudinary-page-source";
import type { StoredPageDescriptor } from "@/components/flipbook/cloudinary-page-source";
import { FlipbookViewer, type FlipbookLabels } from "@/components/flipbook";
import type { PdfPageSize } from "@/components/flipbook/pdf-document";

/**
 * Client shell around the flipbook for a published catalogue.
 *
 * Everything it needs arrives as finished data — page image URLs built on the
 * server, localized labels, the page box — so this module holds no storage
 * knowledge. Closing the reader returns to the collection's landing page.
 */
export function CatalogueReader({
  pages,
  pageSize,
  labels,
  storageKey,
  backHref,
}: {
  pages: readonly StoredPageDescriptor[];
  pageSize: PdfPageSize;
  labels: FlipbookLabels;
  storageKey: string;
  backHref: string;
}) {
  const router = useRouter();
  const source = useMemo(
    () => new CloudinaryPageSource({ pages, pageSize }),
    [pages, pageSize],
  );

  return (
    <FlipbookViewer
      source={source}
      labels={labels}
      storageKey={storageKey}
      onClose={() => router.push(backHref as never)}
      className="h-[min(82svh,56rem)]"
    />
  );
}
