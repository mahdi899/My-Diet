import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { ApiError } from '../common/errors.js';
import { uuidv7 } from '../common/id.js';
import { audit, withTransaction } from '../common/sql.js';
import { PG_POOL } from '../database/database.js';
import {
  appVersion,
  articleInput,
  articleSlug,
  consentPurpose,
  pageWindow,
  plainText,
  releaseUrl,
  type ArticleInput,
  type ArticleSection,
} from './content.js';

interface ArticleRow {
  id: string;
  slug: string;
  status: 'draft' | 'published';
  version: number;
  title: string;
  category: string;
  image_index: number;
  reading_minutes: number;
  intro: string;
  sections: ArticleSection[];
  published_at: Date | null;
}

@Injectable()
export class PublishingService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async publicArticles(pageRaw: unknown, sizeRaw: unknown) {
    const window = pageWindow(pageRaw, sizeRaw);
    const total = await this.pool.query<{ n: number }>(
      `select count(*)::int as n from articles where status = 'published'`,
    );
    const rows = await this.pool.query<ArticleRow>(
      `select id, slug, status, version, title, category, image_index, reading_minutes, intro, sections, published_at
       from articles where status = 'published'
       order by position, slug
       limit $1 offset $2`,
      [window.pageSize, window.offset],
    );
    return {
      page: window.page,
      pageSize: window.pageSize,
      total: total.rows[0]?.n ?? 0,
      items: rows.rows.map(card),
    };
  }

  async publicArticle(slugRaw: unknown) {
    const slug = articleSlug(slugRaw);
    const row = await this.one(slug);
    if (!row || row.status !== 'published') throw new ApiError(404, 'not_found', 'مقاله پیدا نشد');
    return detail(row);
  }

  async adminArticles(status: unknown, pageRaw: unknown, sizeRaw: unknown) {
    if (status != null && status !== '' && status !== 'draft' && status !== 'published') {
      throw new ApiError(400, 'validation', 'وضعیت مقاله درست نیست');
    }
    const window = pageWindow(pageRaw, sizeRaw);
    const filter = status === 'draft' || status === 'published';
    const total = await this.pool.query<{ n: number }>(
      `select count(*)::int as n from articles where ($1::text is null or status = $1)`,
      [filter ? status : null],
    );
    const rows = await this.pool.query<ArticleRow>(
      `select id, slug, status, version, title, category, image_index, reading_minutes, intro, sections, published_at
       from articles where ($1::text is null or status = $1)
       order by position, slug
       limit $2 offset $3`,
      [filter ? status : null, window.pageSize, window.offset],
    );
    return {
      page: window.page,
      pageSize: window.pageSize,
      total: total.rows[0]?.n ?? 0,
      items: rows.rows.map((row) => ({ ...detail(row), status: row.status })),
    };
  }

  async createArticle(actorId: string, body: Record<string, unknown>) {
    return this.writeArticle(actorId, articleInput(body, articleSlug(body.slug)), true);
  }

  async updateArticle(actorId: string, slugRaw: unknown, body: Record<string, unknown>) {
    return this.writeArticle(actorId, articleInput(body, articleSlug(slugRaw)), false);
  }

  async setArticleStatus(actorId: string, slugRaw: unknown, status: 'draft' | 'published') {
    const slug = articleSlug(slugRaw);
    return withTransaction(this.pool, async (client) => {
      const row = await this.lock(client, slug);
      if (row.status === status) return { ...detail(row), status, replayed: true };
      const version = row.version + 1;
      const publishedAt = status === 'published' ? new Date() : null;
      const next = { ...row, status, version, published_at: publishedAt };
      await client.query(
        `update articles set status = $2, version = $3, published_at = $4, updated_at = now() where id = $1`,
        [row.id, status, version, publishedAt],
      );
      await this.snapshot(client, next, actorId);
      await audit(client, actorId, status === 'published' ? 'article_publish' : 'article_unpublish', 'article', row.id, {
        slug,
        version,
      });
      return { ...detail(next), status, replayed: false };
    });
  }

  async publicConsents() {
    const rows = await this.pool.query<{ purpose: string; version: number; summary: string }>(
      `select purpose, version, summary from consent_documents
       where status = 'published' order by purpose, version`,
    );
    return { documents: rows.rows };
  }

  async publishConsent(actorId: string, body: Record<string, unknown>) {
    const purpose = consentPurpose(body.purpose);
    const summary = plainText(body.summary, 400);
    const status = body.status === 'draft' || body.status === 'published' ? body.status : null;
    if (!status) throw new ApiError(400, 'validation', 'وضعیت رضایت درست نیست');
    return withTransaction(this.pool, async (client) => {
      const current = await client.query<{ version: number }>(
        `select version from consent_documents where purpose = $1 order by version desc limit 1 for update`,
        [purpose],
      );
      const version = (current.rows[0]?.version ?? 0) + 1;
      const id = uuidv7();
      await client.query(
        `insert into consent_documents (id, purpose, version, summary, status, published_at)
         values ($1,$2,$3,$4,$5, case when $5 = 'published' then now() else null end)`,
        [id, purpose, version, summary, status],
      );
      await audit(client, actorId, 'consent_publish', 'consent_document', id, { purpose, version, status });
      return { purpose, version, status };
    });
  }

  async recordConsent(userId: string, body: Record<string, unknown>) {
    const purpose = consentPurpose(body.purpose);
    const version = body.version;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
      throw new ApiError(400, 'validation', 'نسخهٔ رضایت درست نیست');
    }
    return withTransaction(this.pool, async (client) => {
      const document = await client.query<{ status: string }>(
        `select status from consent_documents where purpose = $1 and version = $2`,
        [purpose, version],
      );
      if (document.rows[0]?.status !== 'published') throw new ApiError(404, 'not_found', 'این نسخهٔ رضایت منتشر نشده است');
      const existing = await client.query<{ recorded_at: Date }>(
        `select recorded_at from consent_records where user_id = $1 and purpose = $2 and version = $3`,
        [userId, purpose, version],
      );
      if (existing.rows[0]) {
        return { purpose, version, recordedAt: existing.rows[0].recorded_at, replayed: true };
      }
      const inserted = await client.query<{ recorded_at: Date }>(
        `insert into consent_records (user_id, purpose, version) values ($1,$2,$3) returning recorded_at`,
        [userId, purpose, version],
      );
      await audit(client, userId, 'consent_record', 'user', userId, { purpose, version });
      return { purpose, version, recordedAt: inserted.rows[0]?.recorded_at, replayed: false };
    });
  }

  async myConsents(userId: string) {
    const rows = await this.pool.query<{ purpose: string; version: number; recorded_at: Date }>(
      `select purpose, version, recorded_at from consent_records where user_id = $1 order by purpose, version`,
      [userId],
    );
    return { records: rows.rows.map((row) => ({ purpose: row.purpose, version: row.version, recordedAt: row.recorded_at })) };
  }

  async currentConfig() {
    const row = await this.pool.query<{
      version: number;
      min_app_version: string;
      download_status: 'not_released' | 'released';
      download_url: string | null;
    }>(
      `select version, min_app_version, download_status, download_url
       from public_config_versions order by version desc limit 1`,
    );
    const current = row.rows[0];
    if (!current || current.download_status === 'not_released') {
      return { version: current?.version ?? 1, minAppVersion: current?.min_app_version ?? '1.0.0', download: { status: 'not_released' as const, url: null } };
    }
    return {
      version: current.version,
      minAppVersion: current.min_app_version,
      download: { status: 'released' as const, url: current.download_url },
    };
  }

  async setConfig(actorId: string, body: Record<string, unknown>) {
    const minAppVersion = appVersion(body.minAppVersion);
    const download = releaseUrl(body.downloadStatus, body.downloadUrl);
    return withTransaction(this.pool, async (client) => {
      const current = await client.query<{ version: number }>(
        `select version from public_config_versions order by version desc limit 1 for update`,
      );
      const version = (current.rows[0]?.version ?? 0) + 1;
      await client.query(
        `insert into public_config_versions (version, min_app_version, download_status, download_url, actor_id)
         values ($1,$2,$3,$4,$5)`,
        [version, minAppVersion, download.status, download.url, actorId],
      );
      await audit(client, actorId, 'public_config', 'public_config', null, {
        version,
        minAppVersion,
        downloadStatus: download.status,
      });
      return { version, minAppVersion, download };
    });
  }

  private async writeArticle(actorId: string, input: ArticleInput, creating: boolean) {
    return withTransaction(this.pool, async (client) => {
      if (creating) {
        const position = await client.query<{ n: number }>(`select coalesce(max(position), 0)::int as n from articles`);
        const id = uuidv7();
        try {
          await client.query(
            `insert into articles
               (id, slug, status, version, title, category, image_index, reading_minutes, intro, sections, position)
             values ($1,$2,'draft',1,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
            [id, input.slug, input.title, input.category, input.image, input.readingMinutes, input.intro, JSON.stringify(input.sections), (position.rows[0]?.n ?? 0) + 1],
          );
        } catch (error) {
          if (constraintOf(error) === 'articles_slug_key') throw new ApiError(409, 'slug_taken', 'این شناسه قبلاً استفاده شده است');
          throw error;
        }
        const row = await this.lock(client, input.slug);
        await this.snapshot(client, row, actorId);
        await audit(client, actorId, 'article_draft', 'article', id, { slug: input.slug, version: 1 });
        return { ...detail(row), status: row.status, replayed: false };
      }
      const row = await this.lock(client, input.slug);
      const version = row.version + 1;
      await client.query(
        `update articles
         set version = $2, title = $3, category = $4, image_index = $5, reading_minutes = $6,
             intro = $7, sections = $8::jsonb, updated_at = now()
         where id = $1`,
        [row.id, version, input.title, input.category, input.image, input.readingMinutes, input.intro, JSON.stringify(input.sections)],
      );
      const next = { ...row, version, title: input.title, category: input.category, image_index: input.image, reading_minutes: input.readingMinutes, intro: input.intro, sections: input.sections };
      await this.snapshot(client, next, actorId);
      await audit(client, actorId, 'article_update', 'article', row.id, { slug: input.slug, version });
      return { ...detail(next), status: next.status, replayed: false };
    });
  }

  private async one(slug: string): Promise<ArticleRow | undefined> {
    const rows = await this.pool.query<ArticleRow>(
      `select id, slug, status, version, title, category, image_index, reading_minutes, intro, sections, published_at
       from articles where slug = $1`,
      [slug],
    );
    return rows.rows[0];
  }

  private async lock(client: PoolClient, slug: string): Promise<ArticleRow> {
    const rows = await client.query<ArticleRow>(
      `select id, slug, status, version, title, category, image_index, reading_minutes, intro, sections, published_at
       from articles where slug = $1 for update`,
      [slug],
    );
    const row = rows.rows[0];
    if (!row) throw new ApiError(404, 'not_found', 'مقاله پیدا نشد');
    return row;
  }

  private async snapshot(client: PoolClient, row: ArticleRow, actorId: string) {
    await client.query(
      `insert into article_versions
         (article_id, version, status, title, category, image_index, reading_minutes, intro, sections, actor_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
       on conflict (article_id, version) do nothing`,
      [row.id, row.version, row.status, row.title, row.category, row.image_index, row.reading_minutes, row.intro, JSON.stringify(row.sections), actorId],
    );
  }
}

function card(row: ArticleRow) {
  return {
    id: row.slug,
    title: row.title,
    category: row.category,
    image: row.image_index,
    time: String(row.reading_minutes),
    intro: row.intro,
    readingMinutes: row.reading_minutes,
  };
}

function detail(row: ArticleRow) {
  return { ...card(row), version: row.version, sections: row.sections };
}

function constraintOf(error: unknown): string {
  return typeof error === 'object' && error && 'code' in error && (error as { code?: string }).code === '23505'
    ? String((error as { constraint?: string }).constraint ?? '')
    : '';
}
