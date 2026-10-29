import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { StoredAnswers } from '../questionnaire/schema.js';

const CLINICAL_KEYS = ['healthDetails', 'allergies', 'medicines', 'dislikes'] as const;

function keyBytes(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

/** Empty text stays empty so untouched optional answers are not wrapped. */
export function encryptText(plain: string, secret: string): string {
  if (plain === '' || plain.startsWith('enc1:')) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptText(stored: string, secret: string): string {
  if (!stored.startsWith('enc1:')) return stored;
  const parts = stored.split(':');
  if (parts.length !== 4) return stored;
  const iv = Buffer.from(parts[1] ?? '', 'base64url');
  const tag = Buffer.from(parts[2] ?? '', 'base64url');
  const data = Buffer.from(parts[3] ?? '', 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function sealAnswers(answers: StoredAnswers, secret: string): StoredAnswers {
  const sealed = { ...answers };
  for (const key of CLINICAL_KEYS) sealed[key] = encryptText(answers[key], secret);
  return sealed;
}

export function openAnswers(answers: StoredAnswers, secret: string): StoredAnswers {
  const opened = { ...answers };
  for (const key of CLINICAL_KEYS) opened[key] = decryptText(answers[key] ?? '', secret);
  return opened;
}

export function sealClinicalRecord(value: unknown, secret: string): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const copy = { ...(value as Record<string, unknown>) };
  for (const key of CLINICAL_KEYS) {
    if (typeof copy[key] === 'string') copy[key] = encryptText(copy[key], secret);
  }
  return copy;
}

export function openClinicalRecord(value: unknown, secret: string): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const copy = { ...(value as Record<string, unknown>) };
  for (const key of CLINICAL_KEYS) {
    if (typeof copy[key] === 'string') copy[key] = decryptText(copy[key], secret);
  }
  return copy;
}
