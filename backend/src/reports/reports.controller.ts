import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actor, Public, Roles } from '../common/auth.js';
import { JourneyService } from './journey.service.js';
import { ProductReportsService } from './product-reports.service.js';
import { ReportsService } from './reports.service.js';

@ApiTags('reports')
@Controller('v1')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly product: ProductReportsService,
    private readonly journeys: JourneyService,
  ) {}

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

  @Roles('admin')
  @Get('admin/reports/retention')
  @ApiOperation({ summary: 'Week 1, 2, and 4 retention. A window that has not elapsed is not_yet_measurable, not zero.' })
  retention(@Query('from') from = '', @Query('to') to = '', @Query('event') event = 'activity') {
    return this.product.retention(from, to, event);
  }

  @Roles('admin')
  @Get('admin/reports/foods')
  foods(@Query('from') from = '', @Query('to') to = '', @Query('kind') kind = 'selected') {
    return this.product.foods(from, to, kind);
  }

  @Roles('admin')
  @Get('admin/reports/feedback')
  feedback(@Query('from') from = '', @Query('to') to = '') {
    return this.product.feedback(from, to);
  }

  @Roles('admin')
  @Get('admin/reports/specialists')
  specialists(@Query('sort') sort = 'rating') {
    return this.product.specialists(sort);
  }

  @Public()
  @Post('journey/events')
  @ApiOperation({ summary: 'Record a bounded journey batch. Anonymous installs may later link to one account. Client claims of visit type are not trusted.' })
  journey(@Req() req: Request, @Body() body: unknown) {
    return this.journeys.ingest(body, req.header('authorization'));
  }

  @Roles('admin')
  @Get('admin/reports/journeys')
  @ApiOperation({ summary: 'Aggregate screen graph. Output has no session, install, or account identifiers.' })
  journeyReport(
    @Query('from') from = '',
    @Query('to') to = '',
    @Query('platform') platform = 'all',
    @Query('appVersion') appVersion = 'all',
    @Query('sessionType') sessionType = '',
  ) {
    return this.journeys.report(from, to, platform, appVersion, sessionType);
  }
}
