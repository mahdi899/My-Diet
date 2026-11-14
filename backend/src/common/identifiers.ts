import { ApplicationError as ApiError } from './application-error.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requiredUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new ApiError(400, 'validation', 'شناسه معتبر نیست');
  }
  return value;
}

