import { Module } from '@nestjs/common';
import { AdminController, SpecialistsController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  controllers: [AdminController, SpecialistsController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
