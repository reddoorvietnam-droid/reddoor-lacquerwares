/**
 * Flipbook engine boundary.
 *
 * The page-turn animation is provided by a third-party library. Everything the
 * viewer needs from it is described here, so the library can be replaced
 * without touching the viewer, the controls, or the PDF pipeline.
 */

export type FlipbookOrientation = "portrait" | "landscape";

export type FlipbookEngineOptions = {
  /** Intrinsic page size in CSS pixels; the engine scales within its box. */
  pageWidth: number;
  pageHeight: number;
  /** Portrait shows one page at a time, landscape a two-page spread. */
  orientation: FlipbookOrientation;
  /** Disable the turn animation for reduced-motion readers. */
  animate: boolean;
  onPageChange: (pageIndex: number) => void;
  onOrientationChange?: (orientation: FlipbookOrientation) => void;
};

export interface FlipbookEngine {
  /** Attaches to a container whose children are the page elements. */
  mount(container: HTMLElement, options: FlipbookEngineOptions): void;
  destroy(): void;
  next(): void;
  previous(): void;
  goTo(pageIndex: number): void;
  currentPage(): number;
  pageCount(): number;
  /** Recomputes layout after a container resize. */
  resize(): void;
}

export class FlipbookEngineError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "FlipbookEngineError";
  }
}
