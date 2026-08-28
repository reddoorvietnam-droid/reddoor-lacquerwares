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
        brandName={content.company.displayName}
        title={`${dictionary.home.title} ${dictionary.home.titleAccent}`}
      />
      <PublicHeader
        locale={locale}
        dictionary={dictionary}
        brandName={content.company.displayName}
        brandDescriptor={content.company.tagline}
      />
      {children}
      <PublicFooter
        locale={locale}
        dictionary={dictionary}
        brandName={content.company.displayName}
        brandDescriptor={content.company.tagline}
        socialLinks={socialLinks}
      />
    </>
  );
}
