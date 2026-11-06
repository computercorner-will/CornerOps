import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { db } from '@/lib/db';
import { formatDate, formatDateTime, formatUsd, humanize } from '@/lib/format';
import { describeIssue, ISSUE_TYPE_LABELS } from '@/lib/issues';
import { clientMrrCents } from '@/lib/reconcile';

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await db.client.findUnique({
    where: { id },
    include: {
      billingLines: { orderBy: [{ frequency: 'asc' }, { description: 'asc' }] },
      licenses: { orderBy: { productName: 'asc' } },
      devices: { orderBy: { name: 'asc' } },
      issues: { orderBy: { createdAt: 'desc' }, include: { resolvedBy: true } },
    },
  });
  if (!client) notFound();

  const issueIds = client.issues.map((issue) => issue.id);
  const activity = await db.auditLog.findMany({
    where: {
      OR: [
        { entity: 'Client', entityId: client.id },
        { entity: 'ReconciliationIssue', entityId: { in: issueIds } },
      ],
    },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const mrr = clientMrrCents(client.billingLines);
  const openIssues = client.issues.filter((issue) => issue.status === 'OPEN').length;

  return (
    <>
      <PageHeader title={client.name} description={client.industry ?? undefined}>
        <Badge variant={client.status === 'ACTIVE' ? 'success' : 'secondary'}>
          {humanize(client.status)}
        </Badge>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="MRR" value={formatUsd(mrr)} />
        <StatCard label="Devices" value={String(client.devices.length)} />
        <StatCard label="Open issues" value={String(openIssues)} />
      </div>

      {client.notes && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
          </CardContent>
        </Card>
      )}

      <Section title="Billing lines">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {client.billingLines.length === 0 && <EmptyRow colSpan={7} />}
            {client.billingLines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>{line.description}</TableCell>
                <TableCell className="text-muted-foreground">{line.sku ?? '—'}</TableCell>
                <TableCell>{humanize(line.source)}</TableCell>
                <TableCell>{humanize(line.frequency)}</TableCell>
                <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatUsd(line.unitPriceCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatUsd(line.amountCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Licenses (Pax8)">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Term</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {client.licenses.length === 0 && <EmptyRow colSpan={5} />}
            {client.licenses.map((license) => (
              <TableRow key={license.id}>
                <TableCell>{license.productName}</TableCell>
                <TableCell className="text-muted-foreground">{license.sku}</TableCell>
                <TableCell>{license.billingTerm}</TableCell>
                <TableCell className="text-right tabular-nums">{license.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatUsd(license.unitCostCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Issues">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {client.issues.length === 0 && <EmptyRow colSpan={4} />}
            {client.issues.map((issue) => (
              <TableRow key={issue.id}>
                <TableCell className="whitespace-nowrap">{ISSUE_TYPE_LABELS[issue.type]}</TableCell>
                <TableCell className="whitespace-normal">
                  {describeIssue(issue.type, issue.details)}
                  {issue.note && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Note{issue.resolvedBy ? ` (${issue.resolvedBy.email})` : ''}: {issue.note}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={issue.status === 'OPEN' ? 'warning' : 'secondary'}>
                    {humanize(issue.status)}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(issue.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-3 text-sm">
          <Link href="/issues" className="text-muted-foreground hover:underline">
            Go to the issue queue →
          </Link>
        </p>
      </Section>

      <Section title={`Devices (${client.devices.length})`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Syncro asset ID</TableHead>
              <TableHead>Last seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {client.devices.length === 0 && <EmptyRow colSpan={4} />}
            {client.devices.map((device) => (
              <TableRow key={device.id}>
                <TableCell>{device.name}</TableCell>
                <TableCell>{device.deviceType ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{device.syncroAssetId}</TableCell>
                <TableCell>{formatDate(device.lastSeenAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Activity">
        {activity.length === 0 ? (
          <p className="text-muted-foreground text-sm">No activity recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {activity.map((entry) => (
              <li key={entry.id} className="flex flex-wrap gap-x-3">
                <span className="text-muted-foreground tabular-nums">
                  {formatDateTime(entry.createdAt)}
                </span>
                <span className="font-medium">{entry.action}</span>
                <span className="text-muted-foreground">by {entry.user?.email ?? 'system'}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-muted-foreground py-4 text-center">
        None
      </TableCell>
    </TableRow>
  );
}
