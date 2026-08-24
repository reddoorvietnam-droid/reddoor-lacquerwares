# Red Door Platform RBAC and Authorization

Status: authoritative default policy for the initial platform. Authentication proves identity; this policy determines access. Hiding a control in the client is never an authorization decision.

## 1. Security model

Google OAuth through Auth.js supplies an identity assertion. MongoDB supplies user status, invitations, roles, business-unit assignments, permissions, and scopes.

An authenticated request is authorized only when all of these are true:

1. The session is valid and maps to a MongoDB `User`.
2. The user status is `active`.
3. At least one active, nonexpired `AccessGrant` yields the required permission.
4. The grant's scope covers the requested record and every affected business unit.
5. Field-level and workflow constraints permit the operation.
6. Any required approval, separation-of-duties, expected revision, and reason checks pass.

Unknown Google users become `pending` and may see only the access-pending experience. Suspended users lose admin/data access even if an old session cookie remains valid.

`ADMIN_EMAILS` is bootstrap-only. It may activate the initial Super Admin when no Super Admin exists. It is not a permanent authorization bypass and must not be checked in ordinary policies.

## 2. Actor and access context

Every protected service receives a server-created context, never a client-created one:

```ts
type Scope = "own" | "assignedBusinessUnits" | "all";

type EffectivePermission = {
  permission: Permission;
  scope: Scope;
  businessUnitIds: string[]; // empty only for an authorized global grant
  roleKeys: RoleKey[];
};

type AccessContext = {
  actorType: "user" | "system";
  userId?: string;
  normalizedEmail?: string;
  userStatus: "active";
  permissions: EffectivePermission[];
  authzVersion: number;
  requestId: string;
};
```

The session may cache the stable user ID and an authorization version, but sensitive reads/mutations re-check current user status and grants server-side. A role/grant/suspension change increments `User.authzVersion`.

System jobs do not impersonate `SUPER_ADMIN`. They use a named, narrowly scoped system actor such as `outbox-worker` or `daily-digest`, with a server-only entry point and an audit identity.

## 3. Roles

System role keys:

```text
SUPER_ADMIN
DIRECTOR
ORDER_MANAGER
PRODUCT_DESIGNER
CONTENT_EDITOR
WAREHOUSE_MANAGER
FACTORY_MANAGER
FACTORY_ACCOUNTANT
PRODUCTION_UNIT
COMPANY_ACCOUNTANT
SUPPLIER_MANAGER
REPORT_VIEWER
```

A user can have multiple roles and can hold different roles in different business units. Role definitions and grants are stored separately:

- `RoleDefinition` contains the permission/scope ceiling for a role.
- `AccessGrant` assigns a role to a user and optional business unit.
- A null business unit is a deliberately global grant, not a wildcard accepted from a form.
- System role keys are seeded and stable. UI labels may be translated.

Role permissions combine by union, but each service still applies scope, field, workflow, and separation-of-duty constraints. No role name is used directly as a business rule except the protected Super Admin lifecycle; policies check permissions.

## 4. Permission and scope semantics

Permissions use `resource.action` names, for example:

```text
products.update
orders.approvePriceAdjustment
inventory.adjust
finance.readProfit
users.manageRoles
```

Scope order is:

```text
own < assignedBusinessUnits < all
```

### `own`

The resource policy defines ownership using trusted persisted fields such as `createdBy`, `assigneeIds`, or `ownerUserId`. A client-provided owner ID is never sufficient. `own` on a create command means the service sets ownership to the actor.

### `assignedBusinessUnits`

The resource intersects a unit from one or more active grants. Rules differ by operation:

- Create: every requested unit must be covered by the actor's grants.
- Single-unit mutation: that unit must be covered.
- Multi-unit mutation: every affected unit must be covered.
- List/read: the repository applies a unit predicate before querying. A client filter may narrow but never widen it.
- Cross-unit inventory transfer: both source and destination units must be covered, even when the actor has `inventory.transferCrossUnit`.
- Aggregated financial data spanning units requires coverage of every included unit or an `all` grant.

### `all`

The business-unit predicate is unrestricted. `all` does not bypass sensitive-field permissions, state-machine guards, approval rules, or audit requirements.

### Global resources

Content, system settings, roles, and some media are not owned by a business unit. Their policies use `own` for actor-owned drafts and `all` for global review/publish/manage actions. A global AccessGrant is created explicitly by an authorized role manager.

## 5. Sensitive field permissions

Broad resource read permission does not expose protected fields. Repositories/query services return an authorized projection.

| Permission                | Protects                                                             |
| ------------------------- | -------------------------------------------------------------------- |
| `customers.readSensitive` | private contacts, notes, tax and import/export identity fields       |
| `orders.readSellingPrice` | selling price, discount, commercial adjustment and order total       |
| `products.readCost`       | standard/estimated product and BOM cost                              |
| `inventory.readValue`     | inventory valuation, not physical quantity                           |
| `procurement.readPrice`   | supplier price, advance and contract value                           |
| `finance.readCost`        | material, labor, workshop, shipping and actual cost                  |
| `finance.readProfit`      | margin and estimated/actual profit                                   |
| `labor.readSalary`        | salary/rate and personally sensitive labor-cost fields               |
| `documents.readSensitive` | financial, payroll, customs-sensitive and identity-bearing documents |
| `audit.export`            | bulk audit extraction                                                |

When a permission is absent, omit/redact the field server-side before serialization, export, document generation, chart aggregation, and search indexing.

## 6. Default role profile

| Role                 | Default responsibility                                                         | Important exclusions                                                                |
| -------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `SUPER_ADMIN`        | platform setup, users/roles, all business capabilities                         | no secret values are managed or displayed in UI                                     |
| `DIRECTOR`           | global operational visibility, approvals, publication, consolidated reporting  | cannot bypass audit/reason/state guards                                             |
| `ORDER_MANAGER`      | customers, quote requests, quotes, orders and delivery coordination            | no cost/profit/salary; requests but does not approve price changes by default       |
| `PRODUCT_DESIGNER`   | products, variants, BOM drafts and sample development                          | no publication, financial cost/profit or customer-private data by default           |
| `CONTENT_EDITOR`     | public content, news, translations, collection drafts and media                | submits review; does not publish/rollback by default                                |
| `WAREHOUSE_MANAGER`  | physical inventory, receipt/issue/reservation/transfer/stocktake               | quantity access does not imply valuation, selling price, or profit access           |
| `FACTORY_MANAGER`    | production planning, assignment, progress, material use and QC approval        | order/customer views are operational projections with selling values redacted       |
| `FACTORY_ACCOUNTANT` | unit expense, labor/cost capture and unit daily reporting                      | cannot approve/post own submissions; no company-wide profit by default              |
| `PRODUCTION_UNIT`    | work assigned to the unit, progress, usage and QC evidence                     | no selling price, profit, customer-private data, or other units                     |
| `COMPANY_ACCOUNTANT` | company finance, AR/AP, payments, expense posting, cost/profit/payroll reports | no role administration or content publication                                       |
| `SUPPLIER_MANAGER`   | supplier, contract, purchase order and supply coordination                     | submits price/advance changes; does not approve them by default                     |
| `REPORT_VIEWER`      | read-only operational reports within the granted units                         | sensitive financial metrics require separate permissions; no source-record mutation |

## 7. Authoritative default permission matrix

Legend:

- `A`: `all`
- `B`: `assignedBusinessUnits`
- `O`: `own`
- `B*`/`A*`: scope is chosen explicitly when the `REPORT_VIEWER` grant is issued
- `—`: not granted by default
- Comma-separated permissions in one row are separate permissions with identical default grants.

Abbreviations: `SA` Super Admin, `DIR` Director, `OM` Order Manager, `PD` Product Designer, `CE` Content Editor, `WM` Warehouse Manager, `FM` Factory Manager, `FA` Factory Accountant, `PU` Production Unit, `CA` Company Accountant, `SM` Supplier Manager, `RV` Report Viewer.

### 7.1 Identity, organization, settings, and audit

| Permission                                        | Default grants                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `users.read`                                      | SA:A, DIR:A                                                              |
| `users.invite`, `users.activate`, `users.suspend` | SA:A, DIR:A                                                              |
| `users.manageRoles`                               | SA:A, DIR:A, subject to anti-escalation rules                            |
| `users.manageSuperAdmin`                          | SA:A only                                                                |
| `roles.read`                                      | SA:A, DIR:A                                                              |
| `roles.update`                                    | SA:A only                                                                |
| `businessUnits.read`                              | SA:A, DIR:A, OM:B, PD:B, CE:B, WM:B, FM:B, FA:B, PU:B, CA:A, SM:B, RV:B* |
| `businessUnits.manage`                            | SA:A, DIR:A                                                              |
| `settings.read`                                   | SA:A, DIR:A, CE:A, CA:A                                                  |
| `settings.updatePublic`                           | SA:A, DIR:A, CE:O                                                        |
| `settings.publishPublic`                          | SA:A, DIR:A                                                              |
| `settings.manageSystem`                           | SA:A only                                                                |
| `audit.read`                                      | SA:A, DIR:A                                                              |
| `audit.export`                                    | SA:A, DIR:A                                                              |
| `notifications.retry`                             | SA:A, DIR:A, OM:B, CA:A                                                  |
| `notifications.manageDeadLetter`                  | SA:A, DIR:A                                                              |

Director role management constraints are defined in section 9; `users.manageRoles` does not permit management of Super Admin grants.

### 7.2 Content, translation, media, and collections

| Permission                                                                                  | Default grants                                                    |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `content.readDraft`                                                                         | SA:A, DIR:A, CE:O                                                 |
| `content.create`, `content.update`                                                          | SA:A, DIR:A, CE:O                                                 |
| `content.submitReview`                                                                      | SA:A, DIR:A, CE:O                                                 |
| `content.review`                                                                            | SA:A, DIR:A                                                       |
| `content.publish`, `content.archive`                                                        | SA:A, DIR:A                                                       |
| `translations.readDraft`                                                                    | SA:A, DIR:A, CE:O                                                 |
| `translations.update`, `translations.submitReview`                                          | SA:A, DIR:A, CE:O                                                 |
| `translations.review`, `translations.publish`                                               | SA:A, DIR:A                                                       |
| `media.read`                                                                                | SA:A, DIR:A, OM:B, PD:B, CE:A, WM:B, FM:B, FA:B, PU:B, CA:A, SM:B |
| `media.upload`                                                                              | SA:A, DIR:A, OM:B, PD:B, CE:O, WM:B, FM:B, FA:B, PU:O, CA:A, SM:B |
| `media.updateOwnMetadata`                                                                   | SA:A, DIR:A, OM:O, PD:O, CE:O, WM:O, FM:O, FA:O, PU:O, CA:O, SM:O |
| `media.softDelete`                                                                          | SA:A, DIR:A, PD:O, CE:O, WM:O, FM:O, CA:A, SM:O                   |
| `collections.readDraft`                                                                     | SA:A, DIR:A, PD:B, CE:O                                           |
| `collections.create`, `collections.update`, `collections.updateHotspots`                    | SA:A, DIR:A, CE:O                                                 |
| `collections.submitReview`                                                                  | SA:A, DIR:A, CE:O                                                 |
| `collections.approve`, `collections.publish`, `collections.rollback`, `collections.archive` | SA:A, DIR:A                                                       |

Media permission is necessary but not sufficient: reading, downloading, or deleting an asset also requires read/manage access to its owning domain record. Media upload additionally requires a domain-specific folder, MIME, byte limit, and ownership policy. `media.softDelete` never bypasses reference checks.

### 7.3 Products, BOM, and sample development

| Permission                                                                        | Default grants                                                    |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `products.read`                                                                   | SA:A, DIR:A, OM:B, PD:B, CE:B, WM:B, FM:B, FA:B, PU:B, CA:A, SM:B |
| `products.readSellingPrice`                                                       | SA:A, DIR:A, OM:B, CA:A                                           |
| `products.readCost`                                                               | SA:A, DIR:A, FM:B, FA:B, CA:A                                     |
| `products.create`                                                                 | SA:A, DIR:A, PD:B                                                 |
| `products.update`, `products.manageVariants`                                      | SA:A, DIR:A, PD:O                                                 |
| `products.submitReview`                                                           | SA:A, DIR:A, PD:O                                                 |
| `products.review`, `products.publish`, `products.discontinue`, `products.archive` | SA:A, DIR:A                                                       |
| `products.manageBom`                                                              | SA:A, DIR:A, PD:B, FM:B                                           |
| `samples.read`                                                                    | SA:A, DIR:A, OM:B, PD:B, FM:B                                     |
| `samples.create`, `samples.update`, `samples.addRevision`                         | SA:A, DIR:A, OM:B, PD:O, FM:B                                     |
| `samples.submitInternalReview`                                                    | SA:A, DIR:A, PD:O, FM:B                                           |
| `samples.recordInternalReview`                                                    | SA:A, DIR:A, FM:B                                                 |
| `samples.recordCustomerReview`                                                    | SA:A, DIR:A, OM:B, PD:B                                           |
| `samples.approve`, `samples.reject`                                               | SA:A, DIR:A                                                       |
| `samples.convert`                                                                 | SA:A, DIR:A, OM:B, PD:B; target create permission also required   |

Operations roles receive only the product specification projection unless a sensitive permission is also present.

### 7.4 Customers, quote requests, quotes, and orders

| Permission                                                                   | Default grants                                                                                        |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `customers.read`                                                             | SA:A, DIR:A, OM:B, CA:A                                                                               |
| `customers.readSensitive`                                                    | SA:A, DIR:A, OM:B, CA:A                                                                               |
| `customers.create`, `customers.update`                                       | SA:A, DIR:A, OM:B                                                                                     |
| `customers.archive`                                                          | SA:A, DIR:A                                                                                           |
| `quoteRequests.read`, `quoteRequests.assign`, `quoteRequests.update`         | SA:A, DIR:A, OM:B                                                                                     |
| `quoteRequests.close`, `quoteRequests.markSpam`                              | SA:A, DIR:A, OM:B                                                                                     |
| `quotes.read`                                                                | SA:A, DIR:A, OM:B, CA:A                                                                               |
| `quotes.create`, `quotes.update`, `quotes.addVersion`, `quotes.submitReview` | SA:A, DIR:A, OM:B                                                                                     |
| `quotes.approve`, `quotes.reject`                                            | SA:A, DIR:A                                                                                           |
| `quotes.send`, `quotes.expire`                                               | SA:A, DIR:A, OM:B                                                                                     |
| `quotes.requestPriceAdjustment`                                              | SA:A, DIR:A, OM:B                                                                                     |
| `quotes.approvePriceAdjustment`                                              | SA:A, DIR:A, CA:A                                                                                     |
| `orders.read`                                                                | SA:A, DIR:A, OM:B, PD:B, WM:B, FM:B, FA:B, PU:B, CA:A, SM:B                                           |
| `orders.readSellingPrice`                                                    | SA:A, DIR:A, OM:B, CA:A                                                                               |
| `orders.create`, `orders.updateDraft`, `orders.confirm`                      | SA:A, DIR:A, OM:B                                                                                     |
| `orders.assignBusinessUnits`, `orders.assignResponsibleUsers`                | SA:A, DIR:A, OM:B                                                                                     |
| `orders.transitionOperational`                                               | SA:A, DIR:A, OM:B; production/QC/packing transitions also require the relevant operational permission |
| `orders.requestPriceAdjustment`                                              | SA:A, DIR:A, OM:B                                                                                     |
| `orders.approvePriceAdjustment`                                              | SA:A, DIR:A, CA:A                                                                                     |
| `orders.requestCancel`                                                       | SA:A, DIR:A, OM:B                                                                                     |
| `orders.cancel`                                                              | SA:A, DIR:A                                                                                           |
| `deliveries.read`                                                            | SA:A, DIR:A, OM:B, WM:B, FM:B, CA:A                                                                   |
| `deliveries.plan`, `deliveries.update`                                       | SA:A, DIR:A, OM:B, WM:B                                                                               |
| `deliveries.confirmDispatch`                                                 | SA:A, DIR:A, WM:B                                                                                     |

`orders.read` is projection-specific. Production Unit, Factory Manager, Warehouse Manager, Product Designer, and Supplier Manager do not receive customer-private data or selling values from it.

### 7.5 Supplier and procurement

| Permission                                                           | Default grants                            |
| -------------------------------------------------------------------- | ----------------------------------------- |
| `suppliers.read`                                                     | SA:A, DIR:A, WM:B, FM:B, FA:B, CA:A, SM:B |
| `suppliers.create`, `suppliers.update`                               | SA:A, DIR:A, SM:B                         |
| `suppliers.archive`                                                  | SA:A, DIR:A                               |
| `procurement.read`                                                   | SA:A, DIR:A, WM:B, FM:B, FA:B, CA:A, SM:B |
| `procurement.readPrice`                                              | SA:A, DIR:A, FA:B, CA:A, SM:B             |
| `procurement.create`, `procurement.update`, `procurement.addVersion` | SA:A, DIR:A, SM:B                         |
| `procurement.submit`                                                 | SA:A, DIR:A, SM:B                         |
| `procurement.approve`, `procurement.cancel`                          | SA:A, DIR:A, CA:A                         |
| `procurement.receive`                                                | SA:A, DIR:A, WM:B                         |
| `procurement.requestPriceChange`, `procurement.requestAdvance`       | SA:A, DIR:A, SM:B                         |
| `procurement.approvePriceChange`, `procurement.approveAdvance`       | SA:A, DIR:A, CA:A                         |

Approval services reject self-approval unless a documented emergency override permission is introduced later. No such override is granted by default.

### 7.6 Inventory

| Permission                               | Default grants                                                   |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `inventory.read`                         | SA:A, DIR:A, OM:B, PD:B, WM:B, FM:B, FA:B, PU:B, CA:A, SM:B      |
| `inventory.readValue`                    | SA:A, DIR:A, FA:B, CA:A                                          |
| `inventory.receive`, `inventory.issue`   | SA:A, DIR:A, WM:B                                                |
| `inventory.reserve`, `inventory.release` | SA:A, DIR:A, WM:B, FM:B                                          |
| `inventory.transfer`                     | SA:A, DIR:A, WM:B                                                |
| `inventory.transferCrossUnit`            | SA:A, DIR:A, WM:B; source and destination coverage both required |
| `inventory.requestAdjustment`            | SA:A, DIR:A, WM:B                                                |
| `inventory.adjust`                       | SA:A, DIR:A, WM:B, subject to threshold/approval policy          |
| `inventory.approveAdjustment`            | SA:A, DIR:A, CA:A                                                |
| `inventory.stocktake`                    | SA:A, DIR:A, WM:B                                                |
| `inventory.import`                       | SA:A, DIR:A, WM:B                                                |
| `inventory.export`                       | SA:A, DIR:A, WM:B, FA:B, CA:A                                    |

`inventory.adjust` means posting an immutable adjustment transaction, not editing a balance. Above-threshold adjustments require a distinct approver with `inventory.approveAdjustment`.

### 7.7 Production, labor, and QC

| Permission                                                                | Default grants                                        |
| ------------------------------------------------------------------------- | ----------------------------------------------------- |
| `production.read`                                                         | SA:A, DIR:A, OM:B, PD:B, WM:B, FM:B, FA:B, PU:B, CA:A |
| `production.createPlan`, `production.updatePlan`                          | SA:A, DIR:A, FM:B                                     |
| `production.assignWork`                                                   | SA:A, DIR:A, FM:B                                     |
| `production.updateProgress`, `production.reportBlocker`                   | SA:A, DIR:A, FM:B, PU:O                               |
| `production.recordMaterialUse`                                            | SA:A, DIR:A, WM:B, FM:B, PU:O                         |
| `production.recordLabor`                                                  | SA:A, DIR:A, FM:B, FA:B, PU:O                         |
| `production.readLaborQuantity`                                            | SA:A, DIR:A, FM:B, FA:B, PU:O, CA:A                   |
| `production.recordQcEvidence`                                             | SA:A, DIR:A, FM:B, PU:O                               |
| `production.approveQc`, `production.requireRework`, `production.rejectQc` | SA:A, DIR:A, FM:B                                     |
| `production.completeWork`                                                 | SA:A, DIR:A, FM:B; QC guard applies                   |
| `labor.readSalary`                                                        | SA:A, DIR:A, FA:B, CA:A                               |

A Production Unit can add evidence to its own work but cannot approve its own mandatory QC by default.

### 7.8 Finance

| Permission                                | Default grants                      |
| ----------------------------------------- | ----------------------------------- |
| `expenses.read`                           | SA:A, DIR:A, FM:B, FA:B, CA:A       |
| `expenses.create`, `expenses.updateDraft` | SA:A, DIR:A, FM:O, FA:B             |
| `expenses.submit`                         | SA:A, DIR:A, FM:O, FA:B             |
| `expenses.approve`, `expenses.reject`     | SA:A, DIR:A, CA:A                   |
| `expenses.post`, `expenses.reverse`       | SA:A, DIR:A, CA:A                   |
| `payments.read`                           | SA:A, DIR:A, OM:B, FA:B, CA:A, SM:B |
| `payments.record`, `payments.allocate`    | SA:A, DIR:A, CA:A                   |
| `payments.reverse`, `payments.refund`     | SA:A, DIR:A, CA:A                   |
| `receivables.read`                        | SA:A, DIR:A, OM:B, CA:A             |
| `payables.read`                           | SA:A, DIR:A, FA:B, CA:A, SM:B       |
| `finance.readCost`                        | SA:A, DIR:A, FM:B, FA:B, CA:A       |
| `finance.readProfit`                      | SA:A, DIR:A, CA:A                   |
| `finance.manageFxSnapshot`                | SA:A, DIR:A, CA:A                   |

Factory Manager cost access is limited to operational cost for assigned work/units and excludes salary unless `labor.readSalary` is separately granted.

### 7.9 Packing, shipping, trade documents, generated documents, and reports

| Permission                                                   | Default grants                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `packing.read`                                               | SA:A, DIR:A, OM:B, WM:B, FM:B, CA:A                                                   |
| `packing.create`, `packing.update`, `packing.complete`       | SA:A, DIR:A, OM:B, WM:B                                                               |
| `shipments.read`                                             | SA:A, DIR:A, OM:B, WM:B, FM:B, CA:A, SM:B                                             |
| `shipments.create`, `shipments.update`, `shipments.dispatch` | SA:A, DIR:A, OM:B, WM:B                                                               |
| `tradeDocuments.read`                                        | SA:A, DIR:A, OM:B, CA:A, SM:B                                                         |
| `tradeDocuments.manage`                                      | SA:A, DIR:A, OM:B, CA:A, SM:B                                                         |
| `documents.read`                                             | SA:A, DIR:A, OM:B, PD:B, CE:B, WM:B, FM:B, FA:B, PU:O, CA:A, SM:B                     |
| `documents.generate`                                         | SA:A, DIR:A, OM:B, WM:B, FM:B, FA:B, CA:A, SM:B; source/type permission also required |
| `documents.download`                                         | same default grants as `documents.read`                                               |
| `documents.readSensitive`                                    | SA:A, DIR:A, FA:B, CA:A; source permission also required                              |
| `documents.import`                                           | SA:A, DIR:A, WM:B, FA:B, CA:A, SM:B; template/domain permission required              |
| `documents.export`                                           | SA:A, DIR:A, OM:B, WM:B, FM:B, FA:B, CA:A, SM:B, RV:B*; source permission required    |
| `reports.readOperational`                                    | SA:A, DIR:A, OM:B, PD:B, WM:B, FM:B, FA:B, PU:B, CA:A, SM:B, RV:B*                    |
| `reports.readConsolidated`                                   | SA:A, DIR:A, CA:A, RV:A*                                                              |
| `reports.submitDaily`                                        | SA:A, DIR:A, FM:B, FA:B, PU:B                                                         |
| `reports.reviewDaily`                                        | SA:A, DIR:A, FM:B, CA:A                                                               |
| `reports.sendDigest`                                         | SA:A, DIR:A                                                                           |

Document permissions are never sufficient on their own: read, download, export, import, and generation also require access to the owning/source record. For example, generating a commercial invoice requires access to the order, selling price and relevant customer fields; generating a cost report requires `finance.readCost`.

## 8. Resource policy rules

Each protected resource defines:

```ts
interface ResourcePolicy<T> {
  ownership(record: T): { ownerUserIds: string[]; businessUnitIds: string[] };
  scopeFilter(context: AccessContext, permission: Permission): MongoFilter<T>;
  assertFieldAccess(context: AccessContext, record: T, fields: string[]): void;
  project(context: AccessContext, record: T): AuthorizedDto;
}
```

Required behavior:

- Read-one performs the same scope predicate as list; loading by ID first and authorizing later must not leak existence through distinct errors.
- List/export/report filters are built in the repository/query service from `AccessContext`.
- Create maps unit/owner fields server-side and verifies every requested unit.
- Update first loads the persisted record under the authorized scope and applies an allowlisted patch.
- A move between units authorizes both the persisted source and requested destination.
- Search, count, autocomplete, dashboard, document generation and file download use the same policy as ordinary reads.
- Cache keys for private data include user/access scope or, preferably, private admin data uses `no-store`.

## 9. Anti-escalation and approval rules

### Role and user administration

- Only `users.manageSuperAdmin` can grant, revoke, suspend, or alter a Super Admin.
- A user cannot grant a role with permissions or scope beyond their own effective ceiling.
- A Director can manage non-Super-Admin roles but cannot create a global role/grant containing permissions reserved for Super Admin.
- No user can grant permissions directly to themselves.
- Revoking the last active Super Admin is rejected.
- Suspending a user revokes active sessions or increments `authzVersion` immediately.
- Role/grant before/after data is audit logged with sensitive values redacted.

### Separation of duties

By default the same user cannot both submit and approve:

- price adjustments
- supplier price changes or advances
- above-threshold inventory adjustments
- expenses
- payment reversals/refunds

Factory Accountant submits unit costs; Company Accountant or Director approves/posts. Supplier Manager submits supplier financial changes; Company Accountant or Director approves. Production Unit records its evidence; Factory Manager or Director approves required QC.

An emergency override, if introduced later, must be a distinct permission, require a reason, and create a high-priority audit/notification event. No default role currently has such an override.

### Workflow constraints

Permission does not imply that any transition is valid:

- A collection cannot publish before PDF/page readiness and approval.
- An order cannot enter packing/ready-to-ship with required QC missing or failed.
- Canceling an order must release reservations atomically.
- Posted inventory, payments, expenses and document versions cannot be edited/deleted.
- A quote/order price change follows its approval workflow even when the actor can otherwise edit the draft.

## 10. Authentication lifecycle and audit

1. Auth.js validates Google OAuth.
2. Normalize email and locate `User` by Google subject/email.
3. If no invited/bootstrapped active user exists, create/update a pending identity record and show access pending only.
4. Load current user status, AccessGrants and RoleDefinitions.
5. Create `AccessContext`; do not expose raw grants to the client unless needed for navigation hints.
6. Audit login success, pending access, logout, suspension, grant changes and failed authorization.

Authorization failures returned to a client use safe, consistent messages. Structured server logs may include request ID, permission, resource type and policy reason, but not sensitive record content or tokens.

High-value/sensitive audit actions include:

- role/grant/user-status changes
- failed access to another business unit
- content/product/collection approval and publication
- quote/order price adjustment and cancellation
- inventory post/adjustment/transfer/reservation release
- production/QC approval or rejection
- expense/payment/finance posting and reversal
- sensitive document generation/download and audit export

## 11. Implementation pattern

A command service follows this shape:

```ts
const actor = await requireAccessContext();
const input = UpdateOrderInput.parse(rawInput);

return unitOfWork(async (session) => {
  const order = await orderRepository.findAuthorizedById(
    actor,
    "orders.updateDraft",
    input.orderId,
    session,
  );

  orderPolicy.assertFields(actor, order, Object.keys(input.patch));
  orderStateMachine.assertTransition(order, input.targetStatus, actor);

  const updated = await orderRepository.updateWithExpectedRevision(
    order.id,
    order.revision,
    mapAllowedOrderPatch(input),
    session,
  );

  await auditRepository.append(
    redactedOrderAudit(order, updated, actor),
    session,
  );
  await outboxRepository.enqueue(orderChangedEvent(updated, actor), session);
  return orderPolicy.project(actor, updated);
});
```

Do not expose a generic `update(resource, patch)` action, generic role-name check, or unrestricted Mongoose filter to route code.

## 12. Navigation and UI behavior

- Server-rendered admin navigation can use effective permissions to omit inaccessible sections.
- Buttons can be disabled/hidden for UX, but the action still reauthorizes.
- Tables must not request or receive columns the user cannot view.
- Reports/charts omit protected series at the query layer and keep their accessible table representation equally redacted.
- A language switch, public page, or signed media URL never grants admin access.

## 13. Required authorization tests

Unit tests use table-driven cases covering every matrix row that has a nontrivial scope or sensitive projection. Minimum integration/E2E coverage:

1. Pending and suspended Google users cannot read admin data.
2. A user with two roles in different units receives the union only in the relevant unit.
3. `own` cannot be bypassed by sending another `ownerUserId`.
4. An assigned-unit list, count, autocomplete and export all exclude another unit.
5. A cross-unit transfer fails when either source or destination is outside scope.
6. Production Unit sees assigned work but not selling price, profit, salary, or customer-private fields.
7. Warehouse Manager sees quantity but not inventory value.
8. Factory Accountant can submit but cannot approve/post their own expense.
9. Supplier Manager cannot approve their own price change or advance.
10. Content Editor can submit but cannot publish or rollback a collection.
11. Order Manager can request but cannot approve a price adjustment or final cancellation.
12. Company Accountant can read/post finance but cannot manage roles or publish content.
13. Report Viewer cannot mutate records and sees profit only when separately granted.
14. Director cannot create/manage a Super Admin grant.
15. Role change increments authorization version and invalidates stale access.
16. Sensitive document generation/download requires both source access and sensitive-field permission.
17. Failed authorization and role changes create redacted audit events.

At least one Playwright scenario must use two business units and two different roles to prove server-side denial, rather than only checking that a button is hidden.
