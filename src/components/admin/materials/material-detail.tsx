"use client";

import { useEffect, useRef, useState } from "react";
import {
  displayDate,
  type MaterialDetailResponse,
  type TimelineEntry,
  type TransactionType,
} from "@/domains/materials/contracts";
import {
  buttonClass,
  cardClass,
  formatDateTime,
  ghostButtonClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadClass,
} from "@/components/admin/sample-progress-shared";
import { fetchDetail } from "./api";
import { useMaterials } from "./materials-workspace";
import {
  auditSentence,
  badgeClass,
  errorMessage,
  formatQuantity,
  stockLabels,
  stockTone,
  typeLabels,
} from "./materials-shared";
import { TransactionEditor } from "./transaction-editor";

/** One material inside the summary tab: balance, movements newest first, and who changed what. */
export function MaterialDetailCard({
  materialId,
  onClose,
}: {
  materialId: string;
  onClose: () => void;
}) {
  const { capabilities, stockVersion, busy, guard, discardSeq } =
    useMaterials();
  const [data, setData] = useState<MaterialDetailResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [editorState, setEditorState] = useState<{
    type: NonNullable<TransactionType | null>;
    seq: number;
  } | null>(null);
  // An editor opened before the last discard is gone, whatever its draft holds.
  const editor =
    editorState && editorState.seq === discardSeq ? editorState.type : null;
  const setEditor = (next: TransactionType | null) =>
    setEditorState(next ? { type: next, seq: discardSeq } : null);
  const requestSeq = useRef(0);

  useEffect(() => {
    // stockVersion re-runs it after every write, so the card never shows a stale balance.
    const seq = ++requestSeq.current;
    const initial = setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");
        try {
          const response = await fetchDetail(materialId, 0);
          if (seq !== requestSeq.current) return;
          setData(response);
          setTimeline(response.timeline);
          setNextOffset(response.nextOffset);
        } catch (reason) {
          if (seq === requestSeq.current)
            setError(errorMessage(reason, "Không thể tải chi tiết vật tư."));
        } finally {
          if (seq === requestSeq.current) setLoading(false);
        }
      })();
    }, 0);
    return () => clearTimeout(initial);
  }, [materialId, stockVersion]);

  async function loadMore() {
    if (nextOffset === null) return;
    setLoadingMore(true);
    try {
      const response = await fetchDetail(materialId, nextOffset);
      setTimeline((rows) => {
        const known = new Set(rows.map((row) => row.id));
        return [
          ...rows,
          ...response.timeline.filter((row) => !known.has(row.id)),
        ];
      });
      setNextOffset(response.nextOffset);
    } catch (reason) {
      setError(errorMessage(reason, "Không thể tải thêm."));
    } finally {
      setLoadingMore(false);
    }
  }

  const material = data?.material ?? null;
  const tone = data ? (material?.active ? data.state : "inactive") : null;

  return (
    <section
      className={`${cardClass} space-y-5`}
      aria-label={material ? `Vật tư ${material.code}` : "Chi tiết vật tư"}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-burgundy font-serif text-2xl">
            {material
              ? `${material.code} · ${material.name || "—"}`
              : "Chi tiết vật tư"}
          </h2>
          {data && tone && (
            <p className="mt-2 flex flex-wrap items-center gap-3">
              <span className="text-burgundy text-3xl font-semibold tabular-nums">
                {formatQuantity(data.balance.currentQuantity)}
              </span>
              <span className="text-charcoal/65">{material?.unit}</span>
              <span className={`${badgeClass} ${stockTone[tone].badge}`}>
                {stockLabels[tone]}
              </span>
            </p>
          )}
        </div>
        <div className="materials-no-print flex flex-wrap gap-2">
          {material && capabilities.receive && (
            <button
              type="button"
              className={buttonClass}
              disabled={busy || !material.active || editor === "INBOUND"}
              onClick={() => guard(() => setEditor("INBOUND"))}
            >
              Nhập kho
            </button>
          )}
          {material && capabilities.issue && (
            <button
              type="button"
              className={buttonClass}
              disabled={busy || !material.active || editor === "OUTBOUND"}
              onClick={() => guard(() => setEditor("OUTBOUND"))}
            >
              Xuất kho
            </button>
          )}
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>

      {loading && !data && (
        <p role="status" className="text-charcoal/65 text-sm">
          Đang tải chi tiết vật tư…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900"
        >
          {error}
        </p>
      )}

      {data && material && (
        <>
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Tồn đầu", formatQuantity(data.balance.openingQuantity)],
              ["Σ nhập", formatQuantity(data.balance.inboundQuantity)],
              ["Σ xuất", formatQuantity(data.balance.outboundQuantity)],
              [
                "Tồn tối thiểu",
                material.minimumStock === null
                  ? "—"
                  : formatQuantity(material.minimumStock),
              ],
              ["Ghi chú", material.note || "—"],
            ].map(([label, value]) => (
              <div key={label} className="bg-ivory/60 rounded-xl p-3">
                <dt className="text-charcoal/60 text-xs">{label}</dt>
                <dd className="mt-1 font-semibold">{value}</dd>
              </div>
            ))}
          </dl>

          {editor && (
            <TransactionEditor
              key={editor}
              type={editor}
              existing={null}
              material={material}
              onSaved={() => setEditor(null)}
              onCancel={() => setEditor(null)}
            />
          )}

          <div>
            <h3 className="text-burgundy mb-3 font-serif text-xl">
              Giao dịch ({data.timelineTotal})
            </h3>
            <div className={tableWrapClass}>
              <table className="w-full min-w-[800px] border-collapse text-sm">
                <thead className={theadClass}>
                  <tr>
                    {[
                      "Ngày",
                      "Loại",
                      "Số lượng",
                      "Cơ sở",
                      "Ghi chú",
                      "Tồn sau",
                    ].map((label) => (
                      <th key={label} scope="col" className={thClass}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((entry) => (
                    <tr key={entry.id} className="border-burgundy/10 border-t">
                      <td className={`${tdClass} whitespace-nowrap`}>
                        {displayDate(entry.transactionDate)}
                      </td>
                      <td className={tdClass}>{typeLabels[entry.type]}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {entry.type === "OUTBOUND" ? "−" : "+"}
                        {formatQuantity(entry.quantity)} {entry.unit}
                      </td>
                      <td className={tdClass}>{entry.facilityName || "—"}</td>
                      <td className={`${tdClass} whitespace-pre-wrap`}>
                        {entry.note || "—"}
                      </td>
                      <td
                        className={`${tdClass} text-right font-semibold tabular-nums`}
                      >
                        Tồn sau: {formatQuantity(entry.balanceAfter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {timeline.length === 0 && (
                <p className="text-charcoal/65 p-6 text-center">
                  Chưa có giao dịch nào cho vật tư này.
                </p>
              )}
            </div>
            {nextOffset !== null && (
              <button
                type="button"
                className={`${ghostButtonClass} materials-no-print mt-3`}
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? "Đang tải…" : "Tải thêm"}
              </button>
            )}
          </div>

          <div>
            <h3 className="text-burgundy mb-3 font-serif text-xl">
              Lịch sử thay đổi
            </h3>
            {data.history.length ? (
              <ul className="space-y-2 text-sm">
                {data.history.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap gap-x-3">
                    <span className="text-charcoal/60 whitespace-nowrap">
                      {formatDateTime(entry.occurredAt)}
                    </span>
                    <span>{auditSentence(entry)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-charcoal/65 text-sm">Chưa có lịch sử.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
