import { describe, expect, it } from "vitest";

import { MongoAuditRepository } from "@/domains/audit/mongo-repository";
import { redactAuditText, redactAuditValue } from "@/domains/audit/redaction";

describe("audit redaction", () => {
  it("recursively removes secrets, credentials, PII, and binary bodies", () => {
    const redacted = redactAuditValue({
      status: "published",
      password: "plain-text-password",
      nested: {
        accessToken: "oauth-access-token",
        client_secret: "oauth-client-secret",
        normalizedEmail: "private@example.com",
        customerEmail: "customer@example.com",
        fileContents: "raw-document",
        safeRevision: 4,
      },
    });

    expect(redacted).toEqual({
      status: "published",
      password: "[REDACTED]",
      nested: {
        accessToken: "[REDACTED]",
        client_secret: "[REDACTED]",
        normalizedEmail: "[REDACTED_PII]",
        customerEmail: "[REDACTED_PII]",
        fileContents: "[OMITTED]",
        safeRevision: 4,
      },
    });
    expect(JSON.stringify(redacted)).not.toContain("plain-text-password");
    expect(JSON.stringify(redacted)).not.toContain("private@example.com");
  });

  it("redacts accidentally pasted credentials and PII from free-form reasons", () => {
    expect(
      redactAuditText(
        "Approved by private@example.com token=abc123 Bearer oauth-value",
      ),
    ).toBe("Approved by [REDACTED_PII] token=[REDACTED] Bearer [REDACTED]");
  });

  it("handles circular and oversized input without leaking an unbounded value", () => {
    const circular: Record<string, unknown> = { safe: "value" };
    circular.self = circular;

    expect(redactAuditValue(circular)).toEqual({
      safe: "value",
      self: "[CIRCULAR]",
    });

    const redactedLongValue = redactAuditValue({ note: "x".repeat(2_100) });
    expect(JSON.stringify(redactedLongValue).length).toBeLessThan(2_100);
    expect(JSON.stringify(redactedLongValue)).toContain("[TRUNCATED]");
  });

  it("exposes append only from the Mongo audit repository", () => {
    expect(Object.getOwnPropertyNames(MongoAuditRepository.prototype)).toEqual([
      "constructor",
      "append",
    ]);
  });
});
