const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC = '٠١٢٣٤٥٦٧٨٩';

export const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected', 'suspended'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Council numbers are digits. Persian and Arabic numerals fold to Latin digits. */
export function normalizeCouncilNo(raw: string): string | null {
  let digits = '';
  for (const char of raw.trim()) {
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
    if (char === ' ' || char === '-') continue;
    return null;
  }
  if (digits.length !== 0 && (digits.length < 4 || digits.length > 12)) return null;
  return digits;
}

/** Medical council number on the admin form: exactly six digits. */
export function councilNoExact(raw: string): string | null {
  const value = normalizeCouncilNo(raw);
  return value && value.length === 6 ? value : null;
}

/** Specialist sign-in name: 3–32 latin letters, digits, dot, underscore or hyphen. */
export function normalizeLoginName(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  return /^[a-z][a-z0-9._-]{2,31}$/.test(value) ? value : null;
}

/** A different council number clears verification. The same number leaves it. */
export function verificationAfterCouncilChange(
  currentCouncil: string,
  nextCouncil: string | undefined,
  status: VerificationStatus,
): VerificationStatus {
  if (nextCouncil == null || nextCouncil === currentCouncil) return status;
  return 'pending';
}
