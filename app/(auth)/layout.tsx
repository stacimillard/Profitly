import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-white flex flex-col">
      <header className="px-6 py-5">
        <Link
          href="/"
          className="font-heading font-bold text-xl text-brand-ink"
        >
          Profitly
        </Link>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </main>
  );
}
