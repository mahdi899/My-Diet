import { Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { JOB_QUEUE, type JobQueue } from './job-queue.js';
import { OutboxRelay } from './outbox-relay.js';

@Module({
  providers: [
    {
      provide: JOB_QUEUE,
      inject: [ENV],
      useFactory: async (env: Env): Promise<JobQueue> => {
        const { PgBoss } = await import('pg-boss');
        return new PgBoss({
          connectionString: env.DATABASE_URL,
          schema: 'pgboss',
        });
      },
    },
    OutboxRelay,
  ],
  exports: [OutboxRelay, JOB_QUEUE],
})
export class JobsModule {}
