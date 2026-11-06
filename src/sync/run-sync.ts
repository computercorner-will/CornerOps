import { writeAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { runReconciliation, type ReconciliationSummary } from '@/lib/run-reconciliation';
import { getIntegrations, type Integrations } from '@/integrations';
import type { SyncSource } from '@/generated/prisma/enums';

/**
 * Pulls data from the integrations into the database.
 * - Read-only towards Syncro/Pax8: we only call list methods.
 * - Idempotent: every row is upserted on its external ID, so reruns never duplicate.
 * - Each source gets its own SyncRun row and audit entry.
 * Used by `pnpm sync` (scripts/sync.ts), the admin "Run sync" button and the seed.
 */

export interface SourceResult {
  source: SyncSource;
  status: 'SUCCESS' | 'FAILED';
  recordsRead: number;
  error?: string;
}

export interface SyncResult {
  mode: Integrations['mode'];
  sources: SourceResult[];
  reconciliation: ReconciliationSummary | null;
}

/** A RUNNING sync younger than this blocks a new one (protects against double clicks). */
const STALE_RUN_MS = 15 * 60 * 1000;
const TX_OPTIONS = { timeout: 120_000, maxWait: 10_000 };

export class SyncAlreadyRunningError extends Error {
  constructor() {
    super('A sync is already running. Try again in a few minutes.');
    this.name = 'SyncAlreadyRunningError';
  }
}

const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

/** Error text safe to store: our integration errors never include secrets; cap the length. */
const errorText = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 1000);

export async function runSync(
  userId: string | null,
  integrations: Integrations = getIntegrations(),
): Promise<SyncResult> {
  const running = await db.syncRun.findFirst({
    where: { status: 'RUNNING', startedAt: { gt: new Date(Date.now() - STALE_RUN_MS) } },
  });
  if (running) throw new SyncAlreadyRunningError();

  const sources = [
    await runSource('SYNCRO', userId, () => syncSyncro(integrations)),
    await runSource('PAX8', userId, () => syncPax8(integrations)),
  ];

  const anySuccess = sources.some((s) => s.status === 'SUCCESS');
  const reconciliation = anySuccess ? await runReconciliation(userId) : null;

  return { mode: integrations.mode, sources, reconciliation };
}

async function runSource(
  source: SyncSource,
  userId: string | null,
  work: () => Promise<{ recordsRead: number; summary: Record<string, number> }>,
): Promise<SourceResult> {
  const run = await db.syncRun.create({ data: { source } });
  try {
    const { recordsRead, summary } = await work();
    await db.syncRun.update({
      where: { id: run.id },
      data: { status: 'SUCCESS', finishedAt: new Date(), recordsRead },
    });
    await writeAudit({
      userId,
      action: 'sync.success',
      entity: 'SyncRun',
      entityId: run.id,
      after: { source, recordsRead, ...summary },
    });
    return { source, status: 'SUCCESS', recordsRead };
  } catch (error) {
    const message = errorText(error);
    await db.syncRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', finishedAt: new Date(), error: message },
    });
    await writeAudit({
      userId,
      action: 'sync.failed',
      entity: 'SyncRun',
      entityId: run.id,
      after: { source, error: message },
    });
    return { source, status: 'FAILED', recordsRead: 0, error: message };
  }
}

// ---------------------------------------------------------------------------
// Syncro: customers -> Client, assets -> Device, recurring invoices -> BillingLine
// ---------------------------------------------------------------------------

async function syncSyncro({ syncro }: Integrations) {
  // Fetch everything first so a failed API call never leaves a half-written sync.
  const [customers, assets, schedules] = await Promise.all([
    syncro.listCustomers(),
    syncro.listAssets(),
    syncro.listRecurringInvoices(),
  ]);

  return db.$transaction(async (tx) => {
    const clientIdBySyncroId = new Map<string, string>();
    for (const customer of customers) {
      const status = customer.disabled ? 'INACTIVE' : 'ACTIVE';
      const client = await tx.client.upsert({
        where: { syncroCustomerId: customer.id },
        create: {
          syncroCustomerId: customer.id,
          name: customer.businessName,
          status,
          notes: customer.notes,
        },
        // Notes are CornerOps-owned after creation, so they are not overwritten.
        update: { name: customer.businessName, status },
      });
      clientIdBySyncroId.set(customer.id, client.id);
    }

    let devicesSkipped = 0;
    const seenAssetIds: string[] = [];
    for (const asset of assets) {
      const clientId = clientIdBySyncroId.get(asset.customerId);
      if (!clientId) {
        devicesSkipped++;
        continue;
      }
      const data = {
        clientId,
        name: asset.name,
        deviceType: asset.assetType,
        lastSeenAt: asset.lastSeenAt,
      };
      await tx.device.upsert({
        where: { syncroAssetId: asset.id },
        create: { syncroAssetId: asset.id, ...data },
        update: data,
      });
      seenAssetIds.push(asset.id);
    }
    // Devices removed from Syncro are removed here too (local copy only).
    const devicesRemoved = await tx.device.deleteMany({
      where: { syncroAssetId: { notIn: seenAssetIds } },
    });

    const seenLineIds: string[] = [];
    for (const schedule of schedules) {
      const clientId = clientIdBySyncroId.get(schedule.customerId);
      if (!clientId || !schedule.active || schedule.frequency === 'OTHER') continue;
      for (const line of schedule.lines) {
        const externalId = `syncro-line:${line.id}`;
        const data = {
          clientId,
          description: line.name,
          sku: line.sku,
          source: 'SYNCRO' as const,
          frequency: schedule.frequency,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          amountCents: line.quantity * line.unitPriceCents,
        };
        await tx.billingLine.upsert({
          where: { externalId },
          create: { externalId, ...data },
          update: data,
        });
        seenLineIds.push(externalId);
      }
    }
    // Syncro lines that disappeared (schedule removed/paused). MANUAL lines are untouched.
    const linesRemoved = await tx.billingLine.deleteMany({
      where: { source: 'SYNCRO', externalId: { notIn: seenLineIds } },
    });

    return {
      recordsRead: customers.length + assets.length + schedules.length,
      summary: {
        customers: customers.length,
        devices: seenAssetIds.length,
        devicesSkipped,
        devicesRemoved: devicesRemoved.count,
        billingLines: seenLineIds.length,
        billingLinesRemoved: linesRemoved.count,
      },
    };
  }, TX_OPTIONS);
}

// ---------------------------------------------------------------------------
// Pax8: companies -> Client.pax8CompanyId, subscriptions -> LicenseSubscription
// ---------------------------------------------------------------------------

async function syncPax8({ pax8 }: Integrations) {
  const [companies, subscriptions] = await Promise.all([
    pax8.listCompanies(),
    pax8.listSubscriptions(),
  ]);

  return db.$transaction(async (tx) => {
    const clients = await tx.client.findMany({
      select: { id: true, name: true, pax8CompanyId: true },
    });
    const byPax8Id = new Map<string, string>();
    for (const client of clients) {
      if (client.pax8CompanyId) byPax8Id.set(client.pax8CompanyId, client.id);
    }
    const byName = new Map(clients.map((client) => [normalizeName(client.name), client]));

    // Link companies to clients: by stored Pax8 ID, otherwise by exact (normalized) name.
    const clientIdByCompanyId = new Map<string, string>();
    let companiesUnmatched = 0;
    for (const company of companies) {
      const linked = byPax8Id.get(company.id);
      if (linked) {
        clientIdByCompanyId.set(company.id, linked);
        continue;
      }
      const match = byName.get(normalizeName(company.name));
      if (match && !match.pax8CompanyId) {
        await tx.client.update({ where: { id: match.id }, data: { pax8CompanyId: company.id } });
        match.pax8CompanyId = company.id;
        clientIdByCompanyId.set(company.id, match.id);
      } else {
        companiesUnmatched++;
      }
    }

    const seenIds: string[] = [];
    for (const subscription of subscriptions) {
      const clientId = clientIdByCompanyId.get(subscription.companyId);
      if (!clientId || subscription.status.toLowerCase() !== 'active') continue;
      const data = {
        clientId,
        productName: subscription.productName,
        sku: subscription.sku,
        quantity: subscription.quantity,
        unitCostCents: subscription.unitCostCents,
        billingTerm: subscription.billingTerm,
      };
      await tx.licenseSubscription.upsert({
        where: { externalId: subscription.id },
        create: { externalId: subscription.id, source: 'PAX8', ...data },
        update: data,
      });
      seenIds.push(subscription.id);
    }
    const removed = await tx.licenseSubscription.deleteMany({
      where: { externalId: { notIn: seenIds } },
    });

    return {
      recordsRead: companies.length + subscriptions.length,
      summary: {
        companies: companies.length,
        companiesUnmatched,
        subscriptions: seenIds.length,
        subscriptionsRemoved: removed.count,
      },
    };
  }, TX_OPTIONS);
}
