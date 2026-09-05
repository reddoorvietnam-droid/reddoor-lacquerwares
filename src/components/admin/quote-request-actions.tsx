"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { transitionQuoteRequestAction } from "@/app/[locale]/admin/(portal)/quote-requests/actions";
import type { QuoteRequestStatus } from "@/domains/quote-requests/contracts";
import type { AdminLocale } from "@/lib/i18n/admin";

/**
 * The transition buttons on a quote request. The server decides which moves
 * are legal; this only offers the ones the current status allows and
 * carries the revision so a stale screen cannot overwrite a newer change.
 */

const copy = {
  vi: {
    moves: {
      new: "Khôi phục",
      in_progress: "Bắt đầu xử lý",
      quoted: "Đã gửi báo giá",
      closed: "Đóng yêu cầu",
      spam: "Đánh dấu spam",
    } satisfies Record<QuoteRequestStatus, string>,
    reason: "Ghi chú nội bộ (tuỳ chọn)",
    working: "Đang cập nhật…",
    done: "Đã cập nhật.",
    errors: {
      FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
      REVISION_CONFLICT: "Yêu cầu vừa được cập nhật ở nơi khác. Tải lại trang.",
      STATUS_MISMATCH: "Trạng thái hiện tại không cho phép thao tác này.",
      NOT_FOUND: "Không tìm thấy yêu cầu.",
      UNAVAILABLE: "Không thực hiện được. Thử lại sau.",
    } as Record<string, string>,
  },
  en: {
    moves: {
      new: "Restore",
      in_progress: "Start handling",
      quoted: "Quote sent",
      closed: "Close request",
      spam: "Mark as spam",
    } satisfies Record<QuoteRequestStatus, string>,
    reason: "Internal note (optional)",
    working: "Updating…",
    done: "Updated.",
    errors: {
      FORBIDDEN: "You do not have permission for this action.",
      REVISION_CONFLICT:
        "This request was just updated elsewhere. Reload the page.",
      STATUS_MISMATCH: "The current status does not allow this move.",
      NOT_FOUND: "Request not found.",
      UNAVAILABLE: "The action failed. Try again shortly.",
    } as Record<string, string>,
  },
} as const;

const primaryMoves: readonly QuoteRequestStatus[] = ["in_progress", "quoted"];

export function QuoteRequestActions({
  locale,
  requestId,
  revision,
  allowed,
}: {
  locale: AdminLocale;
  requestId: string;
  revision: number;
  allowed: readonly QuoteRequestStatus[];
}) {
  const text = copy[locale];
  const router = useRouter();
  const [busy, setBusy] = useState<QuoteRequestStatus | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{
    kind: "ok" | "error";
    message: string;
  } | null>(null);

  if (allowed.length === 0) return null;

  async function move(to: QuoteRequestStatus) {
    setBusy(to);
    setNotice(null);
    const result = await transitionQuoteRequestAction({
      requestId,
      expectedRevision: revision,
      to,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    });
    setBusy(null);
    if (result.status === "success") {
      setReason("");
      setNotice({ kind: "ok", message: text.done });
      router.refresh();
    } else {
      setNotice({
        kind: "error",
        message: text.errors[result.message] ?? text.errors.UNAVAILABLE ?? "",
      });
    }
  }

  return (
    <div className="border-burgundy/15 mt-8 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)]">
      <label className="flex flex-col gap-1.5">
        <span className="text-charcoal/70 text-xs font-semibold tracking-[0.08em] uppercase">
          {text.reason}
        </span>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={1000}
          className="border-burgundy/20 focus:border-burgundy/50 min-h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none"
        />
      </label>
      {notice ? (
        <p
          role="alert"
          className={`mt-4 text-sm ${notice.kind === "ok" ? "text-gold-ink" : "text-lacquer"}`}
        >
          {notice.message}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {allowed.map((to) => {
          const isPrimary = primaryMoves.includes(to);
          const isSpam = to === "spam";
          return (
            <button
              key={to}
              type="button"
              disabled={busy !== null}
              onClick={() => void move(to)}
              className={
                isPrimary
                  ? "bg-burgundy text-ivory hover:bg-lacquer inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
                  : isSpam
                    ? "border-lacquer/30 text-lacquer hover:border-lacquer/60 ml-auto inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
                    : "border-burgundy/25 text-burgundy hover:border-burgundy/50 inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
              }
            >
              {busy === to ? text.working : text.moves[to]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
