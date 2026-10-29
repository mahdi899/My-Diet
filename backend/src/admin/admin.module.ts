import { Module } from '@nestjs/common';
import { MaintenanceModule } from '../maintenance/maintenance.module.js';
import { AdminController, SpecialistsController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [MaintenanceModule],
  controllers: [AdminController, SpecialistsController],
  providers: [AdminService],
  exports: [AdminService, MaintenanceModule],
})
export class AdminModule {}
