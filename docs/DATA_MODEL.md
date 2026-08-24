# Red Door Platform Data Model

Status: implementation baseline for the modular monolith. Update this document whenever a migration changes a persisted shape, index, invariant, or workflow.

## 1. Persistence boundaries

- MongoDB Atlas and Mongoose are the operational data store and ODM.
- Mongoose is server-only. React components, route handlers, and Server Actions call domain services; they do not import models.
- Each domain owns its models and repository implementation under `src/domains/<domain>/`. Cross-domain code exchanges IDs, commands, DTOs, or domain events, never Mongoose documents.
- A repository returns plain typed objects. Read-only queries use `lean()` and an explicit projection.
- Multi-collection business changes use a MongoDB session and transaction. Inventory, financial posting, publication pointer changes, and order cancellation must fail closed when transactions are unavailable.
- Cloudinary, Resend, and cache revalidation are external side effects. Persist intent in MongoDB first, commit, then process an outbox message. Never keep a MongoDB transaction open during a network call.

The initial bounded contexts are:

| Context       | Owns                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Identity      | users, invitations, roles, grants, business units                                                |
| Content       | pages, structured content, news, process stages, translations, localized routes, public settings |
| Catalog       | products, variants, revisions, sample development, BOMs                                          |
| Collections   | logical collections, localized catalogue versions, pages, hotspots, published pointers           |
| Media         | Cloudinary asset metadata and lifecycle                                                          |
| Customers     | customer master data and contacts                                                                |
| Quotes        | public quote requests, quotes, immutable quote versions                                          |
| Orders        | sales orders, item snapshots, adjustments, delivery batches                                      |
| Procurement   | suppliers, contracts, purchase orders, supplier advances                                         |
| Inventory     | stock items, locations, immutable ledger, balances, reservations, requirements                   |
| Production    | production plans, work orders, material usage, labor, QC and rework                              |
| Logistics     | packing, packages, shipments, import/export checklists                                           |
| Finance       | expenses, payments, allocations, receivable/payable projections                                  |
| Documents     | generated document identities and immutable versions                                             |
| Notifications | transactional outbox and delivery attempts                                                       |
| Reports       | daily reports and optional precomputed report snapshots                                          |
| Audit         | append-only security and business audit events                                                   |

## 2. Mongoose conventions

All schemas use these defaults unless this document states otherwise:

```ts
{
  strict: "throw",
  timestamps: true,
  optimisticConcurrency: true,
  minimize: false,
  versionKey: "revision"
}
```

- IDs are MongoDB `ObjectId`s internally and serialized as strings at an application boundary.
- Store dates as BSON `Date` in UTC. A business date such as `reportDate` is additionally stored as `YYYY-MM-DD` when its calendar identity matters.
- Store email, phone, code, slug, and search-normalized fields separately from display values.
- `createdBy` and `updatedBy` are required for authenticated business mutations. Public/system writes use an explicit actor type and request/correlation ID.
- `businessUnitId` is used for a single owner. `businessUnitIds` is used only when an aggregate genuinely spans units, for example an order. Never infer access only from `createdBy`.
- Soft-deletable records omit `deletedAt` until deletion. Their unique indexes use `partialFilterExpression: { deletedAt: { $exists: false } }`.
- Use `.index()` definitions in schema code and manage production index changes as migrations. Do not depend on `autoIndex` in production.
- Use a hot-reload-safe model factory (`mongoose.models[name] ?? mongoose.model(name, schema)`).
- API input never passes directly to a model constructor or update operator. Zod parses input and the service maps an allowlist of fields.

### 2.1 Shared value objects

`Money` is stored as:

```ts
type Money = {
  amount: Decimal128; // decimal string at all TypeScript/API boundaries
  currency: "VND" | "USD" | "EUR";
};
```

- Never convert `amount` to a JavaScript `number`.
- All arithmetic uses `decimal.js` and an explicit rounding policy per currency/document.
- Historical documents include an immutable exchange-rate snapshot:

```ts
type FxSnapshot = {
  baseCurrency: Currency;
  quoteCurrency: Currency;
  rate: Decimal128;
  asOf: Date;
  sourceLabel: string;
};
```

Quantities that can be fractional also use Decimal128 and decimal strings at TypeScript boundaries.

Localized SEO uses a typed subdocument:

```ts
type SeoFields = {
  title?: string;
  description?: string;
  canonicalOverride?: string;
  imageMediaId?: ObjectId;
  noIndex: boolean;
};
```

Allowed public locales are `vi`, `en`, `fr`, `de`, `ja`, and `zh-CN`. Persist only configured locale keys; do not accept arbitrary locale strings from a client.

## 3. Identity and platform models

### `User`

Key fields:

- `email`, `normalizedEmail`, optional `googleSubject`
- profile: `displayName`, `avatarUrl`, `preferredAdminLocale`
- `status`: `pending | active | suspended`
- `lastLoginAt`, `authzVersion`
- suspension metadata: `suspendedAt`, `suspendedBy`, `suspensionReason`

Indexes:

```js
{ normalizedEmail: 1 } unique
{ googleSubject: 1 } unique, partial where googleSubject exists
{ status: 1, updatedAt: -1 }
```

Do not embed roles in `User`. A user can hold different roles in different business units.

### `Invitation`

Fields: `normalizedEmail`, `tokenHash`, `status`, `invitedBy`, `expiresAt`, `acceptedAt`. Store a hash, never the invitation token.

Indexes: unique active email/token hash and TTL `{ expiresAt: 1 }`. TTL cleanup is eventual; the service must still compare `expiresAt` during acceptance.

### `RoleDefinition`

Fields: stable `key`, localized label, `permissions[]` containing `permission` and maximum `scope`, `system`, `active`. System role keys are seeded and not renamable.

Index: unique `{ key: 1 }`.

### `AccessGrant`

Fields: `userId`, `roleKey`, nullable `businessUnitId`, `status`, `grantedBy`, `grantedAt`, optional `expiresAt`.

Indexes:

```js
{ userId: 1, roleKey: 1, businessUnitId: 1 } unique
{ userId: 1, status: 1 }
{ businessUnitId: 1, status: 1 }
```

A null `businessUnitId` is a global grant, not a wildcard supplied by the client.

### `BusinessUnit`

Fields: unique `code`, `name`, `type`, optional `parentId`, `status`, contact/address data. Do not hard-code a count or list of workshops.

Indexes: unique `{ code: 1 }`, `{ parentId: 1, status: 1 }`.

### `SecurityBootstrapClaim`

The fixed `_id: "initial-super-admin"` is an immutable, append-only sentinel for
the one-time `ADMIN_EMAILS` bootstrap window. It records the provisioned user,
claim mode, and timestamp inside the same MongoDB transaction as the first
global `SUPER_ADMIN` grant. Once the claim exists, removing or suspending that
grant never reopens email-based bootstrap; recovery must use the audited user
and grant workflow described in `DEPLOYMENT.md`.

### Platform support collections

| Model               | Purpose                                 | Required indexes                                   |
| ------------------- | --------------------------------------- | -------------------------------------------------- |
| `Sequence`          | atomic quote/order/document numbers     | `_id` unique; update via `$inc`                    |
| `IdempotencyRecord` | replay-safe public and command requests | unique `{ scope, keyHash }`; TTL `expiresAt`       |
| `RateLimitBucket`   | Mongo-backed fixed-window counters      | unique `{ keyHash, windowStart }`; TTL `expiresAt` |
| `Migration`         | migration ID/checksum history           | unique `migrationId`                               |

TTL indexes are cleanup mechanisms, not authorization or validation mechanisms.

## 4. Localization, routes, content, and media

### Translation strategy

Rich or sluggable translations are separate documents rather than a dynamic `Map`; this makes locale, workflow, and slug indexes reliable. Each owning domain instantiates the shared translation shape in its own collection, for example `ProductTranslation`, `ArticleTranslation`, and `CollectionTranslation`.

Common fields:

- owner and version/revision ID
- `locale`, `slug`, title/summary/body or structured blocks
- `translationStatus`: `draft | inReview | published | needsUpdate`
- `sourceRevision`, `reviewedBy`, `publishedAt`, `seo`

Common indexes:

```js
{ ownerId: 1, versionId: 1, locale: 1 } unique
{ locale: 1, translationStatus: 1, publishedAt: -1 }
```

Slug uniqueness is owned by `LocalizedRoute`, not duplicated as a fragile cross-collection assumption.

### `LocalizedRoute`

Fields: `locale`, canonical `path`, `entityType`, `entityId`, `versionId`, `active`, redirect metadata.

Indexes:

```js
{ locale: 1, path: 1 } unique, partial where active = true
{ entityType: 1, entityId: 1, locale: 1, active: 1 }
```

Publishing reserves or replaces a localized route in the same transaction as the published pointer. Empty/unapproved translations do not get an active route and must not enter a sitemap.

### Structured content

- `ContentEntry`: stable code/type/placement and current draft/published revision pointers.
- `ContentRevision`: version number, structured blocks, workflow state and actor stamps.
- `ContentTranslation`: revision-specific localized blocks and SEO.
- `Article`: stable identity, category/tags/author and revision pointers.
- `ArticleRevision` and `ArticleTranslation`: immutable once published.
- `ProcessStage`: stable stage identity, display order, media references and revision pointers.
- `SiteSettings`: versioned singleton containing company details and social links; no hard-coded social URLs in UI.

Key indexes:

```js
ContentEntry: { type: 1, status: 1, placement: 1 }
ContentRevision: { entryId: 1, version: 1 } unique
Article: { status: 1, publishedAt: -1 }, { categoryId: 1, publishedAt: -1 }
ArticleRevision: { articleId: 1, version: 1 } unique
ProcessStage: { status: 1, displayOrder: 1 }
```

Structured blocks are discriminated, validated subdocuments. Arbitrary HTML is not persisted. Sanitized rich text is still re-sanitized at render boundaries.

### `MediaAsset`

Fields: `publicId`, `resourceType`, `secureUrl` when needed, Cloudinary `version`, dimensions/pages/duration, format, bytes, folder, owner, metadata, and lifecycle `pending | ready | orphaned | softDeleted | failed`.

Indexes:

```js
{ publicId: 1 } unique
{ lifecycle: 1, createdAt: 1 }
{ ownerType: 1, ownerId: 1 }
```

An asset can be soft-deleted only after reference checks. If Cloudinary upload succeeds but DB attachment fails, mark the asset orphaned and enqueue cleanup.

## 5. Catalog and collection models

### Products

`Product` is the stable aggregate identity. It contains `internalId`, `sku`, category/collection IDs, normalized filter keys, workflow status, current draft/published version pointers, and soft-delete metadata.

`ProductVersion` contains the versioned nonlocalized snapshot: dimensions, weight, materials, colors, finish, care data, lead time, media IDs, `showPrice`, optional public price, related products and BOM pointer. A draft can be edited; a published version is immutable.

`ProductTranslation` contains localized title, slug, descriptions, story, care instructions and SEO for one product version and locale.

`ProductVariant` contains `productId`, optional version applicability, unique SKU, option keys, dimensions, media and optional price override. Variants are not used as order history; order items take a snapshot.

Indexes:

```js
Product: { sku: 1 } unique, partial where not deleted
Product: { status: 1, categoryId: 1, updatedAt: -1 }
Product: { collectionIds: 1, status: 1 }
Product: { materialKeys: 1, status: 1 }
Product: { finishKeys: 1, status: 1 }
ProductVersion: { productId: 1, version: 1 } unique
ProductVariant: { sku: 1 } unique, partial where not deleted
ProductVariant: { productId: 1, status: 1 }
```

Use normalized token/prefix fields for basic free-tier search. Do not run unbounded user-controlled regex. An Atlas Search adapter may be enabled later behind the same repository contract.

### Product development

- `SampleOrder`: atomic sample number, customer/order references, status, deadline, assignees and unit IDs.
- `SampleRevision`: immutable revision number, drawings/media, specification and customer/internal notes.
- `BomVersion`: immutable material lines with stock item, quantity, UOM and waste allowance.

Indexes:

```js
SampleOrder: { sampleNumber: 1 } unique
SampleOrder: { businessUnitIds: 1, status: 1, deadline: 1 }
SampleRevision: { sampleOrderId: 1, version: 1 } unique
BomVersion: { productId: 1, version: 1 } unique
```

### Collections and flipbook

- `Collection`: logical identity, year, display order, status and draft/published pointers per locale.
- `CollectionTranslation`: localized HTML landing content and SEO, independent of the flipbook viewer.
- `CollectionVersion`: `collectionId`, locale, version, PDF and cover media IDs, page count, download flag, status and approval/publication metadata.
- `CollectionPage`: page number, bounded Cloudinary transformation metadata, dimensions and optional table-of-contents label.
- `Hotspot`: page ID, percentage rectangle, z-index, accessible label, type and validated target.
- `PublishedCollectionPointer`: exactly one active version for a collection/locale.

Indexes:

```js
Collection: { year: -1, displayOrder: 1 }
CollectionVersion: { collectionId: 1, locale: 1, version: 1 } unique
CollectionVersion: { collectionId: 1, locale: 1, status: 1, publishedAt: -1 }
CollectionPage: { versionId: 1, pageNumber: 1 } unique
Hotspot: { pageId: 1, zIndex: 1 }
PublishedCollectionPointer: { collectionId: 1, locale: 1 } unique
```

Hotspot coordinates are decimal percentages constrained to `[0, 100]`, with positive width/height and `x + width <= 100`, `y + height <= 100`. External URLs pass an allowlist policy before persistence.

## 6. Customer, quote, and order models

### `Customer`

Fields: individual/company type, display/legal names, contacts, country, preferred locale/currency, addresses, notes, tax/import-export fields, owner and business units.

Indexes:

```js
{ normalizedName: 1 }
{ "contacts.normalizedEmail": 1 }
{ businessUnitIds: 1, updatedAt: -1 }
```

Sensitive contact and tax fields require field-level permissions; their presence in a document does not imply they may be returned.

### Public requests and quote versions

`QuoteRequest` stores the generated request number, normalized contact data, requested items, quantity/deadline/note, attachment media IDs, consent timestamp/version, risk metadata, idempotency hash, status and assignment.

`Quote` stores stable identity, atomic quote number, customer, current version pointer, workflow status, and a denormalized `currentValidUntil` used only for workflow queries. `QuoteVersion` stores the authoritative immutable item/custom specification/price/discount/tax/shipping/terms/validity snapshot plus currency and optional FX snapshot.

Indexes:

```js
QuoteRequest: { requestNumber: 1 } unique
QuoteRequest: { status: 1, createdAt: -1 }
QuoteRequest: { normalizedEmail: 1, createdAt: -1 }
QuoteRequest: { idempotencyHash: 1 } unique, partial where it exists
Quote: { quoteNumber: 1 } unique
Quote: { customerId: 1, createdAt: -1 }
Quote: { status: 1, currentValidUntil: 1 }
QuoteVersion: { quoteId: 1, version: 1 } unique
```

The public submit transaction inserts `QuoteRequest`, an audit event and email outbox messages. Email delivery failure cannot roll back or delete the request.

### `SalesOrder`

Fields:

- atomic `orderNumber`, customer and accepted quote-version reference
- embedded immutable `items[]` snapshot with product/variant IDs, localized display data, specification, quantity/UOM, unit price and tax/discount values
- `businessUnitIds`, responsible users, deadlines and planned/actual dates
- orthogonal operational, payment and shipment state
- payment schedule, adjustment references and status history

Indexes:

```js
{ orderNumber: 1 } unique
{ businessUnitIds: 1, operationalStatus: 1, deadline: 1 }
{ customerId: 1, createdAt: -1 }
{ responsibleUserIds: 1, operationalStatus: 1 }
```

`DeliveryBatch` records item-level planned/actual quantities and is indexed by `{ orderId, status, plannedDate }`. Commercial adjustments are separate records with requester, approver, reason and immutable before/after money snapshots.

An order deliberately uses three state axes because production, payment, and shipment can advance concurrently:

```text
operationalStatus:
draft -> confirmed -> materialPlanning -> inProduction
-> qualityControl -> packing -> readyToShip -> completed
                                     \-> cancelled (from any nonterminal state)

paymentStatus:
unpaid -> depositPending -> depositPaid -> partiallyPaid -> paid
   \---------------------------> partiallyPaid
partiallyPaid/paid -> partiallyRefunded/refunded

shipmentStatus:
notReady -> readyToShip -> partiallyShipped -> shipped
```

The UI/API may derive the prompt's summary labels, but must not overwrite one axis when another changes. `completed` requires required QC passed, all required quantities shipped, and receivable settled unless a privileged override is recorded with a reason.

## 7. Procurement, inventory, and production models

### Procurement

- `Supplier`: supplier code, status, contacts, materials/services, unit ownership.
- `SupplierContract`: contract number, dates, currency/value, documents and status.
- `PurchaseOrder` plus immutable `PurchaseOrderVersion`: supplier, lines, delivery dates, Money/FX snapshot and approval status.
- `SupplierAdvanceRequest`: requested/approved Money, requester/approver and reason.

Indexes:

```js
Supplier: { supplierCode: 1 } unique, partial where not deleted
Supplier: { businessUnitIds: 1, status: 1 }
SupplierContract: { contractNumber: 1 } unique
SupplierContract: { status: 1, expectedDelivery: 1 }
PurchaseOrder: { purchaseOrderNumber: 1 } unique
PurchaseOrder: { supplierId: 1, status: 1, expectedDelivery: 1 }
PurchaseOrderVersion: { purchaseOrderId: 1, version: 1 } unique
```

### Inventory ledger and balance projection

- `StockItem`: material, work-in-progress, or finished product with stable code and UOM.
- `Warehouse`: belongs to one business unit.
- `StorageLocation`: belongs to one warehouse.
- `InventoryTransaction`: header containing number, type, reference, idempotency key and posting state.
- `InventoryLedgerEntry`: immutable transaction line with `onHandDelta`, `reservedDelta`, and `incomingDelta`.
- `InventoryBalance`: rebuildable projection keyed by item/location.
- `InventoryReservation`: order/requirement reservation lifecycle.
- `MaterialRequirement`: order/BOM demand and allocation status.

Indexes:

```js
StockItem: { code: 1 } unique, partial where not deleted
Warehouse: { code: 1 } unique
StorageLocation: { warehouseId: 1, code: 1 } unique
InventoryTransaction: { transactionNumber: 1 } unique
InventoryTransaction: { idempotencyKey: 1 } unique, partial where it exists
InventoryLedgerEntry: { transactionId: 1, lineNumber: 1 } unique
InventoryLedgerEntry: { stockItemId: 1, locationId: 1, createdAt: 1 }
InventoryLedgerEntry: { referenceType: 1, referenceId: 1 }
InventoryBalance: { stockItemId: 1, locationId: 1 } unique
InventoryReservation: { orderId: 1, status: 1 }
MaterialRequirement: { orderId: 1, stockItemId: 1 }
```

Posting an inventory transaction atomically:

1. Verify a unique idempotency key and pending transaction.
2. Conditional-update affected balances with an expected revision and non-negative guard unless the configured policy explicitly allows negative stock.
3. Insert immutable ledger lines.
4. Mark the transaction posted and update reservation/requirement state.
5. Append audit/outbox events.

Never directly edit `onHand`, `reserved`, or `incoming` from a CRUD form. `available = onHand - reserved` is derived. A reconciliation job must be able to rebuild balances from ledger entries.

### Production and quality

- `ProductionPlan`: order, business units, schedule, quantities and workflow state.
- `WorkOrder`: atomic number, plan/order, assigned unit/users, quantity, dates, progress and blocker.
- `MaterialUsage`: references posted inventory issue/use/return transactions.
- `LaborEntry`: worker/unit/work order, dates/hours and protected cost fields.
- `QcInspection`: checklist snapshot, result, defects, evidence media and rework reference.

Indexes:

```js
ProductionPlan: { orderId: 1, status: 1 }
ProductionPlan: { businessUnitIds: 1, plannedEnd: 1 }
WorkOrder: { workOrderNumber: 1 } unique
WorkOrder: { businessUnitId: 1, status: 1, plannedEnd: 1 }
WorkOrder: { orderId: 1, status: 1 }
LaborEntry: { businessUnitId: 1, workDate: 1 }
QcInspection: { workOrderId: 1, status: 1, createdAt: -1 }
```

Packing and `readyToShip` are blocked while a required inspection is missing or failed.

## 8. Finance, logistics, document, notification, and audit models

### Finance

- `Expense`: atomic number, type, unit/order/work-order links, Money/FX, workflow, evidence and actor stamps.
- `Payment`: immutable deposit/partial/final/refund record, party, method/reference, Money/FX, evidence and posting metadata.
- `PaymentAllocation`: immutable allocation from one payment to one or more orders, receivables, purchase orders or payables.
- `FinancialObligation`: rebuildable receivable/payable projection with due date and status.

Indexes:

```js
Expense: { expenseNumber: 1 } unique
Expense: { businessUnitId: 1, status: 1, expenseDate: -1 }
Payment: { paymentNumber: 1 } unique
Payment: { externalReference: 1 } unique, partial where it exists
Payment: { partyType: 1, partyId: 1, paidAt: -1 }
PaymentAllocation: { paymentId: 1, lineNumber: 1 } unique
PaymentAllocation: { targetType: 1, targetId: 1 }
FinancialObligation: { partyId: 1, status: 1, dueDate: 1 }
```

A posted payment is corrected by an authorized reversal/refund record, never an edit or delete.

### Logistics

- `PackingPlan`, `Package`, `Shipment`, and `TradeDocumentChecklist` reference delivery batches and one or more orders.
- Package weight and dimensions are decimal values with explicit units.

Indexes: shipment `{ status, plannedShipDate }`, sparse tracking reference, and `{ orderIds, status }`; package `{ packingPlanId, packageNumber }` unique.

### Documents

`GeneratedDocument` is the stable document identity. `DocumentVersion` is immutable and contains document number, version, template version, source snapshot/hash, generated media ID, creator, generation date and optional deep-link/QR payload.

Indexes:

```js
GeneratedDocument: { documentNumber: 1 } unique
GeneratedDocument: { sourceType: 1, sourceId: 1, documentType: 1 }
DocumentVersion: { documentId: 1, version: 1 } unique
```

Regeneration always creates a new version. It never silently replaces an old PDF.

### Notifications and audit

`OutboxMessage` fields: event type, small redacted payload/reference IDs, unique dedupe key, `pending | processing | sent | failed | deadLetter`, attempts, next attempt, last safe error, provider ID and timestamps.

Indexes:

```js
{ dedupeKey: 1 } unique
{ status: 1, nextAttemptAt: 1 }
```

`AuditEvent` is append-only and contains actor type/ID, action, resource type/ID, business units, permission/scope decision when relevant, request/correlation IDs, reason, and a redacted before/after diff.

Indexes:

```js
{ resourceType: 1, resourceId: 1, occurredAt: -1 }
{ actorId: 1, occurredAt: -1 }
{ businessUnitIds: 1, occurredAt: -1 }
{ action: 1, occurredAt: -1 }
```

Audit events have no TTL by default. Any later retention policy requires an explicit legal/business decision and archival plan.

## 9. Workflow definitions and guards

Transitions are centralized in domain state-machine modules. A transition command includes current expected revision, target state, actor, timestamp and mandatory reason where required. A raw status update is not a repository operation.

| Aggregate             | Allowed workflow                                                                                                                                    | Important guards                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| User                  | `pending -> active -> suspended`, `suspended -> active`                                                                                             | invite/bootstrap and user-management permission          |
| Translation           | `draft -> inReview -> published`; review can return to draft; published source change -> `needsUpdate -> inReview`                                  | nonempty approved content, route available               |
| Content revision      | `draft -> inReview -> published -> archived`                                                                                                        | published revision immutable                             |
| Product               | `draft -> inReview -> published -> discontinued -> archived`                                                                                        | SKU/translation/media validation; publish permission     |
| Collection version    | `draft -> inReview -> approved -> published -> archived`; privileged rollback permits `approved/archived -> published`                              | PDF ready, page count/pages valid, one published pointer |
| Sample                | `request -> design -> samplePreparation -> internalReview -> customerReview -> approved/rejected`; review -> `revision -> design/samplePreparation` | revision snapshot exists; conversion permissions         |
| Quote                 | `draft -> review -> approved -> sent -> accepted/rejected/expired`                                                                                  | approved version locked; validity and price approval     |
| Expense               | `draft -> submitted -> approved/rejected -> posted`; rejected may return to revised draft                                                           | approver separation; Money/evidence valid                |
| Inventory transaction | `pending -> posted/voided`                                                                                                                          | atomic balance guard; posted immutable                   |
| Reservation           | `active -> partiallyConsumed -> fulfilled/released/cancelled`                                                                                       | remaining quantity cannot be negative                    |
| Work order            | `planned -> ready -> inProgress <-> blocked -> qcPending -> completed/cancelled`; failed QC -> rework                                               | unit assignment, material/QC guards                      |
| QC inspection         | `pending -> passed/failed`                                                                                                                          | complete required checklist; approver permission         |
| Media                 | `pending -> ready/orphaned/failed -> softDeleted`                                                                                                   | reference check before delete                            |
| Outbox                | `pending -> processing -> sent`; failure -> `failed -> pending`, exhausted -> `deadLetter`                                                          | dedupe and backoff                                       |

Rollback of a collection atomically archives the currently published version, marks the selected approved/archived version published, changes `PublishedCollectionPointer`, and creates an audit event. Only workflow metadata changes; the selected version's PDF, pages, and hotspots remain immutable.

## 10. Immutability and deletion rules

| Record                                       | Rule                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| Published content/product/collection version | immutable; edit through a new version                                      |
| Quote version after review/approval          | immutable; edit through a new version                                      |
| Order item snapshot                          | immutable except explicitly versioned commercial adjustment                |
| Posted inventory transaction/ledger entry    | append-only; correct with a compensating transaction                       |
| Posted payment/allocation                    | append-only; correct with reversal/refund                                  |
| Posted expense                               | immutable; correct with adjustment/reversal workflow                       |
| Document version                             | immutable; regenerate a new version                                        |
| Audit event                                  | append-only; no UI delete/update                                           |
| Customer/product/supplier master             | mutable with optimistic concurrency and audit; soft-delete where permitted |
| Media asset                                  | reference-checked soft delete, then asynchronous provider cleanup          |

## 11. Required transaction boundaries

The following operations are atomic:

1. Public quote request + idempotency result + audit + email outbox.
2. Content/product/collection publish + localized route + published pointer + audit/outbox.
3. Quote acceptance and optional order creation from the accepted immutable version.
4. Order cancellation + reservation release/compensating ledger + status history + audit/outbox.
5. Inventory post/transfer/reserve/release + balance projection + ledger + referenced requirement state.
6. Payment posting + allocations + receivable/payable projection + order payment state.
7. Expense approval/posting + audit and report invalidation event.
8. Role/grant changes + `authzVersion` increment + audit.

Use an expected `revision` to reject stale writes. Retry only known transient transaction errors, with bounded retries and an idempotency key.

## 12. Query, pagination, and reporting rules

- Public repositories always include published pointer/status, locale availability, and nondeleted predicates.
- Admin repositories accept an `AccessContext` and construct scope predicates internally. A route must not pass an arbitrary business-unit filter as authorization.
- Use cursor pagination on `{ createdAt, _id }` or a stable domain sort for unbounded lists. Offset/page pagination is acceptable for small curated content lists.
- Dashboard query services use aggregation pipelines and deliberate `$lookup`s/projections; do not perform per-row follow-up queries.
- Report snapshots are caches, not sources of financial or inventory truth, and include their input watermark/generated timestamp.
- Search uses normalized tokens or an optional Atlas Search repository adapter. Escape/limit prefix queries; no unrestricted regex scanning.

## 13. Demo, seed, and migration behavior

- Public read repositories may use deterministic, typed demo records when `DATA_SOURCE=demo`, clearly labeled `DEMO`/`isDemo` and containing no invented company claims.
- Demo repositories are read-only. Admin mutation fails with an explicit setup error rather than pretending to persist.
- `auto` data mode may select demo only in development/build preview when `MONGODB_URI` is absent. A Mongo connection/query failure must not silently fall back to demo.
- Seed scripts are idempotent and use stable seed keys. Seed roles/permissions, optional business units/categories, and an environment-approved bootstrap admin. Never seed credentials.
- Every persisted shape/index change has a numbered migration, checksum, forward action, verification query, and documented rollback/compensation where feasible.

## 14. Minimum persistence tests

- Money and FX snapshot decimal calculations.
- Translation resolution, route collision, and empty translation exclusion.
- Product/quote/collection version immutability and publication races.
- Exhaustive state transition allow/deny tables.
- Scope-filtered repository reads across at least two business units.
- Parallel inventory reservations that cannot create negative/double-reserved balance.
- Inventory balance rebuild equals the ledger projection.
- Quote request remains stored when email delivery fails; outbox retry is idempotent.
- Order cancellation releases reservations exactly once.
- Payment allocation/reversal and order payment-state projection.
- Audit diff redaction and append-only repository API.
- Soft-delete partial unique indexes and idempotent seed/migration execution.

Transaction integration tests must run against a MongoDB replica set, not a standalone mock that silently skips transaction semantics.
