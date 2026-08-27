"use client";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils/cn";

/**
 * A hairline that draws itself across the page as it comes into view.
 *
 * It does the work a change of background colour used to do: it marks where
 * one movement ends and the next begins, without breaking the surface the
 * page is sitting on.
 */

export type MotionRuleProps = {
  className?: string;
  /** Palette for a dark ground. */
  inverse?: boolean;
  delay?: number;
};

export function MotionRule({
  className,
  inverse = false,
  delay = 0,
}: MotionRuleProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden="true"
      className={cn(
        "h-px w-full origin-left",
        inverse ? "bg-gold/35" : "bg-burgundy/18",
        className,
      )}
      initial={prefersReducedMotion ? false : { scaleX: 0, opacity: 0 }}
      whileInView={{ scaleX: 1, opacity: 1 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 1.15,
        delay: prefersReducedMotion ? 0 : delay,
        ease: [0.2, 0.72, 0.2, 1],
      }}
    />
  );
}
