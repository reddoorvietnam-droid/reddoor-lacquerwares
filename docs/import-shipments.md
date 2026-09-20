# Import shipments ("Hàng nhập khẩu")

Built 2026-09-14 from the Director's answer: imports are declared in separate customs software, but **every import document is kept on the web**.

## What it is

A file folder per import shipment. No workflow, no status, no delete, no link to stock, payables or the cash book.

Record (collection `importshipments`):

| Field                    | Notes                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `code`                   | Unique, upper-case. Blank on create → `NK-YYYYMMDD-XXXX` (random tail, retried on collision). Editable. |
| `declarationNumber`      | Số tờ khai, optional.                                                                                   |
| `declaredOn`             | Ngày tờ khai, optional date (UTC midnight).                                                             |
| `supplierName`           | Foreign supplier, free text, required. Not the `suppliers` master.                                      |
| `goodsDescription`       | Required.                                                                                               |
| `note`                   | Optional.                                                                                               |
| `documents[]`            | `{ id, kind, publicId, assetVersion, format, bytes, label, uploadedBy, uploadedAt }`                    |
| actor fields, `revision` | Optimistic concurrency on every write.                                                                  |

Document kinds: `importDeclaration` (Tờ khai nhập khẩu), `commercialInvoice` (Invoice), `packingList` (Packing List), `billOfLading` (B/L), `certificateOfOrigin` (C/O), `contract` (Hợp đồng / PO), `payment` (Chứng từ thanh toán), `other` (Chứng từ khác).

## Permissions

- `importShipments.read`: list and detail. COMPANY_ACCOUNTANT and DIRECTOR.
- `importShipments.manage`: create, update, attach and remove documents. COMPANY_ACCOUNTANT and DIRECTOR.
- Other roles get a 404 on both pages.

## Files

- `src/domains/import-shipments/contracts.ts`: kinds, labels, DTO, store interface, zod schemas, code generator, `hasImportDeclaration`, `matchesImportShipmentSearch`.
- `src/domains/import-shipments/service.ts`: `ImportShipmentCommandService`. It re-asserts the permission on each call and audits `importShipment.created`, `.updated`, `.documentAttached` and `.documentRemoved`.
- `src/domains/import-shipments/persistence/{models,mongo-store}.ts`, `runtime.ts`.
- `src/app/[locale]/admin/(portal)/import-shipments/`: `page.tsx` (list, search `?q=`, inline create form), `[shipmentId]/page.tsx` (edit form, per-kind documents checklist), `actions.ts`.
- Uploads: `DocumentUpload` with target `{ kind: "importShipmentDocument", id }` (signature requires `importShipments.manage`, folder `import-shipments/<id>`) and `attachAction = attachImportShipmentDocumentAction.bind(null, kind)`.
- Guide: `src/components/admin/guide/screens/import-shipments.ts`.
- Tests: `tests/unit/import-shipments-service.test.ts`.
