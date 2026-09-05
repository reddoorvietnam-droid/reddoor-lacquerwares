import "server-only";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { MongoQuoteRequestStore } from "@/domains/quote-requests/mongo-store";
import { QuoteRequestService } from "@/domains/quote-requests/service";

export const quoteRequestStore = new MongoQuoteRequestStore();

export const quoteRequestService = new QuoteRequestService({
  store: quoteRequestStore,
  auditRepository: mongoAuditRepository,
});
