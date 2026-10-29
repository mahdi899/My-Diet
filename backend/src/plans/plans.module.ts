import { Module } from '@nestjs/common';
import { AdaptersModule } from '../adapters/adapters.module.js';
import { PlansController } from './plans.controller.js';
import { PlanDraftService } from './plans.service.js';

@Module({
  imports: [AdaptersModule],
  controllers: [PlansController],
  providers: [PlanDraftService],
  exports: [PlanDraftService],
})
export class PlansModule {}
