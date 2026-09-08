import { notFound } from "next/navigation";
import { requireSampleProgressAccess } from "@/domains/sample-progress/access";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { SampleProgressManager } from "@/components/admin/sample-progress-manager";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function SampleProgressPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  try {
    await requireSampleProgressAccess();
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }
  return <SampleProgressManager />;
}
