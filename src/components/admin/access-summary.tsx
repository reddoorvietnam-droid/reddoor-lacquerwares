import "server-only";

import { mongoIdentityRepository } from "@/domains/identity/mongo-repository";
import {
  roleDefinitionSeeds,
  type SystemRoleKey,
} from "@/domains/identity/role-definitions";
import { resolveSessionIdentity } from "@/lib/auth/session";
import type { AdminLocale } from "@/lib/i18n/admin";

/**
 * Shows the signed-in account exactly what the authorization store says about
 * it: which roles are granted and how many permissions each carries. This is
 * the working group's window into the RBAC data while the grant-administration
 * screens are still unbuilt — it renders the same snapshot the permission
 * guard evaluates, so what it shows is what the guard enforces.
 */

const copy = {
  vi: {
    title: "Quyền truy cập của phiên này",
    status: "Trạng thái tài khoản",
    permissions: "quyền",
    empty: "Tài khoản chưa được cấp vai trò nào.",
    scopeAll: "phạm vi toàn hệ thống",
    scopeUnit: "theo đơn vị",
  },
  en: {
    title: "This session's access",
    status: "Account status",
    permissions: "permissions",
    empty: "No role has been granted to this account.",
    scopeAll: "global scope",
    scopeUnit: "per business unit",
  },
} as const satisfies Record<AdminLocale, Record<string, string>>;

function roleLabel(key: string, locale: AdminLocale): string {
  const seed = roleDefinitionSeeds.find((entry) => entry.key === key);
  return seed ? seed.labels[locale] : key;
}

function roleSummary(key: string, locale: AdminLocale): string | null {
  const seed = roleDefinitionSeeds.find(
    (entry) => entry.key === (key as SystemRoleKey),
  );
  return seed ? seed.summary[locale] : null;
}

export async function AccessSummary({ locale }: { locale: AdminLocale }) {
  const resolution = await resolveSessionIdentity();
  if (!resolution.configured || !resolution.identity) return null;

  const snapshot = await mongoIdentityRepository.findSnapshotByUserId(
    resolution.identity.userId,
  );
  if (!snapshot) return null;

  const text = copy[locale];
  const roleByKey = new Map(snapshot.roles.map((role) => [role.key, role]));

  return (
    <section className="border-burgundy/15 mt-10 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-burgundy font-serif text-2xl">{text.title}</h2>
        <p className="text-charcoal/55 text-xs tracking-[0.08em] uppercase">
          {text.status}:{" "}
          <span className="text-charcoal font-semibold">
            {snapshot.user.status}
          </span>
        </p>
      </div>

      {snapshot.grants.length === 0 ? (
        <p className="text-charcoal/60 mt-4 text-sm">{text.empty}</p>
      ) : (
        <ul className="divide-burgundy/10 mt-5 divide-y">
          {snapshot.grants.map((grant) => {
            const role = roleByKey.get(grant.roleKey);
            const summary = roleSummary(grant.roleKey, locale);
            return (
              <li key={grant.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="text-burgundy font-serif text-lg">
                    {roleLabel(grant.roleKey, locale)}
                  </span>
                  <span className="text-charcoal/45 font-mono text-xs">
                    {grant.roleKey}
                  </span>
                  <span className="text-gold-ink text-xs font-semibold">
                    {role ? role.permissions.length : 0} {text.permissions}
                  </span>
                  <span className="text-charcoal/50 text-xs">
                    {grant.businessUnitId ? text.scopeUnit : text.scopeAll}
                  </span>
                </div>
                {summary ? (
                  <p className="text-charcoal/60 mt-1.5 max-w-2xl text-sm leading-6">
                    {summary}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
