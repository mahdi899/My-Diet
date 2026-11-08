import { Module } from '@nestjs/common';
import { AdaptersModule } from '../adapters/adapters.module.js';
import { AiModule } from '../ai/ai.module.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import { PlanChangesController } from './plan-changes.controller.js';
import { PlanChangeService } from './plan-changes.service.js';
import { PlansController } from './plans.controller.js';
import { PlanDraftService } from './plans.service.js';

@Module({
  imports: [AdaptersModule, AiModule, OnboardingModule],
  controllers: [PlansController, PlanChangesController],
  providers: [PlanDraftService, PlanChangeService],
  exports: [PlanDraftService, PlanChangeService],
})
export class PlansModule {}
