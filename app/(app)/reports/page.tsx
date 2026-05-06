import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BarChart3, Scale, ChevronRight } from 'lucide-react';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { Card, CardBody } from '@/components/ui/Card';

const REPORTS = [
  {
    href: '/reports/profit-loss',
    title: 'Profit & loss',
    description:
      'See what you made, what you spent, and what you kept — for any time period.',
    icon: BarChart3,
  },
  {
    href: '/reports/balance-sheet',
    title: 'Balance sheet',
    description:
      'A snapshot of your cash, what your customers owe, and what you owe — right now.',
    icon: Scale,
  },
];

export default async function ReportsPage() {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
          Reports
        </h1>
        <p className="mt-1 text-brand-ink/70">
          See how the business is doing in plain English.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Link key={r.href} href={r.href} className="block">
              <Card className="hover:bg-surface-muted/40 transition-colors h-full">
                <CardBody>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-heading font-semibold text-brand-ink">
                        {r.title}
                      </h2>
                      <p className="mt-1 text-sm text-brand-ink/70 leading-relaxed">
                        {r.description}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-brand-ink/40 shrink-0 mt-1" />
                  </div>
                </CardBody>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
