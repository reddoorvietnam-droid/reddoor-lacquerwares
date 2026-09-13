import { SignOutButton } from "@/components/admin/sign-out-button";
import type { AccessDenialCode } from "@/lib/auth/authorization";
import type { AdminLocale } from "@/lib/i18n/admin";
import { getAdminDictionary } from "@/lib/i18n/admin";

type VisibleAccessState = Exclude<
  AccessDenialCode,
  "AUTH_NOT_CONFIGURED" | "UNAUTHENTICATED" | "USER_NOT_FOUND"
>;

export function AdminAccessState({
  locale,
  code,
  email = null,
}: {
  locale: AdminLocale;
  code: VisibleAccessState | "USER_NOT_FOUND";
  /** The Gmail this session signed in with, so a wrong account is obvious. */
  email?: string | null;
}) {
  const copy = getAdminDictionary(locale).auth;
  const content =
    code === "USER_PENDING"
      ? { title: copy.pendingTitle, description: copy.pendingDescription }
      : code === "USER_SUSPENDED"
        ? { title: copy.suspendedTitle, description: copy.suspendedDescription }
        : code === "STALE_SESSION"
          ? { title: copy.staleTitle, description: copy.staleDescription }
          : code === "AUTHORIZATION_UNAVAILABLE"
            ? {
                title: copy.unavailableTitle,
                description: copy.unavailableDescription,
              }
            : { title: copy.deniedTitle, description: copy.deniedDescription };

  return (
    <section className="border-burgundy/15 mx-auto max-w-2xl rounded-[2rem] border bg-white p-8 text-center shadow-[var(--shadow-soft)] md:p-12">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 className="text-burgundy mt-4 font-serif text-4xl tracking-[-0.035em]">
        {content.title}
      </h1>
      <p className="text-charcoal/65 mx-auto mt-5 max-w-xl text-base leading-7">
        {content.description}
      </p>
      {email && (code === "USER_PENDING" || code === "USER_SUSPENDED") ? (
        <p className="text-charcoal/55 mt-6 text-sm">
          {copy.signedInAs}{" "}
          <span className="text-charcoal font-semibold break-all">{email}</span>
        </p>
      ) : null}
      {code === "STALE_SESSION" || code === "USER_NOT_FOUND" ? (
        <SignOutButton
          locale={locale}
          variant="solid"
          label={copy.signInAgain}
        />
      ) : null}
    </section>
  );
}
