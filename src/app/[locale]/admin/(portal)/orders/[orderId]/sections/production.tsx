import {
  dateInputValue,
  formatDate,
} from "@/app/[locale]/admin/(portal)/finance/shared";
import {
  recordQcCheckAction,
  saveProductionPlanAction,
  setProductionStageAction,
} from "@/app/[locale]/admin/(portal)/orders/actions";
import {
  defectRate,
  latestQcCheck,
  type OrderReadDto,
} from "@/domains/orders/contracts";
import {
  productionStageLabels,
  productionStages,
  qcCheckpointLabels,
  qcCheckpointStage,
  qcCheckpoints,
  type QcCheckpoint,
} from "@/domains/orders/workflow";

import {
  buttonClass,
  cardClass,
  fieldClass,
  headingClass,
  labelClass,
  mutedBadgeClass,
  okBadgeClass,
  smallButtonClass,
  subheadingClass,
  warnBadgeClass,
} from "./styles";

/**
 * Steps 03, 05 and the three inspections: the plan per workshop stage, where
 * the order stands in the workshop, and every inspection recorded. The
 * checks are shown on one card because the raw-body, finishing and packing
 * inspections are one story: what was found, when, and whether it passed.
 */

const copy = {
  vi: {
    title: "Sản xuất và kiểm tra chất lượng",
    planTitle: "Kế hoạch sản xuất (bước 3)",
    planMissing:
      "Chưa lập kế hoạch. Quản lý xưởng lập rồi mới rời được bước 3.",
    planSavedBy: "Lưu lần cuối",
    woodworkDue: "Xong Mộc",
    lacquerDue: "Xong Sơn",
    finishingDue: "Xong Hoàn thiện",
    packingDue: "Xong Đóng gói",
    shipDue: "Xuất hàng",
    assignment: "Phân công công nhân / cơ sở",
    planNote: "Ghi chú năng lực, vật tư",
    savePlan: "Lưu kế hoạch",
    stageTitle: "Công đoạn (bước 5)",
    stageHint:
      "Sơn chỉ bắt đầu khi kiểm mộc đạt. Đơn sang bước kiểm tra chất lượng khi đã ở công đoạn Hoàn thiện.",
    moveTo: "Chuyển sang",
    checksTitle: "Các lần kiểm",
    noChecks: "Chưa có lần kiểm nào.",
    checkpoint: "Điểm kiểm",
    result: "Kết quả",
    defects: "Số lỗi",
    note: "Ghi chú",
    when: "Lúc",
    pass: "Đạt",
    fail: "Không đạt",
    recordTitle: (label: string) => `Ghi ${label.toLowerCase()}`,
    defectCount: "Số sản phẩm lỗi",
    checkNote: "Nhận xét",
    record: "Ghi kết quả",
    defectRate: "Tỷ lệ lỗi",
    defectRateHint: (defects: number, quantity: number) =>
      `${defects} lỗi / ${quantity} sản phẩm đặt`,
    latest: "Lần kiểm mới nhất",
    none: "chưa kiểm",
  },
  en: {
    title: "Production and quality",
    planTitle: "Production plan (step 3)",
    planMissing:
      "No plan yet. The Factory Manager saves one before leaving step 3.",
    planSavedBy: "Last saved",
    woodworkDue: "Woodwork done",
    lacquerDue: "Lacquer done",
    finishingDue: "Finishing done",
    packingDue: "Packing done",
    shipDue: "Dispatch",
    assignment: "Workers / sites assigned",
    planNote: "Capacity and material notes",
    savePlan: "Save plan",
    stageTitle: "Workshop stage (step 5)",
    stageHint:
      "Lacquer starts once the raw-body inspection passes. The order reaches quality control from the finishing stage.",
    moveTo: "Move to",
    checksTitle: "Inspections",
    noChecks: "No inspection yet.",
    checkpoint: "Checkpoint",
    result: "Result",
    defects: "Defects",
    note: "Note",
    when: "When",
    pass: "Pass",
    fail: "Fail",
    recordTitle: (label: string) => `Record the ${label.toLowerCase()}`,
    defectCount: "Defective pieces",
    checkNote: "Remarks",
    record: "Record result",
    defectRate: "Defect rate",
    defectRateHint: (defects: number, quantity: number) =>
      `${defects} defects / ${quantity} pieces ordered`,
    latest: "Latest inspection",
    none: "not yet",
  },
} as const;

function checkpointForStage(stage: OrderReadDto["stage"]): QcCheckpoint | null {
  for (const checkpoint of qcCheckpoints) {
    if (qcCheckpointStage[checkpoint] === stage) return checkpoint;
  }
  return null;
}

export function ProductionSection({
  locale,
  order,
  canPlan,
  canProgress,
  canInspect,
}: {
  locale: "vi" | "en";
  order: OrderReadDto;
  canPlan: boolean;
  canProgress: boolean;
  canInspect: boolean;
}) {
  const text = copy[locale];
  const plan = order.productionPlan;
  const checkpoint = checkpointForStage(order.stage);
  const rate = defectRate(order);
  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const planFields = [
    ["woodworkDue", text.woodworkDue],
    ["lacquerDue", text.lacquerDue],
    ["finishingDue", text.finishingDue],
    ["packingDue", text.packingDue],
    ["shipDue", text.shipDue],
  ] as const;

  return (
    <section className={cardClass}>
      <h2 className={headingClass}>{text.title}</h2>

      {/* Plan */}
      <h3 className={subheadingClass}>{text.planTitle}</h3>
      {canPlan ? (
        <form action={saveProductionPlanAction} className="mt-3 grid gap-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="expectedRevision" value={order.revision} />
          <div className="grid gap-3 sm:grid-cols-3">
            {planFields.map(([name, label]) => (
              <div key={name}>
                <label htmlFor={`plan-${name}`} className={labelClass}>
                  {label}
                </label>
                <input
                  id={`plan-${name}`}
                  type="date"
                  name={name}
                  defaultValue={dateInputValue(plan?.[name] ?? null)}
                  className={fieldClass}
                />
              </div>
            ))}
          </div>
          <div>
            <label htmlFor="plan-assignment" className={labelClass}>
              {text.assignment}
            </label>
            <textarea
              id="plan-assignment"
              name="assignment"
              rows={2}
              maxLength={2000}
              defaultValue={plan?.assignment ?? ""}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="plan-note" className={labelClass}>
              {text.planNote}
            </label>
            <textarea
              id="plan-note"
              name="note"
              rows={2}
              maxLength={2000}
              defaultValue={plan?.note ?? ""}
              className={fieldClass}
            />
          </div>
          <div>
            <button type="submit" className={buttonClass}>
              {text.savePlan}
            </button>
          </div>
        </form>
      ) : plan ? (
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {planFields.map(([name, label]) => (
            <div key={name}>
              <dt className="text-charcoal/50 text-xs">{label}</dt>
              <dd>{plan[name] ? formatDate(plan[name]!, locale) : "—"}</dd>
            </div>
          ))}
          {plan.assignment ? (
            <div className="sm:col-span-3">
              <dt className="text-charcoal/50 text-xs">{text.assignment}</dt>
              <dd className="whitespace-pre-line">{plan.assignment}</dd>
            </div>
          ) : null}
          {plan.note ? (
            <div className="sm:col-span-3">
              <dt className="text-charcoal/50 text-xs">{text.planNote}</dt>
              <dd className="whitespace-pre-line">{plan.note}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="text-charcoal/55 mt-3 text-sm">{text.planMissing}</p>
      )}
      {plan ? (
        <p className="text-charcoal/45 mt-2 text-xs">
          {text.planSavedBy}: {dateFormat.format(plan.savedAt)}
        </p>
      ) : null}

      {/* Workshop stage */}
      {order.productionStage || order.stage === "inProduction" ? (
        <>
          <h3 className={subheadingClass}>{text.stageTitle}</h3>
          <ol className="mt-3 flex flex-wrap gap-2">
            {productionStages.map((stage) => {
              const index = productionStages.indexOf(stage);
              const current = productionStages.indexOf(
                order.productionStage ?? "woodwork",
              );
              const state =
                index < current
                  ? "past"
                  : index === current
                    ? "current"
                    : "future";
              return (
                <li
                  key={stage}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    state === "current"
                      ? "border-lacquer bg-lacquer text-ivory font-semibold"
                      : state === "past"
                        ? "border-gold/50 bg-gold/10 text-charcoal/70"
                        : "border-burgundy/15 text-charcoal/40"
                  }`}
                >
                  {productionStageLabels[stage][locale]}
                </li>
              );
            })}
          </ol>
          <p className="text-charcoal/50 mt-2 text-xs">{text.stageHint}</p>
          {canProgress && order.stage === "inProduction" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {productionStages
                .filter((stage) => stage !== order.productionStage)
                .map((stage) => (
                  <form key={stage} action={setProductionStageAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="orderId" value={order.id} />
                    <input
                      type="hidden"
                      name="expectedRevision"
                      value={order.revision}
                    />
                    <input type="hidden" name="productionStage" value={stage} />
                    <button type="submit" className={smallButtonClass}>
                      {text.moveTo}: {productionStageLabels[stage][locale]}
                    </button>
                  </form>
                ))}
            </div>
          ) : null}
        </>
      ) : null}

      {/* Inspections */}
      <h3 className={subheadingClass}>{text.checksTitle}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {qcCheckpoints.map((point) => {
          const latest = latestQcCheck(order.qcChecks, point);
          const label = qcCheckpointLabels[point][locale];
          return (
            <span
              key={point}
              className={
                latest?.result === "pass"
                  ? okBadgeClass
                  : latest?.result === "fail"
                    ? warnBadgeClass
                    : mutedBadgeClass
              }
            >
              {label}:{" "}
              {latest
                ? latest.result === "pass"
                  ? text.pass
                  : text.fail
                : text.none}
            </span>
          );
        })}
        {rate ? (
          <span className={rate.ratio > 0.02 ? warnBadgeClass : okBadgeClass}>
            {text.defectRate}: {(rate.ratio * 100).toFixed(1)}% ·{" "}
            {text.defectRateHint(rate.defects, rate.quantity)}
          </span>
        ) : null}
      </div>
      {order.qcChecks.length === 0 ? (
        <p className="text-charcoal/55 mt-3 text-sm">{text.noChecks}</p>
      ) : (
        <table className="mt-3 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
              <th className="px-3 py-2 font-semibold">{text.checkpoint}</th>
              <th className="px-3 py-2 font-semibold">{text.result}</th>
              <th className="px-3 py-2 text-right font-semibold">
                {text.defects}
              </th>
              <th className="px-3 py-2 font-semibold">{text.note}</th>
              <th className="px-3 py-2 font-semibold">{text.when}</th>
            </tr>
          </thead>
          <tbody>
            {[...order.qcChecks].reverse().map((check) => (
              <tr key={check.id} className="border-burgundy/8 border-b">
                <td className="px-3 py-2">
                  {qcCheckpointLabels[check.checkpoint][locale]}
                </td>
                <td
                  className={`px-3 py-2 font-semibold ${
                    check.result === "pass" ? "text-gold-ink" : "text-lacquer"
                  }`}
                >
                  {check.result === "pass" ? text.pass : text.fail}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  {check.defectCount ?? "—"}
                </td>
                <td className="text-charcoal/70 px-3 py-2 text-xs">
                  {check.note ?? ""}
                </td>
                <td className="text-charcoal/45 px-3 py-2 text-xs">
                  {dateFormat.format(check.at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canInspect && checkpoint ? (
        <form
          action={recordQcCheckAction}
          className="border-burgundy/10 mt-5 grid gap-3 border-t pt-5"
        >
          <p className="text-charcoal/60 text-sm font-semibold">
            {text.recordTitle(qcCheckpointLabels[checkpoint][locale])}
          </p>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="expectedRevision" value={order.revision} />
          <input type="hidden" name="checkpoint" value={checkpoint} />
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="result"
                value="pass"
                defaultChecked
                className="accent-lacquer"
              />
              {text.pass}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="result"
                value="fail"
                className="accent-lacquer"
              />
              {text.fail}
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <div>
              <label htmlFor="qc-defects" className={labelClass}>
                {text.defectCount}
              </label>
              <input
                id="qc-defects"
                name="defectCount"
                inputMode="numeric"
                maxLength={7}
                className={`${fieldClass} font-mono`}
              />
            </div>
            <div>
              <label htmlFor="qc-note" className={labelClass}>
                {text.checkNote}
              </label>
              <input
                id="qc-note"
                name="note"
                maxLength={2000}
                className={fieldClass}
              />
            </div>
          </div>
          <div>
            <button type="submit" className={buttonClass}>
              {text.record}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
