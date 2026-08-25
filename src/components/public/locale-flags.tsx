import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils/cn";

/**
 * Inline SVG flags for the language switcher.
 *
 * Emoji flags are not an option: Windows ships no regional-indicator glyphs, so
 * `🇻🇳` renders as the letters "VN" for a large share of visitors. These are drawn
 * instead, so every platform shows the same mark.
 *
 * A flag names a country, not a language, so it is never the only label. Each
 * one is `aria-hidden` and the switcher always carries the language name as
 * text for assistive technology.
 */

/** Five-point star, centred on the origin, one unit outer radius, point up. */
const STAR =
  "M0,-1 L0.2245,-0.309 L0.9511,-0.309 L0.3633,0.118 L0.5878,0.809 " +
  "L0,0.382 L-0.5878,0.809 L-0.3633,0.118 L-0.9511,-0.309 L-0.2245,-0.309 Z";

function Vietnam() {
  return (
    <>
      <rect width="24" height="16" fill="#DA251D" />
      <path d={STAR} transform="translate(12 8) scale(4.6)" fill="#FF0" />
    </>
  );
}

function UnitedKingdom() {
  return (
    <>
      <rect width="24" height="16" fill="#012169" />
      <path d="M0,0 L24,16 M24,0 L0,16" stroke="#FFF" strokeWidth="3.2" />
      <path d="M0,0 L24,16 M24,0 L0,16" stroke="#C8102E" strokeWidth="1.8" />
      <path d="M12,0 V16 M0,8 H24" stroke="#FFF" strokeWidth="5.2" />
      <path d="M12,0 V16 M0,8 H24" stroke="#C8102E" strokeWidth="3.1" />
    </>
  );
}

function France() {
  return (
    <>
      <rect width="8" height="16" fill="#002395" />
      <rect x="8" width="8" height="16" fill="#FFF" />
      <rect x="16" width="8" height="16" fill="#ED2939" />
    </>
  );
}

function Germany() {
  return (
    <>
      <rect width="24" height="5.34" fill="#000" />
      <rect y="5.34" width="24" height="5.33" fill="#D00" />
      <rect y="10.67" width="24" height="5.33" fill="#FFCE00" />
    </>
  );
}

function Japan() {
  return (
    <>
      <rect width="24" height="16" fill="#FFF" />
      <circle cx="12" cy="8" r="4.8" fill="#BC002D" />
    </>
  );
}

function China() {
  return (
    <>
      <rect width="24" height="16" fill="#EE1C25" />
      <path d={STAR} transform="translate(4.8 4.4) scale(2.6)" fill="#FF0" />
      <path
        d={STAR}
        transform="translate(9.6 1.9) scale(0.85) rotate(23)"
        fill="#FF0"
      />
      <path
        d={STAR}
        transform="translate(11.4 4) scale(0.85) rotate(46)"
        fill="#FF0"
      />
      <path
        d={STAR}
        transform="translate(11.4 6.5) scale(0.85) rotate(70)"
        fill="#FF0"
      />
      <path
        d={STAR}
        transform="translate(9.6 8.4) scale(0.85) rotate(23)"
        fill="#FF0"
      />
    </>
  );
}

const flagsByLocale: Record<Locale, () => React.JSX.Element> = {
  vi: Vietnam,
  en: UnitedKingdom,
  fr: France,
  de: Germany,
  ja: Japan,
  "zh-CN": China,
};

export type LocaleFlagProps = {
  locale: Locale;
  className?: string;
};

export function LocaleFlag({ locale, className }: LocaleFlagProps) {
  const Flag = flagsByLocale[locale];

  return (
    <svg
      viewBox="0 0 24 16"
      aria-hidden="true"
      focusable="false"
      className={cn(
        "ring-charcoal/15 h-auto w-6 shrink-0 rounded-[0.1875rem] ring-1",
        className,
      )}
      xmlns="http://www.w3.org/2000/svg"
    >
      <Flag />
    </svg>
  );
}
