import { EnvError } from './env.js';

export const GATEWAY_NAMES = ['sandbox', 'zarinpal', 'idpay'] as const;

export type GatewayName = (typeof GATEWAY_NAMES)[number];

export function enabledGatewayNames(env: {
  PAYMENT_GATEWAY: string;
  PAYMENT_GATEWAYS: string;
}): GatewayName[] {
  const listed = env.PAYMENT_GATEWAYS.split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const names = listed.length > 0 ? listed : [env.PAYMENT_GATEWAY];
  if (!names.includes(env.PAYMENT_GATEWAY)) {
    throw new EnvError('PAYMENT_GATEWAYS must include PAYMENT_GATEWAY');
  }
  for (const name of names) {
    if (!GATEWAY_NAMES.includes(name as GatewayName)) {
      throw new EnvError(`Unknown payment gateway ${name}`);
    }
  }
  return [...new Set(names)] as GatewayName[];
}
