import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between">
        <span className="font-heading font-bold text-xl text-brand-ink">
          Profitly
        </span>
        <Link
          href="/login"
          className="text-sm font-medium text-brand-ink hover:text-brand-teal transition-colors"
        >
          Log in
        </Link>
      </header>

      <section className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-xl text-center">
          <h1 className="font-heading font-bold text-4xl sm:text-5xl text-brand-ink leading-tight">
            Your books.
            <br />
            Finally simple.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-brand-ink/70 leading-relaxed">
            Bookkeeping built for Canadian small business owners — not
            accountants. Track your money, sort your receipts, and close your
            books like a CEO.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-brand-teal text-white font-medium hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-surface-border text-brand-ink font-medium hover:bg-surface-muted transition-colors"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      <footer className="px-6 py-6 text-center text-xs text-brand-ink/50">
        © {new Date().getFullYear()} Profitly
      </footer>
    </main>
  );
}
