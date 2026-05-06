import { redirect } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { createClient } from '@/lib/supabase/server';
import {
  RulesView,
  type RuleWithAccount,
} from '@/components/rules/RulesView';
import type { Account } from '@/lib/types';

export default async function RulesPage() {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  const supabase = await createClient();

  const { data: rules } = await supabase
    .from('categorization_rules')
    .select('*, accounts:account_id(name, type)')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('is_active', true)
    .order('type', { ascending: true })
    .order('name', { ascending: true });

  return (
    <RulesView
      initialRules={(rules as RuleWithAccount[]) ?? []}
      accounts={(accounts as Account[]) ?? []}
    />
  );
}
