/**
 * Tiny RFC-4180 friendly CSV parser. Handles quoted fields, embedded
 * commas, doubled-up quote escapes, and CRLF/LF line endings.
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (cell !== '' || row.length > 0) {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      }
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((v) => v.trim()));
}

export interface DetectedColumns {
  date: number;
  description: number;
  amount?: number;
  debit?: number;
  credit?: number;
}

/**
 * Detects which columns hold the date, description, and amount info.
 * Returns null if it can't find Date + Description and at least one of
 * Amount or Debit/Credit. Common Canadian bank exports work out of the box.
 */
export function detectColumns(headers: string[]): DetectedColumns | null {
  const lower = headers.map((h) => h.toLowerCase().trim());

  const find = (patterns: string[]): number => {
    for (const p of patterns) {
      const idx = lower.findIndex((h) => h.includes(p));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const dateIdx = find(['date']);
  const descIdx = find(['description', 'details', 'memo', 'merchant', 'transaction', 'narrative']);
  const amountIdx = find(['amount', 'transaction amount']);
  const debitIdx = find(['debit', 'withdraw', 'money out', 'paid out']);
  const creditIdx = find(['credit', 'deposit', 'money in', 'paid in']);

  if (dateIdx < 0 || descIdx < 0) return null;

  // Avoid mistaking an "amount" column for "debit/credit" when both names
  // actually point to the same column index.
  const distinctDebitCredit = debitIdx !== creditIdx;

  if (amountIdx >= 0 && (debitIdx < 0 || !distinctDebitCredit)) {
    return { date: dateIdx, description: descIdx, amount: amountIdx };
  }
  if (debitIdx >= 0 || creditIdx >= 0) {
    return {
      date: dateIdx,
      description: descIdx,
      debit: debitIdx >= 0 ? debitIdx : undefined,
      credit: creditIdx >= 0 ? creditIdx : undefined,
    };
  }
  if (amountIdx >= 0) {
    return { date: dateIdx, description: descIdx, amount: amountIdx };
  }
  return null;
}

/** Try to convert a raw cell to YYYY-MM-DD. Returns null if unparseable. */
export function parseCsvDate(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // ISO date "YYYY-MM-DD" (or "YYYY/MM/DD")
  const iso = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // "DD/MM/YYYY" or "MM/DD/YYYY". Canadian banks vary; we'll assume MM/DD/YY(YY)
  // because that matches major Canadian bank CSV exports (TD, RBC, BMO, etc).
  const slashed = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slashed) {
    let [, m, d, y] = slashed;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Fallback: let JS try (handles "Apr 25, 2026" style).
  const native = new Date(trimmed);
  if (!Number.isNaN(native.getTime())) {
    return native.toISOString().slice(0, 10);
  }
  return null;
}

/** Convert a raw amount cell ("$1,234.56" or "(123.45)") to integer cents. */
export function parseCsvAmountCents(raw: string): number {
  if (!raw) return 0;
  let s = raw.trim();
  if (!s) return 0;
  // Parentheses → negative, e.g. (12.50) means -12.50
  if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1, -1);
  // Strip currency symbols, commas, whitespace
  s = s.replace(/[$,\s]/g, '');
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
