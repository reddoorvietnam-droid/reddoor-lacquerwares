import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  dateInputValue,
  formatDate,
} from "@/app/[locale]/admin/(portal)/finance/shared";
import {
  attachImportShipmentDocumentAction,
  removeImportShipmentDocumentAction,
  updateImportShipmentAction,
} from "@/app/[locale]/admin/(portal)/import-shipments/actions";
import {
  buttonClass,
  cardClass,
  dangerButtonClass,
  fieldClass,
  headingClass,
  labelClass,
  mutedBadgeClass,
  okBadgeClass,
  warnBadgeClass,
} from "@/app/[locale]/admin/(portal)/orders/[orderId]/sections/styles";
import { DocumentUpload } from "@/components/admin/document-upload";
import {
  hasImportDeclaration,
  importShipmentDocumentKinds,
  importShipmentDocumentLabels,
} from "@/domains/import-shipments/contracts";
import { importShipmentCommandService } from "@/domains/import-shipments/runtime";
import {
  ContentAccessDeniedError,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { getCloudinaryEnv } from "@/lib/env/server";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";
import { formatBytes, storedDocumentUrl } from "@/lib/media/document-url";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    back: "← Hàng nhập khẩu",
    eyebrow: "Lô hàng nhập",
    missingDeclaration: "Thiếu tờ khai",
    infoTitle: "Thông tin lô hàng",
    code: "Mã lô hàng",
    declarationNumber: "Số tờ khai",
    declaredOn: "Ngày tờ khai",
    supplierName: "Nhà cung cấp nước ngoài",
    goodsDescription: "Hàng hóa",
    note: "Ghi chú",
    notSet: "Chưa nhập",
    save: "Lưu thông tin",
    documentsTitle: "Chứng từ của lô hàng",
    documentsHint:
      "Mỗi loại chứng từ nhận nhiều tệp PDF hoặc ảnh (JPG, PNG, WEBP).",
    onFile: "Đã có",
    missing: "Chưa có",
    upload: "Tải lên",
    remove: "Gỡ",
    removeConfirm: "Gỡ tệp này khỏi lô hàng?",
    removeYes: "Gỡ tệp",
    nothing: "Chưa có tệp nào.",
    notices: {
      created: "Đã thêm lô hàng nhập. Tải chứng từ lên ở thẻ bên dưới.",
      saved: "Đã lưu thông tin lô hàng.",
      documentRemoved: "Đã gỡ tệp.",
    } as Record<string, string>,
    errorLead: "Thao tác không thành công:",
    errors: {
      FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
      NOT_FOUND: "Không tìm thấy lô hàng hoặc tệp.",
      DUPLICATE_CODE: "Mã lô hàng này đã có.",
      REVISION_CONFLICT:
        "Lô hàng đã thay đổi trong lúc bạn thao tác. Trang đã tải lại, kiểm tra rồi thử lại.",
      INVALID_INPUT:
        "Dữ liệu nhập chưa hợp lệ (mã lô hàng chỉ gồm chữ, số và dấu gạch; phải có nhà cung cấp và hàng hóa).",
      UNAVAILABLE: "Hệ thống tạm thời không phản hồi.",
    } as Record<string, string>,
  },
  en: {
    back: "← Imports",
    eyebrow: "Import shipment",
    missingDeclaration: "No declaration",
    infoTitle: "Shipment details",
    code: "Shipment code",
    declarationNumber: "Declaration number",
    declaredOn: "Declaration date",
    supplierName: "Foreign supplier",
    goodsDescription: "Goods",
    note: "Note",
    notSet: "Not set",
    save: "Save details",
    documentsTitle: "Shipment documents",
    documentsHint:
      "Each kind of document takes several PDF or image files (JPG, PNG, WEBP).",
    onFile: "On file",
    missing: "Missing",
    upload: "Upload",
    remove: "Remove",
    removeConfirm: "Remove this file from the shipment?",
    removeYes: "Remove file",
    nothing: "No file yet.",
    notices: {
      created: "Import shipment added. Upload its documents below.",
      saved: "Shipment details saved.",
      documentRemoved: "File removed.",
    } as Record<string, string>,
    errorLead: "The action failed:",
    errors: {
      FORBIDDEN: "You are not permitted to perform this action.",
      NOT_FOUND: "The shipment or file was not found.",
      DUPLICATE_CODE: "This shipment code already exists.",
      REVISION_CONFLICT:
        "The shipment changed while you were acting. The page has reloaded — review and retry.",
      INVALID_INPUT:
        "The submitted data is not valid (the code takes letters, digits and dashes; supplier and goods are required).",
      UNAVAILABLE: "The system is temporarily unavailable.",
    } as Record<string, string>,
  },
} as const;

export default async function ImportShipmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; shipmentId: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ locale: requestedLocale, shipmentId }, { error, notice }] =
    await Promise.all([params, searchParams]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];

  if (!/^[a-f0-9]{24}$/.test(shipmentId)) notFound();

  let context;
  try {
    context = await requirePermission("importShipments.read", {
      resourceId: shipmentId,
    });
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const shipment = await importShipmentCommandService.findById(
    context,
    shipmentId,
  );
  if (!shipment) notFound();

  const coverages = await resolvePermissionCoverages([
    "importShipments.manage",
  ] as const);
  const canManage =
    coverages["importShipments.manage"].global ||
    coverages["importShipments.manage"].businessUnitIds.length > 0;

  let maxBytes: number | null = null;
  if (canManage) {
    try {
      maxBytes = getCloudinaryEnv().MAX_PDF_UPLOAD_MB * 1024 * 1024;
    } catch {
      maxBytes = null;
    }
  }

  const declared = hasImportDeclaration(shipment);

  return (
    <div>
      <Link
        href={`/${locale}/admin/import-shipments` as Route}
        className="text-charcoal/55 hover:text-burgundy text-sm"
      >
        {text.back}
      </Link>

      <div className="mt-6">
        <p className="eyebrow">{text.eyebrow}</p>
        <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em]">
          <span className="font-mono text-4xl">{shipment.code}</span>
        </h1>
        <p className="text-charcoal/75 mt-3 text-lg">{shipment.supplierName}</p>
        {declared ? null : (
          <p className="mt-2">
            <span className={warnBadgeClass}>{text.missingDeclaration}</span>
          </p>
        )}
      </div>

      {notice && text.notices[notice] ? (
        <p className="border-gold/40 bg-gold/10 text-charcoal/80 mt-6 rounded-2xl border px-5 py-3 text-sm">
          {text.notices[notice]}
        </p>
      ) : null}
      {error ? (
        <p className="border-lacquer/40 bg-lacquer/5 text-lacquer mt-6 rounded-2xl border px-5 py-3 text-sm">
          {text.errorLead} {text.errors[error] ?? text.errors.UNAVAILABLE}
        </p>
      ) : null}

      <section className={`${cardClass} mt-8`}>
        <h2 className={headingClass}>{text.infoTitle}</h2>
        {canManage ? (
          <form action={updateImportShipmentAction} className="mt-5 grid gap-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="shipmentId" value={shipment.id} />
            <input
              type="hidden"
              name="expectedRevision"
              value={shipment.revision}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="edit-code" className={labelClass}>
                  {text.code}
                </label>
                <input
                  id="edit-code"
                  name="code"
                  required
                  maxLength={40}
                  defaultValue={shipment.code}
                  className={`${fieldClass} font-mono uppercase`}
                />
              </div>
              <div>
                <label htmlFor="edit-declaration" className={labelClass}>
                  {text.declarationNumber}
                </label>
                <input
                  id="edit-declaration"
                  name="declarationNumber"
                  maxLength={60}
                  defaultValue={shipment.declarationNumber ?? ""}
                  className={`${fieldClass} font-mono`}
                />
              </div>
              <div>
                <label htmlFor="edit-declared-on" className={labelClass}>
                  {text.declaredOn}
                </label>
                <input
                  id="edit-declared-on"
                  type="date"
                  name="declaredOn"
                  defaultValue={dateInputValue(shipment.declaredOn)}
                  className={fieldClass}
                />
              </div>
            </div>
            <div>
              <label htmlFor="edit-supplier" className={labelClass}>
                {text.supplierName}
              </label>
              <input
                id="edit-supplier"
                name="supplierName"
                required
                maxLength={240}
                defaultValue={shipment.supplierName}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="edit-goods" className={labelClass}>
                {text.goodsDescription}
              </label>
              <textarea
                id="edit-goods"
                name="goodsDescription"
                required
                rows={2}
                maxLength={2000}
                defaultValue={shipment.goodsDescription}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="edit-note" className={labelClass}>
                {text.note}
              </label>
              <textarea
                id="edit-note"
                name="note"
                rows={2}
                maxLength={4000}
                defaultValue={shipment.note ?? ""}
                className={fieldClass}
              />
            </div>
            <div>
              <button type="submit" className={buttonClass}>
                {text.save}
              </button>
            </div>
          </form>
        ) : (
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <dt className="text-charcoal/50">{text.declarationNumber}</dt>
            <dd className="font-mono sm:col-span-2">
              {shipment.declarationNumber ?? text.notSet}
            </dd>
            <dt className="text-charcoal/50">{text.declaredOn}</dt>
            <dd className="sm:col-span-2">
              {shipment.declaredOn
                ? formatDate(shipment.declaredOn, locale)
                : text.notSet}
            </dd>
            <dt className="text-charcoal/50">{text.supplierName}</dt>
            <dd className="sm:col-span-2">{shipment.supplierName}</dd>
            <dt className="text-charcoal/50">{text.goodsDescription}</dt>
            <dd className="whitespace-pre-line sm:col-span-2">
              {shipment.goodsDescription}
            </dd>
            {shipment.note ? (
              <>
                <dt className="text-charcoal/50">{text.note}</dt>
                <dd className="whitespace-pre-line sm:col-span-2">
                  {shipment.note}
                </dd>
              </>
            ) : null}
          </dl>
        )}
      </section>

      <section className={`${cardClass} mt-6`}>
        <h2 className={headingClass}>{text.documentsTitle}</h2>
        <p className="text-charcoal/50 mt-1 text-xs">{text.documentsHint}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {importShipmentDocumentKinds.map((kind) => {
            const files = shipment.documents.filter(
              (document) => document.kind === kind,
            );
            return (
              <div
                key={kind}
                className="border-burgundy/10 rounded-xl border px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">
                      {importShipmentDocumentLabels[kind][locale]}
                    </span>
                    <span
                      className={
                        files.length > 0
                          ? okBadgeClass
                          : kind === "importDeclaration"
                            ? warnBadgeClass
                            : mutedBadgeClass
                      }
                    >
                      {files.length > 0 ? text.onFile : text.missing}
                    </span>
                  </span>
                  {canManage && maxBytes ? (
                    <DocumentUpload
                      locale={locale}
                      target={{
                        kind: "importShipmentDocument",
                        id: shipment.id,
                      }}
                      expectedRevision={shipment.revision}
                      maxBytes={maxBytes}
                      label={text.upload}
                      compact
                      attachAction={attachImportShipmentDocumentAction.bind(
                        null,
                        kind,
                      )}
                    />
                  ) : null}
                </div>
                {files.length === 0 ? (
                  <p className="text-charcoal/45 mt-1 text-xs">
                    {text.nothing}
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {files.map((document) => (
                      <li key={document.id}>
                        <div className="flex flex-wrap items-center gap-3">
                          <a
                            href={storedDocumentUrl(document)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-burgundy font-semibold break-all hover:underline"
                          >
                            {document.label}
                          </a>
                          <span className="text-charcoal/45 text-xs">
                            {document.format.toUpperCase()} ·{" "}
                            {formatBytes(document.bytes)} ·{" "}
                            {formatDate(document.uploadedAt, locale)}
                          </span>
                        </div>
                        {canManage ? (
                          <details className="mt-1">
                            <summary
                              className={`${dangerButtonClass} inline-flex cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
                            >
                              {text.remove}
                            </summary>
                            <form
                              action={removeImportShipmentDocumentAction}
                              className="mt-2 flex flex-wrap items-center gap-2"
                            >
                              <input
                                type="hidden"
                                name="locale"
                                value={locale}
                              />
                              <input
                                type="hidden"
                                name="shipmentId"
                                value={shipment.id}
                              />
                              <input
                                type="hidden"
                                name="expectedRevision"
                                value={shipment.revision}
                              />
                              <input
                                type="hidden"
                                name="documentId"
                                value={document.id}
                              />
                              <span className="text-charcoal/70 text-xs">
                                {text.removeConfirm}
                              </span>
                              <button
                                type="submit"
                                className={dangerButtonClass}
                              >
                                {text.removeYes}
                              </button>
                            </form>
                          </details>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
