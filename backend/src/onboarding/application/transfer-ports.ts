export interface TransferRecord {
  id: string;
  plan: string;
  amount_toman: number;
  expires_at: Date;
  confirmed_at: Date | null;
  gateway_started: boolean;
}

export interface TransferSession {
  lockUser(userId: string): Promise<{ phone: string } | null>;
  isVerifiedSubmission(submissionId: string, phoneHash: string): Promise<boolean>;
  reusable(userId: string, submissionId: string, plan: string): Promise<TransferRecord | null>;
  insert(input: { id: string; userId: string; submissionId: string; plan: string; amountToman: number }): Promise<TransferRecord | null>;
  lockPayment(id: string, userId: string): Promise<{ amountToman: number; trackId: string | null; confirmed: boolean; active: boolean } | null>;
  attachGateway(id: string, trackId: string): Promise<void>;
  confirmGateway(id: string, reference: string): Promise<{ phone: string } | null>;
  lockBankReference(reference: string): Promise<void>;
  hasBankReference(reference: string, exceptId: string): Promise<boolean>;
  confirmBank(id: string, reference: string, amountToman: number): Promise<{ phone: string; amountToman: number } | null>;
  audit(actorId: string | null, action: string, id: string, detail: object): Promise<void>;
}

export interface TransferRepository {
  transaction<T>(run: (session: TransferSession) => Promise<T>): Promise<T>;
  status(id: string, userId: string): Promise<TransferRecord | null>;
  byGatewayTrack(trackId: string): Promise<{ id: string; amountToman: number; confirmed: boolean } | null>;
  list(): Promise<Record<string, unknown>[]>;
  setSmsStatus(id: string, status: 'sent' | 'failed'): Promise<void>;
}

export interface TransferGateway {
  start(input: { amountRial: number; orderId: string }): Promise<string>;
  verify(trackId: string, amountRial: number): Promise<boolean>;
  redirectUrl(trackId: string): string;
}

export interface TransferServices {
  gateway: TransferGateway;
  confirmation: { send(phone: string): Promise<void> };
  phoneHash(phone: string): string;
  newId(): string;
  uniqueAmount(base: number): number;
}
