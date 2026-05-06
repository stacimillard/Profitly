'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

interface Props {
  startDate: string;
  endDate: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function DateRangePicker({ startDate, endDate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(start: string, end: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('start', start);
    params.set('end', end);
    router.push(`${pathname}?${params.toString()}`);
  }

  function presetThisMonth() {
    const now = new Date();
    update(
      isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      isoDate(now)
    );
  }
  function presetLastMonth() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    update(isoDate(start), isoDate(end));
  }
  function presetYTD() {
    const now = new Date();
    update(isoDate(new Date(now.getFullYear(), 0, 1)), isoDate(now));
  }
  function presetLastYear() {
    const now = new Date();
    update(
      isoDate(new Date(now.getFullYear() - 1, 0, 1)),
      isoDate(new Date(now.getFullYear() - 1, 11, 31))
    );
  }

  return (
    <Card>
      <div className="px-4 py-3 flex flex-wrap items-end gap-3">
        <div className="grid grid-cols-2 gap-3 flex-1 min-w-[260px]">
          <Input
            label="From"
            type="date"
            value={startDate}
            onChange={(e) => update(e.target.value, endDate)}
          />
          <Input
            label="To"
            type="date"
            value={endDate}
            onChange={(e) => update(startDate, e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={presetThisMonth}
            className="px-3 py-1.5 rounded-full text-sm font-medium bg-surface-muted hover:bg-surface-border text-brand-ink/80"
          >
            This month
          </button>
          <button
            type="button"
            onClick={presetLastMonth}
            className="px-3 py-1.5 rounded-full text-sm font-medium bg-surface-muted hover:bg-surface-border text-brand-ink/80"
          >
            Last month
          </button>
          <button
            type="button"
            onClick={presetYTD}
            className="px-3 py-1.5 rounded-full text-sm font-medium bg-surface-muted hover:bg-surface-border text-brand-ink/80"
          >
            Year to date
          </button>
          <button
            type="button"
            onClick={presetLastYear}
            className="px-3 py-1.5 rounded-full text-sm font-medium bg-surface-muted hover:bg-surface-border text-brand-ink/80"
          >
            Last year
          </button>
        </div>
      </div>
    </Card>
  );
}
