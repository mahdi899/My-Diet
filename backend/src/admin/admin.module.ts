import { Module } from '@nestjs/common';
import { MaintenanceModule } from '../maintenance/maintenance.module.js';
import { MoneyModule } from '../money/money.module.js';
import {
  AdminController,
  PublicConfigController,
  SpecialistProfileController,
  SpecialistsController,
} from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { IntegrationsController } from './integrations.controller.js';
import { IntegrationsService } from './integrations.service.js';

@Module({
  imports: [MaintenanceModule, MoneyModule],
  controllers: [AdminController, SpecialistsController, SpecialistProfileController, PublicConfigController, IntegrationsController],
  providers: [AdminService, IntegrationsService],
  exports: [AdminService, MaintenanceModule],
})
export class AdminModule {}
