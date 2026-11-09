import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JOB_QUEUE, type JobQueue } from '../jobs/job-queue.js';
import { OutboxRelay } from '../jobs/outbox-relay.js';
import { ProactiveService } from '../coach/proactive.js';

/** Sweeps nutrition-coach reminders every 15 minutes. Sends are deduped and budgeted inside ProactiveService. */
@Injectable()
export class CoachProactiveJob implements OnModuleInit {
  private readonly logger = new Logger(CoachProactiveJob.name);

  constructor(
    @Inject(JOB_QUEUE) private readonly boss: JobQueue,
    private readonly relay: OutboxRelay,
    private readonly proactive: ProactiveService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.relay.ensureStarted();
    if (!(await this.boss.getQueue('coach.proactive'))) {
      await this.boss.createQueue('coach.proactive', { policy: 'singleton' });
    }
    await this.boss.schedule('coach.proactive', '*/15 * * * *', { tick: true }, { tz: 'Asia/Tehran' });
    await this.boss.work('coach.proactive', async () => {
      try {
        const sent = await this.proactive.run();
        if (sent) this.logger.log(`coach proactive sent ${sent}`);
      } catch (error) {
        this.logger.error(`coach proactive failed: ${error instanceof Error ? error.name : 'error'}`);
        throw error;
      }
    });
  }
}
