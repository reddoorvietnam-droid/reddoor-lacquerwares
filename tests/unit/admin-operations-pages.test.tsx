import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AdminApprovalsPage from "@/app/[locale]/admin/(portal)/approvals/page";
import AdminOperationsPage from "@/app/[locale]/admin/(portal)/operations/page";
import AdminOrganizationPage from "@/app/[locale]/admin/(portal)/organization/page";
import { approvalSubjects } from "@/domains/approvals/contracts";
import {
  orderProgressStages,
  stageDefinition,
} from "@/domains/orders/workflow";
import {
  operationalForms,
  organizationPositions,
} from "@/domains/organization/responsibilities";

/**
 * These pages present static process configuration rather than persisted
 * records, so they can be rendered directly. The point of the tests is that the
 * screens stay in step with the registries: adding a stage, an approval subject,
 * a position, or a form must show up without anyone remembering to edit a page.
 */
async function render(
  page: (props: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<Record<string, never>>;
  }) => Promise<React.JSX.Element>,
  locale: string,
): Promise<string> {
  return renderToStaticMarkup(
    await page({
      params: Promise.resolve({ locale }),
      searchParams: Promise.resolve({}),
    }),
  );
}

describe("admin order process page", () => {
  it("lists every non-terminal stage with its step number and permission", async () => {
    const markup = await render(AdminOperationsPage, "vi");

    for (const stage of orderProgressStages) {
      const definition = stageDefinition(stage);
      expect(markup).toContain(definition.labels.vi);
      expect(markup).toContain(definition.advancePermission);
    }
  });

  it("marks exactly the stages that need a Director decision", async () => {
    const markup = await render(AdminOperationsPage, "en");
    const gated = orderProgressStages.filter(
      (stage) => stageDefinition(stage).approvalSubject !== null,
    );

    expect(gated.length).toBeGreaterThan(0);
    expect(markup.split("Required").length - 1).toBe(gated.length);
  });

  it("renders English labels for the English admin locale", async () => {
    const markup = await render(AdminOperationsPage, "en");

    expect(markup).toContain(stageDefinition("received").labels.en);
    expect(markup).not.toContain(stageDefinition("received").labels.vi);
  });
});

describe("admin approvals page", () => {
  it("lists every approval subject and the permission that decides it", async () => {
    const markup = await render(AdminApprovalsPage, "vi");

    for (const subject of approvalSubjects) {
      expect(markup).toContain(subject);
    }
  });

  it("states the confirmed rule that the Director approves everything", async () => {
    const markup = await render(AdminApprovalsPage, "en");

    expect(markup).toContain("all of them");
    expect(markup).toContain("Separation of duties");
  });
});

describe("admin organisation page", () => {
  it("lists every position with its responsibilities and owned data", async () => {
    const markup = await render(AdminOrganizationPage, "vi");

    for (const position of organizationPositions) {
      expect(markup).toContain(position.labels.vi);
      for (const responsibility of position.responsibilities.vi) {
        expect(markup).toContain(responsibility);
      }
      for (const owned of position.ownedData.vi) {
        expect(markup).toContain(owned);
      }
    }
  });

  it("lists every operational form", async () => {
    const markup = await render(AdminOrganizationPage, "vi");

    for (const form of operationalForms) {
      expect(markup).toContain(form.labels.vi);
    }
  });

  // The forms are still definitions only; the page must not imply otherwise.
  it("does not claim a form has a screen while all forms are planned", async () => {
    const markup = await render(AdminOrganizationPage, "en");
    const planned = operationalForms.filter(
      (form) => form.status === "planned",
    ).length;

    expect(markup.split("Definition only").length - 1).toBe(planned);
  });

  it("states the confirmed price visibility rule", async () => {
    const markup = await render(AdminOrganizationPage, "en");

    expect(markup).toContain("Director and the Company Accountant");
  });
});
