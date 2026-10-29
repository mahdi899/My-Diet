import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module.js';
import { AdaptersModule } from '../adapters/adapters.module.js';
import { MoneyController } from './money.controller.js';
import { MoneyService } from './money.service.js';

@Module({
  imports: [PlansModule, AdaptersModule],
  controllers: [MoneyController],
  providers: [MoneyService],
  exports: [MoneyService],
})
export class MoneyModule {}
