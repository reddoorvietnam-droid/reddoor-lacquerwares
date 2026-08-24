import type { ReactNode } from "react";

import { DoorIntro, PublicFooter, PublicHeader } from "@/components/public";
import { demoContentRepository } from "@/domains/content/demo-repository";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { notFound } from "next/navigation";

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
    demoContentRepository.getSnapshot(locale),
  ]);
  const socialLinks = content.settings.socialLinks.flatMap((link) =>
    link.href ? [{ label: link.label, href: link.href, external: true }] : [],
  );

  return (
    <>
      <DoorIntro
        brandName={content.company.displayName}
        title={`${dictionary.home.title} ${dictionary.home.titleAccent}`}
        skipLabel={dictionary.common.close}
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
