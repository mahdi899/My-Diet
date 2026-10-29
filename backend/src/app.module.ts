import { DynamicModule, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AdaptersModule } from './adapters/adapters.module.js';
import { EnvModule } from './config/env.module.js';
import { loadEnv } from './config/env.js';
import { pinoHttpOptions } from './config/logger.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { ProductModule } from './product.module.js';

@Module({})
export class AppModule {
  static forRoot(): DynamicModule {
    const env = loadEnv();
    return {
      module: AppModule,
      imports: [
        EnvModule,
        LoggerModule.forRoot({ pinoHttp: pinoHttpOptions(env) }),
        DatabaseModule,
        HealthModule,
        MetricsModule,
        AdaptersModule,
        ProductModule,
        ...(env.APP_ROLE === 'worker' ? [JobsModule] : []),
      ],
    };
  }
}
