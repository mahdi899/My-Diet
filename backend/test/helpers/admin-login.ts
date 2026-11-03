import type { INestApplication } from '@nestjs/common';
import type { Pool } from 'pg';
import request from 'supertest';
import { hashPassword } from '../../src/common/password.js';
import { normalizeIranianMobile } from '../../src/common/phone.js';

/** Test fixture only: exercise the real password login rather than bypassing auth. */
export async function loginAdmin(api: INestApplication, pool: Pool, phone: string) {
  const username = `fixture-${phone}`;
  const password = 'Fixture-admin-password-2026';
  await pool.query(`insert into admin_credentials (user_id,username,password_hash)
    select id,$2,$3 from users where phone_e164=$1 and role='admin'
    on conflict (user_id) do update set username=excluded.username,password_hash=excluded.password_hash`,
  [normalizeIranianMobile(phone), username, hashPassword(password)]);
  const response = await request(api.getHttpServer()).post('/v1/auth/admin/login').send({ username, password });
  if (response.status !== 201) throw new Error(`Admin fixture login failed: ${response.status}`);
  return response.body as { accessToken: string; refreshToken: string; sessionExpiresAt: string };
}
