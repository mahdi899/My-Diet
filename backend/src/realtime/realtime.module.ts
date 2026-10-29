import { Module } from '@nestjs/common';
import { AdaptersModule } from '../adapters/adapters.module.js';
import { RealtimeController } from './realtime.controller.js';
import { RealtimeService } from './realtime.service.js';

@Module({
  imports: [AdaptersModule],
  controllers: [RealtimeController],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
