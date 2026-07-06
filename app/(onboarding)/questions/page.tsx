import { redirect } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';

export default async function QuestionsPage() {
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

  return <OnboardingFlow businessName={org?.name ?? 'your business'} />;
}
