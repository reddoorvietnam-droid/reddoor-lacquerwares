import { notFound } from "next/navigation";

import { fxRateService } from "@/domains/finance/runtime";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

import { setFxRateAction } from "../actions";
import { formatDate, OutcomeBanner } from "../shared";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Tài chính",
    title: "Tỷ giá USD → VND",
    description:
      "Kế toán nhập tỷ giá theo ngày (ngân hàng hoặc hải quan, tùy quy định đang áp dụng). Hóa đơn USD lấy tỷ giá của ngày lập từ bảng này và giữ nguyên về sau; sửa bảng không làm đổi hóa đơn đã lập. Ngày chưa có tỷ giá thì dùng tỷ giá gần nhất trước đó.",
    formTitle: "Nhập tỷ giá",
    date: "Ngày",
    rate: "VND cho 1 USD",
    source: "Nguồn (PublicBank, Hải quan…)",
    submit: "Lưu tỷ giá",
    dateColumn: "Ngày",
    rateColumn: "Tỷ giá",
    sourceColumn: "Nguồn",
    updatedColumn: "Cập nhật",
    empty: "Chưa có tỷ giá nào. Hóa đơn USD sẽ yêu cầu nhập tỷ giá thủ công cho đến khi bảng này có dữ liệu.",
  },
  en: {
    eyebrow: "Finance",
    title: "USD → VND rates",
    description:
      "The accountant enters the rate per day (bank or customs, whichever rule applies). A USD invoice takes the rate of its issue date from this table and keeps it; editing the table never changes an issued invoice. A day without a rate uses the latest earlier one.",
    formTitle: "Enter a rate",
    date: "Date",
    rate: "VND per 1 USD",
    source: "Source (PublicBank, Customs…)",
    submit: "Save rate",
    dateColumn: "Date",
    rateColumn: "Rate",
    sourceColumn: "Source",
    updatedColumn: "Updated",
    empty: "No rates yet. USD invoices will ask for a typed rate until this table has data.",
  },
} as const;

export default async function FxRatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ locale: requestedLocale }, { error, notice }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];

  try {
    await requirePermission("finance.manageFxSnapshot");
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const rates = await fxRateService.list(90);
  const today = new Date().toISOString().slice(0, 10);
  const fieldClass =
    "border-burgundy/20 focus:border-burgundy/50 w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none";
  const labelClass =
    "text-charcoal/55 mb-1.5 block text-xs font-semibold tracking-[0.08em] uppercase";

  return (
    <div>
      <p className="eyebrow">{text.eyebrow}</p>
      <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em] md:text-6xl">
        {text.title}
      </h1>
      <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
        {text.description}
      </p>

      <OutcomeBanner locale={locale} error={error} notice={notice} />

      <section className="border-burgundy/15 mt-8 max-w-3xl rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)]">
        <h2 className="text-burgundy font-serif text-2xl">{text.formTitle}</h2>
        <form action={setFxRateAction} className="mt-5 grid gap-4 md:grid-cols-3">
          <input type="hidden" name="locale" value={locale} />
          <div>
            <label className={labelClass} htmlFor="fx-date">
              {text.date}
            </label>
            <input
              id="fx-date"
              type="date"
              name="date"
              required
              defaultValue={today}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="fx-rate">
              {text.rate}
            </label>
            <input
              id="fx-rate"
              type="text"
              name="rate"
              required
              inputMode="decimal"
              pattern="[0-9]+([.][0-9]+)?"
              placeholder="25400"
              className={`${fieldClass} font-mono`}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="fx-source">
              {text.source}
            </label>
            <input
              id="fx-source"
              type="text"
              name="source"
              maxLength={120}
              className={fieldClass}
            />
          </div>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-11 items-center rounded-full px-7 text-sm font-semibold"
            >
              {text.submit}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-10 max-w-3xl">
        {rates.length === 0 ? (
          <p className="border-burgundy/15 text-charcoal/60 rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
            {text.empty}
          </p>
        ) : (
          <div className="border-burgundy/15 overflow-x-auto rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">{text.title}</caption>
              <thead>
                <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
                  <th scope="col" className="px-5 py-4 font-semibold">{text.dateColumn}</th>
                  <th scope="col" className="px-5 py-4 font-semibold">{text.rateColumn}</th>
                  <th scope="col" className="px-5 py-4 font-semibold">{text.sourceColumn}</th>
                  <th scope="col" className="px-5 py-4 font-semibold">{text.updatedColumn}</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => (
                  <tr key={rate.id} className="border-burgundy/8 border-b">
                    <th scope="row" className="px-5 py-4 text-left font-mono text-xs font-semibold">
                      {formatDate(rate.date, locale)}
                    </th>
                    <td className="px-5 py-4 font-mono text-xs">{rate.rate}</td>
                    <td className="text-charcoal/70 px-5 py-4 text-xs">{rate.source ?? "—"}</td>
                    <td className="text-charcoal/50 px-5 py-4 text-xs">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(rate.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
