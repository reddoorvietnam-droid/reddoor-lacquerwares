import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  generateImportShipmentCode,
  hasImportDeclaration,
  ImportShipmentCommandError,
  matchesImportShipmentSearch,
  type ImportShipmentListFilter,
  type ImportShipmentRecordDto,
  type ImportShipmentStore,
  type ImportShipmentWriteFields,
  type NewImportShipmentDocument,
} from "@/domains/import-shipments/contracts";
import { ImportShipmentCommandService } from "@/domains/import-shipments/service";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";

import {
  accessContext,
  auditRepository,
  nextId,
  occurredAt,
} from "./helpers/finance-fakes";

/** In-memory store with the same unique-code and revision rules as Mongo. */
class FakeImportShipmentStore implements ImportShipmentStore {
  records = new Map<string, ImportShipmentRecordDto>();

  private assertCodeFree(code: string, exceptId?: string) {
    for (const record of this.records.values()) {
      if (record.code === code && record.id !== exceptId) {
        throw new ImportShipmentCommandError("DUPLICATE_CODE", "Taken.");
      }
    }
  }

  private bump(
    shipmentId: string,
    expectedRevision: number,
    change: (record: ImportShipmentRecordDto) => ImportShipmentRecordDto,
    updatedBy: string,
  ): ImportShipmentRecordDto | null {
    const record = this.records.get(shipmentId);
    if (!record || record.revision !== expectedRevision) return null;
    const next = {
      ...change(record),
      updatedBy,
      updatedAt: occurredAt,
      revision: record.revision + 1,
    };
    this.records.set(shipmentId, next);
    return structuredClone(next);
  }

  async insert(
    record: ImportShipmentWriteFields & { code: string; createdBy: string },
  ): Promise<ImportShipmentRecordDto> {
    this.assertCodeFree(record.code);
    const created: ImportShipmentRecordDto = {
      id: nextId("a"),
      code: record.code,
      declarationNumber: record.declarationNumber,
      declaredOn: record.declaredOn,
      supplierName: record.supplierName,
      goodsDescription: record.goodsDescription,
      note: record.note,
      documents: [],
      createdBy: record.createdBy,
      updatedBy: record.createdBy,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      revision: 0,
    };
    this.records.set(created.id, created);
    return structuredClone(created);
  }

  async findById(shipmentId: string) {
    const record = this.records.get(shipmentId);
    return record ? structuredClone(record) : null;
  }

  async list(filter: ImportShipmentListFilter) {
    return [...this.records.values()]
      .filter((record) => matchesImportShipmentSearch(record, filter.search))
      .map((record) => structuredClone(record));
  }

  async update(input: {
    shipmentId: string;
    expectedRevision: number;
    fields: ImportShipmentWriteFields & { code: string };
    updatedBy: string;
  }) {
    const current = this.records.get(input.shipmentId);
    if (current && current.revision === input.expectedRevision) {
      this.assertCodeFree(input.fields.code, input.shipmentId);
    }
    return this.bump(
      input.shipmentId,
      input.expectedRevision,
      (record) => ({ ...record, ...input.fields }),
      input.updatedBy,
    );
  }

  async addDocument(input: {
    shipmentId: string;
    expectedRevision: number;
    document: NewImportShipmentDocument;
    updatedBy: string;
  }) {
    return this.bump(
      input.shipmentId,
      input.expectedRevision,
      (record) => ({
        ...record,
        documents: [
          ...record.documents,
          { id: nextId("d"), ...input.document },
        ],
      }),
      input.updatedBy,
    );
  }

  async removeDocument(input: {
    shipmentId: string;
    expectedRevision: number;
    documentId: string;
    updatedBy: string;
  }) {
    const record = this.records.get(input.shipmentId);
    if (!record?.documents.some(({ id }) => id === input.documentId)) {
      return null;
    }
    return this.bump(
      input.shipmentId,
      input.expectedRevision,
      (current) => ({
        ...current,
        documents: current.documents.filter(
          ({ id }) => id !== input.documentId,
        ),
      }),
      input.updatedBy,
    );
  }
}

function build() {
  const store = new FakeImportShipmentStore();
  const audit = auditRepository();
  const service = new ImportShipmentCommandService({
    store,
    auditRepository: audit,
    uploadFolder: () => "red-door",
    now: () => occurredAt,
  });
  return { store, audit, service };
}

const manager = accessContext([
  "importShipments.read",
  "importShipments.manage",
]);
const reader = accessContext(["importShipments.read"]);

const baseInput = {
  code: "",
  declarationNumber: "",
  declaredOn: "",
  supplierName: "Guangzhou Lacquer Co.",
  goodsDescription: "Sơn mài nguyên liệu",
  note: "",
};

function documentInput(
  shipment: ImportShipmentRecordDto,
  kind: string,
  label = "to-khai.pdf",
) {
  return {
    shipmentId: shipment.id,
    expectedRevision: shipment.revision,
    kind,
    publicId: `red-door/import-shipments/${shipment.id}/abc`,
    assetVersion: 1,
    format: "PDF",
    bytes: 2048,
    label,
  };
}

describe("import shipment helpers", () => {
  it("allocates NK-YYYYMMDD-XXXX codes", () => {
    const code = generateImportShipmentCode(
      new Date(2026, 8, 14, 10, 0),
      () => 0,
    );
    expect(code).toBe("NK-20260914-AAAA");
  });

  it("flags a shipment without a declaration file", () => {
    expect(hasImportDeclaration({ documents: [] })).toBe(false);
    expect(
      hasImportDeclaration({ documents: [{ kind: "commercialInvoice" }] }),
    ).toBe(false);
    expect(
      hasImportDeclaration({ documents: [{ kind: "importDeclaration" }] }),
    ).toBe(true);
  });

  it("searches code, declaration number, supplier and goods", () => {
    const record = {
      code: "NK-20260914-AB12",
      declarationNumber: "105678901234",
      supplierName: "Guangzhou Lacquer Co.",
      goodsDescription: "Sơn mài nguyên liệu",
    };
    expect(matchesImportShipmentSearch(record, undefined)).toBe(true);
    expect(matchesImportShipmentSearch(record, "  ")).toBe(true);
    expect(matchesImportShipmentSearch(record, "ab12")).toBe(true);
    expect(matchesImportShipmentSearch(record, "5678")).toBe(true);
    expect(matchesImportShipmentSearch(record, "guangzhou")).toBe(true);
    expect(matchesImportShipmentSearch(record, "SƠN MÀI")).toBe(true);
    expect(matchesImportShipmentSearch(record, "gỗ")).toBe(false);
  });
});

describe("ImportShipmentCommandService", () => {
  it("creates a shipment with an allocated code and blank optionals as null", async () => {
    const { service, audit } = build();

    const created = await service.create(manager, baseInput);

    expect(created.code).toMatch(/^NK-\d{8}-[A-Z2-9]{4}$/);
    expect(created.declarationNumber).toBeNull();
    expect(created.declaredOn).toBeNull();
    expect(created.note).toBeNull();
    expect(created.documents).toEqual([]);
    expect(audit.events.map((event) => event.action)).toEqual([
      "importShipment.created",
    ]);
    expect(audit.events[0]).toMatchObject({
      resourceType: "importShipment",
      resourceId: created.id,
    });
  });

  it("keeps a manual code upper-cased and parses the declaration date", async () => {
    const { service } = build();

    const created = await service.create(manager, {
      ...baseInput,
      code: " nk-2026/015 ",
      declarationNumber: "105678901234",
      declaredOn: "2026-09-10",
    });

    expect(created.code).toBe("NK-2026/015");
    expect(created.declarationNumber).toBe("105678901234");
    expect(created.declaredOn?.toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });

  it("refuses a duplicate manual code and retries an allocated one", async () => {
    const { service, store } = build();
    await service.create(manager, { ...baseInput, code: "NK-1" });

    await expect(
      service.create(manager, { ...baseInput, code: "nk-1" }),
    ).rejects.toMatchObject({ code: "DUPLICATE_CODE" });

    const insert = store.insert.bind(store);
    const spy = vi
      .spyOn(store, "insert")
      .mockImplementationOnce(async () => {
        throw new ImportShipmentCommandError("DUPLICATE_CODE", "Taken.");
      })
      .mockImplementation(insert);
    const created = await service.create(manager, baseInput);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(created.code).toMatch(/^NK-/);
  });

  it("rejects missing required fields and a malformed code", async () => {
    const { service } = build();

    await expect(
      service.create(manager, { ...baseInput, supplierName: " " }),
    ).rejects.toBeInstanceOf(z.ZodError);
    await expect(
      service.create(manager, { ...baseInput, goodsDescription: "" }),
    ).rejects.toBeInstanceOf(z.ZodError);
    await expect(
      service.create(manager, { ...baseInput, code: "NK 1" }),
    ).rejects.toBeInstanceOf(z.ZodError);
  });

  it("updates the fields and refuses a stale revision, a taken code and an unknown shipment", async () => {
    const { service, audit } = build();
    const first = await service.create(manager, { ...baseInput, code: "NK-A" });
    const second = await service.create(manager, {
      ...baseInput,
      code: "NK-B",
    });

    const updated = await service.update(manager, {
      ...baseInput,
      shipmentId: first.id,
      expectedRevision: first.revision,
      code: "NK-A",
      declarationNumber: "105600000001",
      declaredOn: "2026-09-12",
      goodsDescription: "Sơn mài thành phẩm",
      note: "Hàng về cảng Hải Phòng",
    });
    expect(updated.revision).toBe(first.revision + 1);
    expect(updated.declarationNumber).toBe("105600000001");
    expect(updated.note).toBe("Hàng về cảng Hải Phòng");
    expect(audit.events.at(-1)).toMatchObject({
      action: "importShipment.updated",
      changes: {
        before: {
          declarationNumber: null,
          goodsDescription: "Sơn mài nguyên liệu",
          note: null,
        },
        after: {
          declarationNumber: "105600000001",
          goodsDescription: "Sơn mài thành phẩm",
          note: "Hàng về cảng Hải Phòng",
        },
      },
    });

    await expect(
      service.update(manager, {
        ...baseInput,
        shipmentId: first.id,
        expectedRevision: first.revision,
        code: "NK-A",
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    await expect(
      service.update(manager, {
        ...baseInput,
        shipmentId: second.id,
        expectedRevision: second.revision,
        code: "nk-a",
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_CODE" });
    await expect(
      service.update(manager, {
        ...baseInput,
        shipmentId: "ffffffffffffffffffffffff",
        expectedRevision: 0,
        code: "NK-Z",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("attaches and removes documents by kind", async () => {
    const { service, audit } = build();
    const created = await service.create(manager, baseInput);
    expect(hasImportDeclaration(created)).toBe(false);

    const withDeclaration = await service.attachDocument(
      manager,
      documentInput(created, "importDeclaration"),
    );
    expect(withDeclaration.documents).toHaveLength(1);
    expect(withDeclaration.documents[0]).toMatchObject({
      kind: "importDeclaration",
      format: "pdf",
      label: "to-khai.pdf",
      uploadedBy: manager.userId,
      uploadedAt: occurredAt,
    });
    expect(hasImportDeclaration(withDeclaration)).toBe(true);

    const withInvoice = await service.attachDocument(
      manager,
      documentInput(withDeclaration, "commercialInvoice", "invoice.pdf"),
    );
    expect(withInvoice.documents.map(({ kind }) => kind)).toEqual([
      "importDeclaration",
      "commercialInvoice",
    ]);

    const removed = await service.removeDocument(manager, {
      shipmentId: withInvoice.id,
      expectedRevision: withInvoice.revision,
      documentId: withInvoice.documents[0]!.id,
    });
    expect(removed.documents.map(({ kind }) => kind)).toEqual([
      "commercialInvoice",
    ]);
    expect(hasImportDeclaration(removed)).toBe(false);

    expect(audit.events.map((event) => event.action)).toEqual([
      "importShipment.created",
      "importShipment.documentAttached",
      "importShipment.documentAttached",
      "importShipment.documentRemoved",
    ]);
    expect(audit.events.at(-1)).toMatchObject({
      metadata: { kind: "importDeclaration", label: "to-khai.pdf" },
    });
  });

  it("refuses a stale document change, an unknown document and an unknown kind", async () => {
    const { service } = build();
    const created = await service.create(manager, baseInput);
    const attached = await service.attachDocument(
      manager,
      documentInput(created, "billOfLading"),
    );

    await expect(
      service.attachDocument(manager, documentInput(created, "packingList")),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    await expect(
      service.removeDocument(manager, {
        shipmentId: attached.id,
        expectedRevision: created.revision,
        documentId: attached.documents[0]!.id,
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    await expect(
      service.removeDocument(manager, {
        shipmentId: attached.id,
        expectedRevision: attached.revision,
        documentId: "dddddddddddddddddddddddd",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.attachDocument(manager, documentInput(attached, "customsVisa")),
    ).rejects.toBeInstanceOf(z.ZodError);
    await expect(
      service.attachDocument(manager, {
        ...documentInput(attached, "other"),
        shipmentId: "ffffffffffffffffffffffff",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses a file stored outside the shipment's own folder", async () => {
    const { service, store, audit } = build();
    const created = await service.create(manager, baseInput);
    const other = await service.create(manager, {
      ...baseInput,
      code: "NK-OTHER",
    });
    const auditCount = audit.events.length;

    for (const publicId of [
      `red-door/import-shipments/${other.id}/abc`,
      `red-door/orders/${created.id}/payment-documents/abc`,
      `other-root/import-shipments/${created.id}/abc`,
      `red-door/import-shipments/${created.id}`,
    ]) {
      await expect(
        service.attachDocument(manager, {
          ...documentInput(created, "commercialInvoice"),
          publicId,
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }

    const unchanged = await store.findById(created.id);
    expect(unchanged?.documents).toHaveLength(0);
    expect(unchanged?.revision).toBe(created.revision);
    expect(audit.events).toHaveLength(auditCount);
  });

  it("lists with a search and reads one shipment", async () => {
    const { service } = build();
    const lacquer = await service.create(manager, baseInput);
    await service.create(manager, {
      ...baseInput,
      supplierName: "Osaka Wood Ltd.",
      goodsDescription: "Gỗ tần bì",
    });

    expect(await service.list(reader)).toHaveLength(2);
    expect(
      (await service.list(reader, { search: "osaka" })).map(
        ({ supplierName }) => supplierName,
      ),
    ).toEqual(["Osaka Wood Ltd."]);
    expect((await service.findById(reader, lacquer.id))?.code).toBe(
      lacquer.code,
    );
    expect(await service.findById(reader, "ffffffffffffffffffffffff")).toBe(
      null,
    );
  });

  it("requires manage for every change and read for reading", async () => {
    const { service, store, audit } = build();
    const created = await service.create(manager, baseInput);
    const attached = await service.attachDocument(
      manager,
      documentInput(created, "payment"),
    );
    const eventsBefore = audit.events.length;

    await expect(service.create(reader, baseInput)).rejects.toBeInstanceOf(
      ContentAccessDeniedError,
    );
    await expect(
      service.update(reader, {
        ...baseInput,
        shipmentId: attached.id,
        expectedRevision: attached.revision,
        code: attached.code,
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
    await expect(
      service.attachDocument(reader, documentInput(attached, "other")),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
    await expect(
      service.removeDocument(reader, {
        shipmentId: attached.id,
        expectedRevision: attached.revision,
        documentId: attached.documents[0]!.id,
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);

    const manageOnly = accessContext(["importShipments.manage"]);
    await expect(service.list(manageOnly)).rejects.toBeInstanceOf(
      ContentAccessDeniedError,
    );
    await expect(
      service.findById(manageOnly, attached.id),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
    await expect(
      service.list(accessContext(["facilityContracts.read"])),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);

    const suspended = {
      ...manager,
      userStatus: "suspended",
    } as unknown as typeof manager;
    await expect(service.create(suspended, baseInput)).rejects.toBeInstanceOf(
      ContentAccessDeniedError,
    );

    expect(audit.events).toHaveLength(eventsBefore);
    expect((await store.findById(attached.id))?.revision).toBe(
      attached.revision,
    );
  });
});
