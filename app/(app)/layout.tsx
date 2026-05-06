import { redirect } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, onboarding_completed')
    .eq('id', ctx.organizationId)
    .single();

  if (!org) redirect('/login');
  if (!org.onboarding_completed) redirect('/welcome');

  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <div className="lg:pl-60">
        <Header
          orgName={org.name}
          userName={ctx.profile.full_name}
          userEmail={ctx.profile.email}
        />
        <main className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
