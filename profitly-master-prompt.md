# Profitly — Master Opening Prompt

Use this exact prompt at the start of a new Claude Cowork session 
to kick off the Profitly build.

---

## THE PROMPT

I'm building Profitly — a SaaS bookkeeping app for Canadian small business 
owners who are not accountants. I'm not a developer, so I need you to write 
every file completely so I can copy and paste it directly into my code editor.

I've attached three reference documents:
- profitly-brand.md — tone of voice, colours, fonts, UI style
- profitly-tech-stack.md — full tech stack, conventions, project structure
- profitly-chart-of-accounts.md — default accounts to seed on signup

Please read all three documents before writing any code.

**The rules for how we work:**
- Give me one file at a time so I can copy and paste it
- Wait for me to say "Done" before moving to the next file
- Never give me integration instructions — just the complete file
- When you give me a file, tell me exactly where in my project to put it
- If you need to update a file I've already built, give me the full 
  replacement — not just the changed lines
- Never assume I know what something means — explain it simply

**Before writing any code, I need you to:**
1. Confirm you've read all three documents
2. Give me a complete build plan broken into phases, listing every file 
   we'll create in order
3. Write the complete database schema as a single SQL migration file 
   covering every table the entire app will need
4. Wait for me to approve the plan and schema before writing anything else

**The app:**
- Canadian small business bookkeeping
- Multi-tenant (each business has its own account)
- Login/signup with email and password
- Features: transactions, receipts, bank reconciliation, month-end close, 
  invoicing, reports, categorization rules, AI-assisted categorization
- Tone: friendly, plain language, empowering — like a financial BFF
- UI: clean white design, teal primary colour (#00d2d4), Montserrat + Inter fonts
- Deploy to Vercel, database on Supabase

**Tech stack:**
- Next.js 15 App Router
- TypeScript
- Supabase (auth + database)
- Tailwind CSS
- Lucide React icons
- Anthropic Claude API for AI features
- Vercel for deployment

Let's start with the build plan.
