# Danh sách nhân sự (staff directory) and Gmail sign-in

Director-only screen at `/[locale]/admin/staff`. A person signs in with Google,
waits, and the Director approves them with a role. Agreed with the client on
2026-09-13; the same day the one-click role preview ("Vào thẳng theo vai trò")
was removed, so Google is the only way in.

## Signing in

- `src/lib/auth/config.ts` has a single provider, Google, with
  `prompt=select_account` so a shared browser still lets people pick the work
  Gmail. next-auth's own pages point at `/vi/admin/sign-in`, which shows
  `?error=AccessDenied|Configuration|…` on the card.
- Required env (`src/lib/env/server.ts`): `AUTH_SECRET` (32+ chars),
  `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`; without them auth is unconfigured and
  the portal shows the setup screen, which prints the exact redirect URI
  `<NEXT_PUBLIC_SITE_URL>/api/auth/callback/google` to register on Google.
- `ADMIN_EMAILS` holds the Director's Gmail. Its first sign-in runs
  `tryBootstrapInitialDirector` and becomes the Director; everyone else is
  `pending`.
- A signed-in visitor to the sign-in page is sent to `/admin`. Every signed-in
  screen shows **Đăng xuất** (and the person's name from tablet width); the
  waiting and locked screens also show which Gmail is in use.
- A sign-in refused because the Google profile is unverified comes back as
  `?error=AccessDenied`; one that failed on the server (database down, identity
  conflict, bootstrap error) as `?error=Unavailable`, so nobody is told to fix a
  Gmail that is fine.
- `/admin` is a welcome page per role (`src/components/admin/admin-welcome*.tsx`):
  greeting, name, role, one line about that role's work, and shortcut cards read
  from the same filtered navigation as the sidebar
  (`src/components/admin/admin-nav-access.ts`). The Director's staff card shows
  how many accounts are waiting.

## Agreed staff rules

- **Gmail only.** No phone login, no SMS or Zalo OTP, no passwords.
- **One role per person, and a role is all there is** — no per-screen toggles.
- **One Director.** `DIRECTOR` is not in the picker. A Director account and the
  actor's own account offer no action and are refused on the server.
- **Từ chối** deletes the pending account and its grants. Signing in again
  queues the person again; it is not a block.
- **Khoá** sets `suspended` and keeps the role; **Mở khoá** restores it.
- **Đổi role** replaces the grant. No notification is sent: the Director checks
  the page.

| Tab           | Status      | Actions                    |
| ------------- | ----------- | -------------------------- |
| Chờ duyệt     | `pending`   | Duyệt (with role), Từ chối |
| Đang làm việc | `active`    | Lưu role, Khoá             |
| Đã khoá       | `suspended` | Mở khoá                    |

## Internal test accounts

Addresses on `dev-preview.reddoor.local` (the retired role preview) and
`e2e.reddoor.local` (admin E2E role sessions) are internal: `.local` is a
reserved domain no Google sign-in can carry. `staff-policy.ts` hides and
protects them, and the Director bootstrap ignores them when checking whether a
Director already exists — so test Directors never block the real one.

`npm run seed` locks every `dev-preview` account and revokes its grants
(`retireRolePreviewAccounts`); the documents stay because tasks, reports and
audit events still name them.

## Files

- `src/domains/identity/staff-policy.ts` — the rules, database-free
  (`tests/unit/staff-policy.test.ts`).
- `src/domains/identity/staff-directory.ts` — list, pending count and
  `runStaffCommand`: one transaction that re-reads the account, runs the policy,
  rewrites grants (`keepOnlyRole`: revoke the others, revive or create one
  global grant), and updates the user on `{status, authzVersion}` so a stale
  page gets `REVISION_CONFLICT`. Writes a `users.<command>` audit event in the
  same transaction.
- `src/app/[locale]/admin/(portal)/staff/{page.tsx,actions.ts}` — server-rendered
  table; destructive actions use an inline `<details>` confirmation.

## Permissions

Page and menu entry: `users.manageRoles`. Approve: `users.activate` +
`users.manageRoles`; reject/unlock: `users.activate`; change role:
`users.manageRoles`; lock: `users.suspend`. All three are in
`globallyScopedPermissions`, so only a global grant satisfies them. Only the
Director holds them.

## How access follows

Every command bumps `authzVersion`. The next-auth JWT callback re-reads status
and `authzVersion` on each request, so approval, a new role, a lock or an unlock
applies on the person's next page load without signing out. A rejected account
no longer exists, so its old cookie resolves to no session and the portal sends
the person to sign-in.

## Verification

The admin E2E suite (`playwright.admin.config.ts`) has no role buttons to press.
`tests/e2e-admin/role-sessions.ts` runs as the global setup: it activates one
`<role>@e2e.reddoor.local` account per role with a single global grant and mints
the session cookie a Google sign-in would leave (signed with `AUTH_SECRET`,
written to the git-ignored `.e2e-auth/`). The teardown locks those accounts and
bumps `authzVersion`, voiding the cookies. `signInAs(page, role)` in
`tests/e2e-admin/helpers.ts` sets that cookie.

- `staff.spec.ts` seeds two pending accounts with `staff-fixture.ts` and walks
  approve, change role, stale-page conflict, lock, unlock and reject from both
  sides.
- `welcome.spec.ts` checks each role's welcome page, the sign-out, the
  signed-in redirect away from sign-in, and the sign-in error message.
