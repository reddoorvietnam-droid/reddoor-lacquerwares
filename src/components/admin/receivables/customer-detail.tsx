"use client";

import { useCallback, useEffect, useState } from "react";
import Decimal from "decimal.js";
import {
  displayDate,
  formatMoney,
  formatQuantity,
  type CustomerDetail,
  type LedgerLine,
} from "@/domains/receivables/contracts";
import {
  buttonClass,
  cardClass,
  dangerButtonClass,
  fieldClass,
  ghostButtonClass,
  labelClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadClass,
} from "@/components/admin/sample-progress-shared";
import {
  cancelEntry,
  downloadExport,
  fetchCustomerDetail,
  setOpeningBalance,
} from "./api";
import {
  badgeClass,
  debtStateLabels,
  debtTone,
  issueList,
  statusLabels,
  statusTone,
  typeLabels,
} from "./receivables-shared";
import { useReceivables } from "./receivables-workspace";
import { debtStateOf } from "@/domains/receivables/contracts";

/**
 * Sổ chi tiết công nợ của một khách: the statement that gets sent out for a
 * reconciliation. Every line shows the balance after it, computed by the server
 * in one stable order (ngày, rồi thứ tự ghi sổ), so two people reading it at
 * two times see the same running balance.
 */

const PAGE = 100;

export function CustomerDetailCard({
  customerId,
  onClose,
}: {
  customerId: string;
  onClose: () => void;
}) {
  const {
    capabilities,
    amountsVisible,
    busy,
    perform,
    notify,
    refreshAll,
    windowParams,
    openLedger,
    dataVersion,
  } = useReceivables();
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<LedgerLine | null>(null);
  const [reason, setReason] = useState("");
  const [openingDraft, setOpeningDraft] = useState<string | null>(null);
  const [openingReason, setOpeningReason] = useState("");
  const [card, setCard] = useState<HTMLElement | null>(null);

  // The card opens above the summary table the reader clicked in, so bring it
  // into view rather than leaving them looking at an unchanged screen.
  useEffect(() => {
    if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [card]);

  const load = useCallback(async () => {
    const params = windowParams();
    params.set("offset", String(offset));
    params.set("limit", String(PAGE));
    setDetail(await fetchCustomerDetail(customerId, params));
  }, [customerId, offset, windowParams]);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      setLoading(true);
      void (async () => {
        try {
          const params = windowParams();
          params.set("offset", String(offset));
          params.set("limit", String(PAGE));
          const next = await fetchCustomerDetail(customerId, params);
          if (alive) setDetail(next);
        } finally {
          if (alive) setLoading(false);
        }
      })();
    }, 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [customerId, offset, windowParams, dataVersion]);

  const money = (value: string | null) =>
    value === null || !amountsVisible ? "—" : formatMoney(value);

  const customer = detail?.customer;
  const balance = detail?.balance;
  const state = balance ? debtStateOf(balance.closing) : "SETTLED";

  return (
    <section
      ref={setCard}
      className={`${cardClass} space-y-5`}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Chi tiết công nợ</p>
          <h2 className="text-burgundy mt-2 font-serif text-2xl">
            {customer?.name || customer?.code || "Đang tải…"}
          </h2>
          <p className="text-charcoal/60 mt-1 text-sm">
            {[
              customer?.code ? `Mã ${customer.code}` : null,
              customer?.phone,
              customer?.address,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {capabilities.export && amountsVisible && (
            <button
              type="button"
              className={ghostButtonClass}
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  await downloadExport("all", windowParams(), customerId);
                  notify(
                    `Đã tải sổ công nợ của ${customer?.name || customer?.code}.`,
                  );
                })
              }
            >
              Xuất sổ công nợ
            </button>
          )}
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>

      {balance && amountsVisible && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-ivory/70 rounded-2xl px-4 py-3">
            <p className="text-charcoal/60 text-[0.68rem] tracking-[0.12em] uppercase">
              Dư đầu kỳ
            </p>
            <p className="mt-1 font-serif text-xl">
              {formatMoney(balance.opening)}
            </p>
          </div>
          <div className="bg-ivory/70 rounded-2xl px-4 py-3">
            <p className="text-charcoal/60 text-[0.68rem] tracking-[0.12em] uppercase">
              Phát sinh tăng
            </p>
            <button
              type="button"
              className="mt-1 font-serif text-xl underline-offset-2 hover:underline"
              onClick={() => openLedger("sales", customerId)}
            >
              {formatMoney(balance.increase)}
            </button>
          </div>
          <div className="bg-ivory/70 rounded-2xl px-4 py-3">
            <p className="text-charcoal/60 text-[0.68rem] tracking-[0.12em] uppercase">
              Phát sinh giảm
            </p>
            <button
              type="button"
              className="mt-1 font-serif text-xl underline-offset-2 hover:underline"
              onClick={() => openLedger("reductions", customerId)}
            >
              {formatMoney(balance.decrease)}
            </button>
          </div>
          <div className={`rounded-2xl px-4 py-3 ${debtTone[state].card}`}>
            <p className="text-[0.68rem] tracking-[0.12em] uppercase opacity-70">
              Dư hiện tại
            </p>
            <p className="mt-1 font-serif text-xl">
              {formatMoney(balance.closing)}
            </p>
            <span className={`${badgeClass} mt-1 ${debtTone[state].badge}`}>
              {debtStateLabels[state]}
            </span>
          </div>
        </div>
      )}

      {/*
        Sửa dư đầu kỳ. Restricted on purpose: after a period opens, the opening
        balance is the one figure no transaction can explain, so it is changed
        only with a reason and always leaves an audit trail.
      */}
      {capabilities.updateOpeningBalance && amountsVisible && customer && (
        <div className="border-burgundy/12 rounded-2xl border p-4">
          {openingDraft === null ? (
            <button
              type="button"
              className={ghostButtonClass}
              disabled={busy}
              onClick={() => {
                setOpeningDraft(balance?.opening ?? "0");
                setOpeningReason("");
              }}
            >
              Sửa dư đầu kỳ
            </button>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className={labelClass} htmlFor="opening-amount">
                  Dư đầu ngày 02/01/2026
                </label>
                <input
                  id="opening-amount"
                  className={fieldClass}
                  inputMode="decimal"
                  value={openingDraft}
                  onChange={(event) => setOpeningDraft(event.target.value)}
                />
              </div>
              <div className="min-w-[16rem] flex-1">
                <label className={labelClass} htmlFor="opening-reason">
                  Lý do điều chỉnh (bắt buộc)
                </label>
                <input
                  id="opening-reason"
                  className={fieldClass}
                  value={openingReason}
                  onChange={(event) => setOpeningReason(event.target.value)}
                />
              </div>
              <button
                type="button"
                className={buttonClass}
                disabled={busy || !openingReason.trim()}
                onClick={() =>
                  perform(async () => {
                    await setOpeningBalance({
                      customerId,
                      amount: openingDraft.trim(),
                      reason: openingReason.trim(),
                    });
                    setOpeningDraft(null);
                    await refreshAll();
                    await load();
                    notify("Đã cập nhật dư đầu kỳ; số dư đã tính lại.");
                  })
                }
              >
                Lưu dư đầu kỳ
              </button>
              <button
                type="button"
                className={ghostButtonClass}
                onClick={() => setOpeningDraft(null)}
              >
                Bỏ
              </button>
            </div>
          )}
        </div>
      )}

      <div className={tableWrapClass}>
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <caption className="sr-only">
            Sổ chi tiết công nợ theo thứ tự thời gian
          </caption>
          <thead className={`${theadClass} bg-ivory/60 sticky top-0 z-10`}>
            <tr>
              <th scope="col" className={thClass}>
                Ngày
              </th>
              <th scope="col" className={thClass}>
                Chứng từ
              </th>
              <th scope="col" className={thClass}>
                Loại
              </th>
              <th scope="col" className={thClass}>
                Diễn giải
              </th>
              <th scope="col" className={`${thClass} text-right`}>
                Tăng
              </th>
              <th scope="col" className={`${thClass} text-right`}>
                Giảm
              </th>
              <th scope="col" className={`${thClass} text-right`}>
                Số dư
              </th>
              <th scope="col" className={thClass} />
            </tr>
          </thead>
          <tbody>
            <tr className="border-burgundy/10 bg-ivory/40 border-b">
              <td className={`${tdClass} text-charcoal/70 italic`} colSpan={6}>
                Dư đầu kỳ
              </td>
              <td
                className={`${tdClass} text-right font-semibold tabular-nums`}
              >
                {money(detail?.openingBalance ?? null)}
              </td>
              <td className={tdClass} />
            </tr>
            {loading && (
              <tr>
                <td className={`${tdClass} text-charcoal/60`} colSpan={8}>
                  Đang tải sổ…
                </td>
              </tr>
            )}
            {!loading && detail && detail.lines.length === 0 && (
              <tr>
                <td className={`${tdClass} text-charcoal/60`} colSpan={8}>
                  Không có giao dịch nào trong khoảng đang xem.
                </td>
              </tr>
            )}
            {detail?.lines.map((line) => {
              const cancelled = line.entry.status === "CANCELLED";
              return (
                <tr
                  key={line.entry.id}
                  className={`border-burgundy/10 border-b ${
                    cancelled ? "text-charcoal/45 line-through" : ""
                  }`}
                >
                  <td className={`${tdClass} tabular-nums`}>
                    {displayDate(line.entry.entryDate)}
                  </td>
                  <td className={tdClass}>
                    {line.entry.documentNumber || "—"}
                  </td>
                  <td className={tdClass}>
                    <span className="whitespace-nowrap">
                      {typeLabels[line.entry.type]}
                    </span>
                    {line.entry.status !== "POSTED" && (
                      <span
                        className={`${badgeClass} ml-2 ${statusTone[line.entry.status]}`}
                      >
                        {statusLabels[line.entry.status]}
                      </span>
                    )}
                  </td>
                  <td className={tdClass}>
                    <span>
                      {line.entry.legacyDescription ||
                        line.entry.description ||
                        "—"}
                    </span>
                    {line.entry.itemCode && (
                      <span className="text-charcoal/60 block text-xs">
                        {line.entry.itemCode}
                        {line.entry.itemName ? ` · ${line.entry.itemName}` : ""}
                        {line.entry.quantity
                          ? ` · ${formatQuantity(line.entry.quantity)} ${line.entry.unit}`
                          : ""}
                        {amountsVisible && line.entry.unitPrice
                          ? ` × ${formatMoney(line.entry.unitPrice)}`
                          : ""}
                      </span>
                    )}
                    {line.entry.issues.length > 0 && (
                      <span className="mt-1 block text-xs text-amber-800">
                        ⚠ {issueList(line.entry.issues)}
                      </span>
                    )}
                    {line.entry.cancelReason && (
                      <span className="text-charcoal/60 block text-xs no-underline">
                        Lý do hủy: {line.entry.cancelReason}
                      </span>
                    )}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {money(line.increase)}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {money(line.decrease)}
                  </td>
                  <td
                    className={`${tdClass} text-right font-semibold tabular-nums`}
                  >
                    {money(line.balance)}
                  </td>
                  <td className={`${tdClass} receivables-no-print`}>
                    {capabilities.cancelEntry &&
                      line.entry.status === "POSTED" && (
                        <button
                          type="button"
                          className={dangerButtonClass}
                          disabled={busy}
                          onClick={() => {
                            setCancelling(line);
                            setReason("");
                          }}
                        >
                          Hủy
                        </button>
                      )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detail && detail.total > PAGE && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={ghostButtonClass}
            disabled={offset === 0 || busy}
            onClick={() => setOffset(Math.max(0, offset - PAGE))}
          >
            Trang trước
          </button>
          <span className="text-charcoal/60 text-sm">
            {offset + 1}–{Math.min(offset + PAGE, detail.total)} /{" "}
            {detail.total}
          </span>
          <button
            type="button"
            className={ghostButtonClass}
            disabled={detail.nextOffset === null || busy}
            onClick={() => setOffset(detail.nextOffset ?? offset)}
          >
            Trang sau
          </button>
        </div>
      )}

      {/*
        Cancelling never deletes: the entry stays, stops counting, and the
        balance goes back to what it was. That is the only accounting-safe way
        to undo a posted figure.
      */}
      {cancelling && (
        <div className="rounded-2xl bg-red-50 p-4">
          <p className="text-sm text-red-900">
            Hủy {typeLabels[cancelling.entry.type]} ngày{" "}
            {displayDate(cancelling.entry.entryDate)}
            {amountsVisible
              ? `, số tiền ${formatMoney(cancelling.entry.amount)} ₫`
              : ""}
            ? Giao dịch vẫn nằm trong sổ nhưng thôi tính vào số dư.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[18rem] flex-1">
              <label className={labelClass} htmlFor="cancel-reason">
                Lý do hủy (bắt buộc)
              </label>
              <input
                id="cancel-reason"
                className={fieldClass}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            <button
              type="button"
              className={dangerButtonClass}
              disabled={busy || !reason.trim()}
              onClick={() =>
                perform(async () => {
                  await cancelEntry({
                    id: cancelling.entry.id,
                    version: cancelling.entry.version,
                    reason: reason.trim(),
                  });
                  setCancelling(null);
                  await refreshAll();
                  await load();
                  notify("Đã hủy giao dịch; số dư đã tính lại.");
                })
              }
            >
              Xác nhận hủy
            </button>
            <button
              type="button"
              className={ghostButtonClass}
              onClick={() => setCancelling(null)}
            >
              Bỏ
            </button>
          </div>
        </div>
      )}

      {detail && amountsVisible && (
        <p className="text-charcoal/55 text-xs">
          Dư cuối kỳ {formatMoney(detail.balance.closing)} = dư đầu{" "}
          {formatMoney(detail.balance.opening)} + tăng{" "}
          {formatMoney(detail.balance.increase)} − giảm{" "}
          {formatMoney(detail.balance.decrease)}.{" "}
          {new Decimal(detail.balance.closing).lt(0) &&
            "Số âm nghĩa là khách đã trả trước, không phải lỗi."}
        </p>
      )}
    </section>
  );
}
