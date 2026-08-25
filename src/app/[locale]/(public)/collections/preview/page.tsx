import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FlipbookPreview } from "@/components/flipbook";
import { flipbookPreviewCopy } from "@/components/flipbook/preview-copy";
import { Container } from "@/components/ui";
import { isLocale } from "@/lib/i18n/config";

// Dynamic on purpose: `notFound()` must run per request so the production
// server answers with a genuine 404 status. Prerendering this route emitted
// the not-found body under a 200, which is the worst of both.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Development-only home of the flipbook preview tool.
 *
 * Its permanent home is the administration portal, behind the server-side
 * permission gate. This route exists so the reading experience can be reviewed
 * on a machine where MongoDB and Google OAuth are not configured yet — and it
 * is compiled out of production builds: `NODE_ENV` is fixed at build time, so
 * the production bundle prerenders this route as a 404.
 *
 * The tool uploads nothing in either home; the chosen file never leaves the
 * browser.
 */
export default async function CollectionFlipbookPreviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { locale: requestedLocale } = await params;
  if (!isLocale(requestedLocale)) notFound();

  const copy = flipbookPreviewCopy[requestedLocale === "vi" ? "vi" : "en"];

  return (
    <main id="main-content" className="bg-ivory py-16 sm:py-20 lg:py-24">
      <Container>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 className="text-burgundy mt-4 max-w-4xl font-serif text-[clamp(2.25rem,5vw,4rem)] leading-[1.02] tracking-[-0.04em]">
          {copy.title}
        </h1>
        <p className="text-charcoal/65 mt-5 max-w-2xl text-base leading-8">
          {copy.description}
        </p>
        <div className="mt-10">
          <FlipbookPreview labels={copy.labels} maxSizeMb={10} />
        </div>
      </Container>
    </main>
  );
}
