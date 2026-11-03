import { Module } from '@nestjs/common';
import { JourneyService } from './journey.service.js';
import { ProductReportsService } from './product-reports.service.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ProductReportsService, JourneyService],
  exports: [ReportsService, ProductReportsService, JourneyService],
})
export class ReportsModule {}
