import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError } from '../../src/common/errors.js';
import { articleInput, pageWindow, releaseUrl } from '../../src/publishing/content.js';

function code(error: unknown): string {
  assert.ok(error instanceof ApiError);
  return (error.getResponse() as { code: string }).code;
}

describe('phase 12 publishing content', () => {
  it('rejects markup and keeps a bounded page', () => {
    assert.throws(() => articleInput({
      title: 'عنوان',
      category: 'سبک زندگی',
      image: 0,
      readingMinutes: 3,
      intro: 'مقدمه',
      sections: [{ heading: 'عنوان', body: '<script>alert(1)</script>' }],
    }, 'fresh-note'), (error: unknown) => code(error) === 'unsafe_content');
    assert.deepEqual(pageWindow('2', '2'), { page: 2, pageSize: 2, offset: 2 });
    assert.throws(() => pageWindow('1', '21'), (error: unknown) => code(error) === 'validation');
  });

  it('keeps an unreleased app without inventing an address', () => {
    assert.deepEqual(releaseUrl('not_released', undefined), { status: 'not_released', url: null });
    assert.throws(() => releaseUrl('not_released', 'https://dl.sabzine.app/app'), (error: unknown) => code(error) === 'fabricated_url');
    assert.throws(() => releaseUrl('released', 'https://example.com/app'), (error: unknown) => code(error) === 'fabricated_url');
    assert.equal(releaseUrl('released', 'https://dl.sabzine.app/android').url, 'https://dl.sabzine.app/android');
  });
});
