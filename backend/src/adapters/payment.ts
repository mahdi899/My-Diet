import type { GatewayName } from '../config/gateways.js';

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
export const GATEWAY_SET = Symbol('GATEWAY_SET');

export interface PaymentGateway {
  readonly name: GatewayName;
  /** Sabzine never collects card data. Gateways redirect the user away from the app. */
  readonly collectsCardData: false;
  readonly callsExternalNetwork: boolean;
}

export interface HostedStart {
  authority: string;
  redirectUrl: string;
}

export interface HostedVerify {
  ok: boolean;
  alreadyVerified: boolean;
  refId: string | null;
  code: number;
}

/** A gateway that sends the person to its own page and confirms the payment server-to-server. */
export interface HostedPaymentGateway extends PaymentGateway {
  start(input: {
    amountRial: number;
    callbackUrl: string;
    description: string;
    mobile?: string;
  }): Promise<HostedStart>;
  verify(input: { amountRial: number; authority: string }): Promise<HostedVerify>;
}

export function isHostedGateway(gateway: PaymentGateway): gateway is HostedPaymentGateway {
  return (
    typeof (gateway as Partial<HostedPaymentGateway>).start === 'function' &&
    typeof (gateway as Partial<HostedPaymentGateway>).verify === 'function'
  );
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
