"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { localeConfig } from "@/lib/i18n/config";

import { localeFromPathname, stateCopy } from "./[locale]/state-copy";

function subscribeToPathname(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

function getPathnameSnapshot() {
  return window.location.pathname;
}

export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const pathname = useSyncExternalStore(
    subscribeToPathname,
    getPathnameSnapshot,
    () => "/vi",
  );
  const locale = localeFromPathname(pathname);
  const text = stateCopy[locale].globalError;
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <html lang={locale} dir={localeConfig[locale].direction}>
      <title>{text.documentTitle}</title>
      <body>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "2rem",
            background: "#3D0D10",
            color: "#F5F0E7",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <section
            aria-labelledby="global-error-title"
            role="alert"
            style={{ maxWidth: "42rem" }}
          >
            <p
              style={{
                color: "#C2A052",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontSize: "0.75rem",
              }}
            >
              {text.eyebrow}
            </p>
            <h1
              ref={headingRef}
              id="global-error-title"
              tabIndex={-1}
              style={{
                fontFamily: "serif",
                fontSize: "clamp(2.5rem, 8vw, 5rem)",
                lineHeight: 1,
                fontWeight: 400,
                outline: "none",
              }}
            >
              {text.title}
            </h1>
            <p style={{ lineHeight: 1.8, opacity: 0.78 }}>{text.body}</p>
            <button
              type="button"
              onClick={retry}
              style={{
                marginTop: "1.5rem",
                border: 0,
                borderRadius: "999px",
                padding: "0.8rem 1.4rem",
                background: "#C2A052",
                color: "#3D0D10",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {text.retry}
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
