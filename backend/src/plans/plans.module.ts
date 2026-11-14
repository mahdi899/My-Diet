import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.js';
import { ENV, type Env } from '../config/env.js';
import { PLAN_DRAFT_PROVIDER, type PlanDraftProvider } from './application/draft-provider.js';
import { BudgetService } from '../ai/budget.service.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import { loadModelProfile } from '../ai/draft/model-profile.js';
import { encryptText, decryptText, openAnswers } from '../common/field-crypto.js';
import { aiAttempts, aiCostCapHits } from '../metrics/metrics.js';
import { PlanUseCases } from './application/plan-use-cases.js';
import { PostgresPlanRepository } from './infrastructure/postgres-plan-repository.js';
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
  providers: [
    { provide: PostgresPlanRepository, inject: [PG_POOL], useFactory: (pool: Pool) => new PostgresPlanRepository(pool) },
    {
      provide: PlanUseCases,
      inject: [PostgresPlanRepository, PLAN_DRAFT_PROVIDER, BudgetService, OnboardingService, PG_POOL, ENV],
      useFactory: (repository: PostgresPlanRepository, provider: PlanDraftProvider, budget: BudgetService, onboarding: OnboardingService, pool: Pool, env: Env) =>
        new PlanUseCases(repository, {
          provider,
          budget,
          profiles: {
            ensureProfile: userId => onboarding.ensureProfile(userId),
            loadModelProfile: userId => loadModelProfile(pool, userId),
          },
          cipher: {
            encrypt: text => encryptText(text, env.FIELD_KEY),
            decrypt: text => decryptText(text, env.FIELD_KEY),
            openAnswers: answers => openAnswers(answers, env.FIELD_KEY),
          },
          telemetry: {
            costCapHit: () => aiCostCapHits.inc(),
            attempt: status => aiAttempts.inc({ status }),
          },
        }),
    },
    PlanDraftService, PlanChangeService,
  ],
  exports: [PlanDraftService, PlanChangeService],
})
export class PlansModule {}
