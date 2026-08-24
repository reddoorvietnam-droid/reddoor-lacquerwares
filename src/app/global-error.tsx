"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi">
      <body>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem", background: "#3D0D10", color: "#F5F0E7", fontFamily: "system-ui, sans-serif" }}>
          <section style={{ maxWidth: "42rem" }}>
            <p style={{ color: "#C2A052", letterSpacing: "0.18em", textTransform: "uppercase", fontSize: "0.75rem" }}>Red Door · Safe error</p>
            <h1 style={{ fontFamily: "serif", fontSize: "clamp(2.5rem, 8vw, 5rem)", lineHeight: 1, fontWeight: 400 }}>Ứng dụng cần được tải lại</h1>
            <p style={{ lineHeight: 1.8, opacity: 0.78 }}>No sensitive diagnostic details were sent to this screen. Please retry the request.</p>
            <button type="button" onClick={reset} style={{ marginTop: "1.5rem", border: 0, borderRadius: "999px", padding: "0.8rem 1.4rem", background: "#C2A052", color: "#3D0D10", fontWeight: 700, cursor: "pointer" }}>
              Thử lại · Retry
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
