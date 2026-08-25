# Operating Structure and Operational Forms

Status: authoritative description of the company's operating structure as encoded in `src/domains/organization/responsibilities.ts`. Role keys referenced here are defined in `src/domains/identity/role-definitions.ts`; permissions are defined in `src/domains/identity/permissions.ts`.

## 1. Positions, not people

The organisation chart agreed with the client names individuals. This registry deliberately does not.

A position is a stable unit of accountability: a set of responsibilities, the data it must keep current, and the roles that carry the permissions needed to do the work. A person occupies a position by holding an `AccessGrant` for its roles. Nothing in `src/` contains a personal name, email address, or employee identifier as a business rule.

The consequence is the point of the design:

- A handover — someone leaves, someone joins, someone covers a colleague for a month — is a grant change made by an authorized role manager. It is not a code change, a deployment, or a migration.
- One person may hold several positions. Two positions in this registry already combine more than one role for exactly that reason (see section 2).
- Two people may hold the same position in different business units, because a grant carries a business-unit scope.
- Audit records reference the acting user, while policy references only permissions. Neither depends on a name being present in the source tree.

`ADMIN_EMAILS` is the single exception and it is bootstrap-only: it may activate the first Super Admin when none exists. It is not a position and must never be used as an authorization check. See `docs/RBAC.md` section 1.

## 2. Positions

Seven positions are registered. `roleKeys` lists the roles granted to whoever holds the position; a position with two role keys is a deliberate combination confirmed by the working group, not an oversight.

| Position key         | Position (vi / en)                                           | Roles granted                            | Responsibilities                                                                                                                                                             | Data owned                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `director`           | Giám đốc / Director                                          | `DIRECTOR`                               | Approves every significant operation in the system; approves orders, selling price, and payment terms; confirms production priority; reads consolidated and profit reporting | Orders placed, dispatched, deposited, and paid; approval decisions and rejection reasons                                                                                        |
| `company-accountant` | Kế toán công ty / Company Accountant                         | `COMPANY_ACCOUNTANT`                     | Accounting and finance; payment records; import and export files; payroll confirmation; monthly profit and loss reporting                                                    | Loading plan and trade documents; customer payments and receivables; import data (declared value and permits); customs declarations and import/export documents                 |
| `factory-manager`    | Quản lý nhà máy / Factory Manager                            | `FACTORY_MANAGER`                        | Production organisation; factory cost; sub-workshop management; production planning; quality tracking                                                                        | Workshop income and expenditure; production, printing, moulding, and loading schedules                                                                                          |
| `factory-accountant` | Kế toán nhà máy / Factory Accountant                         | `FACTORY_ACCOUNTANT`, `SUPPLIER_MANAGER` | Factory cost control; factory and sub-workshop cost reporting; labor cost reporting; reporting to the Company Accountant                                                     | Supplier directory and supplier count; active contracts (received date, delivery date, order value); advances, supplements, and unit-price changes; payables by production site |
| `warehouse-manager`  | Thủ kho / Quản lý kho — Storekeeper / Warehouse Manager      | `WAREHOUSE_MANAGER`                      | Inventory management; labor records; internal sales; material receipt and issue; stock reconciliation                                                                        | Inventory on hand, issued, and received; workshop labor headcount                                                                                                               |
| `product-designer`   | Nhân viên thiết kế / Product Designer                        | `PRODUCT_DESIGNER`, `CONTENT_EDITOR`     | Sample order management; product development; sample preparation; tracking samples against customer requirements                                                             | Product and collection imagery; website content data                                                                                                                            |
| `production-unit`    | Đơn vị sản xuất / Xưởng phụ — Production Unit / Sub-workshop | `PRODUCTION_UNIT`                        | Executes production; labor productivity; material usage; quality assurance; on-plan delivery                                                                                 | Progress on assigned work; quality evidence                                                                                                                                     |

Two combinations are recorded in the code with the reason stated:

- `factory-accountant` also holds `SUPPLIER_MANAGER`, because the same person coordinates suppliers and material purchasing.
- `product-designer` also holds `CONTENT_EDITOR`, because the same person owns product imagery and collection artwork on the public website.

If either combination is later split between two people, the fix is to issue the second role as a separate grant to the second user and remove it from the first. The registry entry may then drop the extra role key; no policy code changes.

### Roles without a position

Three system roles are intentionally not attached to a position in this registry:

- `SUPER_ADMIN` — platform administration, not an operating position on the company chart.
- `ORDER_MANAGER` — the confirmed organisation chart has no separate order-management position, so the registry does not invent one. The role exists and owns two stages of the sales-order process (`received` and `loadingScheduled`, see `docs/ORDER_WORKFLOW.md`); it is issued as a grant to whoever performs that work.
- `REPORT_VIEWER` — a read-only grant issued to an observer, not a role on the chart.

`positionsForRole()` returns an empty list for these, which is the honest answer rather than a fabricated mapping.

## 3. Operational forms

The working group listed the paper forms the company runs on today and asked for those forms to be rebuilt in the system. The request was explicitly for the **forms themselves**, not for their historical data to be migrated. No import path for existing paper records is planned or implied.

`status` in the registry is defined narrowly:

- `available` — the screen is built and persists records.
- `planned` — only the definition in `operationalForms` exists.

**Every form below is currently `planned`.** The definitions exist, carry an owning position and a required permission, and are type-checked against the permission catalog. No screen has been built and nothing is persisted.

| Form key               | Form (vi / en)                                  | Owning position      | Permission required           | Status    |
| ---------------------- | ----------------------------------------------- | -------------------- | ----------------------------- | --------- |
| `supplier-contract`    | Form hợp đồng / Contract form                   | `factory-manager`    | `procurement.create`          | `planned` |
| `goods-inspection`     | Form kiểm hàng / Goods inspection form          | `factory-manager`    | `production.recordQcEvidence` | `planned` |
| `lacquer-issue`        | Form giao sơn / Lacquer issue form              | `warehouse-manager`  | `inventory.issue`             | `planned` |
| `raw-body-issue`       | Form giao mộc / Raw body issue form             | `warehouse-manager`  | `inventory.issue`             | `planned` |
| `raw-body-inspection`  | Form kiểm mộc / Raw body inspection form        | `warehouse-manager`  | `production.recordQcEvidence` | `planned` |
| `lacquer-sale`         | Form bán sơn / Lacquer sale form                | `warehouse-manager`  | `inventory.issue`             | `planned` |
| `payroll-sheet`        | Bảng lương / Payroll sheet                      | `warehouse-manager`  | `labor.manageRecords`         | `planned` |
| `site-payables`        | Công nợ các cơ sở / Payables by production site | `factory-accountant` | `payables.read`               | `planned` |
| `lacquer-purchase`     | Mua sơn / Lacquer purchase                      | `factory-accountant` | `procurement.create`          | `planned` |
| `packaging-order`      | Đặt bao bì / Packaging order                    | `factory-accountant` | `procurement.create`          | `planned` |
| `incoming-cash-report` | Báo cáo tiền về / Incoming cash report          | `company-accountant` | `payments.read`               | `planned` |
| `account-report`       | Báo cáo tài khoản / Account report              | `company-accountant` | `finance.readCost`            | `planned` |
| `receivables-report`   | Báo cáo công nợ / Receivables report            | `company-accountant` | `receivables.read`            | `planned` |
| `payroll-report`       | Báo cáo lương / Payroll report                  | `company-accountant` | `labor.readSalary`            | `planned` |
| `sample-progress`      | Form tiến độ mẫu / Sample progress form         | `product-designer`   | `samples.update`              | `planned` |
| `sample-order`         | Đơn hàng mẫu / Sample order                     | `product-designer`   | `samples.create`              | `planned` |
| `sample-handover`      | Giao mẫu / Sample handover                      | `product-designer`   | `samples.addRevision`         | `planned` |

Notes on the mapping:

- The `permission` column is the permission required to use the form. It is not a substitute for the resource policy: a form that writes an inventory movement still passes through the same scope, field, workflow, and approval checks as any other write of that record.
- `payroll-sheet` requires `labor.manageRecords` (recording the sheet), while `payroll-report` requires `labor.readSalary` (reading salary values). The split is deliberate: the Warehouse Manager maintains labor records without holding salary read access, which the Factory Accountant and Company Accountant do hold.
- `site-payables` is a report over payables and requires only `payables.read`; it does not confer approval of any payable.
- `formsForPosition(positionKey)` returns the forms owned by a position and is the intended source for a per-position form index once screens exist.

## 4. Filling a position

To place a person in a position:

1. Invite or activate the user through the identity lifecycle in `docs/RBAC.md` section 10. An uninvited Google identity stays `pending` and sees only the access-pending experience.
2. Read the position's `roleKeys` from `organizationPositions`.
3. Create one `AccessGrant` per role key, with the business-unit scope the position needs. A null business unit is a deliberately global grant issued by an authorized role manager, never a wildcard accepted from a form.
4. Verify the grant against the anti-escalation rules in `docs/RBAC.md` section 9: no user may grant beyond their own effective ceiling, no user may grant to themselves, and only `users.manageSuperAdmin` may touch a Super Admin grant.

To hand a position over, revoke the outgoing holder's grants and issue the same grants to the incoming holder. Suspending a user immediately revokes active sessions or increments `authzVersion`.

What must never happen:

- Hard-coding a name, email, or user ID into a policy, a workflow stage, a form definition, or a report filter.
- Treating a role key as a business rule in application code. Policies check permissions; the only role-name check permitted is the protected Super Admin lifecycle, plus `approvalDecidingRoleKeys`, which exists so the approval service never has to test a role name inline.
- Widening a role definition to fit one person. If a holder needs an extra capability, issue an additional grant for the role that already carries it.

## 5. Implementation status

The registry in `src/domains/organization/responsibilities.ts` is a typed definition module. It has no persistence.

`/admin/organization` renders this registry as a read-only reference page: the positions with their roles, responsibilities and owned data, and the forms with their owners, permissions and `planned` status. It reads the definition module directly, reads no data-access layer, and writes nothing.

No operational form has a screen. No form persists a record. Filling a position still means issuing an `AccessGrant`, and no admin screen creates or revokes a grant yet — `scripts/seed.ts` provisions the role definitions themselves, not the grants that attach a person to them.

`docs/IMPLEMENTATION_STATUS.md` records the exact state. Nothing in this document should be read as a claim that a position is staffed or a form is operational in the running system.
