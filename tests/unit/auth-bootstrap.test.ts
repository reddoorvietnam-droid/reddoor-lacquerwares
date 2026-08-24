import { describe, expect, it } from "vitest";

import { parseBootstrapAdminEmails } from "@/domains/identity/bootstrap";

describe("one-time Super Admin bootstrap input", () => {
  it("normalizes a temporary comma, semicolon, or line separated allow-list", () => {
    expect([
      ...parseBootstrapAdminEmails(
        " Owner@Example.com;second@example.com\nthird@example.com ",
      ),
    ]).toEqual([
      "owner@example.com",
      "second@example.com",
      "third@example.com",
    ]);
  });

  it("does not turn malformed or empty values into authorization entries", () => {
    expect([...parseBootstrapAdminEmails(undefined)]).toEqual([]);
    expect([...parseBootstrapAdminEmails("")]).toEqual([]);
    expect([...parseBootstrapAdminEmails("not-an-email,@example.com")]).toEqual(
      [],
    );
  });
});
