"use client";

import { useEffect } from "react";

/**
 * The guide keeps each screen folded. Following a table-of-contents link, or
 * landing on the page with one in the address, opens the fold it points at so
 * the reader never arrives at a closed box.
 */
export function GuideHashOpener() {
  useEffect(() => {
    const reveal = (id: string) => {
      const target = id ? document.getElementById(id) : null;
      const fold =
        target instanceof HTMLDetailsElement
          ? target
          : (target?.closest("details") ?? null);
      if (!target || !fold || fold.open) return;
      fold.open = true;
      target.scrollIntoView({ block: "start" });
    };

    reveal(decodeURIComponent(window.location.hash.slice(1)));

    const onClick = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href^="#"]')
          : null;
      if (link) reveal(decodeURIComponent(link.hash.slice(1)));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
