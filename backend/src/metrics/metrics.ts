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
