export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');

export interface PushMessage {
  token: string;
  kind: string;
}

export interface PushProvider {
  readonly name: string;
  readonly callsExternalNetwork: boolean;
  send(message: PushMessage): Promise<void>;
}

export class ConsolePushProvider implements PushProvider {
  readonly name = 'console';
  readonly callsExternalNetwork = false;

  async send(_message: PushMessage): Promise<void> {
    // The token and the notification kind stay out of the log.
  }
}

export class UnavailablePushProvider implements PushProvider {
  readonly name = 'fcm';
  readonly callsExternalNetwork = true;

  async send(): Promise<void> {
    throw new Error('Push provider adapter is not available in this build');
  }
}
