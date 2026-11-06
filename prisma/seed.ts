/**
 * `pnpm db:seed`: fills the database with FAKE demo data for development.
 * Always uses the mock integrations, whatever INTEGRATIONS_MODE says, so seeding can never
 * pull real client data. Safe to run more than once (everything is upserted).
 */
import 'dotenv/config';

const industries: Record<string, string> = {
  '1001': 'Manufacturing',
  '1002': 'Dental',
  '1003': 'Legal',
  '1004': 'Distribution',
  '1005': 'Veterinary',
  '1006': 'Manufacturing',
  '1007': 'Retail',
  '1008': 'Non-profit',
  '1009': 'Accounting',
  '1010': 'Hospitality',
};

const prospects = [
  {
    company: 'Northwind Optometry (Demo)',
    segment: 'Healthcare',
    area: 'Downtown',
    phone: '555-0110',
    website: 'https://northwind-optometry.example',
    priority: 'A' as const,
    status: 'MEETING_SET' as const,
    owner: 'Alex',
    lastContactAt: new Date('2026-10-28T00:00:00Z'),
    nextStep: 'Run network assessment',
    notes: 'Two locations, unhappy with current provider.',
  },
  {
    company: 'Contoso Plumbing Supply (Demo)',
    segment: 'Trades',
    area: 'Eastside',
    phone: '555-0111',
    website: 'https://contoso-plumbing.example',
    priority: 'B' as const,
    status: 'CONTACTED' as const,
    owner: 'Jordan',
    lastContactAt: new Date('2026-10-20T00:00:00Z'),
    nextStep: 'Follow up call',
    notes: null,
  },
  {
    company: 'Fabrikam Family Law (Demo)',
    segment: 'Legal',
    area: 'Midtown',
    phone: '555-0112',
    website: null,
    priority: 'A' as const,
    status: 'PROPOSAL_SENT' as const,
    owner: 'Alex',
    lastContactAt: new Date('2026-11-02T00:00:00Z'),
    nextStep: 'Proposal review meeting',
    notes: '12 seats, needs compliance help.',
  },
  {
    company: 'Tailspin Bakery (Demo)',
    segment: 'Hospitality',
    area: 'Northside',
    phone: null,
    website: 'https://tailspin-bakery.example',
    priority: 'C' as const,
    status: 'NOT_CONTACTED' as const,
    owner: null,
    lastContactAt: null,
    nextStep: null,
    notes: null,
  },
  {
    company: 'Wide World Realty (Demo)',
    segment: 'Real estate',
    area: 'Westside',
    phone: '555-0114',
    website: 'https://wideworld-realty.example',
    priority: 'B' as const,
    status: 'RESEARCHING' as const,
    owner: 'Jordan',
    lastContactAt: null,
    nextStep: 'Find decision maker',
    notes: null,
  },
];

async function main() {
  const { env } = await import('../src/env');
  const { db } = await import('../src/lib/db');
  const { runSync } = await import('../src/sync/run-sync');
  const { runReconciliation } = await import('../src/lib/run-reconciliation');
  const { MockSyncroClient } = await import('../src/integrations/syncro/mock');
  const { MockPax8Client } = await import('../src/integrations/pax8/mock');
  const { MockGraphClient } = await import('../src/integrations/graph/mock');

  try {
    // 1. Bootstrap admins from ADMIN_EMAILS.
    if (env.ADMIN_EMAILS.length === 0) {
      console.warn('ADMIN_EMAILS is empty: no admin user created.');
    }
    for (const email of env.ADMIN_EMAILS) {
      await db.user.upsert({
        where: { email },
        create: { email, role: 'ADMIN' },
        update: { role: 'ADMIN' },
      });
    }

    // 2. Manual SKU mapping: Hilltop bills Exchange Online as "Email hosting (per mailbox)".
    await db.skuMapping.upsert({
      where: { pax8Sku: 'EXO-P1' },
      create: { pax8Sku: 'EXO-P1', billingDescription: 'Email hosting (per mailbox)' },
      update: {},
    });

    // 3. Clients, devices, billing lines and licenses from the mock integrations.
    const result = await runSync(null, {
      mode: 'mock',
      syncro: new MockSyncroClient(),
      pax8: new MockPax8Client(),
      graph: new MockGraphClient(),
    });
    for (const source of result.sources) {
      console.info(`Mock ${source.source} sync: ${source.status} (${source.recordsRead} records)`);
      if (source.error) throw new Error(source.error);
    }

    // 4. Extra details that do not come from Syncro.
    for (const [syncroCustomerId, industry] of Object.entries(industries)) {
      await db.client.updateMany({ where: { syncroCustomerId }, data: { industry } });
    }
    const ironwood = await db.client.findUnique({ where: { syncroCustomerId: '1009' } });
    if (ironwood) {
      await db.billingLine.upsert({
        where: { externalId: 'seed:manual:ironwood-vcio' },
        create: {
          externalId: 'seed:manual:ironwood-vcio',
          clientId: ironwood.id,
          description: 'Quarterly vCIO review (billed manually)',
          source: 'MANUAL',
          frequency: 'MONTHLY',
          quantity: 1,
          unitPriceCents: 25_000,
          amountCents: 25_000,
        },
        update: {},
      });
    }

    // 5. Sample prospects (only when the table is empty).
    if ((await db.prospect.count()) === 0) {
      await db.prospect.createMany({ data: prospects });
    }

    // 6. Reconcile again now that manual data exists.
    const recon = await runReconciliation(null);
    const open = await db.reconciliationIssue.groupBy({
      by: ['type'],
      where: { status: 'OPEN' },
      _count: true,
    });
    console.info(
      `Reconciliation: ${recon.created} new, ${recon.updated} updated. Open issues: ` +
        open.map((row) => `${row.type}=${row._count}`).join(', '),
    );
    console.info('Seed complete (fake data only).');
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
