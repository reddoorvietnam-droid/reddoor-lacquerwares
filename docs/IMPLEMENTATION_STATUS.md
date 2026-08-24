# Implementation Status

Last updated: 2026-08-24

This document is the source of truth for implementation progress against the Red Door / Lacquerwares master prompt. A dependency being installed, a route being scaffolded, or a UI being rendered with placeholder data does **not** mean the related business capability is implemented.

## Status vocabulary

| Label                     | Meaning                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Implemented**           | Present in the repository and verified against the stated acceptance gate.                                                                            |
| **In progress**           | Work exists or is actively being added, but the phase gate has not passed.                                                                            |
| **Planned**               | Required by the master prompt but not implemented yet.                                                                                                |
| **Demo**                  | Placeholder content or an in-memory/typed fixture used to develop UI; it is not production data, persistence, authorization, or a completed workflow. |
| **Blocked: manual setup** | Code can continue, but final integration requires an account, secret, DNS change, verified sender/domain, or other action outside the repository.     |

## Current repository snapshot

### Implemented or present

- A Next.js App Router scaffold exists under `src/app`.
- TypeScript strict mode is enabled.
- The package manifest and lockfile exist, and the initial runtime/development dependency set is installed.
- Initial dependencies for the planned domains are declared, including Mongoose, Cloudinary, Auth.js/NextAuth, Resend/React Email, Zod, React Hook Form, TanStack Table, Recharts, Motion, `page-flip`, decimal-safe money support, Vitest, and Playwright.

### In progress

- Phase 1 public UI and typed demo repository implementation.

### Demo or placeholder only

- The current branded foundation page and stock scaffold assets are development placeholders. They are not the approved Red Door public UI, brand content, product catalogue, CMS data, or production assets.
- No placeholder or fixture currently constitutes a persisted business workflow.

### Not yet implemented

- Database models/repositories, Cloudinary uploads, authentication, RBAC, audit logging, CMS publishing, i18n, SEO, flipbook processing/viewing, quote/order flows, inventory, production, finance, documents, reports, notifications, and deployment integration.
- Phase 0 has passed its acceptance gate; Phases 1–8 remain incomplete.

## Phase and requirement matrix

| Phase                                       | Status          | Implemented now                                                                                  | Planned/remaining requirements                                                                                                                                                                                                                                                                                                                                                                                                                                     | Acceptance gate before marking complete                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **0 — Discovery and foundation**            | **Implemented** | Next.js 16 App Router scaffold; strict TypeScript; pinned manifest/lockfile; Tailwind 4 design tokens; branded base layout; lazy typed env validation; Mongoose connection cache; Vitest/Playwright/Prettier/ESLint; GitHub Actions CI; `.env.example`; architecture, data, RBAC, status, decision, and deployment documents. | Operational seed/migration/backup logic belongs to later domain phases; external integrations remain intentionally unconfigured. | `lint`, `typecheck`, two foundation unit tests, and production `build` passed on 2026-08-24 without production secrets. CI uses `npm ci` and the same quality gates. |
| **1 — Public UI prototype**                 | **In progress** | Branded tokens and a responsive foundation surface only.                                         | Build complete responsive public UI for Home, navigation/footer, About/History, Products, collection preview, Lacquer Process, News, Contact/Request Quote, Search/policy pages, and loading/error/not-found states. Use typed repositories and clearly labelled demo data. Add branded motion, video/poster fallback, first-session door intro, and reduced-motion behavior.                                                                                      | Main flows work with keyboard and visible focus at 360, 390, 768, 1024, 1440 px and wide screens; no unintended horizontal overflow; WCAG AA checks for core flows; no fabricated company claims; all demo content is explicitly labelled/replaceable.                                                                                           |
| **2 — i18n, SEO, and content data**         | **Pending**     | None.                                                                                            | Locale routes for `vi`, `en`, `fr`, `de`, `ja`, `zh-CN`; typed UI dictionaries and translated dynamic content/status; canonical/hreflang/OG/Twitter metadata; sitemaps, robots, JSON-LD; MongoDB models/repositories for content, products, news, collections, and settings; structured/sanitized CMS; protected preview; draft/review/publish and revalidation.                                                                                                   | All six locale routes resolve correctly; language switching preserves context where a published translation exists; empty/unreviewed translations are not indexed; public SEO outputs contain only canonical published 200 URLs; CMS publish updates public content through controlled revalidation.                                             |
| **3 — Cloudinary and Flipbook**             | **Pending**     | Dependency declarations only; no integration.                                                    | Signed browser-to-Cloudinary image/PDF upload; configurable PDF validation (10 MB default); collection/version/page/hotspot records; PDF page/thumbnail delivery; desktop two-page and mobile one-page viewers; sequential/reduced-motion fallback; lazy page loading; deep links; keyboard controls; admin reorder/hotspot editor/preview/approval/publish/rollback.                                                                                              | No API secret reaches the client and PDF binary is not proxied through Vercel; create/upload/derive/preview/review/approve/publish flow works; replacing a PDF creates an immutable version; rollback works; desktop/mobile/fallback viewers work, lazy-load pages, and expose accessible hotspots/controls.                                     |
| **4 — Authentication and RBAC**             | **Pending**     | Dependency declaration only; no authentication or authorization.                                 | Google-only Auth.js login; invite/pending/suspended lifecycle; one-time `ADMIN_EMAILS` bootstrap; standard roles; action/resource/scope permissions; multi-role and per-business-unit assignment; shared server policy layer; append-only/redacted audit logs; role-scoped dashboards.                                                                                                                                                                             | Every protected read/mutation enforces session, permission, and scope server-side; an uninvited user sees Access Pending; suspended users are denied; cross-business-unit denial is tested; login/logout/failed authorization/role changes/suspension are audited.                                                                               |
| **5 — Product, customer, quote, and order** | **Pending**     | None.                                                                                            | Product/variant/custom specification and immutable order-item snapshots; localized media/SEO and lifecycle/versioning; separate sample-order revision workflow; customer history; public quote request with bot/rate/idempotency controls; atomic quote/request numbers; quote versions/PDF/email/approval; quote-to-order conversion; validated sales-order transitions; repeated delivery/payment stages; reservations, cancellation release, and late warnings. | Product changes cannot mutate prior order snapshots; sample and quote revisions remain retrievable; request quote saves to MongoDB before email and uses retryable outbox; price adjustments require permission/approval; order transitions are tested; cancellation preserves history, records reason, and releases reservations.               |
| **6 — Supplier, inventory, and production** | **Pending**     | None.                                                                                            | Supplier/contact/contract/purchase data and approval; material/BOM; warehouse/location; immutable stock movements; reservation/release/transfer/adjustment/stocktake; demand/shortage projection; previewed/audited Excel import; production plans/work orders across units/sub-workshops; labor/material issue/use/return; progress/blockers; QC/defect/rework evidence.                                                                                          | Atomic operations prevent double reservation and negative stock by default; balances derive from movements rather than direct edits; serious import errors do not partially write; supply/production lateness is surfaced; failed required QC blocks packing/ready-to-ship; Production Unit cannot see price/profit or other units' work.        |
| **7 — Finance, documents, and reports**     | **Pending**     | Decimal, PDF, spreadsheet, chart, and email dependencies are declared only.                      | Expense approval/posting; deposits/partial/final/refund payments with evidence; receivables/payables; estimated/actual cost and profit; decimal-safe VND/USD/EUR and immutable FX snapshots; packing/shipping/import-export; approved-snapshot PDF templates and immutable document versions; versioned Excel import/export; role/daily dashboards; daily reports; Resend notification outbox/retry.                                                               | Money and FX calculations pass tests without JavaScript floating-point arithmetic; sensitive finance fields are separately authorized; old documents never change silently; multi-payment and multi-shipment histories are preserved; role dashboards are scoped and accessible; outbox records pending/sent/failed attempts and retries safely. |
| **8 — Hardening and deployment readiness**  | **Pending**     | Baseline response headers and deployment runbook only.                                           | Complete CSP, rate limits, input/upload validation, performance/Lighthouse work, accessibility audit, critical coverage, idempotent operational scripts, and final end-to-end validation.                                                                                                                                                                                                                                                                      | Final `lint`, `typecheck`, unit/integration tests, production `build`, and Playwright suite pass; no important test is skipped without a documented reason; no secrets or sensitive stack traces leak; public site and admin meet performance/accessibility/security requirements; deployment is reproducible from the documentation.            |

## Phase verification log

### Phase 0 — completed 2026-08-24

- `npm run lint` — passed with zero warnings.
- `npm run typecheck` — passed under strict and exact optional property types.
- `npm run test:run` — 1 file, 2 tests passed.
- `npm run build` — Next.js 16.3.2 Turbopack production build passed with static `/` and `/_not-found` routes.
- `npm audit` — zero known vulnerabilities after replacing the obsolete Excel dependency path, moving to React Email v6, and choosing a Node-compatible JSDOM release.
- Deferred intentionally: secrets, external service provisioning, approved brand media/content, and all domain workflows owned by Phases 1–8.
- Next phase: build the complete responsive public prototype using typed, clearly labelled development data.

## Cross-phase acceptance gates

These conditions remain **planned** until their owning phase is complete:

- Public content uses React Server Components and static generation/ISR where appropriate; sensitive admin data is dynamic and `no-store`.
- Every server boundary uses validation, field allowlists, safe errors, authorization where required, and audit logging for important mutations.
- Mongoose access is centralized behind domain services/repositories, uses cached connections, indexes, pagination, read-only `lean()` queries, atomic counters, and transactions or documented compensation.
- Cloudinary assets store `publicId` plus resource metadata, use signed direct uploads, bounded responsive transforms, reference checks, and orphan compensation.
- Money uses a decimal-safe representation; historical exchange rates are immutable snapshots.
- Payment, inventory movement, audit, and document-version records cannot be hard-deleted from the UI.
- Email is queued with idempotency and retry state so an email failure cannot lose the originating business record.
- Public and admin interfaces are responsive, keyboard accessible, respect `prefers-reduced-motion`, and provide accessible alternatives for charts and flipbook content.
- Public forms use server validation, consent handling, honeypot/time checks, durable rate limiting, attachment validation, and idempotency.
- `docs/IMPLEMENTATION_STATUS.md` must be updated after each phase with commands run, results, real risks, deferred items, and the next phase.

## Required verification matrix

### Unit and integration tests — planned

- Money calculations and multi-currency exchange-rate snapshots.
- Sales-order state transitions.
- Inventory reserve/release/transfer and negative-stock prevention.
- RBAC permission and business-unit scopes.
- Translation resolution.
- Localized slug and SEO metadata generation.
- PDF/collection version state machine.
- Cloudinary upload signing and validation.
- Quote-request validation, durable rate limiting, and idempotency.
- Audit-diff redaction.

### Playwright flows — planned

- Public navigation and language switching.
- Product to request-quote flow.
- Mocked Google authentication; CI must not depend on a real Google login.
- Admin product CRUD.
- Mocked Cloudinary collection metadata upload and flipbook opening.
- Basic sales-order workflow.
- Permission denial between two business units.

## Integration and manual-setup dependencies

These items must never be committed as secrets. Their absence does not block scaffold work or typed demo UI, but it blocks the corresponding integration acceptance gate.

| External/manual item                                                                                                     | Needed for                                                          | Current effect                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| MongoDB Atlas project, database user/network access, `MONGODB_URI`, and final region choice                              | Phases 2 and later persistence, transactions, indexes, TTL counters | **Blocked: manual setup** for live persistence; repositories/models can be built and tested with mocks or a documented local/test strategy.      |
| Google Cloud OAuth consent/client setup, authorized callbacks, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and `AUTH_SECRET` | Phase 4 real login                                                  | **Blocked: manual setup** for live Google login; authentication policy and mocked E2E can be developed first.                                    |
| Initial approved administrator email(s) for `ADMIN_EMAILS`                                                               | One-time Phase 4 bootstrap                                          | **Blocked: manual setup** only when bootstrapping the first production Super Admin; remove or freeze bootstrap behavior afterward.               |
| Cloudinary account/cloud name/API credentials and production upload policy                                               | Phase 3 signed media/PDF upload                                     | **Blocked: manual setup** for live uploads/transformations; signing and validation logic can be tested with mocks.                               |
| Resend API key, verified sending domain/address, `EMAIL_FROM`, and notification recipients                               | Phase 5/7 transactional email and digest                            | **Blocked: manual setup** for real delivery; templates/outbox/retry can be implemented without sending live email.                               |
| Production site URL, Vercel project, environment values, and DNS for `lacquerwares.vn`                                   | Phase 8 production deployment                                       | **Blocked: manual setup** for deployment only; local build must not require production DNS.                                                      |
| `CRON_SECRET` and a selected Vercel/external schedule                                                                    | Daily digest/retry automation in Phase 7                            | **Blocked: manual setup** for automated schedules; manual send/retry must remain available and documented.                                       |
| Real logo, photography/video, approved company copy, product data, PDFs, policies, social links, and translations        | Replacing Phase 1–3 demo content                                    | **Content pending**; use clearly labelled development placeholders and an easy asset/content replacement path, never scraped or invented claims. |
| Google Search Console verification and optional analytics ID/consent decision                                            | Phase 2/8 production SEO/analytics                                  | Optional until production. Analytics must remain disabled unless configured with the required consent behavior.                                  |
| Final domain choice for moving `/admin` to `portal.lacquerwares.vn`                                                      | Future routing/deployment                                           | Does not block `/admin`; architecture must avoid coupling admin to a path that prevents later subdomain migration.                               |

## Completion rule

No phase or feature may be described as complete merely because a package, model shell, static page, mock, or demo fixture exists. The platform is not complete until the public site, flipbook, Google login and server-enforced RBAC, signed uploads, persisted business workflows, notification outbox, audit trail, quality gates, operational scripts, and deployment documentation satisfy the master prompt's acceptance criteria. Any partial, mocked, deferred, or manually blocked capability must remain labelled as such here.
