/**
 * Pieces shared between the client DoorIntro (the animated overlay) and the
 * server-rendered DoorIntroCurtain (the static first-paint cover). No hooks,
 * no "use client": both bundles may import this.
 */

/** Session flag: set once the intro has actually played in this tab. */
export const DOOR_INTRO_STORAGE_KEY = "reddoor:door-intro:v1";

/**
 * Marker the pre-paint boot script leaves on <html> when the intro should
 * play. CSS shows the static curtain while it is present; the client overlay
 * clears it once it has taken over.
 */
export const DOOR_INTRO_PENDING_ATTRIBUTE = "data-door-intro";

export function DoorTexture({ mirrored = false }: { mirrored?: boolean }) {
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
