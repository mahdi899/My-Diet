export const IMAGE_LIMIT = 1_500_000;
export const VOICE_LIMIT = 1_000_000;

export type MediaPurpose = 'image' | 'voice';
export type DetectedMedia = 'image/jpeg' | 'image/png' | 'image/gif' | 'audio/ogg' | 'audio/wav';

export function detectMedia(bytes: Buffer): DetectedMedia | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 6 && (bytes.subarray(0, 6).toString('ascii') === 'GIF89a' || bytes.subarray(0, 6).toString('ascii') === 'GIF87a')) return 'image/gif';
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WAVE') return 'audio/wav';
  return null;
}

export function inspectMedia(purpose: MediaPurpose, declaredType: string, bytes: Buffer): DetectedMedia {
  const limit = purpose === 'image' ? IMAGE_LIMIT : VOICE_LIMIT;
  if (bytes.length === 0 || bytes.length > limit) {
    throw new Error('size');
  }
  const detected = detectMedia(bytes);
  const matches = detected != null && (purpose === 'image' ? detected.startsWith('image/') : detected.startsWith('audio/'));
  if (!matches || declaredType !== detected) {
    throw new Error('signature');
  }
  return detected;
}
