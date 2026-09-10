"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type Ref,
} from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  applyDraft,
  codeKey,
  confirmProblems,
  decimalSchema,
  duplicateCodes,
  emptySlip,
  findItem,
  findRecipient,
  formatQuantity,
  formatVnd,
  multiply,
  noCapabilities,
  parsePastedLines,
  todayInBusinessZone,
  SalesSlipError,
  type Capabilities,
  type DraftInput,
  type HistoryEntry,
  type Masters,
  type SalesItem,
  type SalesRecipient,
  type SalesSlip,
} from "@/domains/sales-slips/contracts";
import {
  buttonClass,
  cardClass,
  dangerButtonClass,
  fieldClass,
  formatDateTime,
  ghostButtonClass,
  labelClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadClass,
} from "@/components/admin/sample-progress-shared";
import {
  ApiError,
  createSlip,
  downloadExport,
  fetchHistory,
  fetchMasters,
  fetchSlip,
  transitionSlip,
  updateSlip,
} from "./api";
import {
  alertClass,
  noticeClass,
  salesBadgeClass,
  StatusBadge,
  successClass,
} from "./shared";

/**
 * One slip, laid out like the materials "Nhập kho" tab: header fields, an
 * inline "Thêm mặt hàng" editor that writes a line on "Áp dụng", a paste
 * panel for rows copied from Excel, the lines table with totals, and the
 * confirm / reopen / cancel actions asked inline. The draft autosaves; the
 * server recomputes everything and the screen only previews with the same
 * pure rules.
 */

type LineDraft = {
  id: string;
  itemCode: string;
  quantity: string;
  /** Raw text while a price holder edits; "" = untouched (catalogue / snapshot). */
  unitPrice: string;
  priceTouched: boolean;
};

type Draft = {
  slipDate: string;
  recipientCode: string;
  recipientName: string;
  recipientUnit: string;
  content: string;
  note: string;
  lines: LineDraft[];
};

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";
type Transition = "confirm" | "reopen" | "cancel";
type Confirmation =
  { kind: Transition } | { kind: "delete-line"; lineId: string };

const actionLabels: Record<string, string> = {
  "salesSlips.create": "Tạo phiếu",
  "salesSlips.update": "Sửa phiếu",
  "salesSlips.confirm": "Xác nhận",
  "salesSlips.reopen": "Mở lại để sửa",
  "salesSlips.cancel": "Hủy phiếu",
  "salesSlips.export": "Xuất file",
  "salesSlips.import": "Nhập từ Excel",
};

const saveLabels: Record<SaveState, string> = {
  idle: "",
  pending: "Chờ lưu…",
  saving: "Đang lưu…",
  saved: "Đã lưu",
  error: "Lỗi lưu",
};

const panelTitles: Record<Transition, string> = {
  confirm: "Xác nhận phiếu bán hàng?",
  reopen: "Mở lại phiếu đã xác nhận",
  cancel: "Hủy phiếu bán hàng",
};

const readOnlyFieldClass = fieldClass.replace("bg-white", "bg-ivory/60");
/** History table columns; the short ones never wrap. */
const historyColumns: { label: string; nowrap: boolean }[] = [
  { label: "Thời gian", nowrap: true },
  { label: "Người thực hiện", nowrap: false },
  { label: "Thao tác", nowrap: true },
  { label: "Chi tiết", nowrap: false },
];
const unsavedText = "Chưa lưu được phiếu; hãy sửa lỗi rồi thử lại.";
const maxPasteRows = 500;

const draftFrom = (slip: SalesSlip): Draft => ({
  slipDate: slip.slipDate,
  recipientCode: slip.recipientCode,
  recipientName: slip.recipientName,
  recipientUnit: slip.recipientUnit,
  content: slip.content,
  note: slip.note,
  lines: slip.lines.map((line) => ({
    id: line.id,
    itemCode: line.itemCode,
    quantity: line.quantity ?? "",
    unitPrice: "",
    priceTouched: false,
  })),
});

/** Typed numbers follow Excel's displayed comma-grouping and dot-decimals. */
function parseNumber(text: string): string | null {
  const value = text.trim();
  if (!value) return null;
  if (value.includes(",") && !/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(value))
    throw new SalesSlipError("Dùng dấu chấm cho số thập phân (ví dụ 0.5).");
  return decimalSchema.parse(value.replaceAll(",", ""));
}

const safeNumber = (text: string): string | null => {
  try {
    return parseNumber(text);
  } catch {
    return null;
  }
};

const positive = (value: string | null) => value !== null && Number(value) > 0;

function toInput(
  draft: Draft,
  canEditPrice: boolean,
  masters: Masters,
): { input: DraftInput; errors: Record<string, string> } {
  const recipient = linkedRecipient(masters, draft);
  const errors: Record<string, string> = {};
  const lines: DraftInput["lines"] = [];
  for (const line of draft.lines) {
    let quantity: string | null = null;
    let unitPrice: string | null | undefined;
    try {
      quantity = parseNumber(line.quantity);
    } catch {
      errors[`${line.id}:quantity`] = "Số không hợp lệ";
    }
    if (canEditPrice && line.priceTouched) {
      try {
        unitPrice = parseNumber(line.unitPrice);
      } catch {
        errors[`${line.id}:unitPrice`] = "Số không hợp lệ";
      }
    }
    lines.push({
      id: line.id,
      itemCode: line.itemCode.trim(),
      quantity,
      ...(unitPrice !== undefined ? { unitPrice } : {}),
    });
  }
  // A code typed into the field prints as the catalogue name; a typed or
  // migrated name is kept as written even when it links to a catalogue entry.
  const typedName = draft.recipientName.trim();
  const typedCode = typedName ? findRecipient(masters, typedName) : null;
  return {
    input: {
      slipDate: draft.slipDate,
      recipientCode: recipient?.code ?? "",
      recipientName: typedCode
        ? typedCode.name
        : typedName || (recipient?.name ?? ""),
      recipientUnit: draft.recipientUnit.trim(),
      content: draft.content.trim(),
      note: draft.note.trim(),
      lines,
    },
    errors,
  };
}

/** The field accepts a code or an exact name, like the materials editor; the code is what gets sent. */
function resolveItem(masters: Masters, text: string): SalesItem | null {
  const wanted = codeKey(text);
  if (!wanted) return null;
  return (
    findItem(masters, text) ??
    masters.items.find((item) => codeKey(item.name) === wanted) ??
    null
  );
}

function resolveRecipient(
  masters: Masters,
  text: string,
): SalesRecipient | null {
  const wanted = codeKey(text);
  if (!wanted) return null;
  return (
    findRecipient(masters, text) ??
    masters.recipients.find((r) => codeKey(r.name) === wanted) ??
    null
  );
}

/** The catalogue entry the header points at: by the stored code, else by the typed text. */
const linkedRecipient = (
  masters: Masters,
  draft: Pick<Draft, "recipientCode" | "recipientName">,
): SalesRecipient | null =>
  (draft.recipientCode ? findRecipient(masters, draft.recipientCode) : null) ??
  resolveRecipient(masters, draft.recipientName);

/**
 * Confirm problems the reader can act on. Without `readPrice` the preview has
 * no prices, so "chưa có đơn giá" is dropped here and the server decides with
 * the real ones.
 */
function visibleProblems(problems: string[], readPrice: boolean): string[] {
  if (readPrice) return problems;
  return problems
    .map((problem) => problem.replace(/(; )?chưa có đơn giá/u, ""))
    .filter((problem) => !/^Dòng \d+: \.$/u.test(problem));
}

const fieldError = (text: string | undefined) =>
  text ? (
    <p className="text-lacquer mt-1 text-xs" role="alert">
      {text}
    </p>
  ) : null;

// ---------------------------------------------------------------- line editor

/**
 * The inline "Thêm mặt hàng" / "Sửa mặt hàng" form. Nothing here touches the
 * server: "Áp dụng" hands a validated line to the page, which saves at once.
 */
function LineEditor({
  ref,
  masters,
  showPrice,
  canEditPrice,
  existing,
  snapshot,
  onApply,
  onCancel,
}: {
  /** Lets the page scroll the form into view in edit mode. */
  ref?: Ref<HTMLFormElement>;
  masters: Masters;
  showPrice: boolean;
  canEditPrice: boolean;
  /** The line being edited; null in add mode. */
  existing: LineDraft | null;
  /** What the server currently holds for that line (from the preview). */
  snapshot: { itemCode: string; unitPrice: string | null } | null;
  onApply: (line: LineDraft, item: SalesItem) => void;
  onCancel: () => void;
}) {
  const [itemCode, setItemCode] = useState(existing?.itemCode ?? "");
  const [quantity, setQuantity] = useState(existing?.quantity ?? "");
  const [unitPrice, setUnitPrice] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstField.current?.focus();
  }, []);

  const item = useMemo(
    () => (itemCode.trim() ? resolveItem(masters, itemCode) : null),
    [masters, itemCode],
  );
  // Untouched, the price shown is the one the server would use: the saved
  // snapshot while the code is unchanged, else the catalogue price.
  const defaultPrice = item
    ? snapshot && codeKey(snapshot.itemCode) === codeKey(item.code)
      ? (snapshot.unitPrice ?? "")
      : (item.salePrice ?? "")
    : "";
  const priceValue = priceTouched ? unitPrice : defaultPrice;
  const amount = multiply(safeNumber(quantity), safeNumber(priceValue));

  const hint = item
    ? `${item.name || item.code} · ĐVT: ${item.unit || "—"}${
        showPrice
          ? ` · Giá danh mục: ${formatVnd(item.salePrice) || "chưa có"}`
          : ""
      }`
    : itemCode.trim()
      ? "Không có trong danh mục"
      : "Gõ mã hoặc tên vật tư";

  function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!itemCode.trim()) found.itemCode = "Chưa chọn mã vật tư";
    else if (!item) found.itemCode = "Mã không có trong danh mục";
    let parsedQuantity: string | null = null;
    try {
      parsedQuantity = parseNumber(quantity);
      if (!positive(parsedQuantity)) found.quantity = "Số lượng phải lớn hơn 0";
    } catch {
      found.quantity = "Số không hợp lệ";
    }
    let parsedPrice: string | null = null;
    // A price holder who empties the field asks for the catalogue price again.
    const clearedPrice = canEditPrice && priceTouched && !unitPrice.trim();
    if (canEditPrice && priceTouched && !clearedPrice) {
      try {
        parsedPrice = parseNumber(unitPrice);
      } catch {
        found.unitPrice = "Số không hợp lệ";
      }
    }
    setErrors(found);
    if (Object.keys(found).length > 0 || !item || parsedQuantity === null)
      return;

    const sameCode =
      existing !== null && codeKey(existing.itemCode) === codeKey(item.code);
    const line: LineDraft = {
      id: existing?.id ?? crypto.randomUUID(),
      itemCode: item.code,
      quantity: parsedQuantity,
      // A typed price is sent; an emptied field sends the catalogue price
      // (null when there is none); otherwise the server keeps or derives it.
      // An earlier manual price only survives while the code is unchanged.
      unitPrice:
        parsedPrice !== null
          ? parsedPrice
          : clearedPrice
            ? (item.salePrice ?? "")
            : sameCode && existing
              ? existing.unitPrice
              : "",
      priceTouched:
        parsedPrice !== null || clearedPrice
          ? true
          : sameCode && existing
            ? existing.priceTouched
            : false,
    };
    onApply(line, item);
    if (!existing) {
      setItemCode("");
      setQuantity("");
      setUnitPrice("");
      setPriceTouched(false);
      setErrors({});
      firstField.current?.focus();
    }
  }

  const title = existing ? "Sửa mặt hàng" : "Thêm mặt hàng";

  return (
    <form
      ref={ref}
      className={`${cardClass} space-y-4`}
      onSubmit={submit}
      aria-label={title}
      noValidate
    >
      <h3 className="text-burgundy font-serif text-xl">{title}</h3>
      <fieldset className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          <span className={labelClass}>Mã vật tư</span>
          <input
            ref={firstField}
            aria-label="Mã vật tư"
            list="sales-slip-items"
            className={fieldClass}
            autoComplete="off"
            placeholder="Mã hoặc tên vật tư"
            value={itemCode}
            onChange={(event) => setItemCode(event.target.value)}
          />
          <span className="text-charcoal/60 mt-1 block text-xs">{hint}</span>
          {fieldError(errors.itemCode)}
        </label>
        <label className="text-sm">
          <span className={labelClass}>Số lượng</span>
          <input
            aria-label="Số lượng"
            inputMode="decimal"
            className={fieldClass}
            placeholder="VD: 0.5"
            value={quantity}
            aria-invalid={!!errors.quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          {fieldError(errors.quantity)}
        </label>
        {canEditPrice && (
          <label className="text-sm">
            <span className={labelClass}>Giá</span>
            <input
              aria-label="Giá"
              inputMode="decimal"
              className={fieldClass}
              value={priceValue}
              aria-invalid={!!errors.unitPrice}
              onChange={(event) => {
                setUnitPrice(event.target.value);
                setPriceTouched(true);
              }}
            />
            <span className="text-charcoal/60 mt-1 block text-xs">
              Giá danh mục tại thời điểm chọn; xóa trống để dùng lại giá danh
              mục
            </span>
            {fieldError(errors.unitPrice)}
          </label>
        )}
        {showPrice && (
          <label className="text-sm">
            <span className={labelClass}>Thành tiền</span>
            <input
              aria-label="Thành tiền"
              readOnly
              className={readOnlyFieldClass}
              value={formatVnd(amount)}
            />
          </label>
        )}
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <button className={buttonClass} type="submit">
          Áp dụng
        </button>
        <button className={ghostButtonClass} type="button" onClick={onCancel}>
          Hủy
        </button>
      </div>
      <p className="text-charcoal/60 text-sm">
        Mặt hàng ghi vào phiếu ngay khi bấm “Áp dụng”; Enter cũng áp dụng. Số
        thập phân dùng dấu chấm (0.5).
      </p>
    </form>
  );
}

// ---------------------------------------------------------------- paste panel

type PasteRow = {
  line: number;
  itemCode: string;
  item: SalesItem | null;
  quantity: string | null;
  /** Price from the pasted column; only a holder of editPrice ever gets one. */
  unitPrice: string | null;
  error: string | null;
};

/** Keeps the first two tab-separated cells of every row and tells whether anything was dropped. */
function dropPriceColumn(text: string): { text: string; dropped: boolean } {
  let dropped = false;
  const rows = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((row) => {
      const cells = row.split("\t");
      if (cells.slice(2).some((cell) => cell.trim() !== "")) dropped = true;
      return cells.slice(0, 2).join("\t");
    });
  return { text: rows.join("\n"), dropped };
}

/** Rows copied from Excel are checked on screen, then appended to the slip in one go. */
function PastePanel({
  masters,
  showPrice,
  canEditPrice,
  onAdd,
  onClose,
}: {
  masters: Masters;
  showPrice: boolean;
  canEditPrice: boolean;
  onAdd: (lines: LineDraft[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PasteRow[] | null>(null);
  const [parseError, setParseError] = useState("");
  const [priceDropped, setPriceDropped] = useState(false);
  const layout = `Mã VT ⇥ Số lượng${canEditPrice ? " ⇥ Giá" : ""}`;

  function read() {
    const source = canEditPrice
      ? { text, dropped: false }
      : dropPriceColumn(text);
    let parsed: ReturnType<typeof parsePastedLines>;
    try {
      parsed = parsePastedLines(source.text);
    } catch (reason) {
      setPreview(null);
      setPriceDropped(false);
      setParseError(
        reason instanceof Error ? reason.message : "Dữ liệu dán không hợp lệ.",
      );
      return;
    }
    setParseError("");
    setPriceDropped(source.dropped);
    setPreview(
      parsed.map((row, index) => {
        const item = findItem(masters, row.itemCode);
        const error = !item
          ? "Mã không có trong danh mục"
          : !positive(row.quantity)
            ? "Số lượng phải lớn hơn 0"
            : null;
        return {
          line: index + 1,
          itemCode: row.itemCode,
          item,
          quantity: row.quantity,
          unitPrice: canEditPrice ? row.unitPrice : null,
          error,
        };
      }),
    );
  }

  const valid = preview?.filter((row) => !row.error) ?? [];
  const invalid = (preview?.length ?? 0) - valid.length;

  function add() {
    onAdd(
      valid.map((row) => ({
        id: crypto.randomUUID(),
        itemCode: row.item?.code ?? row.itemCode,
        quantity: row.quantity ?? "",
        unitPrice: row.unitPrice ?? "",
        priceTouched: row.unitPrice !== null,
      })),
    );
    setText("");
    setPreview(null);
    setPriceDropped(false);
  }

  return (
    <section className={`${cardClass} space-y-4`} aria-label="Dán từ Excel">
      <h2 className="text-burgundy font-serif text-xl">Dán từ Excel</h2>
      <div className="text-sm">
        <label className="block">
          <span className={labelClass}>Các dòng từ Excel</span>
          <textarea
            aria-label="Các dòng từ Excel"
            className={`${fieldClass} font-mono`}
            rows={6}
            placeholder={`Dán các dòng từ Excel: ${layout}`}
            value={text}
            aria-invalid={!!parseError}
            onChange={(event) => {
              setText(event.target.value);
              setPreview(null);
              setParseError("");
              setPriceDropped(false);
            }}
          />
        </label>
        {parseError && (
          <p className="text-lacquer text-sm" role="alert">
            {parseError}
          </p>
        )}
      </div>
      <p className="text-charcoal/60 text-sm">
        Mỗi dòng một mặt hàng, các cột cách nhau bằng Tab (sao chép trực tiếp từ
        Excel): {layout}. Tối đa {maxPasteRows} dòng.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={preview ? ghostButtonClass : buttonClass}
          disabled={!text.trim()}
          onClick={read}
        >
          Đọc dữ liệu
        </button>
        {preview && valid.length > 0 && (
          <button type="button" className={buttonClass} onClick={add}>
            Thêm {valid.length} dòng
          </button>
        )}
        <button type="button" className={ghostButtonClass} onClick={onClose}>
          Đóng
        </button>
      </div>

      {preview && (
        <>
          <p className="text-sm" role="status">
            Đã đọc {preview.length} dòng: {valid.length} hợp lệ
            {invalid ? `, ${invalid} lỗi (không thêm)` : ""}.
            {priceDropped
              ? " Cột giá bị bỏ qua (không có quyền sửa đơn giá)."
              : ""}
          </p>
          <div className={tableWrapClass}>
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className={theadClass}>
                <tr>
                  {[
                    "Dòng",
                    "Mã VT",
                    "Vật tư",
                    "ĐVT",
                    "Số lượng",
                    ...(showPrice ? ["Giá", "Thành tiền"] : []),
                    "Kết quả",
                  ].map((label) => (
                    <th key={label} scope="col" className={thClass}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => {
                  const price = row.unitPrice ?? row.item?.salePrice ?? null;
                  return (
                    <tr
                      key={row.line}
                      className={`border-burgundy/10 border-t ${row.error ? "bg-red-50" : ""}`}
                    >
                      <td className={tdClass}>{row.line}</td>
                      <td className={`${tdClass} font-semibold`}>
                        {row.item?.code ?? row.itemCode}
                      </td>
                      <td className={tdClass}>{row.item?.name || "—"}</td>
                      <td className={tdClass}>{row.item?.unit || "—"}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {formatQuantity(row.quantity) || "—"}
                      </td>
                      {showPrice && (
                        <>
                          <td className={`${tdClass} text-right tabular-nums`}>
                            {formatVnd(price) || "—"}
                          </td>
                          <td className={`${tdClass} text-right tabular-nums`}>
                            {formatVnd(multiply(row.quantity, price)) || "—"}
                          </td>
                        </>
                      )}
                      <td className={tdClass}>
                        {row.error ? (
                          <>
                            <span
                              className={`${salesBadgeClass} mr-2 bg-red-100 text-red-900 ring-1 ring-red-300`}
                            >
                              Lỗi
                            </span>
                            {row.error}
                          </>
                        ) : (
                          <span
                            className={`${salesBadgeClass} bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300`}
                          >
                            Hợp lệ
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- page

export function SalesSlipDetail({
  basePath,
  slipId,
}: {
  basePath: string;
  slipId: string | null;
}) {
  const [id] = useState(() => slipId ?? crypto.randomUUID());
  const [masters, setMasters] = useState<Masters | null>(null);
  const [capabilities, setCapabilities] =
    useState<Capabilities>(noCapabilities);
  const [slip, setSlip] = useState<SalesSlip | null>(null);
  const [people, setPeople] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [busy, setBusy] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [reason, setReason] = useState("");
  /** Open line editor: `lineId` null = add mode. */
  const [editor, setEditor] = useState<{ lineId: string | null } | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  /** True once the reader typed in the recipient field this session. */
  const [recipientTouched, setRecipientTouched] = useState(false);

  const slipRef = useRef<SalesSlip | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The save currently on the wire; the next one waits for it to finish. */
  const inFlight = useRef<Promise<void> | null>(null);
  const dirty = useRef(false);
  const staleRef = useRef(false);
  /** Consecutive failed autosaves; transient failures retry a few times, 4xx waits for the next edit. */
  const retries = useRef(0);
  const mounted = useRef(true);
  const created = useRef(slipId !== null);
  const panelAnchor = useRef<HTMLElement>(null);
  const editorAnchor = useRef<HTMLFormElement>(null);
  /** Always the latest `flush`, so a scheduled timer never calls a stale one. */
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const isNew = slipId === null;
  const canEditPrice = capabilities.editPrice && capabilities.readPrice;
  const editable =
    !!draft &&
    !stale &&
    !busy &&
    (slip
      ? slip.status === "DRAFT" && capabilities.update
      : capabilities.create);

  const setDraftAndRef = useCallback((next: Draft) => {
    draftRef.current = next;
    setDraft(next);
  }, []);
  const setSlipAndRef = useCallback((next: SalesSlip | null) => {
    slipRef.current = next;
    setSlip(next);
  }, []);
  const setStaleAndRef = useCallback((next: boolean) => {
    staleRef.current = next;
    setStale(next);
  }, []);
  const notify = (text: string) => {
    setMessage(text);
    setError("");
  };
  const fail = (text: string) => {
    setError(text);
    setMessage("");
  };

  // ---------------------------------------------------------------- loading
  useEffect(() => {
    mounted.current = true;
    const load = async () => {
      try {
        const [mastersResult, detail] = await Promise.all([
          fetchMasters(),
          isNew ? Promise.resolve(null) : fetchSlip(id),
        ]);
        if (!mounted.current) return;
        setMasters({
          items: mastersResult.items,
          recipients: mastersResult.recipients,
        });
        setCapabilities(detail?.capabilities ?? mastersResult.capabilities);
        if (detail) {
          setSlipAndRef(detail.slip);
          setPeople(detail.people);
          setDraftAndRef(draftFrom(detail.slip));
        } else {
          setDraftAndRef({
            slipDate: todayInBusinessZone(),
            recipientCode: "",
            recipientName: "",
            recipientUnit: "",
            content: "",
            note: "",
            lines: [],
          });
        }
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "Không thể tải phiếu.",
        );
      } finally {
        if (mounted.current) setLoading(false);
      }
    };
    const initial = setTimeout(() => void load(), 0);
    const leave = (event: BeforeUnloadEvent) => {
      if (dirty.current || inFlight.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => {
      mounted.current = false;
      clearTimeout(initial);
      window.removeEventListener("beforeunload", leave);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [id, isNew, setDraftAndRef, setSlipAndRef]);

  // ---------------------------------------------------------------- preview
  const base = useMemo(
    () => slip ?? emptySlip(id, draft?.slipDate ?? todayInBusinessZone(), ""),
    [slip, id, draft?.slipDate],
  );
  const preview = useMemo(() => {
    if (!draft || !masters)
      return { slip: null as SalesSlip | null, message: "" };
    const { input } = toInput(draft, canEditPrice, masters);
    try {
      return {
        slip: applyDraft(base, input, masters, { canEditPrice }),
        message: "",
      };
    } catch (reason) {
      return {
        slip: null,
        message:
          reason instanceof Error ? reason.message : "Dữ liệu chưa hợp lệ.",
      };
    }
  }, [draft, masters, base, canEditPrice]);
  const previewLines = useMemo(
    () => new Map((preview.slip?.lines ?? []).map((line) => [line.id, line])),
    [preview.slip],
  );

  // ---------------------------------------------------------------- saving
  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), 800);
  }, []);
  /**
   * Saves the draft once a save already on the wire has finished, so two saves
   * never overlap and the version sent is always the newest one. Nothing to do
   * when the draft is clean, stale or not loaded.
   */
  const flush = useCallback(async () => {
    while (inFlight.current) await inFlight.current;
    const current = draftRef.current;
    if (!current || !masters || !dirty.current || staleRef.current) return;
    const { input, errors } = toInput(current, canEditPrice, masters);
    if (Object.keys(errors).length) {
      setSaveState("error");
      setError("Có ô nhập số chưa hợp lệ; sửa lại để lưu.");
      setMessage("");
      return;
    }
    const save = async () => {
      dirty.current = false;
      setSaveState("saving");
      let conflicted = false;
      let failure: unknown = null;
      try {
        const result = created.current
          ? await updateSlip(id, slipRef.current?.version ?? 0, input)
          : await createSlip(id, input);
        if (!mounted.current) return;
        if (!created.current) {
          created.current = true;
          window.history.replaceState(null, "", `${basePath}/${id}`);
        }
        const names = "people" in result ? result.people : undefined;
        if (names) setPeople((known) => ({ ...known, ...names }));
        setSlipAndRef(result.slip);
        retries.current = 0;
        setError("");
        setSaveState(dirty.current ? "pending" : "saved");
      } catch (reason) {
        dirty.current = true;
        failure = reason;
        if (!mounted.current) return;
        setSaveState("error");
        setMessage("");
        if (reason instanceof ApiError && reason.status === 409) {
          conflicted = true;
          created.current = true;
          setStaleAndRef(true);
        } else {
          retries.current += 1;
          setError(reason instanceof Error ? reason.message : "Lỗi lưu.");
        }
      } finally {
        // A clean save overtaken by typing saves again; a network or server
        // failure retries a few times; a rejected draft (4xx) waits for the
        // next edit instead of hammering the server every 800 ms.
        const transient =
          failure instanceof ApiError &&
          (failure.status === 0 || failure.status >= 500);
        if (
          mounted.current &&
          dirty.current &&
          !conflicted &&
          (failure === null || (transient && retries.current < 3))
        )
          schedule();
      }
    };
    const task = save();
    inFlight.current = task;
    try {
      await task;
    } finally {
      if (inFlight.current === task) inFlight.current = null;
    }
  }, [
    basePath,
    canEditPrice,
    id,
    masters,
    schedule,
    setSlipAndRef,
    setStaleAndRef,
  ]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  /** Header fields wait 800 ms; a line applied, pasted or deleted saves now. */
  const change = (next: Draft, immediately = false) => {
    setDraftAndRef(next);
    dirty.current = true;
    setSaveState("pending");
    setProblems([]);
    if (!immediately) {
      schedule();
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    void flushRef.current();
  };

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const detail = await fetchSlip(id);
      setSlipAndRef(detail.slip);
      setPeople(detail.people);
      setCapabilities(detail.capabilities);
      setDraftAndRef(draftFrom(detail.slip));
      dirty.current = false;
      setStaleAndRef(false);
      setSaveState("idle");
      setProblems([]);
      setMessage("");
      setHistory(null);
      setConfirmation(null);
      setEditor(null);
      setPasteOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải lại.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------- lines
  const applyLine = (line: LineDraft, item: SalesItem) => {
    const current = draftRef.current;
    if (!current) return;
    const exists = current.lines.some((candidate) => candidate.id === line.id);
    change(
      {
        ...current,
        lines: exists
          ? current.lines.map((candidate) =>
              candidate.id === line.id ? line : candidate,
            )
          : [...current.lines, line],
      },
      true,
    );
    notify(
      `${exists ? "Đã cập nhật" : "Đã thêm"} ${item.code} × ${formatQuantity(line.quantity)}.`,
    );
    if (exists) setEditor(null);
  };
  const addPasted = (lines: LineDraft[]) => {
    const current = draftRef.current;
    if (!current || !lines.length) return;
    change({ ...current, lines: [...current.lines, ...lines] }, true);
    notify(`Đã thêm ${lines.length} mặt hàng từ dữ liệu dán.`);
    setPasteOpen(false);
  };
  const deleteLine = (lineId: string) => {
    const current = draftRef.current;
    if (!current) return;
    const line = current.lines.find((candidate) => candidate.id === lineId);
    change(
      {
        ...current,
        lines: current.lines.filter((candidate) => candidate.id !== lineId),
      },
      true,
    );
    notify(
      line?.itemCode
        ? `Đã xóa mặt hàng ${line.itemCode}.`
        : "Đã xóa mặt hàng khỏi phiếu.",
    );
    setConfirmation(null);
    if (editor?.lineId === lineId) setEditor(null);
  };
  const openEditor = (lineId: string | null) => setEditor({ lineId });
  // Bring a freshly mounted confirmation panel or line editor into view.
  useEffect(() => {
    if (confirmation)
      panelAnchor.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
  }, [confirmation]);
  useEffect(() => {
    if (editor?.lineId)
      editorAnchor.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
  }, [editor]);

  // ---------------------------------------------------------------- actions
  /** Flushes what is pending (after any running save) and tells whether the server now holds the draft. */
  const settle = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    await flushRef.current();
    if (!dirty.current && slipRef.current) return true;
    setError((current) =>
      current && current !== unsavedText
        ? `${unsavedText}\n${current}`
        : unsavedText,
    );
    setMessage("");
    return false;
  };
  const ask = async (kind: Transition) => {
    if (stale) return;
    setError("");
    setMessage("");
    setProblems([]);
    if (kind === "confirm") {
      const local = preview.slip
        ? visibleProblems(confirmProblems(preview.slip), capabilities.readPrice)
        : ["Phiếu chưa hợp lệ."];
      if (local.length) {
        setProblems(local);
        return;
      }
    }
    if (kind !== "reopen" && !(await settle())) return;
    setReason("");
    setConfirmation({ kind });
  };
  const run = async (kind: Transition) => {
    const current = slipRef.current;
    if (!current) return;
    const text = reason.trim();
    if (kind !== "confirm" && !text) {
      fail("Cần nhập lý do.");
      return;
    }
    setBusy(kind);
    setError("");
    try {
      const result = await transitionSlip(
        id,
        kind,
        current.version,
        kind === "confirm" ? undefined : text,
      );
      let next = result.slip;
      // Re-read the slip so the header shows names, never a raw user id.
      try {
        const detail = await fetchSlip(id);
        next = detail.slip;
        setPeople((known) => ({ ...known, ...detail.people }));
        setCapabilities(detail.capabilities);
      } catch {
        // The transition itself succeeded; keep the slip it returned.
      }
      setSlipAndRef(next);
      setDraftAndRef(draftFrom(next));
      dirty.current = false;
      setSaveState("idle");
      setHistory(null);
      setConfirmation(null);
      setEditor(null);
      setPasteOpen(false);
      setReason("");
      const label = next.internalNumber ? ` ${next.internalNumber}` : "";
      notify(
        kind === "confirm"
          ? `Đã xác nhận phiếu${label}.`
          : kind === "reopen"
            ? "Đã mở lại phiếu để sửa."
            : `Đã hủy phiếu${label}.`,
      );
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        // The dedicated stale banner explains; the panel has nothing left to do.
        setStaleAndRef(true);
        setConfirmation(null);
        return;
      }
      if (reason instanceof ApiError && Array.isArray(reason.details))
        setProblems(
          reason.details.filter((d): d is string => typeof d === "string"),
        );
      fail(reason instanceof Error ? reason.message : "Không thể thực hiện.");
    } finally {
      setBusy("");
    }
  };
  const exportFile = async (format: "pdf" | "xlsx") => {
    if (stale) return;
    setError("");
    if (!(await settle())) return;
    setBusy(format);
    try {
      await downloadExport(id, format);
    } catch (reason) {
      fail(reason instanceof Error ? reason.message : "Không thể xuất file.");
    } finally {
      setBusy("");
    }
  };
  const toggleHistory = async () => {
    if (history) {
      setHistory(null);
      return;
    }
    try {
      setHistory((await fetchHistory(id)).history);
    } catch (reason) {
      fail(reason instanceof Error ? reason.message : "Không thể tải lịch sử.");
    }
  };

  // ---------------------------------------------------------------- render
  if (loading || !draft || !masters)
    return (
      <div className="space-y-6" aria-busy={loading}>
        <header>
          <p className="eyebrow">Bán hàng</p>
          <h1 className="text-burgundy mt-3 font-serif text-4xl md:text-5xl">
            {isNew ? "Phiếu mới" : "Phiếu bán hàng"}
          </h1>
          <p className="text-charcoal/65 mt-4 max-w-3xl" role="status">
            {loading
              ? "Đang tải phiếu bán hàng…"
              : "Không tải được phiếu bán hàng."}
          </p>
        </header>
        {error && (
          <div role="alert" className={`${alertClass} whitespace-pre-line`}>
            {error}
          </div>
        )}
        {!loading && (
          <Link href={basePath as Route} className={ghostButtonClass}>
            ← Danh sách
          </Link>
        )}
      </div>
    );

  const status = slip?.status ?? "DRAFT";
  const showPrice = capabilities.readPrice;
  const saved = !!slip;
  /** Transitions and exports wait until the draft is on the server. */
  const savingNow = saveState === "pending" || saveState === "saving";
  const actionsLocked = !!busy || stale || savingNow;
  const duplicates = preview.slip ? duplicateCodes(preview.slip.lines) : [];
  const recipient = linkedRecipient(masters, draft);
  const title =
    slip?.internalNumber ??
    (slip?.migrationSheet ? `Excel · ${slip.migrationSheet}` : "Phiếu mới");
  const person = (userId: string | null) =>
    userId ? (people[userId] ?? userId) : "";
  const headerLine = (
    slip
      ? [
          `Người lập: ${person(slip.createdBy)}`,
          `Tạo ${formatDateTime(slip.createdAt)}`,
          `Cập nhật ${formatDateTime(slip.updatedAt)}`,
          slip.confirmedAt
            ? `Xác nhận ${formatDateTime(slip.confirmedAt)} (${person(slip.confirmedBy)})`
            : null,
          slip.cancelledAt
            ? `Hủy ${formatDateTime(slip.cancelledAt)} (${person(slip.cancelledBy)})${slip.cancelReason ? `: ${slip.cancelReason.replace(/[.\s]+$/u, "")}` : ""}`
            : null,
          saveLabels[saveState] || null,
        ]
      : [
          "Phiếu được lưu tự động ngay khi nhập; mã phiếu cấp ở lần lưu đầu",
          saveLabels[saveState] || null,
        ]
  )
    .filter(Boolean)
    .join(" · ");
  const editingLine = editor?.lineId
    ? (draft.lines.find((line) => line.id === editor.lineId) ?? null)
    : null;
  const editingSnapshot = editingLine
    ? (previewLines.get(editingLine.id) ?? null)
    : null;
  const headerField = (
    key: "slipDate" | "recipientUnit" | "content",
    label: string,
    type: "date" | "text" = "text",
    maxLength?: number,
  ) => (
    <label className="text-sm">
      <span className={labelClass}>{label}</span>
      <input
        type={type}
        aria-label={label}
        {...(maxLength ? { maxLength } : {})}
        className={editable ? fieldClass : readOnlyFieldClass}
        value={draft[key]}
        readOnly={!editable}
        onChange={(event) => change({ ...draft, [key]: event.target.value })}
      />
    </label>
  );
  const exportButtons = (
    <>
      {capabilities.print && saved && (
        <Link
          href={`${basePath}/${id}/print` as Route}
          className={ghostButtonClass}
        >
          Xem bản in
        </Link>
      )}
      {capabilities.export && saved && (
        <>
          <button
            type="button"
            className={ghostButtonClass}
            disabled={actionsLocked}
            onClick={() => void exportFile("pdf")}
          >
            {busy === "pdf" ? "Đang tạo PDF…" : "Xuất PDF"}
          </button>
          <button
            type="button"
            className={ghostButtonClass}
            disabled={actionsLocked}
            onClick={() => void exportFile("xlsx")}
          >
            {busy === "xlsx" ? "Đang tạo Excel…" : "Xuất Excel"}
          </button>
        </>
      )}
    </>
  );
  const historyButton = saved && (
    <button
      type="button"
      className={ghostButtonClass}
      aria-pressed={history !== null}
      onClick={() => void toggleHistory()}
    >
      Lịch sử chỉnh sửa
    </button>
  );

  return (
    <div className="space-y-6" aria-busy={!!busy}>
      <header>
        <p className="eyebrow">Bán hàng</p>
        <h1 className="text-burgundy mt-3 font-serif text-4xl md:text-5xl">
          {title} <StatusBadge status={status} />
        </h1>
        <p className="text-charcoal/65 mt-4 max-w-3xl" role="status">
          {headerLine.endsWith("…") ? headerLine : `${headerLine}.`}
        </p>
      </header>

      <section className={`${cardClass} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Link href={basePath as Route} className={ghostButtonClass}>
              ← Danh sách
            </Link>
            {status === "DRAFT" && capabilities.confirm && saved && (
              <button
                type="button"
                className={buttonClass}
                disabled={actionsLocked}
                onClick={() => void ask("confirm")}
              >
                Xác nhận
              </button>
            )}
            {status === "CONFIRMED" && capabilities.confirm && (
              <button
                type="button"
                className={ghostButtonClass}
                disabled={actionsLocked}
                onClick={() => void ask("reopen")}
              >
                Mở lại để sửa
              </button>
            )}
            {status !== "CANCELLED" && capabilities.cancel && saved && (
              <button
                type="button"
                className={`${dangerButtonClass} min-h-11 px-5`}
                disabled={actionsLocked}
                onClick={() => void ask("cancel")}
              >
                Hủy phiếu
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {editable && (
              <button
                type="button"
                className={ghostButtonClass}
                aria-pressed={pasteOpen}
                onClick={() => setPasteOpen((open) => !open)}
              >
                Dán từ Excel
              </button>
            )}
            {exportButtons}
          </div>
        </div>
        <p className="text-charcoal/60 text-sm">
          Phiếu được lưu ngay khi nhập; mỗi mặt hàng ghi vào phiếu khi bấm Áp
          dụng. Xác nhận để khóa người nhận, số lượng và đơn giá.
        </p>
      </section>

      {stale && (
        <div
          role="alert"
          className={`${alertClass} flex flex-wrap items-center justify-between gap-3`}
        >
          <span>
            Phiếu đã được người khác cập nhật. Vui lòng tải lại dữ liệu.
          </span>
          <button
            type="button"
            className={ghostButtonClass}
            disabled={loading}
            onClick={() => void reload()}
          >
            Tải lại
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className={`${alertClass} whitespace-pre-line`}>
          {error}
        </div>
      )}
      {message && (
        <p role="status" className={successClass}>
          {message}
        </p>
      )}
      {problems.length > 0 && (
        <div role="alert" className={alertClass}>
          Chưa thể xác nhận phiếu:
          <ul className="mt-2 list-disc pl-5">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}
      {preview.message && (
        <p role="alert" className={noticeClass}>
          {preview.message}
        </p>
      )}
      {slip && slip.migrationIssues.length > 0 && (
        <div className={noticeClass}>
          Phiếu nhập từ Excel ({slip.migrationSheet}) cần kiểm tra:
          <ul className="mt-2 list-disc pl-5">
            {slip.migrationIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {confirmation && confirmation.kind === "delete-line" && (
        <section
          ref={panelAnchor}
          className={`${cardClass} border-lacquer/40 space-y-3`}
          aria-label="Xóa mặt hàng"
        >
          <h2 className="text-burgundy font-serif text-xl">Xóa mặt hàng</h2>
          <p className="text-sm">
            Xóa mặt hàng{" "}
            <strong>
              {draft.lines.find((line) => line.id === confirmation.lineId)
                ?.itemCode ?? ""}
            </strong>{" "}
            ({previewLines.get(confirmation.lineId)?.itemName || "—"}) khỏi
            phiếu?
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={buttonClass}
              onClick={() => deleteLine(confirmation.lineId)}
            >
              Xóa mặt hàng
            </button>
            <button
              type="button"
              className={ghostButtonClass}
              onClick={() => setConfirmation(null)}
            >
              Giữ lại
            </button>
          </div>
        </section>
      )}
      {confirmation && confirmation.kind !== "delete-line" && (
        <section
          ref={panelAnchor}
          className={`${cardClass} border-lacquer/40 space-y-3`}
          aria-label={panelTitles[confirmation.kind]}
        >
          <h2
            className={`${confirmation.kind === "cancel" ? "text-lacquer" : "text-burgundy"} font-serif text-xl`}
          >
            {panelTitles[confirmation.kind]}
          </h2>
          <p className="text-sm">
            {confirmation.kind === "confirm"
              ? `Sau khi xác nhận, phiếu ${title} được coi là giao dịch chính thức: người nhận, mặt hàng, số lượng và đơn giá được khóa. Muốn sửa phải mở lại kèm lý do.`
              : confirmation.kind === "reopen"
                ? "Phiếu quay về trạng thái nháp để sửa; lý do được ghi vào lịch sử."
                : "Phiếu vẫn được lưu và tra cứu, bản in sẽ đóng dấu ĐÃ HỦY. Không thể xóa hẳn."}
          </p>
          {confirmation.kind !== "confirm" && (
            <label className="block text-sm">
              <span className={labelClass}>
                {confirmation.kind === "cancel" ? "Lý do hủy" : "Lý do mở lại"}{" "}
                (bắt buộc)
              </span>
              <textarea
                aria-label={
                  confirmation.kind === "cancel" ? "Lý do hủy" : "Lý do mở lại"
                }
                className={fieldClass}
                rows={2}
                maxLength={2000}
                placeholder={
                  confirmation.kind === "cancel"
                    ? "VD: Ghi nhầm người nhận."
                    : "VD: Sửa lại đơn giá."
                }
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={
                confirmation.kind === "cancel" ? dangerButtonClass : buttonClass
              }
              disabled={
                actionsLocked ||
                (confirmation.kind !== "confirm" && !reason.trim())
              }
              onClick={() => void run(confirmation.kind)}
            >
              {confirmation.kind === "confirm"
                ? "Xác nhận phiếu"
                : confirmation.kind === "reopen"
                  ? "Mở lại phiếu"
                  : "Hủy phiếu này"}
            </button>
            <button
              type="button"
              className={ghostButtonClass}
              onClick={() => setConfirmation(null)}
            >
              Quay lại
            </button>
          </div>
        </section>
      )}

      {pasteOpen && editable && (
        <PastePanel
          masters={masters}
          showPrice={showPrice}
          canEditPrice={canEditPrice}
          onAdd={addPasted}
          onClose={() => setPasteOpen(false)}
        />
      )}

      <section className={cardClass}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {headerField("slipDate", "Ngày", "date")}
          <div className="text-sm">
            <label htmlFor="recipient-name" className={labelClass}>
              Người nhận hàng
            </label>
            <input
              id="recipient-name"
              className={editable ? fieldClass : readOnlyFieldClass}
              autoComplete="off"
              placeholder="Mã hoặc tên người nhận"
              maxLength={240}
              value={draft.recipientName}
              readOnly={!editable}
              onChange={(event) => {
                // The typed text stays; only the link is resolved while typing.
                const text = event.target.value;
                setRecipientTouched(true);
                change({
                  ...draft,
                  recipientCode: resolveRecipient(masters, text)?.code ?? "",
                  recipientName: text,
                });
              }}
              onBlur={() => {
                // A code typed this session is shown as the name that prints;
                // a name typed or migrated as written is left alone.
                const typed = draft.recipientName.trim();
                if (
                  editable &&
                  recipientTouched &&
                  recipient &&
                  typed !== recipient.name &&
                  findRecipient(masters, typed)
                )
                  change({ ...draft, recipientName: recipient.name });
              }}
              {...(editable ? { list: "sales-slip-recipients" } : {})}
            />
            <span className="text-charcoal/60 mt-1 block text-xs">
              {recipient
                ? `Liên kết danh mục: ${recipient.name} (${recipient.code})`
                : draft.recipientName.trim()
                  ? "Tên nhập tay, không liên kết danh mục"
                  : "Gõ mã hoặc tên người nhận"}
            </span>
          </div>
          {headerField("recipientUnit", "Đơn vị", "text", 240)}
          {headerField("content", "Nội dung", "text", 2000)}
          {(draft.note || editable) && (
            <label className="text-sm md:col-span-2 xl:col-span-4">
              <span className={labelClass}>Ghi chú nội bộ (không in)</span>
              <textarea
                aria-label="Ghi chú nội bộ (không in)"
                className={editable ? fieldClass : readOnlyFieldClass}
                rows={2}
                maxLength={4000}
                value={draft.note}
                readOnly={!editable}
                onChange={(event) =>
                  change({ ...draft, note: event.target.value })
                }
              />
            </label>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        {editable && (
          <button
            type="button"
            className={buttonClass}
            disabled={!!editor && editor.lineId === null}
            onClick={() => openEditor(null)}
          >
            Thêm mặt hàng
          </button>
        )}
        <span className="text-charcoal/65 text-sm" role="status">
          Hiển thị {draft.lines.length} mặt hàng
        </span>
      </div>

      {editor && editable && (
        <LineEditor
          key={editor.lineId ?? "new"}
          ref={editorAnchor}
          masters={masters}
          showPrice={showPrice}
          canEditPrice={canEditPrice}
          existing={editingLine}
          snapshot={
            editingSnapshot
              ? {
                  itemCode: editingSnapshot.itemCode,
                  unitPrice: editingSnapshot.unitPrice,
                }
              : null
          }
          onApply={applyLine}
          onCancel={() => setEditor(null)}
        />
      )}

      <div className={tableWrapClass}>
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <caption className="sr-only">Mặt hàng trên phiếu</caption>
          <thead className={theadClass}>
            <tr>
              {[
                "STT",
                "Mã VT",
                "Vật tư",
                "ĐVT",
                "Số lượng",
                ...(showPrice ? ["Giá", "Thành tiền"] : []),
              ].map((label) => (
                <th key={label} scope="col" className={thClass}>
                  {label}
                </th>
              ))}
              {editable && (
                <th
                  scope="col"
                  className={`${thClass} border-burgundy/12 bg-ivory sticky right-0 border-l`}
                >
                  Thao tác
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {draft.lines.map((line, index) => {
              const computed = previewLines.get(line.id);
              const unknown =
                !!line.itemCode.trim() && !findItem(masters, line.itemCode);
              return (
                <tr
                  key={line.id}
                  className={`border-burgundy/10 hover:bg-ivory/40 border-t align-top ${unknown ? "bg-amber-50" : ""}`}
                >
                  <td className={`${tdClass} tabular-nums`}>{index + 1}</td>
                  <td className={`${tdClass} font-semibold`}>
                    {computed?.itemCode ?? line.itemCode}
                    {unknown && (
                      <span
                        className={`${salesBadgeClass} ml-2 bg-amber-100 text-amber-900 ring-1 ring-amber-300`}
                      >
                        Mã lạ
                      </span>
                    )}
                  </td>
                  <td className={`${tdClass} min-w-44`}>
                    {computed?.itemName || "—"}
                  </td>
                  <td className={tdClass}>{computed?.unit || "—"}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {formatQuantity(computed?.quantity ?? line.quantity) || "—"}
                  </td>
                  {showPrice && (
                    <>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {formatVnd(computed?.unitPrice) || "—"}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {formatVnd(computed?.lineAmount) || "—"}
                      </td>
                    </>
                  )}
                  {editable && (
                    <td
                      className={`${tdClass} border-burgundy/12 sticky right-0 space-y-2 border-l bg-white`}
                    >
                      <div className="flex flex-col items-start gap-2">
                        <button
                          type="button"
                          className={`${ghostButtonClass} whitespace-nowrap`}
                          onClick={() => openEditor(line.id)}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className={`${dangerButtonClass} whitespace-nowrap`}
                          onClick={() =>
                            setConfirmation({
                              kind: "delete-line",
                              lineId: line.id,
                            })
                          }
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {draft.lines.length === 0 && (
          <p role="status" className="text-charcoal/65 p-8 text-center">
            Chưa có mặt hàng nào.
          </p>
        )}
      </div>

      {((showPrice && draft.lines.length > 0) || duplicates.length > 0) && (
        <div className="flex flex-col items-end gap-3">
          {duplicates.length > 0 && (
            <p className={`${noticeClass} w-full text-sm`}>
              Mặt hàng {duplicates.join(", ")} đã có trong phiếu (giữ nguyên,
              không tự gộp).
            </p>
          )}
          {showPrice && draft.lines.length > 0 && (
            <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-right text-sm">
              <dt className="text-charcoal/60">Tổng tiền</dt>
              <dd className="font-semibold tabular-nums">
                {formatVnd(preview.slip?.subtotal) || "—"}
              </dd>
              <dt className="text-charcoal/60">Tổng cộng tiền thanh toán</dt>
              <dd className="font-semibold tabular-nums">
                {formatVnd(preview.slip?.totalPayment) || "—"}
              </dd>
              <dt className="text-charcoal/60">Bằng chữ</dt>
              <dd className="italic">{preview.slip?.totalInWords ?? "—"}</dd>
            </dl>
          )}
        </div>
      )}

      {saved && (
        <section className={`${cardClass} space-y-4`}>
          <div className="flex flex-wrap gap-3">
            {exportButtons}
            {historyButton}
          </div>
          <p className="text-charcoal/60 text-sm">
            Bản in, PDF và Excel theo đúng mẫu PHIẾU BÁN HÀNG. Mỗi lần tạo, sửa,
            xác nhận hay hủy đều lưu người thực hiện và thời gian lấy từ máy
            chủ.
          </p>
        </section>
      )}

      {history && (
        <section
          className={`${cardClass} space-y-4`}
          aria-label="Lịch sử chỉnh sửa"
        >
          <h2 className="text-burgundy font-serif text-2xl">
            Lịch sử chỉnh sửa
          </h2>
          <div className={tableWrapClass}>
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead className={theadClass}>
                <tr>
                  {historyColumns.map(({ label, nowrap }) => (
                    <th
                      key={label}
                      scope="col"
                      className={
                        nowrap ? `${thClass} whitespace-nowrap` : thClass
                      }
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => {
                  const detail = [
                    entry.changes.join("; "),
                    entry.reason ? `lý do: ${entry.reason}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <tr key={entry.id} className="border-burgundy/10 border-t">
                      <td className={`${tdClass} whitespace-nowrap`}>
                        {formatDateTime(entry.occurredAt)}
                      </td>
                      <td className={tdClass}>{entry.actorName || "—"}</td>
                      <td
                        className={`${tdClass} font-semibold whitespace-nowrap`}
                      >
                        {actionLabels[entry.action] ?? entry.action}
                      </td>
                      <td className={`${tdClass} whitespace-pre-wrap`}>
                        {detail || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {history.length === 0 && (
              <p className="text-charcoal/65 p-8 text-center" role="status">
                Chưa có thay đổi nào được ghi.
              </p>
            )}
          </div>
          <span className="text-charcoal/65 text-sm">
            Hiển thị {history.length}/{history.length} mục
          </span>
        </section>
      )}

      <datalist id="sales-slip-items">
        {masters.items.map((item) => (
          <option key={item.id} value={item.code}>
            {item.name}
            {item.unit ? ` (${item.unit})` : ""}
          </option>
        ))}
      </datalist>
      <datalist id="sales-slip-recipients">
        {masters.recipients.map((recipient) => (
          <option key={recipient.id} value={recipient.code}>
            {recipient.name}
          </option>
        ))}
      </datalist>
    </div>
  );
}
