import { notFound } from "next/navigation";

import { submitQuoteRequestAction } from "@/app/[locale]/(public)/contact/actions";
import { ContactRequestQuotePage } from "@/components/public/pages";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getDemoContactRequestQuotePageData } from "@/lib/public/demo-page-data";
import { getDemoStaticPageMetadata } from "@/lib/seo/route-metadata";

type ContactRouteProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ product?: string | string[] }>;
};

export async function generateMetadata({ params }: ContactRouteProps) {
  const { locale } = await params;
  return getDemoStaticPageMetadata(locale, "contact");
}

export default async function ContactRoute({
  params,
  searchParams,
}: ContactRouteProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const data = await getDemoContactRequestQuotePageData(locale, dictionary);
  // A product page's "request a quote" button lands here with its id, so
  // the form opens with that piece already on the list.
  const requested = Array.isArray(query.product)
    ? query.product
    : query.product
      ? [query.product]
      : [];
  const known = new Set(data.productOptions.map((option) => option.id));
  const preselectedProductIds = requested.filter((id) => known.has(id));

  return (
    <ContactRequestQuotePage
      data={data}
      dictionary={dictionary}
      isDemo={data.contentIsDemo}
      preselectedProductIds={preselectedProductIds}
      submitQuoteRequest={submitQuoteRequestAction}
    />
  );
}
