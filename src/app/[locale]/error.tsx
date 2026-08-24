"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";

import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";

const copy: Record<Locale, { eyebrow: string; title: string; body: string; retry: string; home: string }> = {
  vi: { eyebrow: "Có lỗi xảy ra", title: "Trang chưa thể hiển thị", body: "Vui lòng thử lại. Nếu lỗi tiếp diễn, đội ngũ vận hành sẽ kiểm tra nhật ký an toàn.", retry: "Thử lại", home: "Về trang chủ" },
  en: { eyebrow: "Something went wrong", title: "This page cannot be displayed", body: "Please try again. If the issue continues, the operations team can inspect the safe error log.", retry: "Try again", home: "Return home" },
  fr: { eyebrow: "Une erreur est survenue", title: "Cette page ne peut pas s’afficher", body: "Veuillez réessayer. Si le problème persiste, l’équipe pourra consulter le journal sécurisé.", retry: "Réessayer", home: "Retour à l’accueil" },
  de: { eyebrow: "Ein Fehler ist aufgetreten", title: "Diese Seite kann nicht angezeigt werden", body: "Bitte versuchen Sie es erneut. Bei erneutem Auftreten kann das Team das sichere Fehlerprotokoll prüfen.", retry: "Erneut versuchen", home: "Zur Startseite" },
  ja: { eyebrow: "エラーが発生しました", title: "ページを表示できません", body: "もう一度お試しください。問題が続く場合は、安全なエラーログを確認します。", retry: "再試行", home: "ホームへ戻る" },
  "zh-CN": { eyebrow: "发生错误", title: "暂时无法显示此页面", body: "请重试。如果问题持续，运营团队将检查安全错误日志。", retry: "重试", home: "返回首页" },
};

export default function LocaleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);

  useEffect(() => {
    const documentLocale = document.documentElement.lang;
    if (isLocale(documentLocale)) setLocale(documentLocale);
  }, []);

  const text = copy[locale];

  return (
    <main className="brand-surface flex min-h-screen items-center px-6 py-24">
      <section className="mx-auto w-full max-w-3xl rounded-[var(--radius-display)] border bg-[var(--surface-raised)] p-8 shadow-[var(--shadow-soft)] sm:p-14">
        <p className="eyebrow">{text.eyebrow}</p>
        <h1 className="mt-5 font-serif text-4xl text-burgundy sm:text-6xl">{text.title}</h1>
        <p className="mt-6 max-w-xl leading-8 text-charcoal/70">{text.body}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="rounded-full bg-lacquer px-6 py-3 text-sm font-semibold text-ivory transition hover:bg-burgundy">
            {text.retry}
          </button>
          <Link href={`/${locale}` as Route} className="rounded-full border border-burgundy/20 px-6 py-3 text-sm font-semibold text-burgundy transition hover:bg-burgundy/5">
            {text.home}
          </Link>
        </div>
      </section>
    </main>
  );
}
