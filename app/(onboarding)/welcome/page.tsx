import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';

export default async function WelcomePage() {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('name, onboarding_completed')
    .eq('id', ctx.organizationId)
    .single();

  if (org?.onboarding_completed) {
    redirect('/dashboard');
  }

  const firstName = ctx.profile.full_name?.split(' ')[0] || 'there';

  return (
    <div className="text-center">
      <h1 className="font-heading font-bold text-4xl text-brand-ink leading-tight">
        You&apos;re in, {firstName}.
      </h1>
      <p className="mt-4 text-lg text-brand-ink/70 leading-relaxed">
        We&apos;ll set up your books for{' '}
        <span className="font-medium text-brand-ink">{org?.name}</span> in a few
        quick steps. Answer as you go — anything you skip you can come back to.
      </p>
      <p className="mt-2 text-sm text-brand-ink/60">Takes about 2 minutes.</p>
      <Link
        href="/questions"
        className="mt-8 inline-flex items-center justify-center px-6 py-3 rounded-lg bg-brand-teal text-white font-medium hover:opacity-90 transition-opacity"
      >
        Let&apos;s go
      </Link>
    </div>
  );
}
