"use server";

import type { Route } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { CustomerCommandError } from "@/domains/customers/contracts";
import { customerCommandService } from "@/domains/customers/runtime";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";

/**
 * Server actions behind the customer list. Every action re-authorizes on
 * the server; the service validates the fields and the store arbitrates the
 * unique code and the revision.
 */

function errorCode(error: unknown): string {
  if (error instanceof ContentAccessDeniedError) return "FORBIDDEN";
  if (error instanceof CustomerCommandError) return error.code;
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  return "UNAVAILABLE";
}

const localeSchema = z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/);
const idSchema = z.string().regex(/^[a-f0-9]{24}$/);

function fieldsFrom(formData: FormData) {
  const text = (name: string) => String(formData.get(name) ?? "");
  return {
    code: text("code"),
    name: text("name"),
    taxCode: text("taxCode"),
    country: text("country"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    defaultCurrency: text("defaultCurrency"),
    notes: text("notes"),
  };
}

function backToList(locale: string, code: string): never {
  redirect(`/${locale}/admin/customers?error=${code}` as Route);
}

function backToCustomer(
  locale: string,
  customerId: string,
  outcome: { error?: string; notice?: string },
): never {
  const query = outcome.error
    ? `?error=${outcome.error}`
    : outcome.notice
      ? `?notice=${outcome.notice}`
      : "";
  redirect(`/${locale}/admin/customers/${customerId}${query}` as Route);
}

export async function createCustomerAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));

  let createdId: string | null = null;
  let code: string | null = null;

  try {
    const context = await requirePermission("customers.create");
    const record = await customerCommandService.create(
      context,
      fieldsFrom(formData),
    );
    createdId = record.id;
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  if (createdId) backToCustomer(locale, createdId, { notice: "created" });
  backToList(locale, code ?? "UNAVAILABLE");
}

export async function updateCustomerAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const customerId = idSchema.parse(formData.get("customerId"));

  let code: string | null = null;

  try {
    const context = await requirePermission("customers.update");
    await customerCommandService.update(context, {
      customerId,
      expectedRevision: z.coerce
        .number()
        .int()
        .min(0)
        .parse(formData.get("expectedRevision")),
      fields: fieldsFrom(formData),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToCustomer(locale, customerId, code ? { error: code } : { notice: "saved" });
}

export async function setCustomerStatusAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const customerId = idSchema.parse(formData.get("customerId"));

  let code: string | null = null;
  let status: "active" | "archived" = "active";

  try {
    status = z.enum(["active", "archived"]).parse(formData.get("status"));
    const context = await requirePermission("customers.archive");
    await customerCommandService.setStatus(context, {
      customerId,
      expectedRevision: z.coerce
        .number()
        .int()
        .min(0)
        .parse(formData.get("expectedRevision")),
      status,
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToCustomer(
    locale,
    customerId,
    code
      ? { error: code }
      : { notice: status === "archived" ? "archived" : "restored" },
  );
}
