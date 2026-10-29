export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface PaymentGateway {
  readonly name: string;
  /** Sabzine never collects card data. Gateways redirect the user away from the app. */
  readonly collectsCardData: false;
}

export class SandboxPaymentGateway implements PaymentGateway {
  readonly name = 'sandbox';
  readonly collectsCardData = false as const;
}

export class UnavailablePaymentGateway implements PaymentGateway {
  readonly name = 'zarinpal';
  readonly collectsCardData = false as const;
}
