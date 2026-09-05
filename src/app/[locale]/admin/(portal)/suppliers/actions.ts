"use server";

import type { Route } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { SupplierCommandError } from "@/domains/suppliers/contracts";
import { supplierCommandService } from "@/domains/suppliers/runtime";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";

function errorCode(error: unknown): string {
  if (error instanceof ContentAccessDeniedError) return "FORBIDDEN";
  if (error instanceof SupplierCommandError) return error.code;
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
    category: text("category"),
    contactName: text("contactName"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    notes: text("notes"),
  };
}

function backToSupplier(
  locale: string,
  supplierId: string,
  outcome: { error?: string; notice?: string },
): never {
  const query = outcome.error
    ? `?error=${outcome.error}`
    : outcome.notice
      ? `?notice=${outcome.notice}`
      : "";
  redirect(`/${locale}/admin/suppliers/${supplierId}${query}` as Route);
}

export async function createSupplierAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));

  let createdId: string | null = null;
  let code: string | null = null;

  try {
    const context = await requirePermission("suppliers.create");
    const record = await supplierCommandService.create(
      context,
      fieldsFrom(formData),
    );
    createdId = record.id;
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  if (createdId) backToSupplier(locale, createdId, { notice: "created" });
  redirect(`/${locale}/admin/suppliers?error=${code ?? "UNAVAILABLE"}` as Route);
}

export async function updateSupplierAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const supplierId = idSchema.parse(formData.get("supplierId"));

  let code: string | null = null;

  try {
    const context = await requirePermission("suppliers.update");
    await supplierCommandService.update(context, {
      supplierId,
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

  backToSupplier(locale, supplierId, code ? { error: code } : { notice: "saved" });
}

export async function setSupplierStatusAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const supplierId = idSchema.parse(formData.get("supplierId"));

  let code: string | null = null;
  let status: "active" | "archived" = "active";

  try {
    status = z.enum(["active", "archived"]).parse(formData.get("status"));
    const context = await requirePermission("suppliers.archive");
    await supplierCommandService.setStatus(context, {
      supplierId,
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

  backToSupplier(
    locale,
    supplierId,
    code
      ? { error: code }
      : { notice: status === "archived" ? "archived" : "restored" },
  );
}
