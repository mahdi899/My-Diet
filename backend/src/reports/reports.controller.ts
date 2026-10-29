import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actor, Roles } from '../common/auth.js';
import { ReportsService } from './reports.service.js';

@ApiTags('reports')
@Controller('v1')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Roles('specialist')
  @Get('specialist/sla')
  mine(@Req() req: Request) {
    return this.reports.specialist(actor(req).id);
  }

  @Roles('admin')
  @Get('admin/reports/sla')
  admin() {
    return this.reports.admin();
  }
}
