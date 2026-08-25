"use client";

import type { FlipbookPageSource, PdfPageSize } from "./pdf-document";

/**
 * Page source backed by stored, pre-derived page images.
 *
 * This is the production counterpart to `PdfFlipbookSource`. The browser never
 * downloads the PDF: it requests one CDN-delivered image per page, at a width
 * chosen from a fixed set. A fifty-page catalogue therefore costs the reader a
 * few hundred kilobytes for the pages they actually look at, instead of the
 * whole document up front.
 *
 * The URLs are built on the server and handed over ready-made, so no signing
 * material and no transformation logic reaches the client.
 */

export type StoredPageDescriptor = {
  /** Page image URLs keyed by width, built server-side from the media port. */
  readonly srcSet: Readonly<Record<number, string>>;
  /** Default URL used when the browser gives no size hint. */
  readonly src: string;
};

export type CloudinaryPageSourceInput = {
  readonly pages: readonly StoredPageDescriptor[];
  readonly pageSize: PdfPageSize;
};

export class CloudinaryPageSource implements FlipbookPageSource {
  readonly pageCount: number;
  readonly pageSize: PdfPageSize;

  #pages: readonly StoredPageDescriptor[];

  constructor(input: CloudinaryPageSourceInput) {
    this.#pages = input.pages;
    this.pageCount = input.pages.length;
    this.pageSize = input.pageSize;
  }

  async getPageImage(pageIndex: number): Promise<string> {
    const page = this.#pages[pageIndex];
    if (!page) {
      throw new Error(`Page ${pageIndex + 1} is not part of this collection.`);
    }
    return page.src;
  }

  /**
   * Warms the CDN cache for nearby pages so a turn is not followed by a blank
   * spread. Nothing is decoded or retained here — the browser's own image cache
   * is the store, which is why there is no eviction step to match.
   */
  async prefetchAround(pageIndex: number): Promise<void> {
    if (typeof document === "undefined") return;

    for (let offset = -2; offset <= 2; offset += 1) {
      const page = this.#pages[pageIndex + offset];
      if (!page) continue;

      const image = new Image();
      image.decoding = "async";
      image.src = page.src;
    }
  }

  destroy(): void {
    // Nothing to release: no object URLs are created and no canvas is retained.
  }
}
