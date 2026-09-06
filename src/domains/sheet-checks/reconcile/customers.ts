import type { CustomerRecordDto } from "@/domains/customers/contracts";
import type { FinanceEntryRecordDto } from "@/domains/finance/contracts";
import { customerKeyOf } from "@/domains/finance/receivables";
import { issue, type Issue } from "@/domains/sheet-checks/issues";
import { normalizeName } from "@/domains/sheet-checks/parsing/code";

/**
 * Who a sheet row is about. The directory (customers.read) decides when it
 * was loaded; otherwise the order or invoice the row names lends its
 * customer, and a bare name falls back to the legacy name key the
 * receivables report also uses for customers recorded before the list
 * existed. Order codes are never fuzzy-matched; customer names are, but
 * always with a finding that says so.
 */

export type CustomerResolution = {
  customerId: string | null;
  customerName: string | null;
  /** `customerKeyOf(id, name)`; null when nothing identifies the customer. */
  customerKey: string | null;
  issues: Issue[];
};

export type CustomerFallback = {
  customerId: string | null;
  customerName: string;
};

export type ResolveCustomerInput = {
  name: string | null;
  code: string | null;
  /** The customer directory, or null when the runner may not read it. */
  directory: readonly CustomerRecordDto[] | null;
  /** The customer of the order/invoice the row names, when any. */
  fallback: CustomerFallback | null;
};

function none(issues: Issue[] = []): CustomerResolution {
  return { customerId: null, customerName: null, customerKey: null, issues };
}

function resolved(
  customerId: string | null,
  customerName: string,
  issues: Issue[] = [],
): CustomerResolution {
  return {
    customerId,
    customerName,
    customerKey: customerKeyOf(customerId, customerName),
    issues,
  };
}

function codeKey(code: string): string {
  return code.trim().toUpperCase();
}

/** Picks one directory match when there is exactly one; lists them otherwise. */
function fromMatches(
  sheet: string,
  matches: readonly CustomerRecordDto[],
  onUnique: (customer: CustomerRecordDto) => Issue[],
): CustomerResolution | null {
  if (matches.length === 0) return null;
  const [first] = matches;
  if (matches.length === 1 && first) {
    return resolved(first.id, first.name, onUnique(first));
  }
  const list = matches
    .slice(0, 3)
    .map((customer) => customer.name)
    .join(", ");
  return none([issue("CUSTOMER_AMBIGUOUS", { sheet, list })]);
}

function byName(
  name: string,
  directory: readonly CustomerRecordDto[],
): CustomerResolution {
  const sheetKey = normalizeName(name);
  if (sheetKey.length === 0) {
    return none([issue("CUSTOMER_NOT_FOUND", { sheet: name })]);
  }
  const keyed = directory.map((customer) => ({
    customer,
    key: normalizeName(customer.name),
  }));

  const exact = fromMatches(
    name,
    keyed
      .filter((entry) => entry.key === sheetKey)
      .map((entry) => entry.customer),
    (customer) =>
      customer.name.trim() === name.trim()
        ? []
        : [
            issue("CUSTOMER_MATCH_NORMALIZED", {
              sheet: name,
              system: customer.name,
            }),
          ],
  );
  if (exact) return exact;

  // Containment either way ("ABC Import" ⊂ "Công ty TNHH ABC Import") is
  // accepted only when it singles out one customer, and always as a warning.
  const fuzzy = fromMatches(
    name,
    keyed
      .filter(
        (entry) =>
          entry.key.length > 0 &&
          (entry.key.includes(sheetKey) || sheetKey.includes(entry.key)),
      )
      .map((entry) => entry.customer),
    (customer) => [
      issue("CUSTOMER_MATCH_FUZZY", { sheet: name, system: customer.name }),
    ],
  );
  if (fuzzy) return fuzzy;

  return none([issue("CUSTOMER_NOT_FOUND", { sheet: name })]);
}

export function resolveCustomer(
  input: ResolveCustomerInput,
): CustomerResolution {
  const name = input.name?.trim() || null;
  const code = input.code?.trim() || null;

  if (input.directory !== null) {
    if (code) {
      const wanted = codeKey(code);
      const match = input.directory.find(
        (customer) =>
          customer.code !== null && codeKey(customer.code) === wanted,
      );
      if (match) return resolved(match.id, match.name);
      if (!name) {
        return withFallback(
          none([issue("CUSTOMER_NOT_FOUND", { sheet: code })]),
          input.fallback,
        );
      }
    }
    if (name)
      return withFallback(byName(name, input.directory), input.fallback);
    return input.fallback
      ? resolved(input.fallback.customerId, input.fallback.customerName)
      : none();
  }

  // No directory: the order/invoice the row names is the best identity; a
  // sheet name is compared with it by the caller (ORDER_CUSTOMER_MISMATCH).
  if (input.fallback) {
    const inferred = !name && !code;
    return resolved(
      input.fallback.customerId,
      input.fallback.customerName,
      inferred
        ? [
            issue("CUSTOMER_INFERRED", {
              customer: input.fallback.customerName,
            }),
          ]
        : [],
    );
  }
  if (name) return resolved(null, name);
  return none();
}

/**
 * A directory miss still keeps the order's customer as the working identity
 * so receipts can be matched, while the finding stays on the row.
 */
function withFallback(
  resolution: CustomerResolution,
  fallback: CustomerFallback | null,
): CustomerResolution {
  if (resolution.customerKey !== null || !fallback) return resolution;
  return {
    customerId: fallback.customerId,
    customerName: fallback.customerName,
    customerKey: customerKeyOf(fallback.customerId, fallback.customerName),
    issues: resolution.issues,
  };
}

/* ------------------------------------------------------------------ */
/* Identity keys                                                       */
/* ------------------------------------------------------------------ */

const NAME_PREFIX = "norm:";

/** A diacritics- and legal-form-insensitive name key, distinct from `customerKeyOf`'s. */
export function nameKey(text: string): string | null {
  const key = normalizeName(text);
  return key.length > 0 ? `${NAME_PREFIX}${key}` : null;
}

/**
 * Every key under which a sheet row's customer may be recognised: the
 * record id when known, the legacy name key, and the normalised names of
 * both the resolved customer and the sheet's own spelling.
 */
export function rowCustomerKeys(
  resolution: CustomerResolution,
  sheetName: string | null,
): Set<string> {
  const keys = new Set<string>();
  if (resolution.customerKey !== null) keys.add(resolution.customerKey);
  for (const text of [resolution.customerName, sheetName]) {
    if (!text) continue;
    const key = nameKey(text);
    if (key) keys.add(key);
  }
  return keys;
}

/** Keys a receipt answers to: its customer id (or legacy name key) and its counterparty name. */
export function receiptCustomerKeys(
  receipt: Pick<FinanceEntryRecordDto, "customerId" | "counterparty">,
): Set<string> {
  const keys = new Set<string>([
    customerKeyOf(receipt.customerId, receipt.counterparty),
  ]);
  const key = nameKey(receipt.counterparty);
  if (key) keys.add(key);
  return keys;
}

export function keysIntersect(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): boolean {
  for (const key of left) if (right.has(key)) return true;
  return false;
}
