"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils/cn";

export type MotionRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  once?: boolean;
};

export function MotionReveal({
  children,
  className,
  delay = 0,
  distance = 28,
  once = true,
}: MotionRevealProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial={
        prefersReducedMotion
          ? false
          : { opacity: 0, transform: `translateY(${distance}px)` }
      }
      whileInView={{ opacity: 1, transform: "translateY(0px)" }}
      viewport={{ once, amount: 0.18 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.68,
        delay: prefersReducedMotion ? 0 : delay,
        ease: [0.2, 0.72, 0.2, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
