"use client";

import type { ProductFilterOptionView } from "./products";

/**
 * A pill-shaped select that reads as one word plus a chevron.
 *
 * The native control stays underneath — it is what makes the catalogue work
 * without JavaScript and what gives phones their own picker — but it is styled
 * flat and stripped of its operating-system arrow (`appearance-none`) so the
 * closed state matches the rest of the site. The drawn chevron replaces it.
 *
 * This is the listing's only client component, and it exists for one reason:
 * `onChange` submits the enclosing form, so nothing stands between choosing a
 * filter and seeing it applied. Without JavaScript the visitor falls back to
 * the form's own submit button, which stays in the markup for that reason.
 */
export function ProductFilterSelect({
  currentValue,
  label,
  name,
  options,
}: {
  currentValue: string;
  label: string;
  name: string;
  options: readonly ProductFilterOptionView[];
}) {
  return (
    <div className="relative">
      <select
        name={name}
        defaultValue={currentValue}
        aria-label={label}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="border-burgundy/18 bg-ivory text-charcoal hover:border-lacquer/45 focus:border-lacquer focus:ring-lacquer/15 h-11 w-full cursor-pointer appearance-none rounded-full border py-0 pr-9 pl-4 text-sm font-medium outline-none focus:ring-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {/* The empty option is the "no filter" state; naming it after the
                facet keeps the closed pill readable as "Danh mục" rather than
                the anonymous "Xem tất cả". */}
            {option.value === "" ? label : option.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="text-charcoal/45 pointer-events-none absolute top-1/2 right-3.5 size-3 -translate-y-1/2"
      >
        <path d="m2.5 4.5 3.5 3.5 3.5-3.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}
