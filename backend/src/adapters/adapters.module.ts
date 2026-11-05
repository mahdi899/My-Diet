import { Module } from '@nestjs/common';
import { MelipayamakSmsProvider } from './melipayamak.js';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.js';
import { ConfiguredAiProvider } from './configured-ai.js';
import { ENV, EnvError, type Env } from '../config/env.js';
import {
  ConsoleSmsProvider,
  SMS_PROVIDER,
  UnavailableSmsProvider,
} from './sms.js';
import { enabledGatewayNames } from '../config/gateways.js';
import {
  GATEWAY_SET,
  GatewaySet,
  PAYMENT_GATEWAY,
  SandboxPaymentGateway,
  UnavailablePaymentGateway,
} from './payment.js';
import {
  FailoverPlanDraftProvider,
  FakePlanDraftProvider,
  PLAN_DRAFT_PROVIDER,
  UnavailablePlanDraftProvider,
  type PlanDraftProvider,
} from './plan-draft.js';
import {
  ConsolePushProvider,
  PUSH_PROVIDER,
  UnavailablePushProvider,
} from './push.js';

@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) => {
        if(env.SMS_PROVIDER==='melipayamak')return new MelipayamakSmsProvider(env);
        if (env.SMS_PROVIDER === 'console') return new ConsoleSmsProvider();
        if (env.NODE_ENV !== 'production') return new UnavailableSmsProvider();
        throw new EnvError('Kavenegar adapter is not available in this build');
      },
    },
    {
      provide: GATEWAY_SET,
      inject: [ENV],
      useFactory: (env: Env) => {
        const enabled = enabledGatewayNames(env);
        const gateways = new Map(enabled.map((name) => [name, gatewayFor(env, name)]));
        return new GatewaySet(gateways, enabled);
      },
    },
    {
      provide: PAYMENT_GATEWAY,
      inject: [GATEWAY_SET, ENV],
      useFactory: (gateways: GatewaySet, env: Env) => gateways.require(env.PAYMENT_GATEWAY),
    },
    {
      provide: PLAN_DRAFT_PROVIDER,
      inject: [ENV, PG_POOL],
      useFactory: (env: Env, pool: Pool) => {
        const primary = draftProvider(env, env.AI_PROVIDER);
        const fallback = env.AI_FAILOVER_PROVIDER === 'none' ? primary : new FailoverPlanDraftProvider(primary, draftProvider(env, env.AI_FAILOVER_PROVIDER));
        return new ConfiguredAiProvider(pool,env,fallback);
      },
    },
    {
      provide: PUSH_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) => {
        if (env.PUSH_PROVIDER === 'console') return new ConsolePushProvider();
        if (env.NODE_ENV !== 'production') return new UnavailablePushProvider();
        throw new EnvError('FCM adapter is not available in this build');
      },
    },
  ],
  exports: [SMS_PROVIDER, PAYMENT_GATEWAY, GATEWAY_SET, PLAN_DRAFT_PROVIDER, PUSH_PROVIDER],
})
export class AdaptersModule {}

function gatewayFor(env: Env, name: 'sandbox' | 'zarinpal' | 'idpay') {
  if (name === 'sandbox') return new SandboxPaymentGateway();
  if (env.NODE_ENV !== 'production') return new UnavailablePaymentGateway(name);
  throw new EnvError(`${name} adapter is not available in this build`);
}

function draftProvider(env: Env, name: 'fake' | 'openai' | 'configured'): PlanDraftProvider {
  if (name === 'fake') return new FakePlanDraftProvider();
  if (name === 'configured') return new UnavailablePlanDraftProvider();
  if (env.NODE_ENV !== 'production') return new UnavailablePlanDraftProvider();
  throw new EnvError('AI provider adapter is not available in this build');
}
