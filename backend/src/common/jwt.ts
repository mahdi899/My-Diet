import { createHmac, timingSafeEqual } from 'crypto';
import { ApiError } from './errors.js';

export interface AccessClaims {
  sub: string;
  sid: string;
  role: 'user' | 'specialist' | 'admin';
  iat: number;
  exp: number;
}

function b64url(value: Buffer | string): string {
  const buffer = typeof value === 'string' ? Buffer.from(value) : value;
  return buffer.toString('base64url');
}

export function signAccessToken(claims: AccessClaims, secret: string): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(claims));
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest();
  return `${header}.${body}.${b64url(signature)}`;
}

export function verifyAccessToken(token: string, secret: string): AccessClaims {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new ApiError(401, 'unauthorized', 'نشست معتبر نیست');
  }
  let header: { alg?: string };
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as { alg?: string };
  } catch {
    throw new ApiError(401, 'unauthorized', 'نشست معتبر نیست');
  }
  if (header.alg !== 'HS256') {
    throw new ApiError(401, 'unauthorized', 'نشست معتبر نیست');
  }
  const expected = b64url(
    createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest(),
  );
  const actual = Buffer.from(parts[2]);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) {
    throw new ApiError(401, 'unauthorized', 'نشست معتبر نیست');
  }
  let claims: AccessClaims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as AccessClaims;
  } catch {
    throw new ApiError(401, 'unauthorized', 'نشست معتبر نیست');
  }
  if (!claims.sub || !claims.sid || !claims.exp || claims.exp * 1000 <= Date.now()) {
    throw new ApiError(401, 'unauthorized', 'نشست معتبر نیست');
  }
  if (claims.role !== 'user' && claims.role !== 'specialist' && claims.role !== 'admin') {
    throw new ApiError(401, 'unauthorized', 'نشست معتبر نیست');
  }
  return claims;
}
