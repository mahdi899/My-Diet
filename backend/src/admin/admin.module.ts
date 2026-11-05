import { Module } from '@nestjs/common';
import { MaintenanceModule } from '../maintenance/maintenance.module.js';
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
import { DemoLeadsController } from './demo-leads.controller.js';

@Module({
  imports: [MaintenanceModule, MoneyModule, PublishingModule],
  controllers: [AdminController, SpecialistsController, SpecialistProfileController, PublicConfigController, IntegrationsController, WebAnalyticsController, DemoLeadsController],
  providers: [AdminService, IntegrationsService],
  exports: [AdminService, MaintenanceModule],
})
export class AdminModule {}
