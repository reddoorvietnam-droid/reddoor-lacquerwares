import { formatDate } from "@/app/[locale]/admin/(portal)/finance/shared";
import {
  approveLabelProofAction,
  removeOrderDocumentAction,
} from "@/app/[locale]/admin/(portal)/orders/actions";
import { DocumentUpload } from "@/components/admin/document-upload";
import {
  labelStatus,
  orderDocumentLabels,
  type OrderDocument,
  type OrderReadDto,
} from "@/domains/orders/contracts";
import { formatBytes, storedDocumentUrl } from "@/lib/media/document-url";

import {
  buttonClass,
  cardClass,
  dangerButtonClass,
  headingClass,
  mutedBadgeClass,
  okBadgeClass,
  warnBadgeClass,
} from "./styles";

/**
 * Labels and shipping marks (Director, 2026-09-14): printed from the
 * customer's template when there is one; otherwise from the company's own
 * proof, which the Director approves before it is printed. Leaving packing
 * (step 07) waits for one of the two.
 */

const copy = {
  vi: {
    title: "Mẫu tem & shipping mark",
    hint: "Có mẫu của khách thì in theo mẫu khách. Khách không gửi mẫu thì tải mẫu công ty lên để Giám đốc duyệt trước khi in.",
    customerSpec: "Theo mẫu của khách",
    pending: "Mẫu công ty chờ Giám đốc duyệt",
    approved: (date: string) =>
      `Mẫu công ty đã được Giám đốc duyệt ngày ${date}`,
    missing: "Chưa có mẫu tem",
    approve: "Duyệt mẫu tem này",
    ownProof: "Mẫu này do bạn tải lên nên bạn không tự duyệt được.",
    upload: "Tải lên",
    remove: "Gỡ",
    nothing: "Chưa có tệp nào.",
    approvedFile: "đã duyệt",
  },
  en: {
    title: "Labels & shipping mark",
    hint: "With a customer template, print from it. Without one, upload the company proof for the Director to approve before printing.",
    customerSpec: "Customer template",
    pending: "Company proof awaiting the Director",
    approved: (date: string) =>
      `Company proof approved by the Director on ${date}`,
    missing: "No label template yet",
    approve: "Approve this label proof",
    ownProof: "You uploaded this proof, so you cannot approve it yourself.",
    upload: "Upload",
    remove: "Remove",
    nothing: "No file yet.",
    approvedFile: "approved",
  },
} as const;

const labelKinds = ["customerLabelSpec", "labelProof"] as const;

export function LabelsSection({
  locale,
  order,
  currentUserId,
  canAttach,
  canApprove,
  maxBytes,
}: {
  locale: "vi" | "en";
  order: OrderReadDto;
  currentUserId: string;
  /** Whether the reader files and removes the two label kinds. */
  canAttach: boolean;
  /** Whether the reader holds a global `approvals.decide`. */
  canApprove: boolean;
  maxBytes: number | null;
}) {
  const text = copy[locale];
  const closed = order.stage === "closed" || order.stage === "cancelled";
  const status = labelStatus(order);

  const badge =
    status.kind === "customerSpec"
      ? { className: okBadgeClass, label: text.customerSpec }
      : status.kind === "proofApproved"
        ? {
            className: okBadgeClass,
            label: text.approved(
              formatDate(status.approval.approvedAt, locale),
            ),
          }
        : status.kind === "proofPending"
          ? { className: warnBadgeClass, label: text.pending }
          : { className: mutedBadgeClass, label: text.missing };

  const approvable = (document: OrderDocument) =>
    status.kind === "proofPending" && status.proof.id === document.id;

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={headingClass}>{text.title}</h2>
        <span className={badge.className}>{badge.label}</span>
      </div>
      <p className="text-charcoal/55 mt-2 text-sm">{text.hint}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {labelKinds.map((kind) => {
          const files = order.documents.filter(
            (document) => document.kind === kind,
          );
          return (
            <div
              key={kind}
              className="border-burgundy/10 rounded-xl border px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {orderDocumentLabels[kind][locale]}
                </span>
                {canAttach && maxBytes && !closed ? (
                  <DocumentUpload
                    locale={locale}
                    target={{
                      kind: "orderFile",
                      id: order.id,
                      documentKind: kind,
                    }}
                    expectedRevision={order.revision}
                    maxBytes={maxBytes}
                    label={text.upload}
                    compact
                  />
                ) : null}
              </div>
              {files.length === 0 ? (
                <p className="text-charcoal/45 mt-1 text-xs">{text.nothing}</p>
              ) : (
                <ul className="mt-1 space-y-2 text-sm">
                  {files.map((document) => (
                    <li key={document.id}>
                      <div className="flex flex-wrap items-center gap-3">
                        <a
                          href={storedDocumentUrl(document)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-burgundy font-semibold hover:underline"
                        >
                          {document.label}
                        </a>
                        <span className="text-charcoal/45 text-xs">
                          {document.format.toUpperCase()} ·{" "}
                          {formatBytes(document.bytes)} ·{" "}
                          {formatDate(document.uploadedAt, locale)}
                        </span>
                        {order.labelApproval?.documentId === document.id ? (
                          <span className={okBadgeClass}>
                            {text.approvedFile}
                          </span>
                        ) : null}
                        {canAttach && !closed ? (
                          <form action={removeOrderDocumentAction}>
                            <input type="hidden" name="locale" value={locale} />
                            <input
                              type="hidden"
                              name="orderId"
                              value={order.id}
                            />
                            <input
                              type="hidden"
                              name="expectedRevision"
                              value={order.revision}
                            />
                            <input
                              type="hidden"
                              name="documentId"
                              value={document.id}
                            />
                            <button type="submit" className={dangerButtonClass}>
                              {text.remove}
                            </button>
                          </form>
                        ) : null}
                      </div>
                      {canApprove && !closed && approvable(document) ? (
                        document.uploadedBy === currentUserId ? (
                          <p className="text-charcoal/50 mt-2 text-xs">
                            {text.ownProof}
                          </p>
                        ) : (
                          <form
                            action={approveLabelProofAction}
                            className="mt-2"
                          >
                            <input type="hidden" name="locale" value={locale} />
                            <input
                              type="hidden"
                              name="orderId"
                              value={order.id}
                            />
                            <input
                              type="hidden"
                              name="expectedRevision"
                              value={order.revision}
                            />
                            <input
                              type="hidden"
                              name="documentId"
                              value={document.id}
                            />
                            <button type="submit" className={buttonClass}>
                              {text.approve}
                            </button>
                          </form>
                        )
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
