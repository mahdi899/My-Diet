import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { rememberedOtp } from '../adapters/sms.js';
import { actor, Public, Roles } from '../common/auth.js';
import { ENV, type Env } from '../config/env.js';
import { ApiError } from '../common/errors.js';
import { normalizeIranianMobile } from '../common/phone.js';
import { bodyRecord, optionalString, readCookie, rejectUnknown, requiredString, requiredUuid } from '../common/parse.js';
import { IdentityService } from './identity.service.js';

function clientIp(req: Request): string {
  return (req.ip || req.socket.remoteAddress || 'unknown').slice(0, 64);
}

@ApiTags('auth')
@Controller('v1/auth')
export class IdentityController {
  @Public()
  @Post('admin/login')
  async adminLogin(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['username', 'password']);
    const issued = await this.identity.adminLogin(requiredString(record,'username',80),requiredString(record,'password',256));
    if ('totpRequired' in issued) return issued;
    return this.present(req,res,issued);
  }

  @Public()
  @Post('specialist/login')
  async specialistLogin(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['username', 'password']);
    const password = record.password;
    if (typeof password !== 'string' || !password || password.length > 256) {
      throw new ApiError(401, 'unauthorized', 'نام کاربری یا رمز عبور نادرست است');
    }
    const issued = await this.identity.specialistLogin(requiredString(record, 'username', 80), password);
    if ('totpRequired' in issued) return issued;
    return this.present(req, res, issued);
  }
  constructor(
    private readonly identity: IdentityService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Post('otp/request')
  request(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['phone', 'existingAccountOnly']);
    if ('existingAccountOnly' in record && typeof record.existingAccountOnly !== 'boolean') {
      throw new ApiError(400, 'validation', 'نوع درخواست معتبر نیست');
    }
    return this.identity.requestOtp(normalizeIranianMobile(requiredString(record, 'phone', 32)), clientIp(req), record.existingAccountOnly === true);
  }

  @Public()
  @Post('otp/verify')
  async verify(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['phone', 'code', 'deviceLabel', 'platform']);
    const code = requiredString(record, 'code', 6);
    if (!/^\d{6}$/.test(code)) {
      throw new ApiError(401, 'unauthorized', 'کد واردشده درست نیست');
    }
    const issued = await this.identity.verifyOtp(
      normalizeIranianMobile(requiredString(record, 'phone', 32)),
      code,
      optionalString(record, 'deviceLabel', 80) ?? null,
      optionalString(record, 'platform', 40) ?? null,
    );
    if ('totpRequired' in issued) return issued;
    return this.present(req, res, issued);
  }

  @Public()
  @Post('totp')
  async totp(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['totpToken', 'code']);
    const code = requiredString(record, 'code', 6);
    if (!/^\d{6}$/.test(code)) throw new ApiError(401, 'unauthorized', 'کد ورود دومرحله‌ای درست نیست');
    const issued = await this.identity.completeTotp(requiredString(record, 'totpToken', 200), code);
    return this.present(req, res, issued);
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) {
    const record = bodyRecord(body ?? {});
    rejectUnknown(record, ['refreshToken']);
    const fromBody = typeof record.refreshToken === 'string' ? record.refreshToken : undefined;
    const fromCookie = readCookie(req.header('cookie'), 'sabzine_refresh');
    let token = fromBody;
    if (!token && fromCookie) {
      if (req.header('x-sabzine-client') !== 'web') {
        throw new ApiError(401, 'unauthorized', 'نشست معتبر نیست');
      }
      token = fromCookie;
    }
    if (!token) throw new ApiError(401, 'unauthorized', 'نشست معتبر نیست');
    const issued = await this.identity.refresh(token);
    return this.present(req, res, issued);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = actor(req);
    await this.identity.logout(user.id, user.sessionId);
    this.clearCookie(res);
    return { ok: true };
  }

  @Get('sessions')
  sessions(@Req() req: Request) {
    const user = actor(req);
    return this.identity.sessions(user.id, user.sessionId);
  }

  @Delete('sessions/:id')
  async revoke(@Req() req: Request, @Param('id') id: string) {
    await this.identity.revokeSession(actor(req).id, requiredUuid(id));
    return { ok: true };
  }

  @Public()
  @Get('otp/latest')
  latest(@Query('phone') phone?: string) {
    if (this.env.NODE_ENV !== 'development') {
      throw new ApiError(404, 'not_found', 'یافت نشد');
    }
    if (!phone) throw new ApiError(404, 'not_found', 'یافت نشد');
    const code = rememberedOtp(normalizeIranianMobile(phone));
    if (!code) throw new ApiError(404, 'not_found', 'یافت نشد');
    return { code };
  }

  private present(req: Request, res: Response, issued: Awaited<ReturnType<IdentityService['completeTotp']>>) {
    const web = req.header('x-sabzine-client') === 'web';
    if (web) {
      const maxAge = Math.max(
        0,
        Math.floor((new Date(issued.sessionExpiresAt).getTime() - Date.now()) / 1000),
      );
      const secure = ['production','staging'].includes(this.env.NODE_ENV) ? '; Secure' : '';
      res.setHeader(
        'Set-Cookie',
        `sabzine_refresh=${encodeURIComponent(issued.refreshToken)}; HttpOnly; SameSite=Strict; Path=/v1/auth; Max-Age=${maxAge}${secure}`,
      );
    }
    return {
      accessToken: issued.accessToken,
      ...(web ? {} : { refreshToken: issued.refreshToken }),
      accessExpiresAt: issued.accessExpiresAt,
      sessionExpiresAt: issued.sessionExpiresAt,
      role: issued.role,
    };
  }

  private clearCookie(res: Response): void {
    const secure = ['production','staging'].includes(this.env.NODE_ENV) ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `sabzine_refresh=; HttpOnly; SameSite=Strict; Path=/v1/auth; Max-Age=0${secure}`,
    );
  }
}

@ApiTags('me')
@Controller('v1/me')
export class MeProfileController {
  constructor(private readonly identity: IdentityService) {}

  @Roles('user', 'specialist', 'admin')
  @Get()
  me(@Req() req: Request) {
    const user = actor(req);
    return this.identity.profile(user.id, user.role);
  }

  @Roles('user', 'specialist', 'admin')
  @Patch()
  rename(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['displayName']);
    return this.identity.rename(actor(req).id, actor(req).role, requiredString(record, 'displayName', 80));
  }

  @Roles('specialist', 'admin')
  @Get('totp')
  totp(@Req() req: Request) {
    return this.identity.totpStatus(actor(req).id);
  }

  @Roles('specialist', 'admin')
  @Post('totp/setup')
  setup(@Req() req: Request) {
    const user = actor(req);
    return this.identity.setupTotp(user.id, user.role);
  }

  @Roles('specialist', 'admin')
  @Post('totp/confirm')
  confirm(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['code']);
    const code = requiredString(record, 'code', 6);
    if (!/^\d{6}$/.test(code)) throw new ApiError(401, 'unauthorized', 'کد ورود دومرحله‌ای درست نیست');
    return this.identity.confirmTotp(actor(req).id, actor(req).role, code);
  }
}
