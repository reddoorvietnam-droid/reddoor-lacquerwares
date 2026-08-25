import { notFound } from "next/navigation";

import { AdminAccessState } from "@/components/admin";
import { FlipbookPreview } from "@/components/flipbook";
import { flipbookPreviewCopy } from "@/components/flipbook/preview-copy";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";
import { resolveLeafContentAccess } from "@/app/[locale]/admin/(portal)/content/access";

export const dynamic = "force-dynamic";

/**
 * Flipbook preview inside the administration portal.
 *
 * The layout gate is not enough on its own: the App Router renders a page in
 * parallel with its layout, so a page that skips its own check still ships its
 * markup in the payload even when the layout shows a lock screen. The leaf
 * therefore re-resolves access itself, exactly like the content pages.
 *
 * `content.update` is the same permission the upload-signature endpoint
 * demands, so whoever can open this tool is whoever could complete a real
 * upload. The preview itself still uploads nothing — the chosen file is read
 * entirely in the administrator's browser.
 */
export default async function AdminFlipbookPreviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: requestedLocale } = await params;
  if (!isLocale(requestedLocale)) notFound();

  const locale = resolveAdminLocale(requestedLocale);
  const access = await resolveLeafContentAccess("content.update");

  if (!access.allowed) {
    // Setup and sign-in states are the layout's to present; every other denial
    // renders the standard access message. Nothing of the tool is emitted.
    if (
      access.code === "LAYOUT_HANDLES_SETUP" ||
      access.code === "UNAUTHENTICATED" ||
      access.code === "AUTH_NOT_CONFIGURED"
    ) {
      return null;
    }
    return <AdminAccessState locale={locale} code={access.code} />;
  }

  const copy = flipbookPreviewCopy[locale];

  return (
    <div>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 className="text-burgundy mt-3 max-w-4xl font-serif text-5xl tracking-[-0.045em] md:text-6xl">
        {copy.title}
      </h1>
      <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
        {copy.description}
      </p>
      <div className="mt-10">
        <FlipbookPreview labels={copy.labels} maxSizeMb={10} />
      </div>
    </div>
  );
}
