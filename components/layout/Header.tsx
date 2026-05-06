'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface HeaderProps {
  orgName: string;
  userName: string | null;
  userEmail: string;
}

export function Header({ orgName, userName, userEmail }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const firstName = userName?.split(' ')[0] || 'there';
  const initial = (firstName[0] || '?').toUpperCase();

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-surface-border">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="hidden lg:flex items-baseline gap-2">
          <span className="font-heading font-semibold text-brand-ink">
            Hi, {firstName}.
          </span>
          <span className="text-sm text-brand-ink/60">{orgName}</span>
        </div>
        {/* Mobile spacer so the avatar floats right while hamburger is on the left */}
        <div className="lg:hidden" />

        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-muted"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <div className="h-8 w-8 rounded-full bg-brand-teal/15 flex items-center justify-center text-brand-teal font-medium">
              {initial}
            </div>
            <ChevronDown
              className="h-4 w-4 text-brand-ink/60"
              aria-hidden
            />
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-60 rounded-lg border border-surface-border bg-white shadow-lg overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-surface-border">
                <div className="font-medium text-brand-ink truncate">
                  {userName || firstName}
                </div>
                <div className="text-sm text-brand-ink/60 truncate">
                  {userEmail}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 text-brand-ink hover:bg-surface-muted"
                role="menuitem"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
