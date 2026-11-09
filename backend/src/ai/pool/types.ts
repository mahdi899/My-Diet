/** Everything the router and its admin API share. Money is in micro-USD (millionths of a dollar). */
export type AttemptOutcome =
  | 'ok'
  | 'rate_limited'
  | 'auth_failed'
  | 'rejected'
  | 'timeout'
  | 'invalid_json'
  | 'invalid_plan'
  | 'outcome_unknown'
  | 'budget_blocked';

/** After these the provider may have run and billed the call, so the same member is never retried. */
export const UNCERTAIN_OUTCOMES: readonly AttemptOutcome[] = ['timeout', 'outcome_unknown'];

/** One part of a multimodal message. Images travel as data URLs or https URLs (OpenAI-compatible shape). */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ToolSpec {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ToolCall {
  id: string;
  type: 'function';
  /** `arguments` is the raw JSON text the model produced; callers validate it. */
  function: { name: string; arguments: string };
}

export type ToolChoice = 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** Plain text for every existing caller; parts for vision; null only on an assistant message that carries tool calls. */
  content: string | ContentPart[] | null;
  /** Assistant turns that asked for tools. */
  tool_calls?: ToolCall[];
  /** Tool turns answer one call. */
  tool_call_id?: string;
}

/** Text of a message, ignoring image parts. */
export function messageText(message: ChatMessage): string {
  if (message.content == null) return '';
  if (typeof message.content === 'string') return message.content;
  return message.content.map((part) => (part.type === 'text' ? part.text : '')).join('\n');
}

export function imageCount(message: ChatMessage): number {
  return Array.isArray(message.content) ? message.content.filter((part) => part.type === 'image_url').length : 0;
}

export interface CompletionParams {
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  /** Ask the provider for a JSON object response. */
  json: boolean;
  tools?: ToolSpec[];
  toolChoice?: ToolChoice;
}

export interface ProviderConfig {
  id: string;
  name: string;
  kind: 'openrouter' | 'openai_compatible';
  baseUrl: string;
  apiKey: string;
  httpReferer: string | null;
  appTitle: string | null;
}

export interface Completion {
  content: string;
  /** Tools the model asked for; empty for plain answers. */
  toolCalls?: ToolCall[];
  finishReason?: string | null;
  /** The model that actually answered (OpenRouter may route). */
  model: string;
  tokensIn: number;
  tokensOut: number;
  /** Provider-reported cost, when available. */
  costMicros: number | null;
  latencyMs: number;
}

export class ProviderCallError extends Error {
  constructor(
    readonly outcome: Exclude<AttemptOutcome, 'ok' | 'invalid_json' | 'invalid_plan' | 'budget_blocked'>,
    readonly code: string,
    readonly latencyMs = 0,
    readonly retryAfterMs: number | null = null,
  ) {
    super(code);
  }
}

/** A stream that broke after the provider had accepted the call. Text already sent to the caller is in `partialText`. */
export class StreamBrokenError extends ProviderCallError {
  constructor(
    code: string,
    latencyMs: number,
    readonly partialText: string,
  ) {
    super('outcome_unknown', code, latencyMs);
  }
}

/** Thrown by a `validate` callback; the router records it and moves on to the next member. */
export class ValidationFailure extends Error {
  constructor(
    readonly outcome: 'invalid_json' | 'invalid_plan',
    readonly code: string,
  ) {
    super(code);
  }
}

export interface PoolMember {
  memberId: string;
  poolCode: string;
  provider: ProviderConfig;
  model: string;
  position: number;
  weight: number;
  priceInMicrosPerM: number;
  priceOutMicrosPerM: number;
  consecutiveFailures: number;
  cooldownUntil: Date | null;
}

export interface PoolSettings {
  code: string;
  strategy: 'priority' | 'cost_first' | 'weighted';
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  maxAttempts: number;
}

export interface AttemptRecord {
  memberId: string;
  provider: string;
  model: string;
  outcome: AttemptOutcome;
  errorCode: string | null;
  tokensIn: number;
  tokensOut: number;
  costMicros: number;
  costSource: 'provider' | 'estimate';
  latencyMs: number;
}

export interface PoolUsage {
  tokens: number;
  costMicros: number;
  model: string;
  provider: string;
  attempts: number;
}
