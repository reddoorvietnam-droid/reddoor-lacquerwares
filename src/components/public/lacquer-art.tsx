import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

export type LacquerArtVariant = "portal" | "moon" | "layers";

export type LacquerArtProps = HTMLAttributes<HTMLDivElement> & {
  variant?: LacquerArtVariant;
};

export function LacquerArt({
  variant = "portal",
  className,
  ...props
}: LacquerArtProps) {
  return (
    <div
      className={cn(
        "bg-burgundy relative isolate aspect-[4/5] overflow-hidden rounded-[var(--radius-display)] border border-white/10 shadow-[var(--shadow-lacquer)]",
        className,
      )}
      aria-hidden="true"
      {...props}
    >
      <div className="lacquer-grain" />
      <svg
        viewBox="0 0 400 500"
        className="absolute inset-0 size-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {variant === "portal" ? <PortalArtwork /> : null}
        {variant === "moon" ? <MoonArtwork /> : null}
        {variant === "layers" ? <LayerArtwork /> : null}
      </svg>
      <div className="absolute inset-x-8 bottom-8 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
    </div>
  );
}

function PortalArtwork() {
  return (
    <>
      <circle cx="200" cy="184" r="116" className="fill-gold/10" />
      <circle
        cx="200"
        cy="184"
        r="92"
        className="stroke-gold/45"
        strokeWidth="1.5"
      />
      <path
        d="M108 421V110h184v311M132 421V136h136v285"
        className="stroke-gold/75"
        strokeWidth="2"
      />
      <path
        d="m132 136 136 285m0-285L132 421M200 136v285M132 278.5h136"
        className="stroke-gold/30"
        strokeWidth="1"
      />
      <circle cx="246" cy="282" r="5" className="fill-gold" />
    </>
  );
}

function MoonArtwork() {
  return (
    <>
      <circle cx="272" cy="142" r="80" className="fill-gold/80" />
      <circle cx="250" cy="126" r="66" className="fill-burgundy" />
      <path
        d="M-30 294c78-48 134-51 208-6 70 43 141 45 252-25M-20 334c76-38 130-38 202-3 75 37 148 36 238-15M-10 382c72-28 131-26 194 4 66 31 139 31 226 1"
        className="stroke-gold/55"
        strokeWidth="2"
      />
      <path
        d="M72 88v112m0-56h87m-43.5-56v112M42 116l147 56m0-56L42 172"
        className="stroke-gold/20"
      />
    </>
  );
}

function LayerArtwork() {
  return (
    <>
      <path
        d="M-24 106c77 43 124 52 190 22 77-36 140-33 258 30v96c-106-60-181-70-263-34-67 29-116 20-185-20v-94Z"
        className="fill-lacquer stroke-gold/40"
        strokeWidth="1.5"
      />
      <path
        d="M-18 248c83 41 135 47 201 18 72-32 133-27 235 24v104c-91-48-156-53-225-22-77 34-129 27-211-13V248Z"
        className="stroke-gold/55 fill-[#5f1115]"
        strokeWidth="1.5"
      />
      <circle
        cx="292"
        cy="132"
        r="62"
        className="stroke-gold/65"
        strokeWidth="2"
      />
      <circle cx="292" cy="132" r="42" className="fill-gold/10" />
      <path
        d="M292 70v124M230 132h124m-106-44 88 88m0-88-88 88"
        className="stroke-gold/25"
      />
    </>
  );
}
