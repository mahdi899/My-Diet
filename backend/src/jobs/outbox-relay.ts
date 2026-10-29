import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.js';
import { JOB_QUEUE, type JobQueue } from './job-queue.js';
import { outboxDispatched, outboxDispatchFailures } from '../metrics/metrics.js';

const MAX_ATTEMPTS = 10;
const BATCH = 20;

interface OutboxRow {
  id: string;
  topic: string;
  aggregate_id: string;
  payload: unknown;
  attempts: number;
}

/**
 * Moves committed outbox rows onto pg-boss. A crash after send and before
 * `dispatched_at` is set can enqueue the same event twice; consumers must be
 * idempotent. `singletonKey` is the event id so pg-boss collapses duplicates
 * that are still in the queue.
 */
@Injectable()
export class OutboxRelay implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly queues = new Set<string>();
  private started = false;
  lastFailure = '';

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(JOB_QUEUE) private readonly boss: JobQueue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureStarted();
  }

  start(intervalMs = 1000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.dispatchOnce().catch((error: unknown) => {
        this.logger.error(
          error instanceof Error ? error.message : 'outbox dispatch failed',
        );
      });
    }, intervalMs);
    this.timer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (!this.started) return;
    this.started = false;
    await this.boss.stop({ graceful: true, timeout: 5_000 });
  }

  async dispatchOnce(): Promise<number> {
    if (this.running) return 0;
    await this.ensureStarted();
    if (this.running) return 0;
    this.running = true;
    let delivered = 0;
    try {
      const rows = await this.claim();
      for (const row of rows) {
        try {
          await this.ensureQueue(row.topic);
          await this.boss.send(
            row.topic,
            {
              eventId: row.id,
              aggregateId: row.aggregate_id,
              payload: row.payload,
            },
            { singletonKey: row.id },
          );
          await this.pool.query(
            `update outbox_events
             set dispatched_at = now()
             where id = $1 and dispatched_at is null`,
            [row.id],
          );
          outboxDispatched.inc({ topic: row.topic });
          delivered += 1;
        } catch (error) {
          outboxDispatchFailures.inc({ topic: row.topic });
          this.lastFailure = error instanceof Error ? error.message : 'unknown';
          this.logger.error(`outbox ${row.id} failed: ${this.lastFailure}`);
        }
      }
      return delivered;
    } finally {
      this.running = false;
    }
  }

  private async ensureStarted(): Promise<void> {
    if (this.started) return;
    await this.boss.start();
    await this.boss.createQueue('health.ping', { policy: 'singleton' });
    this.queues.add('health.ping');
    await this.boss.work('health.ping', async () => undefined);
    this.started = true;
  }

  private async ensureQueue(topic: string): Promise<void> {
    if (this.queues.has(topic)) return;
    if (!(await this.boss.getQueue(topic))) {
      await this.boss.createQueue(topic, { policy: 'singleton' });
    }
    this.queues.add(topic);
  }

  private async claim(): Promise<OutboxRow[]> {
    const result = await this.pool.query<OutboxRow>(
      `with claimed as (
         select id from outbox_events
         where dispatched_at is null and attempts < $1
         order by created_at
         for update skip locked
         limit $2
       )
       update outbox_events e
       set attempts = e.attempts + 1
       from claimed
       where e.id = claimed.id
       returning e.id, e.topic, e.aggregate_id, e.payload, e.attempts`,
      [MAX_ATTEMPTS, BATCH],
    );
    return result.rows;
  }
}
