import "server-only";

import { AssistantError } from "@/domains/assistant/contracts";
import {
  type ChatCompletionResponse,
  fromChatCompletion,
  toChatCompletionRequest,
} from "@/domains/assistant/providers/openai-wire";
import type {
  AssistantProvider,
  ProviderRequest,
  ProviderResult,
} from "@/domains/assistant/providers/types";

/**
 * Adapter for any endpoint that speaks the OpenAI Chat Completions protocol:
 * Gemini's compatibility layer, Groq, Ollama, OpenRouter. Server-only: the
 * key never leaves this module. The orchestrator keeps talking in the
 * Anthropic shape and the translation lives in openai-wire.ts, so this class
 * is only the HTTP call and the error classification. The single retry on a
 * 5xx exists because the free tiers answer "model overloaded" often enough
 * that a second of patience saves a visible failure.
 */
export class OpenAiCompatibleAssistantProvider implements AssistantProvider {
  readonly kind = "openai-compatible" as const;
  readonly model: string;
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly reasoningEffort: string | undefined;

  constructor(input: {
    baseUrl: string;
    apiKey: string;
    model: string;
    timeoutMs: number;
    reasoningEffort?: string | undefined;
  }) {
    this.model = input.model;
    this.endpoint = `${input.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    this.apiKey = input.apiKey;
    this.timeoutMs = input.timeoutMs;
    this.reasoningEffort = input.reasoningEffort;
  }

  async complete(request: ProviderRequest): Promise<ProviderResult> {
    const body = JSON.stringify(
      toChatCompletionRequest({
        model: this.model,
        system: request.system,
        messages: request.messages,
        tools: request.tools,
        maxTokens: request.maxTokens,
        reasoningEffort: this.reasoningEffort,
      }),
    );

    for (let attempt = 0; ; attempt += 1) {
      const response = await this.send(body, request.signal);
      if (response.ok) {
        let payload: ChatCompletionResponse;
        try {
          payload = (await response.json()) as ChatCompletionResponse;
        } catch {
          throw new AssistantError(
            "PROVIDER_ERROR",
            "The model provider returned an unreadable answer.",
          );
        }
        return fromChatCompletion(payload);
      }

      const detail = (await response.text().catch(() => "")).slice(0, 300);
      console.error("[assistant] provider error", response.status, detail);
      if (response.status === 429) {
        throw new AssistantError(
          "RATE_LIMITED",
          "The model provider is rate limiting requests.",
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw new AssistantError(
          "NOT_CONFIGURED",
          "The model provider rejected the configured key.",
        );
      }
      if (response.status >= 500 && attempt === 0) {
        await wait(1_500, request.signal);
        continue;
      }
      throw new AssistantError(
        "PROVIDER_ERROR",
        "The model provider returned an error.",
      );
    }
  }

  private async send(body: string, signal: AbortSignal): Promise<Response> {
    try {
      return await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body,
        signal: AbortSignal.any([signal, AbortSignal.timeout(this.timeoutMs)]),
      });
    } catch (error) {
      if (signal.aborted || isAbort(error)) {
        throw new AssistantError(
          "PROVIDER_TIMEOUT",
          "The model did not answer in time.",
        );
      }
      throw new AssistantError(
        "PROVIDER_ERROR",
        "The model provider could not be reached.",
      );
    }
  }
}

function isAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      signal.removeEventListener("abort", done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });
}
