"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";

import { FlipbookViewer, type FlipbookLabels } from "./flipbook-viewer";
import { PdfFlipbookSource, type FlipbookPageSource } from "./pdf-document";

export type FlipbookPreviewLabels = FlipbookLabels & {
  /**
   * Standalone phrase for a total, with `{count}` substituted — for example
   * "{count} pages". A template rather than a function because labels cross the
   * server-to-client boundary, which only carries serialisable values.
   */
  pageCountTemplate: string;
  chooseFile: string;
  chooseAnother: string;
  hint: string;
  reading: string;
  tooLarge: string;
  notPdf: string;
  failed: string;
  localOnlyTitle: string;
  localOnlyBody: string;
};

export type FlipbookPreviewProps = {
  labels: FlipbookPreviewLabels;
  /** Mirrors the production upload limit so the same file is accepted here. */
  maxSizeMb: number;
};

type State =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "ready"; source: FlipbookPageSource; name: string }
  | { status: "error"; message: string };

/** Matches `%PDF-` so a renamed file is rejected before it reaches the parser. */
async function hasPdfSignature(buffer: ArrayBuffer): Promise<boolean> {
  const header = new Uint8Array(buffer.slice(0, 5));
  return (
    header[0] === 0x25 &&
    header[1] === 0x50 &&
    header[2] === 0x44 &&
    header[3] === 0x46 &&
    header[4] === 0x2d
  );
}

/**
 * Local flipbook preview.
 *
 * The chosen PDF never leaves the browser: it is read with the File API,
 * rasterised by pdf.js, and handed to the viewer. That makes the reading
 * experience testable before any storage account exists, and the same viewer
 * will later be given a page source backed by stored derived images.
 */
export function FlipbookPreview({ labels, maxSizeMb }: FlipbookPreviewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });

  const openFile = useCallback(
    async (file: File) => {
      setState((previous) => {
        if (previous.status === "ready") previous.source.destroy();
        return { status: "reading" };
      });

      if (file.size > maxSizeMb * 1024 * 1024) {
        setState({ status: "error", message: labels.tooLarge });
        return;
      }

      try {
        const buffer = await file.arrayBuffer();

        // Extension and MIME are both attacker-controlled, so the magic bytes
        // decide. The production upload path applies the same rule server-side.
        if (!(await hasPdfSignature(buffer))) {
          setState({ status: "error", message: labels.notPdf });
          return;
        }

        const source = await PdfFlipbookSource.fromData(buffer);
        setState({ status: "ready", source, name: file.name });
      } catch {
        setState({ status: "error", message: labels.failed });
      }
    },
    [labels.failed, labels.notPdf, labels.tooLarge, maxSizeMb],
  );

  return (
    <div>
      <div className="border-gold/40 bg-gold/10 text-charcoal/75 rounded-2xl border px-5 py-4 text-sm leading-6">
        <p className="text-burgundy font-semibold">{labels.localOnlyTitle}</p>
        <p className="mt-1">{labels.localOnlyBody}</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void openFile(file);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={state.status === "reading"}
          className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-12 items-center gap-2 rounded-full px-7 text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {state.status === "reading" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileUp className="size-4" aria-hidden="true" />
          )}
          {state.status === "ready" ? labels.chooseAnother : labels.chooseFile}
        </button>
        <p className="text-charcoal/60 text-sm">{labels.hint}</p>
      </div>

      <p aria-live="polite" className="sr-only">
        {state.status === "reading" ? labels.reading : ""}
      </p>

      {state.status === "error" ? (
        <p
          role="alert"
          className="border-lacquer/40 bg-lacquer/8 text-burgundy mt-6 rounded-2xl border px-5 py-4 text-sm"
        >
          {state.message}
        </p>
      ) : null}

      {state.status === "ready" ? (
        <div className="mt-8">
          <p className="text-charcoal/55 mb-3 font-mono text-xs">
            {state.name} ·{" "}
            {labels.pageCountTemplate.replace(
              "{count}",
              String(state.source.pageCount),
            )}
          </p>
          <div className="h-[min(78vh,48rem)]">
            <FlipbookViewer
              source={state.source}
              labels={labels}
              storageKey={`reddoor:flipbook-preview:${state.name}`}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
