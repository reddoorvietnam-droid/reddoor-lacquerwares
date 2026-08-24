import { notFound } from "next/navigation";

import { ContactRequestQuotePage } from "@/components/public/pages";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getDemoContactRequestQuotePageData } from "@/lib/public/demo-page-data";
import { getDemoStaticPageMetadata } from "@/lib/seo/route-metadata";

type ContactRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: ContactRouteProps) {
  const { locale } = await params;
  return getDemoStaticPageMetadata(locale, "contact");
}

export default async function ContactRoute({ params }: ContactRouteProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const data = await getDemoContactRequestQuotePageData(locale, dictionary);

  return <ContactRequestQuotePage data={data} dictionary={dictionary} isDemo />;
}
