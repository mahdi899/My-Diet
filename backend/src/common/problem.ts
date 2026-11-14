import { ApplicationError } from './application-error.js';
import { HttpException } from '@nestjs/common';

export interface ProblemBody {
  status: number;
  code: string;
  messageFa: string;
  retryable: boolean;
}

const RETRYABLE = new Set([
  'dependency_outage',
  'timeout',
  'sms_unavailable',
  'provider_rate_limited',
  'rate_limited',
]);

/** Maps a thrown value to the public error envelope. Uncertain provider calls are not retryable. */
export function classifyProblem(exception: unknown): ProblemBody {
  if (isTimeout(exception)) {
    return problem(504, 'timeout', 'پاسخ سرویس به‌موقع نرسید', true);
  }
  if (exception instanceof Error && exception.message === 'provider_outcome_unknown') {
    return problem(503, 'provider_outcome_unknown', 'نتیجهٔ سرویس مدل نامشخص است', false);
  }
  if (exception instanceof ApplicationError) {
    return problem(exception.status, exception.code, exception.messageFa, RETRYABLE.has(exception.code));
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const body = exception.getResponse();
    const record = typeof body === 'object' && body ? body as { code?: unknown; messageFa?: unknown } : {};
    const code = typeof record.code === 'string' ? record.code : defaultCode(status);
    const messageFa = typeof record.messageFa === 'string' ? record.messageFa : defaultMessage(code);
    return problem(status, code, messageFa, RETRYABLE.has(code));
  }
  return problem(500, 'internal', 'خطای داخلی رخ داد', false);
}

function problem(status: number, code: string, messageFa: string, retryable: boolean): ProblemBody {
  return { status, code, messageFa, retryable };
}

function defaultCode(status: number): string {
  if (status === 400) return 'validation';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate_limited';
  if (status === 503 || status === 502) return 'dependency_outage';
  if (status === 504) return 'timeout';
  return 'internal';
}

function defaultMessage(code: string): string {
  if (code === 'validation') return 'اطلاعات واردشده ناقص یا نادرست است';
  if (code === 'unauthorized') return 'نشست معتبر نیست';
  if (code === 'forbidden') return 'اجازهٔ این کار را ندارید';
  if (code === 'not_found') return 'یافت نشد';
  if (code === 'conflict') return 'این کار با وضعیت فعلی نمی‌خواند';
  if (code === 'dependency_outage') return 'سرویس وابسته در دسترس نیست';
  if (code === 'timeout') return 'پاسخ سرویس به‌موقع نرسید';
  if (code === 'rate_limited') return 'تعداد درخواست بیش از حد است';
  return 'خطای داخلی رخ داد';
}

function isTimeout(exception: unknown): boolean {
  if (!exception || typeof exception !== 'object') return false;
  const name = (exception as { name?: string }).name;
  return name === 'TimeoutError' || name === 'AbortError';
}
