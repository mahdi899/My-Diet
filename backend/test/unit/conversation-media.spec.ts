import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectMedia, inspectMedia } from '../../src/messaging/media.js';

describe('conversation media signatures', () => {
  it('accepts a real image or voice signature and rejects a mismatched declared type', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    const ogg = Buffer.from('OggSfake', 'ascii');
    assert.equal(detectMedia(jpeg), 'image/jpeg');
    assert.equal(inspectMedia('image', 'image/jpeg', jpeg), 'image/jpeg');
    assert.equal(inspectMedia('voice', 'audio/ogg', ogg), 'audio/ogg');
    assert.throws(() => inspectMedia('image', 'image/png', jpeg));
    assert.throws(() => inspectMedia('voice', 'audio/ogg', jpeg));
    assert.equal(detectMedia(Buffer.from('not-a-file')), null);
  });
});
