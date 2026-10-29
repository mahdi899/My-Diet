import { ApiError } from './errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function bodyRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
  }
  return body as Record<string, unknown>;
}

export function rejectUnknown(body: Record<string, unknown>, keys: readonly string[]): void {
  for (const key of Object.keys(body)) {
    if (!keys.includes(key)) {
      throw new ApiError(400, 'validation', 'فیلد اضافی پذیرفته نیست');
    }
  }
}

export function requiredString(
  body: Record<string, unknown>,
  key: string,
  max: number,
): string {
  const value = body[key];
  if (typeof value !== 'string') {
    throw new ApiError(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) {
    throw new ApiError(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
  }
  return trimmed;
}

export function optionalString(
  body: Record<string, unknown>,
  key: string,
  max: number,
): string | undefined {
  if (body[key] == null) return undefined;
  return requiredString(body, key, max);
}

export function requiredInt(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new ApiError(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
  }
  return value;
}

export function requiredUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new ApiError(400, 'validation', 'شناسه معتبر نیست');
  }
  return value;
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}
