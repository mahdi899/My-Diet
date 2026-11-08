import { Body, Controller, Get, Header, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actor, Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { bodyRecord } from '../common/parse.js';
import { FoodService } from './food.service.js';

@ApiTags('food')
@Controller('v1')
export class FoodController {
  constructor(private readonly foods: FoodService) {}

  /** Used by the doctor workspace to swap a meal for another catalogue item. */
  @Roles('specialist', 'admin')
  @Get('catalog/foods')
  search(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.foods.list({ q, category, active: 'true', cursor, limit: limit ? Number(limit) : undefined });
  }

  /** Turns picked dishes and servings into a ready plan option (calories, ingredients, instructions). */
  @Roles('specialist', 'admin')
  @Post('catalog/compose')
  compose(@Body() body: unknown) {
    return this.foods.compose(body);
  }

  @Roles('admin')
  @Get('admin/foods')
  list(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('active') active?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.foods.list({ q, category, active, cursor, limit: limit ? Number(limit) : undefined });
  }

  @Roles('admin')
  @Get('admin/foods/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="sabzine-foods.csv"')
  exportCsv() {
    return this.foods.exportCsv();
  }

  /** Same file as export.csv, wrapped in JSON so the admin panel can offer it as a download. */
  @Roles('admin')
  @Get('admin/foods/export')
  async exportJson() {
    return { csv: await this.foods.exportCsv() };
  }

  @Roles('admin')
  @Post('admin/foods/import')
  importCsv(@Req() req: Request, @Body() body: unknown) {
    const csv = bodyRecord(body).csv;
    if (typeof csv !== 'string') throw new ApiError(400, 'validation', 'محتوای فایل ارسال نشده است');
    return this.foods.importCsv(actor(req).id, csv);
  }

  @Roles('admin')
  @Get('admin/foods/:slug')
  get(@Param('slug') slug: string) {
    return this.foods.get(slug);
  }

  @Roles('admin')
  @Post('admin/foods')
  create(@Req() req: Request, @Body() body: unknown) {
    return this.foods.create(actor(req).id, bodyRecord(body));
  }

  @Roles('admin')
  @Put('admin/foods/:slug')
  update(@Req() req: Request, @Param('slug') slug: string, @Body() body: unknown) {
    return this.foods.update(actor(req).id, slug, bodyRecord(body));
  }

  @Roles('admin')
  @Post('admin/foods/:slug/active')
  setActive(@Req() req: Request, @Param('slug') slug: string, @Body() body: unknown) {
    const active = bodyRecord(body).active;
    if (typeof active !== 'boolean') throw new ApiError(400, 'validation', 'وضعیت نامعتبر است');
    return this.foods.setActive(actor(req).id, slug, active);
  }
}
