import type { Response } from 'express';
import { ApiError, errorBody } from '../common/errors.js';
import { classifyProblem } from '../common/problem.js';
import { BudgetBlockedError, PoolExhaustedError, PoolUnavailableError } from '../ai/pool/router.js';
import { StreamBrokenError } from '../ai/pool/types.js';
import { CoachError, type SseEvent } from './types.js';

export function openSse(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

export function writeSse(res: Response, event: SseEvent): void {
  if (res.writableEnded) return;
  res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
}

export function writePing(res: Response): void {
  if (!res.writableEnded) res.write(': ping\n\n');
}

/** JSON error envelope, used before the stream starts (and for every non-SSE route). */
export function coachToApi(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof CoachError) return new ApiError(error.status, error.code, error.messageFa);
  return new ApiError(500, 'internal', 'خطای داخلی رخ داد');
}

export function sendProblem(res: Response, error: unknown): void {
  const problem = classifyProblem(coachToApi(error));
  if (!res.headersSent) res.status(problem.status).json(problem);
}

/** Error event once the SSE response is already open. Never includes provider text. */
export function sseProblem(error: unknown): { code: string; messageFa: string; retryable: boolean } {
  if (error instanceof CoachError) return { code: error.code, messageFa: error.messageFa, retryable: error.retryable };
  if (error instanceof BudgetBlockedError) {
    const messageFa = error.reason === 'kill_switch'
      ? 'مربی موقتاً خاموش است.'
      : 'سقف استفاده از هوش مصنوعی پر شده است.';
    return { code: 'ai_budget_exceeded', messageFa, retryable: false };
  }
  if (error instanceof PoolUnavailableError || error instanceof PoolExhaustedError || error instanceof StreamBrokenError) {
    return { code: 'ai_unavailable', messageFa: 'مربی الان در دسترس نیست. کمی بعد دوباره بفرست.', retryable: true };
  }
  if (error instanceof ApiError) {
    const body = errorBody(error);
    const status = error.getStatus();
    return { code: body.code, messageFa: body.messageFa, retryable: status === 429 || status >= 500 };
  }
  return { code: 'internal', messageFa: 'مشکلی پیش آمد. دوباره امتحان کن.', retryable: true };
}
