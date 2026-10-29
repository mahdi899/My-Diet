import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actor, Public, Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { normalizeIranianMobile } from '../common/phone.js';
import {
  bodyRecord,
  optionalString,
  rejectUnknown,
  requiredInt,
  requiredString,
  requiredUuid,
} from '../common/parse.js';
import { MaintenanceService } from '../maintenance/maintenance.service.js';
import { AdminService } from './admin.service.js';

@ApiTags('specialists')
@Public()
@Controller('v1/specialists')
export class SpecialistsController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list() {
    return this.admin.publicSpecialists();
  }
}

@ApiTags('admin')
@Controller('v1/admin')
@Roles('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly maintenance: MaintenanceService,
  ) {}

  @Post('specialists')
  create(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['phone', 'displayName', 'credential', 'bio', 'capacity']);
    const capacity = record.capacity == null ? 20 : requiredInt(record.capacity);
    if (capacity < 0 || capacity > 500) throw new ApiError(400, 'validation', 'ظرفیت درست نیست');
    return this.admin.createSpecialist(actor(req).id, {
      phoneE164: normalizeIranianMobile(requiredString(record, 'phone', 32)),
      displayName: requiredString(record, 'displayName', 80),
      credential: optionalString(record, 'credential', 120) ?? '',
      bio: optionalString(record, 'bio', 500) ?? '',
      capacity,
    });
  }

  @Patch('specialists/:id')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['active', 'capacity', 'displayName', 'credential', 'bio']);
    return this.admin.updateSpecialist(actor(req).id, requiredUuid(id), {
      active: typeof record.active === 'boolean' ? record.active : undefined,
      capacity: record.capacity == null ? undefined : requiredInt(record.capacity),
      displayName: optionalString(record, 'displayName', 80),
      credential: optionalString(record, 'credential', 120),
      bio: optionalString(record, 'bio', 500),
    });
  }

  @Post('requests/:id/assignment')
  assign(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['specialistId', 'reason']);
    return this.admin.assign(
      actor(req).id,
      requiredUuid(id),
      requiredUuid(record.specialistId),
      requiredString(record, 'reason', 200),
    );
  }

  @Put('prices')
  price(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['serviceCode', 'amountToman']);
    return this.admin.setPrice(
      actor(req).id,
      requiredString(record, 'serviceCode', 40),
      requiredInt(record.amountToman),
    );
  }

  @Put('reward')
  reward(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['amountToman']);
    return this.admin.setReward(actor(req).id, requiredInt(record.amountToman));
  }

  @Post('reviews/:id')
  review(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['status']);
    const status = requiredString(record, 'status', 20);
    if (status !== 'approved' && status !== 'rejected') {
      throw new ApiError(400, 'validation', 'وضعیت نظر درست نیست');
    }
    return this.admin.moderateReview(actor(req).id, requiredUuid(id), status);
  }

  @Get('ledger')
  ledger(@Query('userId') userId?: string) {
    return this.admin.ledger(userId ? requiredUuid(userId) : undefined);
  }

  @Get('payments')
  payments() {
    return this.admin.payments();
  }

  @Get('users')
  users() {
    return this.admin.users();
  }

  @Post('maintenance')
  maintenanceRun(@Req() req: Request) {
    return this.maintenance.run(actor(req).id);
  }

  @Get('ai-controls')
  aiControls() {
    return this.admin.aiControls();
  }

  @Put('ai-controls')
  setAiControls(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['killSwitch', 'dailyCostCapMicros']);
    if ('killSwitch' in record && typeof record.killSwitch !== 'boolean') {
      throw new ApiError(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
    }
    let dailyCostCapMicros: number | null | undefined;
    if ('dailyCostCapMicros' in record) {
      dailyCostCapMicros = record.dailyCostCapMicros === null ? null : requiredInt(record.dailyCostCapMicros);
    }
    return this.admin.setAiControls(actor(req).id, {
      killSwitch: 'killSwitch' in record ? (record.killSwitch as boolean) : undefined,
      dailyCostCapMicros,
    });
  }

  @Get('ai-cost')
  aiCost() {
    return this.admin.aiCost();
  }

  @Post('wallet-adjustments')
  adjust(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['userId', 'amountToman', 'direction', 'reason', 'referenceId']);
    const direction = requiredString(record, 'direction', 10);
    if (direction !== 'debit' && direction !== 'credit') {
      throw new ApiError(400, 'validation', 'جهت اصلاح درست نیست');
    }
    return this.admin.adjustCash(actor(req).id, {
      userId: requiredUuid(record.userId),
      amountToman: requiredInt(record.amountToman),
      direction,
      reason: requiredString(record, 'reason', 500),
      referenceId: requiredUuid(record.referenceId),
    });
  }

  @Get('outbox/dead')
  deadLetters() {
    return this.admin.deadLetters();
  }

  @Post('outbox/:id/retry')
  retryDeadLetter(@Req() req: Request, @Param('id') id: string) {
    return this.admin.retryDeadLetter(actor(req).id, requiredUuid(id));
  }

  @Post('users/:id/status')
  status(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['status']);
    const status = requiredString(record, 'status', 20);
    if (status !== 'active' && status !== 'suspended') {
      throw new ApiError(400, 'validation', 'وضعیت حساب درست نیست');
    }
    return this.admin.setStatus(actor(req).id, requiredUuid(id), status);
  }
}
