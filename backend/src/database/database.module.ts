import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { ENV, type Env } from '../config/env.js';
import { Database, KYSELY, PG_POOL, PG_REPLICA } from './database.js';
import './pg-types.js';

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
      provide: PG_REPLICA,
      inject: [ENV],
      useFactory: (env: Env) =>
        new Pool({
          connectionString: env.DATABASE_REPLICA_URL || env.DATABASE_URL,
          max: 5,
          application_name: `sabzine-${env.APP_ROLE}-replica`,
        }),
    },
    {
      provide: KYSELY,
      inject: [PG_POOL],
      useFactory: (pool: Pool) =>
        new Kysely<Database>({ dialect: new PostgresDialect({ pool }) }),
    },
  ],
  exports: [PG_POOL, PG_REPLICA, KYSELY],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    @Inject(PG_REPLICA) private readonly replica: Pool,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.replica.end();
    await this.db.destroy();
  }
}
