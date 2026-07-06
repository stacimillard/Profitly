'use client';

import { useState } from 'react';
import { ArrowLeftRight, BookOpen, BarChart3, Download } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function defaultDateRange() {
  const now = new Date();
  const year = now.getFullYear();
  const start = `${year}-01-01`;
  const end = now.toISOString().slice(0, 10);
  return { start, end };
}

export function ExportView() {
  const range = defaultDateRange();
  const [start, setStart] = useState(range.start);
  const [end, setEnd] = useState(range.end);
  const [pnlError, setPnlError] = useState<string | null>(null);

  function download(url: string) {
    const link = document.createElement('a');
    link.href = url;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function downloadPnL() {
    setPnlError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      setPnlError('Please pick a valid start and end date.');
      return;
    }
    if (end < start) {
      setPnlError('End date must be on or after start date.');
      return;
    }
    download(
      `/api/export/profit-loss?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-3xl text-brand-ink leading-tight">
          Export your data
        </h1>
        <p className="mt-1 text-brand-ink/70">
          Download your books as CSV files you can open in Excel, Google Sheets,
          or hand to your accountant.
        </p>
      </div>

      <Card>
        <CardBody>
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal shrink-0">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-heading font-semibold text-brand-ink">
                All transactions
              </h2>
              <p className="mt-1 text-sm text-brand-ink/70">
                Every transaction on your books, including the category, bank
                account, tax details, and notes.
              </p>
            </div>
            <Button onClick={() => download('/api/export/transactions')}>
              <Download className="h-4 w-4" aria-hidden />
              Download CSV
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal shrink-0">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-heading font-semibold text-brand-ink">
                Chart of accounts
              </h2>
              <p className="mt-1 text-sm text-brand-ink/70">
                Your full list of income, expense, and balance-sheet accounts.
              </p>
            </div>
            <Button onClick={() => download('/api/export/accounts')}>
              <Download className="h-4 w-4" aria-hidden />
              Download CSV
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal shrink-0">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-heading font-semibold text-brand-ink">
                Profit & Loss report
              </h2>
              <p className="mt-1 text-sm text-brand-ink/70">
                Pick a date range and download revenue, cost of goods, and
                expenses grouped by category.
              </p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                <Input
                  type="date"
                  label="Start date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
                <Input
                  type="date"
                  label="End date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
              {pnlError && (
                <p className="mt-2 text-sm text-red-600">{pnlError}</p>
              )}
              <div className="mt-4">
                <Button onClick={downloadPnL}>
                  <Download className="h-4 w-4" aria-hidden />
                  Download P&L CSV
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
