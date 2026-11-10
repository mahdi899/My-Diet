import { Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { CoachProactiveJob } from '../coach/proactive-job.js';
import { CoachModule } from '../coach/coach.module.js';
import { PlanDraftJob } from '../plans/draft-job.js';
import { PlansModule } from '../plans/plans.module.js';
import { PushJob } from '../realtime/push-job.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { JOB_QUEUE, type JobQueue } from './job-queue.js';
import { OutboxRelay } from './outbox-relay.js';

@Module({
  imports: [PlansModule, RealtimeModule, CoachModule],
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
    PlanDraftJob,
    PushJob,
    CoachProactiveJob,
  ],
  exports: [OutboxRelay, JOB_QUEUE],
})
export class JobsModule {}
