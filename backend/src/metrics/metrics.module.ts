import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller.js';
import { startDefaultMetrics } from './metrics.js';

startDefaultMetrics();

@Module({ controllers: [MetricsController] })
export class MetricsModule {}
