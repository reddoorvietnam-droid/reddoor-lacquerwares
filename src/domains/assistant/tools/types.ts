import type { z } from "zod";

import type { AssistantProposalService } from "@/domains/assistant/service";
import type { ApprovalService } from "@/domains/approvals/service";
import type { CustomerCommandService } from "@/domains/customers/service";
import type { FinanceCommandService } from "@/domains/finance/service";
import type { InvoiceCommandService } from "@/domains/finance/invoice-service";
import type { UserDirectory } from "@/domains/identity/user-directory";
import type { Permission } from "@/domains/identity/permissions";
import type { ArticleCommandService } from "@/domains/news/commands";
import type { OrderCommandService } from "@/domains/orders/service";
import type { ProductCommandService } from "@/domains/products/commands";
import type { ShopService } from "@/domains/shop/service";
import type { TaskCommandService } from "@/domains/tasks/service";
import type { AccessContext } from "@/lib/auth/authorization";
import type {
  ListReadScope,
  PermissionCoverage,
  RequirePermissionOptions,
} from "@/lib/auth";

/**
 * What a tool may touch. Authorization functions are injected so the
 * registry can be exercised in tests with a fake guard, and so that a tool
 * can never reach the database except through a service the portal already
 * uses — there is no query, shell, or URL primitive here.
 */
export type ToolAuth = {
  requirePermission(
    permission: Permission,
    options?: RequirePermissionOptions,
  ): Promise<AccessContext>;
  requireListAccess(
    permission: Permission,
  ): Promise<{ context: AccessContext; scope: ListReadScope }>;
  coverages<const P extends readonly Permission[]>(
    permissions: P,
  ): Promise<Record<P[number], PermissionCoverage>>;
};

export type ToolServices = {
  orders: OrderCommandService;
  finance: FinanceCommandService;
  invoices: InvoiceCommandService;
  customers: CustomerCommandService;
  approvals: ApprovalService;
  tasks: TaskCommandService;
  proposals: AssistantProposalService;
  userDirectory: UserDirectory;
  articles: ArticleCommandService;
  products: ProductCommandService;
  shop: ShopService;
};

export type ToolContext = {
  userId: string;
  locale: "vi" | "en";
  now: Date;
  timeZone: string;
  requestId: string;
  auth: ToolAuth;
  services: ToolServices;
};

export type ToolSource = { label: string; href: string };

export type ToolOutcome =
  | { ok: true; data: unknown; sources: readonly ToolSource[] }
  | { ok: false; code: string; message: string };

export type AssistantTool<Input = unknown> = {
  name: string;
  description: string;
  inputSchema: z.ZodType<Input>;
  /** Permissions the caller must hold (any scope) for the tool to be offered at all. */
  requires: readonly Permission[];
  run(input: Input, context: ToolContext): Promise<ToolOutcome>;
};
