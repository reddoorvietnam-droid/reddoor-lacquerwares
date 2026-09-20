# Production-site contracts and payments ("Hợp đồng cơ sở")

Built 2026-09-14 from the Director's answers of the same day.

## What it covers

- **Purchase contract with a production site** (hợp đồng mua hàng cơ sở): signed by the Factory Manager. Holds the site, an optional link to an open sales order, lines (item code, kind of goods, quantity or blank, unit, VND unit price), start date, delivery date, note, and files (signed contract, other).
- **Payment to a site** (thanh toán cơ sở): Factory Manager proposes → Factory Accountant checks → Company Accountant approves → Director approves → Factory Accountant marks paid.
- **Site balances** (công nợ cơ sở): per site, value of active contracts, paid, approved-but-unpaid, still owed.

Production sites are the materials module's `MaterialFacility` master (`readLookups()`), not the supplier list.

## Records

| Collection          | Code                           | Notes                                                                                                      |
| ------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `facilitycontracts` | `HDCS-YYYYMMDD-XXXX` or manual | `status: draft → active`, or `cancelled` (with reason). `revision` pins Director decisions.                |
| `facilitypayments`  | `DNTT-YYYYMMDD-XXXX`           | `status: proposed → checked → accountantApproved → paid`, or `rejected` (terminal, with reason and stage). |

## Rules

- **Previous price** of a line: the unit price of the same item code (trimmed, upper-cased) on the most recently activated _other_ active contract, any site. Recomputed on every draft save, on the draft's page, and again at activation.
- A line **exceeds** when a previous price exists and the new price is higher. A draft with any exceeding line activates only with an approved `facilityContract.priceIncrease` decision pinned to the contract's revision. Editing the draft invalidates the decision.
- **Contract value** = Σ quantity × unit price, only when every line has a quantity; otherwise unknown.
- **Propose** only on an active contract. When the value is known, all non-rejected requests including the new one must not exceed it (`AMOUNT_EXCEEDS_CONTRACT`).
- **Separation of duties**: the proposer cannot check (`SELF_CHECK`); the proposer or checker cannot approve or re-request (`SELF_APPROVAL`); the Director queue refuses the requester as decider.
- **Approve** moves to `accountantApproved` and raises `facilityPayment.approval` pinned to the new revision. After a Director rejection the accountant may raise it again ("Trình lại Giám đốc").
- **Reject**: `proposed` by a `facilityPayments.check` holder; `checked` / `accountantApproved` by a `facilityPayments.approve` holder. Reason required.
- **Mark paid** needs the approved Director decision pinned to the revision and a payment date.
- **Cancel** a contract (draft or active) needs a reason and is refused while any payment request on it is not rejected.
- **Deadline warning** "Giao sau hạn giao của đơn" when the linked order has a delivery due date earlier than the contract's delivery date.
- No finance ledger entry is created when a payment is marked paid (open question).
- No profit is computed; purchase price is readable by every role with `facilityContracts.read`.

## Permissions

| Permission                  | Held by (besides the Director)                          |
| --------------------------- | ------------------------------------------------------- |
| `facilityContracts.read`    | Factory Manager, Factory Accountant, Company Accountant |
| `facilityContracts.manage`  | Factory Manager                                         |
| `facilityPayments.propose`  | Factory Manager                                         |
| `facilityPayments.check`    | Factory Accountant                                      |
| `facilityPayments.markPaid` | Factory Accountant                                      |
| `facilityPayments.approve`  | Company Accountant                                      |

## Files

- Domain: `src/domains/facility-contracts/` (`contracts.ts` types, schemas, pure helpers; `service.ts`; `persistence/`; `runtime.ts`).
- UI: `src/app/[locale]/admin/(portal)/facility-contracts/` (list with tabs `?tab=contracts|payments|balances`, `[contractId]` detail, `actions.ts`).
- Guide: `src/components/admin/guide/screens/facility-contracts.ts`.
- Tests: `tests/unit/facility-contracts-*.test.ts`, fakes in `tests/unit/helpers/facility-contract-fakes.ts`.

## Open

- Import of the existing debt Excel file (not provided yet).
- Whether a paid site payment should also be an order cost / ledger expense.
- A payment rejected by an accountant while its Director request is still pending leaves that request in the queue; approving it later has no effect (mark paid refuses a rejected payment).
- Two simultaneous proposals on the same contract can together exceed the contract value (the limit is checked per request, not under a lock).
