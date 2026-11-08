import { Module } from '@nestjs/common';
import type { Pool } from 'pg';
import { FakePlanDraftProvider, PLAN_DRAFT_PROVIDER } from '../adapters/plan-draft.js';
import { ENV, type Env } from '../config/env.js';
import { PG_POOL } from '../database/database.js';
import { FoodModule } from '../food/food.module.js';
import { FoodService } from '../food/food.service.js';
import { AiAdminController } from './ai-admin.controller.js';
import { AiAdminService } from './ai-admin.service.js';
import { BudgetService } from './budget.service.js';
import { PoolPlanDraftProvider } from './draft/pool-provider.js';
import { PromptStore } from './draft/prompts.js';
import { PoolStore } from './pool/pool-store.js';
import { PoolRouter } from './pool/router.js';

export const AI_POOL_STORE = Symbol('AI_POOL_STORE');

@Module({
  imports: [FoodModule],
  controllers: [AiAdminController],
  providers: [
    BudgetService,
    AiAdminService,
    PromptStore,
    {
      provide: AI_POOL_STORE,
      inject: [PG_POOL, ENV],
      useFactory: (pool: Pool, env: Env) => new PoolStore(pool, env.FIELD_KEY),
    },
    {
      provide: PoolRouter,
      inject: [AI_POOL_STORE, BudgetService, ENV],
      useFactory: (store: PoolStore, budget: BudgetService, env: Env) =>
        new PoolRouter(store, budget, { allowPrivate: env.AI_ALLOW_PRIVATE_ENDPOINTS }),
    },
    {
      provide: PLAN_DRAFT_PROVIDER,
      inject: [ENV, PoolRouter, FoodService, PromptStore],
      useFactory: (env: Env, router: PoolRouter, foods: FoodService, prompts: PromptStore) =>
        env.AI_PROVIDER === 'fake' ? new FakePlanDraftProvider() : new PoolPlanDraftProvider(router, foods, prompts),
    },
  ],
  exports: [BudgetService, PromptStore, PoolRouter, AI_POOL_STORE, PLAN_DRAFT_PROVIDER],
})
export class AiModule {}
