"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "../ui/button";
import { LogoMark } from "./logo";

export type DoorIntroProps = {
  brandName: string;
  title: string;
  skipLabel: string;
  storageKey?: string;
};

export function DoorIntro({
  brandName,
  title,
  skipLabel,
  storageKey = "reddoor:door-intro:v1",
}: DoorIntroProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const skipButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const dismiss = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, "seen");
    } catch {
      // The intro remains nonessential when storage is unavailable.
    }

    if (prefersReducedMotion) return;

    const frame = window.requestAnimationFrame(() => setIsOpen(true));
    return () => window.cancelAnimationFrame(frame);
  }, [storageKey]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = window.setTimeout(dismiss, 2500);
    return () => window.clearTimeout(timer);
  }, [dismiss, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    skipButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [dismiss, isOpen]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          ref={panelRef}
          className="fixed inset-0 isolate z-[100] overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          <motion.div
            className="bg-burgundy absolute inset-y-0 left-0 w-[50.5%] border-r border-white/10 shadow-[1rem_0_4rem_rgb(27_7_8/0.35)]"
            initial={{ x: "0%" }}
            animate={{ x: "-103%" }}
            transition={{
              delay: 0.58,
              duration: 1.3,
              ease: [0.2, 0.72, 0.2, 1],
            }}
          >
            <DoorTexture />
          </motion.div>
          <motion.div
            className="bg-burgundy absolute inset-y-0 right-0 w-[50.5%] border-l border-white/10 shadow-[-1rem_0_4rem_rgb(27_7_8/0.35)]"
            initial={{ x: "0%" }}
            animate={{ x: "103%" }}
            transition={{
              delay: 0.58,
              duration: 1.3,
              ease: [0.2, 0.72, 0.2, 1],
            }}
          >
            <DoorTexture mirrored />
          </motion.div>

          <motion.div
            className="text-ivory pointer-events-none relative z-10 flex h-full flex-col items-center justify-center px-6 text-center"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.98, 1, 1, 1.01] }}
            transition={{
              duration: 2,
              times: [0, 0.18, 0.55, 1],
              ease: [0.2, 0.72, 0.2, 1],
            }}
          >
            <LogoMark decorative className="w-12" />
            <p
              id={titleId}
              className="mt-6 font-serif text-4xl tracking-[0.06em] uppercase sm:text-6xl"
            >
              {brandName}
            </p>
            <p className="text-gold mt-3 text-xs font-semibold tracking-[0.22em] uppercase">
              {title}
            </p>
          </motion.div>

          <Button
            ref={skipButtonRef}
            variant="inverse"
            size="sm"
            className="absolute top-5 right-5 z-20 sm:top-8 sm:right-8"
            onClick={dismiss}
          >
            {skipLabel}
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function DoorTexture({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      aria-hidden="true"
      style={{ transform: mirrored ? "scaleX(-1)" : undefined }}
    >
      <div className="absolute inset-5 border border-[#c2a052]/30 sm:inset-8" />
      <div className="absolute inset-10 border border-[#c2a052]/15 sm:inset-14" />
      <div className="absolute top-1/2 left-1/2 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c2a052]/25" />
      <div className="absolute top-1/2 left-1/2 h-px w-[130%] -translate-x-1/2 rotate-45 bg-[#c2a052]/12" />
      <div className="absolute top-1/2 left-1/2 h-px w-[130%] -translate-x-1/2 -rotate-45 bg-[#c2a052]/12" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgb(255_255_255/0.08),transparent_28%),radial-gradient(circle_at_75%_82%,rgb(0_0_0/0.18),transparent_35%)]" />
    </div>
  );
}
