import { notFound } from "next/navigation";

import {
  approvalDecisionPermission,
  approvalSubjects,
} from "@/domains/approvals/contracts";
import { isLocale } from "@/lib/i18n/config";
import { getAdminDictionary, resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

/** Presentation labels for each gated subject, in the two admin languages. */
const subjectLabels: Record<
  (typeof approvalSubjects)[number],
  { vi: string; en: string }
> = {
  "order.confirm": {
    vi: "Xác nhận đơn hàng",
    en: "Order confirmation",
  },
  "order.sellingPrice": {
    vi: "Giá bán của đơn hàng",
    en: "Order selling price",
  },
  "order.priceAdjustment": {
    vi: "Điều chỉnh giá đơn hàng",
    en: "Order price adjustment",
  },
  "order.cancel": { vi: "Hủy đơn hàng", en: "Order cancellation" },
  "order.dispatch": { vi: "Xuất hàng", en: "Dispatch" },
  "quote.send": { vi: "Gửi báo giá cho khách", en: "Sending a quote" },
  "quote.priceAdjustment": {
    vi: "Điều chỉnh giá báo giá",
    en: "Quote price adjustment",
  },
  "procurement.purchase": {
    vi: "Mua nguyên liệu",
    en: "Material purchase",
  },
  "procurement.priceChange": {
    vi: "Thay đổi đơn giá nhà cung cấp",
    en: "Supplier unit-price change",
  },
  "procurement.advance": {
    vi: "Tạm ứng cho nhà cung cấp",
    en: "Supplier advance",
  },
  "expense.incurred": { vi: "Chi phí phát sinh", en: "Incurred expense" },
  "inventory.adjustment": {
    vi: "Điều chỉnh tồn kho",
    en: "Inventory adjustment",
  },
  "production.plan": { vi: "Kế hoạch sản xuất", en: "Production plan" },
  "sample.approval": { vi: "Duyệt mẫu", en: "Sample approval" },
  "content.publication": {
    vi: "Xuất bản nội dung website",
    en: "Website content publication",
  },
  "collection.publication": {
    vi: "Xuất bản bộ sưu tập",
    en: "Collection publication",
  },
  "payroll.confirmation": { vi: "Xác nhận lương", en: "Payroll confirmation" },
};

export default async function AdminApprovalsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: requestedLocale } = await params;
  if (!isLocale(requestedLocale)) notFound();

  const locale = resolveAdminLocale(requestedLocale);
  const copy = getAdminDictionary(locale).approvals;

  return (
    <div>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 className="text-burgundy mt-3 max-w-4xl font-serif text-5xl tracking-[-0.045em] md:text-6xl">
        {copy.title}
      </h1>
      <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
        {copy.description}
      </p>

      <blockquote className="border-lacquer text-burgundy mt-8 max-w-3xl border-l-4 pl-5 font-serif text-xl leading-8">
        {copy.rule}
      </blockquote>

      <p className="border-gold/40 bg-gold/10 text-charcoal/75 mt-8 max-w-3xl rounded-2xl border px-5 py-4 text-sm leading-6">
        {copy.notImplemented}
      </p>

      <div className="border-burgundy/15 mt-10 overflow-x-auto rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.05)]">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <caption className="sr-only">{copy.title}</caption>
          <thead>
            <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
              <th scope="col" className="px-5 py-4 font-semibold">
                {copy.subjectColumn}
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                {copy.deciderColumn}
              </th>
            </tr>
          </thead>
          <tbody>
            {approvalSubjects.map((subject) => (
              <tr key={subject} className="border-burgundy/8 border-b">
                <th
                  scope="row"
                  className="text-burgundy px-5 py-4 text-left font-semibold"
                >
                  {subjectLabels[subject][locale]}
                  <span className="text-charcoal/40 mt-1 block font-mono text-xs font-normal">
                    {subject}
                  </span>
                </th>
                <td className="text-charcoal/60 px-5 py-4 font-mono text-xs">
                  {approvalDecisionPermission[subject]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="border-burgundy/15 mt-10 max-w-3xl rounded-2xl border bg-white p-6">
        <h2 className="text-burgundy font-serif text-2xl">
          {copy.separationTitle}
        </h2>
        <p className="text-charcoal/60 mt-3 text-sm leading-6">
          {copy.separationDescription}
        </p>
      </section>
    </div>
  );
}
