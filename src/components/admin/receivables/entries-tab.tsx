"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Decimal from "decimal.js";
import {
  displayDate,
  formatMoney,
  formatQuantity,
  lineAmount,
  todayInBusinessZone,
  type CatalogueItem,
  type EntryListResponse,
  type EntryType,
  type ReceivableEntry,
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
  createEntry,
  createSaleBatch,
  fetchEntries,
  saveCatalogueItem,
  updateEntry,
} from "./api";
import {
  badgeClass,
  issueList,
  reductionOptions,
  statusLabels,
  statusTone,
  typeLabels,
} from "./receivables-shared";
import { useReceivables } from "./receivables-workspace";

/**
 * Phát sinh bán hàng and Thanh toán / Giảm nợ: the two ledgers behind the two
 * movement columns, each with the form that adds to it and in-place editing of
 * what is already there.
 *
 * These tabs are where the numbers come from — the summary only adds them up.
 */

const PAGE = 100;

type Kind = "sales" | "reductions";

const copy: Record<
  Kind,
  { title: string; empty: string; action: string; total: string }
> = {
  sales: {
    title: "Sổ chi tiết bán hàng",
    empty: "Chưa có dòng bán hàng nào trong khoảng đang xem.",
    action: "Ghi phát sinh bán hàng",
    total: "Tổng phát sinh tăng đã ghi sổ",
  },
  reductions: {
    title: "Bảng thanh toán / giảm công nợ",
    empty: "Chưa có thanh toán hay bù trừ nào trong khoảng đang xem.",
    action: "Ghi nhận thanh toán / giảm nợ",
    total: "Tổng phát sinh giảm đã ghi sổ",
  },
};

const cellInput = `${fieldClass} min-w-0 px-2 py-1 text-sm`;

export function ReceivablesEntries({ kind }: { kind: Kind }) {
  const {
    capabilities,
    amountsVisible,
    customers,
    busy,
    perform,
    notify,
    refreshAll,
    windowParams,
    ledgerCustomer,
    setLedgerCustomer,
    dataVersion,
    openCustomer,
  } = useReceivables();

  const [data, setData] = useState<EntryListResponse | null>(null);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [cancelling, setCancelling] = useState<ReceivableEntry | null>(null);
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const params = useCallback(() => {
    const query = windowParams();
    query.set("role", kind === "sales" ? "DEBIT" : "CREDIT");
    query.set("offset", String(offset));
    query.set("limit", String(PAGE));
    if (ledgerCustomer) query.set("customerId", ledgerCustomer);
    if (status) query.set("status", status);
    if (search.trim()) query.set("q", search.trim());
    return query;
  }, [kind, offset, windowParams, ledgerCustomer, status, search]);

  const load = useCallback(async () => {
    setData(await fetchEntries(params()));
  }, [params]);

  useEffect(() => {
    let alive = true;
    // Debounced so typing in the search box does not hammer the server, and
    // deferred so no state is set synchronously inside the effect body.
    const timer = setTimeout(
      () => {
        setLoading(true);
        void (async () => {
          try {
            const next = await fetchEntries(params());
            if (alive) setData(next);
          } finally {
            if (alive) setLoading(false);
          }
        })();
      },
      search ? 250 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [params, search, dataVersion]);

  const focused = useMemo(
    () => customers.find((customer) => customer.id === ledgerCustomer) ?? null,
    [customers, ledgerCustomer],
  );

  const canWrite =
    kind === "sales" ? capabilities.recordSale : capabilities.recordReduction;
  const money = (value: string | null) =>
    value === null || !amountsVisible ? "—" : formatMoney(value);
  const columns = kind === "sales" ? 12 : 10;

  return (
    <div className="space-y-4">
      <div className="receivables-no-print flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <label className={labelClass} htmlFor={`entries-search-${kind}`}>
            Tìm trong sổ
          </label>
          <input
            id={`entries-search-${kind}`}
            type="search"
            className={fieldClass}
            placeholder={
              kind === "sales"
                ? "Mã khách, tên, mã hàng, chứng từ"
                : "Mã khách, tên, diễn giải, chứng từ"
            }
            value={search}
            onChange={(event) => {
              setOffset(0);
              setSearch(event.target.value);
            }}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor={`entries-status-${kind}`}>
            Trạng thái
          </label>
          <select
            id={`entries-status-${kind}`}
            className={fieldClass}
            value={status}
            onChange={(event) => {
              setOffset(0);
              setStatus(event.target.value);
            }}
          >
            <option value="">Tất cả</option>
            <option value="POSTED">Đã ghi sổ</option>
            <option value="DRAFT">Nháp</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </div>
        {focused && (
          <button
            type="button"
            className={ghostButtonClass}
            onClick={() => {
              setOffset(0);
              setLedgerCustomer(null);
            }}
          >
            Bỏ lọc khách: {focused.code}
          </button>
        )}
        {canWrite && (
          <button
            type="button"
            className={buttonClass}
            aria-expanded={formOpen}
            onClick={() => setFormOpen((open) => !open)}
          >
            + {copy[kind].action}
          </button>
        )}
      </div>

      {formOpen &&
        canWrite &&
        (kind === "sales" ? (
          <SaleBatchForm
            defaultCustomerId={ledgerCustomer}
            onDone={async (label) => {
              setFormOpen(false);
              setOffset(0);
              await refreshAll();
              await load();
              notify(label);
            }}
          />
        ) : (
          <ReductionForm
            defaultCustomerId={ledgerCustomer}
            onDone={async (label) => {
              setFormOpen(false);
              setOffset(0);
              await refreshAll();
              await load();
              notify(label);
            }}
          />
        ))}

      <div className={tableWrapClass}>
        <table className="w-full min-w-[72rem] border-collapse text-sm">
          <caption className="sr-only">{copy[kind].title}</caption>
          <thead className={`${theadClass} bg-ivory/60 sticky top-0 z-10`}>
            <tr>
              <th scope="col" className={thClass}>
                Ngày tháng
              </th>
              <th scope="col" className={thClass}>
                Mã khách
              </th>
              <th scope="col" className={thClass}>
                Tên khách
              </th>
              <th scope="col" className={thClass}>
                Chứng từ
              </th>
              {kind === "sales" ? (
                <>
                  <th scope="col" className={thClass}>
                    Mã hàng
                  </th>
                  <th scope="col" className={thClass}>
                    Mặt hàng
                  </th>
                  <th scope="col" className={`${thClass} text-right`}>
                    Số lượng
                  </th>
                  <th scope="col" className={`${thClass} text-right`}>
                    Đơn giá
                  </th>
                </>
              ) : (
                <>
                  <th scope="col" className={thClass}>
                    Loại
                  </th>
                  <th scope="col" className={thClass}>
                    Diễn giải
                  </th>
                </>
              )}
              <th scope="col" className={`${thClass} text-right`}>
                {kind === "sales" ? "Thành tiền" : "Số tiền"}
              </th>
              <th scope="col" className={thClass}>
                Ghi chú
              </th>
              <th scope="col" className={thClass} />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className={`${tdClass} text-charcoal/60`} colSpan={columns}>
                  Đang tải…
                </td>
              </tr>
            )}
            {!loading && data && data.entries.length === 0 && (
              <tr>
                <td className={`${tdClass} text-charcoal/60`} colSpan={columns}>
                  {copy[kind].empty}
                </td>
              </tr>
            )}
            {data?.entries.map((entry) =>
              editing === entry.id ? (
                <EditableRow
                  key={entry.id}
                  kind={kind}
                  entry={entry}
                  onClose={() => setEditing(null)}
                  onSaved={async () => {
                    setEditing(null);
                    await refreshAll();
                    await load();
                    notify("Đã sửa dòng; số dư đã tính lại.");
                  }}
                />
              ) : (
                <tr
                  key={entry.id}
                  className={`border-burgundy/10 hover:bg-ivory/50 border-b ${
                    entry.status === "CANCELLED"
                      ? "text-charcoal/45 line-through"
                      : ""
                  }`}
                >
                  <td className={`${tdClass} tabular-nums`}>
                    {displayDate(entry.entryDate)}
                  </td>
                  <td className={tdClass}>
                    <button
                      type="button"
                      className="text-burgundy font-semibold underline-offset-2 hover:underline"
                      onClick={() => openCustomer(entry.customerId)}
                    >
                      {entry.customerCode}
                    </button>
                  </td>
                  <td className={tdClass}>{entry.customerName || "—"}</td>
                  <td className={tdClass}>{entry.documentNumber || "—"}</td>
                  {kind === "sales" ? (
                    <>
                      <td className={tdClass}>{entry.itemCode || "—"}</td>
                      <td className={tdClass}>{entry.itemName || "—"}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {entry.quantity
                          ? `${formatQuantity(entry.quantity)} ${entry.unit}`
                          : "—"}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {money(entry.unitPrice)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className={tdClass}>{typeLabels[entry.type]}</td>
                      <td className={tdClass}>
                        {entry.legacyDescription || entry.description || "—"}
                      </td>
                    </>
                  )}
                  <td
                    className={`${tdClass} text-right font-semibold tabular-nums`}
                  >
                    {money(entry.amount)}
                  </td>
                  <td className={tdClass}>
                    {entry.note || ""}
                    {entry.status !== "POSTED" && (
                      <span
                        className={`${badgeClass} ${statusTone[entry.status]}`}
                      >
                        {statusLabels[entry.status]}
                      </span>
                    )}
                    {entry.issues.length > 0 && (
                      <span className="block text-xs text-amber-800">
                        ⚠ {issueList(entry.issues)}
                      </span>
                    )}
                    {entry.cancelReason && (
                      <span className="text-charcoal/60 block text-xs no-underline">
                        Lý do hủy: {entry.cancelReason}
                      </span>
                    )}
                  </td>
                  <td className={`${tdClass} receivables-no-print`}>
                    <div className="flex gap-1.5">
                      {capabilities.updateEntry &&
                        entry.status !== "CANCELLED" && (
                          <button
                            type="button"
                            className={ghostButtonClass}
                            disabled={busy}
                            onClick={() => {
                              setCancelling(null);
                              setEditing(entry.id);
                            }}
                          >
                            Sửa
                          </button>
                        )}
                      {capabilities.cancelEntry &&
                        entry.status === "POSTED" && (
                          <button
                            type="button"
                            className={dangerButtonClass}
                            disabled={busy}
                            onClick={() => {
                              setEditing(null);
                              setCancelling(entry);
                              setReason("");
                            }}
                          >
                            Hủy
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-charcoal/60 text-sm">
          {data
            ? `${data.total.toLocaleString("vi-VN")} dòng` +
              (amountsVisible
                ? ` · ${copy[kind].total}: ${formatMoney(data.totalAmount)} ₫`
                : "")
            : ""}
        </p>
        {data && data.total > PAGE && (
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
              {offset + 1}–{Math.min(offset + PAGE, data.total)} / {data.total}
            </span>
            <button
              type="button"
              className={ghostButtonClass}
              disabled={data.nextOffset === null || busy}
              onClick={() => setOffset(data.nextOffset ?? offset)}
            >
              Trang sau
            </button>
          </div>
        )}
      </div>

      {capabilities.updateEntry && (
        <p className="text-charcoal/55 text-xs">
          Bấm “Sửa” để chỉnh trực tiếp một dòng đã ghi — mọi thay đổi đều được
          ghi lại trong Nhật ký kèm số cũ, số mới và người sửa. Dòng đã hủy thì
          không sửa được nữa.
        </p>
      )}

      {cancelling && (
        <div className="rounded-2xl bg-red-50 p-4">
          <p className="text-sm text-red-900">
            Hủy {typeLabels[cancelling.type]} của {cancelling.customerCode} ngày{" "}
            {displayDate(cancelling.entryDate)}
            {amountsVisible ? `, ${formatMoney(cancelling.amount)} ₫` : ""}?
            Dòng vẫn nằm trong sổ nhưng thôi tính vào số dư.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[18rem] flex-1">
              <label className={labelClass} htmlFor={`cancel-${kind}`}>
                Lý do hủy (bắt buộc)
              </label>
              <input
                id={`cancel-${kind}`}
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
                    id: cancelling.id,
                    version: cancelling.version,
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
    </div>
  );
}

// ---------------------------------------------------------------- in-place edit

/**
 * The row turns into inputs. Every column a person could have got wrong is
 * editable, except the sale's `Thành tiền` — that stays the server's product of
 * quantity and price, so a total can never be typed over its own lines.
 */
function EditableRow({
  kind,
  entry,
  onClose,
  onSaved,
}: {
  kind: Kind;
  entry: ReceivableEntry;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { customers, busy, perform, amountsVisible } = useReceivables();
  const today = todayInBusinessZone();
  const [draft, setDraft] = useState({
    entryDate: entry.entryDate,
    customerId: entry.customerId,
    documentNumber: entry.documentNumber,
    itemCode: entry.itemCode,
    quantity: entry.quantity ?? "",
    unitPrice: entry.unitPrice ?? "",
    type: entry.type,
    description: entry.legacyDescription || entry.description,
    amount: entry.amount,
    note: entry.note,
    reason: "",
  });
  const set = (patch: Partial<typeof draft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const preview =
    kind === "sales" && draft.quantity && draft.unitPrice
      ? lineAmount(draft.quantity.trim(), draft.unitPrice.trim())
      : null;

  const save = () =>
    perform(async () => {
      const patch: Record<string, unknown> = {};
      if (draft.entryDate !== entry.entryDate)
        patch.entryDate = draft.entryDate;
      if (draft.customerId !== entry.customerId)
        patch.customerId = draft.customerId;
      if (draft.documentNumber !== entry.documentNumber)
        patch.documentNumber = draft.documentNumber.trim();
      if (draft.note !== entry.note) patch.note = draft.note.trim();
      if (kind === "sales") {
        if (draft.itemCode.trim() !== entry.itemCode)
          patch.itemCode = draft.itemCode.trim();
        if (draft.quantity.trim() !== (entry.quantity ?? ""))
          patch.quantity = draft.quantity.trim();
        if (draft.unitPrice.trim() !== (entry.unitPrice ?? ""))
          patch.unitPrice = draft.unitPrice.trim();
      } else {
        if (draft.type !== entry.type) patch.type = draft.type;
        if (draft.amount.trim() !== entry.amount)
          patch.amount = draft.amount.trim();
        if (
          draft.description !== (entry.legacyDescription || entry.description)
        )
          patch.description = draft.description.trim();
      }
      if (Object.keys(patch).length === 0) {
        onClose();
        return;
      }
      await updateEntry({
        id: entry.id,
        version: entry.version,
        patch,
        reason: draft.reason.trim(),
      });
      await onSaved();
    });

  return (
    <tr className="border-burgundy/25 bg-ivory/60 border-b">
      <td className={tdClass}>
        <input
          type="date"
          max={today}
          className={cellInput}
          aria-label="Ngày tháng"
          value={draft.entryDate}
          onChange={(event) => set({ entryDate: event.target.value })}
        />
      </td>
      <td className={tdClass} colSpan={2}>
        <select
          className={cellInput}
          aria-label="Khách hàng"
          value={draft.customerId}
          onChange={(event) => set({ customerId: event.target.value })}
        >
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.code} — {customer.name || "(chưa có tên)"}
            </option>
          ))}
        </select>
      </td>
      <td className={tdClass}>
        <input
          className={cellInput}
          aria-label="Số chứng từ"
          value={draft.documentNumber}
          onChange={(event) => set({ documentNumber: event.target.value })}
        />
      </td>
      {kind === "sales" ? (
        <>
          <td className={tdClass} colSpan={2}>
            <input
              className={cellInput}
              list="receivables-items"
              aria-label="Mã hàng hóa"
              value={draft.itemCode}
              onChange={(event) => set({ itemCode: event.target.value })}
            />
          </td>
          <td className={tdClass}>
            <input
              className={`${cellInput} text-right`}
              inputMode="decimal"
              aria-label="Số lượng"
              value={draft.quantity}
              onChange={(event) => set({ quantity: event.target.value })}
            />
          </td>
          <td className={tdClass}>
            <input
              className={`${cellInput} text-right`}
              inputMode="decimal"
              aria-label="Đơn giá"
              value={draft.unitPrice}
              onChange={(event) => set({ unitPrice: event.target.value })}
            />
          </td>
          <td className={`${tdClass} text-right font-semibold tabular-nums`}>
            {preview && amountsVisible ? formatMoney(preview) : "—"}
          </td>
        </>
      ) : (
        <>
          <td className={tdClass}>
            <select
              className={cellInput}
              aria-label="Loại giảm nợ"
              value={draft.type}
              onChange={(event) =>
                set({ type: event.target.value as EntryType })
              }
            >
              {reductionOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </td>
          <td className={tdClass}>
            <input
              className={cellInput}
              aria-label="Diễn giải"
              value={draft.description}
              onChange={(event) => set({ description: event.target.value })}
            />
          </td>
          <td className={tdClass}>
            <input
              className={`${cellInput} text-right`}
              inputMode="decimal"
              aria-label="Số tiền"
              value={draft.amount}
              onChange={(event) => set({ amount: event.target.value })}
            />
          </td>
        </>
      )}
      <td className={tdClass}>
        <input
          className={cellInput}
          aria-label="Ghi chú"
          value={draft.note}
          onChange={(event) => set({ note: event.target.value })}
        />
        <input
          className={`${cellInput} mt-1`}
          aria-label="Lý do sửa"
          placeholder="Lý do sửa (ghi vào nhật ký)"
          value={draft.reason}
          onChange={(event) => set({ reason: event.target.value })}
        />
      </td>
      <td className={`${tdClass} receivables-no-print`}>
        <div className="flex gap-1.5">
          <button
            type="button"
            className={buttonClass}
            disabled={busy}
            onClick={save}
          >
            Lưu
          </button>
          <button
            type="button"
            className={ghostButtonClass}
            disabled={busy}
            onClick={onClose}
          >
            Bỏ
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------- new item code

/**
 * Adding a paint code without leaving the sale. It writes the shared paint
 * catalogue, so the code is then available to `Bảng xuất kho sơn` and
 * `Hóa đơn bán hàng` too.
 */
function CatalogueForm({
  code,
  existing,
  onSaved,
  onClose,
}: {
  code: string;
  existing: CatalogueItem | null;
  onSaved: (item: CatalogueItem) => void;
  onClose: () => void;
}) {
  const { busy, perform, notify } = useReceivables();
  const [draft, setDraft] = useState({
    code: existing?.code ?? code,
    name: existing?.name ?? "",
    unit: existing?.unit ?? "Kg",
    salePrice: existing?.salePrice ?? "",
  });
  const set = (patch: Partial<typeof draft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  return (
    <div className="border-burgundy/20 bg-ivory/60 mt-3 rounded-2xl border p-4">
      <p className="text-burgundy mb-3 font-semibold">
        {existing ? `Sửa mã ${existing.code}` : `Thêm mã mới: ${code}`}
      </p>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass} htmlFor="cat-code">
            Mã hàng hóa *
          </label>
          <input
            id="cat-code"
            className={fieldClass}
            value={draft.code}
            disabled={Boolean(existing)}
            onChange={(event) => set({ code: event.target.value })}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="cat-name">
            Tên hàng
          </label>
          <input
            id="cat-name"
            className={fieldClass}
            value={draft.name}
            onChange={(event) => set({ name: event.target.value })}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="cat-unit">
            Đơn vị tính
          </label>
          <input
            id="cat-unit"
            className={fieldClass}
            value={draft.unit}
            onChange={(event) => set({ unit: event.target.value })}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="cat-price">
            Giá bán
          </label>
          <input
            id="cat-price"
            className={fieldClass}
            inputMode="decimal"
            value={draft.salePrice}
            onChange={(event) => set({ salePrice: event.target.value })}
          />
        </div>
      </div>
      <p className="text-charcoal/55 mt-2 text-xs">
        Mã này dùng chung với Bảng xuất kho sơn và Hóa đơn bán hàng. Đổi giá chỉ
        áp dụng cho lần bán sau — công nợ đã ghi giữ nguyên giá lúc bán.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={busy || !draft.code.trim()}
          onClick={() =>
            perform(async () => {
              const { item } = await saveCatalogueItem({
                code: draft.code.trim(),
                name: draft.name.trim(),
                unit: draft.unit.trim(),
                salePrice: draft.salePrice.trim() || null,
              });
              onSaved(item);
              notify(
                existing
                  ? `Đã cập nhật mã ${item.code}.`
                  : `Đã thêm mã ${item.code} vào danh mục sơn.`,
              );
            })
          }
        >
          {existing ? "Lưu mã" : "Thêm vào danh mục"}
        </button>
        <button type="button" className={ghostButtonClass} onClick={onClose}>
          Bỏ
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- sale form

type DraftLine = {
  id: string;
  itemCode: string;
  quantity: string;
  unitPrice: string;
  note: string;
};

const emptyLine = (): DraftLine => ({
  id: crypto.randomUUID(),
  itemCode: "",
  quantity: "",
  unitPrice: "",
  note: "",
});

/**
 * One customer, one date, many items — a workshop buying six paints in one
 * visit is one form, not six trips through the screen. Each line still becomes
 * its own ledger entry, which is what keeps `Phát sinh tăng` traceable to an
 * item; they share a document number and are written in one transaction.
 */
function SaleBatchForm({
  defaultCustomerId,
  onDone,
}: {
  defaultCustomerId: string | null;
  onDone: (message: string) => Promise<void>;
}) {
  const { customers, items, busy, perform, amountsVisible, refreshAll } =
    useReceivables();
  const today = todayInBusinessZone();
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const [entryDate, setEntryDate] = useState(today);
  const [documentNumber, setDocumentNumber] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [catalogueFor, setCatalogueFor] = useState<string | null>(null);
  /** Minted once per form and reused on every retry, so a purchase posts once. */
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  const byCode = useMemo(() => {
    const map = new Map<string, CatalogueItem>();
    for (const item of items)
      map.set(item.code.toLocaleLowerCase("en-US"), item);
    return map;
  }, [items]);
  const lookup = (code: string) =>
    byCode.get(code.trim().toLocaleLowerCase("en-US")) ?? null;

  const setLine = (id: string, patch: Partial<DraftLine>) =>
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );

  /** Choosing a known code fills the price in as a starting point only. */
  const changeCode = (id: string, code: string) => {
    const found = lookup(code);
    setLines((current) =>
      current.map((line) =>
        line.id === id
          ? {
              ...line,
              itemCode: code,
              unitPrice:
                found?.salePrice && !line.unitPrice
                  ? found.salePrice
                  : line.unitPrice,
            }
          : line,
      ),
    );
  };

  const total = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const amount =
          line.quantity && line.unitPrice
            ? lineAmount(line.quantity.trim(), line.unitPrice.trim())
            : null;
        return amount ? sum.plus(amount) : sum;
      }, new Decimal(0)),
    [lines],
  );

  const filled = lines.filter(
    (line) =>
      line.itemCode.trim() && line.quantity.trim() && line.unitPrice.trim(),
  );
  const ready = Boolean(customerId && entryDate && filled.length);

  const submit = (post: boolean) =>
    perform(async () => {
      const { entries } = await createSaleBatch({
        customerId,
        entryDate,
        documentNumber: documentNumber.trim(),
        note: note.trim(),
        post,
        idempotencyKey,
        lines: filled.map((line) => ({
          id: line.id,
          itemCode: line.itemCode.trim(),
          quantity: line.quantity.trim(),
          unitPrice: line.unitPrice.trim(),
          description: "xuất kho",
          note: line.note.trim(),
        })),
      });
      setIdempotencyKey(crypto.randomUUID());
      setLines([emptyLine()]);
      setDocumentNumber("");
      setNote("");
      const sum = entries.reduce(
        (carry, entry) => carry.plus(entry.amount),
        new Decimal(0),
      );
      await onDone(
        post
          ? `Đã ghi sổ ${entries.length} dòng bán hàng cho ${entries[0]?.customerCode}` +
              (amountsVisible ? ` — ${formatMoney(sum.toFixed())} ₫.` : ".")
          : `Đã lưu nháp ${entries.length} dòng; bản nháp chưa tính vào số dư.`,
      );
    });

  return (
    <section className={`${cardClass} space-y-4`}>
      <h3 className="text-burgundy font-serif text-xl">
        Ghi phát sinh bán hàng
      </h3>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelClass} htmlFor="sale-customer">
            Khách hàng *
          </label>
          <select
            id="sale-customer"
            className={fieldClass}
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
          >
            <option value="">— Chọn khách —</option>
            {customers
              .filter((customer) => customer.active)
              .map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.code} — {customer.name || "(chưa có tên)"}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="sale-date">
            Ngày tháng *
          </label>
          <input
            id="sale-date"
            type="date"
            max={today}
            className={fieldClass}
            value={entryDate}
            onChange={(event) => setEntryDate(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="sale-doc">
            Số chứng từ
          </label>
          <input
            id="sale-doc"
            className={fieldClass}
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="sale-note">
            Ghi chú chung
          </label>
          <input
            id="sale-note"
            className={fieldClass}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>

      <div className={tableWrapClass}>
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <caption className="sr-only">Các mặt hàng trong lần bán này</caption>
          <thead className={`${theadClass} bg-ivory/60`}>
            <tr>
              <th scope="col" className={`${thClass} w-10`}>
                #
              </th>
              <th scope="col" className={thClass}>
                Mã hàng hóa *
              </th>
              <th scope="col" className={thClass}>
                Mặt hàng
              </th>
              <th scope="col" className={`${thClass} text-right`}>
                Số lượng *
              </th>
              <th scope="col" className={`${thClass} text-right`}>
                Đơn giá *
              </th>
              <th scope="col" className={`${thClass} text-right`}>
                Thành tiền
              </th>
              <th scope="col" className={thClass}>
                Ghi chú
              </th>
              <th scope="col" className={thClass} />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const item = lookup(line.itemCode);
              const amount =
                line.quantity && line.unitPrice
                  ? lineAmount(line.quantity.trim(), line.unitPrice.trim())
                  : null;
              const unknown = line.itemCode.trim() !== "" && !item;
              return (
                <tr key={line.id} className="border-burgundy/10 border-b">
                  <td className={`${tdClass} text-charcoal/60`}>{index + 1}</td>
                  <td className={tdClass}>
                    <input
                      className={cellInput}
                      list="receivables-items"
                      aria-label={`Mã hàng dòng ${index + 1}`}
                      value={line.itemCode}
                      onChange={(event) =>
                        changeCode(line.id, event.target.value)
                      }
                    />
                  </td>
                  <td className={tdClass}>
                    {item ? (
                      <span>
                        {item.name}
                        <span className="text-charcoal/55"> · {item.unit}</span>
                      </span>
                    ) : unknown ? (
                      <span className="text-xs text-amber-800">
                        Mã chưa có trong danh mục
                      </span>
                    ) : (
                      <span className="text-charcoal/40">—</span>
                    )}
                  </td>
                  <td className={tdClass}>
                    <input
                      className={`${cellInput} text-right`}
                      inputMode="decimal"
                      aria-label={`Số lượng dòng ${index + 1}`}
                      value={line.quantity}
                      onChange={(event) =>
                        setLine(line.id, { quantity: event.target.value })
                      }
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      className={`${cellInput} text-right`}
                      inputMode="decimal"
                      aria-label={`Đơn giá dòng ${index + 1}`}
                      value={line.unitPrice}
                      onChange={(event) =>
                        setLine(line.id, { unitPrice: event.target.value })
                      }
                    />
                  </td>
                  <td
                    className={`${tdClass} text-right font-semibold tabular-nums`}
                  >
                    {amount && amountsVisible ? formatMoney(amount) : "—"}
                  </td>
                  <td className={tdClass}>
                    <input
                      className={cellInput}
                      aria-label={`Ghi chú dòng ${index + 1}`}
                      value={line.note}
                      onChange={(event) =>
                        setLine(line.id, { note: event.target.value })
                      }
                    />
                  </td>
                  <td className={tdClass}>
                    <button
                      type="button"
                      className={ghostButtonClass}
                      disabled={lines.length === 1}
                      onClick={() =>
                        setLines((current) =>
                          current.filter(
                            (candidate) => candidate.id !== line.id,
                          ),
                        )
                      }
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-burgundy/25 bg-ivory/70 border-t-2 font-semibold">
              <td className={tdClass} colSpan={5}>
                Tổng cộng {filled.length} dòng
              </td>
              <td className={`${tdClass} text-right tabular-nums`}>
                {amountsVisible ? `${formatMoney(total.toFixed())} ₫` : "—"}
              </td>
              <td className={tdClass} colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      <datalist id="receivables-items">
        {items.slice(0, 1200).map((item) => (
          <option key={item.code} value={item.code}>
            {item.name}
          </option>
        ))}
      </datalist>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={ghostButtonClass}
          onClick={() => setLines((current) => [...current, emptyLine()])}
        >
          + Thêm dòng
        </button>
        <CatalogueTrigger
          lines={lines}
          lookup={lookup}
          onOpen={setCatalogueFor}
        />
      </div>

      {catalogueFor !== null && (
        <CatalogueForm
          code={catalogueFor}
          existing={lookup(catalogueFor)}
          onClose={() => setCatalogueFor(null)}
          onSaved={async (item) => {
            setCatalogueFor(null);
            // Refresh the catalogue so the new code resolves on the line.
            await refreshAll();
            setLines((current) =>
              current.map((line) =>
                line.itemCode.trim().toLocaleLowerCase("en-US") ===
                item.code.toLocaleLowerCase("en-US")
                  ? {
                      ...line,
                      itemCode: item.code,
                      unitPrice: line.unitPrice || (item.salePrice ?? ""),
                    }
                  : line,
              ),
            );
          }}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={busy || !ready}
          onClick={() => submit(true)}
        >
          Ghi sổ {filled.length > 0 ? `${filled.length} dòng` : ""}
        </button>
        <button
          type="button"
          className={ghostButtonClass}
          disabled={busy || !ready}
          onClick={() => submit(false)}
        >
          Lưu nháp
        </button>
      </div>
    </section>
  );
}

/** Offers "add this code" for the first unknown code typed into the lines. */
function CatalogueTrigger({
  lines,
  lookup,
  onOpen,
}: {
  lines: DraftLine[];
  lookup: (code: string) => CatalogueItem | null;
  onOpen: (code: string) => void;
}) {
  const { capabilities } = useReceivables();
  if (!capabilities.manageCatalog) return null;
  const unknown = lines.find(
    (line) => line.itemCode.trim() !== "" && !lookup(line.itemCode),
  );
  return (
    <button
      type="button"
      className={ghostButtonClass}
      onClick={() => onOpen(unknown ? unknown.itemCode.trim() : "")}
    >
      {unknown
        ? `+ Thêm mã “${unknown.itemCode.trim()}” vào danh mục`
        : "+ Thêm mã sơn mới"}
    </button>
  );
}

// ---------------------------------------------------------------- reduction form

function ReductionForm({
  defaultCustomerId,
  onDone,
}: {
  defaultCustomerId: string | null;
  onDone: (message: string) => Promise<void>;
}) {
  const { customers, busy, perform, amountsVisible } = useReceivables();
  const today = todayInBusinessZone();
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const [entryDate, setEntryDate] = useState(today);
  const [type, setType] = useState<EntryType>("PAYMENT");
  const [amount, setAmount] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  const ready = Boolean(customerId && entryDate && amount.trim());

  const submit = (post: boolean) =>
    perform(async () => {
      const { entry } = await createEntry({
        kind: "reduction",
        customerId,
        entryDate,
        type,
        amount: amount.trim(),
        documentNumber: documentNumber.trim(),
        description: description.trim(),
        note: note.trim(),
        post,
        idempotencyKey,
      });
      setIdempotencyKey(crypto.randomUUID());
      setAmount("");
      setDocumentNumber("");
      setNote("");
      await onDone(
        post
          ? `Đã ghi sổ ${typeLabels[entry.type].toLowerCase()} cho ${entry.customerCode}${
              amountsVisible ? ` — ${formatMoney(entry.amount)} ₫` : ""
            }.`
          : "Đã lưu bản nháp; bản nháp chưa tính vào số dư.",
      );
    });

  return (
    <section className={`${cardClass} space-y-4`}>
      <h3 className="text-burgundy font-serif text-xl">
        Ghi nhận thanh toán / giảm nợ
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelClass} htmlFor="form-customer-reductions">
            Khách hàng *
          </label>
          <select
            id="form-customer-reductions"
            className={fieldClass}
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
          >
            <option value="">— Chọn khách —</option>
            {customers
              .filter((customer) => customer.active)
              .map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.code} — {customer.name || "(chưa có tên)"}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="form-date-reductions">
            Ngày tháng *
          </label>
          <input
            id="form-date-reductions"
            type="date"
            max={today}
            className={fieldClass}
            value={entryDate}
            onChange={(event) => setEntryDate(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="form-type-reductions">
            Loại giảm nợ *
          </label>
          <select
            id="form-type-reductions"
            className={fieldClass}
            value={type}
            onChange={(event) => setType(event.target.value as EntryType)}
          >
            {reductionOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="form-amount-reductions">
            Số tiền *
          </label>
          <input
            id="form-amount-reductions"
            className={fieldClass}
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="form-doc-reductions">
            Số chứng từ
          </label>
          <input
            id="form-doc-reductions"
            className={fieldClass}
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="form-desc-reductions">
            Diễn giải
          </label>
          <input
            id="form-desc-reductions"
            className={fieldClass}
            placeholder="thanh toán"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="form-note-reductions">
            Ghi chú
          </label>
          <input
            id="form-note-reductions"
            className={fieldClass}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={busy || !ready}
          onClick={() => submit(true)}
        >
          Ghi sổ
        </button>
        <button
          type="button"
          className={ghostButtonClass}
          disabled={busy || !ready}
          onClick={() => submit(false)}
        >
          Lưu nháp
        </button>
      </div>
    </section>
  );
}
