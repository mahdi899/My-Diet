import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module.js';
import { MoneyController } from './money.controller.js';
import { MoneyService } from './money.service.js';

@Module({
  imports: [PlansModule],
  controllers: [MoneyController],
  providers: [MoneyService],
  exports: [MoneyService],
})
export class MoneyModule {}
