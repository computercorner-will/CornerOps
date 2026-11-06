import { env } from '@/env';
import { writeAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { detectClientIssues, planIssueChanges, type DetectedIssue } from '@/lib/reconcile';

export interface ReconciliationSummary {
  created: number;
  updated: number;
  autoResolved: number;
}

/**
 * Loads active clients, runs the pure reconciliation rules and applies the resulting plan.
 * Safe to rerun: open issues are updated rather than duplicated.
 */
export async function runReconciliation(userId: string | null): Promise<ReconciliationSummary> {
  const [clients, mappings, existing] = await Promise.all([
    db.client.findMany({
      where: { status: 'ACTIVE' },
      include: {
        billingLines: true,
        licenses: true,
        _count: { select: { devices: true } },
      },
    }),
    db.skuMapping.findMany(),
    db.reconciliationIssue.findMany({
      where: { status: { in: ['OPEN', 'IGNORED'] } },
      select: { id: true, clientId: true, type: true, key: true, status: true },
    }),
  ]);

  const detected: DetectedIssue[] = clients.flatMap((client) =>
    detectClientIssues(
      {
        clientId: client.id,
        billingLines: client.billingLines,
        licenses: client.licenses,
        deviceCount: client._count.devices,
      },
      { mappings, priceFloorPerDeviceCents: env.PRICE_FLOOR_PER_DEVICE_CENTS },
    ),
  );

  // Existing issues cover every client, so open issues of a client that became inactive
  // are auto-resolved too (they are no longer detected).
  const plan = planIssueChanges(detected, existing);
  const now = new Date();

  await db.$transaction(async (tx) => {
    for (const issue of plan.create) {
      await tx.reconciliationIssue.create({
        data: {
          clientId: issue.clientId,
          type: issue.type,
          key: issue.key,
          details: issue.details,
        },
      });
    }
    for (const change of plan.update) {
      await tx.reconciliationIssue.update({
        where: { id: change.id },
        data: { details: change.details },
      });
    }
    if (plan.autoResolve.length > 0) {
      await tx.reconciliationIssue.updateMany({
        where: { id: { in: plan.autoResolve }, status: 'OPEN' },
        data: {
          status: 'RESOLVED',
          resolvedAt: now,
          note: 'Automatically resolved: no longer detected by reconciliation.',
        },
      });
    }

    await writeAudit(
      {
        userId,
        action: 'reconciliation.run',
        entity: 'ReconciliationIssue',
        after: {
          created: plan.create.length,
          updated: plan.update.length,
          autoResolved: plan.autoResolve,
        },
      },
      tx,
    );
  });

  return {
    created: plan.create.length,
    updated: plan.update.length,
    autoResolved: plan.autoResolve.length,
  };
}
