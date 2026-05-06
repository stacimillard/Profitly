/**
 * Formatting helpers for money, dates, and percentages.
 * Money is always stored in the database as integer cents.
 */

/** Convert cents (e.g. 1250) to a CAD currency string (e.g. "$12.50"). */
export function formatCurrency(cents: number | null | undefined): string {
  const amount = (cents ?? 0) / 100;
  return amount.toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
  });
}

/** Convert cents to a plain-number string (e.g. 1250 → "12.50"). No symbol. */
export function formatAmount(cents: number | null | undefined): string {
  const amount = (cents ?? 0) / 100;
  return amount.toFixed(2);
}

/** Convert dollars (number or string) to integer cents. */
export function dollarsToCents(dollars: number | string): number {
  const n = typeof dollars === 'string' ? parseFloat(dollars) : dollars;
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** Convert integer cents to a plain dollar number. */
export function centsToDollars(cents: number | null | undefined): number {
  return (cents ?? 0) / 100;
}

/** "Apr 25, 2026" — short readable date for tables and lists. */
export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** "April 25, 2026" — long-form date for headers and summaries. */
export function formatDateLong(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** "April 2026" — month + year, useful for closed-month labels. */
export function formatMonthYear(month: number, year: number): string {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
  });
}

/** Format a numeric rate (0.05) as a percentage string ("5%"). */
export function formatPercent(rate: number, fractionDigits = 0): string {
  return `${(rate * 100).toFixed(fractionDigits)}%`;
}
