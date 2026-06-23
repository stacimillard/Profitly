import {
  parseCSV,
  detectColumns,
  parseCsvAmountCents,
  parseCsvDate,
} from '@/lib/csv/parse';
import { getAnthropic } from '@/lib/ai/anthropic';
import type { TransactionDirection, BankAccountType } from '@/lib/types';

export interface ParsedTransaction {
  /** Stable client-side id so the review UI can track checkbox selection. */
  client_id: string;
  date: string;
  description: string;
  amount_cents: number;
  direction: TransactionDirection;
}

export interface ExtractionResult {
  source: 'csv' | 'pdf';
  transactions: ParsedTransaction[];
  /** Rows the parser couldn't make sense of (missing date/amount/etc). */
  skipped: number;
}

const PDF_EXTRACTION_TOOL = {
  name: 'submit_transactions',
  description:
    'Submit every transaction found on the bank or credit-card statement.',
  input_schema: {
    type: 'object' as const,
    properties: {
      transactions: {
        type: 'array',
        description: 'One entry per transaction line, in the order they appear.',
        items: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Transaction date in YYYY-MM-DD format.',
            },
            description: {
              type: 'string',
              description:
                'The merchant or description as shown on the statement.',
            },
            amount: {
              type: 'number',
              description:
                'Amount in dollars (decimal). Use a positive number; the `direction` field says whether it was money in or out.',
            },
            direction: {
              type: 'string',
              enum: ['money_in', 'money_out'],
              description:
                'money_in for deposits/credits/payments received; money_out for debits/purchases/withdrawals. For credit-card statements, purchases are money_out and payments to the card are money_in.',
            },
          },
          required: ['date', 'description', 'amount', 'direction'],
        },
      },
    },
    required: ['transactions'],
  },
};

const PDF_SYSTEM_PROMPT = `You extract transactions from bank and credit-card statement PDFs for a Canadian small-business bookkeeping app.

Rules:
- Return ONE entry per posted transaction line. Do NOT include opening/closing balances, summary totals, interest summaries, statement period headers, or rewards points.
- Dates must be YYYY-MM-DD. If the line shows only month/day, use the statement period to infer the year. If a transaction date and posting date both appear, prefer the transaction date.
- Description is the merchant or description text shown on the statement, cleaned of trailing reference numbers when obviously noise.
- Amount is a positive decimal in dollars. Cents matter — be precise.
- direction:
  - chequing/savings: deposits/credits → money_in; withdrawals/debits/cheques → money_out
  - credit card: purchases/fees/interest → money_out; payments received/refunds/credits → money_in
- If the statement has multiple pages, include transactions from every page.
- You MUST call the submit_transactions tool exactly once with all transactions you found.`;

interface ExtractArgs {
  file: File;
  bankAccountType: BankAccountType;
}

export async function extractFromFile({
  file,
  bankAccountType,
}: ExtractArgs): Promise<ExtractionResult> {
  const name = (file.name || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();

  const isPdf =
    mime === 'application/pdf' || name.endsWith('.pdf');
  if (isPdf) {
    return extractFromPdf(file, bankAccountType);
  }
  return extractFromCsv(file, bankAccountType);
}

async function extractFromCsv(
  file: File,
  bankAccountType: BankAccountType
): Promise<ExtractionResult> {
  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length < 2) {
    throw new ImportError("We couldn't find any rows in that CSV.");
  }

  const headers = rows[0];
  const cols = detectColumns(headers);
  if (!cols) {
    throw new ImportError(
      "We couldn't read the columns. Make sure your CSV has Date, Description, and Amount (or Debit/Credit) columns."
    );
  }

  const transactions: ParsedTransaction[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || row.every((c) => c === '')) continue;

    const date = parseCsvDate(row[cols.date] ?? '');
    const description = (row[cols.description] ?? '').trim();
    if (!date || !description) {
      skipped++;
      continue;
    }

    let amountCents = 0;
    let direction: TransactionDirection = 'money_out';

    if (cols.amount !== undefined) {
      const raw = parseCsvAmountCents(row[cols.amount] ?? '');
      if (raw === 0) {
        skipped++;
        continue;
      }
      const flipped = bankAccountType === 'credit_card' ? -raw : raw;
      direction = flipped >= 0 ? 'money_in' : 'money_out';
      amountCents = Math.abs(flipped);
    } else {
      const debitCents =
        cols.debit !== undefined
          ? parseCsvAmountCents(row[cols.debit] ?? '')
          : 0;
      const creditCents =
        cols.credit !== undefined
          ? parseCsvAmountCents(row[cols.credit] ?? '')
          : 0;
      if (debitCents !== 0) {
        direction = 'money_out';
        amountCents = Math.abs(debitCents);
      } else if (creditCents !== 0) {
        direction = 'money_in';
        amountCents = Math.abs(creditCents);
      } else {
        skipped++;
        continue;
      }
    }

    transactions.push({
      client_id: `csv-${i}`,
      date,
      description,
      amount_cents: amountCents,
      direction,
    });
  }

  if (transactions.length === 0) {
    throw new ImportError(
      skipped
        ? "We couldn't read any usable rows. Check the date and amount columns?"
        : 'No transactions found in that CSV.'
    );
  }

  return { source: 'csv', transactions, skipped };
}

interface PdfExtractedRow {
  date?: unknown;
  description?: unknown;
  amount?: unknown;
  direction?: unknown;
}

async function extractFromPdf(
  file: File,
  bankAccountType: BankAccountType
): Promise<ExtractionResult> {
  const MAX_BYTES = 15 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    throw new ImportError(
      'That PDF is bigger than 15 MB — try a smaller file or split the statement.'
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString('base64');

  const anthropic = getAnthropic();

  let response;
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: [
        {
          type: 'text',
          text: PDF_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [PDF_EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'submit_transactions' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `This is a ${
                bankAccountType === 'credit_card'
                  ? 'credit-card'
                  : bankAccountType
              } statement. Read it and submit every posted transaction via the submit_transactions tool. Skip headers, balances, summaries, and totals.`,
            },
          ],
        },
      ],
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "We couldn't read the PDF — try a different file.";
    throw new ImportError(
      `We had trouble reading that PDF: ${message}. Try a clearer scan or a CSV export.`
    );
  }

  let rawRows: PdfExtractedRow[] = [];
  for (const block of response.content) {
    if (
      block.type === 'tool_use' &&
      block.name === 'submit_transactions'
    ) {
      const input = block.input as { transactions?: PdfExtractedRow[] };
      if (Array.isArray(input.transactions)) {
        rawRows = input.transactions;
      }
      break;
    }
  }

  let skipped = 0;
  const transactions: ParsedTransaction[] = [];

  rawRows.forEach((row, idx) => {
    const date =
      typeof row.date === 'string' ? parseCsvDate(row.date) : null;
    const description =
      typeof row.description === 'string' ? row.description.trim() : '';
    const amountNum =
      typeof row.amount === 'number'
        ? row.amount
        : typeof row.amount === 'string'
          ? Number(row.amount)
          : NaN;
    const direction: TransactionDirection =
      row.direction === 'money_in' ? 'money_in' : 'money_out';

    if (!date || !description || !Number.isFinite(amountNum) || amountNum <= 0) {
      skipped++;
      return;
    }

    transactions.push({
      client_id: `pdf-${idx}`,
      date,
      description,
      amount_cents: Math.round(Math.abs(amountNum) * 100),
      direction,
    });
  });

  if (transactions.length === 0) {
    throw new ImportError(
      "We couldn't pull any transactions from that PDF. It may be a scan, image-only, or password protected. Try a CSV export instead."
    );
  }

  return { source: 'pdf', transactions, skipped };
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}
