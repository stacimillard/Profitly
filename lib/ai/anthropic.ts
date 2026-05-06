import Anthropic from '@anthropic-ai/sdk';
import type { AccountType } from '@/lib/types';

let cachedClient: Anthropic | null = null;

/** Lazy singleton for the Anthropic SDK client. */
export function getAnthropic(): Anthropic {
  if (cachedClient) return cachedClient;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to .env.local to use AI features.'
    );
  }
  cachedClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  return cachedClient;
}

export interface AccountForAI {
  id: string;
  name: string;
  type: AccountType;
  description: string | null;
}

export interface TransactionForAI {
  id: string;
  date: string;
  description: string;
  amount_cents: number;
  direction: 'money_in' | 'money_out';
}

export interface AICategorizationSuggestion {
  transaction_id: string;
  account_id: string;
  confidence: number;
  reasoning: string;
}

const SYSTEM_PROMPT = `You are a bookkeeping assistant for Canadian small business owners who aren't accountants. You categorize transactions by picking the best matching account from the chart of accounts the user has set up.

Rules:
- Always use an EXACT account_id from the chart of accounts. Never invent an id.
- Match the direction:
  - money_in → revenue or asset accounts
  - money_out → expense, cost_of_goods, asset, or liability accounts
- For ambiguous transactions, pick the most likely category and lower the confidence.
- Common Canadian patterns:
  - Restaurants and cafés (clear business context) → Business Meals & Entertainment
  - SaaS, apps, software subscriptions → Software & Subscriptions
  - Gas, parking, transit, ride-share → Vehicle & Mileage (or Travel for trips)
  - Hotels, flights, Airbnb → Travel
  - Office stores like Staples, Indigo for supplies → Office Supplies
  - Payroll companies (Wagepoint, Wave Payroll, etc.) → Salaries & Wages
  - Bank monthly fees, e-transfer fees, NSF → Bank Fees
  - Subcontractors, freelancers → Contractor & Freelancer Fees
- Confidence:
  - 0.9+ for very clear matches (the vendor name strongly implies the category)
  - 0.5–0.8 for likely but not certain
  - <0.5 if you're guessing
- Reasoning is one short sentence in plain language a non-accountant would understand.

You MUST call the submit_categorizations tool with one suggestion per transaction.`;

const CATEGORIZATION_TOOL = {
  name: 'submit_categorizations',
  description:
    'Submit a categorization suggestion for each transaction provided in the user message.',
  input_schema: {
    type: 'object' as const,
    properties: {
      suggestions: {
        type: 'array',
        description:
          'One suggestion per transaction. Must include every transaction_id provided.',
        items: {
          type: 'object',
          properties: {
            transaction_id: {
              type: 'string',
              description: 'The id of the transaction this suggestion is for.',
            },
            account_id: {
              type: 'string',
              description:
                'The id of the chosen account from the chart of accounts.',
            },
            confidence: {
              type: 'number',
              description:
                'How confident you are, from 0.0 (guessing) to 1.0 (certain).',
              minimum: 0,
              maximum: 1,
            },
            reasoning: {
              type: 'string',
              description:
                'One short sentence (plain language) explaining the choice.',
            },
          },
          required: [
            'transaction_id',
            'account_id',
            'confidence',
            'reasoning',
          ],
        },
      },
    },
    required: ['suggestions'],
  },
};

interface SuggestArgs {
  accounts: AccountForAI[];
  transactions: TransactionForAI[];
}

/**
 * Asks Claude to categorize a batch of transactions against the org's
 * chart of accounts. Uses prompt caching on the system prompt and the
 * chart of accounts so repeated calls within ~5 minutes are cheap.
 */
export async function suggestCategories({
  accounts,
  transactions,
}: SuggestArgs): Promise<AICategorizationSuggestion[]> {
  if (transactions.length === 0) return [];
  if (accounts.length === 0) return [];

  const anthropic = getAnthropic();

  const result = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: [CATEGORIZATION_TOOL],
    tool_choice: { type: 'tool', name: 'submit_categorizations' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Chart of accounts (id, name, type, description):\n${JSON.stringify(
              accounts,
              null,
              2
            )}`,
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: `Transactions to categorize (id, date, description, amount_cents, direction):\n${JSON.stringify(
              transactions,
              null,
              2
            )}\n\nCall submit_categorizations now with one suggestion per transaction.`,
          },
        ],
      },
    ],
  });

  for (const block of result.content) {
    if (block.type === 'tool_use' && block.name === 'submit_categorizations') {
      const input = block.input as {
        suggestions?: AICategorizationSuggestion[];
      };
      return Array.isArray(input.suggestions) ? input.suggestions : [];
    }
  }
  return [];
}
