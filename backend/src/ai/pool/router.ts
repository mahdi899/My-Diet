import { GenerationError } from '../provider-request.js';
import { chatCompletion, type ClientDeps } from './client.js';
import type { PoolStore } from './pool-store.js';
import {
  ProviderCallError,
  UNCERTAIN_OUTCOMES,
  ValidationFailure,
  type AttemptRecord,
  type ChatMessage,
  type Completion,
  type PoolMember,
  type PoolSettings,
  type PoolUsage,
} from './types.js';

/** Decides whether a call may be made. Implemented by the budget service. */
export interface BudgetGate {
  /** Throws BudgetBlockedError when `plannedMicros` more would break a cap. */
  check(requestId: string | null, plannedMicros: number): Promise<void>;
}

export class BudgetBlockedError extends GenerationError {
  constructor(readonly reason: 'kill_switch' | 'daily_cap' | 'monthly_cap' | 'request_cap') {
    super('budget_blocked');
  }
}

export class PoolUnavailableError extends GenerationError {
  constructor(code: 'pool_missing' | 'pool_empty') {
    super(code);
  }
}

export class PoolExhaustedError extends GenerationError {
  constructor(
    readonly chain: AttemptRecord[],
    override readonly usage: PoolUsage,
  ) {
    super('pool_exhausted');
  }
}

export interface RunOptions<T> {
  task: string;
  poolCode: string;
  requestId?: string | null;
  chunk?: string | null;
  /** Built per member so a prompt can mention the model family if it must. */
  messages: ChatMessage[] | ((member: PoolMember) => ChatMessage[]);
  /** Parses and checks the answer. Throw ValidationFailure to move to the next member. */
  validate: (content: string, member: PoolMember) => T;
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
}

export interface RunResult<T> {
  value: T;
  usage: PoolUsage;
  chain: AttemptRecord[];
}

export interface RouterDeps extends ClientDeps {
  rng?: () => number;
  now?: () => Date;
  complete?: typeof chatCompletion;
}

/** Rough token estimate for Persian/English mixed text; used only for budgeting and uncertain calls. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2.5);
}

const priceOf = (perMillion: number, tokens: number) => Math.ceil((perMillion * tokens) / 1_000_000);

/** Upper bound of what one call can cost. */
export function plannedCost(member: PoolMember, tokensIn: number, maxTokens: number): number {
  return priceOf(member.priceInMicrosPerM, tokensIn) + priceOf(member.priceOutMicrosPerM, maxTokens);
}

export class PoolRouter {
  constructor(
    private readonly store: PoolStore,
    private readonly budget: BudgetGate,
    private readonly deps: RouterDeps = {},
  ) {}

  /** Members in the order this call should try them. Cooling-down members are skipped unless nothing else is left. */
  order(settings: PoolSettings, members: PoolMember[]): PoolMember[] {
    const now = (this.deps.now ?? (() => new Date()))().getTime();
    const ready = members.filter((member) => !member.cooldownUntil || member.cooldownUntil.getTime() <= now);
    const pool = ready.length > 0
      ? ready
      : [...members].sort((a, b) => (a.cooldownUntil?.getTime() ?? 0) - (b.cooldownUntil?.getTime() ?? 0)).slice(0, 1);
    if (settings.strategy === 'cost_first') {
      return [...pool].sort(
        (a, b) => a.priceInMicrosPerM + a.priceOutMicrosPerM - (b.priceInMicrosPerM + b.priceOutMicrosPerM) || a.position - b.position,
      );
    }
    if (settings.strategy === 'weighted') {
      const rng = this.deps.rng ?? Math.random;
      const left = [...pool];
      const out: PoolMember[] = [];
      while (left.length) {
        const total = left.reduce((sum, member) => sum + member.weight, 0);
        let pick = rng() * total;
        let index = left.findIndex((member) => (pick -= member.weight) < 0);
        if (index < 0) index = left.length - 1;
        out.push(left.splice(index, 1)[0]!);
      }
      return out;
    }
    return [...pool].sort((a, b) => a.position - b.position);
  }

  async run<T>(options: RunOptions<T>): Promise<RunResult<T>> {
    const settings = await this.store.settings(options.poolCode);
    if (!settings) throw new PoolUnavailableError('pool_missing');
    const members = await this.store.members(options.poolCode);
    if (members.length === 0) throw new PoolUnavailableError('pool_empty');

    const requestId = options.requestId ?? null;
    const chunk = options.chunk ?? null;
    const maxTokens = options.maxTokens ?? settings.maxTokens;
    const complete = this.deps.complete ?? chatCompletion;
    const chain: AttemptRecord[] = [];
    let spent = 0;
    let tokens = 0;

    const tally = (): PoolUsage => {
      const last = chain.filter((entry) => entry.outcome === 'ok').pop() ?? chain[chain.length - 1];
      return { tokens, costMicros: spent, model: last?.model ?? '', provider: last?.provider ?? '', attempts: chain.length };
    };
    const note = async (attempt: AttemptRecord) => {
      chain.push(attempt);
      spent += attempt.costMicros;
      tokens += attempt.tokensIn + attempt.tokensOut;
      await this.store.record(options.task, options.poolCode, requestId, chunk, chain.length, attempt);
    };

    for (const member of this.order(settings, members).slice(0, settings.maxAttempts)) {
      const messages = typeof options.messages === 'function' ? options.messages(member) : options.messages;
      const tokensInEstimate = estimateTokens(messages.map((message) => message.content).join('\n'));
      try {
        await this.budget.check(requestId, plannedCost(member, tokensInEstimate, maxTokens));
      } catch (error) {
        if (error instanceof BudgetBlockedError) {
          await note({
            memberId: member.memberId, provider: member.provider.name, model: member.model, outcome: 'budget_blocked',
            errorCode: error.reason, tokensIn: 0, tokensOut: 0, costMicros: 0, costSource: 'estimate', latencyMs: 0,
          });
          const failure = new BudgetBlockedError(error.reason);
          failure.usage = tally();
          throw failure;
        }
        throw error;
      }

      let completion: Completion;
      try {
        completion = await complete(
          member.provider,
          member.model,
          {
            messages,
            temperature: options.temperature ?? settings.temperature,
            maxTokens,
            timeoutMs: settings.timeoutMs,
            json: options.json ?? true,
          },
          this.deps,
        );
      } catch (error) {
        const failure = error instanceof ProviderCallError ? error : new ProviderCallError('outcome_unknown', 'unexpected', 0);
        const uncertain = UNCERTAIN_OUTCOMES.includes(failure.outcome);
        await note({
          memberId: member.memberId,
          provider: member.provider.name,
          model: member.model,
          outcome: failure.outcome,
          errorCode: failure.code,
          tokensIn: uncertain ? tokensInEstimate : 0,
          tokensOut: 0,
          // A call that may have run is charged at its upper bound so caps stay honest.
          costMicros: uncertain ? plannedCost(member, tokensInEstimate, maxTokens) : 0,
          costSource: 'estimate',
          latencyMs: failure.latencyMs,
        });
        await this.store.markFailed(member.memberId, failure.outcome, failure.code, failure.retryAfterMs);
        continue;
      }

      const cost = completion.costMicros ?? priceOf(member.priceInMicrosPerM, completion.tokensIn) + priceOf(member.priceOutMicrosPerM, completion.tokensOut);
      const base = {
        memberId: member.memberId,
        provider: member.provider.name,
        model: completion.model,
        tokensIn: completion.tokensIn,
        tokensOut: completion.tokensOut,
        costMicros: cost,
        costSource: completion.costMicros == null ? ('estimate' as const) : ('provider' as const),
        latencyMs: completion.latencyMs,
      };
      try {
        const value = options.validate(completion.content, member);
        await note({ ...base, outcome: 'ok', errorCode: null });
        await this.store.markOk(member.memberId);
        return { value, usage: tally(), chain };
      } catch (error) {
        const failure = error instanceof ValidationFailure ? error : new ValidationFailure('invalid_plan', 'validator_crashed');
        await note({ ...base, outcome: failure.outcome, errorCode: failure.code });
        await this.store.markFailed(member.memberId, failure.outcome, failure.code, null);
      }
    }
    throw new PoolExhaustedError(chain, tally());
  }
}
