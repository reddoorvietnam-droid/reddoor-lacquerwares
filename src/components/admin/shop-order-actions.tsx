"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { transitionShopOrderAction } from "@/app/[locale]/admin/(portal)/shop/actions";
import type { ShopOrderStatus } from "@/domains/shop/contracts";
import type { AdminLocale } from "@/lib/i18n/admin";

/**
 * The transition buttons on a shop order: confirm, complete, cancel. The
 * server decides which moves are legal; this only offers the ones the
 * current status allows and carries the revision so a stale screen cannot
 * overwrite a colleague's change.
 */

const copy = {
  vi: {
    confirm: "Xác nhận đơn",
    complete: "Hoàn thành",
    cancel: "Huỷ đơn",
    cancelConfirm: "Huỷ hẳn? Bấm lần nữa",
    reason: "Lý do (tuỳ chọn)",
    working: "Đang cập nhật…",
    done: "Đã cập nhật.",
    errors: {
      FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
      REVISION_CONFLICT: "Đơn vừa được người khác cập nhật. Tải lại trang.",
      STATUS_MISMATCH: "Trạng thái đơn không cho phép thao tác này.",
      INSUFFICIENT_STOCK: "Tồn kho không đủ để xác nhận đơn này.",
      NOT_FOUND: "Không tìm thấy đơn.",
      UNAVAILABLE: "Không thực hiện được. Thử lại sau.",
    } as Record<string, string>,
  },
  en: {
    confirm: "Confirm order",
    complete: "Mark completed",
    cancel: "Cancel order",
    cancelConfirm: "Really cancel? Click again",
    reason: "Reason (optional)",
    working: "Updating…",
    done: "Updated.",
    errors: {
      FORBIDDEN: "You do not have permission for this action.",
      REVISION_CONFLICT:
        "Someone else just updated this order. Reload the page.",
      STATUS_MISMATCH: "The order's status does not allow this move.",
      INSUFFICIENT_STOCK: "Not enough stock left to confirm this order.",
      NOT_FOUND: "Order not found.",
      UNAVAILABLE: "The action failed. Try again shortly.",
    } as Record<string, string>,
  },
} as const;

export function ShopOrderActions({
  locale,
  orderId,
  revision,
  allowed,
}: {
  locale: AdminLocale;
  orderId: string;
  revision: number;
  allowed: readonly ShopOrderStatus[];
}) {
  const text = copy[locale];
  const router = useRouter();
  const [busy, setBusy] = useState<ShopOrderStatus | null>(null);
  const [reason, setReason] = useState("");
  const [armedToCancel, setArmedToCancel] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "ok" | "error";
    message: string;
  } | null>(null);

  if (allowed.length === 0) return null;

  async function move(to: ShopOrderStatus) {
    if (to === "cancelled" && !armedToCancel) {
      setArmedToCancel(true);
      return;
    }
    setBusy(to);
    setNotice(null);
    const result = await transitionShopOrderAction({
      orderId,
      expectedRevision: revision,
      to,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    });
    setBusy(null);
    setArmedToCancel(false);
    if (result.status === "success") {
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
        {allowed.includes("confirmed") ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void move("confirmed")}
            className="bg-gold text-burgundy inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold hover:brightness-105 disabled:pointer-events-none disabled:opacity-45"
          >
            {busy === "confirmed" ? text.working : text.confirm}
          </button>
        ) : null}
        {allowed.includes("completed") ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void move("completed")}
            className="bg-burgundy text-ivory hover:bg-lacquer inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
          >
            {busy === "completed" ? text.working : text.complete}
          </button>
        ) : null}
        {allowed.includes("cancelled") ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void move("cancelled")}
            onBlur={() => setArmedToCancel(false)}
            className={`ml-auto inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-45 ${
              armedToCancel
                ? "border-lacquer bg-lacquer text-ivory"
                : "border-lacquer/30 text-lacquer hover:border-lacquer/60"
            }`}
          >
            {busy === "cancelled"
              ? text.working
              : armedToCancel
                ? text.cancelConfirm
                : text.cancel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
