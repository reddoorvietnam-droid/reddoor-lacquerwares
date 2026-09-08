"use client";

import {
  statusLabels,
  statusTone,
  summarize,
  type SampleStatus,
} from "@/domains/sample-progress/contracts";
import { formatPercent } from "./sample-progress-shared";

/**
 * A doughnut drawn as plain SVG. The repo has no charting idiom and one ring of
 * four slices does not justify introducing one — this also prints reliably and
 * adds nothing to the bundle.
 */
function Doughnut({
  slices,
  total,
}: {
  slices: { status: SampleStatus; count: number; ratio: number }[];
  total: number;
}) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg
      viewBox="0 0 160 160"
      className="h-40 w-40 shrink-0"
      role="img"
      aria-label={`Biểu đồ tỷ lệ trạng thái: ${slices
        .map((slice) => `${statusLabels[slice.status]} ${slice.count}`)
        .join(", ")}`}
    >
      <circle
        cx="80"
        cy="80"
        r={radius}
        fill="none"
        stroke="#e4d9c8"
        strokeWidth="24"
      />
      {total > 0 &&
        slices.map((slice) => {
          const length = slice.ratio * circumference;
          const dash = (
            <circle
              key={slice.status}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={statusTone[slice.status].chart}
              strokeWidth="24"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 80 80)"
            />
          );
          offset += length;
          return dash;
        })}
      <text
        x="80"
        y="74"
        textAnchor="middle"
        className="fill-burgundy text-[1.5rem] font-semibold"
      >
        {total}
      </text>
      <text
        x="80"
        y="94"
        textAnchor="middle"
        className="fill-charcoal/60 text-[0.6rem]"
      >
        mẫu
      </text>
    </svg>
  );
}

export function SampleProgressSummary({
  rows,
}: {
  rows: readonly { status: SampleStatus }[];
}) {
  const slices = summarize(rows);
  const total = rows.length;
  return (
    <section
      aria-label="Thống kê tiến độ mẫu"
      className="border-burgundy/15 flex flex-wrap items-center gap-6 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]"
    >
      <Doughnut slices={slices} total={total} />
      <div className="grid min-w-64 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {slices.map((slice) => (
          <div
            key={slice.status}
            className={`rounded-xl p-4 ${statusTone[slice.status].card}`}
          >
            <p className="text-xs leading-snug font-semibold">
              {statusLabels[slice.status]}
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {slice.count}{" "}
              <span className="text-sm font-normal">
                ({formatPercent(slice.ratio)})
              </span>
            </p>
          </div>
        ))}
      </div>
      <p className="text-charcoal/60 basis-full text-xs">
        Tỷ lệ là phần trăm phân bố trạng thái trên tổng số dòng mẫu, không phải
        mức độ hoàn thành. Tổng số mẫu đếm theo dòng, không cộng số lượng ghi
        trong phần mô tả.
      </p>
    </section>
  );
}
