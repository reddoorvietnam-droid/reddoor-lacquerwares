import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A reserved space for a photograph that has not been supplied yet.
 *
 * It draws the exact box the final image will occupy, crossed corner to corner,
 * with the pixel size written across it. That makes two things true at once:
 * the page is laid out at its real proportions, so nothing shifts when the
 * photograph arrives, and whoever is preparing the assets can read the size
 * they need straight off the screen.
 *
 * It is deliberately not a decorative illustration. A pretty stand-in gets
 * mistaken for finished work; a marked slot does not.
 */

export type ImageSlotProps = HTMLAttributes<HTMLDivElement> & {
  /** Intended pixel width of the final photograph. */
  width: number;
  /** Intended pixel height of the final photograph. */
  height: number;
  /** Short description of what belongs here, shown under the size. */
  label?: string;
  /** File name to save the asset as, when one has been agreed. */
  assetKey?: string;
  /** Inverse palette, for slots sitting on a dark section. */
  inverse?: boolean;
  /** Rounded like a display surface rather than a plain card. */
  display?: boolean;
};

export function ImageSlot({
  width,
  height,
  label,
  assetKey,
  inverse = false,
  display = false,
  className,
  ...props
}: ImageSlotProps) {
  const line = inverse ? "rgb(245 240 231 / 0.30)" : "rgb(61 13 16 / 0.22)";

  return (
    <div
      className={cn(
        "relative isolate grid w-full place-items-center overflow-hidden border",
        display
          ? "rounded-[var(--radius-display)]"
          : "rounded-[var(--radius-lg)]",
        inverse
          ? "border-ivory/25 bg-ivory/[0.04]"
          : "border-burgundy/25 bg-burgundy/[0.03]",
        className,
      )}
      style={{ aspectRatio: `${width} / ${height}` }}
      // The size is announced in the visible label, so the crossed box itself
      // carries no additional meaning for assistive technology.
      role="img"
      aria-label={
        label
          ? `${label} — ảnh chờ thay thế, ${width}×${height}`
          : `Ảnh chờ thay thế, ${width}×${height}`
      }
      {...props}
    >
      <svg
        className="absolute inset-0 size-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <line x1="0" y1="0" x2="100" y2="100" stroke={line} strokeWidth="0.4" />
        <line x1="100" y1="0" x2="0" y2="100" stroke={line} strokeWidth="0.4" />
      </svg>

      <div className="relative px-4 py-3 text-center">
        <p
          className={cn(
            "font-mono text-sm font-semibold tracking-[0.08em] tabular-nums",
            inverse ? "text-ivory/80" : "text-burgundy/75",
          )}
        >
          {width} × {height}
        </p>
        {label ? (
          <p
            className={cn(
              "mt-1.5 text-[0.7rem] leading-5 tracking-[0.1em] uppercase",
              inverse ? "text-ivory/55" : "text-charcoal/55",
            )}
          >
            {label}
          </p>
        ) : null}
        {assetKey ? (
          <p
            className={cn(
              "mt-1 font-mono text-[0.62rem]",
              inverse ? "text-ivory/40" : "text-charcoal/40",
            )}
          >
            {assetKey}
          </p>
        ) : null}
      </div>
    </div>
  );
}
