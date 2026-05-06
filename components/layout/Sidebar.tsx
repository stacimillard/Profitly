'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowLeftRight,
  ImageIcon,
  BookCheck,
  CalendarCheck,
  FileText,
  BarChart3,
  Sparkles,
  BookOpen,
  Settings,
  Menu,
  X,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard',         label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/transactions',      label: 'Transactions',    icon: ArrowLeftRight },
  { href: '/receipts',          label: 'Receipts',        icon: ImageIcon },
  { href: '/reconciliations',   label: 'Reconciliations', icon: BookCheck },
  { href: '/month-end-close',   label: 'Month-end close', icon: CalendarCheck },
  { href: '/invoices',          label: 'Invoices',        icon: FileText },
  { href: '/reports',           label: 'Reports',         icon: BarChart3 },
  { href: '/win-journal',       label: 'Win journal',     icon: Sparkles },
  { href: '/accounts',          label: 'Accounts',        icon: BookOpen },
  { href: '/settings',          label: 'Settings',        icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger — only visible when sidebar is closed */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-30 p-2 rounded-lg bg-white border border-surface-border shadow-sm"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5 text-brand-ink" />
        </button>
      )}

      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-surface-border flex flex-col transform transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="px-5 h-16 flex items-center justify-between border-b border-surface-border">
          <Link
            href="/dashboard"
            className="font-heading font-bold text-xl text-brand-ink"
          >
            Profitly
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="lg:hidden p-1.5 rounded-md hover:bg-surface-muted"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-teal/10 text-brand-teal'
                    : 'text-brand-ink/70 hover:bg-surface-muted hover:text-brand-ink'
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${
                    active ? 'text-brand-teal' : 'text-brand-ink/50'
                  }`}
                  aria-hidden
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-3 border-t border-surface-border text-xs text-brand-ink/50">
          Your books. Finally simple.
        </div>
      </aside>
    </>
  );
}
