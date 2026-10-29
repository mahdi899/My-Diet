import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  acceptsAnotherAnswer,
  canWithdrawQuestion,
  parseQuestionListStatus,
  questionBlocksPublish,
} from '../../src/plans/questions.js';

describe('phase 12 rules', () => {
  it('lists open questions unless another status is named', () => {
    assert.equal(parseQuestionListStatus(undefined), 'open');
    assert.equal(parseQuestionListStatus(''), 'open');
    assert.equal(parseQuestionListStatus('withdrawn'), 'withdrawn');
    assert.equal(parseQuestionListStatus('closed'), null);
  });

  it('lets the user answer again until the specialist closes the question', () => {
    assert.equal(acceptsAnotherAnswer('open'), true);
    assert.equal(acceptsAnotherAnswer('answered'), true);
    assert.equal(acceptsAnotherAnswer('acknowledged'), false);
    assert.equal(acceptsAnotherAnswer('withdrawn'), false);
    assert.equal(canWithdrawQuestion('answered'), true);
    assert.equal(canWithdrawQuestion('acknowledged'), false);
  });

  it('stops blocking publication after a required question is withdrawn', () => {
    assert.equal(questionBlocksPublish('open', true), true);
    assert.equal(questionBlocksPublish('answered', true), true);
    assert.equal(questionBlocksPublish('withdrawn', true), false);
    assert.equal(questionBlocksPublish('open', false), false);
  });
});
