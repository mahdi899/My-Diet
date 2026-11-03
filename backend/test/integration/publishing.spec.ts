import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import type { Pool } from 'pg';
import request from 'supertest';
import { installGracefulStop } from '../helpers/postgres-stop.js';
import { uuidv7 } from '../../src/common/id.js';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
    });
  });
}

function codeOf(error: unknown): string {
  if (!error || typeof error !== 'object' || !('getResponse' in error)) return '';
  const response = (error as { getResponse: () => { code?: string } }).getResponse();
  return response.code ?? '';
}

const section = { heading: 'عنوان', body: 'متن ساده برای مقاله' };

describe('phase 12 publishing', { concurrency: 1, timeout: 180_000 }, () => {
  let directory = '';
  let stopDatabase: (() => Promise<void>) | undefined;
  let api: INestApplication;
  let pool: Pool;
  let adminId = '';

  before(async () => {
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    directory = await mkdtemp(path.join(os.tmpdir(), 'sabzine-pg-'));
    const port = await freePort();
    const database = new EmbeddedPostgres({
      databaseDir: directory, user: 'sabzine', password: 'sabzine', port, persistent: false,
      initdbFlags: ['--encoding=UTF8', '--locale=C', '--no-sync', '-c', 'io_method=sync'],
    });
    installGracefulStop(database, directory);
    await database.initialise();
    await database.start();
    await database.createDatabase('sabzine');
    const databaseUrl = `postgres://sabzine:sabzine@127.0.0.1:${port}/sabzine`;
    stopDatabase = () => database.stop();
    process.env.NODE_ENV = 'test';
    process.env.APP_ROLE = 'api';
    process.env.DATABASE_URL = databaseUrl;
    process.env.SMS_PROVIDER = 'console';
    process.env.PAYMENT_GATEWAY = 'sandbox';
    process.env.AI_PROVIDER = 'fake';
    process.env.LOG_LEVEL = 'error';
    process.env.RUN_MIGRATIONS = 'false';
    process.env.SENTRY_DSN = '';
    const { migrateUp } = await import('../../dist/database/migrate.js');
    await migrateUp(databaseUrl);
    const { createApp } = await import('../../dist/bootstrap.js');
    api = (await createApp()).app;
    await api.init();
    const { PG_POOL } = await import('../../dist/database/database.js');
    pool = api.get(PG_POOL);
    adminId = uuidv7();
    const reader = uuidv7();
    await pool.query(
      `insert into users (id, phone_e164, role) values ($1,'+989180000001','admin'),($2,'+989180000002','user')`,
      [adminId, reader],
    );
  });

  after(async () => {
    await api?.close();
    await stopDatabase?.();
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  });

  it('keeps drafts private and versions a published article', async () => {
    const { PublishingService } = await import('../../dist/publishing/publishing.service.js');
    const publishing = api.get(PublishingService);
    const list = await request(api.getHttpServer()).get('/v1/public/articles?page=1&pageSize=2');
    assert.equal(list.status, 200);
    assert.equal(list.body.total, 6);
    assert.equal(list.body.items.length, 2);
    assert.equal(list.body.items[0].id, 'weekly-planning');
    assert.equal(list.body.items[0].time, '5');
    assert.equal(list.body.items[0].image, 1);
    const known = await request(api.getHttpServer()).get('/v1/public/articles/weekly-planning');
    assert.equal(known.status, 200);
    assert.equal(known.body.sections.length, 2);
    assert.equal((await request(api.getHttpServer()).get('/v1/public/articles/missing-note')).status, 404);

    const created = await publishing.createArticle(adminId, {
      slug: 'fresh-note', title: 'یادداشت تازه', category: 'سبک زندگی', image: 0, readingMinutes: 3, intro: 'مقدمه', sections: [section],
    });
    assert.equal(created.status, 'draft');
    assert.equal((await request(api.getHttpServer()).get('/v1/public/articles/fresh-note')).status, 404);
    const drafts = await publishing.adminArticles('draft', '1', '20');
    assert.equal(drafts.items.some((item) => item.id === 'fresh-note'), true);
    await assert.rejects(
      () => publishing.createArticle(adminId, {
        slug: 'unsafe-note', title: 'عنوان', category: 'سبک زندگی', image: 0, readingMinutes: 3, intro: 'مقدمه',
        sections: [{ heading: 'عنوان', body: '<script>alert(1)</script>' }],
      }),
      (error: unknown) => codeOf(error) === 'unsafe_content',
    );
    const hidden = await pool.query<{ n: number }>(`select count(*)::int as n from articles where slug = 'unsafe-note'`);
    assert.equal(hidden.rows[0]?.n, 0);

    const published = await publishing.setArticleStatus(adminId, 'fresh-note', 'published');
    assert.equal(published.version, 2);
    assert.equal((await request(api.getHttpServer()).get('/v1/public/articles/fresh-note')).status, 200);
    const updated = await publishing.updateArticle(adminId, 'fresh-note', {
      title: 'یادداشت ویرایش‌شده', category: 'سبک زندگی', image: 0, readingMinutes: 4, intro: 'مقدمهٔ جدید', sections: [section],
    });
    assert.equal(updated.version, 3);
    const history = await pool.query<{ title: string }>(
      `select title from article_versions where article_id = (select id from articles where slug = 'fresh-note') and version = 1`,
    );
    assert.equal(history.rows[0]?.title, 'یادداشت تازه');
    const again = await publishing.setArticleStatus(adminId, 'fresh-note', 'published');
    assert.equal(again.replayed, true);
    assert.equal(again.version, 3);
  });

  it('records a published consent version once and leaves the app unreleased', async () => {
    const { PublishingService } = await import('../../dist/publishing/publishing.service.js');
    const { PublicConfigController } = await import('../../dist/admin/admin.controller.js');
    const publishing = api.get(PublishingService);
    const reader = (await pool.query<{ id: string }>(`select id from users where phone_e164 = '+989180000002'`)).rows[0]?.id ?? '';
    const first = await publishing.recordConsent(reader, { purpose: 'terms', version: 1 });
    const second = await publishing.recordConsent(reader, { purpose: 'terms', version: 1 });
    assert.equal(second.replayed, true);
    assert.equal(new Date(second.recordedAt ?? 0).toISOString(), new Date(first.recordedAt ?? 0).toISOString());
    await publishing.publishConsent(adminId, { purpose: 'marketing', summary: 'پیام‌های اختیاری', status: 'draft' });
    await assert.rejects(
      () => publishing.recordConsent(reader, { purpose: 'marketing', version: 1 }),
      (error: unknown) => codeOf(error) === 'not_found',
    );
    const offered = await request(api.getHttpServer()).get('/v1/public/consents');
    assert.equal(offered.body.documents.some((item: { purpose: string }) => item.purpose === 'marketing'), false);

    const site = await publishing.currentConfig();
    assert.equal(site.download.status, 'not_released');
    assert.equal(site.download.url, null);
    await assert.rejects(
      () => publishing.setConfig(adminId, { minAppVersion: '1.0.0', downloadStatus: 'released', downloadUrl: 'https://example.com/app' }),
      (error: unknown) => codeOf(error) === 'fabricated_url',
    );
    assert.equal((await publishing.currentConfig()).version, 1);
    const released = await publishing.setConfig(adminId, {
      minAppVersion: '1.2.0', downloadStatus: 'released', downloadUrl: 'https://dl.sabzine.app/android',
    });
    assert.equal(released.version, 2);
    assert.equal(released.download.url, 'https://dl.sabzine.app/android');
    const config = await api.get(PublicConfigController).config();
    assert.equal(config.minAppVersion, '1.2.0');
    assert.equal(config.download.url, 'https://dl.sabzine.app/android');
    assert.ok(Array.isArray(config.services));
    const audit = await pool.query<{ detail: { phone?: string; downloadStatus?: string } }>(
      `select detail from audit_logs where action = 'public_config' and actor_id = $1`,
      [adminId],
    );
    assert.equal(audit.rows[0]?.detail.downloadStatus, 'released');
    assert.equal(audit.rows[0]?.detail.phone, undefined);
    const download = await request(api.getHttpServer()).get('/v1/public/app-download');
    assert.equal(download.body.download.status, 'released');
  });
});
