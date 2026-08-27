"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A YouTube player that costs nothing until someone wants to watch.
 *
 * A plain embed iframe pulls several hundred kilobytes of player code and
 * sets cookies the moment it mounts, on every visit, whether or not the video
 * is ever played. So the resting state here is only the poster frame; the
 * iframe is mounted on the first click and autoplays, which is the same single
 * click the real player would have cost anyway.
 *
 * `youtube-nocookie.com` is used so a visitor who never presses play leaves no
 * trace with YouTube at all.
 */

export type VideoEmbedProps = {
  /** Video id — the part after `youtu.be/` or `?v=` in the share link. */
  videoId: string;
  /** What the film shows. Names the player for assistive technology. */
  title: string;
  /** Localised label for the play button. */
  playLabel: string;
  className?: string;
};

export function VideoEmbed({
  videoId,
  title,
  playLabel,
  className,
}: VideoEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div
      className={cn(
        "border-ivory/15 relative isolate aspect-video w-full overflow-hidden rounded-[var(--radius-display)] border bg-black shadow-[0_1.5rem_4rem_rgb(27_7_8/0.45)]",
        className,
      )}
    >
      {isPlaying ? (
        <iframe
          className="absolute inset-0 size-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsPlaying(true)}
          aria-label={`${playLabel} — ${title}`}
          className="group focus-visible:outline-gold absolute inset-0 size-full cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-4"
        >
          <Image
            src={`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`}
            alt=""
            fill
            sizes="(min-width: 1600px) 1600px, 100vw"
            className="object-cover transition duration-700 group-hover:scale-[1.03]"
          />
          {/*
            The poster is a photograph of unknown brightness, so the control
            cannot rely on it: this wash guarantees the badge stays legible
            whatever frame YouTube returns.
          */}
          <span
            aria-hidden="true"
            className="from-charcoal/90 via-charcoal/25 absolute inset-0 bg-gradient-to-t to-transparent"
          />
          {/*
            The control sits in the corner rather than dead centre. A poster
            frame usually carries the film title across its middle, and a badge
            parked on top of it reads as a collision rather than a play button.
          */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 flex items-center gap-3.5 p-4 sm:gap-5 sm:p-8"
          >
            <span className="bg-gold text-burgundy grid size-12 shrink-0 place-items-center rounded-full shadow-[0_0.5rem_1.5rem_rgb(0_0_0/0.45)] transition duration-300 group-hover:scale-110 sm:size-16">
              <Play className="size-4.5 translate-x-[0.08em] fill-current sm:size-6" />
            </span>
            <span className="text-ivory/85 text-[0.7rem] tracking-[0.16em] uppercase">
              {playLabel}
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
