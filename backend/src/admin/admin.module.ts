import { createHmac, randomInt, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.js';
import { ENV, type Env } from '../config/env.js';
import { MelipayamakSmsProvider } from '../adapters/melipayamak.js';
import { OnboardingTransfers } from '../onboarding/application/onboarding-transfers.js';
import { PostgresTransferRepository } from '../onboarding/infrastructure/postgres-transfer-repository.js';
import { ZibalTransferGateway } from '../onboarding/infrastructure/zibal-transfer-gateway.js';
import { OnboardingTransfersController } from './onboarding-transfers.controller.js';
import { Module } from '@nestjs/common';
import { MaintenanceModule } from '../maintenance/maintenance.module.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import { MoneyModule } from '../money/money.module.js';
import { PublishingModule } from '../publishing/publishing.module.js';
import {
  AdminController,
  PublicConfigController,
  SpecialistProfileController,
  SpecialistsController,
} from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { IntegrationsController } from './integrations.controller.js';
import { IntegrationsService } from './integrations.service.js';
import { WebAnalyticsController } from './web-analytics.controller.js';
import { OnboardingSubmissionsController, OnboardingQuestionnaireController } from './onboarding-web.controller.js';
import { CampaignLinksController, CampaignRedirectController } from './campaign-links.controller.js';

@Module({
  imports: [MaintenanceModule, MoneyModule, PublishingModule, OnboardingModule],
  controllers: [OnboardingTransfersController, AdminController, SpecialistsController, SpecialistProfileController, PublicConfigController, IntegrationsController, WebAnalyticsController, OnboardingSubmissionsController, OnboardingQuestionnaireController, CampaignLinksController, CampaignRedirectController],
  providers: [
    {
      provide: OnboardingTransfers,
      inject: [PG_POOL, ENV],
      useFactory: (pool: Pool, env: Env) => new OnboardingTransfers(new PostgresTransferRepository(pool), {
        gateway: new ZibalTransferGateway(),
        confirmation: { send: phone => new MelipayamakSmsProvider(env).sendPurchaseConfirmation(phone) },
        phoneHash: phone => createHmac('sha256', env.FIELD_KEY).update(phone).digest('hex'),
        newId: randomUUID,
        uniqueAmount: base => base + randomInt(1, 10001),
      }),
    },
    AdminService, IntegrationsService,
  ],
  exports: [AdminService, MaintenanceModule],
})
export class AdminModule {}
