import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get('live')
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  live() {
    return { status: 'ok' as const };
  }

  @Get('ready')
  @ApiOkResponse({ schema: { example: { status: 'ok', database: 'up' } } })
  async ready() {
    try {
      await this.pool.query('select 1');
      return { status: 'ok' as const, database: 'up' as const };
    } catch {
      throw new ServiceUnavailableException({
        status: 'down',
        database: 'down',
      });
    }
  }
}
