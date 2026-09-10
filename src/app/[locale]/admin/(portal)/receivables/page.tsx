import { notFound } from "next/navigation";
import { ReceivablesWorkspace } from "@/components/admin/receivables/receivables-workspace";
import { requireReceivablesAccess } from "@/domains/receivables/access";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

/** Công nợ: one screen, four tabs (?tab=summary|sales|reductions|history). */
export default async function ReceivablesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  if (!isLocale((await params).locale)) notFound();
  try {
    await requireReceivablesAccess("read");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }
  return <ReceivablesWorkspace />;
}
