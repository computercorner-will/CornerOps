import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { db } from '@/lib/db';
import { canEdit } from '@/lib/roles';
import { requireUser } from '@/lib/session';
import { CsvImport } from './csv-import';
import { ProspectsTable, type ProspectView } from './prospects-table';

export const metadata = { title: 'Prospects' };

export default async function ProspectsPage() {
  const user = await requireUser();
  const prospects = await db.prospect.findMany({ orderBy: { company: 'asc' } });
  const editable = canEdit(user.role);

  // Dates are passed to the client component as YYYY-MM-DD strings (UTC).
  const rows: ProspectView[] = prospects.map((p) => ({
    id: p.id,
    company: p.company,
    segment: p.segment,
    area: p.area,
    phone: p.phone,
    website: p.website,
    priority: p.priority,
    status: p.status,
    owner: p.owner,
    lastContact: p.lastContactAt ? p.lastContactAt.toISOString().slice(0, 10) : '',
    nextStep: p.nextStep,
    notes: p.notes,
  }));

  return (
    <>
      <PageHeader title="Prospects" description="Sales pipeline for new managed-services clients.">
        {editable && <CsvImport />}
      </PageHeader>
      <Card>
        <CardContent>
          <ProspectsTable prospects={rows} editable={editable} />
        </CardContent>
      </Card>
    </>
  );
}
