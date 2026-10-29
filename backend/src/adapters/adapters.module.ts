import { Module } from '@nestjs/common';
import { ENV, EnvError, type Env } from '../config/env.js';
import {
  ConsoleSmsProvider,
  SMS_PROVIDER,
  UnavailableSmsProvider,
} from './sms.js';
import {
  PAYMENT_GATEWAY,
  SandboxPaymentGateway,
  UnavailablePaymentGateway,
} from './payment.js';
import {
  FakePlanDraftProvider,
  PLAN_DRAFT_PROVIDER,
  UnavailablePlanDraftProvider,
} from './plan-draft.js';

@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) => {
        if (env.SMS_PROVIDER === 'console') return new ConsoleSmsProvider();
        if (env.NODE_ENV !== 'production') return new UnavailableSmsProvider();
        throw new EnvError('Kavenegar adapter is not available in this build');
      },
    },
    {
      provide: PAYMENT_GATEWAY,
      inject: [ENV],
      useFactory: (env: Env) => {
        if (env.PAYMENT_GATEWAY === 'sandbox') return new SandboxPaymentGateway();
        if (env.NODE_ENV !== 'production') return new UnavailablePaymentGateway();
        throw new EnvError('Zarinpal adapter is not available in this build');
      },
    },
    {
      provide: PLAN_DRAFT_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) => {
        if (env.AI_PROVIDER === 'fake') return new FakePlanDraftProvider();
        if (env.NODE_ENV !== 'production') return new UnavailablePlanDraftProvider();
        throw new EnvError('AI provider adapter is not available in this build');
      },
    },
  ],
  exports: [SMS_PROVIDER, PAYMENT_GATEWAY, PLAN_DRAFT_PROVIDER],
})
export class AdaptersModule {}
