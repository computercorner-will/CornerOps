import { db } from '@/lib/db';
import { clientMrrCents, revenueConcentration, totalMrrCents } from '@/lib/reconcile';

export interface ClientSummary {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  mrrCents: number;
  deviceCount: number;
  /** Null when the client has no devices. */
  mrrPerDeviceCents: number | null;
  openIssues: number;
}

/** One row per client with MRR and counts. Used by the dashboard and the clients list. */
export async function getClientSummaries(): Promise<ClientSummary[]> {
  const clients = await db.client.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      status: true,
      billingLines: { select: { frequency: true, amountCents: true } },
      _count: { select: { devices: true, issues: { where: { status: 'OPEN' } } } },
    },
  });

  return clients.map((client) => {
    const mrrCents = clientMrrCents(client.billingLines);
    const deviceCount = client._count.devices;
    return {
      id: client.id,
      name: client.name,
      status: client.status,
      mrrCents,
      deviceCount,
      mrrPerDeviceCents: deviceCount > 0 ? Math.round(mrrCents / deviceCount) : null,
      openIssues: client._count.issues,
    };
  });
}

export interface DashboardStats {
  totalMrrCents: number;
  activeClients: number;
  managedDevices: number;
  openIssues: number;
  top1Pct: number;
  top3Pct: number;
}

/** Dashboard totals cover ACTIVE clients only. */
export function computeDashboardStats(summaries: ClientSummary[]): DashboardStats {
  const active = summaries.filter((s) => s.status === 'ACTIVE');
  const mrrs = active.map((s) => s.mrrCents);
  const { top1Pct, top3Pct } = revenueConcentration(mrrs);
  return {
    totalMrrCents: totalMrrCents(mrrs),
    activeClients: active.length,
    managedDevices: active.reduce((sum, s) => sum + s.deviceCount, 0),
    openIssues: summaries.reduce((sum, s) => sum + s.openIssues, 0),
    top1Pct,
    top3Pct,
  };
}
