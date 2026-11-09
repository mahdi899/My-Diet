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
  controllers: [AdminController, SpecialistsController, SpecialistProfileController, PublicConfigController, IntegrationsController, WebAnalyticsController, OnboardingSubmissionsController, OnboardingQuestionnaireController, CampaignLinksController, CampaignRedirectController],
  providers: [AdminService, IntegrationsService],
  exports: [AdminService, MaintenanceModule],
})
export class AdminModule {}
