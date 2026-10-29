import { ApiError } from './errors.js';

const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC = '٠١٢٣٤٥٦٧٨٩';

/** Iranian mobiles become +989XXXXXXXXX. Other countries are rejected in this version. */
export function normalizeIranianMobile(input: string): string {
  let digits = '';
  for (const char of input.trim()) {
    const persian = PERSIAN.indexOf(char);
    if (persian >= 0) {
      digits += String(persian);
      continue;
    }
    const arabic = ARABIC.indexOf(char);
    if (arabic >= 0) {
      digits += String(arabic);
      continue;
    }
    if (char >= '0' && char <= '9') {
      digits += char;
      continue;
    }
    if (char === '+' || char === ' ' || char === '-' || char === '(' || char === ')') {
      continue;
    }
    throw new ApiError(400, 'invalid_phone', 'شمارهٔ موبایل معتبر نیست');
  }

  let national: string;
  if (digits.startsWith('0098')) national = digits.slice(4);
  else if (digits.startsWith('98') && digits.length === 12) national = digits.slice(2);
  else if (digits.startsWith('0') && digits.length === 11) national = digits.slice(1);
  else if (digits.length === 10) national = digits;
  else if (digits.length >= 11) {
    throw new ApiError(
      400,
      'unsupported_country',
      'در این نسخه فقط شمارهٔ موبایل ایران پذیرفته می‌شود',
    );
  } else {
    throw new ApiError(400, 'invalid_phone', 'شمارهٔ موبایل معتبر نیست');
  }

  if (!/^9\d{9}$/.test(national)) {
    throw new ApiError(400, 'invalid_phone', 'شمارهٔ موبایل معتبر نیست');
  }
  return `+98${national}`;
}
