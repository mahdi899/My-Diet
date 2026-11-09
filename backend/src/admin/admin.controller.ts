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
import { MoneyService } from '../money/money.service.js';
import { PublishingService } from '../publishing/publishing.service.js';
import { MaintenanceService } from '../maintenance/maintenance.service.js';
import { parseCivilDate } from '../plans/views.js';
import { AdminService } from './admin.service.js';
import { councilNoExact, normalizeCouncilNo, normalizeLoginName, VERIFICATION_STATUSES, type VerificationStatus } from './profile.js';
import { hashPassword } from '../common/password.js';

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
  @Get('dashboard')
  dashboard(@Req() req: Request) { return this.admin.dashboard(actor(req).id); }

  @Get('orders')
  orders() { return this.admin.orders(); }
  constructor(
    private readonly admin: AdminService,
    private readonly maintenance: MaintenanceService,
  ) {}

  @Get('specialists')
  specialists() {
    return this.admin.adminSpecialists();
  }

  @Post('specialists')
  create(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['phone', 'displayName', 'firstName', 'lastName', 'birthDate', 'councilNo', 'education', 'portrait', 'credential', 'bio', 'capacity', 'username', 'password']);
    const capacity = record.capacity == null ? 20 : requiredInt(record.capacity);
    if (capacity < 0 || capacity > 500) throw new ApiError(400, 'validation', 'ظرفیت درست نیست');
    const firstName = optionalString(record, 'firstName', 40);
    const lastName = optionalString(record, 'lastName', 40);
    const displayName = firstName
      ? `${firstName} ${lastName ?? ''}`.trim()
      : requiredString(record, 'displayName', 80);
    if (displayName.length < 2 || displayName.length > 80) {
      throw new ApiError(400, 'validation', 'نام پزشک درست نیست');
    }
    const education = optionalString(record, 'education', 120) ?? optionalString(record, 'credential', 120) ?? '';
    const councilNo = record.councilNo == null || record.councilNo === ''
      ? ''
      : councilNoExact(requiredString(record, 'councilNo', 20));
    if (record.councilNo != null && record.councilNo !== '' && !councilNo) {
      throw new ApiError(400, 'validation', 'کد نظام پزشکی باید دقیقاً ۶ رقم باشد');
    }
    const phoneRaw = requiredString(record, 'phone', 32).replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
    const phoneDigits = phoneRaw.replace(/\D/g, '');
    if (!/^09\d{9}$/.test(phoneDigits)) throw new ApiError(400, 'validation', 'شماره تلفن باید ۱۱ رقم و با ۰۹ شروع شود');
    const usernameRaw = optionalString(record, 'username', 32);
    const passwordRaw = typeof record.password === 'string' ? record.password : undefined;
    if ((usernameRaw == null) !== (passwordRaw == null || passwordRaw === '')) {
      throw new ApiError(400, 'validation', 'نام کاربری و رمز عبور را با هم وارد کنید');
    }
    let username: string | undefined;
    let passwordHash: string | undefined;
    if (usernameRaw && passwordRaw) {
      username = normalizeLoginName(usernameRaw) ?? undefined;
      if (!username) throw new ApiError(400, 'validation', 'نام کاربری باید ۳ تا ۳۲ نویسهٔ انگلیسی باشد و با حرف شروع شود');
      if (passwordRaw.length < 8 || passwordRaw.length > 256) throw new ApiError(400, 'validation', 'رمز عبور باید بین ۸ تا ۲۵۶ نویسه باشد');
      passwordHash = hashPassword(passwordRaw, 8);
    }
    let birthDate: string | null = null;
    if (record.birthDate != null && record.birthDate !== '') {
      birthDate = parseCivilDate(requiredString(record, 'birthDate', 10));
      const today = new Date().toISOString().slice(0, 10);
      if (!birthDate || birthDate < '1920-01-01' || birthDate > today) {
        throw new ApiError(400, 'validation', 'تاریخ تولد درست نیست');
      }
    }
    const portrait = optionalString(record, 'portrait', 180_000) ?? '';
    if (portrait && !/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(portrait)) {
      throw new ApiError(400, 'validation', 'تصویر پروفایل درست نیست');
    }
    return this.admin.createSpecialist(actor(req).id, {
      phoneE164: normalizeIranianMobile(phoneDigits),
      displayName,
      credential: education,
      bio: optionalString(record, 'bio', 500) ?? '',
      capacity,
      councilNo: councilNo || undefined,
      birthDate,
      education,
      portrait,
      username,
      passwordHash,
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

  @Get('reviews')
  reviews(@Query('status') status?: string) {
    if (status !== 'pending' && status !== 'approved' && status !== 'rejected') {
      throw new ApiError(400, 'validation', 'وضعیت نظر شناخته نشد');
    }
    return this.admin.reviews(status);
  }

  @Get('audit-logs')
  auditLogs() {
    return this.admin.auditLogs();
  }

  @Get('ai-generations')
  generations() {
    return this.admin.aiGenerations();
  }

  @Get('users/:id')
  user(@Param('id') id: string) {
    return this.admin.userDetail(requiredUuid(id));
  }

  @Get('requests')
  requests() {
    return this.admin.requests();
  }

  @Get('support-conversations')
  support() {
    return this.admin.supportConversations();
  }

  @Put('daily-messages')
  dailyMessage(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['date', 'body']);
    const date = parseCivilDate(requiredString(record, 'date', 10));
    if (!date) throw new ApiError(400, 'validation', 'تاریخ درست نیست');
    return this.admin.saveDailyMessage(actor(req).id, date, requiredString(record, 'body', 500));
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

  @Get('ai-executions')
  aiExecutions() { return this.admin.aiExecutions(); }

  @Post('ai-executions/:id/reconcile')
  reconcileAi(@Req() req:Request,@Param('id') id:string,@Body() body:unknown) {
    const record=bodyRecord(body);rejectUnknown(record,['costMicros','reason']);
    return this.admin.reconcileAi(actor(req).id,requiredUuid(id),requiredInt(record.costMicros),requiredString(record,'reason',500));
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
    if (status !== 'active' && status !== 'suspended' && status !== 'pending') {
      throw new ApiError(400, 'validation', 'وضعیت حساب درست نیست');
    }
    return this.admin.setStatus(actor(req).id, requiredUuid(id), status);
  }

  @Post('users/:id/delete')
  deleteUser(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['confirmation']);
    if (requiredString(record, 'confirmation', 40) !== 'حذف حساب') {
      throw new ApiError(400, 'validation', 'برای حذف حساب عبارت تأیید لازم است');
    }
    return this.admin.deleteUser(actor(req).id, requiredUuid(id));
  }

  @Put('users/:id/package')
  packageDays(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['daysRemaining']);
    return this.admin.setPackageDays(actor(req).id, requiredUuid(id), requiredInt(record.daysRemaining));
  }

  @Post('specialists/:id/verification')
  verification(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['status']);
    const status = requiredString(record, 'status', 20);
    if (!(VERIFICATION_STATUSES as readonly string[]).includes(status)) {
      throw new ApiError(400, 'validation', 'وضعیت تأیید درست نیست');
    }
    return this.admin.setVerification(actor(req).id, requiredUuid(id), status as VerificationStatus);
  }
}

@ApiTags('specialist')
@Controller('v1/specialist')
export class SpecialistProfileController {
  constructor(private readonly admin: AdminService) {}

  @Roles('specialist')
  @Get('profile')
  profile(@Req() req: Request) {
    return this.admin.ownProfile(actor(req).id);
  }

  @Roles('specialist')
  @Put('profile')
  save(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['displayName', 'credential', 'bio', 'councilNo']);
    let councilNo: string | undefined;
    if (record.councilNo != null) {
      if (typeof record.councilNo !== 'string') {
        throw new ApiError(400, 'validation', 'شمارهٔ نظام درست نیست');
      }
      const normalized = normalizeCouncilNo(record.councilNo);
      if (normalized == null) throw new ApiError(400, 'validation', 'شمارهٔ نظام درست نیست');
      councilNo = normalized;
    }
    return this.admin.updateOwnProfile(actor(req).id, {
      displayName: optionalString(record, 'displayName', 80),
      credential: optionalString(record, 'credential', 120),
      bio: optionalString(record, 'bio', 1000),
      councilNo,
    });
  }
}

@ApiTags('public')
@Public()
@Controller('v1/public')
export class PublicConfigController {
  constructor(
    private readonly admin: AdminService,
    private readonly money: MoneyService,
    private readonly publishing: PublishingService,
  ) {}

  @Get('config')
  async config() {
    const site = await this.publishing.currentConfig();
    return { minAppVersion: site.minAppVersion, download: site.download, ...(await this.money.catalog()) };
  }

  @Get('daily-message')
  dailyMessage(@Query('date') date?: string) {
    const civil = parseCivilDate(date ?? '');
    if (!civil) throw new ApiError(400, 'validation', 'تاریخ درست نیست');
    return this.admin.dailyMessage(civil);
  }
}
