import "server-only";

import type { AuditRepository } from "@/domains/audit/contracts";
import {
  CustomerCommandError,
  customerWriteInputSchema,
  type CustomerListFilter,
  type CustomerRecordDto,
  type CustomerStatus,
  type CustomerStore,
} from "@/domains/customers/contracts";
import type { Permission } from "@/domains/identity/permissions";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";

export type CustomerCommandServiceDependencies = {
  store: CustomerStore;
  auditRepository: AuditRepository;
  now?: () => Date;
};

export const CUSTOMER_RESOURCE_TYPE = "customer";

/**
 * Customer master data commands. The list is global (customers are not tied
 * to a business unit), so every write re-asserts the exact permission on the
 * context the caller guarded with. Contact details never enter the audit
 * trail: audit readers are not guaranteed to hold `customers.readSensitive`.
 */
export class CustomerCommandService {
  private readonly dependencies: CustomerCommandServiceDependencies;

  constructor(dependencies: CustomerCommandServiceDependencies) {
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
  ): Promise<CustomerRecordDto> {
    this.assertHolds(context, "customers.create");
    const input = customerWriteInputSchema.parse(rawInput);

    const record = await this.dependencies.store.insert({
      ...input,
      createdBy: context.userId,
    });

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "customer.created",
      resourceType: CUSTOMER_RESOURCE_TYPE,
      resourceId: record.id,
      requestId: context.requestId,
      metadata: { code: record.code, name: record.name },
      occurredAt: this.now(),
    });

    return record;
  }

  async update(
    context: AccessContext,
    input: { customerId: string; expectedRevision: number; fields: unknown },
  ): Promise<CustomerRecordDto> {
    this.assertHolds(context, "customers.update");
    const fields = customerWriteInputSchema.parse(input.fields);

    const existing = await this.dependencies.store.findById(input.customerId);
    if (!existing) {
      throw new CustomerCommandError("NOT_FOUND", "Customer not found.");
    }

    const updated = await this.dependencies.store.update({
      customerId: existing.id,
      expectedRevision: input.expectedRevision,
      fields,
      updatedBy: context.userId,
    });
    if (!updated) {
      throw new CustomerCommandError(
        "REVISION_CONFLICT",
        "The customer changed while this form was on screen.",
      );
    }

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "customer.updated",
      resourceType: CUSTOMER_RESOURCE_TYPE,
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
      customerId: string;
      expectedRevision: number;
      status: CustomerStatus;
    },
  ): Promise<CustomerRecordDto> {
    // Archiving hides a customer from the pickers; restoring needs the same
    // permission because both change what the accountant can select.
    this.assertHolds(context, "customers.archive");

    const existing = await this.dependencies.store.findById(input.customerId);
    if (!existing) {
      throw new CustomerCommandError("NOT_FOUND", "Customer not found.");
    }

    const updated = await this.dependencies.store.setStatus({
      customerId: existing.id,
      expectedRevision: input.expectedRevision,
      status: input.status,
      updatedBy: context.userId,
    });
    if (!updated) {
      throw new CustomerCommandError(
        "REVISION_CONFLICT",
        "The customer changed while this form was on screen.",
      );
    }

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action:
        input.status === "archived"
          ? "customer.archived"
          : "customer.restored",
      resourceType: CUSTOMER_RESOURCE_TYPE,
      resourceId: existing.id,
      requestId: context.requestId,
      changes: { before: existing.status, after: updated.status },
      occurredAt: this.now(),
    });

    return updated;
  }

  async list(filter: CustomerListFilter = {}): Promise<CustomerRecordDto[]> {
    return this.dependencies.store.list(filter);
  }

  async findById(customerId: string): Promise<CustomerRecordDto | null> {
    return this.dependencies.store.findById(customerId);
  }

  async findByIds(
    customerIds: readonly string[],
  ): Promise<ReadonlyMap<string, CustomerRecordDto>> {
    return this.dependencies.store.findByIds(customerIds);
  }
}
