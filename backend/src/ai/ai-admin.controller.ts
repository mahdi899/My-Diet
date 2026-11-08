import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actor, Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { bodyRecord, requiredUuid } from '../common/parse.js';
import { AiAdminService } from './ai-admin.service.js';

const POOL_CODE = /^[a-z][a-z0-9_]{1,40}$/;

const code = (value: string) => {
  if (!POOL_CODE.test(value)) throw new ApiError(400, 'validation', 'کد استخر معتبر نیست');
  return value;
};

const limitOf = (raw: string | undefined, fallback: number, max: number) => {
  const n = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new ApiError(400, 'validation', 'محدودیت معتبر نیست');
  return Math.min(n, max);
};

/** Admin control of providers, model pools, budget, prompts and draft quality. Keys are write-only. */
@ApiTags('admin-ai')
@Controller('v1/admin/ai')
@Roles('admin')
export class AiAdminController {
  constructor(private readonly ai: AiAdminService) {}

  @Get('providers')
  providers() {
    return this.ai.providers();
  }

  @Post('providers')
  createProvider(@Req() req: Request, @Body() body: unknown) {
    return this.ai.createProvider(actor(req).id, bodyRecord(body));
  }

  @Put('providers/:id')
  updateProvider(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.ai.updateProvider(actor(req).id, requiredUuid(id), bodyRecord(body));
  }

  @Delete('providers/:id')
  deleteProvider(@Req() req: Request, @Param('id') id: string) {
    return this.ai.deleteProvider(actor(req).id, requiredUuid(id));
  }

  @Post('providers/:id/test')
  testProvider(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.ai.testProvider(actor(req).id, requiredUuid(id), (body as { model?: unknown } | null)?.model);
  }

  @Get('providers/:id/models')
  models(@Param('id') id: string, @Query('q') q?: string, @Query('limit') limit?: string) {
    return this.ai.models(requiredUuid(id), (q ?? '').slice(0, 80), limitOf(limit, 60, 500));
  }

  @Get('pools')
  pools() {
    return this.ai.pools();
  }

  @Put('pools/:code')
  updatePool(@Req() req: Request, @Param('code') poolCode: string, @Body() body: unknown) {
    return this.ai.updatePool(actor(req).id, code(poolCode), bodyRecord(body));
  }

  @Put('pools/:code/members')
  setMembers(@Req() req: Request, @Param('code') poolCode: string, @Body() body: unknown) {
    return this.ai.setMembers(actor(req).id, code(poolCode), body);
  }

  @Post('pools/:code/test')
  testPool(@Req() req: Request, @Param('code') poolCode: string) {
    return this.ai.testPool(actor(req).id, code(poolCode));
  }

  @Post('members/:id/reset-health')
  resetHealth(@Req() req: Request, @Param('id') id: string) {
    return this.ai.resetHealth(actor(req).id, requiredUuid(id));
  }

  @Get('usage')
  usage() {
    return this.ai.usage();
  }

  @Get('ledger')
  ledger(@Query('requestId') requestId?: string, @Query('limit') limit?: string) {
    return this.ai.ledger(requestId ? requiredUuid(requestId) : null, limitOf(limit, 100, 500));
  }

  @Get('budget')
  budget() {
    return this.ai.budgetControls();
  }

  @Put('budget')
  setBudget(@Req() req: Request, @Body() body: unknown) {
    return this.ai.setBudget(actor(req).id, bodyRecord(body));
  }

  @Get('generations')
  generations(@Query('limit') limit?: string) {
    return this.ai.generations(limitOf(limit, 50, 200));
  }

  @Get('prompts')
  prompts(@Query('key') key?: string) {
    return this.ai.promptList(key);
  }

  @Post('prompts/:key')
  createPrompt(@Req() req: Request, @Param('key') key: string, @Body() body: unknown) {
    return this.ai.createPrompt(actor(req).id, key, bodyRecord(body));
  }

  @Post('prompts/:key/:version/activate')
  activatePrompt(@Req() req: Request, @Param('key') key: string, @Param('version') version: string) {
    const n = Number(version);
    if (!Number.isInteger(n) || n < 1) throw new ApiError(400, 'validation', 'نسخه معتبر نیست');
    return this.ai.activatePrompt(actor(req).id, key, n);
  }
}
