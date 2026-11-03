import { Module } from '@nestjs/common';
import { ProductReportsService } from './product-reports.service.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ProductReportsService],
  exports: [ReportsService, ProductReportsService],
})
export class ReportsModule {}
