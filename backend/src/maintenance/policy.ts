export const PAYMENT_INQUIRY_MS = 15 * 60 * 1000;
export const PAYMENT_EXPIRE_MS = 30 * 60 * 1000;
export const GENERATING_STUCK_MS = 15 * 60 * 1000;
export const OTP_RETAIN_MS = 7 * 24 * 60 * 60 * 1000;
export const AI_RAW_RETAIN_MS = 30 * 24 * 60 * 60 * 1000;

/** A pending top-up older than 30 minutes is closed with no credit. */
export function shouldExpirePendingPayment(ageMs: number): boolean {
  return ageMs >= PAYMENT_EXPIRE_MS;
}

/** Between 15 and 30 minutes the payment is still open and unpaid. */
export function shouldInquirePendingPayment(ageMs: number): boolean {
  return ageMs >= PAYMENT_INQUIRY_MS && ageMs < PAYMENT_EXPIRE_MS;
}

/** A draft that is still generating after 15 minutes is picked up again. */
export function shouldRequeueGenerating(ageMs: number): boolean {
  return ageMs >= GENERATING_STUCK_MS;
}

/** OTP and authenticator challenges are kept for 7 days. */
export function shouldPurgeChallenge(ageMs: number): boolean {
  return ageMs >= OTP_RETAIN_MS;
}

/** Raw model text is kept for 30 days. The approved plan is not this text. */
export function shouldClearAiRaw(ageMs: number): boolean {
  return ageMs >= AI_RAW_RETAIN_MS;
}
