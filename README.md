# Red Door Vietnam — Lacquerware platform

Brand website and internal operations portal for Công ty TNHH Cửa Đỏ Việt Nam.

Two experiences share one data platform:

- **Public site** — a multilingual brand site at `lacquerwares.vn`, with product
  and collection storytelling and a request-a-quote flow. No online payment.
- **Operations portal** — `/admin`, for content, products, catalogues, customers,
  quotes, orders, production, inventory, suppliers, finance, documents, and
  reporting, all scoped by role.

The portal lives under a path today but is not coupled to one, so it can move to
`portal.lacquerwares.vn` later without a rewrite.

## Requirements

- Node.js 20.19 or newer (see `.nvmrc`)
- npm (the lockfile is committed; use `npm ci`)
- Optional for full functionality: MongoDB Atlas, Google OAuth, Cloudinary, Resend, Anthropic API key (AI assistant), Zalo Official Account (reminders)

## Getting started

```bash
npm ci
cp .env.example .env.local   # then fill the values in your editor
npm run dev
```

Open http://localhost:3000. You will be redirected to a locale, for example
`/vi`.

**The app runs without any external service configured.** The public site falls
back to clearly labelled `DEMO` content, and the admin portal locks itself
closed with a setup notice rather than pretending to work. Fill `.env.local`
only for the features you want to exercise.

Never commit secrets. `.env.example` documents the variable names and nothing
else; put real values in `.env.local` locally and in Vercel's environment
settings for deployments.

## Commands

| Command                           | Purpose                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`                     | Development server                                                              |
| `npm run build` / `start`         | Production build and server                                                     |
| `npm run lint`                    | ESLint, zero warnings tolerated                                                 |
| `npm run typecheck`               | TypeScript in strict mode                                                       |
| `npm run test` / `test:run`       | Vitest unit and component tests                                                 |
| `npm run test:e2e`                | Playwright end-to-end tests                                                     |
| `npm run format` / `format:check` | Prettier                                                                        |
| `npm run ci`                      | Everything CI runs: lint, typecheck, tests, build                               |
| `npm run eval:assistant`          | Assistant eval cases (mocked; `ASSISTANT_EVAL_LIVE=1` + key for the live model) |
| `npm run test:e2e:admin`          | Admin portal E2E against a running dev server (`E2E_ADMIN_BASE_URL`)            |

### Operational scripts

These connect to MongoDB and are safe to run repeatedly.

```bash
npm run seed -- --dry-run     # validate reference data, no database needed
npm run seed                  # provision the twelve system role definitions
npm run seed -- --with-demo   # also insert DEMO-labelled business units
npm run migrate -- --dry-run  # report index drift without changing anything
npm run migrate               # reconcile declared indexes with the database
npm run backup                # export collections to git-ignored NDJSON
```

`seed` never creates a user or a secret. The first administrator is bootstrapped
from `ADMIN_EMAILS` at sign-in; freeze or remove that variable once a Super Admin
exists.

## Architecture

Code is organised by business domain rather than by file type.

```text
src/
  app/[locale]/(public)/   public site routes
  app/[locale]/admin/      operations portal routes
  components/              ui, public, admin, flipbook
  domains/                 identity, approvals, orders, organization, content,
                           products, news, collections, audit
  lib/                     db, auth, i18n, seo, money, env, security
scripts/                   seed, migrate, backup
docs/                      decisions, data model, RBAC, workflow, status
tests/                     unit and e2e
```

Rules that hold throughout:

- React Server Components by default; client components only where interaction
  requires them.
- Mongoose is never called from a component. Domain services and repositories
  own persistence.
- Every mutation passes authentication, a permission check, Zod validation, and
  audit logging on the server. A hidden button is not an authorization decision.
- Money is decimal-safe. JavaScript floating point never touches an amount.

## Access model

Google sign-in proves identity; MongoDB decides access. An unknown account signs
in successfully and sees only an access-pending page.

Three rules confirmed with the company shape the defaults:

1. **Selling price, margin, and profit are visible only to the Director and the
   Company Accountant.** They are separate permissions, never implied by
   ordinary read access.
2. **Purchase price and the rest of the operational data are readable by every
   position.** The right to edit is granted separately.
3. **The Director approves everything significant** — orders, selling price,
   price changes, material purchases, incurred expenses, dispatch. A gated
   action parks as a pending request instead of taking effect, and the person
   who raised a request can never be the one who releases it.

See `docs/RBAC.md` for the permission matrix and `docs/ORGANIZATION.md` for how
positions map to roles.

## AI assistant, tasks and reminders

The portal has an in-house assistant (`/admin/assistant`) that answers only
from tools guarded by the same permissions as the screens, drafts order plans
and to-dos as proposals a person approves, and a work-item list (`/admin/tasks`)
with email/Zalo reminders driven by an idempotent job. See
`docs/AI_ASSISTANT.md` for the design, permission matrix, runbook and evidence.

## Order process

Sales orders follow the company's fifteen-step process, encoded as a state
machine in `src/domains/orders/workflow.ts`: customer order, order file opened,
Director approval, production planning, inventory check, material issue or
purchase, production, cost tracking, quality control, packing, trade
documentation, loading schedule, shipment, invoice and incoming cash, and the
final cost and profit report before the order closes.

Holding a permission never authorises a transition on its own — the process
guard runs as well, and it refuses invalid jumps, missing approvals, packing
before quality control passes, and cancellation or rework without a reason. See
`docs/ORDER_WORKFLOW.md`.

## Status

`docs/IMPLEMENTATION_STATUS.md` is the source of truth for what is built, what
is a labelled placeholder, and what is not started. A dependency being installed
or a screen being rendered with demo data does not mean the capability exists;
that document says so plainly, and it is kept honest.

## Brand assets

The registered mark is `public/logo_rd.jpg`. Replacing that file is the only step
needed to change it — no other path references it. Photography, video, catalogue
PDFs, and approved company copy are still outstanding content dependencies; every
placeholder in the app is labelled rather than invented.

## Deployment

See `docs/DEPLOYMENT.md` for MongoDB Atlas, Cloudinary, Google OAuth, Resend,
Vercel, and DNS setup.
