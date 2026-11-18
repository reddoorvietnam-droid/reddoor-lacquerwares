import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SoTayApp } from "@/components/admin/so-tay/so-tay-app";
import { ghiVaoSo, nguoiSoTay } from "@/domains/so-tay/truy-cap";
import { isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sổ tay Red Door",
  robots: { index: false, follow: false },
};

/** Sổ tay: sổ chung quản lý sản xuất, chỉ người trong công ty. */
export default async function SoTayPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  if (!isLocale((await params).locale)) notFound();
  const nguoi = await nguoiSoTay();
  if (!nguoi) notFound();
  await ghiVaoSo(nguoi);
  return <SoTayApp nguoi={nguoi} />;
}
