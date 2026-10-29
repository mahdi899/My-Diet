import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { JOB_QUEUE, type JobQueue } from '../jobs/job-queue.js';
import { OutboxRelay } from '../jobs/outbox-relay.js';
import { RealtimeService } from './realtime.service.js';

@Injectable()
export class PushJob implements OnModuleInit {
  constructor(
    @Inject(JOB_QUEUE) private readonly boss: JobQueue,
    private readonly relay: OutboxRelay,
    private readonly realtime: RealtimeService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.relay.ensureStarted();
    if (!(await this.boss.getQueue('push.send'))) {
      await this.boss.createQueue('push.send', { policy: 'singleton' });
    }
    await this.boss.work('push.send', async (jobs) => {
      for (const job of jobs) {
        const payload = (job.data as { payload?: { userId?: unknown; kind?: unknown } }).payload;
        if (payload && typeof payload.userId === 'string' && typeof payload.kind === 'string') {
          await this.realtime.deliver(payload.userId, payload.kind);
        }
      }
    });
  }
}
