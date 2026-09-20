import {
  dateInputValue,
  formatDate,
} from "@/app/[locale]/admin/(portal)/finance/shared";
import { savePackingRecordAction } from "@/app/[locale]/admin/(portal)/orders/actions";
import type { OrderReadDto } from "@/domains/orders/contracts";

import {
  buttonClass,
  cardClass,
  fieldClass,
  headingClass,
  labelClass,
} from "./styles";

/**
 * Step 07 on file: the Storekeeper's packing slip. Photos and the slip
 * itself are uploaded on the documents card; the packing inspection is
 * recorded on the production card.
 */

const copy = {
  vi: {
    title: "Đóng gói (bước 7)",
    hint: "Hàng đóng gói xong lên pallet hoặc vào container rồi ra cảng. Thủ kho ghi phiếu đóng gói và chụp ảnh toàn bộ; Quản lý xưởng kiểm đóng gói xong mới rời bước.",
    packedAt: "Ngày đóng gói xong",
    cartons: "Số thùng",
    pallets: "Số pallet",
    container: "Số container (nếu đóng thẳng)",
    note: "Ghi chú",
    save: "Lưu phiếu đóng gói",
    missing: "Chưa có phiếu đóng gói.",
    recordedAt: "Ghi lúc",
  },
  en: {
    title: "Packing (step 7)",
    hint: "Packed goods go onto pallets or into the container and out to the port. The Storekeeper records the slip and photographs everything; the Factory Manager's packing inspection releases the stage.",
    packedAt: "Packed on",
    cartons: "Cartons",
    pallets: "Pallets",
    container: "Container number (if loaded directly)",
    note: "Note",
    save: "Save packing slip",
    missing: "No packing slip yet.",
    recordedAt: "Recorded",
  },
} as const;

export function PackingSection({
  locale,
  order,
  canPack,
}: {
  locale: "vi" | "en";
  order: OrderReadDto;
  canPack: boolean;
}) {
  const text = copy[locale];
  const record = order.packingRecord;

  return (
    <section className={cardClass}>
      <h2 className={headingClass}>{text.title}</h2>
      <p className="text-charcoal/55 mt-2 text-sm">{text.hint}</p>

      {canPack ? (
        <form action={savePackingRecordAction} className="mt-4 grid gap-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="expectedRevision" value={order.revision} />
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="packing-date" className={labelClass}>
                {text.packedAt}
              </label>
              <input
                id="packing-date"
                type="date"
                name="packedAt"
                defaultValue={dateInputValue(record?.packedAt ?? null)}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="packing-cartons" className={labelClass}>
                {text.cartons}
              </label>
              <input
                id="packing-cartons"
                name="cartons"
                inputMode="numeric"
                maxLength={7}
                defaultValue={record?.cartons ?? ""}
                className={`${fieldClass} font-mono`}
              />
            </div>
            <div>
              <label htmlFor="packing-pallets" className={labelClass}>
                {text.pallets}
              </label>
              <input
                id="packing-pallets"
                name="pallets"
                inputMode="numeric"
                maxLength={7}
                defaultValue={record?.pallets ?? ""}
                className={`${fieldClass} font-mono`}
              />
            </div>
          </div>
          <div>
            <label htmlFor="packing-container" className={labelClass}>
              {text.container}
            </label>
            <input
              id="packing-container"
              name="containerNumber"
              maxLength={60}
              defaultValue={record?.containerNumber ?? ""}
              className={`${fieldClass} font-mono`}
            />
          </div>
          <div>
            <label htmlFor="packing-note" className={labelClass}>
              {text.note}
            </label>
            <textarea
              id="packing-note"
              name="note"
              rows={2}
              maxLength={2000}
              defaultValue={record?.note ?? ""}
              className={fieldClass}
            />
          </div>
          <div>
            <button type="submit" className={buttonClass}>
              {text.save}
            </button>
          </div>
        </form>
      ) : record ? (
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <dt className="text-charcoal/50">{text.packedAt}</dt>
          <dd className="sm:col-span-2">
            {record.packedAt ? formatDate(record.packedAt, locale) : "—"}
          </dd>
          <dt className="text-charcoal/50">{text.cartons}</dt>
          <dd className="font-mono sm:col-span-2">{record.cartons ?? "—"}</dd>
          <dt className="text-charcoal/50">{text.pallets}</dt>
          <dd className="font-mono sm:col-span-2">{record.pallets ?? "—"}</dd>
          <dt className="text-charcoal/50">{text.container}</dt>
          <dd className="font-mono sm:col-span-2">
            {record.containerNumber ?? "—"}
          </dd>
          {record.note ? (
            <>
              <dt className="text-charcoal/50">{text.note}</dt>
              <dd className="whitespace-pre-line sm:col-span-2">
                {record.note}
              </dd>
            </>
          ) : null}
        </dl>
      ) : (
        <p className="text-charcoal/55 mt-4 text-sm">{text.missing}</p>
      )}
      {record ? (
        <p className="text-charcoal/45 mt-2 text-xs">
          {text.recordedAt}:{" "}
          {new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(record.at)}
        </p>
      ) : null}
    </section>
  );
}
