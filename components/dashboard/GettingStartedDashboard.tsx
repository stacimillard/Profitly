import Link from 'next/link';
import {
  Landmark,
  Upload,
  Tag,
  CalendarCheck,
  CheckCircle2,
  Circle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import type { GettingStartedState } from '@/lib/dashboard/queries';

interface Props {
  firstName: string;
  state: GettingStartedState;
}

interface Step {
  key: string;
  icon: LucideIcon;
  title: string;
  description: string;
  cta: string;
  href: string;
  done: boolean;
}

export function GettingStartedDashboard({ firstName, state }: Props) {
  const steps: Step[] = [
    {
      key: 'bank',
      icon: Landmark,
      title: 'Add your first bank account',
      description:
        'Tell Profitly which account or credit card you use for the business. This is the home for the transactions you’ll bring in next.',
      cta: state.has_bank_account ? 'Manage accounts' : 'Add a bank account',
      href: '/settings/bank-accounts',
      done: state.has_bank_account,
    },
    {
      key: 'import',
      icon: Upload,
      title: 'Import your transactions',
      description:
        'Upload a CSV or PDF statement from your bank. We’ll read it and let you review every line before anything is saved.',
      cta: state.has_transactions ? 'Import more' : 'Import transactions',
      href: '/transactions/import',
      done: state.has_transactions,
    },
    {
      key: 'categorize',
      icon: Tag,
      title: 'Categorize what came in',
      description:
        state.uncategorized_count > 0
          ? `Give each transaction a category so your reports make sense. You have ${state.uncategorized_count} waiting.`
          : 'Give each transaction a category so your reports make sense.',
      cta:
        state.uncategorized_count > 0
          ? 'Sort these out'
          : 'Open transactions',
      href:
        state.uncategorized_count > 0
          ? '/transactions?status=uncategorized'
          : '/transactions',
      done:
        state.has_categorized_transactions && state.uncategorized_count === 0,
    },
    {
      key: 'close',
      icon: CalendarCheck,
      title: 'Close your first month',
      description:
        'Once a month is squared away, lock it in. After your first close, your dashboard will show real profit numbers and trends.',
      cta: 'Start month-end close',
      href: '/month-end-close',
      done: state.closed_months_count > 0,
    },
  ];

  const nextStepIndex = steps.findIndex((s) => !s.done);
  const activeIndex = nextStepIndex === -1 ? steps.length - 1 : nextStepIndex;
  const doneCount = steps.filter((s) => s.done).length;
  const totalSteps = steps.length;
  const progressPct = Math.round((doneCount / totalSteps) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
          Welcome, {firstName}. Let&apos;s set you up.
        </h1>
        <p className="mt-1 text-brand-ink/70 max-w-2xl">
          Your dashboard will start showing real numbers once you close your
          first month. Until then, here&apos;s the path to get there.
        </p>
      </div>

      <Card>
        <CardBody className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand-orange" aria-hidden />
              <span className="font-heading font-semibold text-brand-ink">
                Getting started
              </span>
            </div>
            <span className="text-sm text-brand-ink/70">
              {doneCount} of {totalSteps} done
            </span>
          </div>
          <div
            className="mt-3 h-2 w-full rounded-full bg-surface-muted overflow-hidden"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-brand-teal transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </CardBody>
      </Card>

      <ol className="space-y-3">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === activeIndex && !step.done;
          const isLocked = idx > activeIndex && !step.done;

          return (
            <li key={step.key}>
              <Card
                className={
                  isActive
                    ? 'ring-2 ring-brand-teal/40'
                    : isLocked
                      ? 'opacity-70'
                      : ''
                }
              >
                <CardBody className="px-6 py-5">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex-shrink-0 h-11 w-11 rounded-full flex items-center justify-center ${
                        step.done
                          ? 'bg-brand-teal/15 text-brand-teal'
                          : isActive
                            ? 'bg-brand-orange/15 text-brand-orange'
                            : 'bg-surface-muted text-brand-ink/50'
                      }`}
                      aria-hidden
                    >
                      {step.done ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : (
                        <Icon className="h-6 w-6" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-brand-ink/50">
                          Step {idx + 1}
                        </span>
                        {step.done && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-teal">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Done
                          </span>
                        )}
                      </div>
                      <h3 className="mt-0.5 font-heading font-semibold text-brand-ink">
                        {step.title}
                      </h3>
                      <p className="mt-1 text-sm text-brand-ink/70 leading-relaxed">
                        {step.description}
                      </p>
                      <div className="mt-3">
                        <Link
                          href={step.href}
                          className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                            isActive
                              ? 'text-brand-teal hover:underline'
                              : 'text-brand-ink/70 hover:text-brand-ink hover:underline'
                          }`}
                        >
                          {step.cta}
                          <ArrowRight className="h-4 w-4" aria-hidden />
                        </Link>
                      </div>
                    </div>
                    <div className="hidden sm:flex flex-shrink-0 items-center">
                      {step.done ? (
                        <CheckCircle2
                          className="h-5 w-5 text-brand-teal"
                          aria-hidden
                        />
                      ) : (
                        <Circle
                          className="h-5 w-5 text-brand-ink/20"
                          aria-hidden
                        />
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            </li>
          );
        })}
      </ol>

      <Card variant="muted">
        <CardBody className="px-6 py-5">
          <h3 className="font-heading font-semibold text-brand-ink">
            Why no numbers yet?
          </h3>
          <p className="mt-1 text-sm text-brand-ink/70 leading-relaxed max-w-2xl">
            Before your first month is closed, the totals you&apos;d see here
            could be misleading — transactions may be missing, miscategorized, or
            partially imported. We&apos;ll switch this dashboard on the moment
            you complete your first month-end close.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
