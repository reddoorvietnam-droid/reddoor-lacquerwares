"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

import type { AdminLocale } from "@/lib/i18n/admin";

/**
 * One-click role preview, rendered only while `DEV_LOGIN_PASSWORD` is set.
 *
 * Each row signs straight in as that role — no form, because the env flag is
 * the gate and the accounts exist only to show the portal through each
 * role's eyes. Account rows come from the server as plain data so this
 * client bundle does not import the role-definition module, and the copy
 * lives here rather than in the admin dictionary because the whole surface
 * disappears the moment the flag is unset.
 */

export type DevPreviewAccountRow = {
  username: string;
  label: string;
  summary: string;
};

const copy = {
  vi: {
    eyebrow: "Chỉ dùng khi phát triển",
    title: "Vào thẳng theo vai trò",
    description:
      "Chọn một vai trò để mở cổng quản trị đúng như vai trò đó thấy. Phiên đăng nhập, quyền hạn và nhật ký đều là thật.",
    failed: "Không đăng nhập được — kiểm tra kết nối MongoDB rồi thử lại.",
    entering: "Đang vào…",
  },
  en: {
    eyebrow: "Development only",
    title: "Enter as a role",
    description:
      "Pick a role to open the admin portal exactly as that role sees it. The session, permissions, and audit trail are real.",
    failed: "Sign-in failed — check the MongoDB connection and try again.",
    entering: "Entering…",
  },
} as const satisfies Record<AdminLocale, Record<string, string>>;

export function DevSignIn({
  locale,
  accounts,
}: {
  locale: AdminLocale;
  accounts: readonly DevPreviewAccountRow[];
}) {
  const text = copy[locale];
  const router = useRouter();
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function enterAs(username: string) {
    setPendingUsername(username);
    setFailed(false);

    const result = await signIn("dev-preview", { username, redirect: false });

    if (result?.ok) {
      router.push(`/${locale}/admin`);
      router.refresh();
      return;
    }

    setFailed(true);
    setPendingUsername(null);
  }

  return (
    <section className="border-gold/45 bg-ivory mx-auto mt-8 max-w-2xl rounded-[2rem] border border-dashed p-8 md:p-10">
      <p className="text-gold-ink text-[0.68rem] font-semibold tracking-[0.22em] uppercase">
        {text.eyebrow}
      </p>
      <h2 className="text-burgundy mt-3 font-serif text-3xl tracking-[-0.02em]">
        {text.title}
      </h2>
      <p className="text-charcoal/65 mt-3 text-sm leading-6">
        {text.description}
      </p>

      {failed ? (
        <p role="alert" className="text-lacquer mt-4 text-sm">
          {text.failed}
        </p>
      ) : null}

      <ul className="divide-burgundy/10 border-burgundy/15 mt-6 divide-y rounded-xl border bg-white">
        {accounts.map((account) => {
          const pending = pendingUsername === account.username;
          return (
            <li key={account.username}>
              <button
                type="button"
                disabled={pendingUsername !== null}
                onClick={() => void enterAs(account.username)}
                className="hover:bg-ivory/60 group flex w-full flex-col gap-1 px-4 py-3 text-left disabled:opacity-50 sm:flex-row sm:items-baseline sm:gap-4"
              >
                <span className="text-burgundy group-hover:text-lacquer w-44 shrink-0 text-sm font-semibold">
                  {pending ? text.entering : account.label}
                </span>
                <span className="text-charcoal/45 w-40 shrink-0 font-mono text-xs">
                  {account.username}
                </span>
                <span className="text-charcoal/55 text-xs leading-5">
                  {account.summary}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
