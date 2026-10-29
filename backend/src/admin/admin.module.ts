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

@Module({
  imports: [MaintenanceModule, MoneyModule],
  controllers: [AdminController, SpecialistsController, SpecialistProfileController, PublicConfigController],
  providers: [AdminService],
  exports: [AdminService, MaintenanceModule],
})
export class AdminModule {}
