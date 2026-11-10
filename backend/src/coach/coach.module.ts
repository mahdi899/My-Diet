import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { PoolRouter } from '../ai/pool/router.js';
import { ENV, type Env } from '../config/env.js';
import { FoodModule } from '../food/food.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { PlansModule } from '../plans/plans.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { CoachController } from './coach.controller.js';
import { CoachEffects } from './effects.js';
import { FakeCoachLlm } from './fake-llm.js';
import { CoachInsights } from './insights.js';
import { COACH_LLM, PoolCoachLlm } from './llm.js';
import { MemoryService } from './memory.js';
import { ProactiveService } from './proactive.js';
import { CoachRunner } from './runner.js';
import { SafetyGuard } from './safety.js';
import { CoachStore } from './store.js';
import { FoodPhotoService } from './vision.js';

@Module({
  imports: [AiModule, FoodModule, PlansModule, TrackingModule, MessagingModule],
  controllers: [CoachController],
  providers: [
    CoachStore,
    SafetyGuard,
    CoachInsights,
    FoodPhotoService,
    MemoryService,
    CoachEffects,
    CoachRunner,
    ProactiveService,
    {
      provide: COACH_LLM,
      inject: [ENV, PoolRouter],
      useFactory: (env: Env, router: PoolRouter) => (env.AI_PROVIDER === 'fake' ? new FakeCoachLlm() : new PoolCoachLlm(router)),
    },
  ],
  exports: [ProactiveService, CoachStore],
})
export class CoachModule {}
