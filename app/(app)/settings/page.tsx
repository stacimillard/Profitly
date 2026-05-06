import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, Landmark, Wand2, ChevronRight } from 'lucide-react';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { Card, CardBody } from '@/components/ui/Card';

const SECTIONS = [
  {
    href: '/settings/organization',
    title: 'Business details',
    description:
      'Your business name, GST/HST number, fiscal year, and default tax rate.',
    icon: Building2,
  },
  {
    href: '/settings/bank-accounts',
    title: 'Bank accounts',
    description:
      'The chequing, savings, and credit cards your business uses.',
    icon: Landmark,
  },
  {
    href: '/settings/rules',
    title: 'Categorization rules',
    description:
      'Auto-sort recurring transactions so you never categorize the same vendor twice.',
    icon: Wand2,
  },
];

export default async function SettingsPage() {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
          Settings
        </h1>
        <p className="mt-1 text-brand-ink/70">
          Adjust how Profitly works for your business.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href} className="block">
              <Card className="hover:bg-surface-muted/40 transition-colors h-full">
                <CardBody>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-heading font-semibold text-brand-ink">
                        {s.title}
                      </h2>
                      <p className="mt-1 text-sm text-brand-ink/70 leading-relaxed">
                        {s.description}
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
