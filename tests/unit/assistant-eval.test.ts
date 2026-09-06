import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { AnthropicAssistantProvider } from "@/domains/assistant/providers/anthropic";
import { OpenAiCompatibleAssistantProvider } from "@/domains/assistant/providers/openai-compatible";
import type { AssistantProvider } from "@/domains/assistant/providers/types";
import type { SystemRoleKey } from "@/domains/identity/role-definitions";

import { runCase } from "../eval/harness";

/**
 * Live mode: `ASSISTANT_EVAL_LIVE=1 ANTHROPIC_API_KEY=… npx vitest run
 * tests/unit/assistant-eval.test.ts` runs the same cases against the real
 * model; with `AI_PROVIDER=openai-compatible` plus `OPENAI_COMPAT_BASE_URL`,
 * `OPENAI_COMPAT_API_KEY` and `AI_MODEL` it runs against that endpoint
 * instead (mind the free-tier quotas: every case is several requests).
 * Prose-dependent assertions (`expectedText`, exact `expectCalled` order)
 * are relaxed to containment; every permission, payload and proposal
 * assertion stays strict. Without a key the live run is reported as
 * skipped (BLOCKED), never as passed.
 */
const live = process.env.ASSISTANT_EVAL_LIVE === "1";

function liveProviderFromEnv(): AssistantProvider | null {
  if (process.env.AI_PROVIDER === "openai-compatible") {
    const baseUrl = process.env.OPENAI_COMPAT_BASE_URL;
    const apiKey = process.env.OPENAI_COMPAT_API_KEY;
    const model = process.env.AI_MODEL;
    if (!baseUrl || !apiKey || !model) return null;
    return new OpenAiCompatibleAssistantProvider({
      baseUrl,
      apiKey,
      model,
      timeoutMs: 120_000,
      reasoningEffort: process.env.OPENAI_COMPAT_REASONING_EFFORT,
    });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new AnthropicAssistantProvider({
    apiKey,
    model: process.env.AI_MODEL ?? "claude-opus-5",
    timeoutMs: 120_000,
  });
}

const liveProvider: AssistantProvider | null = live
  ? liveProviderFromEnv()
  : null;
const usageTotals = { inputTokens: 0, outputTokens: 0, cases: 0 };

type EvalCase = {
  id: string;
  title: string;
  role: SystemRoleKey;
  input: string;
  businessUnitId?: string | null;
  revoked?: boolean;
  expectCalled?: string[];
  forbidCalled?: string[];
  forbidOffered?: string[];
  expectTrace?: { tool: string; code: string | null }[];
  expectedText?: string[];
  forbiddenText?: string[];
  expectedPayload?: string[];
  forbiddenPayload?: string[];
  expectProposals?: number;
  expectTasksCreated?: number;
  expectProposalItemDueDate?: string;
};

const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../eval/assistant-cases.json", import.meta.url)),
    "utf8",
  ),
) as { version: string; cases: EvalCase[] };

/**
 * The mocked eval run: proves permission projection, tool selection limits,
 * proposal semantics and fact grounding around the model, with the scripted
 * provider standing in for it. It does NOT prove the live model's behaviour;
 * `npm run eval:assistant` does that when a key is configured.
 */
const mode = live
  ? liveProvider
    ? "live model"
    : "live BLOCKED: no key"
  : "mocked provider";

describe(`assistant eval ${fixture.version} (${mode})`, () => {
  if (live && !liveProvider) {
    it.skip("BLOCKED: ASSISTANT_EVAL_LIVE=1 but no provider key is set (ANTHROPIC_API_KEY, or AI_PROVIDER=openai-compatible with OPENAI_COMPAT_* and AI_MODEL)", () =>
      undefined);
    return;
  }
  for (const testCase of fixture.cases) {
    it(`${testCase.id}: ${testCase.title}`, async () => {
      const result = await runCase({
        role: testCase.role,
        message: testCase.input,
        ...(testCase.businessUnitId !== undefined
          ? { businessUnitId: testCase.businessUnitId }
          : {}),
        revoked: testCase.revoked ?? false,
        ...(liveProvider ? { provider: liveProvider } : {}),
      });
      const text = result.response.text;
      const payload = result.toolPayloads.join("\n");
      if (liveProvider) {
        usageTotals.inputTokens += result.response.usage.inputTokens;
        usageTotals.outputTokens += result.response.usage.outputTokens;
        usageTotals.cases += 1;
        console.info(
          `[eval live] ${testCase.id}`,
          result.calledTools,
          result.response.usage,
        );
      }

      for (const tool of testCase.forbidOffered ?? []) {
        expect(result.offeredTools, `offered ${tool}`).not.toContain(tool);
      }
      if (testCase.expectCalled) {
        if (liveProvider) {
          for (const tool of testCase.expectCalled) {
            expect(result.calledTools, `should call ${tool}`).toContain(tool);
          }
          if (testCase.expectCalled.length === 0) {
            expect(result.calledTools).toEqual([]);
          }
        } else {
          expect(result.calledTools).toEqual(testCase.expectCalled);
        }
      }
      for (const tool of testCase.forbidCalled ?? []) {
        expect(result.calledTools).not.toContain(tool);
      }
      for (const trace of testCase.expectTrace ?? []) {
        expect(result.response.trace).toContainEqual(
          expect.objectContaining(trace),
        );
      }
      if (!liveProvider) {
        for (const needle of testCase.expectedText ?? []) {
          expect(text, `text should contain ${needle}`).toContain(needle);
        }
      }
      for (const needle of testCase.forbiddenText ?? []) {
        expect(text, `text must not contain ${needle}`).not.toContain(needle);
      }
      for (const needle of testCase.expectedPayload ?? []) {
        expect(payload, `payload should contain ${needle}`).toContain(needle);
      }
      for (const needle of testCase.forbiddenPayload ?? []) {
        expect(payload, `payload must not contain ${needle}`).not.toContain(
          needle,
        );
      }
      if (testCase.expectProposals !== undefined) {
        expect(result.response.proposals).toHaveLength(
          testCase.expectProposals,
        );
        for (const proposal of result.response.proposals) {
          expect(proposal.status).toBe("proposed");
        }
      }
      if (testCase.expectTasksCreated !== undefined) {
        const created = [...result.world.tasks.tasks.values()].filter(
          (task) => task.source.kind === "proposal",
        );
        expect(created).toHaveLength(testCase.expectTasksCreated);
      }
      if (testCase.expectProposalItemDueDate) {
        expect(result.response.proposals[0]?.items[0]?.dueDate).toBe(
          testCase.expectProposalItemDueDate,
        );
      }
    });
  }
});
