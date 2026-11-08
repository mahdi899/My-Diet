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

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionParams {
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  /** Ask the provider for a JSON object response. */
  json: boolean;
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
