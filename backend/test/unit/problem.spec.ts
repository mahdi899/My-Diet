import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpException } from '@nestjs/common';
import { ApiError } from '../../src/common/errors.js';
import { classifyProblem } from '../../src/common/problem.js';

describe('phase 13 problem classification', () => {
  it('separates validation, authentication, conflict, timeout, and dependency outage', () => {
    assert.equal(classifyProblem(new ApiError(400, 'validation', 'فرم ناقص است')).retryable, false);
    assert.equal(classifyProblem(new ApiError(401, 'unauthorized', 'نشست معتبر نیست')).code, 'unauthorized');
    assert.equal(classifyProblem(new HttpException('clash', 409)).code, 'conflict');
    assert.equal(classifyProblem(new ApiError(409, 'idempotency_conflict', 'تکرار')).retryable, false);
    const timeout = classifyProblem(Object.assign(new Error('late'), { name: 'TimeoutError' }));
    assert.equal(timeout.code, 'timeout');
    assert.equal(timeout.status, 504);
    assert.equal(timeout.retryable, true);
    const down = classifyProblem(new ApiError(503, 'dependency_outage', 'پایگاه داده در دسترس نیست'));
    assert.equal(down.retryable, true);
    const uncertain = classifyProblem(new Error('provider_outcome_unknown'));
    assert.equal(uncertain.code, 'provider_outcome_unknown');
    assert.equal(uncertain.retryable, false);
    assert.equal(classifyProblem(new ApiError(503, 'payment_unavailable', 'درگاه نیست')).retryable, false);
    assert.equal(classifyProblem(new ApiError(503, 'sms_unavailable', 'کد نرسید')).retryable, true);
  });
});
