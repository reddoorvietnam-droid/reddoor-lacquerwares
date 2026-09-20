import "server-only";

import type { AuditRepository } from "@/domains/audit/contracts";
import type { Permission } from "@/domains/identity/permissions";
import {
  createImportShipmentInputSchema,
  generateImportShipmentCode,
  ImportShipmentCommandError,
  importShipmentDocumentInputSchema,
  removeImportShipmentDocumentInputSchema,
  updateImportShipmentInputSchema,
  type ImportShipmentListFilter,
  type ImportShipmentRecordDto,
  type ImportShipmentStore,
} from "@/domains/import-shipments/contracts";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";

export type ImportShipmentCommandServiceDependencies = {
  store: ImportShipmentStore;
  auditRepository: AuditRepository;
  /**
   * Root folder of the storage provider (`CLOUDINARY_UPLOAD_FOLDER`). An
   * attached file must sit inside `<root>/import-shipments/<shipmentId>/`,
   * the folder the upload signature binds to that shipment.
   */
  uploadFolder: () => string;
  now?: () => Date;
};

export const IMPORT_SHIPMENT_RESOURCE_TYPE = "importShipment";

/**
 * Import shipment files. Company-wide books with no business units, so
 * every call re-asserts the exact permission on the context the caller
 * guarded with: `importShipments.read` to read, `importShipments.manage` for
 * every change. Every change is audited.
 */
export class ImportShipmentCommandService {
  private readonly dependencies: ImportShipmentCommandServiceDependencies;

  constructor(dependencies: ImportShipmentCommandServiceDependencies) {
    this.dependencies = dependencies;
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private assertHolds(context: AccessContext, permission: Permission): void {
    const holds = context.permissions.some(
      (candidate) => candidate.permission === permission,
    );
    if (!holds || context.userStatus !== "active") {
      throw new ContentAccessDeniedError("PERMISSION_DENIED");
    }
  }

  private async load(shipmentId: string): Promise<ImportShipmentRecordDto> {
    const record = await this.dependencies.store.findById(shipmentId);
    if (!record) {
      throw new ImportShipmentCommandError(
        "NOT_FOUND",
        "Import shipment not found.",
      );
    }
    return record;
  }

  private moved(
    updated: ImportShipmentRecordDto | null,
  ): ImportShipmentRecordDto {
    if (!updated) {
      throw new ImportShipmentCommandError(
        "REVISION_CONFLICT",
        "The import shipment changed while this form was on screen.",
      );
    }
    return updated;
  }

  private async audit(
    context: AccessContext,
    record: ImportShipmentRecordDto,
    action: string,
    extra: {
      metadata?: Record<string, unknown>;
      changes?: { before: unknown; after: unknown };
    } = {},
  ): Promise<void> {
    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action,
      resourceType: IMPORT_SHIPMENT_RESOURCE_TYPE,
      resourceId: record.id,
      requestId: context.requestId,
      ...(extra.metadata ? { metadata: extra.metadata } : {}),
      ...(extra.changes ? { changes: extra.changes } : {}),
      occurredAt: this.now(),
    });
  }

  async create(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<ImportShipmentRecordDto> {
    this.assertHolds(context, "importShipments.manage");
    const input = createImportShipmentInputSchema.parse(rawInput);

    const manualCode = input.code;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const code = manualCode ?? generateImportShipmentCode(this.now());
      try {
        const record = await this.dependencies.store.insert({
          code,
          declarationNumber: input.declarationNumber,
          declaredOn: input.declaredOn,
          supplierName: input.supplierName,
          goodsDescription: input.goodsDescription,
          note: input.note,
          createdBy: context.userId,
        });

        await this.audit(context, record, "importShipment.created", {
          metadata: {
            code: record.code,
            declarationNumber: record.declarationNumber,
          },
        });

        return record;
      } catch (error) {
        lastError = error;
        const retryable =
          manualCode === null &&
          error instanceof ImportShipmentCommandError &&
          error.code === "DUPLICATE_CODE";
        if (!retryable) throw error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new ImportShipmentCommandError(
          "DUPLICATE_CODE",
          "Could not allocate a unique import shipment code.",
        );
  }

  async update(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<ImportShipmentRecordDto> {
    this.assertHolds(context, "importShipments.manage");
    const input = updateImportShipmentInputSchema.parse(rawInput);

    const existing = await this.load(input.shipmentId);

    const updated = this.moved(
      await this.dependencies.store.update({
        shipmentId: existing.id,
        expectedRevision: input.expectedRevision,
        fields: {
          code: input.code,
          declarationNumber: input.declarationNumber,
          declaredOn: input.declaredOn,
          supplierName: input.supplierName,
          goodsDescription: input.goodsDescription,
          note: input.note,
        },
        updatedBy: context.userId,
      }),
    );

    await this.audit(context, existing, "importShipment.updated", {
      changes: {
        before: {
          code: existing.code,
          declarationNumber: existing.declarationNumber,
          declaredOn: existing.declaredOn?.toISOString() ?? null,
          supplierName: existing.supplierName,
          goodsDescription: existing.goodsDescription,
          note: existing.note,
        },
        after: {
          code: updated.code,
          declarationNumber: updated.declarationNumber,
          declaredOn: updated.declaredOn?.toISOString() ?? null,
          supplierName: updated.supplierName,
          goodsDescription: updated.goodsDescription,
          note: updated.note,
        },
      },
    });

    return updated;
  }

  /**
   * Records a document already stored at the storage provider; this only
   * attaches the descriptor under its kind.
   */
  async attachDocument(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<ImportShipmentRecordDto> {
    this.assertHolds(context, "importShipments.manage");
    const input = importShipmentDocumentInputSchema.parse(rawInput);

    const existing = await this.load(input.shipmentId);

    // The browser reports the upload result, so trust nothing beyond a file
    // inside this shipment's own signed folder. A public id aimed at another
    // shipment or another module's folder is refused outright.
    const expectedPrefix = `${this.dependencies.uploadFolder()}/import-shipments/${existing.id}/`;
    if (!input.publicId.startsWith(expectedPrefix)) {
      throw new ImportShipmentCommandError(
        "INVALID_INPUT",
        "The document is not stored in this shipment's folder.",
      );
    }

    const updated = this.moved(
      await this.dependencies.store.addDocument({
        shipmentId: existing.id,
        expectedRevision: input.expectedRevision,
        document: {
          kind: input.kind,
          publicId: input.publicId,
          assetVersion: input.assetVersion,
          format: input.format,
          bytes: input.bytes,
          label: input.label,
          uploadedBy: context.userId,
          uploadedAt: this.now(),
        },
        updatedBy: context.userId,
      }),
    );

    await this.audit(context, existing, "importShipment.documentAttached", {
      metadata: { kind: input.kind, label: input.label, format: input.format },
    });

    return updated;
  }

  async removeDocument(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<ImportShipmentRecordDto> {
    this.assertHolds(context, "importShipments.manage");
    const input = removeImportShipmentDocumentInputSchema.parse(rawInput);

    const existing = await this.load(input.shipmentId);
    const document = existing.documents.find(
      (candidate) => candidate.id === input.documentId,
    );
    if (!document) {
      throw new ImportShipmentCommandError("NOT_FOUND", "Document not found.");
    }

    const updated = this.moved(
      await this.dependencies.store.removeDocument({
        shipmentId: existing.id,
        expectedRevision: input.expectedRevision,
        documentId: document.id,
        updatedBy: context.userId,
      }),
    );

    await this.audit(context, existing, "importShipment.documentRemoved", {
      metadata: {
        kind: document.kind,
        label: document.label,
        publicId: document.publicId,
      },
    });

    return updated;
  }

  async list(
    context: AccessContext,
    filter: ImportShipmentListFilter = {},
  ): Promise<ImportShipmentRecordDto[]> {
    this.assertHolds(context, "importShipments.read");
    return this.dependencies.store.list(filter);
  }

  async findById(
    context: AccessContext,
    shipmentId: string,
  ): Promise<ImportShipmentRecordDto | null> {
    this.assertHolds(context, "importShipments.read");
    return this.dependencies.store.findById(shipmentId);
  }
}
