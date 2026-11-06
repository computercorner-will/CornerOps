import { ClientsTable } from '@/components/clients-table';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getClientSummaries } from '@/lib/client-summaries';

export const metadata = { title: 'Clients' };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const query = q.trim().toLowerCase();
  const summaries = await getClientSummaries();
  const clients = query
    ? summaries.filter((client) => client.name.toLowerCase().includes(query))
    : summaries;

  return (
    <>
      <PageHeader title="Clients" description={`${summaries.length} clients synced from Syncro.`}>
        <form className="flex gap-2" role="search">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search clients…"
            aria-label="Search clients"
            className="w-64"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </PageHeader>
      <Card>
        <CardContent>
          <ClientsTable clients={clients} showStatus />
        </CardContent>
      </Card>
    </>
  );
}
