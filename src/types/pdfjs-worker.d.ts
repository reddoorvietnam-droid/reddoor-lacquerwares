/**
 * pdf.js ships the worker as a plain `.mjs` with no declaration file, and
 * the assistant's PDF reader imports it to hand pdf.js a worker directly
 * (see `src/domains/assistant/attachments/pdf.ts` for why a file path
 * cannot be used). Nothing reads from the module — it is only assigned to
 * `globalThis.pdfjsWorker` — so an opaque type is the honest description.
 */
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  const worker: unknown;
  export = worker;
}
