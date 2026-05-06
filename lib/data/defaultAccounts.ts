import type { AccountType } from '@/lib/types';

export interface AccountSeed {
  name: string;
  type: AccountType;
  description: string | null;
}

/**
 * Standard chart of accounts seeded for every new organization on signup.
 * Mirrors profitly-chart-of-accounts.md.
 */
export const STANDARD_ACCOUNTS: AccountSeed[] = [
  // Revenue
  { name: 'Sales — Products', type: 'revenue', description: 'Money from selling physical goods' },
  { name: 'Sales — Services', type: 'revenue', description: 'Money from selling your time or services' },
  { name: 'Other Income',     type: 'revenue', description: "Anything that doesn't fit above" },

  // Expenses
  { name: 'Advertising & Marketing',       type: 'expense', description: 'Ads, social media, promotions' },
  { name: 'Bank Fees',                     type: 'expense', description: 'Monthly fees, e-transfer fees, wire fees' },
  { name: 'Business Meals & Entertainment',type: 'expense', description: 'Meals with clients or team (50% deductible in Canada)' },
  { name: 'Contractor & Freelancer Fees',  type: 'expense', description: 'Payments to subcontractors' },
  { name: 'Insurance',                     type: 'expense', description: 'Business insurance premiums' },
  { name: 'Interest & Loan Payments',      type: 'expense', description: 'Interest on business loans or lines of credit' },
  { name: 'Office Supplies',               type: 'expense', description: 'Paper, pens, printer ink, small items' },
  { name: 'Professional Fees',             type: 'expense', description: 'Accountant, lawyer, consultant fees' },
  { name: 'Rent & Workspace',              type: 'expense', description: 'Office rent, co-working space' },
  { name: 'Salaries & Wages',              type: 'expense', description: 'Payroll for employees' },
  { name: 'Software & Subscriptions',      type: 'expense', description: 'SaaS tools, apps, licenses' },
  { name: 'Telephone & Internet',          type: 'expense', description: 'Business phone plan, internet bill' },
  { name: 'Travel',                        type: 'expense', description: 'Flights, hotels, transportation for business' },
  { name: 'Vehicle & Mileage',             type: 'expense', description: 'Gas, maintenance, parking for business use' },
  { name: 'Utilities',                     type: 'expense', description: 'Hydro, gas, water for business space' },
  { name: 'Miscellaneous Expense',         type: 'expense', description: "One-off items that don't fit elsewhere" },

  // Assets
  { name: 'Chequing Account',     type: 'asset', description: 'Primary business bank account' },
  { name: 'Savings Account',      type: 'asset', description: 'Business savings' },
  { name: 'Accounts Receivable',  type: 'asset', description: 'Money customers owe you' },

  // Liabilities
  { name: 'Accounts Payable',     type: 'liability', description: "Bills you owe but haven't paid yet" },
  { name: 'GST/HST Payable',      type: 'liability', description: 'Tax collected that you owe to CRA' },
  { name: 'Credit Card Payable',  type: 'liability', description: 'Business credit card balance' },

  // Equity
  { name: "Owner's Equity",     type: 'equity', description: 'Your ownership stake in the business' },
  { name: "Owner's Draw",       type: 'equity', description: "Money you've taken out of the business" },
  { name: 'Retained Earnings',  type: 'equity', description: 'Profits kept in the business' },
];

/**
 * Conditional accounts added during onboarding based on yes/no answers.
 * Keyed by the boolean column on `organizations`.
 */
export const CONDITIONAL_ACCOUNTS: Record<string, AccountSeed[]> = {
  has_inventory: [
    { name: 'Inventory',           type: 'asset',         description: 'Value of stock on hand' },
    { name: 'Cost of Goods Sold',  type: 'cost_of_goods', description: 'Direct cost of items sold' },
  ],
  has_prepaid_expenses: [
    { name: 'Prepaid Expenses',    type: 'asset',         description: 'Deposits or payments made before the expense period' },
  ],
  has_deferred_revenue: [
    { name: 'Deferred Revenue',    type: 'liability',     description: 'Money received before the work is done' },
  ],
  has_loans: [
    { name: 'Business Loan Payable', type: 'liability',   description: 'Outstanding loan principal' },
  ],
  has_equipment: [
    { name: 'Equipment & Machinery',   type: 'asset',     description: 'Major physical assets owned by the business' },
    { name: 'Accumulated Depreciation',type: 'asset',     description: 'Reduction in asset value over time' },
  ],
};
