import { ApiError } from '../common/errors.js';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const PURPOSE = /^[a-z][a-z0-9_]{1,40}$/;
const BLOCKED_HOST = /(^|\.)example\.(com|org|net)$|^localhost$|^127\.0\.0\.1$/;

export interface ArticleSection { heading: string; body: string }
export interface ArticleInput {
  slug: string;
  title: string;
  category: string;
  image: number;
  readingMinutes: number;
  intro: string;
  sections: ArticleSection[];
}

export function plainText(value: unknown, max: number): string {
  if (typeof value !== 'string') throw new ApiError(400, 'validation', 'متن مقاله درست نیست');
  if (/[<>]/.test(value) || /javascript\s*:/i.test(value)) {
    throw new ApiError(400, 'unsafe_content', 'متن نباید نشانهٔ HTML داشته باشد');
  }
  const cleaned = [...value].filter((char) => {
    const code = char.charCodeAt(0);
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
  }).join('').trim();
  if (!cleaned || cleaned.length > max) throw new ApiError(400, 'validation', 'متن مقاله درست نیست');
  return cleaned;
}

export function articleSlug(value: unknown): string {
  const slug = plainText(value, 64);
  if (!SLUG.test(slug)) throw new ApiError(400, 'validation', 'شناسهٔ مقاله درست نیست');
  return slug;
}

export function articleInput(body: Record<string, unknown>, slug: string): ArticleInput {
  if (!Array.isArray(body.sections) || body.sections.length < 1 || body.sections.length > 8) {
    throw new ApiError(400, 'validation', 'بخش‌های مقاله درست نیست');
  }
  const image = body.image;
  const readingMinutes = body.readingMinutes;
  if (typeof image !== 'number' || !Number.isInteger(image) || image < 0 || image > 3) {
    throw new ApiError(400, 'validation', 'تصویر مقاله درست نیست');
  }
  if (typeof readingMinutes !== 'number' || !Number.isInteger(readingMinutes) || readingMinutes < 1 || readingMinutes > 60) {
    throw new ApiError(400, 'validation', 'زمان مطالعه درست نیست');
  }
  return {
    slug,
    title: plainText(body.title, 120),
    category: plainText(body.category, 40),
    image,
    readingMinutes,
    intro: plainText(body.intro, 400),
    sections: body.sections.map((section) => {
      if (!section || typeof section !== 'object' || Array.isArray(section)) {
        throw new ApiError(400, 'validation', 'بخش‌های مقاله درست نیست');
      }
      const record = section as Record<string, unknown>;
      if (Object.keys(record).some((key) => key !== 'heading' && key !== 'body')) {
        throw new ApiError(400, 'validation', 'فیلد اضافی پذیرفته نیست');
      }
      return { heading: plainText(record.heading, 120), body: plainText(record.body, 2000) };
    }),
  };
}

export function pageWindow(pageRaw: unknown, sizeRaw: unknown): { page: number; pageSize: number; offset: number } {
  const page = pageRaw == null || pageRaw === '' ? 1 : Number(pageRaw);
  const pageSize = sizeRaw == null || sizeRaw === '' ? 20 : Number(sizeRaw);
  if (!Number.isInteger(page) || page < 1 || page > 1000) throw new ApiError(400, 'validation', 'صفحه درست نیست');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 20) throw new ApiError(400, 'validation', 'اندازهٔ صفحه درست نیست');
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function consentPurpose(value: unknown): string {
  const purpose = plainText(value, 41);
  if (!PURPOSE.test(purpose)) throw new ApiError(400, 'validation', 'موضوع رضایت درست نیست');
  return purpose;
}

export function appVersion(value: unknown): string {
  const version = plainText(value, 16);
  if (!VERSION.test(version)) throw new ApiError(400, 'validation', 'نسخهٔ برنامه درست نیست');
  return version;
}

/** A missing release stays null. An admin-supplied address must already be a public https URL. */
export function releaseUrl(status: unknown, url: unknown): { status: 'not_released'; url: null } | { status: 'released'; url: string } {
  if (status === 'not_released') {
    if (url != null && url !== '') throw new ApiError(400, 'fabricated_url', 'تا زمان انتشار، نشانی دانلود ساخته نمی‌شود');
    return { status: 'not_released', url: null };
  }
  if (status !== 'released' || typeof url !== 'string') {
    throw new ApiError(400, 'validation', 'وضعیت دانلود درست نیست');
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ApiError(400, 'fabricated_url', 'نشانی دانلود قابل پذیرش نیست');
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || BLOCKED_HOST.test(host)) {
    throw new ApiError(400, 'fabricated_url', 'نشانی دانلود قابل پذیرش نیست');
  }
  return { status: 'released', url: parsed.toString() };
}
