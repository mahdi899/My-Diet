const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Folds Persian/Arabic variants so patterns and searches see one spelling: digits, ی, ک, ZWNJ, diacritics. */
export function normalizeFa(input: string): string {
  let out = '';
  for (const char of input.normalize('NFKC')) {
    const persian = PERSIAN_DIGITS.indexOf(char);
    if (persian >= 0) out += String(persian);
    else {
      const arabic = ARABIC_DIGITS.indexOf(char);
      if (arabic >= 0) out += String(arabic);
      else if (char === 'ي' || char === 'ى') out += 'ی';
      else if (char === 'ك') out += 'ک';
      else if (char === '\u200c' || char === '\u200f' || char === '\u200e') out += ' ';
      else if (/[\u064b-\u065f\u0670\u0640]/.test(char)) out += '';
      else out += char;
    }
  }
  return out.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Strips ASCII controls and bidi-override marks. Kept as a scan so the source has no control-character regex. */
export function stripUnsafeChars(input: string): string {
  let out = '';
  for (const char of input) {
    const code = char.charCodeAt(0);
    if (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127) continue;
    if (code >= 0x202a && code <= 0x202e) continue;
    if (code >= 0x2066 && code <= 0x2069) continue;
    out += char;
  }
  return out;
}

/** Strips control and bidi-override characters, collapses whitespace, caps length. */
export function cleanUserText(input: string, max: number): string {
  return stripUnsafeChars(input)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

export const round1 = (value: number): number => Math.round(value * 10) / 10;
export const round0 = (value: number): number => Math.round(value);

/** Persian digits for display text that the app shows verbatim. */
export function faNumber(value: number): string {
  return String(round0(value)).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]!);
}
