/** A business/application failure; HTTP translation belongs to the adapter. */
export class ApplicationError extends Error {
  constructor(readonly status: number, readonly code: string, readonly messageFa: string) {
    super(messageFa);
  }
}
