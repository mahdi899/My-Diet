import { collectDefaultMetrics, Counter, Registry } from 'prom-client';

export const metricsRegistry = new Registry();

let defaultsStarted = false;

export function startDefaultMetrics(): void {
  if (defaultsStarted) return;
  defaultsStarted = true;
  collectDefaultMetrics({ register: metricsRegistry });
}

export const outboxDispatched = new Counter({
  name: 'sabzine_outbox_dispatched_total',
  help: 'Outbox events handed to the job queue',
  labelNames: ['topic'] as const,
  registers: [metricsRegistry],
});

export const outboxDispatchFailures = new Counter({
  name: 'sabzine_outbox_dispatch_failures_total',
  help: 'Outbox events that failed while being handed to the job queue',
  labelNames: ['topic'] as const,
  registers: [metricsRegistry],
});

export const aiAttempts = new Counter({
  name: 'sabzine_ai_attempts_total',
  help: 'Plan draft attempts recorded by the server',
  labelNames: ['status'] as const,
  registers: [metricsRegistry],
});

export const aiCostCapHits = new Counter({
  name: 'sabzine_ai_cost_cap_hits_total',
  help: 'Drafts written manually because the daily model cost cap was reached',
  registers: [metricsRegistry],
});
