import "server-only";

import type { AuditRepository } from "@/domains/audit/contracts";
import type { Permission } from "@/domains/identity/permissions";
import {
  SupplierCommandError,
  supplierWriteInputSchema,
  type SupplierListFilter,
  type SupplierRecordDto,
  type SupplierStatus,
  type SupplierStore,
} from "@/domains/suppliers/contracts";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";

export type SupplierCommandServiceDependencies = {
  store: SupplierStore;
  auditRepository: AuditRepository;
  now?: () => Date;
};

export const SUPPLIER_RESOURCE_TYPE = "supplier";

/**
 * Supplier master data commands. Suppliers are global (not tied to a business
 * unit), so every write re-asserts the exact permission on the context the
 * caller guarded with.
 */
export class SupplierCommandService {
  private readonly dependencies: SupplierCommandServiceDependencies;

  constructor(dependencies: SupplierCommandServiceDependencies) {
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

  async create(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<SupplierRecordDto> {
    this.assertHolds(context, "suppliers.create");
    const input = supplierWriteInputSchema.parse(rawInput);

    const record = await this.dependencies.store.insert({
      ...input,
      createdBy: context.userId,
    });

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "supplier.created",
      resourceType: SUPPLIER_RESOURCE_TYPE,
      resourceId: record.id,
      requestId: context.requestId,
      metadata: { code: record.code, name: record.name },
      occurredAt: this.now(),
    });

    return record;
  }

  async update(
    context: AccessContext,
    input: { supplierId: string; expectedRevision: number; fields: unknown },
  ): Promise<SupplierRecordDto> {
    this.assertHolds(context, "suppliers.update");
    const fields = supplierWriteInputSchema.parse(input.fields);

    const existing = await this.dependencies.store.findById(input.supplierId);
    if (!existing) {
      throw new SupplierCommandError("NOT_FOUND", "Supplier not found.");
    }

    const updated = await this.dependencies.store.update({
      supplierId: existing.id,
      expectedRevision: input.expectedRevision,
      fields,
      updatedBy: context.userId,
    });
    if (!updated) {
      throw new SupplierCommandError(
        "REVISION_CONFLICT",
        "The supplier changed while this form was on screen.",
      );
    }

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "supplier.updated",
      resourceType: SUPPLIER_RESOURCE_TYPE,
      resourceId: existing.id,
      requestId: context.requestId,
      changes: {
        before: { code: existing.code, name: existing.name },
        after: { code: updated.code, name: updated.name },
      },
      occurredAt: this.now(),
    });

    return updated;
  }

  async setStatus(
    context: AccessContext,
    input: {
      supplierId: string;
      expectedRevision: number;
      status: SupplierStatus;
    },
  ): Promise<SupplierRecordDto> {
    this.assertHolds(context, "suppliers.archive");

    const existing = await this.dependencies.store.findById(input.supplierId);
    if (!existing) {
      throw new SupplierCommandError("NOT_FOUND", "Supplier not found.");
    }

    const updated = await this.dependencies.store.setStatus({
      supplierId: existing.id,
      expectedRevision: input.expectedRevision,
      status: input.status,
      updatedBy: context.userId,
    });
    if (!updated) {
      throw new SupplierCommandError(
        "REVISION_CONFLICT",
        "The supplier changed while this form was on screen.",
      );
    }

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action:
        input.status === "archived"
          ? "supplier.archived"
          : "supplier.restored",
      resourceType: SUPPLIER_RESOURCE_TYPE,
      resourceId: existing.id,
      requestId: context.requestId,
      changes: { before: existing.status, after: updated.status },
      occurredAt: this.now(),
    });

    return updated;
  }

  async list(filter: SupplierListFilter = {}): Promise<SupplierRecordDto[]> {
    return this.dependencies.store.list(filter);
  }

  async findById(supplierId: string): Promise<SupplierRecordDto | null> {
    return this.dependencies.store.findById(supplierId);
  }
}
