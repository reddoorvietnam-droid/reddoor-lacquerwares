import type { ReactNode } from "react";

import {
  DoorIntro,
  DoorIntroCurtain,
  PublicFooter,
  PublicHeader,
} from "@/components/public";
import { BRAND_COPY, BRAND_DISPLAY_NAME } from "@/domains/content/brand-copy";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { notFound } from "next/navigation";
import { getPublicContentRepository } from "@/lib/public/repositories";

const contentRepository = getPublicContentRepository();

type PublicLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function PublicLayout({
  children,
  params,
}: PublicLayoutProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const [dictionary, content] = await Promise.all([
    getDictionary(locale),
    contentRepository.getSnapshot(locale),
  ]);
  // The wordmark's name and descriptor are brand signage, deliberately not
  // read from the CMS/MongoDB snapshot. The descriptor follows the locale so
  // the header and footer of an English or French page do not lead with
  // Vietnamese.
  const brandDescriptor = BRAND_COPY[locale].tagline;
  const contact = content.settings.contact;
  const addressLines = contact.address ? [contact.address] : [];
  const contactLinks = [
    ...(contact.email
      ? [{ label: contact.email, href: `mailto:${contact.email}` }]
      : []),
    ...(contact.phone
      ? [
          {
            label: contact.phone,
            href: `tel:${contact.phone.replace(/\s+/g, "")}`,
          },
        ]
      : []),
  ];
  const socialLinks = content.settings.socialLinks.flatMap((link) =>
    link.href ? [{ label: link.label, href: link.href, external: true }] : [],
  );

  return (
    <>
      {/*
        The curtain paints closed doors in the server HTML itself, so the
        intro covers the page from the first frame; the client DoorIntro
        then takes over and animates. Order matters: curtain first, so its
        boot script has stamped the html attribute before anything paints.
      */}
      <DoorIntroCurtain />
      <DoorIntro
        brandName={BRAND_DISPLAY_NAME}
        title={`${dictionary.home.title} ${dictionary.home.titleAccent}`}
      />
      <PublicHeader
        locale={locale}
        dictionary={dictionary}
        brandName={BRAND_DISPLAY_NAME}
        brandDescriptor={brandDescriptor}
      />
      {children}
      <PublicFooter
        locale={locale}
        dictionary={dictionary}
        brandName={BRAND_DISPLAY_NAME}
        brandDescriptor={brandDescriptor}
        addressLines={addressLines}
        contactLinks={contactLinks}
        socialLinks={socialLinks}
      />
    </>
  );
}
