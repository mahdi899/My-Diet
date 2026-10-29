export function signedAdjustment(direction: 'debit' | 'credit', amountToman: number): number {
  return direction === 'debit' ? -amountToman : amountToman;
}

/** A bank-refund debit can only spend cash already in the wallet. */
export function debitFits(cashToman: number, amountToman: number): boolean {
  return amountToman > 0 && cashToman >= amountToman;
}
