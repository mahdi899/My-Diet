import type { GatewayName } from '../config/gateways.js';

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
export const GATEWAY_SET = Symbol('GATEWAY_SET');

export interface PaymentGateway {
  readonly name: GatewayName;
  /** Sabzine never collects card data. Gateways redirect the user away from the app. */
  readonly collectsCardData: false;
  readonly callsExternalNetwork: boolean;
}

export class SandboxPaymentGateway implements PaymentGateway {
  readonly name = 'sandbox' as const;
  readonly collectsCardData = false as const;
  readonly callsExternalNetwork = false;
}

export class UnavailablePaymentGateway implements PaymentGateway {
  readonly collectsCardData = false as const;
  readonly callsExternalNetwork = true;

  constructor(readonly name: GatewayName) {}
}

export class GatewaySet {
  constructor(
    private readonly gateways: ReadonlyMap<GatewayName, PaymentGateway>,
    readonly enabled: readonly GatewayName[],
  ) {}

  list(): Array<{ name: GatewayName; collectsCardData: false }> {
    return this.enabled.map((name) => ({ name, collectsCardData: false as const }));
  }

  get(name: string): PaymentGateway | null {
    return this.gateways.get(name as GatewayName) ?? null;
  }

  require(name: string): PaymentGateway {
    const gateway = this.get(name);
    if (!gateway) throw new Error(`Payment gateway ${name} is not enabled`);
    return gateway;
  }
}
