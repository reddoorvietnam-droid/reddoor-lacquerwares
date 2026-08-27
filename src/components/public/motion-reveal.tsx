"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils/cn";

/**
 * The standard entrance for anything that scrolls into view.
 *
 * The element rises a short distance while it resolves out of a soft blur.
 * The blur is what separates this from a stock fade-up: focus pulling reads
 * as considered rather than mechanical, which is the register the rest of the
 * page is written in. It is deliberately slow and never overshoots — a spring
 * that bounces would undo the same impression.
 */

export type MotionRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  /** Radius the element resolves from, in pixels. Zero disables the blur. */
  blur?: number;
  once?: boolean;
};

export function MotionReveal({
  children,
  className,
  delay = 0,
  distance = 16,
  blur = 3,
  once = true,
}: MotionRevealProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial={
        prefersReducedMotion
          ? false
          : {
              opacity: 0,
              y: distance,
              filter: blur ? `blur(${blur}px)` : "blur(0px)",
            }
      }
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once, amount: 0.18 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.7,
        delay: prefersReducedMotion ? 0 : delay,
        ease: [0.2, 0.72, 0.2, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
