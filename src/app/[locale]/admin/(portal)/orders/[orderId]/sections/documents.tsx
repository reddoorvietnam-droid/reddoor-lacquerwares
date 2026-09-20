import { formatDate } from "@/app/[locale]/admin/(portal)/finance/shared";
import { removeOrderDocumentAction } from "@/app/[locale]/admin/(portal)/orders/actions";
import { DocumentUpload } from "@/components/admin/document-upload";
import { getRoleDefinitionSeed } from "@/domains/identity/role-definitions";
import {
  orderDocumentLabels,
  tradeDocumentStatuses,
  type OrderDocument,
  type OrderDocumentKind,
  type OrderReadDto,
} from "@/domains/orders/contracts";
import { formatBytes, storedDocumentUrl } from "@/lib/media/document-url";

import {
  cardClass,
  dangerButtonClass,
  headingClass,
  mutedBadgeClass,
  okBadgeClass,
  subheadingClass,
  warnBadgeClass,
} from "./styles";

/**
 * Every file the order produces, in two groups: the step outputs (contract,
 * technical file, production order, packing slip and photos…) and the export
 * document set with its deadlines — INV and PKL three weeks (21 days) before
 * loading, the declaration before loading, B/L, fumigation, phyto and C/O
 * within a week after. Each row shows what is on file, who owes it and when.
 * The customer's label spec and the company label proof live on their own
 * card (`labels.tsx`), never in the step list here.
 */

const stepKinds: readonly OrderDocumentKind[] = [
  "contract",
  "technical",
  "productionOrder",
  "materialIssue",
  "qcChecklist",
  "packingSlip",
  "packingPhoto",
  "deliveryNote",
  "other",
];

const copy = {
  vi: {
    title: "Tài liệu và chứng từ",
    stepTitle: "Hồ sơ theo bước",
    tradeTitle: "Bộ chứng từ xuất khẩu",
    tradeHint:
      "INV và PKL phải có trước ngày đóng hàng 3 tuần; tờ khai trước khi đóng hàng; B/L, hun trùng, Phyto, C/O trong 7 ngày sau khi hàng đi. Hạn tính từ ngày booking / ngày hàng đi trong thẻ Tiến độ xuất hàng.",
    owner: "Vị trí lập",
    due: "Hạn",
    noDue: "Chưa có ngày booking",
    status: "Trạng thái",
    onFile: "Đã có",
    missing: "Chưa có",
    overdue: "Quá hạn",
    required: "bắt buộc",
    upload: "Tải lên",
    remove: "Gỡ",
    nothing: "Chưa có tệp nào.",
  },
  en: {
    title: "Documents",
    stepTitle: "Step outputs",
    tradeTitle: "Export document set",
    tradeHint:
      "INV and PKL three weeks before loading; the declaration before loading; B/L, fumigation, phyto and C/O within 7 days after dispatch. Deadlines count from the booking / dispatch date on the export progress card.",
    owner: "Owner",
    due: "Due",
    noDue: "No booking date yet",
    status: "Status",
    onFile: "On file",
    missing: "Missing",
    overdue: "Overdue",
    required: "required",
    upload: "Upload",
    remove: "Remove",
    nothing: "No file yet.",
  },
} as const;

function FileList({
  locale,
  order,
  files,
  canRemove,
}: {
  locale: "vi" | "en";
  order: OrderReadDto;
  files: readonly OrderDocument[];
  canRemove: boolean;
}) {
  const text = copy[locale];
  if (files.length === 0) return null;
  return (
    <ul className="mt-1 space-y-1 text-sm">
      {files.map((document) => (
        <li key={document.id} className="flex flex-wrap items-center gap-3">
          <a
            href={storedDocumentUrl(document)}
            target="_blank"
            rel="noreferrer"
            className="text-burgundy font-semibold hover:underline"
          >
            {document.label}
          </a>
          <span className="text-charcoal/45 text-xs">
            {document.format.toUpperCase()} · {formatBytes(document.bytes)} ·{" "}
            {formatDate(document.uploadedAt, locale)}
          </span>
          {canRemove ? (
            <form action={removeOrderDocumentAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="orderId" value={order.id} />
              <input
                type="hidden"
                name="expectedRevision"
                value={order.revision}
              />
              <input type="hidden" name="documentId" value={document.id} />
              <button type="submit" className={dangerButtonClass}>
                {text.remove}
              </button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function DocumentsSection({
  locale,
  order,
  now,
  canAttach,
  maxBytes,
}: {
  locale: "vi" | "en";
  order: OrderReadDto;
  now: Date;
  /** Per kind, whether the reader may attach and remove files of that kind. */
  canAttach: Readonly<Record<OrderDocumentKind, boolean>>;
  maxBytes: number | null;
}) {
  const text = copy[locale];
  const byKind = (kind: OrderDocumentKind) =>
    order.documents.filter((document) => document.kind === kind);
  const statuses = tradeDocumentStatuses(order, now);
  const closed = order.stage === "closed" || order.stage === "cancelled";

  const uploadFor = (kind: OrderDocumentKind) =>
    canAttach[kind] && maxBytes && !closed ? (
      <DocumentUpload
        locale={locale}
        target={{ kind: "orderFile", id: order.id, documentKind: kind }}
        expectedRevision={order.revision}
        maxBytes={maxBytes}
        label={text.upload}
        compact
      />
    ) : null;

  return (
    <section className={cardClass}>
      <h2 className={headingClass}>{text.title}</h2>

      <h3 className={subheadingClass}>{text.tradeTitle}</h3>
      <p className="text-charcoal/50 mt-1 text-xs">{text.tradeHint}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
              <th className="px-3 py-2 font-semibold"></th>
              <th className="px-3 py-2 font-semibold">{text.owner}</th>
              <th className="px-3 py-2 font-semibold">{text.due}</th>
              <th className="px-3 py-2 font-semibold">{text.status}</th>
              <th className="px-3 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((row) => {
              const files = byKind(row.kind);
              const role = getRoleDefinitionSeed(row.ownerRole);
              return (
                <tr
                  key={row.kind}
                  className="border-burgundy/8 border-b align-top"
                >
                  <td className="px-3 py-2">
                    <span className="font-semibold">
                      {orderDocumentLabels[row.kind][locale]}
                    </span>
                    {row.required ? (
                      <span className="text-charcoal/45 ml-2 text-xs">
                        ({text.required})
                      </span>
                    ) : null}
                    <FileList
                      locale={locale}
                      order={order}
                      files={files}
                      canRemove={canAttach[row.kind] && !closed}
                    />
                  </td>
                  <td className="text-charcoal/70 px-3 py-2 text-xs">
                    {role?.labels[locale] ?? row.ownerRole}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.dueAt ? (
                      formatDate(row.dueAt, locale)
                    ) : (
                      <span className="text-charcoal/45">{text.noDue}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        row.present
                          ? okBadgeClass
                          : row.overdue
                            ? warnBadgeClass
                            : mutedBadgeClass
                      }
                    >
                      {row.present
                        ? text.onFile
                        : row.overdue
                          ? text.overdue
                          : text.missing}
                    </span>
                  </td>
                  <td className="px-3 py-2">{uploadFor(row.kind)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 className={subheadingClass}>{text.stepTitle}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {stepKinds
          .filter((kind) => byKind(kind).length > 0 || canAttach[kind])
          .map((kind) => (
            <div
              key={kind}
              className="border-burgundy/10 rounded-xl border px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {orderDocumentLabels[kind][locale]}
                </span>
                {uploadFor(kind)}
              </div>
              {byKind(kind).length === 0 ? (
                <p className="text-charcoal/45 mt-1 text-xs">{text.nothing}</p>
              ) : (
                <FileList
                  locale={locale}
                  order={order}
                  files={byKind(kind)}
                  canRemove={canAttach[kind] && !closed}
                />
              )}
            </div>
          ))}
      </div>
    </section>
  );
}
