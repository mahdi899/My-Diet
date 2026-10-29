import { Module } from '@nestjs/common';
import { MoneyModule } from '../money/money.module.js';
import { PlansModule } from '../plans/plans.module.js';
import { TrackingController } from './tracking.controller.js';
import { TrackingService } from './tracking.service.js';

@Module({
  imports: [PlansModule, MoneyModule],
  controllers: [TrackingController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
