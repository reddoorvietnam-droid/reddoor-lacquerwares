"use client";

import { useRef, type ReactNode } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";

import { cn } from "@/lib/utils/cn";

/**
 * Drifts its child against the page as the section passes through the
 * viewport, so a large feature has some depth behind it rather than sitting
 * flat on the ground.
 *
 * The offset is run through a spring rather than bound straight to scroll
 * position. Tracking the wheel one-to-one is what makes cheap parallax feel
 * twitchy; a little lag reads as weight.
 */

export type ScrollParallaxProps = {
  children: ReactNode;
  className?: string;
  /** Travel either side of centre, in pixels, across the whole pass. */
  distance?: number;
};

export function ScrollParallax({
  children,
  className,
  distance = 40,
}: ScrollParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const offset = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  const y = useSpring(offset, { stiffness: 58, damping: 26, mass: 0.6 });

  return (
    <div ref={ref} className={cn(className)}>
      <motion.div
        className="size-full"
        {...(prefersReducedMotion ? {} : { style: { y } })}
      >
        {children}
      </motion.div>
    </div>
  );
}
