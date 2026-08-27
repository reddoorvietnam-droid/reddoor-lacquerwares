"use client";

import {
  FlipbookEngineError,
  type FlipbookEngine,
  type FlipbookEngineOptions,
  type FlipbookOrientation,
} from "./engine";

type PageFlipInstance = import("page-flip").PageFlip;

/**
 * StPageFlip adapter.
 *
 * The library owns and reorders the DOM inside its container, so the viewer
 * hands it a container of prepared page elements and then only talks to it
 * through this class. Replacing the engine means replacing this file.
 */
export class PageFlipEngine implements FlipbookEngine {
  #instance: PageFlipInstance | null = null;

  constructor(
    private readonly createInstance: (
      container: HTMLElement,
      settings: Record<string, number | string | boolean>,
    ) => PageFlipInstance,
  ) {}

  mount(container: HTMLElement, options: FlipbookEngineOptions): void {
    const pages = [...container.children].filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );

    if (pages.length === 0) {
      throw new FlipbookEngineError("The flipbook has no pages to display.");
    }

    try {
      const instance = this.createInstance(container, {
        width: options.pageWidth,
        height: options.pageHeight,
        size: "stretch",
        minWidth: 240,
        maxWidth: 1600,
        minHeight: 320,
        maxHeight: 2200,
        drawShadow: options.animate,
        // 550ms: long enough to read as a page, short enough that the
        // fold's vertical excursion does not hang in the air.
        flippingTime: options.animate ? 550 : 0,
        // Portrait keeps a phone on one readable page rather than forcing two
        // tiny ones side by side.
        usePortrait: true,
        maxShadowOpacity: 0.5,
        showCover: true,
        mobileScrollSupport: true,
        useMouseEvents: true,
        clickEventForward: true,
      });

      instance.on("flip", (event) => {
        if (typeof event.data === "number") options.onPageChange(event.data);
      });

      instance.on("changeOrientation", (event) => {
        if (event.data === "portrait" || event.data === "landscape") {
          options.onOrientationChange?.(event.data as FlipbookOrientation);
        }
      });

      instance.loadFromHTML(pages);
      this.#instance = instance;
    } catch (error) {
      throw new FlipbookEngineError("The flipbook could not be initialised.", {
        cause: error,
      });
    }
  }

  destroy(): void {
    try {
      this.#instance?.destroy();
    } catch {
      // A failed teardown must not stop the viewer from unmounting.
    }
    this.#instance = null;
  }

  next(): void {
    this.#instance?.flipNext();
  }

  previous(): void {
    this.#instance?.flipPrev();
  }

  goTo(pageIndex: number): void {
    this.#instance?.flip(pageIndex);
  }

  currentPage(): number {
    return this.#instance?.getCurrentPageIndex() ?? 0;
  }

  pageCount(): number {
    return this.#instance?.getPageCount() ?? 0;
  }

  resize(): void {
    this.#instance?.update();
  }
}

/**
 * Loads the engine bundle on demand. It is a browser-only library and a heavy
 * one, so it is never part of the initial page payload.
 */
export async function loadPageFlipEngine(): Promise<PageFlipEngine> {
  const { PageFlip } = await import("page-flip");

  return new PageFlipEngine(
    (container, settings) =>
      new PageFlip(container, settings) as PageFlipInstance,
  );
}
