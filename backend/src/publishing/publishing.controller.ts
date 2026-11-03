import { Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actor, Public, Roles } from '../common/auth.js';
import { bodyRecord, rejectUnknown } from '../common/parse.js';
import { PublishingService } from './publishing.service.js';

@ApiTags('publishing')
@Controller('v1')
export class PublishingController {
  constructor(private readonly publishing: PublishingService) {}

  @Public()
  @Get('public/articles')
  @ApiOperation({ summary: 'Published articles for the public magazine. Drafts are omitted.' })
  articles(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.publishing.publicArticles(page, pageSize);
  }

  @Public()
  @Get('public/articles/:slug')
  article(@Param('slug') slug: string) {
    return this.publishing.publicArticle(slug);
  }

  @Public()
  @Get('public/consents')
  consents() {
    return this.publishing.publicConsents();
  }

  @Public()
  @Get('public/app-download')
  download() {
    return this.publishing.currentConfig();
  }

  @Roles('admin')
  @Get('admin/articles')
  adminArticles(@Query('status') status?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.publishing.adminArticles(status, page, pageSize);
  }

  @Roles('admin')
  @Post('admin/articles')
  create(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['slug', 'title', 'category', 'image', 'readingMinutes', 'intro', 'sections']);
    return this.publishing.createArticle(actor(req).id, record);
  }

  @Roles('admin')
  @Put('admin/articles/:slug')
  update(@Req() req: Request, @Param('slug') slug: string, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['title', 'category', 'image', 'readingMinutes', 'intro', 'sections']);
    return this.publishing.updateArticle(actor(req).id, slug, record);
  }

  @Roles('admin')
  @Post('admin/articles/:slug/publish')
  publish(@Req() req: Request, @Param('slug') slug: string) {
    return this.publishing.setArticleStatus(actor(req).id, slug, 'published');
  }

  @Roles('admin')
  @Post('admin/articles/:slug/unpublish')
  unpublish(@Req() req: Request, @Param('slug') slug: string) {
    return this.publishing.setArticleStatus(actor(req).id, slug, 'draft');
  }

  @Roles('admin')
  @Post('admin/consents')
  consent(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['purpose', 'summary', 'status']);
    return this.publishing.publishConsent(actor(req).id, record);
  }

  @Roles('admin')
  @Put('admin/public-config')
  config(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['minAppVersion', 'downloadStatus', 'downloadUrl']);
    return this.publishing.setConfig(actor(req).id, record);
  }

  @Get('me/consents')
  mine(@Req() req: Request) {
    return this.publishing.myConsents(actor(req).id);
  }

  @Post('me/consents')
  record(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['purpose', 'version']);
    return this.publishing.recordConsent(actor(req).id, record);
  }
}
