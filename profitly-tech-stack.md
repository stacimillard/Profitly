# Profitly — Tech Stack & Architecture Guide

## Overview
Profitly is a multi-tenant Canadian small business bookkeeping SaaS. 
Each business (organization) has its own isolated data. Users can belong 
to one organization.

---

## Core Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Deployment | Vercel |
| AI | Anthropic Claude API (claude-3-5-haiku) |
| Fonts | Google Fonts — Montserrat + Inter |

---

## Project Structure

```
app/
  (auth)/              # Login, signup pages (no sidebar)
  (app)/               # All protected pages (with sidebar)
    dashboard/
    transactions/
    receipts/
    reconciliations/
    month-end-close/
    accounts/
    reports/
    invoices/
    settings/
      rules/           # Categorization rules engine
  api/                 # All API routes
    accounts/
    transactions/
    bank-accounts/
    receipts/
    reconciliations/
    month-end-close/
    closed-months/
    win-journal/
    categorization-rules/
    ai-categorize/
    invoices/
    reports/

components/
  layout/
    Sidebar.tsx
    Header.tsx
  ui/                  # Shared UI components
  RuleSuggestionBanner.tsx

supabase/
  migrations/          # Numbered SQL migration files
```

---

## Database Conventions

- Every table has: `id` (uuid, default gen_random_uuid()),
  `created_at` (timestamptz, default now()),
  `updated_at` (timestamptz, default now())
- Every table has: `organization_id` (uuid, FK to organizations)
- Row Level Security (RLS) enabled on every table
- RLS policy: users can only access rows where organization_id matches 
  their own organization
- updated_at is maintained by a trigger (reusable trigger function)
- All amounts stored in cents as integers (e.g. $12.50 = 1250)
  — EXCEPTION: display layer converts to dollars for UI

## Auth & Multi-tenancy

- Auth: Supabase Auth (email/password)
- On signup: create organization → create profile linking user to org
- `profiles` table: id (= auth.user id), organization_id, full_name, email
- All API routes: get user from supabase auth, get organization_id from 
  profiles, scope all queries by organization_id
- Never trust organization_id from the client — always derive from the 
  authenticated user's profile on the server

---

## API Conventions

- All routes in `app/api/`
- Use Supabase server client (createClient from @/lib/supabase/server)
- Standard response shape:
  - Success: `{ data }` with HTTP 200
  - Error: `{ error: 'message' }` with appropriate HTTP status
- GET routes support query params for filtering
- Always check for authenticated user at top of every route handler
- Amounts: store as cents (integer), return as cents, convert in UI

---

## Key Business Logic

### Canadian Tax
- GST/HST is tracked but NOT auto-calculated in MVP
- Transactions can be flagged as tax-deductible
- CRA receipt threshold: $30 for most expenses, $150 for meals/entertainment

### Fiscal Year
- Default: January–December (calendar year)
- Month-end close locks a month permanently (can be reopened by user)

### Transaction Status Flow
uncategorized → categorized → (reconciled via reconciliation match)

### Categorization Priority (highest to lowest)
1. Manual categorization by user
2. Categorization rules engine (auto-applies on import)
3. AI suggestion (user must approve)

### Reconciliation
- User imports bank statement CSV
- System matches transactions to bank statement lines
- Matched = reconciled
- Unmatched on either side = flagged for review

---

## Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

---

## Coding Conventions

- 'use client' only when needed (forms, state, interactivity)
- API routes are always server-side (never 'use client')
- Shared logic (like normalizeVendor) lives in the API route file 
  that owns it and is imported by other routes that need it
- No ORMs — use Supabase JS client directly
- TypeScript interfaces defined at top of each file
- Tailwind only for styling — no CSS modules, no styled-components
- All monetary display: divide cents by 100, use toLocaleString('en-CA', 
  { style: 'currency', currency: 'CAD' })

---

## Packages to Install

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install @anthropic-ai/sdk
npm install lucide-react
npm install react-dropzone
npm install date-fns
```

---

## Vercel Deployment Notes

- All environment variables must be added in Vercel project settings
- Supabase redirect URLs must include the Vercel production domain
- API routes run as serverless functions — no persistent state
