"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";

import type { FlipbookEngine } from "./engine";
import { loadPageFlipEngine } from "./page-flip-engine";
import type { FlipbookPageSource } from "./pdf-document";

export type FlipbookLabels = {
  previous: string;
  next: string;
  page: string;
  of: string;
  fullscreen: string;
  exitFullscreen: string;
  close: string;
  loading: string;
  fallbackNotice: string;
};

export type FlipbookViewerProps = {
  source: FlipbookPageSource;
  labels: FlipbookLabels;
  /** Remembers the reader's place, scoped per document. */
  storageKey?: string;
  initialPage?: number;
  onClose?: () => void;
  className?: string;
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Subscribed rather than read once, so a reader who changes the system setting
 * mid-session is respected without a reload. The server snapshot is `false` so
 * the first client render matches the markup it hydrates.
 */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

/**
 * Flipbook reader.
 *
 * Two presentations share one page source. The flip engine is the default; a
 * sequential vertical reader is used when the reader asked for reduced motion
 * or the engine fails to start, so a catalogue is never unreadable.
 */
export function FlipbookViewer({
  source,
  labels,
  storageKey,
  initialPage = 0,
  onClose,
  className,
}: FlipbookViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<FlipbookEngine | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const statusId = useId();

  const [pageImages, setPageImages] = useState<Record<number, string>>({});
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [ready, setReady] = useState(false);
  const [engineFailed, setEngineFailed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const reducedMotion = usePrefersReducedMotion();
  // A reader who asked for reduced motion gets the sequential reader outright,
  // not a page-turn engine with its animation switched off.
  const useFallback = engineFailed || reducedMotion;

  const pageCount = source.pageCount;
  const aspect = source.pageSize.height / source.pageSize.width;

  // Keep the pages around the current spread rendered and drop the rest.
  useEffect(() => {
    let cancelled = false;

    async function loadWindow() {
      await source.prefetchAround?.(currentPage);
      if (cancelled) return;

      const next: Record<number, string> = {};
      for (let offset = -3; offset <= 3; offset += 1) {
        const index = currentPage + offset;
        if (index < 0 || index >= pageCount) continue;
        try {
          next[index] = await source.getPageImage(index);
        } catch {
          // A single unreadable page must not blank the whole catalogue.
        }
      }

      if (!cancelled) {
        setPageImages((previous) => ({ ...previous, ...next }));
      }
    }

    void loadWindow();
    return () => {
      cancelled = true;
    };
  }, [currentPage, pageCount, source]);

  // Start the flip engine once the first pages exist to hand it.
  useEffect(() => {
    if (useFallback || engineRef.current) return;
    if (!pageImages[0]) return;

    const container = containerRef.current;
    if (!container) return;

    let disposed = false;

    async function start() {
      try {
        const engine = await loadPageFlipEngine();
        if (disposed || !container) return;

        engine.mount(container, {
          pageWidth: source.pageSize.width,
          pageHeight: source.pageSize.height,
          orientation: "landscape",
          animate: true,
          onPageChange: setCurrentPage,
        });

        engineRef.current = engine;
        if (initialPage > 0) engine.goTo(initialPage);
        setReady(true);
      } catch {
        // The sequential reader is a complete alternative, not a degraded one.
        if (!disposed) setEngineFailed(true);
      }
    }

    void start();

    return () => {
      disposed = true;
    };
  }, [initialPage, pageImages, source.pageSize, useFallback]);

  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, String(currentPage));
    } catch {
      // A private window that refuses storage must not break reading.
    }
  }, [currentPage, storageKey]);

  const goPrevious = useCallback(() => {
    if (engineRef.current && !useFallback) engineRef.current.previous();
    else setCurrentPage((page) => Math.max(0, page - 1));
  }, [useFallback]);

  const goNext = useCallback(() => {
    if (engineRef.current && !useFallback) engineRef.current.next();
    else setCurrentPage((page) => Math.min(pageCount - 1, page + 1));
  }, [pageCount, useFallback]);

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.min(Math.max(index, 0), pageCount - 1);
      if (engineRef.current && !useFallback) engineRef.current.goTo(clamped);
      else setCurrentPage(clamped);
    },
    [pageCount, useFallback],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          goPrevious();
          break;
        case "ArrowRight":
          event.preventDefault();
          goNext();
          break;
        case "Home":
          event.preventDefault();
          goTo(0);
          break;
        case "End":
          event.preventDefault();
          goTo(pageCount - 1);
          break;
        case "Escape":
          if (document.fullscreenElement) return;
          onClose?.();
          break;
        default:
          break;
      }
    }

    const root = rootRef.current;
    root?.addEventListener("keydown", handleKeyDown);
    return () => root?.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrevious, goTo, onClose, pageCount]);

  useEffect(() => {
    function syncFullscreen() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {
      // Fullscreen is a convenience; refusal is not an error worth surfacing.
    }
  }

  useEffect(() => {
    function handleResize() {
      engineRef.current?.resize();
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const pageStyle: CSSProperties = { aspectRatio: `1 / ${aspect}` };

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className={cn(
        "bg-ivory relative flex h-full w-full flex-col outline-none",
        className,
      )}
      aria-describedby={statusId}
    >
      {/*
        The engine stage is deliberately NOT overflow-hidden: the fold
        animation projects the turning page up to ~30% beyond the book box,
        and clipping that excursion flat at the stage edge is what made cover
        flips read as an ugly jump. Left visible, the page lifts over the
        surface the way a real page does, and the drop shadow sells it.
      */}
      <div
        className={cn(
          "relative min-h-0 flex-1",
          useFallback ? "overflow-auto p-3 sm:p-6" : "py-2",
        )}
      >
        {useFallback ? (
          <FallbackReader
            pageCount={pageCount}
            pageImages={pageImages}
            pageStyle={pageStyle}
            currentPage={currentPage}
            onVisiblePage={setCurrentPage}
            labels={labels}
          />
        ) : (
          // The engine sizes the book from this wrapper's width and cannot see
          // its height, so the wrapper derives width from height instead: the
          // aspect ratio of a full spread makes the stretched book fill the
          // stage exactly, with no clipping and no dead band. On narrow screens
          // `max-w-full` wins and the engine falls back to a single page.
          <div
            className="mx-auto h-full max-w-full [filter:drop-shadow(0_1.25rem_2.5rem_rgb(27_25_23/0.3))]"
            style={{
              aspectRatio: `${source.pageSize.width * 2} / ${source.pageSize.height}`,
            }}
          >
            <div ref={containerRef} className="h-full w-full">
              {Array.from({ length: pageCount }, (_unused, index) => (
                <div key={index} className="bg-ivory" data-density="soft">
                  {pageImages[index] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pageImages[index]}
                      alt={`${labels.page} ${index + 1}`}
                      className="block h-full w-full object-contain"
                      draggable={false}
                    />
                  ) : (
                    <div
                      className="bg-ivory text-charcoal/40 grid h-full w-full place-items-center text-xs"
                      style={pageStyle}
                    >
                      {labels.loading}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!ready && !useFallback ? (
          <p className="text-charcoal/55 pointer-events-none absolute inset-0 grid place-items-center text-sm">
            {labels.loading}
          </p>
        ) : null}
      </div>

      {/*
        Raised above the stage: with the stage unclipped, a turning page can
        sweep across this row mid-flip, and the controls must stay usable
        rather than disappear under the animation.
      */}
      <div className="bg-ivory relative z-10 flex shrink-0 flex-wrap items-center justify-center gap-2 px-4 pt-4 pb-1">
        <button
          type="button"
          onClick={goPrevious}
          disabled={currentPage <= 0}
          aria-label={labels.previous}
          className="border-charcoal/20 text-charcoal hover:border-gold hover:text-burgundy grid size-11 place-items-center rounded-full border transition-colors disabled:opacity-35"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>

        <p
          id={statusId}
          aria-live="polite"
          className="text-charcoal/70 min-w-32 text-center text-xs tracking-[0.14em] uppercase"
        >
          {labels.page} {currentPage + 1} {labels.of} {pageCount}
        </p>

        <button
          type="button"
          onClick={goNext}
          disabled={currentPage >= pageCount - 1}
          aria-label={labels.next}
          className="border-charcoal/20 text-charcoal hover:border-gold hover:text-burgundy grid size-11 place-items-center rounded-full border transition-colors disabled:opacity-35"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? labels.exitFullscreen : labels.fullscreen}
          className="border-charcoal/20 text-charcoal hover:border-gold hover:text-burgundy ml-2 grid size-11 place-items-center rounded-full border transition-colors"
        >
          {isFullscreen ? (
            <Minimize2 className="size-4" aria-hidden="true" />
          ) : (
            <Maximize2 className="size-4" aria-hidden="true" />
          )}
        </button>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="border-charcoal/20 text-charcoal hover:border-gold hover:text-burgundy grid size-11 place-items-center rounded-full border transition-colors"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FallbackReader({
  pageCount,
  pageImages,
  pageStyle,
  currentPage,
  onVisiblePage,
  labels,
}: {
  pageCount: number;
  pageImages: Record<number, string>;
  pageStyle: CSSProperties;
  currentPage: number;
  onVisiblePage: (index: number) => void;
  labels: FlipbookLabels;
}) {
  const activeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center" });
  }, [currentPage]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <p className="text-charcoal/60 border-charcoal/15 rounded-xl border px-4 py-3 text-xs leading-6">
        {labels.fallbackNotice}
      </p>
      {Array.from({ length: pageCount }, (_unused, index) => (
        <figure
          key={index}
          ref={(node) => {
            if (index === currentPage) activeRef.current = node;
          }}
          className="ring-charcoal/10 overflow-hidden rounded-lg bg-white shadow-[0_0.75rem_2rem_rgb(27_25_23/0.12)] ring-1"
          onFocus={() => onVisiblePage(index)}
        >
          {pageImages[index] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pageImages[index]}
              alt={`${labels.page} ${index + 1}`}
              className="block w-full"
            />
          ) : (
            <div
              className="text-charcoal/40 grid w-full place-items-center text-xs"
              style={pageStyle}
            >
              {labels.loading}
            </div>
          )}
          <figcaption className="text-charcoal/55 px-3 py-2 text-center text-[0.65rem] tracking-[0.14em] uppercase">
            {labels.page} {index + 1}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
