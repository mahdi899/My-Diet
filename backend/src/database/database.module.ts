import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { ENV, type Env } from '../config/env.js';
import { Database, KYSELY, PG_POOL } from './database.js';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ENV],
      useFactory: (env: Env) =>
        new Pool({
          connectionString: env.DATABASE_URL,
          max: env.APP_ROLE === 'worker' ? 8 : 10,
          application_name: `sabzine-${env.APP_ROLE}`,
        }),
    },
    {
      provide: KYSELY,
      inject: [PG_POOL],
      useFactory: (pool: Pool) =>
        new Kysely<Database>({ dialect: new PostgresDialect({ pool }) }),
    },
  ],
  exports: [PG_POOL, KYSELY],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async onModuleDestroy(): Promise<void> {
    await this.db.destroy();
  }
}
