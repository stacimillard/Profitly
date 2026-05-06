import type { BankAccountType, TransactionDirection } from '@/lib/types';

/**
 * Given a bank account type and a signed statement-line amount (as parsed
 * from the bank CSV), returns the transaction direction and absolute
 * amount we should look for among Profitly transactions to match.
 *
 * Convention:
 *   - chequing / savings: positive line = deposit (money_in)
 *   - credit_card: positive line = purchase (which is money_out in your books,
 *     because we flip credit card purchases during transaction CSV import).
 */
export function expectedTransactionForLine(
  bankType: BankAccountType,
  statementAmountCents: number
): { direction: TransactionDirection; amount_cents: number } {
  const isPositive = statementAmountCents >= 0;
  let direction: TransactionDirection;
  if (bankType === 'credit_card') {
    direction = isPositive ? 'money_out' : 'money_in';
  } else {
    direction = isPositive ? 'money_in' : 'money_out';
  }
  return { direction, amount_cents: Math.abs(statementAmountCents) };
}

/** Returns absolute number of days between two ISO dates (YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  const ms =
    Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return Math.round(ms / (24 * 60 * 60 * 1000));
}
