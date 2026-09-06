import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { AssistantError } from "@/domains/assistant/contracts";
import type {
  AssistantProvider,
  ProviderRequest,
  ProviderResult,
} from "@/domains/assistant/providers/types";

/**
 * The Claude adapter. Server-only: the key never leaves this module, and
 * the only request shape it sends is the one the orchestrator builds — a
 * frozen system prompt (cached), the conversation, and the tool
 * definitions the caller is allowed to see. Thinking is left at the model's
 * default (adaptive on Claude Opus 5); the answer is short business prose.
 */
export class AnthropicAssistantProvider implements AssistantProvider {
  readonly kind = "anthropic" as const;
  readonly model: string;
  private readonly client: Anthropic;

  constructor(input: { apiKey: string; model: string; timeoutMs: number }) {
    this.model = input.model;
    this.client = new Anthropic({
      apiKey: input.apiKey,
      timeout: input.timeoutMs,
      maxRetries: 1,
    });
  }

  async complete(request: ProviderRequest): Promise<ProviderResult> {
    const parameters = {
      model: this.model,
      max_tokens: request.maxTokens,
      system: [
        {
          type: "text" as const,
          text: request.system,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      messages: [...request.messages],
      tools: [...request.tools],
      tool_choice: { type: "auto" as const },
    };
    try {
      // The streamed and the plain call return the same message; the SDK's
      // stream helper reassembles it, so the two paths differ only in
      // whether the answer is also handed over as it is written.
      const response = request.onTextDelta
        ? await this.stream(parameters, request, request.onTextDelta)
        : await this.client.messages.create(parameters, {
            signal: request.signal,
          });
      return {
        content: response.content,
        stopReason: response.stop_reason,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } catch (error) {
      if (request.signal.aborted) {
        throw new AssistantError(
          "PROVIDER_TIMEOUT",
          "The model did not answer in time.",
        );
      }
      if (error instanceof Anthropic.APIConnectionTimeoutError) {
        throw new AssistantError(
          "PROVIDER_TIMEOUT",
          "The model did not answer in time.",
        );
      }
      if (error instanceof Anthropic.RateLimitError) {
        throw new AssistantError(
          "RATE_LIMITED",
          "The model provider is rate limiting requests.",
        );
      }
      if (error instanceof Anthropic.AuthenticationError) {
        throw new AssistantError(
          "NOT_CONFIGURED",
          "The model provider rejected the configured key.",
        );
      }
      if (error instanceof Anthropic.APIError) {
        console.error("[assistant] provider error", error.status, error.name);
        throw new AssistantError(
          "PROVIDER_ERROR",
          "The model provider returned an error.",
        );
      }
      if (error instanceof Anthropic.APIConnectionError) {
        throw new AssistantError(
          "PROVIDER_ERROR",
          "The model provider could not be reached.",
        );
      }
      throw error;
    }
  }

  private async stream(
    parameters: Anthropic.MessageCreateParamsNonStreaming,
    request: ProviderRequest,
    onTextDelta: (delta: string) => void,
  ): Promise<Anthropic.Message> {
    const stream = this.client.messages.stream(parameters, {
      signal: request.signal,
    });
    stream.on("text", onTextDelta);
    return stream.finalMessage();
  }
}
