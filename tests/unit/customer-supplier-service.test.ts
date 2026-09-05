import { describe, expect, it } from "vitest";
import { z } from "zod";

import { customerWriteInputSchema } from "@/domains/customers/contracts";
import { CustomerCommandService } from "@/domains/customers/service";
import { SupplierCommandService } from "@/domains/suppliers/service";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";

import {
  accessContext,
  auditRepository,
  FakeCustomerStore,
  FakeSupplierStore,
  occurredAt,
} from "./helpers/finance-fakes";

function buildCustomers() {
  const store = new FakeCustomerStore();
  const audit = auditRepository();
  const service = new CustomerCommandService({
    store,
    auditRepository: audit,
    now: () => occurredAt,
  });
  return { store, audit, service };
}

function buildSuppliers() {
  const store = new FakeSupplierStore();
  const audit = auditRepository();
  const service = new SupplierCommandService({
    store,
    auditRepository: audit,
    now: () => occurredAt,
  });
  return { store, audit, service };
}

const customerAdmin = accessContext([
  "customers.create",
  "customers.update",
  "customers.archive",
]);
const supplierAdmin = accessContext([
  "suppliers.create",
  "suppliers.update",
  "suppliers.archive",
]);

describe("customerWriteInputSchema", () => {
  it("turns blank optional fields into null and upper-cases the code", () => {
    const parsed = customerWriteInputSchema.parse({
      code: " kiso-jp ",
      name: "  Công ty Kiso ",
      country: "",
      email: "",
      phone: "",
      address: "",
      defaultCurrency: "",
      notes: "",
    });

    expect(parsed).toEqual({
      code: "KISO-JP",
      name: "Công ty Kiso",
      taxCode: null,
      country: null,
      email: null,
      phone: null,
      address: null,
      defaultCurrency: null,
      notes: null,
    });
  });

  it("accepts a record with only a name", () => {
    expect(customerWriteInputSchema.parse({ name: "Khách" }).name).toBe("Khách");
  });

  it("keeps the accountant's own references verbatim apart from case", () => {
    expect(
      customerWriteInputSchema.parse({ name: "X", code: " Between the Sheets, Inc. " })
        .code,
    ).toBe("BETWEEN THE SHEETS, INC.");
    expect(
      customerWriteInputSchema.parse({ name: "X", code: "0110283872-001" }).code,
    ).toBe("0110283872-001");
  });

  it("rejects a malformed email, a control character in the code, and a retired currency", () => {
    expect(() =>
      customerWriteInputSchema.parse({ name: "X", email: "not-an-email" }),
    ).toThrow(z.ZodError);
    expect(() =>
      customerWriteInputSchema.parse({
        name: "X",
        code: `bad${String.fromCharCode(7)}code`,
      }),
    ).toThrow(z.ZodError);
    expect(() =>
      customerWriteInputSchema.parse({ name: "X", defaultCurrency: "EUR" }),
    ).toThrow(z.ZodError);
  });
});

describe("CustomerCommandService", () => {
  it("creates, updates, and archives a customer with an audit trail", async () => {
    const { service, audit } = buildCustomers();

    const created = await service.create(customerAdmin, {
      code: "kiso",
      name: "Công ty Kiso",
      email: "buyer@kiso.example",
      defaultCurrency: "USD",
    });
    expect(created.code).toBe("KISO");
    expect(created.status).toBe("active");
    expect(created.defaultCurrency).toBe("USD");

    const updated = await service.update(customerAdmin, {
      customerId: created.id,
      expectedRevision: created.revision,
      fields: { code: "KISO", name: "Kiso Co., Ltd.", country: "Japan" },
    });
    expect(updated.name).toBe("Kiso Co., Ltd.");
    expect(updated.country).toBe("Japan");
    expect(updated.revision).toBe(created.revision + 1);

    const archived = await service.setStatus(customerAdmin, {
      customerId: created.id,
      expectedRevision: updated.revision,
      status: "archived",
    });
    expect(archived.status).toBe("archived");
    expect(await service.list({ status: "active" })).toEqual([]);

    expect(audit.events.map((event) => event.action)).toEqual([
      "customer.created",
      "customer.updated",
      "customer.archived",
    ]);
    // Contact details never reach the audit trail.
    expect(JSON.stringify(audit.events)).not.toContain("buyer@kiso.example");
  });

  it("refuses a duplicate code and a stale revision", async () => {
    const { service, store } = buildCustomers();
    store.seed({ code: "A1", name: "First" });
    const second = store.seed({ code: "B2", name: "Second" });

    await expect(
      service.create(customerAdmin, { code: "a1", name: "Again" }),
    ).rejects.toMatchObject({ code: "DUPLICATE_CODE" });
    await expect(
      service.update(customerAdmin, {
        customerId: second.id,
        expectedRevision: 5,
        fields: { name: "Second" },
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    await expect(
      service.update(customerAdmin, {
        customerId: "ffffffffffffffffffffffff",
        expectedRevision: 0,
        fields: { name: "Nobody" },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("requires the matching permission for each verb", async () => {
    const { service, store } = buildCustomers();
    const existing = store.seed();

    await expect(
      service.create(accessContext(["customers.read"]), { name: "X" }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
    await expect(
      service.update(accessContext(["customers.create"]), {
        customerId: existing.id,
        expectedRevision: 0,
        fields: { name: "X" },
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
    await expect(
      service.setStatus(accessContext(["customers.update"]), {
        customerId: existing.id,
        expectedRevision: 0,
        status: "archived",
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });
});

describe("SupplierCommandService", () => {
  it("creates, updates, and archives a supplier", async () => {
    const { service, audit } = buildSuppliers();

    const created = await service.create(supplierAdmin, {
      code: "go-b",
      name: "Xưởng gỗ B",
      category: "Nguyên liệu",
      phone: "0900 000 000",
    });
    expect(created.code).toBe("GO-B");
    expect(created.category).toBe("Nguyên liệu");

    const updated = await service.update(supplierAdmin, {
      supplierId: created.id,
      expectedRevision: created.revision,
      fields: { name: "Xưởng gỗ B", contactName: "Anh Bình" },
    });
    expect(updated.contactName).toBe("Anh Bình");
    expect(updated.code).toBeNull();

    const archived = await service.setStatus(supplierAdmin, {
      supplierId: created.id,
      expectedRevision: updated.revision,
      status: "archived",
    });
    expect(archived.status).toBe("archived");
    expect(audit.events.map((event) => event.action)).toEqual([
      "supplier.created",
      "supplier.updated",
      "supplier.archived",
    ]);
  });

  it("refuses a duplicate code and a context without the permission", async () => {
    const { service, store } = buildSuppliers();
    store.seed({ code: "X1" });

    await expect(
      service.create(supplierAdmin, { code: "x1", name: "Again" }),
    ).rejects.toMatchObject({ code: "DUPLICATE_CODE" });
    await expect(
      service.create(accessContext(["suppliers.read"]), { name: "X" }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });
});
