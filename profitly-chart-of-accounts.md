# Profitly — Default Chart of Accounts

## Overview
Every new organization gets this default chart of accounts on signup.
Accounts are seeded automatically during onboarding.
Users can add, rename, or deactivate accounts at any time.

All accounts have a `type` field that controls where they appear in reports.

---

## Account Types
- `revenue` — money coming in
- `cost_of_goods` — direct costs tied to what you sell
- `expense` — operating costs
- `asset` — things you own
- `liability` — things you owe
- `equity` — owner's stake in the business

---

## Standard Accounts (seeded for every new org)

### Revenue
| Name | Notes |
|---|---|
| Sales — Products | Money from selling physical goods |
| Sales — Services | Money from selling your time or services |
| Other Income | Anything that doesn't fit above |

### Expenses
| Name | Notes |
|---|---|
| Advertising & Marketing | Ads, social media, promotions |
| Bank Fees | Monthly fees, e-transfer fees, wire fees |
| Business Meals & Entertainment | Meals with clients or team (50% deductible in Canada) |
| Contractor & Freelancer Fees | Payments to subcontractors |
| Insurance | Business insurance premiums |
| Interest & Loan Payments | Interest on business loans or lines of credit |
| Office Supplies | Paper, pens, printer ink, small items |
| Professional Fees | Accountant, lawyer, consultant fees |
| Rent & Workspace | Office rent, co-working space |
| Salaries & Wages | Payroll for employees |
| Software & Subscriptions | SaaS tools, apps, licenses |
| Telephone & Internet | Business phone plan, internet bill |
| Travel | Flights, hotels, transportation for business |
| Vehicle & Mileage | Gas, maintenance, parking for business use |
| Utilities | Hydro, gas, water for business space |
| Miscellaneous Expense | One-off items that don't fit elsewhere |

### Assets
| Name | Notes |
|---|---|
| Chequing Account | Primary business bank account |
| Savings Account | Business savings |
| Accounts Receivable | Money customers owe you |

### Liabilities
| Name | Notes |
|---|---|
| Accounts Payable | Bills you owe but haven't paid yet |
| GST/HST Payable | Tax collected that you owe to CRA |
| Credit Card Payable | Business credit card balance |

### Equity
| Name | Notes |
|---|---|
| Owner's Equity | Your ownership stake in the business |
| Owner's Draw | Money you've taken out of the business |
| Retained Earnings | Profits kept in the business |

---

## Conditional Accounts (added during onboarding based on answers)

### If user says: "I carry inventory"
| Name | Type | Notes |
|---|---|---|
| Inventory | asset | Value of stock on hand |
| Cost of Goods Sold | cost_of_goods | Direct cost of items sold |

### If user says: "I put deposits down on rent or other expenses"
| Name | Type | Notes |
|---|---|---|
| Prepaid Expenses | asset | Deposits or payments made before the expense period |

### If user says: "I take prepayments or deposits from customers"
| Name | Type | Notes |
|---|---|---|
| Deferred Revenue | liability | Money received before the work is done |

### If user says: "I have business loans"
| Name | Type | Notes |
|---|---|---|
| Business Loan Payable | liability | Outstanding loan principal |

### If user says: "I own equipment or big assets"
| Name | Type | Notes |
|---|---|---|
| Equipment & Machinery | asset | Major physical assets owned by the business |
| Accumulated Depreciation | asset | Reduction in asset value over time |

---

## Onboarding Questions to Ask (to determine conditional accounts)

Ask these as simple yes/no questions during setup:

1. "Do you sell physical products?"
   → Yes: add Inventory + Cost of Goods Sold

2. "Do you pay deposits ahead of time — like first and last month's rent?"
   → Yes: add Prepaid Expenses

3. "Do customers ever pay you before you've done the work?"
   → Yes: add Deferred Revenue

4. "Do you have any business loans or financing?"
   → Yes: add Business Loan Payable

5. "Do you own equipment, vehicles, or other big assets worth tracking?"
   → Yes: add Equipment & Machinery + Accumulated Depreciation

---

## Seeding Logic (for developer reference)

On org creation:
1. Insert all standard accounts with organization_id
2. For each onboarding answer = yes, insert the corresponding
   conditional accounts
3. Mark all seeded accounts with `is_default: true` so users know
   which ones came pre-loaded vs. ones they created

```sql
-- Account table needs these fields:
id, organization_id, name, type, is_active, is_default, created_at, updated_at
```
