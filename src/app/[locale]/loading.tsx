export default function LocaleLoading() {
  return (
    <main
      className="min-h-screen bg-ivory px-[var(--space-page)] pt-32"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading / Đang tải</span>
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="h-3 w-28 rounded-full bg-gold/35" />
        <div className="mt-8 h-16 max-w-2xl rounded-xl bg-burgundy/10 sm:h-24" />
        <div className="mt-8 h-5 max-w-xl rounded-full bg-charcoal/10" />
        <div className="mt-3 h-5 max-w-md rounded-full bg-charcoal/10" />
        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="aspect-[4/5] rounded-2xl bg-burgundy/8" />
          ))}
        </div>
      </div>
    </main>
  );
}
