import { Module } from '@nestjs/common';
import { MelipayamakSmsProvider } from './melipayamak.js';
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
import { ZarinpalPaymentGateway } from './zarinpal.js';
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
      provide: PUSH_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) => {
        if (env.PUSH_PROVIDER === 'console') return new ConsolePushProvider();
        if (env.NODE_ENV !== 'production') return new UnavailablePushProvider();
        throw new EnvError('FCM adapter is not available in this build');
      },
    },
  ],
  exports: [SMS_PROVIDER, PAYMENT_GATEWAY, GATEWAY_SET, PUSH_PROVIDER],
})
export class AdaptersModule {}

function gatewayFor(env: Env, name: 'sandbox' | 'zarinpal' | 'idpay') {
  if (name === 'sandbox') return new SandboxPaymentGateway();
  if (name === 'zarinpal' && env.ZARINPAL_MERCHANT_ID) {
    return new ZarinpalPaymentGateway({
      merchantId: env.ZARINPAL_MERCHANT_ID,
      sandbox: env.ZARINPAL_SANDBOX,
      baseUrl: env.ZARINPAL_BASE_URL,
    });
  }
  if (env.NODE_ENV !== 'production') return new UnavailablePaymentGateway(name);
  throw new EnvError(`${name} adapter is not available in this build`);
}

