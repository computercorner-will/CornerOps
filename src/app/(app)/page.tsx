import { ClientsTable } from '@/components/clients-table';
import { MrrChart } from '@/components/mrr-chart';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { computeDashboardStats, getClientSummaries } from '@/lib/client-summaries';
import { formatPercent, formatUsd } from '@/lib/format';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const summaries = await getClientSummaries();
  const stats = computeDashboardStats(summaries);
  const active = summaries.filter((s) => s.status === 'ACTIVE');
  const chartData = [...active]
    .sort((a, b) => b.mrrCents - a.mrrCents)
    .slice(0, 15)
    .map((s) => ({ name: s.name, mrrCents: s.mrrCents }));

  return (
    <>
      <PageHeader
        title="Billing & MRR"
        description="Monthly recurring revenue and billing reconciliation across active clients."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total MRR" value={formatUsd(stats.totalMrrCents)} />
        <StatCard label="Active clients" value={String(stats.activeClients)} />
        <StatCard label="Managed devices" value={String(stats.managedDevices)} />
        <StatCard label="Open issues" value={String(stats.openIssues)} />
        <StatCard
          label="Top client concentration"
          value={formatPercent(stats.top1Pct)}
          hint={`Top 3 clients: ${formatPercent(stats.top3Pct)} of MRR`}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>MRR by client (top 15)</CardTitle>
        </CardHeader>
        <CardContent>
          <MrrChart data={chartData} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>All clients</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientsTable clients={active} />
        </CardContent>
      </Card>
    </>
  );
}
