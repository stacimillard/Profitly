import { redirect } from 'next/navigation';
import { getCurrentOrganization } from '@/lib/auth/getCurrentOrganization';
import { ExportView } from '@/components/settings/ExportView';

export default async function ExportPage() {
  const ctx = await getCurrentOrganization();
  if (!ctx) redirect('/login');

  return <ExportView />;
}
