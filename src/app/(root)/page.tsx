import type { Route } from "next";
import { redirect } from "next/navigation";

import { defaultLocale } from "@/lib/i18n/config";

export default function RootPage(): never {
  redirect(`/${defaultLocale}` as Route);
}
