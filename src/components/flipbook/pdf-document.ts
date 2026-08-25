"use client";

import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist/types/src/display/api";

/**
 * PDF page source for the flipbook.
 *
 * Pages are rasterised on demand, never all at once: a catalogue of fifty to a
 * hundred pages held at display resolution would exhaust memory on a phone.
 * The viewer asks for the pages around the current spread and this module keeps
 * a bounded cache of the results.
 *
 * This runs entirely in the browser. The same interface is what a Cloudinary
 * derived-image source would implement later, so the viewer does not care where
 * a page bitmap came from.
 */

export type PdfPageSize = { width: number; height: number };

export interface FlipbookPageSource {
  readonly pageCount: number;
  /** Intrinsic size of the first page, used to size the book. */
  readonly pageSize: PdfPageSize;
  /** Resolves to an object URL for the page image, rendering it if needed. */
  getPageImage(pageIndex: number): Promise<string>;
  /**
   * Optional hint that the reader has moved: render the pages around this one
   * and release the rest. A source backed by a CDN may not need it.
   */
  prefetchAround?(pageIndex: number): Promise<void>;
  destroy(): void;
}

/** How many pages either side of the current spread are kept rendered. */
const CACHE_RADIUS = 3;

/** Upper bound on the rasterised width, so a large page cannot blow up memory. */
const MAX_RENDER_WIDTH = 2000;

/** Upper bound on the scale factor, protecting against tiny page boxes. */
const MAX_RENDER_SCALE = 3;

/**
 * Same-origin URLs of the decoder assets copied by
 * `scripts/sync-pdfjs-assets.mjs`. JPEG-2000 and JBIG2 images and ICC colour
 * profiles are decoded in WebAssembly, and CJK text needs the CMap files;
 * without these URLs such images render silently blank while text and vector
 * fills still appear — which reads as "the catalogue lost its photographs".
 */
const decoderAssetOptions = {
  wasmUrl: "/pdfjs/wasm/",
  iccUrl: "/pdfjs/iccs/",
  cMapUrl: "/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/pdfjs/standard_fonts/",
} as const;

type CacheEntry = {
  url: string;
  /** Kept so an in-flight render can be cancelled when the page is evicted. */
  task: RenderTask | null;
};

let workerConfigured = false;

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");

  if (!workerConfigured) {
    // Bundled alongside the app rather than fetched from a CDN, so the strict
    // content security policy does not have to allow an external script host.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }

  return pdfjs;
}

export class PdfFlipbookSource implements FlipbookPageSource {
  readonly pageCount: number;
  readonly pageSize: PdfPageSize;

  #document: PDFDocumentProxy;
  // Teardown lives on the loading task, not the document proxy.
  #loadingTask: PDFDocumentLoadingTask;
  #cache = new Map<number, CacheEntry>();
  #pending = new Map<number, Promise<string>>();
  #renderScale: number;
  #destroyed = false;

  private constructor(
    document: PDFDocumentProxy,
    loadingTask: PDFDocumentLoadingTask,
    pageSize: PdfPageSize,
    renderScale: number,
  ) {
    this.#document = document;
    this.#loadingTask = loadingTask;
    this.pageCount = document.numPages;
    this.pageSize = pageSize;
    this.#renderScale = renderScale;
  }

  static async fromData(data: ArrayBuffer): Promise<PdfFlipbookSource> {
    const pdfjs = await loadPdfJs();
    const loadingTask = pdfjs.getDocument({ data, ...decoderAssetOptions });
    const document = await loadingTask.promise;

    if (document.numPages < 1) {
      throw new Error("The PDF contains no pages.");
    }

    const firstPage = await document.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1 });

    // Scaled to a target pixel width rather than to devicePixelRatio: a PDF
    // page box is typically 400–600 points, so a DPR-derived scale left a
    // standard desktop with a ~600px image stretched across the whole book,
    // which read as blur. Capped so a miniature page box cannot explode.
    const scale = Math.min(MAX_RENDER_WIDTH / viewport.width, MAX_RENDER_SCALE);

    return new PdfFlipbookSource(
      document,
      loadingTask,
      { width: viewport.width, height: viewport.height },
      Math.max(scale, 1),
    );
  }

  async getPageImage(pageIndex: number): Promise<string> {
    const cached = this.#cache.get(pageIndex);
    if (cached) return cached.url;

    const inFlight = this.#pending.get(pageIndex);
    if (inFlight) return inFlight;

    const render = this.#renderPage(pageIndex);
    this.#pending.set(pageIndex, render);

    try {
      return await render;
    } finally {
      this.#pending.delete(pageIndex);
    }
  }

  async #renderPage(pageIndex: number): Promise<string> {
    const page = await this.#document.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: this.#renderScale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("A 2D canvas context was not available.");
    }

    const task = page.render({ canvas, canvasContext: context, viewport });
    await task.promise;

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.9);
    });

    if (!blob) {
      throw new Error("The page could not be encoded.");
    }

    // Freeing the backing store matters on mobile Safari, which otherwise keeps
    // every canvas alive until the tab is discarded.
    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();

    const url = URL.createObjectURL(blob);

    if (this.#destroyed) {
      URL.revokeObjectURL(url);
      throw new Error("The document was closed while rendering.");
    }

    this.#cache.set(pageIndex, { url, task: null });
    return url;
  }

  /** Renders the pages around `pageIndex` and evicts everything outside it. */
  async prefetchAround(pageIndex: number): Promise<void> {
    const wanted = new Set<number>();
    for (let offset = -CACHE_RADIUS; offset <= CACHE_RADIUS; offset += 1) {
      const index = pageIndex + offset;
      if (index >= 0 && index < this.pageCount) wanted.add(index);
    }

    for (const [index, entry] of this.#cache) {
      if (!wanted.has(index)) {
        entry.task?.cancel();
        URL.revokeObjectURL(entry.url);
        this.#cache.delete(index);
      }
    }

    await Promise.allSettled(
      [...wanted].map((index) => this.getPageImage(index)),
    );
  }

  destroy(): void {
    this.#destroyed = true;
    for (const entry of this.#cache.values()) {
      entry.task?.cancel();
      URL.revokeObjectURL(entry.url);
    }
    this.#cache.clear();
    void this.#loadingTask.destroy();
  }
}
