import { Logger } from '@nestjs/common';

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export interface SmsProvider {
  readonly name: string;
  sendOtp(phoneE164: string, code: string): Promise<void>;
}

export function maskPhone(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '');
  if (digits.length < 7) return '***';
  return `${digits.slice(0, 4)}***${digits.slice(-4)}`;
}

/** Log line for a dispatched code. The code itself is never included. */
export function otpDispatchMessage(phoneE164: string, code: string): string {
  if (code.length === 0) throw new Error('OTP code is empty');
  return `otp dispatched to ${maskPhone(phoneE164)}`;
}

/** Development sink. The code is never written to the log. */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async sendOtp(phoneE164: string, code: string): Promise<void> {
    this.logger.log(otpDispatchMessage(phoneE164, code));
  }
}

export class UnavailableSmsProvider implements SmsProvider {
  readonly name = 'kavenegar';

  async sendOtp(): Promise<void> {
    throw new Error('Kavenegar adapter is not available in this build');
  }
}
