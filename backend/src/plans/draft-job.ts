import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { JOB_QUEUE, type JobQueue } from '../jobs/job-queue.js';
import { OutboxRelay } from '../jobs/outbox-relay.js';
import { PlanDraftService } from './plans.service.js';

@Injectable()
export class PlanDraftJob implements OnModuleInit {
  constructor(
    @Inject(JOB_QUEUE) private readonly boss: JobQueue,
    private readonly relay: OutboxRelay,
    private readonly drafts: PlanDraftService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.relay.ensureStarted();
    if (!(await this.boss.getQueue('plan.generate'))) {
      await this.boss.createQueue('plan.generate', { policy: 'singleton' });
    }
    await this.boss.work('plan.generate', async (jobs) => {
      for (const job of jobs) {
        const aggregateId = (job.data as { aggregateId?: unknown }).aggregateId;
        if (typeof aggregateId === 'string') await this.drafts.generate(aggregateId);
      }
    });
  }
}
