import { redirect, notFound } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { OrganizationSettingsView } from '@/components/settings/OrganizationSettingsView';
import type { Organization } from '@/lib/types';

export default async function OrganizationSettingsPage() {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const supabase = await createClient();
  const { data } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', ctx.organizationId)
    .maybeSingle();

  if (!data) notFound();

  return (
    <OrganizationSettingsView organization={data as Organization} />
  );
}
