import { describe, expect, it } from "vitest";

import {
  issueCodesFromQuery,
  keyColumns,
  readMappingForm,
  templateAllowed,
} from "@/app/[locale]/admin/(portal)/checks/shared";
import {
  runSheetCheckInputSchema,
  type SheetCheckDto,
} from "@/domains/sheet-checks/contracts";

/**
 * The mapping page has no client script: the run action rebuilds the
 * mapping from plain form fields. These tests pin the FormData boundary —
 * what the selects post is exactly what the service validates.
 */

function mappingForm(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("readMappingForm", () => {
  it("reads every posted column by index and defaults the blanks", () => {
    const form = mappingForm({
      "field.0": "date",
      "dateOrder.0": "dmy",
      "field.1": "customerName",
      "field.2": "amount",
      "multiplier.2": "1000",
      "style.2": "vi",
      "currency.2": "VND",
      "field.5": "ignore",
      defaultCurrency: "USD",
      periodFrom: "2026-08-01",
      periodTo: "2026-08-31",
      compareSellingPrice: "on",
    });

    const mapping = readMappingForm(form);

    expect(mapping.columns).toEqual([
      {
        columnIndex: 0,
        field: "date",
        unitMultiplier: "1",
        numberStyle: null,
        fixedCurrency: null,
        dateOrder: "dmy",
      },
      {
        columnIndex: 1,
        field: "customerName",
        unitMultiplier: "1",
        numberStyle: null,
        fixedCurrency: null,
        dateOrder: null,
      },
      {
        columnIndex: 2,
        field: "amount",
        unitMultiplier: "1000",
        numberStyle: "vi",
        fixedCurrency: "VND",
        dateOrder: null,
      },
      {
        columnIndex: 5,
        field: "ignore",
        unitMultiplier: "1",
        numberStyle: null,
        fixedCurrency: null,
        dateOrder: null,
      },
    ]);
    expect(mapping.defaultCurrency).toBe("USD");
    expect(mapping.period).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(mapping.compareSellingPrice).toBe(true);
  });

  it("validates through the service schema with no period and no checkbox", () => {
    const form = mappingForm({
      "field.0": "orderCode",
      "field.1": "amount",
      checkId: "64b000000000000000000001",
      expectedRevision: "3",
    });

    const parsed = runSheetCheckInputSchema.parse({
      checkId: form.get("checkId"),
      expectedRevision: form.get("expectedRevision"),
      mapping: readMappingForm(form),
    });

    expect(parsed.expectedRevision).toBe(3);
    expect(parsed.mapping.period).toBeNull();
    expect(parsed.mapping.defaultCurrency).toBe("VND");
    expect(parsed.mapping.compareSellingPrice).toBe(false);
    expect(parsed.mapping.columns[1]).toEqual({
      columnIndex: 1,
      field: "amount",
      unitMultiplier: "1",
      numberStyle: null,
      fixedCurrency: null,
      dateOrder: null,
    });
  });

  it("rejects a period with only one bound instead of dropping it", () => {
    const form = mappingForm({
      "field.0": "orderCode",
      periodFrom: "2026-08-01",
    });
    const mapping = readMappingForm(form);
    expect(mapping.period).toEqual({ from: "2026-08-01", to: "" });
    expect(
      runSheetCheckInputSchema.safeParse({
        checkId: "64b000000000000000000001",
        expectedRevision: "0",
        mapping,
      }).success,
    ).toBe(false);
  });

  it("ignores column indexes beyond the cap and unchecked selling-price boxes", () => {
    const form = mappingForm({
      "field.40": "amount",
      "field.abc": "amount",
      "field.3": "note",
      compareSellingPrice: "false",
    });
    const mapping = readMappingForm(form);
    expect(mapping.columns.map((column) => column.columnIndex)).toEqual([3]);
    expect(mapping.compareSellingPrice).toBe(false);
  });
});

describe("issueCodesFromQuery", () => {
  it("keeps catalogue codes only", () => {
    expect(
      issueCodesFromQuery("REQUIRED_COLUMN_MISSING,<script>,MAPPING_CONFLICT,"),
    ).toEqual(["REQUIRED_COLUMN_MISSING", "MAPPING_CONFLICT"]);
    expect(issueCodesFromQuery(undefined)).toEqual([]);
  });
});

describe("templateAllowed", () => {
  const none = {
    global: false,
    businessUnitIds: [] as readonly string[],
    own: false,
    ownBusinessUnitIds: [] as readonly string[],
  };
  const unit = {
    global: false,
    businessUnitIds: ["u1"] as readonly string[],
    own: false,
    ownBusinessUnitIds: [] as readonly string[],
  };
  const all = {
    global: true,
    businessUnitIds: [] as readonly string[],
    own: false,
    ownBusinessUnitIds: [] as readonly string[],
  };

  it("needs global finance coverage for the money templates", () => {
    expect(templateAllowed("incomingCash", { "payments.read": unit })).toBe(
      false,
    );
    expect(templateAllowed("incomingCash", { "payments.read": all })).toBe(
      true,
    );
    expect(
      templateAllowed("receivables", {
        "receivables.read": all,
        "invoices.read": all,
        "payments.read": none,
      }),
    ).toBe(false);
    expect(
      templateAllowed("receivables", {
        "receivables.read": all,
        "invoices.read": all,
        "payments.read": all,
      }),
    ).toBe(true);
  });

  it("accepts any orders.read coverage for the order list", () => {
    expect(templateAllowed("generic", { "orders.read": unit })).toBe(true);
    expect(templateAllowed("generic", { "orders.read": none })).toBe(false);
    expect(templateAllowed("generic", {})).toBe(false);
  });
});

describe("keyColumns", () => {
  const column = (columnIndex: number, field: string) => ({
    columnIndex,
    field: field as SheetCheckDto["mapping"]["columns"][number]["field"],
    fixedCurrency: null,
    unitMultiplier: "1" as const,
    numberStyle: null,
    dateOrder: null,
  });
  const base = (
    template: SheetCheckDto["template"],
    columns: SheetCheckDto["mapping"]["columns"],
  ) =>
    ({
      template,
      mapping: {
        columns,
        defaultCurrency: "VND",
        period: null,
        compareSellingPrice: false,
      },
    }) as SheetCheckDto;

  it("shows the outstanding column for a receivables sheet and the amount elsewhere", () => {
    const receivables = base("receivables", [
      column(0, "customerName"),
      column(1, "outstanding"),
      column(2, "amount"),
    ]);
    expect(keyColumns(receivables)).toEqual({
      date: null,
      identity: [0],
      amount: 1,
    });

    const cash = base("incomingCash", [
      column(0, "date"),
      column(1, "orderCode"),
      column(2, "customerName"),
      column(3, "amount"),
    ]);
    expect(keyColumns(cash)).toEqual({ date: 0, identity: [1, 2], amount: 3 });
  });
});
