import { Body, Controller, Get, Head, Inject, Param, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Pool } from 'pg';
import { Public, Roles, actor } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { uuidv7 } from '../common/id.js';
import { bodyRecord, rejectUnknown, requiredString, requiredUuid } from '../common/parse.js';
import { audit, withTransaction } from '../common/sql.js';
import { PG_POOL } from '../database/database.js';

export function campaignInput(value: unknown) {
  const b = bodyRecord(value);
  rejectUnknown(b, ['name', 'slug', 'source']);
  const name = requiredString(b, 'name', 120);
  const slug = requiredString(b, 'slug', 64).toLowerCase();
  const source = requiredString(b, 'source', 80).toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || !/^[a-z0-9_.-]+$/.test(source))
    throw new ApiError(400, 'validation', 'پسوند لینک و منبع را با حروف انگلیسی، عدد و خط تیره وارد کنید');
  return { name, slug, source };
}
export function campaignDestination(source: string, slug: string) {
  return '/onboarding/?' + new URLSearchParams({ utm_source: source, utm_medium: 'campaign', utm_campaign: slug });
}

@Controller('v1/admin/campaign-links')
@Roles('admin')
export class CampaignLinksController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
  @Get()
  async list() {
    return (await this.pool.query('select * from demo_campaign_links order by created_at desc')).rows;
  }
  @Post()
  async create(@Body() body: unknown, @Req() req: Request) {
    const { name, slug, source } = campaignInput(body);
    try {
      return await withTransaction(this.pool, async client => {
        const row = (await client.query('insert into demo_campaign_links(id,name,slug,source) values($1,$2,$3,$4) returning *', [uuidv7(), name, slug, source])).rows[0];
        await audit(client, actor(req).id, 'campaign_link.created', 'demo_campaign_link', row.id, { name, slug, source });
        return row;
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ApiError(409, 'conflict', 'این پسوند قبلاً استفاده شده؛ پسوند دیگری انتخاب کنید');
      throw error;
    }
  }
  @Patch(':id')
  async toggle(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    const b = bodyRecord(body); rejectUnknown(b, ['active']);
    if (typeof b.active !== 'boolean') throw new ApiError(400, 'validation', 'وضعیت معتبر نیست');
    return withTransaction(this.pool, async client => {
      const row = (await client.query('update demo_campaign_links set active=$2,updated_at=now() where id=$1 returning *', [requiredUuid(id), b.active])).rows[0];
      if (!row) throw new ApiError(404, 'not_found', 'لینک پیدا نشد');
      await audit(client, actor(req).id, 'campaign_link.status_changed', 'demo_campaign_link', id, { active: b.active });
      return row;
    });
  }
}

@Controller('go')
@Public()
export class CampaignRedirectController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
  @Head(':slug')
  head(@Param('slug') slug: string, @Res() res: Response) { return this.resolve(slug, res, false); }
  @Get(':slug')
  open(@Param('slug') slug: string, @Res() res: Response) { return this.resolve(slug, res, true); }
  private async resolve(slug: string, res: Response, count: boolean) {
    res.set({ 'Cache-Control': 'private, no-store, no-cache, max-age=0', 'CDN-Cache-Control': 'no-store', 'Surrogate-Control': 'no-store', Pragma: 'no-cache', Expires: '0', 'X-Robots-Tag': 'noindex, nofollow' });
    // Read/check/increment atomically, so a disabled link never redirects on a stale application read.
    const row = (await this.pool.query('update demo_campaign_links set opens=opens+$2 where slug=$1 and active=true returning source,slug', [slug, count ? 1 : 0])).rows[0];
    if (!row) return res.status(410).type('html').send('<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>لینک در دسترس نیست</title><body><h1>این لینک فعال نیست یا وجود ندارد.</h1><p>برای دریافت لینک معتبر با منتشرکننده تماس بگیرید.</p></body></html>');
    return res.redirect(302, campaignDestination(row.source, row.slug));
  }
}
