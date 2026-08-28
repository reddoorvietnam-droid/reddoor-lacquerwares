import {
  DOOR_INTRO_PENDING_ATTRIBUTE,
  DOOR_INTRO_STORAGE_KEY,
  DoorTexture,
} from "./door-intro-shared";

/*
 * Runs synchronously during HTML parsing, before the first paint: decides
 * whether the intro should play and stamps <html data-door-intro="pending">.
 * The decision must live here, not in React — the client overlay only exists
 * after hydration, and waiting for it is exactly the flash of bare page this
 * curtain removes. Storage errors count as "show": replaying the intro beats
 * never showing it.
 */
const bootScript = `(function () {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      if (window.sessionStorage.getItem(${JSON.stringify(DOOR_INTRO_STORAGE_KEY)})) return;
    } catch (error) {}
    document.documentElement.setAttribute(${JSON.stringify(DOOR_INTRO_PENDING_ATTRIBUTE)}, "pending");
  } catch (error) {}
})();`;

/**
 * The closed doors, server-rendered so they cover the page from the very
 * first frame — no waiting for JavaScript. Hidden by default; the boot script
 * above reveals it (via the html attribute) for visitors who get the intro,
 * and the client DoorIntro removes the attribute once its animated overlay
 * has mounted on top. A CSS fallback in globals.css fades this cover away on
 * its own if hydration never happens, so the page can never stay blocked.
 *
 * The markup mirrors the client overlay's first frame exactly (doors shut,
 * no plaque — the plaque fades in from zero), making the hand-off invisible.
 */
export function DoorIntroCurtain() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      <div
        id="door-intro-static"
        className="fixed inset-0 isolate z-[99] overflow-hidden"
        aria-hidden="true"
      >
        <div className="bg-burgundy absolute inset-y-0 left-0 w-[50.5%] border-r border-white/10 shadow-[1rem_0_4rem_rgb(27_7_8/0.35)]">
          <DoorTexture />
        </div>
        <div className="bg-burgundy absolute inset-y-0 right-0 w-[50.5%] border-l border-white/10 shadow-[-1rem_0_4rem_rgb(27_7_8/0.35)]">
          <DoorTexture mirrored />
        </div>
      </div>
    </>
  );
}
