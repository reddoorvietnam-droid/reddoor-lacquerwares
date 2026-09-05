import type { ReactNode } from "react";

import {
  DoorIntro,
  DoorIntroCurtain,
  PublicFooter,
  PublicHeader,
} from "@/components/public";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { notFound } from "next/navigation";
import { getPublicContentRepository } from "@/lib/public/repositories";

const contentRepository = getPublicContentRepository();

// Hardcoded brand text — intentionally not read from the CMS/MongoDB snapshot.
const BRAND_NAME = "RED DOOR VIET NAM";
const BRAND_DESCRIPTOR = "Nghệ thuật sơn mài Việt Nam";

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
            href: `tel:${contact.phone.replace(/s+/g, "")}`,
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
        brandName={BRAND_NAME}
        title={`${dictionary.home.title} ${dictionary.home.titleAccent}`}
      />
      <PublicHeader
        locale={locale}
        dictionary={dictionary}
        brandName={BRAND_NAME}
        brandDescriptor={BRAND_DESCRIPTOR}
      />
      {children}
      <PublicFooter
        locale={locale}
        dictionary={dictionary}
        brandName={BRAND_NAME}
        brandDescriptor={BRAND_DESCRIPTOR}
        addressLines={addressLines}
        contactLinks={contactLinks}
        socialLinks={socialLinks}
      />
    </>
  );
}
